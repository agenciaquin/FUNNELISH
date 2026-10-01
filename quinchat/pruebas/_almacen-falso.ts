/**
 * Lo de FUERA, falso y local, para las pruebas de peso. Infraestructura de
 * prueba, no lógica de la app: la app (rutas, `lib/subir-archivo.ts`, el cliente
 * real de Supabase) se importa de verdad; solo se sustituye lo que está al otro
 * lado del cable.
 *
 *  - `instalarFetchFalso(dbUrl)`: sustituye `globalThis.fetch`.
 *      · Storage de Supabase (`<dbUrl>/storage/v1/object/...`): ACEPTA las subidas
 *        y las guarda en memoria (ruta, bytes, content-type, cache-control). El
 *        PostgREST falso (`_postgrest-falso.ts`) las responde con 404; aquí no.
 *      · El resto de `http://127.0.0.1` (el PostgREST falso) pasa tal cual.
 *      · Meta (graph.facebook.com): descarga de medios con los bytes que fije la
 *        prueba, envío de mensajes y subida de medios, anotados.
 *      · Cualquier otra URL: se anota y responde 503. NADA sale de la máquina.
 *  - `arrancarIaFalsa(texto)`: servidor local que hace de API de Anthropic
 *    (`ANTHROPIC_BASE_URL`), anota cada petición y responde `texto`.
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Subida {
  metodo: string; bucket: string; ruta: string; bytes: Buffer;
  contentType: string | null; cacheControl: string | null; upsert: string | null;
}
export interface EnvioMeta { url: string; cuerpo: any }
export interface SubidaMeta { tipo: string | null; bytes: Buffer; nombre: string | null }

export interface Fuera {
  subidas: Subida[];
  listados: string[];
  enviosMeta: EnvioMeta[];
  subidasMeta: SubidaMeta[];
  /** Descargas de medios de Meta (por id). */
  descargas: string[];
  /** Llamadas a cualquier otro sitio de fuera (deben quedar en 0 o en lo esperado). */
  externas: string[];
  /** Medios que "tiene" Meta: id -> bytes y tipo. */
  medios: Map<string, { buf: Buffer; mime: string }>;
  desinstalar(): void;
}

function cabecera(h: any, nombre: string): string | null {
  if (!h) return null;
  if (typeof h.get === 'function') return h.get(nombre);
  const k = Object.keys(h).find(x => x.toLowerCase() === nombre.toLowerCase());
  return k ? String(h[k]) : null;
}

async function aBuffer(b: any): Promise<Buffer> {
  if (b == null) return Buffer.alloc(0);
  if (Buffer.isBuffer(b)) return b;
  if (b instanceof Uint8Array) return Buffer.from(b);
  if (b instanceof ArrayBuffer) return Buffer.from(new Uint8Array(b));
  if (typeof Blob !== 'undefined' && b instanceof Blob) return Buffer.from(await b.arrayBuffer());
  if (typeof b === 'string') return Buffer.from(b);
  if (typeof FormData !== 'undefined' && b instanceof FormData) {
    for (const [, v] of b.entries()) if (typeof v !== 'string') return Buffer.from(await (v as Blob).arrayBuffer());
  }
  throw new Error('cuerpo de subida no reconocido: ' + Object.prototype.toString.call(b));
}

export function instalarFetchFalso(dbUrl: string): Fuera {
  const f: Fuera = {
    subidas: [], listados: [], enviosMeta: [], subidasMeta: [], descargas: [], externas: [],
    medios: new Map(), desinstalar: () => {},
  };
  const original = globalThis.fetch;
  let n = 0;
  globalThis.fetch = (async (entrada: any, init?: any) => {
    const url = String(entrada?.url ?? entrada);
    const metodo = String(init?.method ?? entrada?.method ?? 'GET').toUpperCase();

    if (url.startsWith(`${dbUrl}/storage/v1/object/`)) {
      const resto = url.slice(`${dbUrl}/storage/v1/object/`.length).split('?')[0];
      if (resto.startsWith('public/') && (metodo === 'GET' || metodo === 'HEAD')) {
        // URL pública: sirve lo último que se subió a esa ruta (como el CDN de Supabase).
        const [bucket, ...r] = decodeURIComponent(resto.slice(7)).split('/');
        const s = [...f.subidas].reverse().find(x => x.bucket === bucket && x.ruta === r.join('/'));
        if (!s) return new Response(null, { status: 404 });
        return new Response(metodo === 'HEAD' ? null : new Uint8Array(s.bytes), { status: 200, headers: { 'content-type': s.contentType ?? 'application/octet-stream', 'content-length': String(s.bytes.length) } });
      }
      if (resto.startsWith('list/')) {
        f.listados.push(decodeURIComponent(resto.slice(5)));
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (metodo === 'POST' || metodo === 'PUT') {
        const partes = resto.split('/');
        const bucket = decodeURIComponent(partes[0]!);
        const ruta = decodeURIComponent(partes.slice(1).join('/'));
        f.subidas.push({
          metodo, bucket, ruta, bytes: await aBuffer(init?.body),
          contentType: cabecera(init?.headers, 'content-type'),
          cacheControl: cabecera(init?.headers, 'cache-control'),
          upsert: cabecera(init?.headers, 'x-upsert'),
        });
        return new Response(JSON.stringify({ Key: `${bucket}/${ruta}`, Id: `id-${++n}` }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('{"message":"no soportado en la prueba"}', { status: 400 });
    }
    if (url.startsWith('http://127.0.0.1')) return original(entrada, init);

    const g = url.match(/^https:\/\/graph\.facebook\.com\/v[\d.]+\/(.+)$/);
    if (g) {
      const tramo = g[1]!;
      if (/\/messages$/.test(tramo)) {
        let cuerpo: any; try { cuerpo = JSON.parse(String(init?.body ?? '')); } catch { cuerpo = init?.body; }
        f.enviosMeta.push({ url, cuerpo });
        return new Response(JSON.stringify({ messages: [{ id: `wamid.bot-${++n}` }] }), { status: 200 });
      }
      if (/\/media$/.test(tramo) && metodo === 'POST') {
        const fd = init?.body as FormData;
        const archivo = fd?.get?.('file') as File | null;
        f.subidasMeta.push({ tipo: (fd?.get?.('type') as string) ?? null, bytes: await aBuffer(archivo), nombre: (archivo as any)?.name ?? null });
        return new Response(JSON.stringify({ id: `media-subido-${++n}` }), { status: 200 });
      }
      const m = f.medios.get(tramo);
      if (m) {
        f.descargas.push(tramo);
        return new Response(JSON.stringify({ url: `https://archivo.prueba/${tramo}`, mime_type: m.mime }), { status: 200 });
      }
    }
    const a = url.match(/^https:\/\/archivo\.prueba\/(.+)$/);
    if (a && f.medios.has(a[1]!)) {
      const m = f.medios.get(a[1]!)!;
      return new Response(new Uint8Array(m.buf), { status: 200, headers: { 'content-type': m.mime } });
    }
    f.externas.push(`${metodo} ${url}`);
    return new Response('{"error":"sin red en la prueba"}', { status: 503 });
  }) as any;
  f.desinstalar = () => { globalThis.fetch = original; };
  return f;
}

export interface IaFalsa { url: string; peticiones: any[]; cerrar(): Promise<void> }

/** API de Anthropic falsa en 127.0.0.1. Responde siempre `texto`. */
export async function arrancarIaFalsa(texto: string): Promise<IaFalsa> {
  const ia: IaFalsa = { url: '', peticiones: [], cerrar: async () => {} };
  const srv = createServer((req, res) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', c => { s += c; });
    req.on('end', () => {
      try { ia.peticiones.push(JSON.parse(s)); } catch { ia.peticiones.push(s); }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: `msg_${ia.peticiones.length}`, type: 'message', role: 'assistant', model: 'falso',
        content: [{ type: 'text', text: texto }], stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }));
    });
  });
  await new Promise<void>(ok => srv.listen(0, '127.0.0.1', () => ok()));
  ia.url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  ia.cerrar = () => new Promise<void>(ok => { srv.closeAllConnections?.(); srv.close(() => ok()); });
  return ia;
}

/** Imágenes que lleva una petición a la IA (base64 de los bloques `image`). */
export function imagenesDeIa(peticion: any): { media_type: string; data: string }[] {
  const out: { media_type: string; data: string }[] = [];
  for (const m of peticion?.messages ?? []) {
    if (!Array.isArray(m.content)) continue;
    for (const b of m.content) if (b?.type === 'image' && b.source?.data) out.push({ media_type: b.source.media_type, data: b.source.data });
  }
  return out;
}

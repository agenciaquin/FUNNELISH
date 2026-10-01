/**
 * LEY DE PESO en las RUTAS REALES que guardan imágenes: qué se acepta, qué se
 * rechaza y qué llega a Storage y a Meta.
 *
 *   MUESTRAS=<copias locales del bucket> npx tsx pruebas/peso-rutas.ts
 *
 * Rutas (handlers reales, importados): `funnels/imagen`, `catalogos/upload-imagen`,
 * `plantillas-wa/imagen` y `whatsapp/send-media` (esta con la sesión de
 * `_sesion-falsa.ts`). Supabase = PostgREST falso + Storage falso (`_almacen-falso.ts`);
 * Meta falso. Nada sale de la máquina.
 *
 * LEY §1 punto 4: solo se rechaza lo técnicamente imposible:
 *   - archivo corrupto                    -> 422, y no se sube nada;
 *   - GIF o SVG hacia WhatsApp            -> 415;
 *   - más de 5 MB para Meta tras comprimir -> 413 con instrucción.
 * Todo lo demás (foto pesada, ruido que no cabe ni con rescate) se ACEPTA (200),
 * se guarda con `cacheControl` de 1 año y, si es nivel 4, trae un `aviso`.
 *
 * El 413 es inalcanzable con fotos reales (el compresor nunca deja > 5 MB lo que
 * cabe en una petición). Para ejercitar la rama, y SOLO en ese caso, se infla la
 * salida de `sharp.prototype.toBuffer` en +6 MB: el código de la ruta es el real.
 */
import sharp from 'sharp';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { arrancarPostgrest } from './_postgrest-falso';
import { instalarFetchFalso } from './_almacen-falso';
import { instalarNextHeaders, fijarSesion } from './_sesion-falsa';

let ok = 0, falla = 0;
function caso(nombre: string, cond: boolean, extra = '') {
  if (cond) ok++; else falla++;
  console.log(`${cond ? 'ok   ' : 'FALLA'} ${nombre}${extra ? `  -> ${extra}` : ''}`);
}
function info(t: string) { console.log(`info  ${t}`); }

const MUESTRAS = process.env.MUESTRAS ?? '';
const TO = '573001112233';
const MB = 1024 * 1024;

(async () => {
  instalarNextHeaders();
  const db = await arrancarPostgrest({
    conversations: [{ id: TO, contact_name: 'Ana', linea: 'funnel', bot_enabled: true }],
    messages: [], configuracion: [],
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
  process.env.WHATSAPP_ACCESS_TOKEN = 'falso';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '111';
  const fuera = instalarFetchFalso(db.url);

  const logs = { log: console.log, warn: console.warn, error: console.error };
  const lineasLey: string[] = [];
  const callar = () => { console.warn = (...a: any[]) => { if (String(a[0]).includes('[ley-peso]')) lineasLey.push(a.map(String).join(' ')); }; console.error = () => {}; };
  const hablar = () => { console.warn = logs.warn; console.error = logs.error; };

  callar();
  const { NextRequest } = await import('next/server');
  const rFunnels = await import('../app/api/funnels/imagen/route');
  const rCatalogo = await import('../app/api/catalogos/upload-imagen/route');
  const rPlantilla = await import('../app/api/plantillas-wa/imagen/route');
  const rChat = await import('../app/api/whatsapp/send-media/route');
  hablar();
  await fijarSesion({ name: 'Prueba', email: 'prueba@local', tenantId: 'klixmant' });

  // ── Archivos de prueba ────────────────────────────────────────────────────
  const fotoReal = MUESTRAS && existsSync(join(MUESTRAS, 'chat-media/573159477832/1787799841229-g10nc.jpg'))
    ? readFileSync(join(MUESTRAS, 'chat-media/573159477832/1787799841229-g10nc.jpg')) : null;   // 3,6 MB, 3264 px
  const foto = fotoReal ?? await sharp({ create: { width: 3000, height: 3000, channels: 3, background: '#7a5' } }).jpeg({ quality: 100 }).toBuffer();
  if (!fotoReal) info('sin MUESTRAS: la «foto pesada» es sintética');
  // Corrupto PEQUEÑO (cabe en el tope), GRANDE (no cabe) y "no es lo que dice ser" (un PDF que dice ser JPEG).
  const corrupto = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('esto no es una imagen'.repeat(500))]);
  const corruptoGrande = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('esto no es una imagen'.repeat(30000))]);
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(40000, 0x20)]);
  const gif = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#f00' } }).gif().toBuffer();
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
  const webp = await sharp(foto).resize(1200).webp({ quality: 80 }).toBuffer();
  // Ruido: no cabe ni en el rescate -> nivel 4 (aceptado con aviso).
  const ruido = await (async () => { const px = Buffer.alloc(1920 * 1920 * 3); let s = 7; for (let i = 0; i < px.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; px[i] = s >>> 24; } return sharp(px, { raw: { width: 1920, height: 1920, channels: 3 } }).jpeg({ quality: 95 }).toBuffer(); })();

  const form = (campos: Record<string, string | { buf: Buffer; tipo: string; nombre: string }>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) {
      if (typeof v === 'string') fd.append(k, v);
      else fd.append(k, new File([new Uint8Array(v.buf)], v.nombre, { type: v.tipo }));
    }
    return fd;
  };
  const llamar = async (ruta: 'funnels' | 'catalogo' | 'plantilla' | 'chat', buf: Buffer, tipo: string, nombre = 'foto') => {
    const antes = fuera.subidas.length, antesMeta = fuera.subidasMeta.length;
    let req: any;
    if (ruta === 'plantilla') {
      req = new NextRequest('http://localhost/api/plantillas-wa/imagen', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nombre: 'confirmacion', imagenBase64: `data:${tipo};base64,${buf.toString('base64')}`, imagenMime: tipo }) });
    } else {
      const url = { funnels: '/api/funnels/imagen', catalogo: '/api/catalogos/upload-imagen', chat: '/api/whatsapp/send-media' }[ruta];
      const campos: any = { file: { buf, tipo, nombre } };
      if (ruta === 'funnels') campos.slug = 'prueba';
      if (ruta === 'chat') campos.to = TO;
      req = new NextRequest(`http://localhost${url}`, { method: 'POST', body: form(campos) });
    }
    const POST = { funnels: rFunnels.POST, catalogo: rCatalogo.POST, plantilla: rPlantilla.POST, chat: rChat.POST }[ruta] as any;
    callar();
    const t0 = Date.now();
    let res: Response;
    try { res = await POST(req); } finally { hablar(); }
    const ms = Date.now() - t0;
    const cuerpo = await res.json().catch(() => ({}));
    return { status: res.status, cuerpo, ms, subidas: fuera.subidas.slice(antes), meta: fuera.subidasMeta.slice(antesMeta) };
  };

  const RUTAS = ['funnels', 'catalogo', 'plantilla', 'chat'] as const;
  try {
    // ── 1 · Corrupto -> 422 y no se sube nada ───────────────────────────────
    for (const [etq, b] of [['corrupto grande (> tope)', corruptoGrande], ['corrupto pequeño (<= tope)', corrupto], ['PDF que dice ser JPEG', pdf]] as const)
    for (const r of RUTAS) {
      const x = await llamar(r, b as Buffer, 'image/jpeg', 'roto.jpg');
      caso(`${r}: ${etq} (${Math.round((b as Buffer).length / 1024)} kB) -> 422 ILEGIBLE`, x.status === 422 && x.cuerpo.codigo === 'ILEGIBLE', `${x.status} ${JSON.stringify(x.cuerpo).slice(0, 90)}`);
      caso(`${r}: ${etq} -> el mensaje dice qué hacer`, /Expórtala de nuevo como JPG o PNG/.test(x.cuerpo.error ?? ''));
      caso(`${r}: ${etq} -> no se sube nada a Storage ni a Meta`, x.subidas.length === 0 && x.meta.length === 0, `${x.subidas.length} subidas, ${x.meta.length} a Meta`);
    }

    // ── 2 · GIF y SVG hacia WhatsApp -> 415 ──────────────────────────────────
    for (const r of ['plantilla', 'chat'] as const) {
      for (const [n, b, t] of [['GIF', gif, 'image/gif'], ['SVG', svg, 'image/svg+xml']] as const) {
        const x = await llamar(r, b as Buffer, t, `a.${n.toLowerCase()}`);
        caso(`${r}: ${n} -> 415 FORMATO con instrucción`, x.status === 415 && x.cuerpo.codigo === 'FORMATO' && /JPG o PNG/.test(x.cuerpo.error ?? ''), `${x.status} ${JSON.stringify(x.cuerpo).slice(0, 80)}`);
        caso(`${r}: ${n} -> no llega a Meta`, x.meta.length === 0);
        if (x.subidas.length) info(`${r}: el ${n} rechazado con 415 SÍ quedó subido a Storage (${x.subidas.map(s => s.ruta).join(', ')}): archivo sin mensaje que lo use`);
      }
    }
    // Los mismos GIF/SVG al panel (landing/catálogo) NO son de WhatsApp: no se rechazan por formato.
    for (const r of ['funnels', 'catalogo'] as const) {
      const x = await llamar(r, gif, 'image/gif', 'a.gif');
      caso(`${r}: GIF a la landing/catálogo se acepta (no es WhatsApp)`, x.status === 200 && x.subidas.length === 1, `${x.status}`);
    }

    // ── 3 · Foto pesada real -> se ACEPTA, comprimida, con caché de 1 año ────
    for (const r of RUTAS) {
      const x = await llamar(r, foto, 'image/jpeg', 'foto.jpg');
      const s = x.subidas[0];
      const tope = r === 'chat' || r === 'plantilla' ? 250 * 1024 : 250 * 1024;
      caso(`${r}: foto de ${Math.round(foto.length / 1024)} kB -> 200 aceptada`, x.status === 200, `${x.status} ${JSON.stringify(x.cuerpo).slice(0, 100)} (${x.ms} ms)`);
      caso(`${r}: se guarda comprimida (<= tope + 50 %)`, !!s && s.bytes.length <= tope * 1.5 && s.bytes.length < foto.length, s ? `${Math.round(s.bytes.length / 1024)} kB, nivel ${x.cuerpo.nivel ?? '-'}` : 'sin subida');
      caso(`${r}: content-type image/jpeg y cache-control de 1 año`, !!s && s.contentType === 'image/jpeg' && s.cacheControl === 'max-age=31536000', s ? `${s.contentType} / ${s.cacheControl}` : '');
      if (r === 'chat') {
        const m = x.meta[0];
        caso('chat: a Meta va EXACTAMENTE el buffer guardado', !!m && !!s && m.bytes.equals(s.bytes), m ? `${m.bytes.length} B vs ${s?.bytes.length} B` : 'nada a Meta');
        caso('chat: a Meta va como image/jpeg', m?.tipo === 'image/jpeg', String(m?.tipo));
        const fila = db.tablas.messages.find((f: any) => f.content === x.cuerpo.media_url);
        caso('chat: el mensaje del panel apunta a la URL guardada', !!fila && fila.type === 'image' && String(fila.content).includes(s?.ruta ?? '#'));
      }
    }

    // ── 4 · WebP hacia WhatsApp -> se convierte (no se rechaza) ───────────────
    for (const r of ['plantilla', 'chat'] as const) {
      const x = await llamar(r, webp, 'image/webp', 'a.webp');
      caso(`${r}: WebP -> 200 convertido a JPEG`, x.status === 200 && x.subidas[0]?.contentType === 'image/jpeg', `${x.status} ${x.subidas[0]?.contentType}`);
      if (r === 'chat') caso('chat: WebP -> a Meta va JPEG', x.meta[0]?.tipo === 'image/jpeg', String(x.meta[0]?.tipo));
    }

    // ── 5 · Ruido que no cabe ni con rescate -> nivel 4: aceptado con aviso ──
    for (const r of RUTAS) {
      const x = await llamar(r, ruido, 'image/jpeg', 'ruido.jpg');
      const s = x.subidas[0];
      caso(`${r}: no cabe ni con rescate -> 200 aceptada (nivel 4)`, x.status === 200 && !!s, `${x.status} ${s ? Math.round(s.bytes.length / 1024) + ' kB' : ''}`);
      caso(`${r}: nivel 4 -> aviso no bloqueante en la respuesta`, /^Subida\. Pesa .+ lo recomendado es 250 kB/.test(x.cuerpo.aviso ?? ''), String(x.cuerpo.aviso));
      if (s) { const m = await sharp(s.bytes).metadata(); caso(`${r}: nivel 4 -> se guarda la de los escalones normales (lado >= 1440)`, Math.max(m.width!, m.height!) >= 1440, `${m.width}x${m.height}`); }
    }
    caso('nivel 4 deja la línea [ley-peso] SUPERA_TOPE en el registro', lineasLey.some(l => l.includes('SUPERA_TOPE')));

    // ── 6 · Más de 5 MB para Meta tras comprimir -> 413 con instrucción ──────
    {
      const proto = (sharp as any).prototype;
      const orig = proto.toBuffer;
      proto.toBuffer = async function (...a: any[]) {
        const r = await orig.apply(this, a);
        if (a[0]?.resolveWithObject) return r;   // los usos internos de medida no se tocan
        return Buffer.concat([r, Buffer.alloc(6 * MB)]);
      };
      try {
        for (const r of ['plantilla', 'chat'] as const) {
          const x = await llamar(r, webp, 'image/webp', 'grande.webp');
          caso(`${r}: > 5 MB tras comprimir -> 413 LIMITE_META con instrucción`, x.status === 413 && x.cuerpo.codigo === 'LIMITE_META' && /Recórtala o usa una versión más pequeña/.test(x.cuerpo.error ?? ''), `${x.status} ${String(x.cuerpo.error).slice(0, 90)}`);
          caso(`${r}: 413 -> no llega a Meta`, x.meta.length === 0);
          if (x.subidas.length) info(`${r}: el archivo rechazado con 413 SÍ quedó subido a Storage (${x.subidas.length}): archivo sin mensaje que lo use`);
        }
        const x = await llamar('funnels', webp, 'image/webp', 'grande.webp');
        caso('funnels: > 5 MB en la landing NO es límite de Meta -> 200 aceptada', x.status === 200, String(x.status));
      } finally { proto.toBuffer = orig; }
    }

    caso('ninguna llamada salió de la máquina', fuera.externas.length === 0, fuera.externas.slice(0, 3).join(' | '));
  } finally {
    fuera.desinstalar();
    await db.cerrar();
  }
  console.log(`\n${ok}/${ok + falla} ok`);
  process.exit(falla ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });

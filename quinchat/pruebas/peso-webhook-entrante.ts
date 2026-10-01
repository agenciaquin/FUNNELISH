/**
 * LEY DE PESO en el WEBHOOK DE WHATSAPP: la foto que manda el cliente.
 *
 *   MUESTRAS=<copias locales del bucket> npx tsx pruebas/peso-webhook-entrante.ts
 *
 * Ruta REAL `app/api/whatsapp/webhook/route.ts` (POST), con el arnés de
 * `webhook-duplicados.ts`: PostgREST falso con `messages` de clave primaria `id`,
 * Storage y Meta falsos (`_almacen-falso.ts`) y la IA falsa (`ANTHROPIC_BASE_URL`
 * a 127.0.0.1, responde «NO»). La espera de 12 s se acorta a 300 ms y se ANOTA.
 *
 * Qué comprueba (línea de confirmación y línea de ventas):
 *  - la foto grande se guarda COMPRIMIDA (foto-entrante en confirmación), JPEG,
 *    con caché de 1 año, y la fila del chat apunta a ella;
 *  - la IA recibe el buffer ORIGINAL, byte a byte (no el comprimido);
 *  - la respuesta del bot es la de siempre;
 *  - un reintento de Meta no descarga, no sube, no llama a la IA ni responde;
 *  - la espera de 12 s no cambia (texto: 1 espera de 12 000 ms; foto: ninguna);
 *  - sticker sin recomprimir, foto pequeña intacta, archivo corrupto se guarda igual.
 *
 * Con `RAIZ_APP=<otra copia de quinchat>` (y ejecutando desde esa carpeta) corre
 * contra otra versión del código: la «huella» final (IA, respuestas, esperas)
 * sirve para comparar con la rama base. En ese modo los casos de compresión solo
 * se informan.
 */
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { arrancarPostgrest } from './_postgrest-falso';
import { instalarFetchFalso, arrancarIaFalsa, imagenesDeIa } from './_almacen-falso';
import { ssim } from './_ssim';

const MUESTRAS = process.env.MUESTRAS ?? '';
const APP = process.env.RAIZ_APP ? resolve(process.env.RAIZ_APP) : join(__dirname, '..');
const MODO_BASE = !!process.env.RAIZ_APP;
let ok = 0, falla = 0;
function caso(nombre: string, cond: boolean, extra = '', soloRama = false) {
  if (MODO_BASE && soloRama) { console.log(`info  ${nombre}: ${cond ? 'sí' : 'no'}  ${extra}`); return; }
  if (cond) ok++; else falla++;
  console.log(`${cond ? 'ok   ' : 'FALLA'} ${nombre}${extra ? `  -> ${extra}` : ''}`);
}
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const FROM = '573009998877';
const RESPUESTA_FOTO = '¡Gracias por la foto! 😊 ¿En qué te ayudo con tu pedido? Si me enviaste tu comprobante de pago, ¿me lo confirmas? 🙌';
const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));
const huella: string[] = [];

(async () => {
  const leer = (rel: string) => { const p = join(MUESTRAS, rel); return existsSync(p) ? readFileSync(p) : null; };
  const grande = leer('chat-media/573159477832/1787799841229-g10nc.jpg');            // 3,6 MB, 3264 px (< 4 MB: la IA de ventas la ve)
  const pequena = leer('chat-media/573006202969/1788547911615-hnczz.jpg');            // < 390 kB
  if (!grande || !pequena) { console.log('FALLA sin MUESTRAS (chat-media/...)'); process.exit(1); }
  const sticker = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).webp().toBuffer();
  const corrupto = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('roto'.repeat(200000))]);  // 800 kB

  const db = await arrancarPostgrest({
    conversations: [{ id: FROM, contact_name: 'Ana', bot_enabled: true, interaccion_bot: true, unread_count: 0, label: '' }],
    messages: [], clientes_funnelish: [],
  });
  db.unicos.add('messages');
  const ia = await arrancarIaFalsa('NO');

  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
  process.env.WHATSAPP_ACCESS_TOKEN = 'falso';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '111';
  process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS = '222';
  process.env.ANTHROPIC_API_KEY = 'falsa';
  process.env.ANTHROPIC_BASE_URL = ia.url;
  for (const v of ['WHATSAPP_APP_SECRET', 'BOT_IA', 'BOT_TOPE_DIARIO', 'GROQ_API_KEY']) delete process.env[v];
  const fuera = instalarFetchFalso(db.url);
  fuera.medios.set('media-grande', { buf: grande, mime: 'image/jpeg' });
  fuera.medios.set('media-grande-v', { buf: grande, mime: 'image/jpeg' });
  fuera.medios.set('media-pequena', { buf: pequena, mime: 'image/jpeg' });
  fuera.medios.set('media-sticker', { buf: sticker, mime: 'image/webp' });
  fuera.medios.set('media-roto', { buf: corrupto, mime: 'image/jpeg' });

  // La espera de 12 s se acorta y se anota.
  const esperas: number[] = [];
  const stOrig = globalThis.setTimeout;
  globalThis.setTimeout = ((fn: any, ms?: number, ...a: any[]) => { if (ms === 12000) { esperas.push(ms); return stOrig(fn, 300, ...a); } return stOrig(fn, ms, ...a); }) as any;

  const logs = { log: console.log, warn: console.warn, error: console.error };
  const callar = () => { console.log = () => {}; console.warn = () => {}; console.error = () => {}; };
  const hablar = () => { console.log = logs.log; console.warn = logs.warn; console.error = logs.error; };

  callar();
  const { POST } = await import(pathToFileURL(join(APP, 'app/api/whatsapp/webhook/route.ts')).href);
  const { NextRequest } = await import(pathToFileURL(join(APP, 'node_modules/next/server.js')).href);
  hablar();

  const aviso = (msg: any, phoneId = '111') => new NextRequest('https://x/api/whatsapp/webhook', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entry: [{ changes: [{ value: {
      messaging_product: 'whatsapp', metadata: { phone_number_id: phoneId },
      contacts: [{ profile: { name: 'Ana' }, wa_id: FROM }],
      messages: [{ from: FROM, timestamp: String(Math.floor(Date.now() / 1000)), ...msg }],
    } }] }] }),
  });
  const enviar = async (msg: any, phoneId = '111') => {
    callar();
    const t0 = Date.now();
    try { await POST(aviso(msg, phoneId)).catch(() => null); } finally { hablar(); }
    return Date.now() - t0;
  };
  const estado = () => ({ d: fuera.descargas.length, s: fuera.subidas.length, ia: ia.peticiones.length, meta: fuera.enviosMeta.length, esperas: esperas.length });
  const textosA = (desde: number) => fuera.enviosMeta.slice(desde).map(e => e.cuerpo?.text?.body ?? e.cuerpo?.type ?? '?');
  const iaImgs = (desde: number) => ia.peticiones.slice(desde).flatMap(imagenesDeIa);
  const filas = (id: string) => db.tablas.messages.filter((m: any) => m.id === id);

  try {
    // ── 1 · Foto grande, línea de confirmación ──────────────────────────────
    {
      const a = estado();
      const ms = await enviar({ id: 'wamid.F1', type: 'image', image: { id: 'media-grande', mime_type: 'image/jpeg' } });
      const subs = fuera.subidas.slice(a.s);
      const s = subs[0];
      caso('1. foto grande: se descarga una vez', fuera.descargas.length - a.d === 1);
      caso('1. foto grande: una sola subida, en entrantes/', subs.length === 1 && !!s?.ruta.startsWith(`entrantes/${FROM}/`), subs.map(x => x.ruta).join(','));
      if (s) {
        const m = await sharp(s.bytes).metadata();
        const q = await ssim(grande, s.bytes);
        caso('1. se guarda comprimida (foto-entrante: <= 400 kB, o nivel 2 <= 600 kB)', s.bytes.length <= 600 * 1024 && s.bytes.length < grande.length, `${Math.round(grande.length / 1024)} -> ${Math.round(s.bytes.length / 1024)} kB, ${m.width}x${m.height}`, true);
        caso('1. JPEG con caché de 1 año', s.contentType === 'image/jpeg' && m.format === 'jpeg' && s.cacheControl === 'max-age=31536000', `${s.contentType} ${s.cacheControl}`, true);
        caso('1. lado >= 1440 y SSIM >= 0,95', Math.max(m.width!, m.height!) >= 1440 && q >= 0.95, `${Math.max(m.width!, m.height!)} px, SSIM ${q.toFixed(4)}`, true);
        const f = filas('wamid.F1')[0];
        caso('1. la fila del chat apunta a la foto guardada (type image)', !!f && f.type === 'image' && String(f.content).endsWith(s.ruta), f ? `${f.type} ${String(f.content).slice(-50)}` : 'sin fila');
      }
      const imgs = iaImgs(a.ia);
      caso('1. la IA recibe la foto ORIGINAL, byte a byte', imgs.length === 1 && sha(Buffer.from(imgs[0]!.data, 'base64')) === sha(grande) && imgs[0]!.media_type === 'image/jpeg',
        imgs.map(i => `${i.media_type} ${sha(Buffer.from(i.data, 'base64'))} (original ${sha(grande)})`).join(','));
      const t = textosA(a.meta);
      caso('1. el bot responde lo de siempre a una foto que no es comprobante', t.length === 1 && t[0] === RESPUESTA_FOTO, JSON.stringify(t));
      caso('1. una foto no pasa por la espera de 12 s', esperas.length === a.esperas, `${esperas.length - a.esperas} esperas`);
      huella.push(`F1 ia=${imgs.map(i => sha(Buffer.from(i.data, 'base64'))).join('+')} resp=${JSON.stringify(t)} esperas=${esperas.length - a.esperas} (${ms} ms)`);
    }

    // ── 2 · Reintento de Meta de la misma foto ──────────────────────────────
    {
      const a = estado();
      await enviar({ id: 'wamid.F1', type: 'image', image: { id: 'media-grande', mime_type: 'image/jpeg' } });
      const b = estado();
      caso('2. reintento: ni descarga, ni subida, ni IA, ni respuesta', b.d === a.d && b.s === a.s && b.ia === a.ia && b.meta === a.meta, JSON.stringify({ antes: a, despues: b }));
      caso('2. reintento: sigue una sola fila', filas('wamid.F1').length === 1);
      huella.push(`F1-reintento delta=${JSON.stringify({ d: b.d - a.d, s: b.s - a.s, ia: b.ia - a.ia, meta: b.meta - a.meta })}`);
    }

    // ── 3 · Texto: la espera de 12 s sigue igual ────────────────────────────
    {
      const a = estado();
      await enviar({ id: 'wamid.T1', type: 'text', text: { body: 'hola, ¿tienen talla M?' } });
      caso('3. texto: una espera de 12 000 ms, como antes', esperas.length - a.esperas === 1, `${esperas.length - a.esperas} esperas`);
      const t = textosA(a.meta);
      huella.push(`T1 esperas=${esperas.length - a.esperas} ia=${ia.peticiones.length - a.ia} resp=${JSON.stringify(t).slice(0, 80)}`);
    }

    // ── 4 · Foto pequeña: se guarda intacta ─────────────────────────────────
    {
      const a = estado();
      await enviar({ id: 'wamid.P1', type: 'image', image: { id: 'media-pequena', mime_type: 'image/jpeg' } });
      const s = fuera.subidas.slice(a.s)[0];
      caso('4. foto pequeña (<= 400 kB): se guarda byte a byte', !!s && s.bytes.equals(pequena), s ? `${s.bytes.length} B vs ${pequena.length} B` : 'sin subida');
      const imgs = iaImgs(a.ia);
      caso('4. la IA la recibe igual', imgs.length === 1 && sha(Buffer.from(imgs[0]!.data, 'base64')) === sha(pequena));
    }

    // ── 5 · Sticker: sin recomprimir (uno animado quedaría quieto) ──────────
    {
      const a = estado();
      await enviar({ id: 'wamid.S1', type: 'sticker', sticker: { id: 'media-sticker', mime_type: 'image/webp' } });
      const s = fuera.subidas.slice(a.s)[0];
      caso('5. sticker: se guarda tal cual, image/webp', !!s && s.bytes.equals(sticker) && s.contentType === 'image/webp', s ? `${s.contentType} ${s.bytes.length} B` : 'sin subida');
    }

    // ── 6 · Foto corrupta del cliente: NUNCA se rechaza ─────────────────────
    {
      const a = estado();
      await enviar({ id: 'wamid.R1', type: 'image', image: { id: 'media-roto', mime_type: 'image/jpeg' } });
      const s = fuera.subidas.slice(a.s)[0];
      caso('6. corrupta: se guarda igual (lo del cliente no se rechaza)', !!s && s.bytes.length === corrupto.length, s ? `${s.bytes.length} B` : 'sin subida');
      caso('6. corrupta: la fila del chat existe y el bot sigue', filas('wamid.R1').length === 1 && textosA(a.meta).length === 1, JSON.stringify(textosA(a.meta)));
    }

    // ── 7 · Línea de VENTAS: foto grande ────────────────────────────────────
    {
      const a = estado();
      const ms = await enviar({ id: 'wamid.V1', type: 'image', image: { id: 'media-grande-v', mime_type: 'image/jpeg' } }, '222');
      for (let i = 0; i < 50 && ia.peticiones.length === a.ia; i++) await dormir(20);
      const s = fuera.subidas.slice(a.s).find(x => x.ruta.startsWith(`ventas/${FROM}/`));
      caso('7. ventas: la foto se guarda en ventas/', !!s, fuera.subidas.slice(a.s).map(x => x.ruta).join(','));
      if (s) {
        const m = await sharp(s.bytes).metadata();
        caso('7. ventas: se guarda comprimida, JPEG, caché de 1 año', s.bytes.length < grande.length && s.contentType === 'image/jpeg' && s.cacheControl === 'max-age=31536000', `${Math.round(s.bytes.length / 1024)} kB ${m.width}x${m.height} ${s.contentType}`, true);
        caso('7. ventas: tipo usado = foto del cliente (LEY: foto-entrante, 400 kB)', s.bytes.length > 250 * 1024 || Math.max(m.width!, m.height!) >= 1920,
          `${Math.round(s.bytes.length / 1024)} kB, ${m.width}px: ${s.bytes.length <= 250 * 1024 ? 'cabe en 250 kB (perfil foto-whatsapp)' : 'perfil 400 kB'}`, true);
      }
      const imgs = iaImgs(a.ia);
      caso('7. ventas: la IA recibe la foto ORIGINAL, byte a byte', imgs.length >= 1 && imgs.some(i => sha(Buffer.from(i.data, 'base64')) === sha(grande)),
        imgs.map(i => sha(Buffer.from(i.data, 'base64'))).join(',') + ` (original ${sha(grande)})`);
      caso('7. ventas: una espera de 12 s, como antes', esperas.length - a.esperas === 1, `${esperas.length - a.esperas}`);
      const t = textosA(a.meta);
      caso('7. ventas: el bot responde', t.length >= 1, JSON.stringify(t).slice(0, 100));
      huella.push(`V1 ia=${imgs.map(i => sha(Buffer.from(i.data, 'base64'))).join('+')} esperas=${esperas.length - a.esperas} resp=${JSON.stringify(t).slice(0, 80)} (${ms} ms)`);
    }
    if (fuera.externas.length) console.log(`info  llamadas de fuera interceptadas (503, no salieron): ${[...new Set(fuera.externas)].join(' | ')}`);
  } finally {
    globalThis.setTimeout = stOrig;
    fuera.desinstalar();
    await db.cerrar();
    await ia.cerrar();
  }
  console.log('\nHuella (para comparar con la rama base):');
  for (const h of huella) console.log('  ' + h);
  console.log(`\n${ok}/${ok + falla} ok`);
  process.exit(falla ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });

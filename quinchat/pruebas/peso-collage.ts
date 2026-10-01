/**
 * LEY DE PESO en lo que GENERA el servidor: collages de packs y marca de agua.
 *
 *   MUESTRAS=<copias locales del bucket> npx tsx pruebas/peso-collage.ts
 *
 * Código real importado:
 *   - `lib/collage.ts` (`generarCollagePack`, el del bot de ventas), con 2 y 3 fotos;
 *   - el collage del webhook de Funnelish, que no se exporta: se ejercita con
 *     `procesarPedidoFunnelish` (exportada) y un pedido «Arma tu pack» con 2 fotos;
 *   - `lib/watermark.ts` (`estamparNombreDetallado`).
 * Las fotos son productos reales de `catalogo-imagenes/` servidas desde 127.0.0.1.
 * Supabase y Meta falsos (`_postgrest-falso.ts`, `_almacen-falso.ts`). Nada sale.
 *
 * Criterio (LEY §2, foto-whatsapp): JPEG; <= 250 kB (nivel 1) o, como mucho,
 * nivel 2/3 (<= 375 kB). Calidad: cada foto recortada del collage frente a la
 * original a la misma escala, SSIM >= 0,95.
 */
import sharp from 'sharp';
import Jimp from 'jimp';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { arrancarPostgrest } from './_postgrest-falso';
import { instalarFetchFalso, type Subida } from './_almacen-falso';
import { ssim } from './_ssim';

let ok = 0, falla = 0;
function caso(nombre: string, cond: boolean, extra = '') {
  if (cond) ok++; else falla++;
  console.log(`${cond ? 'ok   ' : 'FALLA'} ${nombre}${extra ? `  -> ${extra}` : ''}`);
}
const KB = 1024;
const MUESTRAS = process.env.MUESTRAS ?? '';

(async () => {
  const dir = join(MUESTRAS, 'catalogo-imagenes');
  if (!MUESTRAS || !existsSync(dir)) { console.log('FALLA sin MUESTRAS (catalogo-imagenes/)'); process.exit(1); }
  // Tres fotos de producto reales, JPEG, de 200 kB a 1,2 MB (las normales del catálogo).
  const fotos = readdirSync(dir).filter(n => /\.jpe?g$/i.test(n))
    .map(n => join(dir, n)).filter(p => { const s = statSync(p).size; return s > 200 * KB && s < 1200 * KB; })
    .sort().slice(0, 3).map(p => ({ p, buf: readFileSync(p) }));
  if (fotos.length < 3) { console.log('FALLA hacen falta 3 fotos de catálogo'); process.exit(1); }

  // Servidor local de las fotos (Jimp las lee por HTTP, como en producción).
  const srv = createServer((req, res) => {
    const i = Number((req.url ?? '').replace(/\D/g, ''));
    const f = fotos[i];
    if (!f) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': 'image/jpeg' }); res.end(f.buf);
  });
  await new Promise<void>(r => srv.listen(0, '127.0.0.1', () => r()));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const urlDe = (i: number) => `${base}/foto${i}.jpg`;

  const db = await arrancarPostgrest({ catalogo_imagenes: [], clientes_funnelish: [], conversations: [], messages: [], configuracion: [] });
  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
  process.env.WHATSAPP_ACCESS_TOKEN = 'falso';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '111';
  delete process.env.ANTHROPIC_API_KEY;
  const fuera = instalarFetchFalso(db.url);

  const logs = { log: console.log, warn: console.warn, error: console.error };
  const callar = () => { console.log = () => {}; console.warn = () => {}; console.error = () => {}; };
  const hablar = () => { console.log = logs.log; console.warn = logs.warn; console.error = logs.error; };

  callar();
  const { generarCollagePack } = await import('../lib/collage');
  const { estamparNombreDetallado } = await import('../lib/watermark');
  const { procesarPedidoFunnelish } = await import('../app/api/funnelish/webhook/route');
  const { createServerSupabaseClient } = await import('../lib/supabase');
  const { NextRequest } = await import('next/server');
  hablar();

  /**
   * Cada foto, recortada del collage, frente a SU versión sin pérdida a 900 px de
   * alto. La referencia se hace con Jimp (`resize(AUTO, 900)`, el mismo remuestreo
   * que usa el collage) para medir SOLO la pérdida de la codificación, no la del
   * remuestreo. Es el patrón de medida, no la lógica probada: lo que se prueba
   * (formato, peso, escalón) sale del código real.
   */
  async function calidadCollage(s: Subida, usadas: Buffer[]) {
    // Lienzo de referencia SIN PÉRDIDA (las fotos a 900 px de alto, lado a lado) y
    // SSIM del collage guardado entero frente a él: sin recortes que desalineen.
    const capas: { input: Buffer; left: number; top: number }[] = [];
    let izq = 0;
    for (const u of usadas) {
      const j: any = await Jimp.read(u);
      j.resize(Jimp.AUTO, 900);
      capas.push({ input: await j.getBufferAsync(Jimp.MIME_PNG), left: izq, top: 0 });
      izq += j.getWidth();
    }
    const lienzo = await sharp({ create: { width: izq, height: 900, channels: 3, background: '#ffffff' } }).composite(capas).png().toBuffer();
    return [await ssim(lienzo, s.bytes)];
  }

  async function comprobarCollage(nombre: string, s: Subida | undefined, usadas: Buffer[]) {
    caso(`${nombre}: se guardó en packs/`, !!s && s.ruta.startsWith('packs/'), s?.ruta ?? 'sin subida');
    if (!s) return;
    const m = await sharp(s.bytes).metadata();
    caso(`${nombre}: JPEG (formato real y content-type)`, m.format === 'jpeg' && s.contentType === 'image/jpeg' && s.ruta.endsWith('.jpg'), `${m.format} / ${s.contentType}`);
    caso(`${nombre}: <= 250 kB, o nivel 2/3 (<= 375 kB)`, s.bytes.length <= 375 * KB, `${Math.round(s.bytes.length / KB)} kB${s.bytes.length <= 250 * KB ? ' (nivel 1)' : ' (nivel 2/3)'} ${m.width}x${m.height}`);
    caso(`${nombre}: caché de 1 año`, s.cacheControl === 'max-age=31536000', String(s.cacheControl));
    const q = await calidadCollage(s, usadas);
    caso(`${nombre}: SSIM >= 0,95 frente al collage sin pérdida`, q.every(v => v >= 0.95), q.map(v => v.toFixed(4)).join(' / '));
  }

  try {
    const supabase = createServerSupabaseClient();

    // ── 1 · lib/collage.ts (bot de ventas) con 2 y con 3 fotos ───────────────
    for (const n of [2, 3]) {
      const antes = fuera.subidas.length;
      callar();
      const t0 = Date.now();
      const url = await generarCollagePack(supabase, fotos.slice(0, n).map((_, i) => `BUZO PRUEBA ${i}`), fotos.slice(0, n).map((_, i) => urlDe(i)));
      const ms = Date.now() - t0;
      hablar();
      caso(`lib/collage ${n} fotos: devuelve URL`, typeof url === 'string' && url.includes('/packs/'), `${url} (${ms} ms)`);
      await comprobarCollage(`lib/collage ${n} fotos`, fuera.subidas.slice(antes).find(s => s.ruta.startsWith('packs/')), fotos.slice(0, n).map(f => f.buf));
    }

    // ── 2 · Collage del webhook de Funnelish («Arma tu pack», 2 fotos) ───────
    {
      const antes = fuera.subidas.length;
      const req = new NextRequest('http://localhost/api/funnelish/webhook', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event: 'purchase', id: 'prueba-1', first_name: 'Ana', last_name: 'Prueba', phone: '3001234567',
          address: 'Calle 1', city: 'Garzón', state: 'Huila',
          products: [{ name: 'ARMA TU PACK BUZOS', variant_name: 'HOMBRE - M', amount: 130000 }],
          imagenes: [urlDe(0), urlDe(1)],
        }),
      });
      callar();
      const t0 = Date.now();
      let status = 0;
      try { status = (await procesarPedidoFunnelish(req)).status; } catch { status = -1; }
      const ms = Date.now() - t0;
      hablar();
      caso('funnelish: el pedido se procesa (no revienta)', status === 200, `${status} (${ms} ms)`);
      await comprobarCollage('funnelish 2 fotos', fuera.subidas.slice(antes).find(s => s.ruta.startsWith('packs/pack-')), [fotos[0]!.buf, fotos[1]!.buf]);
      const envioConCollage = fuera.enviosMeta.some(e => JSON.stringify(e.cuerpo ?? '').includes('/packs/pack-'));
      caso('funnelish: la plantilla a WhatsApp lleva el collage', envioConCollage, fuera.enviosMeta.map(e => JSON.stringify(e.cuerpo).slice(0, 160)).join(' | '));
    }

    // ── 3 · Marca de agua (catálogo: la foto que manda el bot) ───────────────
    {
      const antes = fuera.subidas.length;
      callar();
      const r = await estamparNombreDetallado(supabase, urlDe(2), 'Buzo Moto Yamaha Reflectivo Negro', 'prueba-color');
      hablar();
      const s = fuera.subidas.slice(antes).find(x => x.ruta.startsWith('catalogo/marcas/'));
      caso('marca de agua: devuelve URL', !!r.url && !r.error, `${r.url} ${r.error ?? ''}`);
      if (s) {
        const m = await sharp(s.bytes).metadata();
        const mo = await sharp(fotos[2]!.buf).metadata();
        caso('marca de agua: JPEG', m.format === 'jpeg' && s.contentType === 'image/jpeg', `${m.format} / ${s.contentType}`);
        caso('marca de agua: <= 250 kB (o nivel 2/3, <= 375 kB)', s.bytes.length <= 375 * KB, `${Math.round(s.bytes.length / KB)} kB (original ${Math.round(fotos[2]!.buf.length / KB)} kB) ${m.width}x${m.height}`);
        caso('marca de agua: no reduce la foto (mismas dimensiones)', m.width === mo.width && m.height === mo.height, `${m.width}x${m.height} vs ${mo.width}x${mo.height}`);
        // Calidad FUERA de la etiqueta (la mitad inferior): la etiqueta va arriba a la izquierda.
        const h2 = Math.floor(m.height! / 2);
        const abajo = (b: Buffer) => sharp(b).extract({ left: 0, top: h2, width: m.width!, height: m.height! - h2 }).png().toBuffer();
        const q = await ssim(await abajo(fotos[2]!.buf), await abajo(s.bytes));
        caso('marca de agua: SSIM >= 0,95 fuera de la etiqueta', q >= 0.95, q.toFixed(4));
      } else caso('marca de agua: se guardó en catalogo/marcas/', false, 'sin subida');

      // Re-estampar el MISMO color (misma key, mismo nombre) con una FOTO NUEVA, como
      // hace PUT /api/catalogos/colores/[id] cuando se cambia la foto: la ruta y la URL
      // salen iguales y se sobrescriben (upsert). Con caché de 1 año, quien ya tenía la
      // URL (panel, CDN, WhatsApp) puede seguir viendo la foto VIEJA. Antes era 1 hora.
      const antes2 = fuera.subidas.length;
      callar();
      const r2 = await estamparNombreDetallado(supabase, urlDe(0), 'Buzo Moto Yamaha Reflectivo Negro', 'prueba-color');
      hablar();
      const s2 = fuera.subidas.slice(antes2).find(x => x.ruta.startsWith('catalogo/marcas/'));
      const mismaUrl = r2.url === r.url && s2?.ruta === s?.ruta;
      const cacheLarga = s2?.cacheControl === 'max-age=31536000';
      caso('marca de agua: foto nueva del mismo color -> URL nueva o caché corta (si no, se sirve la vieja)', !(mismaUrl && cacheLarga),
        `misma URL: ${mismaUrl} (${s2?.ruta}), ${s2?.cacheControl}, bytes distintos: ${!!s && !!s2 && !s.bytes.equals(s2.bytes)}`);
    }
    // El fetch falso intercepta TODO: lo de fuera no sale, responde 503. Solo se informa.
    if (fuera.externas.length) console.log(`info  llamadas de fuera interceptadas (503, no salieron): ${fuera.externas.join(' | ')}`);
  } finally {
    fuera.desinstalar();
    await db.cerrar();
    srv.close();
  }
  console.log(`\n${ok}/${ok + falla} ok`);
  process.exit(falla ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });

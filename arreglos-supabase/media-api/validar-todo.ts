/**
 * VALIDACIÓN INTEGRAL DEL BUCKET
 *
 * Comprueba de una vez todo lo que el backfill puede haber roto:
 *
 *   1. Archivos sustituidos  — sirven, decodifican, y el respaldo está intacto
 *   2. Embudos               — todas las URL referenciadas cargan
 *   3. WhatsApp / Meta       — ningún archivo en formato que Meta no entregue
 *   4. Etiquetado            — ningún objeto con content-type incorrecto
 *
 * Se puede relanzar cuando se quiera. No modifica nada.
 */
import sharp from 'sharp';
import { supabase, listarRecursivo, urlPublica } from './src/storage.js';

const WA_IMAGE_LIMIT = 5_242_880;
const META_ENTREGA = ['image/jpeg', 'image/png'];

let fallos = 0;
const problemas: string[] = [];
const fallo = (m: string) => { fallos++; problemas.push(m); };

// ── 1. Archivos sustituidos ──────────────────────────────────────────────────
const { data: procesados, error } = await supabase
  .from('media_optimizaciones').select('ruta, bytes_original, bytes_final');
if (error) throw error;

let ahorro = 0;
let okArchivos = 0;
for (const f of procesados) {
  const ruta = f.ruta as string;
  ahorro += Number(f.bytes_original) - Number(f.bytes_final);
  try {
    const r = await fetch(urlPublica(ruta), { cache: 'no-store' } as RequestInit);
    if (!r.ok) { fallo(`[1] HTTP ${r.status} en ${ruta}`); continue; }
    const ct = (r.headers.get('content-type') ?? '').split(';')[0]!;
    const buf = Buffer.from(await r.arrayBuffer());

    if (ct.startsWith('image/')) {
      const m = await sharp(buf).metadata();
      if (!m.width) { fallo(`[1] ${ruta} no decodifica`); continue; }
      if (!META_ENTREGA.includes(ct)) { fallo(`[1] ${ruta} sirve ${ct}, Meta no lo entrega`); continue; }
      if (buf.length > WA_IMAGE_LIMIT) { fallo(`[1] ${ruta} supera el limite de WhatsApp`); continue; }
    }

    const b = await fetch(urlPublica(`_originales/${ruta}`), { method: 'HEAD' } as RequestInit);
    if (!b.ok || Number(b.headers.get('content-length')) !== Number(f.bytes_original)) {
      fallo(`[1] respaldo ausente o distinto para ${ruta}`); continue;
    }
    okArchivos++;
  } catch (e) { fallo(`[1] ${ruta}: ${(e as Error).message}`); }
}
console.log(`1. Archivos sustituidos     ${okArchivos}/${procesados.length} correctos · ahorro ${(ahorro / 1048576).toFixed(1)} MB`);

// ── 2. Embudos ───────────────────────────────────────────────────────────────
const { data: funnels, error: e2 } = await supabase.from('funnels').select('*');
if (e2) throw e2;

const RE = new RegExp('https?://[^"\\\\ ,}\\]]+', 'g');
const refs = new Set<string>();
for (const f of funnels as Record<string, unknown>[]) {
  for (const bruta of JSON.stringify(f).match(RE) ?? []) {
    const url = bruta.replace(/[",\\]+$/, '');
    if (url.includes('/storage/v1/object/public/')) refs.add(url);
  }
}
let okRefs = 0;
for (const url of refs) {
  try {
    const r = await fetch(url, { cache: 'no-store' } as RequestInit);
    if (!r.ok) { fallo(`[2] HTTP ${r.status} en ${url.slice(-55)}`); continue; }
    const ct = (r.headers.get('content-type') ?? '').split(';')[0]!;
    if (ct.startsWith('image/')) {
      const m = await sharp(Buffer.from(await r.arrayBuffer())).metadata();
      if (!m.width) { fallo(`[2] no decodifica ${url.slice(-55)}`); continue; }
    }
    okRefs++;
  } catch (e) { fallo(`[2] ${url.slice(-55)}: ${(e as Error).message}`); }
}
console.log(`2. Referencias de embudos   ${okRefs}/${refs.size} cargan`);

// ── 3 y 4. Formato y etiquetado en todo el bucket ────────────────────────────
const todos = await listarRecursivo('');
const vivos = todos.filter((o) => !o.ruta.startsWith('_originales'));

const webpVivos = vivos.filter((o) => o.contentType === 'image/webp');
// En `entrantes/` y `ventas/` el WebP es media que ENTRA de WhatsApp: es normal
// y no se reenvia. El problema es el WebP en carpetas desde las que SI se envia.
const webpPeligrosos = webpVivos.filter((o) => o.ruta.startsWith('embudos/') || o.ruta.startsWith('plantillas/'));
for (const o of webpPeligrosos) fallo(`[3] WebP en carpeta de envio: ${o.ruta}`);

const malEtiquetados = vivos.filter((o) => !o.contentType || !/^(image|video|audio|application|text\/csv)/.test(o.contentType));
for (const o of malEtiquetados.slice(0, 10)) fallo(`[4] content-type "${o.contentType ?? 'ninguno'}" en ${o.ruta}`);

console.log(`3. WebP en envio            ${webpPeligrosos.length} (${webpVivos.length} en total, el resto es media entrante y no se reenvia)`);
console.log(`4. Objetos mal etiquetados  ${malEtiquetados.length}`);

// ── Resultado ────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(70));
if (fallos === 0) {
  console.log('SIN FALLOS — embudos, WhatsApp/Meta, respaldos y etiquetado, todo correcto');
} else {
  console.log(`${fallos} PROBLEMAS:`);
  problemas.slice(0, 25).forEach((p) => console.log('  · ' + p));
  if (problemas.length > 25) console.log(`  ... y ${problemas.length - 25} mas`);
  process.exit(1);
}

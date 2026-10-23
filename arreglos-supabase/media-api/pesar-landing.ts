/**
 * Pesa una landing de producción: cuánto se descarga hoy frente a cuánto se
 * descargaba antes del backfill.
 *
 * Uso:  npx tsx pesar-landing.ts colombia
 */
import { supabase } from './src/storage.js';

const SLUG = process.argv[2] ?? 'colombia';
const SITIO = process.env.SITIO ?? 'https://pedido.klixmant.shop';
const mb = (n: number) => `${(n / 1048576).toFixed(2)} MB`;

const r = await fetch(`${SITIO}/${SLUG}`, { cache: 'no-store' } as RequestInit);
if (!r.ok) throw new Error(`La landing devolvio ${r.status}`);
const html = await r.text();
const bytesHtml = Buffer.byteLength(html);

const urls = new Set<string>();
for (const m of html.matchAll(/https?:\\?\/\\?\/[^"'\\ ,}\]]+\.(?:jpe?g|png|webp|gif|mp4)/gi)) {
  const u = m[0].replace(/\\\//g, '/');
  if (u.includes('/storage/v1/object/public/')) urls.add(u);
}

const { data: procesados } = await supabase
  .from('media_optimizaciones').select('ruta, bytes_original, bytes_final');
const porRuta = new Map((procesados ?? []).map((p) => [p.ruta as string, p]));

let ahora = 0, antes = 0, convertidas = 0;
for (const u of urls) {
  const resp = await fetch(u, { cache: 'no-store' } as RequestInit);
  const n = Number(resp.headers.get('content-length') ?? 0);
  ahora += n;

  const ruta = decodeURIComponent(u.split('/chat-media/')[1] ?? '');
  const fila = porRuta.get(ruta);
  if (fila) { antes += Number(fila.bytes_original); convertidas++; }
  else       { antes += n; }
}

console.log(`\n  /p/${SLUG}\n`);
console.log(`  HTML de la pagina    : ${mb(bytesHtml)}`);
console.log(`  Archivos de media    : ${urls.size}  (${convertidas} convertidos por nosotros)`);
console.log(`  ${'-'.repeat(46)}`);
console.log(`  Se descargaba ANTES  : ${mb(antes + bytesHtml)}`);
console.log(`  Se descarga AHORA    : ${mb(ahora + bytesHtml)}`);
console.log(`  ${'-'.repeat(46)}`);
console.log(`  Ahorro por visita    : ${mb(antes - ahora)}  (${((antes - ahora) / antes * 100).toFixed(1)}%)\n`);

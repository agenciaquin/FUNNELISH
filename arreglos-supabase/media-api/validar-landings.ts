/**
 * Carga las landing pages REALES de producción y comprueba cada imagen y vídeo
 * que renderizan.
 *
 * Es la prueba de más arriba en la pila: no mira la base de datos ni el bucket,
 * mira lo que un cliente ve al abrir el embudo.
 */
import sharp from 'sharp';
import { supabase } from './src/storage.js';

const SITIO = process.argv[2] ?? 'https://quinchat-agencia-quin.vercel.app';

const { data: funnels, error } = await supabase
  .from('funnels').select('slug, activo').order('slug');
if (error) throw error;

const slugs = (funnels as { slug: string }[]).map((f) => f.slug).filter(Boolean);
console.log(`Sitio: ${SITIO}`);
console.log(`Embudos a cargar: ${slugs.length}\n`);

let paginasOk = 0;
let mediaOk = 0;
const problemas: string[] = [];
const RE_SRC = /(?:src|srcSet|poster|content)=["']([^"']+)["']/g;
const RE_JSON = /https?:\\?\/\\?\/[^"'\\ ,}\]]+\.(?:jpe?g|png|webp|gif|mp4)/gi;

for (const slug of slugs) {
  const url = `${SITIO}/p/${encodeURIComponent(slug)}`;
  let html = '';
  try {
    const r = await fetch(url, { cache: 'no-store' } as RequestInit);
    if (!r.ok) { problemas.push(`PAGINA ${r.status}  ${url}`); continue; }
    html = await r.text();
    paginasOk++;
  } catch (e) {
    problemas.push(`PAGINA fallo  ${url} — ${(e as Error).message}`);
    continue;
  }

  // Recoge las URL de media, vengan de atributos HTML o del JSON embebido de Next.
  const encontradas = new Set<string>();
  for (const m of html.matchAll(RE_SRC)) {
    const u = m[1]!.split(' ')[0]!;
    if (/supabase\.co\/storage|r2\.dev/.test(u)) encontradas.add(u);
  }
  for (const m of html.matchAll(RE_JSON)) {
    const u = m[0].replace(/\\\//g, '/');
    if (/supabase\.co\/storage|r2\.dev/.test(u)) encontradas.add(u);
  }

  let rotasAqui = 0;
  for (const u of encontradas) {
    try {
      const r = await fetch(u, { cache: 'no-store' } as RequestInit);
      if (!r.ok) { problemas.push(`MEDIA ${r.status}  [${slug}]  ${u.slice(-52)}`); rotasAqui++; continue; }
      const ct = (r.headers.get('content-type') ?? '').split(';')[0]!;
      const buf = Buffer.from(await r.arrayBuffer());
      if (ct.startsWith('image/')) {
        const meta = await sharp(buf).metadata();
        if (!meta.width) { problemas.push(`MEDIA no decodifica  [${slug}]  ${u.slice(-52)}`); rotasAqui++; continue; }
      }
      mediaOk++;
    } catch (e) {
      problemas.push(`MEDIA fallo  [${slug}]  ${u.slice(-52)} — ${(e as Error).message}`);
      rotasAqui++;
    }
  }

  const marca = rotasAqui === 0 ? 'OK ' : 'MAL';
  console.log(`  ${marca}  /p/${slug.padEnd(26)} ${String(encontradas.size).padStart(3)} media${rotasAqui ? `  · ${rotasAqui} ROTAS` : ''}`);
}

console.log('\n' + '='.repeat(66));
console.log(`Landings que cargan : ${paginasOk}/${slugs.length}`);
console.log(`Media que carga     : ${mediaOk}`);
console.log(`Problemas           : ${problemas.length}`);
if (problemas.length) {
  console.log('');
  problemas.slice(0, 25).forEach((p) => console.log('  · ' + p));
  if (problemas.length > 25) console.log(`  ... y ${problemas.length - 25} mas`);
  process.exit(1);
}
console.log('\nTODAS LAS LANDINGS RENDERIZAN SU MEDIA CORRECTAMENTE');

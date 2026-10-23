/**
 * PRUEBA INTEGRAL DE LOS EMBUDOS
 *
 * Comprueba TODAS las URL de media que referencian los embudos: que respondan,
 * que decodifiquen, y que estén en un formato que Meta entregue por WhatsApp.
 */
import sharp from 'sharp';
import { supabase } from './src/storage.js';

const META_ENTREGA = ['image/jpeg', 'image/png'];

const { data: funnels, error } = await supabase.from('funnels').select('*');
if (error) throw error;

const RE = new RegExp('https?://[^"\\\\ ,}\\]]+', 'g');

const refs = new Map<string, Set<string>>();
for (const f of funnels as Record<string, unknown>[]) {
  const slug = String(f.slug ?? f.id ?? '?');
  const encontradas = JSON.stringify(f).match(RE) ?? [];
  for (const bruta of encontradas) {
    const url = bruta.replace(/[",\\]+$/, '');
    if (!url.includes('/storage/v1/object/public/')) continue;
    if (!refs.has(url)) refs.set(url, new Set());
    refs.get(url)!.add(slug);
  }
}

console.log(`Embudos: ${funnels.length}   ·   URL de media referenciadas: ${refs.size}\n`);
if (refs.size === 0) {
  console.log('ERROR: no se extrajo ninguna URL. La prueba no vale, revisar la extraccion.');
  process.exit(1);
}

let ok = 0;
const rotas: string[] = [];
const avisos: string[] = [];
const porTipo = new Map<string, number>();

for (const [url, slugs] of refs) {
  const quien = [...slugs].join(', ');
  try {
    const r = await fetch(url, { cache: 'no-store' } as RequestInit);
    if (!r.ok) {
      rotas.push(`HTTP ${r.status}  ${url.slice(-60)}  (${quien})`);
      continue;
    }
    const ct = (r.headers.get('content-type') ?? '').split(';')[0]!;
    porTipo.set(ct, (porTipo.get(ct) ?? 0) + 1);
    const buf = Buffer.from(await r.arrayBuffer());

    if (ct.startsWith('image/')) {
      const m = await sharp(buf).metadata();
      if (!m.width) throw new Error('la imagen no tiene dimensiones');
      if (!META_ENTREGA.includes(ct)) {
        avisos.push(`${ct}  ${url.slice(-60)}  — Meta NO lo entrega por WhatsApp`);
      }
    } else if (!ct.startsWith('video/') && !ct.startsWith('audio/')) {
      avisos.push(`${ct}  ${url.slice(-60)}  — tipo inesperado`);
    }
    ok++;
  } catch (e) {
    rotas.push(`${(e as Error).message}  ${url.slice(-60)}  (${quien})`);
  }
}

console.log('Tipos servidos:');
for (const [ct, n] of [...porTipo].sort((a, b) => b[1] - a[1])) {
  console.log(`   ${String(n).padStart(4)}  ${ct}`);
}

console.log('\n' + '='.repeat(64));
console.log(`Referencias que cargan bien : ${ok} / ${refs.size}`);
console.log(`Referencias ROTAS           : ${rotas.length}`);
console.log(`Avisos de formato           : ${avisos.length}`);

if (rotas.length) {
  console.log('\nROTAS:');
  rotas.slice(0, 25).forEach((r) => console.log('  · ' + r));
  if (rotas.length > 25) console.log(`  ... y ${rotas.length - 25} mas`);
}
if (avisos.length) {
  console.log('\nAVISOS:');
  avisos.slice(0, 15).forEach((a) => console.log('  · ' + a));
  if (avisos.length > 15) console.log(`  ... y ${avisos.length - 15} mas`);
}
if (!rotas.length && !avisos.length) {
  console.log('\nEMBUDOS INTACTOS: ninguna imagen rota, ningun formato que Meta rechace');
}

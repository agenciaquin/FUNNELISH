/**
 * LEY DE PESO · niveles de aceptación con FOTOS REALES del almacenamiento.
 *
 *   MUESTRAS=<carpeta con copias locales del bucket> npx tsx pruebas/peso-niveles-reales.ts
 *
 * Importa el compresor REAL (`lib/optimizar-imagen-servidor.ts`) y los topes REALES
 * (`lib/ley-peso.ts`). No descarga nada: lee copias locales ya bajadas (la carpeta
 * `copias/` del simulacro de limpieza: `catalogo-imagenes/`, `chat-media/`,
 * `plantillas-images/`). No escribe en ningún sitio.
 *
 * Para cada muestra y cada tipo de imagen de la LEY anota nivel, peso, lado y SSIM
 * frente al original (metodología de `medir-topes.ts`, ver `_ssim.ts`). Criterios
 * (LEY-DE-PESO.md §1 punto 4 y §2):
 *   - nunca sale `fallo` (rechazo) con un archivo real;
 *   - niveles 1 y 2: SSIM >= 0,95;
 *   - nivel 4: lado mayor >= 1440 (o el del original, si ya era menor);
 *   - tipos de WhatsApp: solo JPEG o PNG; ningún resultado pesa más que el original
 *     sin necesidad (si el original cabía y era JPEG/PNG, sale intacto).
 * Incluye las fotos de >= 2 000 px (caso del simulacro: 3 264 px, 1600/q75 -> 0,93).
 * Y comprueba que `lib/ley-peso.ts` es idéntico byte a byte en las dos apps.
 */
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { optimizarImagen } from '../lib/optimizar-imagen-servidor.js';
import { LADO_MINIMO_IMAGEN, TIPOS_IMAGEN, topeDe, type TipoArchivo } from '../lib/ley-peso.js';
import { ssim, ssimNativo } from './_ssim.js';

const MUESTRAS = process.env.MUESTRAS ?? '';
const SSIM_MIN = 0.95;
const WA: TipoArchivo[] = ['foto-whatsapp'];

let ok = 0, falla = 0;
const fallos: string[] = [];
function caso(nombre: string, cond: boolean, detalle = '') {
  if (cond) ok++; else { falla++; fallos.push(`${nombre}  ${detalle}`); }
  console.log(`${cond ? 'ok   ' : 'FALLA'} ${nombre}${detalle ? `  ${detalle}` : ''}`);
}
const kb = (n: number) => `${Math.round(n / 1024)}`;

// ── Selección de muestras ─────────────────────────────────────────────────────
interface Grupo { nombre: string; dir: string; tipo: TipoArchivo; n: number; filtro?: (rel: string) => boolean }
const GRUPOS: Grupo[] = [
  { nombre: 'catalogo', dir: 'catalogo-imagenes', tipo: 'foto-web', n: 4 },
  { nombre: 'plantillas', dir: 'plantillas-images', tipo: 'foto-whatsapp', n: 3 },
  { nombre: 'landing', dir: 'chat-media/_originales/embudos', tipo: 'foto-web', n: 4, filtro: r => !r.includes(`${sep}chat${sep}`) },
  { nombre: 'catalogo-orig', dir: 'chat-media/_originales/catalogo', tipo: 'foto-web', n: 2 },
  { nombre: 'marca-agua', dir: 'chat-media/catalogo/marcas', tipo: 'foto-whatsapp', n: 2 },
  { nombre: 'banner-promo', dir: 'chat-media/embudos/promociones', tipo: 'grafico-texto', n: 3 },
  { nombre: 'banner-remkt', dir: 'chat-media/embudos/remarketing', tipo: 'grafico-texto', n: 2 },
  { nombre: 'chat-saliente', dir: 'chat-media', tipo: 'foto-whatsapp', n: 4, filtro: r => /^\d{8,}[\\/][^\\/]+$/.test(r) },
  { nombre: 'chat-embudo', dir: 'chat-media/_originales/embudos/chat', tipo: 'foto-whatsapp', n: 2 },
  { nombre: 'entrante', dir: 'chat-media/entrantes', tipo: 'foto-entrante', n: 4 },
  { nombre: 'ventas', dir: 'chat-media/ventas', tipo: 'foto-whatsapp', n: 3 },
  { nombre: 'pack', dir: 'chat-media/packs', tipo: 'foto-whatsapp', n: 2 },
];

function listar(dir: string): string[] {
  const out: string[] = [];
  const rec = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const s = statSync(p);
      if (s.isDirectory()) rec(p);
      else if (/\.(jpe?g|png|webp)$/i.test(n)) out.push(p);
    }
  };
  if (existsSync(dir)) rec(dir);
  return out;
}

/** Las n-1 más pesadas (distintas) y la mediana: lo difícil y lo normal. */
function elegir(archivos: string[], n: number): string[] {
  const porPeso = new Map<number, string>();
  for (const a of archivos) { const s = statSync(a).size; if (!porPeso.has(s)) porPeso.set(s, a); }
  const orden = [...porPeso.entries()].sort((a, b) => b[0] - a[0]).map(e => e[1]);
  const elegidas = orden.slice(0, Math.max(1, n - 1));
  const mediana = orden[Math.floor(orden.length / 2)];
  if (mediana && !elegidas.includes(mediana)) elegidas.push(mediana);
  return elegidas;
}

const mimeDe = (p: string) => /\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg';

interface Fila { grupo: string; archivo: string; tipo: TipoArchivo; natural: boolean; kbOrig: number; dimsOrig: string; nivel: number; kbFin: number; lado: number; formato: string; escalon: string; ssim: number; nativo: number }
const filas: Fila[] = [];

async function medir(grupo: string, ruta: string, tipo: TipoArchivo, natural: boolean) {
  const original = readFileSync(ruta);
  const mime = mimeDe(ruta);
  const mo = await sharp(original).metadata();
  const ladoOrig = Math.max(mo.width ?? 0, mo.height ?? 0);
  const t0 = Date.now();
  const r = await optimizarImagen(original, mime, tipo);
  const ms = Date.now() - t0;
  const mr = await sharp(r.buffer).metadata();
  const lado = Math.max(mr.width ?? 0, mr.height ?? 0);
  const s = r.buffer === original ? 1 : await ssim(original, r.buffer);
  const sn = r.buffer === original ? 1 : await ssimNativo(original, r.buffer);
  const nombre = `${grupo}/${ruta.split(/[\\/]/).pop()!.slice(0, 22)} [${tipo}]`;
  filas.push({ grupo, archivo: relative(MUESTRAS, ruta), tipo, natural, kbOrig: original.length / 1024, dimsOrig: `${mo.width}x${mo.height}`,
    nivel: r.nivel, kbFin: r.buffer.length / 1024, lado, formato: String(mr.format), escalon: r.escalon ?? (r.optimizada ? '?' : 'original'), ssim: s, nativo: sn });

  const det = `n${r.nivel} ${kb(original.length)}->${kb(r.buffer.length)} kB ${lado}px ${r.escalon ?? 'original'} ssim=${s.toFixed(4)} (nativo ${sn.toFixed(4)}) ${ms}ms`;
  caso(`${nombre} no se rechaza`, !r.fallo, det);
  if (r.nivel <= 2) caso(`${nombre} nivel ${r.nivel}: SSIM >= 0,95`, s >= SSIM_MIN, det);
  if (r.nivel === 4) caso(`${nombre} nivel 4: lado >= 1440`, lado >= Math.min(LADO_MINIMO_IMAGEN, ladoOrig), det);
  if (r.nivel === 1) caso(`${nombre} nivel 1: pesa <= tope`, r.buffer.length <= topeDe(tipo), det);
  if (WA.includes(tipo)) caso(`${nombre} WhatsApp: JPEG o PNG`, r.contentType === 'image/jpeg' || r.contentType === 'image/png', r.contentType);
  caso(`${nombre} contentType = formato real`, (r.contentType === 'image/jpeg' && mr.format === 'jpeg') || (r.contentType === 'image/png' && mr.format === 'png') || (r.contentType === 'image/webp' && mr.format === 'webp'), `${r.contentType} vs ${mr.format}`);
  if ((mime === 'image/jpeg' || mime === 'image/png') && original.length <= topeDe(tipo)) {
    caso(`${nombre} ya cabía: sale intacto`, r.buffer === original && !r.optimizada);
  }
}

(async () => {
  // ── lib/ley-peso.ts idéntico en las dos apps ─────────────────────────────────
  {
    const a = readFileSync(join(__dirname, '..', 'lib', 'ley-peso.ts'));
    const pathB = join(__dirname, '..', '..', 'quin-comercial', 'lib', 'ley-peso.ts');
    const b = existsSync(pathB) ? readFileSync(pathB) : null;
    const h = (x: Buffer) => createHash('sha256').update(x).digest('hex').slice(0, 16);
    caso('lib/ley-peso.ts idéntico byte a byte en quinchat y quin-comercial', !!b && a.equals(b), b ? `${h(a)} / ${h(b)} (${a.length} / ${b.length} B)` : 'falta quin-comercial/lib/ley-peso.ts');
  }

  if (!MUESTRAS || !existsSync(MUESTRAS)) {
    console.log('FALLA sin muestras: define MUESTRAS=<carpeta con catalogo-imagenes/, chat-media/, plantillas-images/>');
    process.exit(1);
  }

  // ── Muestras por grupo, con su tipo natural y con TODOS los tipos de imagen ──
  const elegidas: { grupo: string; ruta: string; tipo: TipoArchivo }[] = [];
  for (const g of GRUPOS) {
    const raiz = join(MUESTRAS, g.dir);
    const todos = listar(raiz).filter(p => !g.filtro || g.filtro(relative(raiz, p)));
    for (const r of elegir(todos, g.n)) elegidas.push({ grupo: g.nombre, ruta: r, tipo: g.tipo });
  }
  // Fotos grandes (>= 2 000 px de lado mayor): el caso que el simulacro de limpieza vio caer a 0,93.
  {
    const vistos = new Set(elegidas.map(e => e.ruta));
    const porPeso = new Set<number>();
    for (const p of listar(MUESTRAS)) {
      const s = statSync(p).size;
      if (s < 900 * 1024 || porPeso.has(s)) continue;
      const m = await sharp(p).metadata();
      if (Math.max(m.width ?? 0, m.height ?? 0) < 3000) continue;
      porPeso.add(s);
      if (!vistos.has(p)) elegidas.push({ grupo: 'grande>=3000', ruta: p, tipo: 'foto-web' });
    }
  }

  console.log(`\nMuestras: ${elegidas.length} archivos reales de ${MUESTRAS}\n`);
  for (const e of elegidas) {
    await medir(e.grupo, e.ruta, e.tipo, true);
    for (const t of TIPOS_IMAGEN) if (t !== e.tipo) await medir(e.grupo, e.ruta, t, false);
  }

  // ── Tabla resumen (tipo natural) ─────────────────────────────────────────────
  console.log('\nTabla (tipo natural de cada muestra):');
  console.log(`${'grupo'.padEnd(14)} ${'archivo'.padEnd(24)} ${'tipo'.padEnd(14)} ${'orig kB'.padStart(8)} ${'dims'.padStart(10)}  nv ${'fin kB'.padStart(7)} ${'lado'.padStart(5)} ${'fmt'.padEnd(5)} ${'escalón'.padEnd(14)} SSIM    nativo`);
  for (const f of filas.filter(x => x.natural)) {
    console.log(`${f.grupo.padEnd(14)} ${f.archivo.split(/[\\/]/).pop()!.slice(0, 24).padEnd(24)} ${f.tipo.padEnd(14)} ${f.kbOrig.toFixed(0).padStart(8)} ${f.dimsOrig.padStart(10)}  ${String(f.nivel).padStart(2)} ${f.kbFin.toFixed(0).padStart(7)} ${String(f.lado).padStart(5)} ${f.formato.padEnd(5)} ${f.escalon.padEnd(14)} ${f.ssim.toFixed(4)}  ${f.nativo.toFixed(4)}`);
  }
  const resumen = (xs: Fila[]) => {
    const por = [1, 2, 3, 4].map(n => xs.filter(x => x.nivel === n).length);
    const bajo = xs.filter(x => x.nivel <= 2 && x.ssim < SSIM_MIN).length;
    return `n1=${por[0]} n2=${por[1]} n3=${por[2]} n4=${por[3]} · SSIM<0,95 en n1/n2: ${bajo} · SSIM mín ${Math.min(...xs.map(x => x.ssim)).toFixed(4)}`;
  };
  console.log(`\nResumen tipo natural (${filas.filter(x => x.natural).length}): ${resumen(filas.filter(x => x.natural))}`);
  console.log(`Resumen todos los tipos (${filas.length}): ${resumen(filas)}`);
  for (const t of TIPOS_IMAGEN) console.log(`  ${t.padEnd(14)} ${resumen(filas.filter(x => x.tipo === t))}`);
  const grandes = filas.filter(x => x.grupo === 'grande>=3000' || Number(x.dimsOrig.split('x').map(Number).reduce((a, b) => Math.max(a, b))) >= 3000);
  if (grandes.length) console.log(`  >=3000 px     ${resumen(grandes)}`);

  if (fallos.length) { console.log('\nFallos:'); for (const f of fallos) console.log('  ' + f); }
  console.log(`\n${ok}/${ok + falla} ok`);
  process.exit(falla ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });

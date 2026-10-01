/**
 * MEDICION — ¿se cumplen los topes de `LEY-DE-PESO.md` sin perder calidad?
 *
 * Descarga una muestra real del bucket público `chat-media` y, para cada archivo:
 *
 *   IMÁGENES  · lo que hace HOY el compresor real (`optimizarImagen`, importado,
 *               no copiado) y los escalones de la LEY: 1920/q85 → q80 → 1600 →
 *               1440 → 1280, más 1080/q80 como suelo. Anota el primer escalón que
 *               queda bajo el tope y su SSIM. En los PNG mira si la transparencia
 *               es real. WebP y AVIF solo como referencia (WhatsApp no los acepta).
 *   VÍDEOS    · H.264 720p a CRF 26, 28 y 30 con `faststart`, y CRF 28 sin audio.
 *               Peso, bitrate, SSIM y VMAF (si el ffmpeg los trae) y el tiempo.
 *
 * Solo mide. **No escribe nada en Storage ni en la base**: descarga por la URL
 * pública y trabaja en memoria y en una carpeta temporal que borra al acabar.
 *
 * La calidad es SSIM en escala de grises a 1290 px de lado mayor —un móvil de
 * gama media—, igual que `arreglos-supabase/media-api/comparar-perfiles.ts`, para
 * que las cifras se puedan comparar con `HALLAZGO-dos-compresores.md`.
 *
 * ffmpeg NO es dependencia de quinchat (y no debe serlo: no existe en Vercel).
 * Se busca en este orden: variable `FFMPEG_PATH`, paquete `ffmpeg-static` si se
 * puede resolver, `ffmpeg` del PATH. Si no hay ninguno, se saltan los vídeos y se
 * avisa.
 *
 *   cd quinchat
 *   FFMPEG_PATH=<ruta a ffmpeg> npx tsx pruebas/medir-topes.ts [--sin-video] [--json salida.json] [--rutas a,b]
 *
 * OJO: lo que mide esto en Windows dice cuánto comprime, no que funcione en
 * Vercel (observación 1 de `CLAUDE.md`).
 */
import sharp from 'sharp';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { optimizarImagen } from '../lib/optimizar-imagen-servidor.js';

const BASE = 'https://bjbjqmbuzpyjvcugbusx.supabase.co/storage/v1/object/public/chat-media/';

/** Muestra del 30-09-2026: 26 archivos repartidos por zona y tamaño. */
const MUESTRA: [grupo: string, ruta: string][] = [
  ['catalogo', 'catalogo/marcas/29c250c7-96e8-43d9-9695-2e3a6f9b8773-s2-vpflx3.jpg'],
  ['catalogo', 'catalogo/marcas/8396c06a-bff0-4efc-9354-7a39a215384d-9y5df6.jpg'],
  ['catalogo', 'catalogo/marcas/3fb9d1f2-6924-473e-9ba2-a1ffc6d95cc8-3m65nw.jpg'],
  ['catalogo', 'catalogo/marcas/c9435b61-4c30-4639-a3ef-fb2c00a328dd-178-s2-4ajrys.jpg'],
  ['chat-saliente', '573023691095/1785005142578-wx3qb.jpg'],
  ['chat-saliente', '573208520903/1785252781103-wn5j9.png'],
  ['chat-saliente', '573159477832/1787800146371-mjmlu.png'],
  ['chat-saliente', '573108591948/1786194897276-o5x62.png'],
  ['chat-saliente', '573144523012/1785690177048-vopjj.png'],
  ['chat-saliente', '573117366376/1784566991484-mjzh6.mp4'],
  ['embudos', 'embudos/polo-textura-promo/1787931042558-dcoko.jpg'],
  ['embudos', 'embudos/spiderman/1785511733342-2a6ej.jpg'],
  ['embudos', 'embudos/f1-escuderia-ftk/1787971824734-5h0z2.jpg'],
  ['embudos', 'embudos/promociones/1790026879262-iebwh.png'],
  ['embudos', 'embudos/remarketing/1790262202576-5orgx.png'],
  ['entrantes', 'entrantes/573183701784/1785269172390-24mxx.jpg'],
  ['entrantes', 'entrantes/573104562563/1785624744770-0dato.webp'],
  ['entrantes', 'entrantes/573206034180/1788041532540-w0qfi.mp4'],
  ['packs', 'packs/pack-ghmvix__v3.jpg'],
  ['packs', 'packs/PACK-X2-BUZO-MOTO-YAMAHA-REFLECTIVO-1__PACK-X2-BUZO-MOTO-YAMAHA-REFLECTIVO-2__v2.jpg'],
  ['packs', 'packs/pack-1q9kx9__v3.jpg'],
  ['ventas', 'ventas/573134464098/1785849525100-4mk60.jpg'],
  ['ventas', 'ventas/573108818763/1785087060098-2x76m.jpg'],
  ['ventas', 'ventas/573126132557/1786410359313-sk9j7.webp'],
  ['ventas', 'ventas/573125555476/1786883665738-xxxvb.mp4'],
  ['ventas', 'ventas/573058177409/1784933440186-4s6j2.mp4'],
];

/** Topes propuestos en `LEY-DE-PESO.md` (kB = 1024 bytes). */
const TOPE_FOTO = 250 * 1024;
const TOPE_FOTO_ENTRANTE = 400 * 1024;
const TOPE_VIDEO_LANDING = 4 * 1024 * 1024;
const TOPE_VIDEO_CHAT = 10 * 1024 * 1024;
const SSIM_MINIMO = 0.95;
const PANTALLA = 1290;

/** Escalones de la LEY, en orden. El último es el suelo de 1080 px. */
const ESCALONES = [
  { nombre: '1920/q85', lado: 1920, calidad: 85 },
  { nombre: '1920/q80', lado: 1920, calidad: 80 },
  { nombre: '1600/q80', lado: 1600, calidad: 80 },
  { nombre: '1440/q80', lado: 1440, calidad: 80 },
  { nombre: '1280/q80', lado: 1280, calidad: 80 },
  { nombre: '1080/q80', lado: 1080, calidad: 80 },
];

const args = process.argv.slice(2);
const SIN_VIDEO = args.includes('--sin-video');
const iJson = args.indexOf('--json');
const SALIDA_JSON = iJson >= 0 ? args[iJson + 1] : undefined;
// `--rutas a,b,c` mide esas rutas del bucket EN LUGAR de la muestra fija (p. ej. los vídeos de landing).
const iRutas = args.indexOf('--rutas');
const RUTAS: [string, string][] | null = iRutas >= 0
  ? (args[iRutas + 1] ?? '').split(',').filter(Boolean).map((r) => [r.split('/')[0]!, r] as [string, string])
  : null;

const kb = (n: number) => `${Math.round(n / 1024)} kB`;
const f4 = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(4));

// ---------------------------------------------------------------- SSIM (imagen)

/** Escala de grises en crudo. La referencia fija las dimensiones; el resto se lleva a ESAS con `fill`. */
async function aPantalla(buf: Buffer, destino?: { w: number; h: number }) {
  const redim = destino
    ? { width: destino.w, height: destino.h, fit: 'fill' as const }
    : { width: PANTALLA, height: PANTALLA, fit: 'inside' as const };
  // `flatten` sobre blanco: así un PNG transparente y su JPEG se comparan igual que se verían en pantalla.
  const { data, info } = await sharp(buf, { failOn: 'none' })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(redim)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { datos: data, w: info.width, h: info.height };
}

/** SSIM global sobre ventanas de 8x8 (Wang et al. 2004), idéntico a `comparar-perfiles.ts`. */
function ssim(a: Buffer, b: Buffer, w: number, h: number): number {
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  const V = 8;
  let suma = 0;
  let bloques = 0;
  for (let by = 0; by + V <= h; by += V) {
    for (let bx = 0; bx + V <= w; bx += V) {
      let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (let y = 0; y < V; y++) {
        for (let x = 0; x < V; x++) {
          const i = (by + y) * w + bx + x;
          const va = a[i]!, vb = b[i]!;
          sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb;
        }
      }
      const n = V * V;
      const ma = sa / n, mb = sb / n;
      const va = saa / n - ma * ma, vb = sbb / n - mb * mb, cov = sab / n - ma * mb;
      suma += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      bloques++;
    }
  }
  return bloques ? suma / bloques : 1;
}

// ---------------------------------------------------------------- imágenes

interface Variante { nombre: string; bytes: number; ssim: number; lado: number }
interface FilaImagen {
  grupo: string; ruta: string; mime: string; bytes: number; ancho: number; alto: number;
  alfa: 'no' | 'canal opaco' | 'real';
  hoy: { bytes: number; mime: string; ssim: number };
  escalones: Variante[];
  /** Primer escalón que queda bajo el tope de su tipo (o null si ninguno). */
  escalon: Variante | null;
  tope: number;
  cumpleSinTocar: boolean;
  webp: Variante; avif: Variante;
  pngConAlfa?: { bytes: number; ssim: number };
}

function base(buf: Buffer) {
  return sharp(buf, { failOn: 'none' }).rotate();
}

async function medirImagen(grupo: string, ruta: string, buf: Buffer, mime: string): Promise<FilaImagen> {
  const meta = await sharp(buf, { failOn: 'none' }).metadata();
  const opaca = meta.hasAlpha ? (await sharp(buf, { failOn: 'none' }).stats()).isOpaque : true;
  const alfa: FilaImagen['alfa'] = !meta.hasAlpha ? 'no' : opaca ? 'canal opaco' : 'real';
  const ref = await aPantalla(buf);
  const calidadDe = async (b: Buffer) => { const v = await aPantalla(b, { w: ref.w, h: ref.h }); return ssim(ref.datos, v.datos, ref.w, ref.h); };

  // Lo que hace el compresor real hoy (puede devolver el original si no compensa).
  const hoyR = await optimizarImagen(buf, mime);
  const hoy = { bytes: hoyR.buffer.length, mime: hoyR.contentType, ssim: hoyR.optimizada ? await calidadDe(hoyR.buffer) : 1 };

  const escalones: Variante[] = [];
  for (const e of ESCALONES) {
    const b = await base(buf)
      .flatten({ background: '#ffffff' })
      .resize({ width: e.lado, height: e.lado, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: e.calidad, mozjpeg: true })
      .toBuffer();
    escalones.push({ nombre: e.nombre, bytes: b.length, ssim: await calidadDe(b), lado: e.lado });
  }

  const tope = grupo === 'entrantes' ? TOPE_FOTO_ENTRANTE : TOPE_FOTO;
  const escalon = escalones.find((v) => v.bytes <= tope) ?? null;

  const rWebp = await base(buf).resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const rAvif = await base(buf).resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).avif({ quality: 50 }).toBuffer();

  const fila: FilaImagen = {
    grupo, ruta, mime, bytes: buf.length, ancho: meta.width ?? 0, alto: meta.height ?? 0, alfa, hoy,
    escalones, escalon, tope, cumpleSinTocar: buf.length <= tope,
    webp: { nombre: 'webp q80', bytes: rWebp.length, ssim: await calidadDe(rWebp), lado: 1920 },
    avif: { nombre: 'avif q50', bytes: rAvif.length, ssim: await calidadDe(rAvif), lado: 1920 },
  };

  // Transparencia real: la LEY obliga a seguir en PNG. Se mide la vía con paleta a 1920 px.
  if (alfa === 'real') {
    const p = await base(buf).resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
    fila.pngConAlfa = { bytes: p.length, ssim: await calidadDe(p) };
  }
  return fila;
}

// ---------------------------------------------------------------- vídeo

function buscarFfmpeg(): string | null {
  const candidatos: string[] = [];
  if (process.env.FFMPEG_PATH) candidatos.push(process.env.FFMPEG_PATH);
  try {
    const req = createRequire(import.meta.url);
    const p = req('ffmpeg-static') as unknown;
    if (typeof p === 'string') candidatos.push(p);
  } catch { /* no instalado en quinchat, y está bien que no lo esté */ }
  candidatos.push('ffmpeg');
  for (const c of candidatos) {
    const r = spawnSync(c, ['-version'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  return null;
}

function ffmpeg(bin: string, argumentos: string[]): Promise<string> {
  return new Promise((ok, mal) => {
    const p = spawn(bin, ['-hide_banner', ...argumentos]);
    let err = '';
    p.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    p.on('error', mal);
    p.on('close', (code: number) => (code === 0 ? ok(err) : mal(new Error(`ffmpeg ${code}: ${err.slice(-400)}`))));
  });
}

interface InfoVideo { duracion: number; ancho: number; alto: number; kbps: number; audio: boolean; fps: number }

async function infoVideo(bin: string, archivo: string): Promise<InfoVideo> {
  // Sin ffprobe: `ffmpeg -i` sale con error pero imprime la cabecera.
  const r = spawnSync(bin, ['-hide_banner', '-i', archivo], { encoding: 'utf8' });
  const t = r.stderr ?? '';
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(t);
  const duracion = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0;
  const v = /Stream #[^\n]*Video:[^\n]*?, (\d{2,5})x(\d{2,5})/.exec(t);
  const fps = /([\d.]+) fps/.exec(t);
  const br = /bitrate: (\d+) kb\/s/.exec(t);
  // La rotación del móvil (displaymatrix ±90) intercambia ancho y alto al mostrarlo.
  const rota = /rotation of -?90/.test(t);
  let ancho = v ? Number(v[1]) : 0, alto = v ? Number(v[2]) : 0;
  if (rota) [ancho, alto] = [alto, ancho];
  return { duracion, ancho, alto, kbps: br ? Number(br[1]) : 0, audio: /Stream #[^\n]*Audio:/.test(t), fps: fps ? Number(fps[1]) : 0 };
}

interface VarianteVideo { nombre: string; bytes: number; kbps: number; ancho: number; alto: number; ssim: number | null; vmaf: number | null; segundos: number }
interface FilaVideo { grupo: string; ruta: string; bytes: number; info: InfoVideo; variantes: VarianteVideo[] }

async function calidadVideo(bin: string, codificado: string, original: string, w: number, h: number, conVmaf: boolean) {
  // El original se lleva a las dimensiones del codificado: se mide lo que añade la compresión a 720p.
  const s = await ffmpeg(bin, ['-i', codificado, '-i', original, '-lavfi',
    `[1:v]scale=${w}:${h}:flags=bicubic,setsar=1[ref];[0:v]setsar=1[enc];[enc][ref]ssim`, '-f', 'null', '-']);
  const m = /SSIM Y:([\d.]+)/.exec(s);
  let vmaf: number | null = null;
  if (conVmaf) {
    try {
      const v = await ffmpeg(bin, ['-i', codificado, '-i', original, '-lavfi',
        `[1:v]scale=${w}:${h}:flags=bicubic,setsar=1[ref];[0:v]setsar=1[enc];[enc][ref]libvmaf=n_threads=4`, '-f', 'null', '-']);
      const mv = /VMAF score: ([\d.]+)/.exec(v);
      vmaf = mv ? Number(mv[1]) : null;
    } catch { vmaf = null; }
  }
  return { ssim: m ? Number(m[1]) : null, vmaf };
}

async function medirVideo(bin: string, conVmaf: boolean, grupo: string, ruta: string, buf: Buffer): Promise<FilaVideo> {
  const carpeta = await mkdtemp(join(tmpdir(), 'medir-topes-'));
  try {
    const orig = join(carpeta, 'original.mp4');
    await writeFile(orig, buf);
    const info = await infoVideo(bin, orig);
    // 720p = lado CORTO 720, sin agrandar. Casi todo es vertical de móvil.
    const escala = "scale='if(gte(iw,ih),-2,min(720,iw))':'if(gte(iw,ih),min(720,ih),-2)'";
    const variantes: VarianteVideo[] = [];
    const planes = [
      { nombre: 'CRF 26', crf: 26, audio: true },
      { nombre: 'CRF 28', crf: 28, audio: true },
      { nombre: 'CRF 30', crf: 30, audio: true },
      { nombre: 'CRF 28 sin audio', crf: 28, audio: false },
    ];
    for (const p of planes) {
      const sal = join(carpeta, `${p.crf}-${p.audio ? 'a' : 'na'}.mp4`);
      const t0 = Date.now();
      await ffmpeg(bin, ['-i', orig, '-vf', escala, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(p.crf),
        '-profile:v', 'main', '-pix_fmt', 'yuv420p',
        ...(p.audio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']),
        '-movflags', '+faststart', '-y', sal]);
      const segundos = (Date.now() - t0) / 1000;
      const i2 = await infoVideo(bin, sal);
      const bytes = (await stat(sal)).size;
      // La calidad no cambia por quitar el audio: no se repite la medida.
      const q = p.audio ? await calidadVideo(bin, sal, orig, i2.ancho, i2.alto, conVmaf) : { ssim: null, vmaf: null };
      variantes.push({ nombre: p.nombre, bytes, kbps: i2.kbps, ancho: i2.ancho, alto: i2.alto, ssim: q.ssim, vmaf: q.vmaf, segundos });
    }
    return { grupo, ruta, bytes: buf.length, info, variantes };
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- main

async function main() {
  const bin = SIN_VIDEO ? null : buscarFfmpeg();
  if (!SIN_VIDEO && !bin) console.log('  AVISO: no hay ffmpeg (FFMPEG_PATH, ffmpeg-static o PATH). Se saltan los vídeos.\n');
  const conVmaf = !!bin && /libvmaf/.test(spawnSync(bin, ['-hide_banner', '-filters'], { encoding: 'utf8' }).stdout ?? '');

  const imagenes: FilaImagen[] = [];
  const videos: FilaVideo[] = [];
  for (const [grupo, ruta] of RUTAS ?? MUESTRA) {
    const r = await fetch(BASE + ruta);
    if (!r.ok) { console.log(`  -- ${ruta} ${r.status}`); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = r.headers.get('content-type') ?? '';
    if (mime.startsWith('image/')) {
      imagenes.push(await medirImagen(grupo, ruta, buf, mime));
      process.stdout.write(`\r  imágenes: ${imagenes.length}   `);
    } else if (mime.startsWith('video/') && bin) {
      process.stdout.write(`\r  vídeo ${ruta} ...   `);
      videos.push(await medirVideo(bin, conVmaf, grupo, ruta, buf));
    }
  }
  process.stdout.write('\r' + ' '.repeat(70) + '\r');

  console.log(`\n  IMÁGENES (${imagenes.length}) · SSIM a ${PANTALLA} px · tope 250 kB (entrantes 400 kB)\n`);
  console.log(`  ${'archivo'.padEnd(26)} ${'orig'.padStart(8)} ${'dims'.padStart(10)} ${'alfa'.padStart(11)} ${'hoy'.padStart(8)} ${'escalón'.padStart(9)} ${'final'.padStart(8)} ${'SSIM'.padStart(7)}  cumple`);
  for (const f of imagenes) {
    const e = f.escalon;
    const cumple = f.cumpleSinTocar ? 'ya cabía' : e && e.ssim >= SSIM_MINIMO ? 'sí' : e ? 'SSIM<0,95' : 'NO CABE';
    console.log(`  ${(f.grupo + ' ' + f.ruta.split('/').pop()!.slice(0, 14)).padEnd(26)} ${kb(f.bytes).padStart(8)} ${`${f.ancho}x${f.alto}`.padStart(10)} ${f.alfa.padStart(11)} ${kb(f.hoy.bytes).padStart(8)} ${(e?.nombre ?? '—').padStart(9)} ${(e ? kb(e.bytes) : '—').padStart(8)} ${f4(e?.ssim).padStart(7)}  ${cumple}`);
  }
  console.log(`\n  Escalones completos (kB / SSIM), WebP y AVIF de referencia:`);
  for (const f of imagenes) {
    console.log(`  ${f.ruta.split('/').pop()!.slice(0, 22).padEnd(22)} ` + f.escalones.map((v) => `${Math.round(v.bytes / 1024)}/${v.ssim.toFixed(3)}`).join('  ') +
      `  | webp ${Math.round(f.webp.bytes / 1024)}/${f.webp.ssim.toFixed(3)} avif ${Math.round(f.avif.bytes / 1024)}/${f.avif.ssim.toFixed(3)}` +
      (f.pngConAlfa ? `  | png paleta ${Math.round(f.pngConAlfa.bytes / 1024)}/${f.pngConAlfa.ssim.toFixed(3)}` : ''));
  }

  if (videos.length) {
    console.log(`\n  VÍDEOS (${videos.length}) · H.264 720p, preset medium, faststart${conVmaf ? ' · VMAF disponible' : ''}\n`);
    for (const v of videos) {
      console.log(`  ${v.ruta}  ${kb(v.bytes)}  ${v.info.ancho}x${v.info.alto}  ${v.info.duracion.toFixed(1)} s  ${v.info.kbps} kb/s  ${v.info.fps} fps  audio:${v.info.audio ? 'sí' : 'no'}`);
      for (const x of v.variantes) {
        console.log(`     ${x.nombre.padEnd(18)} ${kb(x.bytes).padStart(9)}  ${String(x.kbps).padStart(5)} kb/s  ${x.ancho}x${x.alto}  SSIM ${f4(x.ssim)}  VMAF ${x.vmaf == null ? '—' : x.vmaf.toFixed(1)}  ${x.segundos.toFixed(1)} s`);
      }
    }
  }

  if (SALIDA_JSON) {
    writeFileSync(SALIDA_JSON, JSON.stringify({ fecha: new Date().toISOString(), imagenes, videos, topes: { TOPE_FOTO, TOPE_FOTO_ENTRANTE, TOPE_VIDEO_LANDING, TOPE_VIDEO_CHAT } }, null, 2));
    console.log(`\n  JSON en ${SALIDA_JSON}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

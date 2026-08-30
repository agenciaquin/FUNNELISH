/**
 * PRUEBAS DEL COMPRESOR DE SUBIDA
 *
 * Ejercita `quinchat/lib/optimizar-imagen-servidor.ts` —el de verdad, importado,
 * no una copia— con un caso por cada rama de decisión que tiene el código.
 *
 * Se importa el módulo real a propósito. Ya se cometió el error, en esta misma
 * jornada, de escribir una prueba que replicaba la lógica en vez de invocarla:
 * pasaba en verde mientras el código real hacía otra cosa.
 *
 *   cd quinchat && npx tsx pruebas/optimizar-imagen.ts
 */
import sharp from 'sharp';
import { optimizarImagen } from '../lib/optimizar-imagen-servidor.js';

let pasadas = 0;
let fallidas = 0;

function comprobar(caso: string, condicion: boolean, detalle: string) {
  if (condicion) { pasadas++; console.log(`  ok    ${caso.padEnd(38)} ${detalle}`); }
  else { fallidas++; console.log(`  FALLA ${caso.padEnd(38)} ${detalle}`); }
}

const kb = (n: number) => `${Math.round(n / 1024)} kB`;

/** Imagen con ruido: no se comprime sola, así que los tamaños son realistas. */
function ruido(w: number, h: number, alfa: boolean): Buffer {
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    px[i] = (x * 7 + y * 3) % 256;
    px[i + 1] = (x * 3 + y * 11) % 256;
    px[i + 2] = (x * 13 + y * 5) % 256;
    px[i + 3] = alfa ? Math.max(0, Math.min(255, Math.round(255 * (1 - Math.hypot(x - w / 2, y - h / 2) / (w / 2))))) : 255;
  }
  return px;
}
const desdeRaw = (w: number, h: number, alfa: boolean) =>
  sharp(ruido(w, h, alfa), { raw: { width: w, height: h, channels: 4 } });

async function main() {
  console.log('\n  PRUEBAS DEL COMPRESOR DE SUBIDA\n');
  console.log(`  ${'-'.repeat(78)}`);

  // 1 · JPEG grande -> se comprime y sigue siendo JPEG
  {
    const src = await desdeRaw(3000, 3000, false).jpeg({ quality: 100 }).toBuffer();
    const r = await optimizarImagen(src, 'image/jpeg');
    const m = await sharp(r.buffer).metadata();
    comprobar('jpeg grande se comprime', r.optimizada && r.contentType === 'image/jpeg' && r.buffer.length < src.length,
      `${kb(src.length)} -> ${kb(r.buffer.length)}`);
    comprobar('jpeg grande se redimensiona a 1920', Math.max(m.width!, m.height!) === 1920,
      `${m.width}x${m.height}`);
  }

  // 2 · JPEG pequeño -> intacto. Recomprimir algo ligero solo quita calidad.
  {
    const src = await desdeRaw(300, 300, false).jpeg({ quality: 80 }).toBuffer();
    const r = await optimizarImagen(src, 'image/jpeg');
    comprobar('jpeg pequeño se deja intacto', !r.optimizada && r.buffer === src, kb(src.length));
  }

  // 3 · PNG opaco -> sale JPEG. Aquí está el grueso del ahorro.
  //
  // El caso importante es el de abajo: un PNG exportado por una herramienta de
  // diseño lleva canal alfa aunque no lo use. Si se mira solo `hasAlpha` se va
  // por la vía PNG y se pierde el ahorro — y son la mayoría de las fotos que
  // están pesando de más en el bucket.
  {
    const conCanal = await desdeRaw(2400, 2400, false).png().toBuffer();  // 4 canales, alfa a 255
    const m0 = await sharp(conCanal).metadata();
    comprobar('el png de prueba SI trae canal alfa', m0.hasAlpha === true, `hasAlpha=${m0.hasAlpha}`);

    const r = await optimizarImagen(conCanal, 'image/png');
    comprobar('png con alfa opaco pasa a jpeg', r.optimizada && r.contentType === 'image/jpeg' && r.ext === 'jpg',
      `${kb(conCanal.length)} -> ${r.contentType} ${kb(r.buffer.length)}`);

    const sinCanal = await desdeRaw(2400, 2400, false).removeAlpha().png().toBuffer();
    const r2 = await optimizarImagen(sinCanal, 'image/png');
    comprobar('png sin canal alfa pasa a jpeg', r2.optimizada && r2.contentType === 'image/jpeg',
      `${kb(sinCanal.length)} -> ${kb(r2.buffer.length)}`);
  }

  // 4 · PNG con alfa -> sigue siendo PNG y conserva la transparencia.
  {
    const src = await desdeRaw(2000, 2000, true).png().toBuffer();
    const r = await optimizarImagen(src, 'image/png');
    const m = await sharp(r.buffer).metadata();
    comprobar('png con alfa sigue png', r.contentType === 'image/png', `${kb(src.length)} -> ${kb(r.buffer.length)}`);
    comprobar('png con alfa conserva transparencia', m.hasAlpha === true, `hasAlpha=${m.hasAlpha}`);
  }

  // 5 · WebP pequeño -> se convierte IGUAL. Meta lo acepta y luego no lo entrega.
  {
    const src = await desdeRaw(400, 400, false).webp({ quality: 80 }).toBuffer();
    const r = await optimizarImagen(src, 'image/webp');
    comprobar('webp pequeño se convierte igual', r.optimizada && r.contentType !== 'image/webp',
      `${kb(src.length)} -> ${r.contentType} ${kb(r.buffer.length)}`);
  }

  // 6 · WebP con alfa -> no debe multiplicar el peso (el defecto que se corrigió).
  {
    const src = await desdeRaw(1600, 1600, true).webp({ quality: 80, alphaQuality: 80 }).toBuffer();
    const r = await optimizarImagen(src, 'image/webp');
    const m = await sharp(r.buffer).metadata();
    const factor = r.buffer.length / src.length;
    comprobar('webp con alfa no engorda x2', factor < 2, `x${factor.toFixed(1)} (${kb(src.length)} -> ${kb(r.buffer.length)})`);
    comprobar('webp con alfa conserva transparencia', m.hasAlpha === true, `hasAlpha=${m.hasAlpha}`);
    comprobar('webp con alfa deja de ser webp', r.contentType === 'image/png', r.contentType);
  }

  // 7 y 8 · GIF y SVG intactos: recomprimirlos los rompe.
  {
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    const rg = await optimizarImagen(gif, 'image/gif');
    comprobar('gif se deja intacto', !rg.optimizada && rg.buffer === gif, `${gif.length} bytes`);

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="9" height="9"/></svg>');
    const rs = await optimizarImagen(svg, 'image/svg+xml');
    comprobar('svg se deja intacto', !rs.optimizada && rs.buffer === svg, `ext=${rs.ext}`);
    comprobar('svg da extension "svg", no "svg+xml"', rs.ext === 'svg', rs.ext);
  }

  // 9 · Archivo corrupto -> no revienta la subida.
  {
    const basura = Buffer.alloc(400 * 1024, 0x7f);
    const r = await optimizarImagen(basura, 'image/jpeg');
    comprobar('archivo corrupto no lanza', !r.optimizada && r.buffer === basura, 'devuelve el original');
  }

  // 10 · EXIF con rotación -> se aplica antes de guardar, no se pierde de lado.
  {
    const src = await desdeRaw(2400, 1200, false)
      .withMetadata({ orientation: 6 }) // 90 grados
      .jpeg({ quality: 100 }).toBuffer();
    const r = await optimizarImagen(src, 'image/jpeg');
    const m = await sharp(r.buffer).metadata();
    comprobar('rotacion EXIF aplicada', m.height! > m.width!, `${m.width}x${m.height} (entraba 2400x1200 girada)`);
  }

  // 11 · Imagen ya pequeña de lado -> no se agranda a 1920.
  {
    const src = await desdeRaw(900, 900, false).png().toBuffer();
    const r = await optimizarImagen(src, 'image/png');
    const m = await sharp(r.buffer).metadata();
    comprobar('no se agranda una imagen menor de 1920', Math.max(m.width!, m.height!) === 900, `${m.width}x${m.height}`);
  }

  console.log(`  ${'-'.repeat(78)}`);
  console.log(`\n  ${pasadas} pasadas · ${fallidas} fallidas\n`);
  if (fallidas) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

/**
 * ¿QUÉ PERFIL RINDE MÁS?
 *
 * Compara los dos compresores que acabaron conviviendo en el proyecto:
 *
 *   A · 1920 px / calidad 85   → `lib/optimizar-imagen-servidor.ts` (este trabajo)
 *   B · 1080 px / calidad 72   → `api/funnels/optimizar-fotos` (agenciaquin, v170)
 *
 * "Rendir" no es solo pesar poco: una foto de 20 kB pesa poquísimo y no sirve.
 * Rinde el que da MÁS AHORRO POR CADA PUNTO DE CALIDAD PERDIDO. Así que se
 * miden las dos cosas sobre los MISMOS archivos reales.
 *
 *
 * CÓMO SE MIDE LA CALIDAD, Y POR QUÉ ASÍ
 * --------------------------------------
 * No se comparan los archivos entre sí, sino cada uno contra el ORIGINAL, y a
 * la resolución a la que de verdad se ve la foto: un móvil de gama media son
 * ~430 px CSS a densidad 3 = **1290 px reales**.
 *
 * Comparar a resolución nativa favorecería al perfil de más píxeles por pura
 * definición, aunque el cliente nunca los vea. Comparar a 1080 favorecería al
 * otro. A 1290 px se pregunta lo único que importa: *puesta en la pantalla del
 * cliente, ¿cuál se parece más a la original?*
 *
 * La métrica es SSIM (índice de similitud estructural), que es la estándar para
 * esto porque castiga los artefactos que el ojo nota —bloques, halos, banding—
 * en vez de medir diferencias de píxel sueltas como hace PSNR.
 *
 *   1.0000  = idéntica
 *   > 0.99  = indistinguible salvo comparando al 200%
 *   > 0.98  = muy buena
 *   < 0.95  = se empieza a notar en zonas lisas (piel, degradados, fondos)
 *
 *   npx tsx comparar-perfiles.ts [cuantas]
 */
import sharp from 'sharp';
import { descargar, PREFIJO_ORIGINALES, supabase } from './src/storage.js';

const CUANTAS = Number(process.argv[2] ?? 12);
const PANTALLA = 1290; // px reales de un móvil de gama media

const PERFILES = [
  { nombre: 'A · 1920/q85  (este trabajo)', lado: 1920, calidad: 85 },
  { nombre: '  · 1600/q82', lado: 1600, calidad: 82 },
  { nombre: '  · 1440/q82', lado: 1440, calidad: 82 },
  { nombre: '  · 1290/q80  (= pantalla)', lado: 1290, calidad: 80 },
  { nombre: '  · 1290/q75', lado: 1290, calidad: 75 },
  { nombre: 'B · 1080/q72  (optimizar-fotos)', lado: 1080, calidad: 72 },
];

/** Reduce a `lado` px el borde largo y recodifica en JPEG con mozjpeg. */
async function comprimir(buf: Buffer, lado: number, calidad: number): Promise<Buffer> {
  return sharp(buf)
    .rotate()
    .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: calidad, mozjpeg: true })
    .toBuffer();
}

/**
 * Escala de grises en crudo, a la resolución de pantalla. Es sobre esto que se
 * compara.
 *
 * La referencia (el original) fija las dimensiones; las variantes se llevan a
 * ESAS MISMAS con `fit: 'fill'`. Dejar que cada una calcule su propio alto
 * producía diferencias de un píxel por redondeo, y entonces no hay comparación
 * posible: los búferes no se alinean.
 */
async function aPantalla(
  buf: Buffer,
  destino?: { w: number; h: number },
): Promise<{ datos: Buffer; w: number; h: number }> {
  const redim = destino
    ? { width: destino.w, height: destino.h, fit: 'fill' as const }
    : { width: PANTALLA, fit: 'inside' as const };

  const { data, info } = await sharp(buf)
    .resize(redim)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { datos: data, w: info.width, h: info.height };
}

/**
 * SSIM global sobre ventanas de 8x8.
 *
 * Implementación directa de la fórmula de Wang et al. (2004): para cada bloque
 * se comparan media, varianza y covarianza, y se promedia el resultado. Las
 * constantes C1 y C2 evitan que la división se dispare en zonas planas.
 */
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
          const va = a[i], vb = b[i];
          sa += va; sb += vb;
          saa += va * va; sbb += vb * vb; sab += va * vb;
        }
      }
      const n = V * V;
      const ma = sa / n, mb = sb / n;
      const va = saa / n - ma * ma;
      const vb = sbb / n - mb * mb;
      const cov = sab / n - ma * mb;

      suma += ((2 * ma * mb + C1) * (2 * cov + C2)) /
              ((ma * ma + mb * mb + C1) * (va + vb + C2));
      bloques++;
    }
  }
  return bloques ? suma / bloques : 1;
}

const kb = (n: number) => `${Math.round(n / 1024)} kB`;

async function main() {
  // Se toman originales de verdad, los de `_originales/embudos/`: son los que
  // había ANTES de comprimir nada, así que ambos perfiles parten de lo mismo.
  const { data: filas, error: err2 } = await supabase.rpc('listar_objetos_storage', {
    p_bucket: 'chat-media',
    p_prefijo: `${PREFIJO_ORIGINALES}/embudos/`,
  });
  if (err2) throw new Error(`No se pudo enumerar: ${err2.message}`);

  const candidatos = (filas as { ruta: string; bytes: number; content_type: string }[])
    .filter((f) => /^image\/(jpeg|png)$/.test(f.content_type ?? ''))
    .filter((f) => f.bytes > 307_200) // las que el botón de agenciaquin sí tocaría
    .sort((a, b) => b.bytes - a.bytes);

  // Muestra repartida por todo el rango de tamaños, no solo las más pesadas.
  const paso = Math.max(1, Math.floor(candidatos.length / CUANTAS));
  const muestra = candidatos.filter((_, i) => i % paso === 0).slice(0, CUANTAS);

  console.log(`\n  Originales candidatos (>300 kB): ${candidatos.length}`);
  console.log(`  Muestra analizada              : ${muestra.length}`);
  console.log(`  Calidad medida a               : ${PANTALLA} px (móvil real)\n`);

  const acc = PERFILES.map(() => ({ bytes: 0, ssim: 0 }));
  let totalOriginal = 0;
  let n = 0;

  for (const f of muestra) {
    let original: Buffer;
    try {
      original = await descargar(f.ruta);
    } catch {
      continue;
    }

    const ref = await aPantalla(original);

    for (let p = 0; p < PERFILES.length; p++) {
      const { lado, calidad } = PERFILES[p];
      const salida = await comprimir(original, lado, calidad);
      const vista = await aPantalla(salida, { w: ref.w, h: ref.h });

      acc[p].bytes += salida.length;
      acc[p].ssim += ssim(ref.datos, vista.datos, ref.w, ref.h);
    }

    totalOriginal += original.length;
    n++;
    process.stdout.write(`\r  procesados: ${n}/${muestra.length}   `);
  }
  process.stdout.write('\r' + ' '.repeat(40) + '\r');

  if (!n) { console.log('\n  Sin archivos que comparar.\n'); return; }

  console.log(`  RESUMEN sobre ${n} archivos (original: ${kb(totalOriginal)} en total)\n`);
  console.log(`  ${'perfil'.padEnd(32)} ${'peso'.padStart(9)} ${'medio'.padStart(8)} ${'ahorro'.padStart(8)} ${'SSIM'.padStart(8)}  veredicto`);
  console.log(`  ${'-'.repeat(84)}`);

  const resumen = PERFILES.map((perfil, p) => {
    const bytes = acc[p].bytes;
    const ahorro = 1 - bytes / totalOriginal;
    const calidad = acc[p].ssim / n;

    // Umbrales al uso para SSIM sobre fotografía comprimida con JPEG.
    const veredicto =
      calidad >= 0.97 ? 'indistinguible' :
      calidad >= 0.95 ? 'muy buena' :
      calidad >= 0.93 ? 'se nota al comparar' :
      calidad >= 0.90 ? 'se nota sin comparar' :
                        'degradada';

    console.log(`  ${perfil.nombre.padEnd(32)} ${kb(bytes).padStart(9)} ${kb(bytes / n).padStart(8)} ${(ahorro * 100).toFixed(1).padStart(7)}% ${calidad.toFixed(4).padStart(8)}  ${veredicto}`);
    return { nombre: perfil.nombre, bytes, ahorro, calidad };
  });

  // El que más rinde: más ahorro por punto de calidad sacrificado, tomando
  // como suelo el mínimo aceptable de 0.95 ("muy buena").
  const SUELO = 0.95;
  const aptos = resumen.filter((r) => r.calidad >= SUELO);
  const mejor = aptos.sort((a, b) => a.bytes - b.bytes)[0];

  console.log(`\n  ${'='.repeat(84)}`);
  if (mejor) {
    const A = resumen[0];
    const gana = (A.bytes - mejor.bytes) / totalOriginal;
    console.log(`  El que más rinde sin bajar de SSIM ${SUELO}:  ${mejor.nombre.trim()}`);
    if (mejor.nombre === A.nombre) {
      console.log(`  Es el perfil que ya tenemos. Nada que cambiar.`);
    } else {
      console.log(`  Ahorra ${(gana * 100).toFixed(1)} puntos más que el actual, con SSIM ${mejor.calidad.toFixed(4)}.`);
      console.log(`  Sobre los 92 MB de imagenes de embudos: ~${(gana * 92).toFixed(1)} MB más.`);
    }
  } else {
    console.log(`  Ningún perfil probado llega a SSIM ${SUELO}.`);
  }
  console.log(`  ${'='.repeat(84)}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });

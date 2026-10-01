/**
 * SSIM para las pruebas de peso. Es INSTRUMENTO DE MEDIDA, no lógica de la app:
 * la app no calcula SSIM en ningún sitio.
 *
 * Misma metodología que `pruebas/medir-topes.ts` (la medición con la que se
 * fijaron los topes de LEY-DE-PESO.md §2), para que las cifras se puedan comparar:
 * escala de grises a 1290 px de lado mayor (un móvil de gama alta), aplanado sobre
 * blanco, y SSIM global sobre ventanas de 8x8 (Wang et al. 2004).
 */
import sharp from 'sharp';

export const PANTALLA = 1290;

async function aGrises(buf: Buffer, destino?: { w: number; h: number }, nativo = false) {
  // Oficial (`medir-topes.ts`): la referencia se lleva a 1290 px AUNQUE sea más
  // pequeña (se agranda). `nativo`: sin agrandar, más estricto con las fotos < 1290 px.
  const redim = destino
    ? { width: destino.w, height: destino.h, fit: 'fill' as const }
    : { width: PANTALLA, height: PANTALLA, fit: 'inside' as const, withoutEnlargement: nativo };
  const { data, info } = await sharp(buf, { failOn: 'none' })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(redim)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { datos: data, w: info.width, h: info.height };
}

function ssimGris(a: Buffer, b: Buffer, w: number, h: number): number {
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

/** SSIM OFICIAL (el de la LEY): `candidato` frente a `original`, vistos los dos a 1290 px. */
export async function ssim(original: Buffer, candidato: Buffer): Promise<number> {
  const ref = await aGrises(original);
  const v = await aGrises(candidato, { w: ref.w, h: ref.h });
  return ssimGris(ref.datos, v.datos, ref.w, ref.h);
}

/** Referencia: igual pero sin agrandar lo que mide menos de 1290 px. Solo informativo. */
export async function ssimNativo(original: Buffer, candidato: Buffer): Promise<number> {
  const ref = await aGrises(original, undefined, true);
  const v = await aGrises(candidato, { w: ref.w, h: ref.h }, true);
  return ssimGris(ref.datos, v.datos, ref.w, ref.h);
}

import sharp from 'sharp';

/**
 * Comprime una foto EN EL SERVIDOR, justo antes de guardarla en Storage.
 *
 * Es la red de seguridad de `lib/imagen-comprimir.ts`, que hace lo mismo en el
 * navegador: aquella solo actúa si la subida pasa por uno de los dos paneles que
 * la usan, y además **se salta los PNG a propósito** para no romper logos con
 * transparencia. El resultado es que los PNG llegaban al bucket intactos — de
 * ahí que las imágenes de `embudos/` pesaran 2.502 kB de media y hasta 5,5 MB.
 *
 * Esta versión se aplica en la ruta de subida, así que cubre cualquier origen.
 *
 *
 * POR QUÉ JPEG Y NO WEBP
 * ----------------------
 * WebP comprime algo mejor, pero **Meta acepta el envío y luego no entrega el
 * mensaje** (ver el comentario de `lib/imagen-comprimir.ts`, aprendido a base de
 * golpes). Medido sobre archivos reales del bucket, la diferencia no justifica
 * el riesgo:
 *
 *   PNG 1920x1920 de 5,53 MB      JPEG 3264x3264 de 3,64 MB
 *     webp q85 -> 357 kB (-93,7%)   webp q85 -> 466 kB (-87,5%)
 *     jpeg q85 -> 446 kB (-92,1%)   jpeg q85 -> 502 kB (-86,5%)
 *
 * Punto y medio de ahorro a cambio de que la foto se entregue siempre, en
 * WhatsApp y en cualquier navegador. No hay discusión.
 *
 *
 * POR QUÉ 1920 px Y CALIDAD 85
 * ----------------------------
 * Conserva la resolución de sobra para cualquier pantalla y no se aprecia
 * pérdida al comparar píxel a píxel: logos, texto pequeño y costuras se leen
 * igual que en el original. El ahorro no viene de recortar calidad, viene de que
 * estas fotos estaban guardadas como PNG sin pérdida y como JPEG sobrecodificado.
 */

/** Ancho o alto máximo. No recorta: conserva la proporción. */
const LADO_MAX = 1920;

/** Calidad JPEG. 85 con mozjpeg es visualmente indistinguible del original. */
const CALIDAD = 85;

/** Por debajo de esto no compensa recomprimir. */
const MINIMO_BYTES = 200 * 1024;

/** Si no baja al menos esto, se conserva el original: no vale la pena perder calidad a cambio de nada. */
const AHORRO_MINIMO = 0.1;

export interface ImagenOptimizada {
  buffer: Buffer;
  contentType: string;
  /** Extensión que corresponde al `contentType`, sin punto. */
  ext: string;
  optimizada: boolean;
}

/**
 * Devuelve la versión liviana de la imagen, o la original intacta si no se puede
 * o no compensa. **Nunca lanza**: ante cualquier duda, se sube lo que llegó.
 */
export async function optimizarImagen(
  buffer: Buffer,
  contentType: string,
): Promise<ImagenOptimizada> {
  const original: ImagenOptimizada = {
    buffer,
    contentType,
    ext: extensionDe(contentType),
    optimizada: false,
  };

  // GIF animado y SVG se dejan tal cual: recomprimirlos los rompe o los empeora.
  if (
    !contentType.startsWith('image/') ||
    contentType === 'image/gif' ||
    contentType === 'image/svg+xml'
  ) {
    return original;
  }

  // El umbral de tamaño NO aplica al WebP. Aquí no es una cuestión de peso sino
  // de compatibilidad: Meta acepta un WebP y luego no entrega el mensaje, así
  // que hay que convertirlo aunque pese 20 kB.
  //
  // Esto no es hipotético: había 6 imágenes en `embudos/remarketing/` subidas
  // como WebP, de 95 a 167 kB, y las campañas de remarketing se envían por
  // WhatsApp. Llegaron ahí porque `imagen-comprimir.ts` devuelve el original
  // cuando el JPEG le sale más grande — que es lo normal partiendo de un WebP.
  const esWebp = contentType.startsWith('image/webp');

  if (!esWebp && buffer.length < MINIMO_BYTES) return original;

  try {
    const imagen = sharp(buffer, { failOn: 'none' });
    const meta = await imagen.metadata();

    // Un PNG con canal alfa es casi siempre un logo. Pasarlo a JPEG le pondría
    // fondo negro, así que se queda en PNG y se comprime como se pueda.
    const conTransparencia = meta.hasAlpha === true;

    const redimensionada = imagen
      .rotate() // aplica la orientación EXIF antes de que sharp la descarte
      .resize({ width: LADO_MAX, height: LADO_MAX, fit: 'inside', withoutEnlargement: true });

    // PNG SIN pérdida a propósito. La tentación es usar `palette: true`, que
    // comprime mucho más, pero cuantiza a 256 colores —degradando cualquier
    // degradado— y sharp llega a descartar el canal alfa al hacerlo. En una
    // imagen con transparencia eso es exactamente lo que no queremos. Aquí el
    // ahorro sale solo del redimensionado; si no llega al mínimo, se conserva
    // el original.
    const salida = conTransparencia
      ? await redimensionada.png({ compressionLevel: 9 }).toBuffer()
      : await redimensionada.jpeg({ quality: CALIDAD, mozjpeg: true }).toBuffer();

    // Del WebP se sale siempre, aunque el JPEG pese más: un archivo que no se
    // entrega no sirve de nada por liviano que sea.
    const ahorro = (buffer.length - salida.length) / buffer.length;
    if (!esWebp && ahorro < AHORRO_MINIMO) return original;

    return conTransparencia
      ? { buffer: salida, contentType: 'image/png', ext: 'png', optimizada: true }
      : { buffer: salida, contentType: 'image/jpeg', ext: 'jpg', optimizada: true };
  } catch {
    // Un archivo corrupto o un formato que sharp no entiende no debe tumbar la
    // subida: se guarda el original y ya lo recogerá el backfill si hace falta.
    return original;
  }
}

function extensionDe(contentType: string): string {
  // `image/svg+xml` -> `svg`, no `svg+xml`. Y `image/jpeg; charset=x` -> `jpg`.
  const sub = (contentType.split('/')[1] ?? 'jpg').split(';')[0]!.split('+')[0]!.trim().toLowerCase();
  if (sub === 'jpeg') return 'jpg';
  return /^[a-z0-9]+$/.test(sub) ? sub : 'bin';
}

/**
 * Un año de caché. Supabase pone una hora por defecto, y estos archivos no
 * cambian nunca: el nombre lleva un timestamp, así que una foto nueva es una
 * ruta nueva. Con una hora, el navegador vuelve a pedir la misma imagen al
 * origen constantemente, que es de donde salía buena parte del egress.
 */
export const CACHE_UN_ANO = '31536000';

import sharp from 'sharp';
import { ESCALONES_FOTO, PERFILES, cumpleTope, topeDe, type CodigoPeso, type TipoArchivo } from './ley-peso';

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


/*
 * LEY DE PESO (30-09-2026): CON TOPE, EL TOPE MANDA
 * -------------------------------------------------
 * Antes este compresor aplicaba un único perfil (1920 / q85) y se rendía si no
 * ahorraba un 10 %; con eso 5 de 22 fotos reales se quedaban por encima de
 * 250 kB. Ahora el perfil es una ESCALERA (`lib/ley-peso.ts`, la única fuente
 * de las cifras): se prueba un escalón tras otro y se para en el primero que
 * cabe. Se baja calidad antes que tamaño y nunca por debajo de 1440 px.
 *
 * Si ni el último escalón cabe NO se lanza ni se rechaza aquí: se devuelve la
 * mejor versión con `cumple: false` y `codigo: 'SUPERA_TOPE'`, y quien llama
 * decide (el panel rechaza; los entrantes guardan y alertan: LEY §1 punto 4).
 */

export interface ImagenOptimizada {
  buffer: Buffer;
  contentType: string;
  /** Extensión que corresponde al `contentType`, sin punto. */
  ext: string;
  optimizada: boolean;
  /** Tipo de la ley con el que se midió el resultado. */
  tipo: TipoArchivo;
  /** Tope en bytes de ese tipo. */
  tope: number;
  /** ¿`buffer` pesa lo que permite el tope? */
  cumple: boolean;
  /** `SUPERA_TOPE` si no cabe ni en el último escalón. */
  codigo?: CodigoPeso;
  /** Peso y tope en texto, listo para enseñar. Solo si no cumple. */
  mensaje?: string;
  /** Escalón con el que se guardó (`1920/q80`), si se comprimió. */
  escalon?: string;
  /** El compresor falló (archivo corrupto, formato ilegible). Se devuelve el original. */
  fallo?: boolean;
}

/** Mejor versión conseguida hasta el momento, mientras se bajan escalones. */
interface Candidato {
  buf: Buffer;
  ct: string;
  escalon: string;
}

/**
 * Devuelve la versión liviana de la imagen, la original intacta si ya cabe y
 * su formato vale, o la mejor conseguida con `cumple: false` si no cabe.
 * **Nunca lanza**: ante un archivo ilegible devuelve el original con
 * `fallo: true` (y `cumple` dirá la verdad sobre su peso).
 *
 * `tipo` elige el tope y los escalones. Por defecto `foto-web`; las rutas
 * pasarán el suyo cuando se conecten (P13 y siguientes).
 */
export async function optimizarImagen(
  buffer: Buffer,
  contentType: string,
  tipo: TipoArchivo = 'foto-web',
): Promise<ImagenOptimizada> {
  // GIF y SVG se dejan tal cual (recomprimirlos los rompe) pero se miden con SU
  // tope, no con el de las fotos. Su tratamiento propio es de P7 y P14.
  const ct = contentType.toLowerCase();
  const tipoMedido: TipoArchivo = ct === 'image/gif' ? 'gif' : ct === 'image/svg+xml' ? 'svg' : tipo;

  const resultado = (
    buf: Buffer, tipoContenido: string, optimizada: boolean, extra: Partial<ImagenOptimizada> = {},
  ): ImagenOptimizada => {
    const v = cumpleTope(tipoMedido, buf.length);
    return {
      buffer: buf, contentType: tipoContenido, ext: extensionDe(tipoContenido), optimizada,
      tipo: tipoMedido, tope: v.tope, cumple: v.cumple, codigo: v.codigo, mensaje: v.mensaje, ...extra,
    };
  };
  const original = () => resultado(buffer, contentType, false);

  if (!ct.startsWith('image/') || tipoMedido === 'gif' || tipoMedido === 'svg') return original();

  // WebP: se convierte SIEMPRE, aunque pese 20 kB. Aquí no es cuestión de peso
  // sino de compatibilidad: Meta acepta un WebP y luego no entrega el mensaje.
  // Esto no es hipotético: había 6 imágenes en `embudos/remarketing/` subidas
  // como WebP, de 95 a 167 kB, y las campañas se envían por WhatsApp.
  const esJpeg = ct === 'image/jpeg' || ct === 'image/jpg';
  const esPng = ct === 'image/png';

  // Si el original ya cabe y su formato vale (JPEG o PNG), no se toca: una
  // segunda pasada solo quitaría calidad a cambio de nada.
  if ((esJpeg || esPng) && buffer.length <= topeDe(tipoMedido)) return original();

  try {
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();

    // OJO: `hasAlpha` dice si EXISTE el canal alfa, no si se usa. Casi cualquier
    // herramienta de diseño exporta PNG con un canal alfa completamente opaco, y
    // mirando solo `hasAlpha` esas fotos se iban por la vía PNG y se perdía el
    // ahorro grande. `stats().isOpaque` recorre los píxeles y lo resuelve; solo
    // se consulta cuando hay canal, para no pagarlo siempre.
    const alfaReal = meta.hasAlpha === true && !(await sharp(buffer, { failOn: 'none' }).stats()).isOpaque;

    // Lo que manda un cliente con transparencia (un sticker) sale JPG sobre
    // blanco: 24 kB frente a 350 kB en PNG, medido. El resto conserva el alfa.
    const viaPng = alfaReal && tipoMedido !== 'foto-entrante';

    const escalones = PERFILES[tipoMedido].escalones ?? ESCALONES_FOTO;
    const tope = topeDe(tipoMedido);
    const base = sharp(buffer, { failOn: 'none' }).rotate(); // aplica el EXIF antes de que sharp lo descarte

    // El original compite solo si ya tiene un formato válido para esta vía.
    let mejor: Candidato | null = (viaPng && esPng) || (!viaPng && esJpeg)
      ? { buf: buffer, ct: contentType, escalon: 'original' }
      : null;

    /** Anota el intento y dice si cabe. */
    const probar = (buf: Buffer, tipoContenido: string, escalon: string): boolean => {
      if (!mejor || buf.length < mejor.buf.length) mejor = { buf, ct: tipoContenido, escalon };
      return buf.length <= tope;
    };

    if (viaPng) {
      // PNG sin pérdida y, si no cabe, con paleta (un logo ni se entera; una foto
      // con alfa sí, pero es un caso raro). Solo se baja el tamaño: la calidad no
      // es una opción en PNG. Un WebP con alfa puede engordar x10 a PNG sin
      // pérdida (700 kB -> 7.463 kB), de ahí el segundo intento.
      const lados = [...new Set(escalones.map((e) => e.lado))];
      for (const lado of lados) {
        const redim = base.clone().resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true });
        if (probar(await redim.clone().png({ compressionLevel: 9 }).toBuffer(), 'image/png', `${lado}/png`)) break;
        if (probar(await redim.clone().png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer(), 'image/png', `${lado}/png-paleta`)) break;
      }
    } else {
      for (const e of escalones) {
        let img = base.clone().resize({ width: e.lado, height: e.lado, fit: 'inside', withoutEnlargement: true });
        if (alfaReal) img = img.flatten({ background: '#ffffff' });
        const buf = await img
          .jpeg({ quality: e.calidad, mozjpeg: true, chromaSubsampling: e.croma444 ? '4:4:4' : '4:2:0' })
          .toBuffer();
        if (probar(buf, 'image/jpeg', `${e.lado}/q${e.calidad}${e.croma444 ? '/444' : ''}`)) break;
      }
    }

    const elegido = mejor as Candidato | null;
    // Sin candidato (no debería pasar) o el mejor es el propio original: se devuelve tal cual.
    if (!elegido || elegido.buf === buffer) return original();
    return resultado(elegido.buf, elegido.ct, true, { escalon: elegido.escalon });
  } catch (e) {
    // Un archivo corrupto o un formato que sharp no entiende no debe tumbar la
    // subida (LEY §1 punto 5: no en silencio, queda el aviso en el registro).
    // Se devuelve el original marcado como fallo; `cumple` dirá si además pesa de más.
    console.warn('[ley-peso]', JSON.stringify({
      estado: 'COMPRESOR_FALLO', tipo: tipoMedido, bytes: buffer.length, motivo: String((e as Error)?.message ?? e),
    }));
    return { ...original(), fallo: true };
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

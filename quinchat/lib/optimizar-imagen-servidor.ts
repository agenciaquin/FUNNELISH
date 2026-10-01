import sharp, { type OutputInfo, type Sharp } from 'sharp';
import {
  ESCALONES_FOTO, PERFILES, SSIM_MINIMO, mensajeAviso, nivelDe, topeConTolerancia, topeDe,
  type CodigoPeso, type Escalon, type Nivel, type TipoArchivo,
} from './ley-peso';

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
 * NIVELES (LEY §1 punto 4, decisión de dirección 30-09-2026: ACEPTAR antes que
 * rechazar). Tras los escalones normales:
 *   1 cabe en el tope · 2 casi cabe (hasta tope + 50 %): se acepta y se registra
 *   `tolerancia` · 3 rescate (escalones extra: q70 y 1280 px; gráficos q85) si con
 *   ellos cabe en tope + 50 %: se registra `rescate` · 4 nada basta: se devuelve la
 *   mejor versión conseguida con `codigo: 'SUPERA_TOPE'` y un `aviso` listo para el
 *   panel. NUNCA se lanza ni se rechaza por peso: quien llama guarda y avisa.
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
  /** ¿`buffer` pesa como mucho el tope? (nivel 1). OJO: no es «se rechaza»; mira `nivel`. */
  cumple: boolean;
  /** Nivel con el que se acepta: 1 cabe · 2 casi cabe · 3 rescate · 4 aceptado con aviso. */
  nivel: Nivel;
  /** `SUPERA_TOPE` solo en el nivel 4 (ni con rescate cupo). No es un rechazo. */
  codigo?: CodigoPeso;
  /** Nivel 4: peso y tope en texto, para el registro. */
  mensaje?: string;
  /** Nivel 4: aviso visible pero NO bloqueante para el panel («Subida. Pesa X, lo recomendado es Y…»). */
  aviso?: string;
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
  /** Se consiguió con un escalón de rescate (nivel 3 si cabe en tope + 50 %). */
  rescate: boolean;
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
    viaRescate = false,
  ): ImagenOptimizada => {
    const tope = topeDe(tipoMedido);
    const nivel = nivelDe(tipoMedido, buf.length, viaRescate);
    const aviso4 = nivel === 4;
    // Los niveles 2, 3 y 4 dejan UNA línea en el registro (LEY §1 punto 4).
    if (nivel > 1) {
      console.warn('[ley-peso]', JSON.stringify({
        estado: nivel === 2 ? 'tolerancia' : nivel === 3 ? 'rescate' : 'SUPERA_TOPE',
        nivel, tipo: tipoMedido, bytes: buf.length, tope, escalon: extra.escalon,
      }));
    }
    return {
      buffer: buf, contentType: tipoContenido, ext: extensionDe(tipoContenido), optimizada,
      tipo: tipoMedido, tope, cumple: nivel === 1, nivel,
      codigo: aviso4 ? 'SUPERA_TOPE' : undefined,
      mensaje: aviso4 ? mensajeAviso(tipoMedido, buf.length) : undefined,
      aviso: aviso4 ? mensajeAviso(tipoMedido, buf.length) : undefined,
      ...extra,
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
  if ((esJpeg || esPng) && buffer.length <= topeDe(tipoMedido)) {
    // Pero antes se comprueba que es una imagen de verdad: un corrupto pequeño o un
    // PDF con tipo JPEG no puede llegar a Meta como si fuera una foto.
    try {
      const m = await sharp(buffer, { failOn: 'none' }).metadata();
      if (!m.width || !m.height) throw new Error('sin dimensiones');
    } catch (e) {
      console.warn('[ley-peso]', JSON.stringify({
        estado: 'COMPRESOR_FALLO', tipo: tipoMedido, bytes: buffer.length, motivo: String((e as Error)?.message ?? e),
      }));
      return { ...original(), fallo: true };
    }
    return original();
  }

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
    const rescate = PERFILES[tipoMedido].rescate ?? [];
    const tope = topeDe(tipoMedido);
    const toleranciaMax = topeConTolerancia(tipoMedido);
    let enRescate = false;
    const base = sharp(buffer, { failOn: 'none' }).rotate(); // aplica el EXIF antes de que sharp lo descarte

    // El original compite solo si ya tiene un formato válido para esta vía.
    let mejor: Candidato | null = (viaPng && esPng) || (!viaPng && esJpeg)
      ? { buf: buffer, ct: contentType, escalon: 'original', rescate: false }
      : null;

    /** Anota el intento y dice si cabe en `limite`. */
    const probar = (buf: Buffer, tipoContenido: string, escalon: string, limite: number): boolean => {
      if (!mejor || buf.length < mejor.buf.length) mejor = { buf, ct: tipoContenido, escalon, rescate: enRescate };
      return buf.length <= limite;
    };

    /** Recorre una lista de escalones y para en el primero que cabe en `limite`. */
    const recorrer = async (lista: readonly Escalon[], limite: number): Promise<boolean> => {
      if (viaPng) {
        // PNG sin pérdida y, si no cabe, con paleta (un logo ni se entera; una foto
        // con alfa sí, pero es un caso raro). Solo se baja el tamaño: la calidad no
        // es una opción en PNG. Un WebP con alfa puede engordar x10 a PNG sin
        // pérdida (700 kB -> 7.463 kB), de ahí el segundo intento.
        const lados = [...new Set(lista.map((e) => e.lado))];
        for (const lado of lados) {
          const redim = base.clone().resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true });
          if (probar(await redim.clone().png({ compressionLevel: 9 }).toBuffer(), 'image/png', `${lado}/png`, limite)) return true;
          if (probar(await redim.clone().png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer(), 'image/png', `${lado}/png-paleta`, limite)) return true;
        }
        return false;
      }
      for (const e of lista) {
        let img = base.clone().resize({ width: e.lado, height: e.lado, fit: 'inside', withoutEnlargement: true });
        if (alfaReal) img = img.flatten({ background: '#ffffff' });
        const buf = await img
          .jpeg({ quality: e.calidad, mozjpeg: true, chromaSubsampling: e.croma444 ? '4:4:4' : '4:2:0' })
          .toBuffer();
        if (probar(buf, 'image/jpeg', `${e.lado}/q${e.calidad}${e.croma444 ? '/444' : ''}`, limite)) return true;
      }
      return false;
    };

    /**
     * Vía JPEG: de más a menos calidad se descartan los que pesan más que tope + 50 %
     * y, de los que caben, se elige el MÁS LIGERO que sigue pareciéndose al original
     * (SSIM >= SSIM_MINIMO). Para en cuanto uno cabe en el tope con ese parecido (nivel 1).
     * Si el primero que cabe en tope + 50 % ya no llega a ese parecido, se acepta igual
     * (más calidad no cabe). Devuelve false si ninguno cabe en tope + 50 %.
     */
    const buscarCalidad = async (): Promise<boolean> => {
      // Se DECODIFICA UNA SOLA VEZ (decodificar 12 MP es la mitad del tiempo de cada
      // intento): los candidatos salen del bitmap en crudo. Más de 40 MP no se cachean
      // (150 MB de memoria): ahí cada intento parte del archivo.
      const px = (meta.width ?? 0) * (meta.height ?? 0);
      let crudo: { data: Buffer; info: OutputInfo } | null = null;
      if (px > 0 && px <= 40_000_000) {
        let pre = sharp(buffer, { failOn: 'none' }).rotate();
        if (alfaReal) pre = pre.flatten({ background: '#ffffff' });
        crudo = await pre.raw().toBuffer({ resolveWithObject: true });
      }
      const desdeCrudo = () => crudo
        ? sharp(crudo.data, { raw: { width: crudo.info.width, height: crudo.info.height, channels: crudo.info.channels } })
        : base.clone();
      let ref: { datos: Buffer; w: number; h: number } | null = null;
      // El original JPEG que ya cabe en tope + 50 % es la reserva con parecido 1.
      let reserva: Candidato | null = esJpeg && buffer.length <= toleranciaMax
        ? { buf: buffer, ct: contentType, escalon: 'original', rescate: false } : null;
      let elegido: Candidato | null = null;
      for (const e of escalones) {
        let img = desdeCrudo().resize({ width: e.lado, height: e.lado, fit: 'inside', withoutEnlargement: true });
        if (alfaReal && !crudo) img = img.flatten({ background: '#ffffff' });
        const buf = await img
          .jpeg({ quality: e.calidad, mozjpeg: true, chromaSubsampling: e.croma444 ? '4:4:4' : '4:2:0' })
          .toBuffer();
        const nombre = `${e.lado}/q${e.calidad}${e.croma444 ? '/444' : ''}`;
        probar(buf, 'image/jpeg', nombre, toleranciaMax);          // anota el más ligero (nivel 4)
        if (buf.length > toleranciaMax) continue;                  // demasiado pesado: el siguiente
        if (reserva && reserva.escalon === 'original' && buf.length >= reserva.buf.length) continue; // el original es mejor
        ref ??= await grises(crudo ? desdeCrudo() : buffer);
        const parecido = ssimGris(ref.datos, (await grises(buf, ref)).datos, ref.w, ref.h);
        const cand: Candidato = { buf, ct: 'image/jpeg', escalon: nombre, rescate: false };
        if (parecido >= SSIM_MINIMO) {
          if (buf.length <= tope) { elegido = cand; break; }       // nivel 1
          reserva = cand;                                          // nivel 2; se sigue buscando uno que quepa
          continue;
        }
        if (!reserva) reserva = cand;                              // más calidad no cabe: se acepta este
        break;                                                     // los siguientes aún se parecen menos
      }
      elegido ??= reserva;
      if (elegido) mejor = elegido;
      return elegido !== null;
    };

    // Nivel 1: escalones normales. Si no cabe, nivel 2 (hasta tope + 50 %: se acepta
    // la mejor tal cual). Si tampoco, nivel 3: escalones de rescate. Si nada basta, nivel 4.
    if (!(viaPng ? await recorrer(escalones, tope) : await buscarCalidad())) {
      const mejorNormal = mejor as Candidato | null;
      if (!(mejorNormal && mejorNormal.buf.length <= toleranciaMax)) {
        enRescate = true;
        await recorrer(rescate, toleranciaMax);
        // Nivel 4 (decisión de dirección): si el rescate tampoco cupo, se guarda la mejor de los
        // escalones NORMALES (la de más calidad, normalmente 1440 px q75), no la más pequeña del rescate.
        const trasRescate = mejor as Candidato | null;
        if (mejorNormal && trasRescate && trasRescate.buf.length > toleranciaMax) mejor = mejorNormal;
      }
    }

    const elegido = mejor as Candidato | null;
    // Sin candidato (no debería pasar) o el mejor es el propio original: se devuelve tal cual.
    if (!elegido || elegido.buf === buffer) return original();
    return resultado(elegido.buf, elegido.ct, true, { escalon: elegido.escalon }, elegido.rescate);
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

/** Escala de grises a 1290 px (o a las dimensiones de la referencia): el SSIM de la LEY. */
async function grises(fuente: Buffer | Sharp, destino?: { w: number; h: number }) {
  const redim = destino
    ? { width: destino.w, height: destino.h, fit: 'fill' as const }
    : { width: 1290, height: 1290, fit: 'inside' as const };
  // Un Buffer es un archivo (se aplica el EXIF); un Sharp ya viene orientado y en crudo.
  const origen = Buffer.isBuffer(fuente) ? sharp(fuente, { failOn: 'none' }).rotate() : fuente;
  const { data, info } = await origen.flatten({ background: '#ffffff' })
    .resize(redim).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { datos: data, w: info.width, h: info.height };
}

/** SSIM global sobre ventanas de 8x8 (Wang et al. 2004), la misma medida de `medir-topes.ts`. */
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

/**
 * Pasa una imagen de Jimp (ya compuesta) a un buffer SIN PÉRDIDA, para que el
 * compresor la codifique UNA sola vez. Jimp compone (collage, marca de agua) y
 * sharp codifica: Jimp a calidad 100 pesaba ~1,6 MB por collage.
 *
 * Se usa el bitmap en crudo y se tira el canal alfa: estas imágenes son opacas,
 * y sin alfa el compresor las manda directas a JPEG.
 */
export async function bufferDesdeJimp(img: { bitmap: { data: Buffer; width: number; height: number } }): Promise<Buffer> {
  const { data, width, height } = img.bitmap;
  return sharp(data, { raw: { width, height, channels: 4 } })
    .removeAlpha()
    .png({ compressionLevel: 1 }) // intermedio: rápido, no se guarda en ningún sitio
    .toBuffer();
}

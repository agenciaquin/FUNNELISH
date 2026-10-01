import { CACHE_UN_ANO, optimizarImagen, type ImagenOptimizada } from '@/lib/optimizar-imagen-servidor';
import { formatearPeso, topeDe, type TipoArchivo } from '@/lib/ley-peso';

/**
 * Punto único de subida a Supabase Storage (LEY DE PESO, ESTRATEGIA-PESO P6).
 *
 * VERSIÓN 0: solo cubre lo que ya pasa por el servidor.
 *  - Imagen -> `optimizarImagen` con el tipo de la LEY, y se sube con
 *    `cacheControl` de 1 año (la marca que vigila la base).
 *  - Lo que NO es imagen (audio, vídeo, documento) se sube tal cual y SIN la marca
 *    de caché: es PENDIENTE EXPLÍCITO. Los vídeos necesitan WebCodecs y la vía
 *    `_pendientes/` (tareas P12-P13); no se les pone la marca para que la
 *    vigilancia no los dé por buenos.
 *
 * El peso NUNCA rechaza (LEY §1 punto 4, decisión de dirección 30-09-2026): si la
 * imagen no cabe se guarda la mejor versión y el resultado trae `img.nivel` y,
 * en el nivel 4, `img.aviso` para enseñárselo a quien subió. Lo único que se
 * rechaza es lo técnicamente imposible: con `rechazarIlegible: true` una imagen
 * que el compresor no puede leer (corrupta o que no es lo que dice ser) no se
 * sube y vuelve `ilegible: true`. Lo automático (clientes, collages, bot) no
 * pide eso: guarda lo que llegue.
 */

export interface OpcionesSubida {
  supabase: any;
  bucket: string;
  /** Ruta exacta (con extensión). Excluyente con `prefijo`. */
  ruta?: string;
  /** Carpeta: el nombre y la extensión los pone el módulo (`timestamp-azar.ext`). */
  prefijo?: string;
  buffer: Buffer;
  contentType: string;
  /** Tipo de la LEY con el que se mide si es imagen. */
  tipo: TipoArchivo;
  /** Subida de una persona: una imagen ilegible no se sube (se avisa de qué hacer). */
  rechazarIlegible?: boolean;
  /** Para la línea del registro (`entrante`, `chat-saliente`, `collage`...). */
  origen: string;
  upsert?: boolean;
  /** `false` = no recomprimir (sticker animado: recomprimirlo lo dejaría quieto). Se mide y se avisa. */
  comprimir?: boolean;
}

export interface ResultadoSubida {
  /** El archivo quedó en Storage. */
  subido: boolean;
  ruta?: string;
  /** Enlace público (solo si se subió). */
  url?: string | null;
  /** Lo que se subió (o se habría subido): úsalo también para Meta. */
  buffer: Buffer;
  contentType: string;
  /** Solo en imágenes. Trae `nivel` (1–4) y `aviso` (nivel 4). */
  img?: ImagenOptimizada;
  /** Atajo de `img.aviso`: aviso visible pero no bloqueante para el panel. */
  aviso?: string;
  /** La imagen no se pudo leer y se pidió rechazarla: no se subió nada. */
  ilegible?: boolean;
  /** Error de Storage, si lo hubo. */
  error?: string;
}

/** Registra, con su ruta y origen, una imagen aceptada en el nivel 4 (LEY §1 punto 4). */
export function alertaPeso(origen: string, ruta: string | undefined, img: Pick<ImagenOptimizada, 'tipo' | 'tope' | 'buffer' | 'escalon'>) {
  console.warn('[ley-peso]', JSON.stringify({
    estado: 'SUPERA_TOPE', nivel: 4, origen, ruta, tipo: img.tipo, bytes: img.buffer.length, tope: img.tope,
    pesa: formatearPeso(img.buffer.length), escalon: img.escalon,
  }));
}

export async function subirArchivo(o: OpcionesSubida): Promise<ResultadoSubida> {
  const esImagen = o.contentType.toLowerCase().startsWith('image/');
  let buffer = o.buffer;
  let contentType = o.contentType;
  let img: ImagenOptimizada | undefined;
  let ext = (o.contentType.split('/')[1] ?? 'bin').split(';')[0]!.split('+')[0]!.replace('jpeg', 'jpg');

  if (esImagen && o.comprimir !== false) {
    img = await optimizarImagen(o.buffer, o.contentType, o.tipo);
    buffer = img.buffer; contentType = img.contentType; ext = img.ext;
    if (img.fallo && o.rechazarIlegible) return { subido: false, buffer, contentType, img, ilegible: true };
  }

  const ruta = o.ruta ?? `${o.prefijo ?? ''}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  if (img?.nivel === 4) alertaPeso(o.origen, ruta, img);
  // Imagen sin recomprimir (sticker): se mide igual y se avisa si pasa del tope.
  if (esImagen && o.comprimir === false && buffer.length > topeDe(o.tipo)) {
    console.warn('[ley-peso]', JSON.stringify({ estado: 'SUPERA_TOPE', origen: o.origen, ruta, bytes: buffer.length, tope: topeDe(o.tipo), motivo: 'sin recomprimir' }));
  }

  // Solo las imágenes llevan la marca de la LEY (caché de 1 año).
  const opciones: Record<string, any> = { contentType, upsert: o.upsert ?? false };
  if (esImagen) opciones.cacheControl = CACHE_UN_ANO;

  const { error } = await o.supabase.storage.from(o.bucket).upload(ruta, buffer, opciones);
  if (error) return { subido: false, ruta, buffer, contentType, img, aviso: img?.aviso, error: error.message };

  const { data: pub } = o.supabase.storage.from(o.bucket).getPublicUrl(ruta);
  return { subido: true, ruta, url: pub?.publicUrl ?? null, buffer, contentType, img, aviso: img?.aviso };
}

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const bucket = () => supabase.storage.from(config.bucket);

/** Prefijo donde se guardan los originales antes de sustituirlos. */
export const PREFIJO_ORIGINALES = '_originales';

export interface Objeto {
  ruta: string;
  bytes: number;
  contentType: string | undefined;
}

/**
 * Enumera todos los objetos bajo un prefijo.
 *
 * NO usa el `list()` de Supabase. Ese API **agrupa las carpetas sin distinguir
 * mayúsculas**: en este bucket conviven `embudos/SPIDERMAN/` (1 archivo) y
 * `embudos/spiderman/` (27), y el listado devolvía los hijos de una bajo el
 * prefijo de la otra. Las descargas fallaban con "Object not found" y, peor, los
 * 27 archivos de la carpeta en minúsculas eran sencillamente invisibles: no es
 * que fallaran, es que el backfill nunca supo que existían.
 *
 * En su lugar consulta `storage.objects`, que es la fuente de verdad, a través
 * de una función restringida a `service_role`. De paso desaparece la paginación
 * carpeta a carpeta.
 */
export async function listarRecursivo(prefijo: string): Promise<Objeto[]> {
  const { data, error } = await supabase.rpc('listar_objetos_storage', {
    p_bucket: config.bucket,
    p_prefijo: prefijo,
  });

  if (error) {
    throw new Error(
      `No se pudo enumerar "${prefijo}": ${error.message}. ` +
        '¿Está creada la función public.listar_objetos_storage? Ver sql/002_listar_objetos.sql',
    );
  }

  return (data as { ruta: string; bytes: number | string; content_type: string | null }[]).map((o) => ({
    ruta: o.ruta,
    bytes: Number(o.bytes ?? 0),
    contentType: o.content_type ?? undefined,
  }));
}

export async function descargar(ruta: string): Promise<Buffer> {
  const { data, error } = await bucket().download(ruta);
  if (error || !data) throw new Error(`No se pudo descargar "${ruta}": ${error?.message ?? 'sin datos'}`);
  return Buffer.from(await data.arrayBuffer());
}

/** Copia el original a `_originales/` para poder deshacer la sustitución. */
export async function respaldar(ruta: string): Promise<void> {
  const destino = `${PREFIJO_ORIGINALES}/${ruta}`;
  const { error } = await bucket().copy(ruta, destino);
  // Si ya existe un respaldo es que se procesó antes: no se pisa.
  if (error && !/exists/i.test(error.message)) {
    throw new Error(`No se pudo respaldar "${ruta}": ${error.message}`);
  }
}

export async function subir(ruta: string, contenido: Buffer, contentType: string): Promise<void> {
  const { error } = await bucket().upload(ruta, contenido, {
    contentType,
    cacheControl: config.cacheControl,
    upsert: true,
  });
  if (error) throw new Error(`No se pudo subir "${ruta}": ${error.message}`);
}

export function urlPublica(ruta: string): string {
  return bucket().getPublicUrl(ruta).data.publicUrl;
}

/**
 * Deduce el content-type de los primeros bytes del archivo.
 *
 * Hace falta porque `upload()` sin `contentType` etiqueta el objeto como
 * `text/plain;charset=UTF-8`. Un archivo así deja de renderizarse como imagen,
 * `lib/whatsapp.ts` lo trata como si no fuera imagen, y este mismo backfill lo
 * ignora, porque filtra por el tipo declarado antes de descargar. Es decir:
 * restaurar sin content-type deja el archivo peor que antes de tocarlo.
 */
export function tipoPorContenido(buffer: Buffer): string {
  if (buffer.length >= 12) {
    const c = buffer.subarray(0, 12);
    if (c[0] === 0xff && c[1] === 0xd8) return 'image/jpeg';
    if (c.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png';
    if (c.subarray(0, 4).toString('ascii') === 'RIFF' && c.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    if (c.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
    if (c.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
    if (c.subarray(0, 4).toString('hex') === '1a45dfa3') return 'video/webm';
  }
  return 'application/octet-stream';
}

export async function restaurar(ruta: string): Promise<void> {
  const original = await descargar(`${PREFIJO_ORIGINALES}/${ruta}`);
  const { error } = await bucket().upload(ruta, original, {
    contentType: tipoPorContenido(original),
    cacheControl: config.cacheControl,
    upsert: true,
  });
  if (error) throw new Error(`No se pudo restaurar "${ruta}": ${error.message}`);
}

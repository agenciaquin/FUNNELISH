import { config } from './config.js';
import type { Clase } from './optimizar.js';
import { supabase } from './storage.js';

export interface Entrada {
  ruta: string;
  clase: Exclude<Clase, 'otro'>;
  bytesOriginal: number;
  bytesFinal: number;
  contentType: string;
  respaldo: string | null;
}

/** Rutas ya procesadas, para que el backfill se pueda relanzar sin repetir trabajo. */
export async function yaProcesadas(): Promise<Set<string>> {
  const rutas = new Set<string>();
  const tamanoPagina = 1000;

  for (let desde = 0; ; desde += tamanoPagina) {
    const { data, error } = await supabase
      .from('media_optimizaciones')
      .select('ruta')
      .eq('bucket', config.bucket)
      .range(desde, desde + tamanoPagina - 1);

    if (error) throw new Error(`No se pudo leer media_optimizaciones: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const fila of data) rutas.add(fila.ruta as string);
    if (data.length < tamanoPagina) break;
  }

  return rutas;
}

export async function anotar(entrada: Entrada): Promise<void> {
  const { error } = await supabase.from('media_optimizaciones').upsert(
    {
      ruta: entrada.ruta,
      bucket: config.bucket,
      clase: entrada.clase,
      bytes_original: entrada.bytesOriginal,
      bytes_final: entrada.bytesFinal,
      content_type: entrada.contentType,
      respaldo: entrada.respaldo,
    },
    { onConflict: 'ruta' },
  );

  if (error) throw new Error(`No se pudo anotar "${entrada.ruta}": ${error.message}`);
}

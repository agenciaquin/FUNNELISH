import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { estamparNombreDetallado, esEstiloActual } from '@/lib/watermark';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Re-estampa la marca de agua (nombre del producto) en las fotos de catálogo
 * que todavía NO la tienen marcada de verdad. Trabaja por LOTES: el panel lo
 * llama varias veces hasta que 'restantes' = 0.
 *
 * "Pendiente" = no tiene original guardado (url_original vacío) O el original
 * es igual a la foto mostrada (señal de que el estampado falló antes). Así se
 * REINTENTAN las que quedaron a medias.
 */
const LOTE = 8;
const DEADLINE_MS = 45_000;

type Row = { id: string; nombre_producto: string | null; url_imagen: string | null; url_original: string | null };

function pendiente(r: Row): boolean {
  if (!r.url_imagen || !r.nombre_producto) return false;
  // Pendiente si: nunca se marcó, quedó a medias, o tiene un estilo VIEJO
  // (para re-aplicar el nuevo diseño de la etiqueta).
  return !r.url_original || r.url_original === r.url_imagen || !esEstiloActual(r.url_imagen);
}

export async function POST(_req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const t0 = Date.now();

  const { data: todas, error } = await supabase
    .from('catalogo_colores')
    .select('id, nombre_producto, url_imagen, url_original')
    .not('url_imagen', 'is', null)
    .not('nombre_producto', 'is', null)
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pendientes = (todas ?? []).filter(pendiente) as Row[];

  let procesadas = 0;
  let fallos = 0;
  let primerError: string | null = null;
  for (const c of pendientes.slice(0, LOTE)) {
    if (Date.now() - t0 > DEADLINE_MS) break;
    // Fuente limpia = el original si existe y es distinto; si no, la foto actual.
    const fuente = (c.url_original && c.url_original !== c.url_imagen) ? c.url_original : c.url_imagen!;
    const nombre = String(c.nombre_producto ?? '').trim();
    const { url: marcada, error } = await estamparNombreDetallado(supabase, fuente, nombre, c.id);
    if (marcada) {
      await supabase.from('catalogo_colores')
        .update({ url_imagen: marcada, url_original: fuente }).eq('id', c.id);
      procesadas++;
    } else {
      fallos++; // se deja pendiente para reintentar
      if (!primerError && error) primerError = error;
    }
  }

  const restantes = pendientes.length - procesadas;
  return NextResponse.json({ procesadas, fallos, restantes, error: primerError });
}

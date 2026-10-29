import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Ajustes temporales del bot de ventas (tabla ajustes_bot, clave → valor JSON).
 *
 * "solo_bienvenida": mientras esté vigente (valor.hasta en el futuro), el bot de
 * la línea de ventas SOLO responde el primer mensaje de cada cliente (catálogo)
 * y se apaga en ese chat: el resto lo atiende el asesor a mano. Sirve para que el
 * Supervisor aprenda de cómo vende el asesor.
 */

let cache: { hasta: number; leido: number } | null = null;

/** Fecha (ms) hasta la que rige "solo bienvenida", o 0 si no está activo. */
export async function soloBienvenidaHasta(): Promise<number> {
  if (cache && Date.now() - cache.leido < 60_000) return cache.hasta;
  let hasta = 0;
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'solo_bienvenida').maybeSingle();
    const h = data?.valor?.hasta ? new Date(String(data.valor.hasta)).getTime() : 0;
    hasta = Number.isFinite(h) ? h : 0;
  } catch { /* si falla, el bot funciona normal */ }
  cache = { hasta, leido: Date.now() };
  return hasta;
}

export async function soloBienvenidaActivo(): Promise<boolean> {
  return (await soloBienvenidaHasta()) > Date.now();
}

/** Activa (hasta una fecha) o apaga el modo. */
export async function fijarSoloBienvenida(hasta: Date | null): Promise<void> {
  const supabase = createServerSupabaseClient();
  await supabase.from('ajustes_bot').upsert({
    clave: 'solo_bienvenida',
    valor: { hasta: hasta ? hasta.toISOString() : null },
    actualizado_at: new Date().toISOString(),
  }, { onConflict: 'clave' });
  cache = null;
}

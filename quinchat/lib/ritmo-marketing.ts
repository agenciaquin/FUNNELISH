/**
 * RITMO DE ENVÍO de plantillas de marketing (carrito abandonado y descuento por entrega).
 * Decisión del dueño (07-nov-2026): no mandar muchos mensajes juntos y frenar si Meta
 * empieza a limitarnos.
 *
 *  · Pausa aleatoria entre un envío y otro (no salen en ráfaga).
 *  · Tope de envíos por pasada del cron.
 *  · FRENO: si en las últimas 2 horas Meta devolvió varios errores de límite, se
 *    pausan los envíos hasta que baje:
 *      131049 → Meta no entregó para «cuidar la experiencia» del usuario (límite por persona)
 *      131048 → límite por spam / calidad del número
 *      130429 → límite de velocidad (demasiados mensajes por segundo)
 */
export const PAUSA_MIN_MS = 5000;
export const PAUSA_MAX_MS = 9000;
export const TOPE_CARRITOS_POR_PASADA = 2;    // cron cada 2 min
export const TOPE_DESCUENTOS_POR_PASADA = 8;  // cron de Effi cada hora (la sincronización ya toma ~2–3 min)
const UMBRAL_FRENO = 4;                         // errores de límite en 2 h que activan el freno

export const esperarTurno = () =>
  new Promise<void>(r => setTimeout(r, PAUSA_MIN_MS + Math.random() * (PAUSA_MAX_MS - PAUSA_MIN_MS)));

/** ¿Meta nos está limitando? Cuenta los errores de límite de las plantillas de las últimas 2 h. */
export async function frenoMeta(supabase: any): Promise<{ frenado: boolean; bloqueos: number }> {
  try {
    const desde = new Date(Date.now() - 2 * 3600_000).toISOString();
    const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true })
      .gte('created_at', desde)
      .like('id', 'tpl-%')   // plantillas enviadas por el sistema
      .or('error_envio.ilike.%131049%,error_envio.ilike.%131048%,error_envio.ilike.%130429%');
    const n = count ?? 0;
    return { frenado: n >= UMBRAL_FRENO, bloqueos: n };
  } catch { return { frenado: false, bloqueos: 0 }; }
}

/** wamids de plantillas que Meta NO entregó por el límite por persona (131049), entre 48 h y 7 días atrás. */
export async function wamidsBloqueados(supabase: any, prefijo: 'tpl-carrito-' | 'tpl-desc-'): Promise<string[]> {
  const { data } = await supabase.from('messages').select('whatsapp_id')
    .like('id', `${prefijo}%`).ilike('error_envio', '%131049%')
    .gte('created_at', new Date(Date.now() - 7 * 86400_000).toISOString())
    .lte('created_at', new Date(Date.now() - 48 * 3600_000).toISOString())
    .not('whatsapp_id', 'is', null).limit(200);
  return [...new Set<string>((data ?? []).map((m: any) => String(m.whatsapp_id)).filter(Boolean))];
}

/** ¿El cliente escribió algo en el chat después de `desde`? (si respondió, no se reintenta) */
export async function clienteEscribio(supabase: any, convId: string, desde: string): Promise<boolean> {
  const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true })
    .eq('conversation_id', convId).eq('role', 'user').gte('created_at', desde);
  return (count ?? 0) > 0;
}

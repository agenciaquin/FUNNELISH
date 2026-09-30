/**
 * Freno del bot: lo que impide que la IA gaste sin control.
 *
 *  · `BOT_IA=off` en Vercel apaga las respuestas de IA en TODAS las
 *    conversaciones, sin tocar la base de datos. Para volver: quitar la variable
 *    (o ponerla en `on`) y volver a publicar.
 *
 *  · Tope por conversación: si el bot ya respondió `BOT_TOPE_DIARIO` veces (por
 *    defecto 40) en las últimas 24 h, deja de responder y el chat pasa a HUMANO.
 *    Corta el bucle con otro bot o con una respuesta automática, que antes podía
 *    llegar a unas 300 llamadas por hora en un solo chat. `BOT_TOPE_DIARIO=0`
 *    lo desactiva.
 */

export function botIaApagado(): boolean {
  return (process.env.BOT_IA ?? '').trim().toLowerCase() === 'off';
}

const HORAS_24 = 24 * 60 * 60 * 1000;

/**
 * ¿Puede el bot responder en esta conversación? Si alcanzó el tope, además
 * apaga el bot en ese chat y lo marca HUMANO, para que alguien lo revise.
 */
export async function botPuedeResponder(supabase: any, conversationId: string): Promise<boolean> {
  if (botIaApagado()) return false;

  const tope = Number.parseInt(process.env.BOT_TOPE_DIARIO ?? '40', 10);
  if (!Number.isFinite(tope) || tope <= 0) return true;

  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .gte('created_at', new Date(Date.now() - HORAS_24).toISOString());

  // Si no se puede contar, se deja responder: el freno no debe tumbar el bot.
  if (error || count === null) return true;
  if (count < tope) return true;

  console.warn(`[Freno] ${conversationId}: ${count} respuestas del bot en 24 h (tope ${tope}). Pasa a HUMANO.`);
  await supabase.from('conversations')
    .update({ bot_enabled: false, label: 'HUMANO' })
    .eq('id', conversationId);
  return false;
}

/**
 * Freno del bot: lo que impide que la IA gaste sin control.
 *
 *  · `BOT_IA=off` en Vercel apaga las respuestas de IA en TODAS las
 *    conversaciones, sin tocar la base de datos. Para volver: quitar la variable
 *    (o ponerla en `on`) y volver a publicar.
 *
 *  · Tope por conversación: si el bot ya mandó `BOT_TOPE_DIARIO` mensajes (por
 *    defecto 80) en las últimas 24 h, deja de responder y el chat pasa a HUMANO.
 *    Cuenta MENSAJES SALIENTES del bot (filas `role: 'assistant'`), no turnos:
 *    cada parte de una respuesta separada por `---` cuenta como uno, igual que
 *    cada foto y los mensajes de los crons. 80 son unos 20-30 turnos reales.
 *    Corta el bucle con otro bot o con una respuesta automática, que antes podía
 *    llegar a unas 300 llamadas por hora en un solo chat. `BOT_TOPE_DIARIO=0`
 *    lo desactiva.
 */

import { joinLabels, parseLabels } from '@/lib/panel/types';

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

  const tope = Number.parseInt(process.env.BOT_TOPE_DIARIO ?? '80', 10);
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
  // HUMANO se AÑADE a las etiquetas (van en `label` separadas por " | "), como
  // hace `agregarTagConv` en el webhook: reemplazarlas borraba VENTA REALIZADA,
  // PEDIDO PROGRAMADO, etc., y el chat salía de ventas, metas y CAPI.
  // Si no se puede leer `label`, solo se apaga el bot y la lista no se toca.
  const { data: conv, error: errLabel } = await supabase.from('conversations')
    .select('label').eq('id', conversationId).maybeSingle();
  const cambios: Record<string, any> = { bot_enabled: false };
  if (!errLabel) cambios.label = joinLabels([...parseLabels(conv?.label), 'HUMANO']);
  await supabase.from('conversations')
    .update(cambios)
    .eq('id', conversationId);
  return false;
}

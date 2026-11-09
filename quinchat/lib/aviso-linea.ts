/**
 * Avisos del Panel de Novedades (oficina / intento de entrega): POR QUÉ NÚMERO sale cada uno y cómo queda la bandeja.
 * Regla del dueño (09-nov-2026): a cada cliente le llega por el chat donde compró.
 *   QUINO AGENCIA      → línea de VENTAS (Chat WhatsApp, WHATSAPP_PHONE_NUMBER_ID_VENTAS)
 *   FUNNELISTH LANDING → línea del FUNNEL (Chat Funnel, WHATSAPP_PHONE_NUMBER_ID)
 * Y el aviso NO llena la bandeja: el chat queda oculto hasta que el cliente responda (el webhook lo destapa al
 * llegar su mensaje). Si el cliente escribió en las últimas 24 h, el chat está activo y se deja como está.
 */
export type LineaAviso = 'funnel' | 'ventas';

export const lineaDeVendedor = (vendedor: unknown): LineaAviso => (/QUINO/i.test(String(vendedor ?? '')) ? 'ventas' : 'funnel');

export function phoneIdDeLinea(linea: LineaAviso): string | undefined {
  return linea === 'ventas'
    ? (process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS || process.env.WHATSAPP_PHONE_NUMBER_ID)
    : process.env.WHATSAPP_PHONE_NUMBER_ID;
}

/** Tras enviar: si el chat no está activo (sin mensaje del cliente en 24 h), queda oculto y en la línea de la compra. */
export async function ocultarHastaRespuesta(supabase: any, conv: string, linea: LineaAviso) {
  const { data } = await supabase.from('messages').select('created_at')
    .eq('conversation_id', conv).eq('role', 'user').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const activo = data?.created_at && Date.now() - Date.parse(data.created_at) < 24 * 3600_000;
  if (!activo) await supabase.from('conversations').update({ oculto: true, linea }).eq('id', conv);
}

/**
 * Motivo legible de un envío rechazado por Meta: mensaje + código + detalle; si Meta no manda JSON, el estado HTTP y el
 * inicio de la respuesta. (Antes quedaba solo «No se pudo enviar» y no se sabía la causa — 09-nov-2026.)
 */
export async function motivoErrorMeta(res: Response): Promise<string> {
  const texto = await res.text().catch(() => '');
  let e: any = null;
  try { e = JSON.parse(texto)?.error ?? null; } catch { /* no es JSON */ }
  if (!e) return `Meta respondió HTTP ${res.status}${texto ? `: ${texto.slice(0, 200)}` : ''}`;
  const det = e.error_data?.details ? ` — ${e.error_data.details}` : '';
  const msg = e.error_user_msg || e.message || 'sin mensaje';
  return `${msg} (código ${e.code ?? '?'}${e.error_subcode ? `/${e.error_subcode}` : ''})${det}`.slice(0, 400);
}

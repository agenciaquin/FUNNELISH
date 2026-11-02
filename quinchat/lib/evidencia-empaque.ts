import { sendImageByUrl } from '@/lib/whatsapp';

/**
 * EVIDENCIA DE EMPAQUE para pedidos que se reclaman en OFICINA de Interrapidísimo.
 *
 * Se manda junto a la solicitud del abono de oficina: la foto del catálogo
 * "EVIDENCIA COMO SE DESPACHA LA PRENDA" con el texto de confianza.
 * UNA sola vez por conversación (conversations.evidencia_empaque_at), así no se
 * duplica aunque el bot vuelva a pedir el abono.
 */
export const TEXTO_EVIDENCIA_EMPAQUE =
  `📦💚 ¡Mira cómo enviamos tu pedido!\n` +
  `Nuestras prendas van empacadas en bolsas transparentes para que, cuando llegues a la oficina de Interrapidísimo, puedas ver fácilmente tu prenda antes de recibirla. 😍\n` +
  `Queremos que compres con tranquilidad, confianza y seguridad. ✅`;

async function fotoEvidencia(supabase: any): Promise<string | null> {
  try {
    const { data: cat } = await supabase.from('catalogos_bot').select('id')
      .ilike('familia', 'EVIDENCIA COMO SE DESPACHA%').limit(1).maybeSingle();
    if (!cat?.id) return null;
    const { data: col } = await supabase.from('catalogo_colores').select('url_imagen')
      .eq('catalogo_id', cat.id).neq('activo', false).not('url_imagen', 'is', null)
      .order('orden', { ascending: true }).limit(1).maybeSingle();
    const url = String(col?.url_imagen ?? '');
    return url.startsWith('http') ? url : null;
  } catch { return null; }
}

/** Envía la evidencia de empaque si a este chat aún no se le ha enviado. Nunca lanza error. */
export async function enviarEvidenciaEmpaque(supabase: any, from: string): Promise<void> {
  try {
    const { data: conv } = await supabase.from('conversations').select('evidencia_empaque_at').eq('id', from).maybeSingle();
    if (conv?.evidencia_empaque_at) return; // ya se le envió: no se duplica
    const url = await fotoEvidencia(supabase);
    if (!url) { console.warn('[Evidencia] no hay foto en el catálogo EVIDENCIA COMO SE DESPACHA LA PRENDA'); return; }
    // Se marca ANTES de enviar: si llegan dos mensajes seguidos, solo uno la manda.
    const ahora = new Date().toISOString();
    const { data: marcado } = await supabase.from('conversations')
      .update({ evidencia_empaque_at: ahora }).eq('id', from).is('evidencia_empaque_at', null).select('id');
    if (!marcado?.length) return;
    const wamid = await sendImageByUrl(from, url, TEXTO_EVIDENCIA_EMPAQUE);
    if (!wamid) {
      // No salió: se libera la marca para intentarlo la próxima vez que se pida el abono
      await supabase.from('conversations').update({ evidencia_empaque_at: null }).eq('id', from);
      return;
    }
    await supabase.from('messages').insert([
      { id: `evid-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, conversation_id: from, content: url, role: 'assistant', type: 'image', whatsapp_id: wamid, created_at: ahora },
      { id: `evid-txt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, conversation_id: from, content: TEXTO_EVIDENCIA_EMPAQUE, role: 'assistant', type: 'text', created_at: ahora },
    ]);
  } catch (e) { console.error('[Evidencia] no se pudo enviar:', e); }
}

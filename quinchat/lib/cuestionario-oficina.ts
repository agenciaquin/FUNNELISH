import { sendTextMessage } from '@/lib/whatsapp';

/**
 * CUESTIONARIO DE OFICINA (contraentrega sin abono).
 *
 * Regla del negocio: todo pedido a OFICINA de Interrapidísimo lleva abono de $5.000.
 * Si el cliente NO quiere abonar (hace la objeción) o pasan más de 5 h sin que
 * responda al mensaje del abono, se le envía este cuestionario. Cuando lo responde,
 * el chat queda con la etiqueta "OFICINA REVISAR HUMANO", el bot se apaga y un
 * humano decide si se envía a oficina o se cancela.
 */

export const CUESTIONARIO_OFICINA =
  `📦 ¡Puedes pagar contraentrega sin abonar!\n` +
  `Solo necesitamos que respondas estas 5 preguntas:\n` +
  `1️⃣ ¿Vives en el pueblo o en una finca/vereda?\n` +
  `2️⃣ ¿Ya tienes el dinero completo para pagar?\n` +
  `3️⃣ ¿Puedes recoger tu pedido en la oficina en máximo 24 horas hábiles después de su llegada?\n` +
  `4️⃣ ¿Puedes esperar de 3 a 5 días para recibirlo?\n` +
  `5️⃣ ¿Te queda fácil desplazarte hasta la oficina de Inter Rapidísimo?\n` +
  `✅ Con tus respuestas validaremos el envío contraentrega, sin pago anticipado.`;

export const ETIQUETA_REVISAR = 'OFICINA REVISAR HUMANO';

const ACUSE =
  `¡Gracias por tus respuestas! 🙌 Ya las estamos revisando y en un momento te confirmamos el envío por aquí 📦`;

/** ¿Este texto es el cuestionario? (para saber si el cliente lo está respondiendo) */
export const ES_CUESTIONARIO = /respondas estas 5 preguntas/i;

/** El cliente se niega o pone objeción al abono de oficina. */
const RECHAZO_ABONO = new RegExp([
  'no (tengo|puedo|voy a|quiero|me interesa|hago|alcanzo a) ?(para )?(el )?(abonar|abono|hacer (el )?abono|consignar|transferir|pagar (el )?abono|pagar antes|pagar por adelantado)',
  'sin abon',
  'no abono',
  'no (tengo|manejo|uso) (nequi|daviplata|cuenta|banco)',
  'pago (todo )?(al recibir|en la oficina|cuando (me )?llegue|cuando lo recoja|contra ?entrega)',
  'contra ?entrega en la oficina',
  'no pago (nada )?(antes|por adelantado|anticipado)',
  'no (conf[ií]o|me da confianza) (en )?(abonar|pagar|consignar|transferir)',
  'no doy (plata|dinero|abono)',
  'por ?qu[eé] (tengo que|debo|hay que|toca) (abonar|pagar antes|hacer (el )?abono)',
].join('|'), 'i');

export function esRechazoAbono(texto: string): boolean {
  return RECHAZO_ABONO.test(String(texto ?? ''));
}

const parse = (l: string | null | undefined) => String(l ?? '').split('|').map(s => s.trim()).filter(Boolean);
const join = (a: string[]) => [...new Set(a.map(s => s.trim()).filter(Boolean))].join(' | ');

/** ¿Este chat tiene un pedido a oficina esperando el abono? */
export function esperaAbonoOficina(label: string | null | undefined, textosBot: string[]): boolean {
  const L = String(label ?? '').toUpperCase();
  if (/OFICINA CON ABONO|VENTA REALIZADA|ABONO POR VERIFICAR|OFICINA REVISAR HUMANO|PEDIDO CANCELADO/.test(L)) return false;
  if (/OFICINA SIN ABONO|PENDIENTE DE ABONO/.test(L)) return true;
  // Línea de ventas (la IA no siempre etiqueta): el bot habló del abono para oficina.
  return textosBot.some(t => /abono/i.test(t) && /oficina|interrapid/i.test(t));
}

/**
 * Se llama ANTES de que la IA responda. Devuelve true si ya atendió el mensaje:
 *  · El cliente está respondiendo el cuestionario → etiqueta, apaga el bot y avisa.
 *  · El cliente rechaza el abono de oficina → le manda el cuestionario.
 * `enviar` es la función de cada línea para mandar y guardar el mensaje.
 */
export async function manejarCuestionarioOficina(
  supabase: any,
  from: string,
  texto: string,
  enviar: (t: string) => Promise<void>,
): Promise<boolean> {
  try {
    const { data: conv } = await supabase.from('conversations')
      .select('label, contact_name, oficina_rescate_at').eq('id', from).maybeSingle();
    const { data: msgs } = await supabase.from('messages')
      .select('role, content, type').eq('conversation_id', from)
      .order('created_at', { ascending: false }).limit(15);
    const lista = msgs ?? [];
    const ultimoNuestro = lista.find((m: any) => m.role !== 'user' && m.type === 'text');

    // ── 1) Está RESPONDIENDO el cuestionario → a revisión humana ─────────────
    if (ultimoNuestro && ES_CUESTIONARIO.test(String(ultimoNuestro.content ?? ''))) {
      const etiquetas = parse(conv?.label);
      await supabase.from('conversations')
        .update({ label: join([...etiquetas, ETIQUETA_REVISAR]), bot_enabled: false }).eq('id', from);
      await enviar(ACUSE);
      const nombre = conv?.contact_name && conv.contact_name !== 'Desconocido' ? conv.contact_name : 'El cliente';
      const aviso =
        `📋 *OFICINA — REVISAR*\n` +
        `*${nombre}* (cel: ${from.replace(/^57/, '')}) respondió el cuestionario de contraentrega sin abono.\n` +
        `Revisa sus respuestas en QuinChat y decide si se envía a la oficina o se cancela 🙏`;
      for (const n of ['573167648391', '573187051499']) {
        try { await sendTextMessage(n, aviso); } catch { /* no bloquear */ }
      }
      return true;
    }

    // ── 2) Rechaza el abono de oficina → cuestionario (una sola vez) ─────────
    if (!conv?.oficina_rescate_at && esRechazoAbono(texto)) {
      const textosBot = lista.filter((m: any) => m.role !== 'user').map((m: any) => String(m.content ?? ''));
      if (esperaAbonoOficina(conv?.label, textosBot)) {
        await enviar(CUESTIONARIO_OFICINA);
        await supabase.from('conversations').update({ oficina_rescate_at: new Date().toISOString() }).eq('id', from);
        return true;
      }
    }
  } catch (e) {
    console.error('[Cuestionario oficina] error:', e);
  }
  return false;
}

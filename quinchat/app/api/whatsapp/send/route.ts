import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendTextMessage } from '@/lib/whatsapp';
import { createServerSupabaseClient } from '@/lib/supabase';
import { entrarLinea } from '@/lib/whatsapp-contexto';

/**
 * POST /api/whatsapp/send
 * Called by the panel when an agent types a manual reply.
 * Sends via WhatsApp Cloud API and stores the message in DB.
 */
export async function POST(req: NextRequest) {
  // Must be logged in
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { to: string; message: string; responderA?: string | null; citado?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { to, message, responderA, citado } = body;
  if (!to || !message?.trim()) {
    return NextResponse.json({ error: 'Missing "to" or "message"' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  // ── Fijar la LÍNEA correcta (funnel o ventas) ────────────────────────────────
  // Si no se fija, el mensaje sale por el número del funnel por defecto. Para una
  // conversación de ventas, ese número "no conoce" al cliente y Meta rechaza el
  // envío con error 131047 (ventana de 24h). Se toma la línea de la conversación.
  try {
    const { data: conv } = await supabase
      .from('conversations').select('linea').eq('id', to).maybeSingle();
    const esVentas = String((conv as any)?.linea ?? '').toLowerCase() === 'ventas';
    const phoneId = esVentas
      ? process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS
      : process.env.WHATSAPP_PHONE_NUMBER_ID;
    entrarLinea({ phoneId: phoneId ?? '', tipo: esVentas ? 'ventas' : 'funnel' });
  } catch { /* si falla, sale por la línea por defecto */ }

  // El id de la conversación puede ser sintético (ej. "573187051499@funnel" para
  // el Soporte por Funnel): el número REAL de WhatsApp es lo que va antes de "@".
  const destinatario = String(to).split('@')[0];

  // Send via WhatsApp Cloud API (citando otro mensaje si es una respuesta)
  const wamid = await sendTextMessage(destinatario, message.trim(), responderA ?? null);
  if (!wamid) {
    return NextResponse.json({ error: 'WhatsApp API error' }, { status: 500 });
  }

  // Store in DB (include whatsapp_id so client replies can be matched)
  const msgId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  await supabase.from('messages').insert({
    id: msgId,
    conversation_id: to,
    content: message.trim(),
    role: 'agent',
    type: 'text',
    whatsapp_id: wamid,
    reply_to: citado ?? null,
    created_at: new Date().toISOString(),
  });

  await supabase.from('conversations').update({
    last_message: message.trim(),
    last_message_time: new Date().toISOString(),
  }).eq('id', to);

  return NextResponse.json({ success: true, id: msgId });
}

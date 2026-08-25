import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendTextMessage } from '@/lib/whatsapp';
import { entrarLinea } from '@/lib/whatsapp-contexto';
import { tenantActual, credsTenant } from '@/lib/tenant';
import { supabaseTenant } from '@/lib/supabase-tenant';

/**
 * POST /api/whatsapp/send
 * Lo llama el panel cuando un asesor escribe una respuesta manual.
 * Envía por la WhatsApp Cloud API y guarda el mensaje en la BD.
 * MULTI-TENANT: usa la empresa de la sesión, su línea y su token.
 */
export async function POST(req: NextRequest) {
  // Debe haber sesión
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'Sin empresa asociada' }, { status: 401 });

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

  const supabase = supabaseTenant(tid);
  const creds = await credsTenant(tid);

  // ── Fijar la LÍNEA correcta (funnel o ventas) con las credenciales del tenant ──
  // Si no se fija, el mensaje saldría por el número por defecto y Meta lo rechaza
  // (error 131047, ventana de 24h). Se toma la línea de la conversación.
  try {
    const { data: conv } = await supabase
      .from('conversations').select('linea').eq('id', to).maybeSingle();
    const esVentas = String((conv as any)?.linea ?? '').toLowerCase() === 'ventas';
    entrarLinea({
      phoneId: (esVentas ? creds?.wa_phone_number_id_ventas : creds?.wa_phone_number_id) ?? '',
      tipo: esVentas ? 'ventas' : 'funnel',
      accessToken: creds?.wa_access_token ?? undefined,
      tenantId: tid,
      phoneIdVentas: creds?.wa_phone_number_id_ventas ?? undefined,
    });
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

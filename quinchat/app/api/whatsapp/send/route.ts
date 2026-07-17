import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendTextMessage } from '@/lib/whatsapp';
import { createServerSupabaseClient } from '@/lib/supabase';

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

  let body: { to: string; message: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { to, message } = body;
  if (!to || !message?.trim()) {
    return NextResponse.json({ error: 'Missing "to" or "message"' }, { status: 400 });
  }

  // Send via WhatsApp Cloud API
  const wamid = await sendTextMessage(to, message.trim());
  if (!wamid) {
    return NextResponse.json({ error: 'WhatsApp API error' }, { status: 500 });
  }

  // Store in DB (include whatsapp_id so client replies can be matched)
  const supabase = createServerSupabaseClient();
  const msgId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  await supabase.from('messages').insert({
    id: msgId,
    conversation_id: to,
    content: message.trim(),
    role: 'agent',
    type: 'text',
    whatsapp_id: wamid,
    created_at: new Date().toISOString(),
  });

  await supabase.from('conversations').update({
    last_message: message.trim(),
    last_message_time: new Date().toISOString(),
  }).eq('id', to);

  return NextResponse.json({ success: true, id: msgId });
}

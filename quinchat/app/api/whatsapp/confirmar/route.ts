import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage } from '@/lib/whatsapp';
import { createServerSupabaseClient } from '@/lib/supabase';

// CORS headers — ConfirmaYa runs on GitHub Pages (different origin)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};

// Preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

/**
 * POST /api/whatsapp/confirmar
 * Called by ConfirmaYa (browser) to send the order confirmation message via WhatsApp bot.
 * Auth: X-API-Key header (shared secret, no session needed).
 */
export async function POST(req: NextRequest) {
  // API key auth — avoids session requirement for ConfirmaYa
  const apiKey = req.headers.get('X-API-Key');
  if (!apiKey || apiKey !== process.env.CONFIRMA_YA_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  let body: { telefono: string; mensaje: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS });
  }

  const { telefono, mensaje } = body;
  if (!telefono || !mensaje?.trim()) {
    return NextResponse.json({ error: 'Falta telefono o mensaje' }, { status: 400, headers: CORS });
  }

  // telefono must be in WA format: "573004362800" (country code + number)
  const waPhone = telefono.startsWith('57') ? telefono : `57${telefono.replace(/\D/g, '').slice(-10)}`;
  const tel10   = waPhone.replace(/^57/, '').slice(-10);

  // Send WhatsApp message via Meta Cloud API
  const sent = await sendTextMessage(waPhone, mensaje.trim());
  if (!sent) {
    return NextResponse.json({ error: 'Error enviando mensaje por WhatsApp' }, { status: 500, headers: CORS });
  }

  // Update clientes_funnelish: mark wa_enviado = true
  const supabase = createServerSupabaseClient();
  await supabase
    .from('clientes_funnelish')
    .update({
      wa_enviado:    true,
      wa_enviado_at: new Date().toISOString(),
      estado:        'wa_enviado',
    })
    .eq('telefono', tel10)
    .eq('confirmado', false);

  // Upsert conversation so it appears in QuinChat chat panel
  const msgId = `bot-confirmar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  await supabase.from('conversations').upsert({
    id:                waPhone,
    contact_name:      tel10,
    last_message:      mensaje.trim().slice(0, 80) + '…',
    last_message_time: now,
    unread_count:      0,
    bot_enabled:       true,
  }, { onConflict: 'id' });

  await supabase.from('messages').insert({
    id:              msgId,
    conversation_id: waPhone,
    content:         mensaje.trim(),
    role:            'assistant',
    type:            'text',
    created_at:      now,
  });

  return NextResponse.json({ success: true, phone: waPhone }, { headers: CORS });
}

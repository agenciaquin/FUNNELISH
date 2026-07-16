import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/whatsapp';
import { chat } from '@/lib/quinchat/claude';
import type { ChatRequest } from '@/lib/quinchat/types';

// ─── GET — Meta webhook verification challenge ─────────────────────────────
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[Webhook] Meta verification OK');
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn('[Webhook] Verification failed — wrong token?');
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ─── POST — Receive incoming WhatsApp messages ─────────────────────────────
export async function POST(req: NextRequest) {
  // Always respond 200 fast; Meta retries if we take >20s
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: 'ok' });
  }

  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  if (!value?.messages?.length) {
    return NextResponse.json({ status: 'ok' });
  }

  const supabase = createServerSupabaseClient();

  for (const msg of value.messages) {
    // Only handle text for now; skip images/audio/etc.
    if (msg.type !== 'text') continue;

    const from: string = msg.from;
    const text: string = msg.text?.body ?? '';
    if (!text.trim()) continue; // skip empty messages
    const contactName: string = value.contacts?.[0]?.profile?.name ?? from;
    const msgId: string = msg.id;

    // ── 1. Upsert conversation ──
    const { data: existing } = await supabase
      .from('conversations')
      .select('unread_count, bot_enabled')
      .eq('id', from)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await supabase.from('conversations').update({
        contact_name: contactName,
        last_message: text,
        last_message_time: new Date().toISOString(),
        unread_count: (existing.unread_count ?? 0) + 1,
      }).eq('id', from);
      if (updErr) console.error('[Supabase] update conversation:', updErr.message);
    } else {
      const { error: insErr } = await supabase.from('conversations').insert({
        id: from,
        contact_name: contactName,
        last_message: text,
        last_message_time: new Date().toISOString(),
        unread_count: 1,
        bot_enabled: true,
      });
      if (insErr) console.error('[Supabase] insert conversation:', insErr.message);
    }

    // ── 2. Store incoming message (idempotent) ──
    const { error: msgErr } = await supabase.from('messages').upsert({
      id: msgId,
      conversation_id: from,
      content: text,
      role: 'user',
      type: 'text',
      created_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (msgErr) console.error('[Supabase] upsert message:', msgErr.message);

    // ── 3. Check if bot is active for this conversation ──
    const botEnabled = existing ? (existing.bot_enabled ?? true) : true;
    if (!botEnabled) continue;

    // ── 3b. CONFIRMO detection — auto-confirm pedido from ConfirmaYa ──
    const textClean = text.trim().toUpperCase();
    const isConfirmo = textClean === 'CONFIRMO'
      || textClean.startsWith('CONFIRMO ')
      || textClean.startsWith('SI CONFIRMO')
      || textClean === 'SI'
      || textClean === 'SÍ'
      || textClean === 'CONFIRMO ✅'
      || textClean === '✅ CONFIRMO';

    if (isConfirmo) {
      // Find the most recent pending pedido for this phone
      const tel10 = from.replace(/^57/, '').slice(-10);
      const { data: pedido } = await supabase
        .from('clientes_funnelish')
        .select('id, nombre, producto')
        .eq('telefono', tel10)
        .eq('wa_enviado', true)
        .eq('confirmado', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pedido) {
        // Mark as confirmed
        await supabase.from('clientes_funnelish').update({
          confirmado:    true,
          confirmado_at: new Date().toISOString(),
          estado:        'confirmado',
        }).eq('id', pedido.id);

        // Update conversation label
        await supabase.from('conversations').update({
          label: 'PEDIDO CONFIRMADO',
        }).eq('id', from);
      }

      // Send fixed confirmation reply (skip Claude)
      const confirmReply = '✅ ¡Perfecto! Tu pedido ha sido *confirmado*. Lo despacharemos en las próximas 24 horas. ¡Gracias por tu compra! 🚚✨';
      const sentConfirm = await sendTextMessage(from, confirmReply);
      if (sentConfirm) {
        const replyId = `bot-confirm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await supabase.from('messages').insert({
          id:              replyId,
          conversation_id: from,
          content:         confirmReply,
          role:            'assistant',
          type:            'text',
          created_at:      new Date().toISOString(),
        });
        await supabase.from('conversations').update({
          last_message:      confirmReply,
          last_message_time: new Date().toISOString(),
        }).eq('id', from);
      }
      continue; // skip Claude for CONFIRMO
    }

    // ── 4. Build context from recent history ──
    const { data: history } = await supabase
      .from('messages')
      .select('content, role')
      .eq('conversation_id', from)
      .order('created_at', { ascending: true })
      .limit(20);

    const chatHistory: ChatRequest['messages'] = (history ?? [])
      .filter((m: any) => m.content?.trim()) // skip empty content
      .map((m: any) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));

    // Fallback: if history is empty (upsert race condition), use current message
    if (chatHistory.length === 0) {
      chatHistory.push({ role: 'user' as const, content: text });
    }

    // ── 5. Generate Claude response ──
    let botReply: string;
    try {
      const resp = await chat({ messages: chatHistory, tenantId: 'klixmant' });
      botReply = resp.message;
    } catch (e) {
      console.error('[Claude error]', e);
      continue;
    }

    // ── 6. Send reply via WhatsApp ──
    const sent = await sendTextMessage(from, botReply);
    if (!sent) continue;

    // ── 7. Store bot reply ──
    const replyId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await supabase.from('messages').insert({
      id: replyId,
      conversation_id: from,
      content: botReply,
      role: 'assistant',
      type: 'text',
      created_at: new Date().toISOString(),
    });

    // Update last message to bot reply
    await supabase.from('conversations').update({
      last_message: botReply,
      last_message_time: new Date().toISOString(),
    }).eq('id', from);
  }

  return NextResponse.json({ status: 'ok' });
}

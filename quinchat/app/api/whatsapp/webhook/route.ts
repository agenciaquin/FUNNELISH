import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage, sendAudioByUrl, sendImageByUrl } from '@/lib/whatsapp';
import { getProductImageUrl, FALLBACK_IMAGE } from '@/lib/product-catalog';
import { chat } from '@/lib/quinchat/claude';
import type { ChatRequest } from '@/lib/quinchat/types';

/** Fetch WhatsApp media URL from Meta (expires after ~5 min, good for real-time display) */
async function getWhatsAppMediaUrl(mediaId: string): Promise<string | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.url as string) ?? null;
  } catch {
    return null;
  }
}

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
    const from: string = msg.from;
    const contactName: string = value.contacts?.[0]?.profile?.name ?? from;
    const msgId: string = msg.id;

    // ── Reacciones del cliente ──────────────────────────────────────────────
    if (msg.type === 'reaction') {
      const emoji: string = msg.reaction?.emoji ?? '👍';
      const { data: existing } = await supabase
        .from('conversations')
        .select('unread_count')
        .eq('id', from)
        .maybeSingle();

      if (existing) {
        await supabase.from('conversations').update({
          last_message: `Reaccionó: ${emoji}`,
          last_message_time: new Date().toISOString(),
          unread_count: (existing.unread_count ?? 0) + 1,
        }).eq('id', from);
      }
      await supabase.from('messages').upsert({
        id: msgId,
        conversation_id: from,
        content: emoji,
        role: 'user',
        type: 'reaction',
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      continue; // skip bot for reactions
    }

    // ── Media entrante del cliente (imagen / audio / video / documento) ──────
    if (msg.type === 'image' || msg.type === 'video' || msg.type === 'audio' || msg.type === 'document') {
      const mediaData = msg[msg.type as 'image' | 'video' | 'audio' | 'document'] as { id?: string; caption?: string; mime_type?: string } | undefined;
      const mediaId   = mediaData?.id;
      const caption   = mediaData?.caption ?? '';
      const metaMime  = mediaData?.mime_type ?? 'application/octet-stream';

      const fallbacks: Record<string, string> = {
        image: '📸 Imagen recibida',
        video: '🎬 Video recibido',
        audio: '🎵 Audio recibido',
        document: '📎 Documento recibido',
      };
      const displayText = caption || fallbacks[msg.type] || '📎 Archivo';

      // Fetch temporary Meta URL, then download bytes and re-upload to Supabase Storage
      let permanentUrl: string | null = null;
      if (mediaId && (msg.type === 'image' || msg.type === 'audio' || msg.type === 'video')) {
        try {
          const metaUrl = await getWhatsAppMediaUrl(mediaId);
          if (metaUrl) {
            const token = process.env.WHATSAPP_ACCESS_TOKEN!;
            const dlRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
            if (dlRes.ok) {
              const dlBuffer = Buffer.from(await dlRes.arrayBuffer());
              const mime = dlRes.headers.get('content-type') ?? metaMime;
              const ext  = mime.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') ?? 'bin';
              const key  = `${from}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
              const { error: upErr } = await supabase.storage
                .from('chat-media')
                .upload(key, dlBuffer, { contentType: mime, upsert: false });
              if (!upErr) {
                const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(key);
                permanentUrl = urlData.publicUrl;
              }
            }
          }
        } catch (e) {
          console.warn('[Webhook] media re-upload failed:', e);
        }
      }

      const { data: existing } = await supabase
        .from('conversations')
        .select('unread_count')
        .eq('id', from)
        .maybeSingle();

      if (existing) {
        await supabase.from('conversations').update({
          contact_name: contactName,
          last_message: displayText,
          last_message_time: new Date().toISOString(),
          unread_count: (existing.unread_count ?? 0) + 1,
        }).eq('id', from);
      } else {
        await supabase.from('conversations').insert({
          id: from,
          contact_name: contactName,
          last_message: displayText,
          last_message_time: new Date().toISOString(),
          unread_count: 1,
          bot_enabled: true,
        });
      }

      await supabase.from('messages').upsert({
        id:              msgId,
        conversation_id: from,
        // Permanent Supabase URL → panel renders <img>/<audio> forever
        content:         permanentUrl ?? displayText,
        role:            'user',
        type:            msg.type,
        created_at:      new Date().toISOString(),
      }, { onConflict: 'id' });
      continue; // skip bot for media
    }

    // ── Texto ────────────────────────────────────────────────────────────────
    if (msg.type !== 'text') continue;

    const text: string = msg.text?.body ?? '';
    if (!text.trim()) continue; // skip empty messages

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

    // ── 2. Resolve reply context (quoted message) ──
    let replyToContent: string | null = null;
    if (msg.context?.id) {
      // Look up the quoted message by its WhatsApp wamid (stored in whatsapp_id)
      // or directly by id (for messages received from clients)
      const { data: quotedMsg } = await supabase
        .from('messages')
        .select('content, type')
        .or(`whatsapp_id.eq.${msg.context.id},id.eq.${msg.context.id}`)
        .maybeSingle();

      if (quotedMsg) {
        // If it's an image with a URL → keep URL so we can show thumbnail
        if ((quotedMsg.type === 'image' || quotedMsg.type === 'video') && quotedMsg.content.startsWith('http')) {
          replyToContent = quotedMsg.content;
        } else if (quotedMsg.type === 'image')    replyToContent = '🖼️ Foto';
        else if (quotedMsg.type === 'audio')      replyToContent = '🎵 Audio';
        else if (quotedMsg.type === 'video')      replyToContent = '🎬 Video';
        else if (quotedMsg.type === 'document')   replyToContent = '📎 Documento';
        else replyToContent = quotedMsg.content;
      } else {
        replyToContent = '💬'; // message not found in DB (e.g. older than history)
      }
    }

    // ── 3. Store incoming message (idempotent) ──
    const { error: msgErr } = await supabase.from('messages').upsert({
      id: msgId,
      conversation_id: from,
      content: text,
      role: 'user',
      type: 'text',
      reply_to: replyToContent,
      created_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (msgErr) console.error('[Supabase] upsert message:', msgErr.message);

    // ── 3. Check if bot is active for this conversation ──
    const botEnabled = existing ? (existing.bot_enabled ?? true) : true;
    if (!botEnabled) continue;

    // ── 3b. ABONO OFICINA / MUNICIPIO — auto-send audio when client asks for office pickup ──
    const AUDIO_OFICINA_URL  = 'https://bjbjqmbuzpyjvcugbusx.supabase.co/storage/v1/object/public/chat-media/audios-bot/abono-oficina.ogg';
    const AUDIO_MUNICIPIO_URL = 'https://bjbjqmbuzpyjvcugbusx.supabase.co/storage/v1/object/public/chat-media/audios-bot/abono-municipio.ogg';

    const textLower = text.toLowerCase();
    const isOficina = textLower.includes('oficina')
      || textLower.includes('reclamar')
      || textLower.includes('interrapidisimo')
      || textLower.includes('interrapidísimo');
    const isMunicipio = textLower.includes('no llega contra entrega')
      || textLower.includes('no hay contra entrega')
      || textLower.includes('zona rural');

    if (isOficina || isMunicipio) {
      const audioUrl = isOficina ? AUDIO_OFICINA_URL : AUDIO_MUNICIPIO_URL;
      const audioLabel = isOficina ? '🎵 Audio abono oficina' : '🎵 Audio abono municipio';
      const now2 = new Date().toISOString();

      // Check if audio was already sent in this conversation
      const { data: existingAudio } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', from)
        .eq('type', 'audio')
        .eq('content', audioUrl)
        .maybeSingle();

      if (!existingAudio) {
        // First time — send the audio
        const audioWamid = await sendAudioByUrl(from, audioUrl);
        if (audioWamid) {
          await supabase.from('messages').insert({
            id:              `bot-audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            conversation_id: from,
            content:         audioUrl,
            role:            'assistant',
            type:            'audio',
            whatsapp_id:     audioWamid,
            created_at:      now2,
          });
          await supabase.from('conversations').update({
            last_message:      audioLabel,
            last_message_time: now2,
          }).eq('id', from);
        }
      } else {
        // Audio already sent — respond with personalized explanation text
        const explicacion = `Te entiendo perfectamente 😊 Si dependiera de mí te lo enviamos sin abono, pero es una política del área de despacho — si el pedido pasa sin el abono ellos lo cancelan y no lo despachan. Los $5.000 son solo para que no sientas inseguridad; no ganaríamos nada quedándonos con eso y dañando nuestra reputación. Cualquier cosita me avisas. ¿Listo? 🙌`;
        const expWamid = await sendTextMessage(from, explicacion);
        if (expWamid) {
          await supabase.from('messages').insert({
            id:              `bot-exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            conversation_id: from,
            content:         explicacion,
            role:            'assistant',
            type:            'text',
            whatsapp_id:     expWamid,
            created_at:      now2,
          });
          await supabase.from('conversations').update({
            last_message:      explicacion.slice(0, 80) + '…',
            last_message_time: now2,
          }).eq('id', from);
        }
      }
      continue; // skip Claude for oficina triggers
    }

    // ── 3c. CONFIRMO detection — auto-confirm pedido from ConfirmaYa ──
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
        .select('id, nombre, producto, talla, direccion, ciudad, departamento')
        .eq('telefono', tel10)
        .eq('wa_enviado', true)
        .eq('confirmado', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // ── Check for missing data before confirming ──────────────────────────
      if (pedido) {
        const missingBeforeConfirm: string[] = [];
        if (!pedido.talla || pedido.talla === 'Por confirmar')
          missingBeforeConfirm.push('talla del buzo (XS, S, M, L, XL, XXL, XXXL)');
        if (!pedido.direccion || pedido.direccion === '—')
          missingBeforeConfirm.push('dirección completa de envío');
        if (!pedido.ciudad || pedido.ciudad === '—')
          missingBeforeConfirm.push('ciudad de envío');
        if (!pedido.departamento || pedido.departamento === '—')
          missingBeforeConfirm.push('departamento');

        if (missingBeforeConfirm.length > 0) {
          // Block confirmation — re-ask for missing data
          const reaskMsg = missingBeforeConfirm.length === 1
            ? `Antes de confirmar necesito que me indiques tu ${missingBeforeConfirm[0]} 📋`
            : `Antes de confirmar necesito que me indiques:\n${missingBeforeConfirm.map(f => `• Tu ${f}`).join('\n')}`;

          const reaskWamid = await sendTextMessage(from, reaskMsg);
          if (reaskWamid) {
            const nowR = new Date().toISOString();
            await supabase.from('messages').insert({
              id:              `bot-reask-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              conversation_id: from,
              content:         reaskMsg,
              role:            'assistant',
              type:            'text',
              whatsapp_id:     reaskWamid,
              created_at:      nowR,
            });
            await supabase.from('conversations').update({
              last_message:      reaskMsg.slice(0, 80),
              last_message_time: nowR,
            }).eq('id', from);
          }
          continue; // don't confirm yet
        }

        // All data complete — mark as confirmed
        await supabase.from('clientes_funnelish').update({
          confirmado:    true,
          confirmado_at: new Date().toISOString(),
          estado:        'confirmado',
        }).eq('id', pedido.id);

        // Update conversation label → VENTA REALIZADA
        await supabase.from('conversations').update({
          label: 'VENTA REALIZADA',
        }).eq('id', from);
      }

      // Send fixed confirmation reply (skip Claude)
      const confirmReply = '✅ ¡Perfecto! Tu pedido ha sido *confirmado*. Lo despacharemos en las próximas 24 horas. ¡Gracias por tu compra! 🚚✨';
      const confirmWamid = await sendTextMessage(from, confirmReply);
      if (confirmWamid) {
        const replyId = `bot-confirm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await supabase.from('messages').insert({
          id:              replyId,
          conversation_id: from,
          content:         confirmReply,
          role:            'assistant',
          type:            'text',
          whatsapp_id:     confirmWamid,
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

    // Load system prompt from bot_config (set via Entrenamiento panel)
    const { data: botCfg } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'system_prompt')
      .maybeSingle();
    const activeSystemPrompt = botCfg?.value ?? undefined;

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
      const resp = await chat({ messages: chatHistory, tenantId: 'klixmant', systemPrompt: activeSystemPrompt });
      botReply = resp.message;
    } catch (e) {
      console.error('[Claude error]', e);
      continue;
    }

    // ── 6. Send reply via WhatsApp ──
    const botWamid = await sendTextMessage(from, botReply);
    if (!botWamid) continue;

    // ── 7. Store bot reply ──
    const replyId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await supabase.from('messages').insert({
      id: replyId,
      conversation_id: from,
      content: botReply,
      role: 'assistant',
      type: 'text',
      whatsapp_id: botWamid,
      created_at: new Date().toISOString(),
    });

    // ── 7b. Auto-send product photo if client requested one ──────────────────
    // Detect photo request in client message OR bot offering to send photo
    const photoRequestWords = ['foto', 'fotos', 'imagen', 'imágen', 'ver el buzo', 'ver buzo',
      'tienes foto', 'como es', 'cómo es', 'me muestras', 'me puedes mostrar'];
    const botOfferedPhoto = botReply.toLowerCase().includes('te comparto')
      || botReply.toLowerCase().includes('te muestro')
      || botReply.toLowerCase().includes('aquí tienes')
      || botReply.toLowerCase().includes('acá tienes')
      || botReply.toLowerCase().includes('te envío la foto')
      || botReply.toLowerCase().includes('te envio la foto');
    const clientAskedPhoto = photoRequestWords.some(w => textLower.includes(w));

    if (clientAskedPhoto || botOfferedPhoto) {
      // Search client's message first, then recent chat history for product name
      const searchPool = [text, ...chatHistory.slice(-8).map(m => m.content)];
      let photoUrl: string | null = null;
      for (const t of searchPool) {
        if (!t?.trim()) continue;
        const url = getProductImageUrl(t);
        if (url && url !== FALLBACK_IMAGE) { photoUrl = url; break; }
      }
      if (photoUrl) {
        const nowImg = new Date().toISOString();
        const imgWamid = await sendImageByUrl(from, photoUrl);
        if (imgWamid) {
          await supabase.from('messages').insert({
            id:              `bot-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            conversation_id: from,
            content:         photoUrl,
            role:            'assistant',
            type:            'image',
            whatsapp_id:     imgWamid,
            created_at:      nowImg,
          });
        }
      }
    }

    // Update last message to bot reply
    await supabase.from('conversations').update({
      last_message: botReply,
      last_message_time: new Date().toISOString(),
    }).eq('id', from);
  }

  return NextResponse.json({ status: 'ok' });
}

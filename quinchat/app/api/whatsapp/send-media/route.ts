import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadWhatsAppMedia, sendMediaMessage, sendTextMessage } from '@/lib/whatsapp';
import { createServerSupabaseClient } from '@/lib/supabase';
import { entrarLinea } from '@/lib/whatsapp-contexto';

/**
 * POST /api/whatsapp/send-media
 * Accepts multipart/form-data: { to, file, caption? }
 * Uploads to Meta + Supabase Storage (permanent URL), sends via WhatsApp, stores in DB.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const to      = formData.get('to') as string | null;
  const file    = formData.get('file') as File | null;
  const caption = formData.get('caption') as string | null;

  if (!to || !file) {
    return NextResponse.json({ error: 'Missing "to" or "file"' }, { status: 400 });
  }

  const mimeType = file.type || 'application/octet-stream';
  const filename = file.name || 'archivo';
  const buffer   = Buffer.from(await file.arrayBuffer());

  // Determine WhatsApp media type
  let waType: 'image' | 'document' | 'audio' | 'video';
  if (mimeType.startsWith('image/'))       waType = 'image';
  else if (mimeType.startsWith('video/'))  waType = 'video';
  else if (mimeType.startsWith('audio/'))  waType = 'audio';
  else                                      waType = 'document';

  const supabase = createServerSupabaseClient();

  // Fijar la línea (funnel/ventas) de la conversación para subir y enviar el
  // media por el número correcto (si no, sale por el funnel y falla 131047).
  try {
    const { data: conv } = await supabase
      .from('conversations').select('linea').eq('id', to).maybeSingle();
    const esVentas = String((conv as any)?.linea ?? '').toLowerCase() === 'ventas';
    const phoneId = esVentas
      ? process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS
      : process.env.WHATSAPP_PHONE_NUMBER_ID;
    entrarLinea({ phoneId: phoneId ?? '', tipo: esVentas ? 'ventas' : 'funnel' });
  } catch { /* si falla, sale por la línea por defecto */ }

  // 1. Upload to Supabase Storage (permanent URL for panel display)
  let permanentUrl: string | null = null;
  if (waType === 'image' || waType === 'audio' || waType === 'video') {
    const ext = mimeType.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') ?? 'bin';
    const storageKey = `${to}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('chat-media')
      .upload(storageKey, buffer, { contentType: mimeType, upsert: false });
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(storageKey);
      permanentUrl = urlData.publicUrl;
    } else {
      console.warn('[Supabase Storage] upload failed:', upErr.message);
    }
  }

  // 1b. VIDEO grande: WhatsApp NO permite videos de más de 16 MB. Si pesa más,
  // se le envía al cliente un ENLACE al video (alojado en storage) para que lo
  // vea igual, en vez de fallar el envío.
  const LIMITE_VIDEO = 16 * 1024 * 1024;
  if (waType === 'video' && buffer.length > LIMITE_VIDEO) {
    if (!permanentUrl) {
      return NextResponse.json({
        error: `El video pesa ${(buffer.length / 1048576).toFixed(1)} MB y no se pudo alojar. Envía uno más corto (menos de 16 MB).`,
      }, { status: 400 });
    }
    const dest = String(to).split('@')[0];
    const texto = `🎬 Aquí puedes ver el video del producto 👇\n${permanentUrl}${caption?.trim() ? `\n\n${caption.trim()}` : ''}`;
    const wamidLink = await sendTextMessage(dest, texto);
    if (!wamidLink) return NextResponse.json({ error: 'No se pudo enviar el enlace del video' }, { status: 500 });

    const msgIdV = `agent-media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await supabase.from('messages').insert({
      id: msgIdV, conversation_id: to, content: permanentUrl,
      caption: caption?.trim() || null, role: 'agent', type: 'video',
      whatsapp_id: wamidLink, created_at: new Date().toISOString(),
    });
    await supabase.from('conversations').update({
      last_message: `🎬 Video${caption?.trim() ? `: ${caption.trim()}` : ''}`,
      last_message_time: new Date().toISOString(),
    }).eq('id', to);
    return NextResponse.json({ success: true, id: msgIdV, type: 'video', media_url: permanentUrl, sentAsLink: true });
  }

  // 2. Upload to WhatsApp (Meta)
  const mediaId = await uploadWhatsAppMedia(buffer, mimeType, filename);
  if (!mediaId) {
    return NextResponse.json({ error: 'Media upload to WhatsApp failed' }, { status: 500 });
  }

  // 3. Send via WhatsApp (el id puede ser sintético; el número real va antes de "@")
  const destinatario = String(to).split('@')[0];
  const wamid = await sendMediaMessage(destinatario, mediaId, waType, {
    caption:  caption ?? undefined,
    filename: waType === 'document' ? filename : undefined,
  });
  if (!wamid) {
    return NextResponse.json({ error: 'WhatsApp send failed' }, { status: 500 });
  }

  // 4. Store in DB
  // content = permanent URL for media (so panel renders image on reload)
  //         = emoji text as fallback (documents or if storage failed)
  const msgId = `agent-media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const dbContent = permanentUrl
    ?? (waType === 'audio'  ? '🎵 Audio'
      : waType === 'image'  ? `🖼️ Imagen${caption ? `: ${caption}` : ''}`
      : waType === 'video'  ? `🎬 Video${caption ? `: ${caption}` : ''}`
      : `📎 ${filename}`);

  const lastMsgText =
    waType === 'audio'  ? '🎵 Audio'
    : waType === 'image'  ? `🖼️ Imagen${caption ? `: ${caption}` : ''}`
    : waType === 'video'  ? `🎬 Video${caption ? `: ${caption}` : ''}`
    : `📎 ${filename}`;

  await supabase.from('messages').insert({
    id:              msgId,
    conversation_id: to,
    content:         dbContent,
    caption:         (waType === 'image' || waType === 'video') ? (caption?.trim() || null) : null,
    role:            'agent',
    type:            waType,
    whatsapp_id:     wamid,
    created_at:      new Date().toISOString(),
  });

  await supabase.from('conversations').update({
    last_message:      lastMsgText,
    last_message_time: new Date().toISOString(),
  }).eq('id', to);

  return NextResponse.json({ success: true, id: msgId, type: waType, media_url: permanentUrl });
}

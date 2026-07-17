import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadWhatsAppMedia, sendMediaMessage } from '@/lib/whatsapp';
import { createServerSupabaseClient } from '@/lib/supabase';

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

  // 2. Upload to WhatsApp (Meta)
  const mediaId = await uploadWhatsAppMedia(buffer, mimeType, filename);
  if (!mediaId) {
    return NextResponse.json({ error: 'Media upload to WhatsApp failed' }, { status: 500 });
  }

  // 3. Send via WhatsApp
  const wamid = await sendMediaMessage(to, mediaId, waType, {
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

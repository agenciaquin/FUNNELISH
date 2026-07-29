import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendImageByUrl, sendVideoByUrl, sendAudioByUrl } from '@/lib/whatsapp';
import { createServerSupabaseClient } from '@/lib/supabase';
import { entrarLinea } from '@/lib/whatsapp-contexto';

/**
 * Envía media que YA está en una URL pública (subida directa a Supabase desde el
 * navegador, saltándose el tope de 4.5 MB de Vercel). Sirve para videos grandes.
 * POST { to, url, type: 'image'|'video'|'audio', caption? }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { to: string; url: string; type: 'image' | 'video' | 'audio'; caption?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { to, url, type, caption } = body;
  if (!to || !url || !type) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });

  const supabase = createServerSupabaseClient();

  // Línea correcta (funnel/ventas) para no fallar con 131047
  try {
    const { data: conv } = await supabase.from('conversations').select('linea').eq('id', to).maybeSingle();
    const esVentas = String((conv as any)?.linea ?? '').toLowerCase() === 'ventas';
    const phoneId = esVentas ? process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS : process.env.WHATSAPP_PHONE_NUMBER_ID;
    entrarLinea({ phoneId: phoneId ?? '', tipo: esVentas ? 'ventas' : 'funnel' });
  } catch { /* línea por defecto */ }

  // El id puede ser sintético (ej. "…@funnel"): el número real va antes de "@".
  const destinatario = String(to).split('@')[0];
  let wamid: string | null = null;
  if (type === 'video')      wamid = await sendVideoByUrl(destinatario, url, caption);
  else if (type === 'image') wamid = await sendImageByUrl(destinatario, url, caption);
  else if (type === 'audio') wamid = await sendAudioByUrl(destinatario, url);

  if (!wamid) {
    return NextResponse.json({ error: 'WhatsApp no aceptó el archivo (revisa formato/tamaño).' }, { status: 500 });
  }

  // Guardar en el chat
  const msgId = `agent-url-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const etiqueta = type === 'video' ? `🎬 Video${caption ? `: ${caption}` : ''}`
                 : type === 'image' ? `🖼️ Imagen${caption ? `: ${caption}` : ''}`
                 : '🎵 Audio';
  await supabase.from('messages').insert({
    id: msgId, conversation_id: to, content: url, role: 'agent', type,
    caption: caption?.trim() || null,
    whatsapp_id: wamid, created_at: new Date().toISOString(),
  });
  await supabase.from('conversations').update({
    last_message: etiqueta, last_message_time: new Date().toISOString(),
  }).eq('id', to);

  return NextResponse.json({ success: true, id: msgId, media_url: url });
}

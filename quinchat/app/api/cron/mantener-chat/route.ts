import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendMantenerChatTemplate } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/**
 * Mantiene ABIERTA la ventana de 24h con los números de registro de ventas.
 *
 * WhatsApp solo deja que el bot les mande mensajes normales (los registros de
 * cada venta) si esos números le escribieron en las últimas 24h. Este cron les
 * envía una plantilla cada ~22h para recordarles que respondan y no se cierre.
 *
 * Se recomienda ejecutarlo cada hora (cron-job.org). Solo envía a cada número si
 * ya pasaron 22h desde el último recordatorio, así no se satura.
 */

// Números a los que llega el registro de ventas (mantener su ventana abierta).
const ADMINS_VENTAS = ['573167648391', '573187051499'];
const HORAS_22 = 22 * 3_600_000;

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sin secret configurado, no bloquea (dev)
  const bearer = req.headers.get('authorization') === `Bearer ${secret}`;
  const query  = req.nextUrl.searchParams.get('secret') === secret;
  return bearer || query;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const ahora = Date.now();
  let enviados = 0;
  const detalle: Record<string, string> = {};

  for (const numero of ADMINS_VENTAS) {
    // ¿Cuándo se le envió el último recordatorio? (se marca en messages)
    const { data: ultimo } = await supabase
      .from('messages')
      .select('created_at')
      .eq('conversation_id', numero)
      .like('id', 'keepalive-%')
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();

    const last = ultimo?.created_at ? new Date(ultimo.created_at).getTime() : 0;
    if (ahora - last < HORAS_22) { detalle[numero] = 'aun-no-toca'; continue; }

    const wamid = await sendMantenerChatTemplate(numero);
    if (wamid) {
      await supabase.from('messages').insert({
        id:              `keepalive-${ahora}-${Math.random().toString(36).slice(2, 7)}`,
        conversation_id: numero,
        content:         '[keepalive] recordatorio para mantener la ventana de 24h abierta',
        role:            'assistant',
        type:            'text',
        whatsapp_id:     wamid,
        created_at:      new Date().toISOString(),
      });
      enviados++;
      detalle[numero] = 'enviado';
    } else {
      detalle[numero] = 'fallo-envio';
    }
  }

  return NextResponse.json({ status: 'ok', enviados, detalle });
}

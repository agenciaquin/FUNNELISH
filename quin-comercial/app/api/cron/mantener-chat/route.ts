import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendMantenerChatTemplate } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/**
 * Mantiene ABIERTA la ventana de 24h con los números de registro de ventas.
 *
 * ⚠️ ESTE CRON SÍ GASTA EN PLANTILLAS DE PAGO. Un "keepalive" por naturaleza se
 * dispara tras 24h de silencio, y WhatsApp en ese punto SOLO permite plantillas
 * (mensaje de pago). No existe una versión gratis. Por la regla comercial de
 * "no gastar en plantillas por envío", queda APAGADO por defecto.
 *
 * Para activarlo en un cliente que sí lo quiera, en Vercel:
 *   MANTENER_CHAT=on
 *   MANTENER_CHAT_NUMEROS=573167648391,573187051499   (números separados por coma)
 *
 * Se recomienda ejecutarlo cada hora (cron-job.org). Solo envía a cada número si
 * ya pasaron 22h desde el último recordatorio, así no se satura.
 */

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

  // ── APAGADO por defecto (gasta en plantillas). Se activa a propósito. ───────
  if (process.env.MANTENER_CHAT !== 'on') {
    return NextResponse.json({ status: 'apagado', motivo: 'usa plantillas de pago; activar con MANTENER_CHAT=on' });
  }

  // Números configurables (nunca hardcodeados). Sin configuración, no hace nada.
  const ADMINS_VENTAS = String(process.env.MANTENER_CHAT_NUMEROS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (ADMINS_VENTAS.length === 0) {
    return NextResponse.json({ status: 'sin-numeros', motivo: 'define MANTENER_CHAT_NUMEROS=coma,separados' });
  }

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

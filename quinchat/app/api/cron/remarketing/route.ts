import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendRecordatorioTemplate } from '@/lib/whatsapp';

// Motor de remarketing de pedidos pendientes por confirmar.
// Se ejecuta por cron (ver vercel.json) cada hora.
// Reglas:
//  - 1er recordatorio: 4h después de enviado el pedido (si sigue pendiente).
//  - 2do recordatorio: ~al día siguiente (>=20h después del 1ro).
//  - Solo entre 6:00 y 22:00 hora Colombia (UTC-5).
//  - NO recuerda si el cliente ya confirmó, canceló o programó el pedido.
//  - Tras el 2do recordatorio sin respuesta → etiqueta HUMANO (revisión humana).

const HORAS = (h: number) => h * 3_600_000;
const SKIP_LABELS = ['PEDIDO CANCELADO', 'PEDIDO PROGRAMADO', 'VENTA REALIZADA', 'ANULADO EN EFFI'];

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // si no hay secret configurado, no bloquea (dev)
  const bearer = req.headers.get('authorization') === `Bearer ${secret}`;
  const query  = req.nextUrl.searchParams.get('secret') === secret;
  return bearer || query;
}

async function guardarMensajeBot(supabase: any, waPhone: string, texto: string, wamid: string | null) {
  const now = new Date().toISOString();
  await supabase.from('messages').insert({
    id: `remarketing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    conversation_id: waPhone, content: texto, role: 'assistant', type: 'text',
    whatsapp_id: wamid, created_at: now,
  });
  await supabase.from('conversations').update({ last_message: texto.slice(0, 100), last_message_time: now, unread_count: 0 }).eq('id', waPhone);
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  // Ventana horaria Colombia (UTC-5)
  const now     = new Date();
  const colHour = (now.getUTCHours() + 24 - 5) % 24;
  if (colHour < 6 || colHour >= 22) {
    return NextResponse.json({ status: 'fuera-de-horario', colHour });
  }

  const supabase = createServerSupabaseClient();
  const hace3dias = new Date(now.getTime() - HORAS(72)).toISOString();

  // Pedidos enviados, no confirmados, recientes
  const { data: pend, error } = await supabase
    .from('clientes_funnelish')
    .select('id, telefono, nombre, producto, wa_enviado_at, remarketing_1_at, remarketing_2_at')
    .eq('confirmado', false)
    .eq('wa_enviado', true)
    .gte('wa_enviado_at', hace3dias)
    .limit(60);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let enviados1 = 0, enviados2 = 0, escalados = 0, saltados = 0;

  for (const p of pend ?? []) {
    const tel10   = String(p.telefono).replace(/^57/, '').slice(-10);
    const waPhone = `57${tel10}`;

    // Estado de la conversación (etiqueta)
    const { data: conv } = await supabase
      .from('conversations').select('label').eq('id', waPhone).maybeSingle();
    const label = (conv?.label ?? '').toUpperCase();
    if (SKIP_LABELS.some(l => label.includes(l)) || label.includes('HUMANO')) { saltados++; continue; }

    const enviadoAt = p.wa_enviado_at ? new Date(p.wa_enviado_at).getTime() : 0;
    const rm1 = p.remarketing_1_at ? new Date(p.remarketing_1_at).getTime() : 0;
    const rm2 = p.remarketing_2_at ? new Date(p.remarketing_2_at).getTime() : 0;
    const ahora = now.getTime();

    // 1er recordatorio: 4h después de enviado
    if (!rm1 && enviadoAt && ahora - enviadoAt >= HORAS(4)) {
      const wamid = await sendRecordatorioTemplate(waPhone, String(p.nombre || '').split(' ')[0] || 'hola');
      if (wamid) {
        await supabase.from('clientes_funnelish').update({ remarketing_1_at: now.toISOString() }).eq('id', p.id);
        await guardarMensajeBot(supabase, waPhone, `😊 ¡Hola! ¿Me confirmas si todos los datos están correctos para despacharte tu pedido de *${p.producto}*? 🚚`, wamid);
        enviados1++;
      }
      continue;
    }

    // 2do recordatorio: >=20h después del 1ro
    if (rm1 && !rm2 && ahora - rm1 >= HORAS(20)) {
      const wamid = await sendRecordatorioTemplate(waPhone, String(p.nombre || '').split(' ')[0] || 'hola');
      if (wamid) {
        await supabase.from('clientes_funnelish').update({ remarketing_2_at: now.toISOString() }).eq('id', p.id);
        await guardarMensajeBot(supabase, waPhone, `😊 ¿Me confirmas si todos los datos están correctos para despacharte tu pedido de *${p.producto}*? 🚚`, wamid);
        enviados2++;
      }
      continue;
    }

    // Tras el 2do recordatorio, >=20h sin respuesta → a revisión humana (agrega HUMANO sin quitar el estado)
    if (rm2 && ahora - rm2 >= HORAS(20)) {
      const labs: string[] = label ? String(label).split('|').map((s: string) => s.trim()).filter(Boolean) : [];
      if (!labs.map((l: string) => l.toUpperCase()).includes('HUMANO')) {
        await supabase.from('conversations')
          .update({ label: [...new Set([...labs, 'HUMANO'])].join(' | ') }).eq('id', waPhone);
      }
      escalados++;
      continue;
    }
  }

  return NextResponse.json({
    status: 'ok', revisados: pend?.length ?? 0, enviados1, enviados2, escalados, saltados,
  });
}

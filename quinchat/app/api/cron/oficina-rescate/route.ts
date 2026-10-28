import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/whatsapp';
import { conLinea, tipoDeLinea } from '@/lib/whatsapp-contexto';
import { esVendedor } from '@/lib/vendedores';
import { CUESTIONARIO_OFICINA } from '@/lib/cuestionario-oficina';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * OFICINA SIN ABONO → CUESTIONARIO (dentro de la ventana de 24h, GRATIS).
 * Regla del negocio: oficina lleva abono de $5.000. Si el cliente pasa más de
 * 5 h sin responder al mensaje del abono, se le envía el cuestionario de
 * contraentrega sin abono (5 preguntas). Cuando lo responde, el webhook lo
 * etiqueta "OFICINA REVISAR HUMANO" y apaga el bot para revisión manual.
 * Se manda UNA sola vez por pedido (oficina_rescate_at).
 *
 * Ventana: entre 5h y 23.5h desde el último mensaje del cliente.
 * Se ejecuta cada ~30 min por cron-job.org.
 */

// Mensaje: el cuestionario de contraentrega sin abono (regla del negocio).
const MSG_RESCATE = (_nombre: string) => CUESTIONARIO_OFICINA;

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const numeroFunnel = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const numeroVentas = process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS;
  const supabase = createServerSupabaseClient();
  const now = Date.now();

  // Horario Colombia razonable (8:00–21:00)
  const colHour = new Date(now - 5 * 3_600_000).getUTCHours();
  if (colHour < 8 || colHour >= 21) return NextResponse.json({ ok: true, nota: 'fuera-de-horario', colHour });

  // Candidatos: etiquetados OFICINA SIN ABONO, bot prendido, sin rescate previo.
  const desde26h = new Date(now - 26 * 3_600_000).toISOString();
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, contact_name, label, linea, oficina_rescate_at')
    .or('label.ilike.%OFICINA SIN ABONO%,label.ilike.%PENDIENTE DE ABONO%')
    .neq('bot_enabled', false)
    .is('oficina_rescate_at', null)
    .gte('last_message_time', desde26h)
    .limit(80);

  if (!convs?.length) return NextResponse.json({ ok: true, enviados: 0 });

  let enviados = 0, revisados = 0;
  for (const c of convs) {
    revisados++;
    const from = String(c.id);
    if (esVendedor(from)) continue;

    // Último mensaje del CLIENTE, para saber si la ventana de 24h sigue abierta.
    const { data: ultCli } = await supabase.from('messages')
      .select('created_at').eq('conversation_id', from).eq('role', 'user')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!ultCli) continue;
    const horas = (now - new Date(ultCli.created_at).getTime()) / 3_600_000;
    if (horas < 5 || horas > 23.5) continue; // aún dentro de las 5 h, o ventana ya cerrada

    // Ya abonó, ya está en revisión o ya se vendió → no se manda.
    if (/OFICINA CON ABONO|ABONO POR VERIFICAR|OFICINA REVISAR HUMANO|VENTA REALIZADA|PEDIDO CANCELADO/i.test(String((c as any).label ?? ''))) continue;
    const tel10 = from.replace(/^57/, '').slice(-10);
    const { data: abonado } = await supabase.from('clientes_funnelish')
      .select('id').eq('telefono', tel10).eq('abono_recibido', true)
      .gte('created_at', new Date(now - 7 * 86_400_000).toISOString()).limit(1).maybeSingle();
    if (abonado) continue;
    // El cliente se quedó callado: lo último del chat debe ser nuestro.
    const { data: ultimo } = await supabase.from('messages')
      .select('role, type').eq('conversation_id', from)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!ultimo || ultimo.role === 'user') continue;

    const phoneId = String((c as any).linea) === 'ventas' ? numeroVentas : numeroFunnel;
    if (!phoneId) continue;

    const nombre = String((c as any).contact_name ?? '').split(' ')[0] || '';
    const texto = MSG_RESCATE(nombre);

    const ok = await conLinea({ phoneId, tipo: tipoDeLinea(phoneId) }, async () => {
      const wamid = await sendTextMessage(from, texto);
      if (!wamid) return false;
      const iso = new Date().toISOString();
      await supabase.from('messages').insert({
        id: `rescate-ofi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        conversation_id: from, content: texto, role: 'assistant', type: 'text',
        whatsapp_id: wamid, created_at: iso,
      });
      await supabase.from('conversations').update({
        oficina_rescate_at: iso, last_message: texto.slice(0, 100), last_message_time: iso, unread_count: 0,
      }).eq('id', from);
      return true;
    });
    if (ok) enviados++;
  }

  return NextResponse.json({ ok: true, enviados, revisados });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/whatsapp';
import { conLinea, tipoDeLinea } from '@/lib/whatsapp-contexto';
import { esVendedor } from '@/lib/vendedores';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * RESCATE DE PEDIDOS DE OFICINA (dentro de la ventana de 24h, GRATIS).
 * A los pedidos etiquetados "OFICINA SIN ABONO" (oficina exige abono en nuestro
 * modelo) se les ofrece cambiar a domicilio para NO tener que abonar — así se
 * salvan los que no quieren/pueden abonar. Se manda UNA sola vez por pedido.
 *
 * Ventana: entre 2h y 23.5h desde el último mensaje del cliente (para que sí
 * entregue como mensaje libre). Se ejecuta cada ~30 min por cron-job.org.
 */

const MSG_RESCATE = (nombre: string) =>
  `¡Hola${nombre ? ' ' + nombre : ''}! 😊 Para enviarte tu pedido a la *oficina* necesitamos un abono de *$5.000*.\n` +
  `Pero si prefieres, cámbialo a una *dirección de tu casa*: envíamela completa y así *no necesitas abonar* 🙌\n` +
  `Te llega directo con *pago contra entrega* 🚚 ¿Te lo cambiamos a domicilio?`;

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
    .ilike('label', '%OFICINA SIN ABONO%')
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
    if (horas < 2 || horas > 23.5) continue; // muy pronto, o ventana ya cerrada

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

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/whatsapp';
import { conLinea, tipoDeLinea } from '@/lib/whatsapp-contexto';
import { esVendedor } from '@/lib/vendedores';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Frases variadas, para que el recordatorio no suene igual a todos
const RECORDATORIOS = [
  '¡Hola! 👋 Nos quedan las *últimas unidades* de tu buzo. Si aún lo deseas, me avisas y proceso tu compra 🚚',
  '¡Hola! 🔥 Tenemos las *últimas unidades* disponibles. Si todavía quieres el tuyo, me avisas y lo dejo listo para despacho 🙌',
  '¡Hola! 😊 Todavía tengo disponible el buzo que viste, pero van quedando *pocas unidades*. Si aún lo quieres, me avisas para procesar tu compra 🚚',
];

/**
 * Recordatorio de ventas: le escribe UNA sola vez, a las ~5 horas, al cliente
 * que quedó a mitad de la conversación y no volvió a responder.
 * Se llama desde un cron externo (cron-job.org) cada cierto tiempo.
 */
export async function GET(req: NextRequest) {
  const numeroVentas = process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS;
  if (!numeroVentas) return NextResponse.json({ ok: true, nota: 'No hay número de ventas configurado.' });

  const supabase = createServerSupabaseClient();
  const ahora   = Date.now();
  const hace5h  = new Date(ahora - 5 * 60 * 60 * 1000).toISOString();
  const hace48h = new Date(ahora - 48 * 60 * 60 * 1000).toISOString();

  // Chats de VENTAS parados entre 5 y 48 horas, con el bot prendido y sin recordatorio previo
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, contact_name, label')
    .eq('linea', 'ventas')
    .neq('bot_enabled', false)
    .is('seguimiento_enviado', null)
    .lte('last_message_time', hace5h)
    .gte('last_message_time', hace48h)
    .limit(40);

  if (!convs?.length) return NextResponse.json({ ok: true, enviados: 0 });

  let enviados = 0;
  await conLinea({ phoneId: numeroVentas, tipo: tipoDeLinea(numeroVentas) }, async () => {
    for (const c of convs) {
      // NUNCA a los VENDEDORES del equipo (por su número o su etiqueta): a ellos
      // el bot QUINO los supervisa, no se les hace remarketing de cliente.
      if (esVendedor(String(c.id)) || String((c as any).label ?? '').toUpperCase().includes('VENDEDOR')) {
        await supabase.from('conversations').update({ seguimiento_enviado: true }).eq('id', c.id);
        continue;
      }

      // El último mensaje debe ser del bot (el cliente se quedó callado)
      const { data: ult } = await supabase.from('messages')
        .select('role').eq('conversation_id', c.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!ult || ult.role === 'user') { // el cliente ya respondió: no molestar
        await supabase.from('conversations').update({ seguimiento_enviado: true }).eq('id', c.id);
        continue;
      }

      // Si ya tiene pedido confirmado, no se le recuerda
      const tel = String(c.id).replace(/^57/, '').slice(-10);
      const { data: pedido } = await supabase.from('clientes_funnelish')
        .select('id').eq('telefono', tel).eq('confirmado', true).limit(1).maybeSingle();
      if (pedido) {
        await supabase.from('conversations').update({ seguimiento_enviado: true }).eq('id', c.id);
        continue;
      }

      const texto = RECORDATORIOS[Math.floor(Math.random() * RECORDATORIOS.length)];
      const wamid = await sendTextMessage(c.id, texto);
      await supabase.from('messages').insert({
        id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        conversation_id: c.id, content: texto, role: 'assistant', type: 'text',
        whatsapp_id: wamid, created_at: new Date().toISOString(),
      });
      await supabase.from('conversations')
        .update({ seguimiento_enviado: true, last_message: texto.slice(0, 100), last_message_time: new Date().toISOString(), unread_count: 0 })
        .eq('id', c.id);
      enviados++;
    }
  });

  return NextResponse.json({ ok: true, enviados });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/whatsapp';
import { conLinea, tipoDeLinea } from '@/lib/whatsapp-contexto';
import { esVendedor } from '@/lib/vendedores';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// UN solo recordatorio, personalizado, para quien recibió el FORMULARIO DE DATOS
// de envío y no respondió. Nada de descuentos ni de "últimas unidades" masivos.
const RECORDATORIOS = [
  (n: string) => `¡Hola${n ? ` ${n}` : ''}! 😊 Quedé pendiente de tus *datos de envío* para dejar tu pedido listo y despacharlo. ¿Seguimos? 🚚`,
  (n: string) => `¡Hola${n ? ` ${n}` : ''}! 👋 Solo me faltan tus *datos* para procesar tu pedido y enviártelo. Cuando quieras me los pasas y lo dejo listo 🙌`,
];

// Señal de que el bot pidió los DATOS de envío (o la confirmación con los datos).
const ES_FORMULARIO = /datos de env|datos para el env|nombre completo|celular:|direcci[oó]n:|responde:? *confirmo|confirma (que )?estos datos/i;
// Señal de que el cliente NO está interesado → no se le vuelve a escribir.
const NO_INTERESADO = /no me interesa|no gracias|ya no (lo )?quiero|no lo quiero|no deseo|no quiero nada|ya compr|dejal[oa] as[ií]/i;

/**
 * Recordatorio de ventas: le escribe UNA sola vez, dentro de la ventana de 24 h,
 * al cliente que recibió el FORMULARIO DE DATOS y no respondió. No molesta a
 * quien no mostró interés ni a quien ya compró. Se llama desde un cron externo.
 */
export async function GET(req: NextRequest) {
  const numeroVentas = process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS;
  if (!numeroVentas) return NextResponse.json({ ok: true, nota: 'No hay número de ventas configurado.' });

  const ahora = Date.now();
  // Solo en horario Colombia razonable (8:00–21:00): nada de mensajes de madrugada.
  const colHour = new Date(ahora - 5 * 3_600_000).getUTCHours();
  if (colHour < 8 || colHour >= 21) return NextResponse.json({ ok: true, nota: 'fuera-de-horario', colHour });

  const supabase = createServerSupabaseClient();
  const hace3h  = new Date(ahora - 3 * 3_600_000).toISOString();
  const hace23h = new Date(ahora - 23 * 3_600_000).toISOString(); // margen dentro de las 24h

  // Chats de VENTAS parados entre 3 y 23 h, bot prendido y sin recordatorio previo.
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, contact_name, label')
    .eq('linea', 'ventas')
    .neq('bot_enabled', false)
    .is('seguimiento_enviado', null)
    .lte('last_message_time', hace3h)
    .gte('last_message_time', hace23h)
    .limit(40);

  if (!convs?.length) return NextResponse.json({ ok: true, enviados: 0 });

  let enviados = 0, saltados = 0;
  await conLinea({ phoneId: numeroVentas, tipo: tipoDeLinea(numeroVentas) }, async () => {
    for (const c of convs) {
      const marcar = () => supabase.from('conversations').update({ seguimiento_enviado: true }).eq('id', c.id);

      // Vendedores del equipo: nunca.
      if (esVendedor(String(c.id)) || String((c as any).label ?? '').toUpperCase().includes('VENDEDOR')) { await marcar(); saltados++; continue; }
      // Marcado como cancelado/no interesado en la etiqueta: no molestar.
      if (/CANCELAD|ANULAD|NO INTERES/.test(String((c as any).label ?? '').toUpperCase())) { await marcar(); saltados++; continue; }

      // Últimos mensajes del chat (para ver quién habló de último y si pidió datos).
      const { data: msgs } = await supabase.from('messages')
        .select('role, content, created_at').eq('conversation_id', c.id)
        .order('created_at', { ascending: false }).limit(8);
      const lista = msgs ?? [];
      const ultimo = lista[0];

      // El último debe ser del BOT (el cliente se quedó callado).
      if (!ultimo || ultimo.role === 'user') { await marcar(); saltados++; continue; }

      // El bot debió pedir los DATOS de envío (o mandar la confirmación con datos).
      const pidioDatos = lista.some(m => m.role !== 'user' && ES_FORMULARIO.test(String(m.content ?? '')));
      if (!pidioDatos) { await marcar(); saltados++; continue; }

      // El cliente mostró desinterés → no se le escribe.
      if (lista.some(m => m.role === 'user' && NO_INTERESADO.test(String(m.content ?? '')))) { await marcar(); saltados++; continue; }

      // Ventana de 24h: su último mensaje ENTRANTE debe ser de hace menos de 24h.
      const ultCli = lista.find(m => m.role === 'user');
      if (!ultCli || (ahora - new Date(ultCli.created_at).getTime()) > 24 * 3_600_000) { await marcar(); saltados++; continue; }

      // Ya compró → no recordar.
      const tel = String(c.id).replace(/^57/, '').slice(-10);
      const { data: pedido } = await supabase.from('clientes_funnelish')
        .select('id').eq('telefono', tel).eq('confirmado', true).limit(1).maybeSingle();
      if (pedido) { await marcar(); saltados++; continue; }

      const nombre = String((c as any).contact_name ?? '').split(' ')[0] || '';
      const texto = RECORDATORIOS[Math.floor(Math.random() * RECORDATORIOS.length)](nombre);
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

  return NextResponse.json({ ok: true, enviados, saltados });
}

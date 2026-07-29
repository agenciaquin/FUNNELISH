import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/whatsapp';
import { conLinea, tipoDeLinea } from '@/lib/whatsapp-contexto';
import { esVendedor } from '@/lib/vendedores';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * PROMO DE CIERRE (chat de VENTAS): al día siguiente, JUSTO ANTES de que se cierre
 * la ventana de 24h de WhatsApp, le manda a los clientes que NO compraron una promo
 * corta con $10.000 de descuento válido SOLO ese día, con llamado a la acción.
 *
 * Por qué "antes de las 24h": pasado ese punto WhatsApp ya no deja enviar mensajes
 * libres (solo plantillas). Por eso se dispara cuando el último mensaje del CLIENTE
 * lleva entre ~20h y ~23.5h — así el mensaje sí le llega.
 *
 * Se ejecuta cada ~30 min por cron-job.org.
 */

// Mensajes cortos, con descuento y CTA. Se rota para no sonar igual a todos.
const PROMOS = [
  '¡Hola! 👋 Solo por *HOY* te dejo *$10.000 de descuento* en tu buzo 🔥\n¿Te lo aparto? Dime tu *talla y color* y lo dejo listo para despacho 🚚',
  '🔥 *Solo hoy*: $10.000 OFF en el buzo que viste.\nSi confirmas hoy te lo despacho ya 🚚 ¿Cuál *talla y color* quieres? 😊',
  '¡${nombre}! 🎁 Hoy tienes *$10.000 de descuento* — pero solo por hoy.\n¿Lo aprovechas? Mándame *talla y color* y cerramos tu pedido 🙌',
];

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const numeroVentas = process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS;
  if (!numeroVentas) return NextResponse.json({ ok: true, nota: 'No hay número de ventas configurado.' });

  const supabase = createServerSupabaseClient();
  const now = Date.now();

  // Solo en horario Colombia razonable (8:00–21:00), para no escribir de madrugada.
  const colHour = new Date(now - 5 * 3_600_000).getUTCHours();
  if (colHour < 8 || colHour >= 21) return NextResponse.json({ ok: true, nota: 'fuera-de-horario', colHour });

  // Candidatos: chats de ventas activos, con el bot prendido, sin promo previa.
  const desde26h = new Date(now - 26 * 3_600_000).toISOString();
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, contact_name, label, promo_cierre_at')
    .eq('linea', 'ventas')
    .neq('bot_enabled', false)
    .is('promo_cierre_at', null)
    .gte('last_message_time', desde26h)
    .limit(60);

  if (!convs?.length) return NextResponse.json({ ok: true, enviados: 0 });

  let enviados = 0, revisados = 0;
  await conLinea({ phoneId: numeroVentas, tipo: tipoDeLinea(numeroVentas) }, async () => {
    for (const c of convs) {
      revisados++;
      const from = String(c.id);

      // Nunca a los vendedores del equipo
      if (esVendedor(from) || String((c as any).label ?? '').toUpperCase().includes('VENDEDOR')) continue;

      // Ya compró (venta realizada / pedido confirmado) → no se le ofrece promo
      const lab = String((c as any).label ?? '').toUpperCase();
      if (lab.includes('VENTA REALIZADA')) continue;
      const tel = from.replace(/^57/, '').slice(-10);
      const { data: pedido } = await supabase.from('clientes_funnelish')
        .select('id').eq('telefono', tel).eq('confirmado', true).limit(1).maybeSingle();
      if (pedido) continue;

      // Último mensaje del CLIENTE (entrante) para saber cuánto falta para cerrar la ventana
      const { data: ultCli } = await supabase.from('messages')
        .select('created_at').eq('conversation_id', from).eq('role', 'user')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!ultCli) continue; // nunca escribió: no hay ventana abierta
      const horas = (now - new Date(ultCli.created_at).getTime()) / 3_600_000;

      // Ventana: entre 20h y 23.5h desde el último mensaje del cliente.
      // Antes de 20h todavía no es "justo antes de cerrar"; pasado 23.5h ya no
      // alcanza a entregarse como mensaje libre.
      if (horas < 20 || horas > 23.5) continue;

      const nombre = String((c as any).contact_name ?? '').split(' ')[0] || '';
      const plantilla = PROMOS[Math.floor(Math.random() * PROMOS.length)];
      const texto = plantilla.replace('${nombre}', nombre || 'Hola');

      const wamid = await sendTextMessage(from, texto);
      if (wamid) {
        const iso = new Date().toISOString();
        await supabase.from('messages').insert({
          id: `promo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          conversation_id: from, content: texto, role: 'assistant', type: 'text',
          whatsapp_id: wamid, created_at: iso,
        });
        await supabase.from('conversations').update({
          promo_cierre_at: iso, last_message: texto.slice(0, 100), last_message_time: iso, unread_count: 0,
        }).eq('id', from);
        enviados++;
      }
    }
  });

  return NextResponse.json({ ok: true, enviados, revisados });
}

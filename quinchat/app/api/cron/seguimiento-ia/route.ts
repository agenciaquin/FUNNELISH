import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/whatsapp';
import { entrarLinea } from '@/lib/whatsapp-contexto';
import { chat } from '@/lib/quinchat/claude';
import { esVendedor } from '@/lib/vendedores';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * SEGUIMIENTO IA: reactiva los leads del chat de VENTAS que se quedaron a medias
 * y no cerraron. La IA lee dónde quedó la conversación y manda UN mensaje corto
 * para retomarla y llevar al cliente al cierre.
 *
 * Reglas:
 *  - Solo chats de la línea 'ventas', con el bot encendido y sin venta cerrada.
 *  - Solo DENTRO de las 24h (último mensaje del cliente < 24h): así se puede
 *    escribir libre sin plantilla. Los de +24h y la recompra van en otra fase.
 *  - 1er intento: 3h de silencio. 2º intento: 6h después del 1º si sigue callado.
 *  - Máximo 2 intentos por cliente (columna seguimiento_n).
 *  - En horario Colombia 8:00–21:00.
 */

const H = (n: number) => n * 3_600_000;
const SKIP = ['VENTA REALIZADA', 'ANULADO EN EFFI', 'PEDIDO PROGRAMADO', 'PEDIDO CANCELADO', 'HUMANO', 'VENDEDOR', 'ABONO POR VERIFICAR'];
const SILENCIO_1 = 3;   // horas de silencio para el 1er mensaje
const ESPERA_2   = 6;   // horas tras el 1º para el 2º
const MAX_INTENTOS = 2;

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  // ── INTERRUPTOR: seguimiento con IA APAGADO para ahorrar costo ──────────────
  // El seguimiento ahora se hace SOLO con la promo gratis dentro de 24h
  // (cron promo-cierre), que no usa IA. Para reactivar este, pon en Vercel la
  // variable de entorno:  SEGUIMIENTO_IA=on
  if (process.env.SEGUIMIENTO_IA !== 'on') {
    return NextResponse.json({ status: 'apagado', motivo: 'seguimiento-ia desactivado para ahorrar IA' });
  }

  if (!autorizado(req)) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }

  const now = Date.now();
  const colHour = new Date(now - H(5)).getUTCHours();
  if (colHour < 8 || colHour >= 21) {
    return NextResponse.json({ status: 'fuera-de-horario', colHour });
  }

  // Responder por la línea de ventas
  entrarLinea({
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    tipo: 'ventas',
  });

  const supabase = createServerSupabaseClient();

  // Candidatos: chats de ventas activos en las últimas 24h, bot encendido,
  // que aún no llegaron al tope de intentos.
  const desde24 = new Date(now - H(24)).toISOString();
  const { data: convs, error } = await supabase
    .from('conversations')
    .select('id, label, bot_enabled, last_message_time, seguimiento_at, seguimiento_n, contact_name')
    .eq('linea', 'ventas')
    .eq('bot_enabled', true)
    .gte('last_message_time', desde24)
    .lt('seguimiento_n', MAX_INTENTOS)
    .order('last_message_time', { ascending: false })
    .limit(80);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let enviados = 0, revisados = 0, saltados = 0;

  // Presupuesto de tiempo: cron-job.org corta la espera a ~30s. Respondemos SIEMPRE
  // antes de 24s; los leads que no alcancen se retoman en la siguiente corrida.
  const DEADLINE = now + 24_000;
  const MAX_ENVIOS = 10;
  let sinTiempo = false;

  for (const c of convs ?? []) {
    if (Date.now() > DEADLINE || enviados >= MAX_ENVIOS) { sinTiempo = true; break; }
    revisados++;
    const from = String(c.id);
    const label = String(c.label ?? '').toUpperCase();
    if (SKIP.some(l => label.includes(l))) { saltados++; continue; }
    if (esVendedor(from)) { saltados++; continue; }

    // Últimos mensajes de la conversación
    const { data: msgs } = await supabase
      .from('messages')
      .select('content, role, type, created_at')
      .eq('conversation_id', from)
      .order('created_at', { ascending: false })
      .limit(24);
    const lista = (msgs ?? []).slice().reverse();
    if (lista.length === 0) { saltados++; continue; }

    const ultimoCliente = [...lista].reverse().find(m => m.role === 'user');
    if (!ultimoCliente) { saltados++; continue; }              // nunca escribió: no es lead
    const tCliente = new Date(ultimoCliente.created_at).getTime();
    if (now - tCliente >= H(24)) { saltados++; continue; }     // fuera de ventana (necesitaría plantilla)

    const tUltimo = new Date(lista[lista.length - 1].created_at).getTime();
    const segAt = c.seguimiento_at ? new Date(c.seguimiento_at).getTime() : 0;
    const n = Number(c.seguimiento_n ?? 0);

    // ¿Toca mensaje?
    let toca = false;
    if (n === 0) {
      toca = (now - tUltimo) >= H(SILENCIO_1);                 // 3h de silencio
    } else if (n === 1) {
      // 2º intento: pasó la espera, y el cliente NO respondió al 1º
      toca = segAt > 0 && (now - segAt) >= H(ESPERA_2) && tCliente < segAt;
    }
    if (!toca) { saltados++; continue; }

    // Transcripción para la IA
    const texto = lista
      .filter(m => m.type === 'text' && typeof m.content === 'string' && m.content.trim() && !m.content.startsWith('http'))
      .map(m => `${m.role === 'user' ? 'CLIENTE' : m.role === 'agent' ? 'ASESOR' : 'LILIBETH'}: ${m.content.trim()}`)
      .join('\n')
      .slice(-4000);
    if (!texto) { saltados++; continue; }

    const sistema =
      `Eres Lilibeth, asesora de Klixmant (buzos de escuderías, pago contra entrega, Colombia). ` +
      `Un cliente se quedó a mitad de la conversación y no volvió a responder. ` +
      `Escribe UN solo mensaje corto (1–2 frases), cálido y natural, para retomar la charla DESDE DONDE QUEDÓ y llevarlo al cierre, sin sonar insistente ni robótico.\n` +
      `- Si preguntó el precio y no siguió: recuérdaselo con un beneficio (envío gratis, pago contra entrega) y una razón amable para decidir hoy.\n` +
      `- Si eligió color o talla pero no dio datos: pídele los datos para despachar.\n` +
      `- Si pidió el catálogo o dudaba: pregúntale cuál le gustó para avanzar.\n` +
      (n === 1 ? `Este es el SEGUNDO mensaje: sé aún más breve y suave, sin presionar.\n` : ``) +
      `Responde SOLO con el mensaje para el cliente, sin comillas ni explicaciones.`;

    let mensaje = '';
    try {
      const resp = await chat({
        messages: [{ role: 'user', content: `Conversación:\n${texto}\n\nEscribe el mensaje de reactivación:` }],
        tenantId: 'klixmant',
        systemPrompt: sistema,
        maxTokens: 300,
      });
      mensaje = resp.message.trim().replace(/^["“]|["”]$/g, '').trim();
    } catch { /* si falla la IA, no molesta al cliente */ }
    if (!mensaje) { saltados++; continue; }

    const wamid = await sendTextMessage(from, mensaje);
    if (wamid) {
      const iso = new Date().toISOString();
      try {
        await supabase.from('messages').insert({
          id: `segui-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          conversation_id: from, content: mensaje, role: 'assistant', type: 'text',
          whatsapp_id: wamid, created_at: iso,
        });
        await supabase.from('conversations').update({
          seguimiento_at: iso, seguimiento_n: n + 1,
          last_message: mensaje.slice(0, 100), last_message_time: iso, unread_count: 0,
        }).eq('id', from);
      } catch { /* ignorar */ }
      enviados++;
    }
  }

  return NextResponse.json({ status: 'ok', revisados, enviados, saltados, sinTiempo });
}

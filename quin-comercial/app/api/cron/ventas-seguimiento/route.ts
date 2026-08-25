import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage } from '@/lib/whatsapp';
import { conLinea } from '@/lib/whatsapp-contexto';
import { esVendedor } from '@/lib/vendedores';
import { porCadaTenant } from '@/lib/cron-tenant';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Frases variadas, para que el recordatorio no suene igual a todos
const RECORDATORIOS = [
  '¡Hola! 👋 Nos quedan las *últimas unidades* de lo que viste. Si aún lo deseas, me avisas y proceso tu compra 🚚',
  '¡Hola! 🔥 Tenemos las *últimas unidades* disponibles. Si todavía quieres el tuyo, me avisas y lo dejo listo para despacho 🙌',
  '¡Hola! 😊 Todavía tengo disponible lo que viste, pero van quedando *pocas unidades*. Si aún lo quieres, me avisas para procesar tu compra 🚚',
];

const HORA = 3_600_000;

/**
 * Recordatorio de ventas: le escribe UNA sola vez al cliente que quedó a mitad
 * de la conversación y no volvió a responder. Se llama por cron externo.
 *
 * MULTI-TENANT + REGLA 24h SIN PLANTILLAS:
 *  - Se corre por cada empresa activa, usando SU propia línea de ventas.
 *  - Solo se escribe DENTRO de la ventana gratis de 24h (el cliente escribió
 *    hace menos de 24h). Se manda un mensaje normal (gratis), nunca plantilla.
 *  - Si la ventana ya se cerró, no se manda nada (no se gasta): se marca como
 *    seguimiento_enviado para no volver a revisarlo.
 */
export async function GET(_req: NextRequest) {
  const ahora   = Date.now();
  const hace5h  = new Date(ahora - 5 * HORA).toISOString();
  const hace24h = new Date(ahora - 24 * HORA).toISOString();

  let enviados = 0;

  const { tenants, errores } = await porCadaTenant(async (supabase, tenant) => {
    const numeroVentas = tenant.wa_phone_number_id_ventas;
    if (!numeroVentas) return; // este tenant no tiene línea de ventas

    // Chats de VENTAS parados entre 5 y 24 horas, con el bot prendido y sin recordatorio previo
    const { data: convs } = await supabase
      .from('conversations')
      .select('id, contact_name, label')
      .eq('linea', 'ventas')
      .neq('bot_enabled', false)
      .is('seguimiento_enviado', null)
      .lte('last_message_time', hace5h)
      .gte('last_message_time', hace24h)
      .limit(40);

    if (!convs?.length) return;

    // Mensajes salen por la línea de VENTAS de ESTE tenant, con su token.
    await conLinea(
      {
        phoneId: numeroVentas,
        tipo: 'ventas',
        accessToken: tenant.wa_access_token ?? undefined,
        tenantId: tenant.id,
        phoneIdVentas: numeroVentas,
      },
      async () => {
        for (const c of convs) {
          // NUNCA a los VENDEDORES del equipo (por su número o su etiqueta).
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

          // VENTANA 24h: el último mensaje ENTRANTE del cliente debe ser <24h.
          // Si ya se cerró, no se puede escribir gratis → no se manda (marca hecho).
          const { data: ultIn } = await supabase.from('messages')
            .select('created_at').eq('conversation_id', c.id).eq('role', 'user')
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
          const inMs = ultIn?.created_at ? new Date(ultIn.created_at).getTime() : 0;
          if (!inMs || ahora - inMs >= 24 * HORA) {
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
      },
    );
  });

  return NextResponse.json({ ok: true, enviados, tenants, errores });
}

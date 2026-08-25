import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { entrarLinea } from '@/lib/whatsapp-contexto';
import { sendTextMessage } from '@/lib/whatsapp';
import { destinosAviso } from '@/lib/notificaciones';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('authorization') === `Bearer ${secret}`
      || req.nextUrl.searchParams.get('secret') === secret;
}

/**
 * Recuperación de CARRITOS ABANDONADOS.
 * Busca carritos con 15 min a 24 h de antigüedad, que NO se recuperaron, NO
 * compraron y NO se han avisado. Por cada uno avisa a Lilibeth con un enlace de
 * UN TOQUE que ya trae el mensaje escrito para el cliente ("tu pedido quedó
 * incompleto, ¿sigues por este chat?"). Así el cliente recibe el mensaje desde
 * un número que SÍ puede iniciar conversación (sin depender de plantillas).
 */
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const admin = createServerSupabaseClient();
  const ahora = Date.now();
  const hasta = new Date(ahora - 15 * 60_000).toISOString();   // al menos 15 min viejo
  const desde = new Date(ahora - 24 * 3600_000).toISOString(); // no más de 24 h

  const { data: carritos, error } = await admin
    .from('carritos_abandonados')
    .select('id, tenant_id, slug, nombre, telefono, producto, talla')
    .eq('recuperado', false)
    .is('notificado_at', null)
    .gte('created_at', desde)
    .lte('created_at', hasta)
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let avisados = 0;
  for (const c of carritos ?? []) {
    const tel = String((c as any).telefono).replace(/\D/g, '').replace(/^57/, '');
    const tid = (c as any).tenant_id as string | null;

    // ¿Ya compró? Entonces no es abandonado: se marca y se salta.
    try {
      const { data: ped } = await admin.from('clientes_funnelish')
        .select('id').eq('telefono', tel).eq('confirmado', true)
        .maybeSingle();
      if (ped) {
        await admin.from('carritos_abandonados').update({ notificado_at: new Date().toISOString() }).eq('id', (c as any).id);
        continue;
      }
    } catch { /* si falla, sigue */ }

    // Credenciales de WhatsApp del tenant dueño del embudo.
    let base: any = {};
    if (tid) {
      const { data: t } = await admin.from('tenants')
        .select('wa_access_token, wa_phone_number_id').eq('id', tid).maybeSingle();
      base = { accessToken: t?.wa_access_token ?? undefined, phoneId: t?.wa_phone_number_id ?? undefined };
    }

    const nombre = String((c as any).nombre ?? '').split(' ')[0] || '';
    const producto = String((c as any).producto ?? 'tu pedido');
    const talla = (c as any).talla ? ` (${(c as any).talla})` : '';
    // Mensaje ya escrito para el cliente, en un enlace de un toque para Lilibeth.
    const msgCliente = `Hola ${nombre} 😊 Vimos que tu pedido de ${producto}${talla} quedó incompleto. ¿Deseas seguir con la compra por este chat? 🚚 Te ayudo a terminarlo en 1 minuto.`;
    const enlace = `https://wa.me/57${tel}?text=${encodeURIComponent(msgCliente)}`;
    const avisoDueno =
      `🛒 *CARRITO ABANDONADO — recuperar venta*\n` +
      `Cliente: ${(c as any).nombre ?? '—'}\n` +
      `Teléfono: ${tel}\n` +
      `Producto: ${producto}${talla}\n\n` +
      `👉 Escríbele con un toque (ya lleva el mensaje listo):\n${enlace}`;

    try {
      entrarLinea({ phoneId: base.phoneId, tipo: 'funnel', accessToken: base.accessToken, tenantId: tid ?? undefined } as any);
      // El aviso va al DUEÑO de la tienda (su número vinculado), no a la agencia.
      const destinos = await destinosAviso(tid);
      for (const d of destinos) { try { await sendTextMessage(d, avisoDueno); } catch { /* seguir */ } }
      await admin.from('carritos_abandonados').update({ notificado_at: new Date().toISOString() }).eq('id', (c as any).id);
      avisados++;
    } catch (e) {
      console.error('[Carrito] no se pudo avisar:', e);
    }
  }

  return NextResponse.json({ ok: true, revisados: carritos?.length ?? 0, avisados });
}

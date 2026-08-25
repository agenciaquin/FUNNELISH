import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Número que recibe el aviso para recuperar la venta.
const SOPORTE = '573187051499'; // Lilibeth

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('authorization') === `Bearer ${secret}`
      || req.nextUrl.searchParams.get('secret') === secret;
}

/**
 * Recuperación de CARRITOS ABANDONADOS. Busca carritos de 15 min a 24 h que no
 * se recuperaron, no compraron y no se han avisado. Por cada uno le avisa a
 * Lilibeth con un enlace de UN TOQUE que ya trae el mensaje escrito para el
 * cliente ("tu pedido quedó incompleto, ¿sigues por este chat?"). El cliente
 * recibe el mensaje desde el número de Lilibeth (que sí puede iniciar chat).
 */
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const admin = createServerSupabaseClient();
  const ahora = Date.now();
  const hasta = new Date(ahora - 15 * 60_000).toISOString();
  const desde = new Date(ahora - 24 * 3600_000).toISOString();

  const { data: carritos, error } = await admin
    .from('carritos_abandonados')
    .select('id, slug, nombre, telefono, producto, talla')
    .eq('recuperado', false)
    .is('notificado_at', null)
    .gte('created_at', desde)
    .lte('created_at', hasta)
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let avisados = 0;
  for (const c of carritos ?? []) {
    const tel = String((c as any).telefono).replace(/\D/g, '').replace(/^57/, '');

    // ¿Ya compró? Entonces no es abandonado: se marca y se salta.
    try {
      const { data: ped } = await admin.from('clientes_funnelish')
        .select('id').eq('telefono', tel).eq('confirmado', true).maybeSingle();
      if (ped) {
        await admin.from('carritos_abandonados').update({ notificado_at: new Date().toISOString() }).eq('id', (c as any).id);
        continue;
      }
    } catch { /* si falla, sigue */ }

    const nombre = String((c as any).nombre ?? '').split(' ')[0] || '';
    const producto = String((c as any).producto ?? 'tu pedido');
    const talla = (c as any).talla ? ` (${(c as any).talla})` : '';
    const msgCliente = `Hola ${nombre} 😊 Vimos que tu pedido de ${producto}${talla} quedó incompleto. ¿Deseas seguir con la compra por este chat? 🚚 Te ayudo a terminarlo en 1 minuto.`;
    const enlace = `https://wa.me/57${tel}?text=${encodeURIComponent(msgCliente)}`;
    const avisoLili =
      `🛒 *CARRITO ABANDONADO — recuperar venta*\n` +
      `Cliente: ${(c as any).nombre ?? '—'}\n` +
      `Teléfono: ${tel}\n` +
      `Producto: ${producto}${talla}\n\n` +
      `👉 Escríbele con un toque (ya lleva el mensaje listo):\n${enlace}`;

    try {
      await sendTextMessage(SOPORTE, avisoLili);
      await admin.from('carritos_abandonados').update({ notificado_at: new Date().toISOString() }).eq('id', (c as any).id);
      avisados++;
    } catch (e) {
      console.error('[Carrito] no se pudo avisar:', e);
    }
  }

  return NextResponse.json({ ok: true, revisados: carritos?.length ?? 0, avisados });
}

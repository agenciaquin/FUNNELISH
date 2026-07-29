import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { mandarFichaVenta } from '@/lib/quinchat/registro-venta';
import { mandarFichaVentaWA } from '@/lib/quinchat/ventas';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Envía las fichas "VENTA CONFIRMADA — FUNNEL" que quedaron en PERÍODO DE GRACIA.
 * Se manda la ficha ~5 min después de confirmar, así los cambios de último minuto
 * (color/talla/dirección) ya quedan reflejados y la ficha sale correcta una vez.
 * Se ejecuta cada 1–2 min por cron.
 */
const GRACIA_MIN = 5;

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const limite = new Date(Date.now() - GRACIA_MIN * 60_000).toISOString();

  const { data: pendientes, error } = await supabase
    .from('clientes_funnelish')
    .select('id, nombre, telefono, direccion, ciudad, departamento, correo, talla, producto, valor, abono, abono_recibido, foto_producto, referencia')
    .eq('confirmado', true)
    .eq('registro_enviado', false)
    .not('registro_at', 'is', null)
    .lte('registro_at', limite)
    .limit(40);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let enviadas = 0;
  for (const p of pendientes ?? []) {
    const tel10 = String((p as any).telefono ?? '').replace(/\D/g, '').slice(-10);
    const from = `57${tel10}`;
    try {
      // Ventas del bot de WhatsApp (referencia "venta-…") → ficha CHAT WHATSAPP a sus
      // destinos. Las del Funnel → ficha FUNNEL. Así cada una sale a quien corresponde.
      const esVentaWA = /^venta-/i.test(String((p as any).referencia ?? ''));
      if (esVentaWA) await mandarFichaVentaWA(supabase, p);
      else           await mandarFichaVenta(supabase, p, tel10, from);
      await supabase.from('clientes_funnelish')
        .update({ registro_enviado: true }).eq('id', (p as any).id);
      enviadas++;
    } catch (e) {
      console.error('[Registros] no se pudo enviar ficha', (p as any).id, e);
    }
  }

  return NextResponse.json({ status: 'ok', enviadas, revisadas: pendientes?.length ?? 0 });
}

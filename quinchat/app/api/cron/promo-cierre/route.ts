import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * ⛔ DESACTIVADO. Antes enviaba la promo de "$10.000 de descuento" en la ventana
 * de 24h del chat de ventas. Ese descuento se eliminó por pedido del negocio.
 *
 * El recordatorio ahora lo maneja `ventas-seguimiento`: UN solo mensaje, dentro
 * de la ventana de 24h, y SOLO a quien recibió el formulario de datos de envío y
 * no respondió (sin descuentos, sin molestar a los desinteresados).
 *
 * Se deja este endpoint como no-op para no romper el cron externo si aún lo llama.
 */
export async function GET() {
  return NextResponse.json({ ok: true, nota: 'promo-cierre desactivado (sin descuento de $10.000)' });
}

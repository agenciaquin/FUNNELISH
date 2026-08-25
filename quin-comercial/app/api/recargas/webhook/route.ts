import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { buscarPago, acreditarPagoAprobado } from '@/lib/recargas';

export const dynamic = 'force-dynamic';

/**
 * Webhook de Mercado Pago. MP nos avisa cuando hay un pago.
 * Verificamos el pago consultándolo con NUESTRO token (así nadie puede
 * sumar crédito con una llamada falsa). Si está aprobado, sumamos las
 * conversaciones a la empresa. Es idempotente: no suma dos veces.
 */
async function idDelPago(req: NextRequest): Promise<string | null> {
  const q = req.nextUrl.searchParams;
  if (q.get('type') === 'payment' || q.get('topic') === 'payment') {
    const id = q.get('data.id') || q.get('id');
    if (id) return id;
  }
  try {
    const body = await req.json();
    if ((body?.type === 'payment' || body?.action?.includes?.('payment')) && body?.data?.id) {
      return String(body.data.id);
    }
  } catch { /* sin body */ }
  return null;
}

export async function POST(req: NextRequest) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ ok: true }); // nada que hacer

  const paymentId = await idDelPago(req);
  if (!paymentId) return NextResponse.json({ ok: true }); // notificación que no es de pago

  try {
    const pago = await buscarPago(token, { payment_id: paymentId });
    if (!pago || pago.status !== 'approved') return NextResponse.json({ ok: true });

    const admin = createServerSupabaseClient();
    await acreditarPagoAprobado(admin, pago);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

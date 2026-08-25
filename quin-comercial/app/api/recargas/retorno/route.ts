import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';
import { buscarPago, acreditarPagoAprobado } from '@/lib/recargas';

export const dynamic = 'force-dynamic';

/**
 * A donde Mercado Pago devuelve al cliente después de pagar (back_url).
 * Aquí, del lado del SERVIDOR (sin depender del webhook ni de qué pestaña esté
 * abierta), verificamos el pago con nuestro token y acreditamos el crédito.
 * Luego redirigimos al panel, a la sección Recarga, con el resultado.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const sp = req.nextUrl.searchParams;
  const payment_id = sp.get('payment_id') || sp.get('collection_id') || '';
  const external_reference = sp.get('external_reference') || '';

  let flag = 'success';
  try {
    const session = await getServerSession(authOptions);
    const tid = session ? await tenantActual() : null;
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (tid && token) {
      const pago = await buscarPago(token, { payment_id, external_reference });
      if (pago && pago.status === 'approved') {
        const admin = createServerSupabaseClient();
        await acreditarPagoAprobado(admin, pago);
        flag = 'success';
      } else if (pago) {
        flag = 'pending';
      }
    }
  } catch { /* fail-open: igual mostramos el panel */ }

  const qs = new URLSearchParams({ recarga: flag });
  if (payment_id) qs.set('payment_id', payment_id);
  if (external_reference) qs.set('external_reference', external_reference);
  return NextResponse.redirect(`${origin}/panel?${qs.toString()}`, { status: 303 });
}

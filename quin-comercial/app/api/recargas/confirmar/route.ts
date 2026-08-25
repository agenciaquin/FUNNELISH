import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';
import { buscarPago, acreditarPagoAprobado } from '@/lib/recargas';

export const dynamic = 'force-dynamic';

/**
 * Confirma un pago al volver de Mercado Pago (a prueba de fallos, sin depender
 * del webhook). El navegador manda el payment_id / external_reference que MP
 * agrega a la URL de retorno; verificamos el pago con nuestro token y, si está
 * aprobado, sumamos el crédito. Idempotente: si el webhook ya lo sumó, no
 * vuelve a sumar.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: 'pasarela no configurada' }, { status: 400 });

  let body: any = {};
  try { body = await req.json(); } catch { /* sin body */ }
  const payment_id = String(body?.payment_id ?? '').trim();
  const external_reference = String(body?.external_reference ?? '').trim();

  const pago = await buscarPago(token, { payment_id, external_reference });
  if (!pago) return NextResponse.json({ ok: true, acreditado: false, estado: 'no_encontrado' });
  if (pago.status !== 'approved') return NextResponse.json({ ok: true, acreditado: false, estado: pago.status });

  const admin = createServerSupabaseClient();
  const res = await acreditarPagoAprobado(admin, pago);

  // Seguridad: solo confirmamos recargas de la empresa logueada.
  if (res.tenant_id && res.tenant_id !== tid) {
    return NextResponse.json({ ok: true, acreditado: false, estado: 'otra_empresa' });
  }

  const exito = res.estado === 'acreditado' || res.estado === 'ya';
  return NextResponse.json({
    ok: true,
    acreditado: exito,
    nuevo: res.estado === 'acreditado',
    cantidad: res.cantidad ?? null,
    creditos: res.creditos ?? null,
  });
}

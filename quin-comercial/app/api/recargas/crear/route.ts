import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';
import { paqueteDe, MONEDA } from '@/lib/recargas';
import { permitido } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Crea el pago de una recarga en Mercado Pago (Checkout Pro).
 * POST { conversaciones } → { init_point }  (URL a la que se manda al cliente).
 * El crédito NO se suma aquí: se suma cuando Mercado Pago confirma el pago
 * en el webhook. Así nadie recarga sin pagar.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  // Rate limit: máx 15 intentos de recarga por hora por empresa.
  if (!(await permitido(`recarga:${tid}`, 15, 3600))) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera un momento e intenta de nuevo.' }, { status: 429 });
  }

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: 'La pasarela de pago aún no está configurada.', faltaConfig: true }, { status: 400 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const conversaciones = Number(body?.conversaciones ?? 0);
  const paquete = paqueteDe(conversaciones);
  if (!paquete) return NextResponse.json({ error: 'paquete inválido' }, { status: 400 });

  const admin = createServerSupabaseClient();

  // 1) Deja registrada la recarga como pendiente (para casar el pago después).
  const { data: rec, error: eRec } = await admin
    .from('recargas')
    .insert({ tenant_id: tid, cantidad: paquete.conversaciones, monto: paquete.precio, estado: 'pendiente' })
    .select('id').single();
  if (eRec || !rec) return NextResponse.json({ error: eRec?.message ?? 'no se pudo crear la recarga' }, { status: 500 });

  const origin = req.nextUrl?.origin ?? '';

  // 2) Crea la preferencia de pago en Mercado Pago.
  const pref = {
    items: [{
      title: `Recarga ${paquete.conversaciones} conversaciones — QuinChat`,
      quantity: 1,
      unit_price: paquete.precio,
      currency_id: MONEDA,
    }],
    back_urls: {
      success: `${origin}/api/recargas/retorno`,
      failure: `${origin}/panel?recarga=failure`,
      pending: `${origin}/api/recargas/retorno`,
    },
    auto_return: 'approved',
    notification_url: `${origin}/api/recargas/webhook`,
    external_reference: rec.id,
    metadata: { tenant_id: tid, conversaciones: paquete.conversaciones },
  };

  try {
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(pref),
    });
    const d = await r.json();
    if (!r.ok) {
      await admin.from('recargas').update({ estado: 'rechazada' }).eq('id', rec.id);
      return NextResponse.json({ error: d?.message ?? 'Mercado Pago rechazó la solicitud' }, { status: 500 });
    }
    await admin.from('recargas').update({ mp_preference_id: d.id }).eq('id', rec.id);
    return NextResponse.json({ init_point: d.init_point ?? d.sandbox_init_point });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error conectando con Mercado Pago' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { enviarConversionCTWA } from '@/lib/meta-capi';
import { porCadaTenant } from '@/lib/cron-tenant';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CAPI: envía a Meta las VENTAS realizadas que llegaron de un anuncio de
 * Click-to-WhatsApp (tienen ctwa_clid), para que el algoritmo optimice por
 * compradores. Idempotente: marca capi_enviado_at y usa event_id estable.
 * Se ejecuta cada hora por cron. MULTI-TENANT: por cada empresa activa.
 */

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  if (!process.env.META_CAPI_DATASET_ID || !process.env.META_ADS_TOKEN) {
    return NextResponse.json({ status: 'sin-config', nota: 'Falta META_CAPI_DATASET_ID o META_ADS_TOKEN' });
  }

  // Ventas de los últimos 10 días (dentro de la ventana de atribución de CTWA).
  const hace10 = new Date(Date.now() - 10 * 86_400_000).toISOString();
  let enviados = 0, sinClid = 0, fallaron = 0;

  const { tenants, errores } = await porCadaTenant(async (supabase) => {
    const { data: convs } = await supabase
      .from('conversations')
      .select('id, label, origen_anuncio, last_message_time')
      .not('origen_anuncio', 'is', null)
      .is('capi_enviado_at', null)
      .gte('last_message_time', hace10)
      .limit(100);

    for (const c of convs ?? []) {
      const label = String((c as any).label ?? '').toUpperCase();
      if (!label.includes('VENTA REALIZADA')) continue; // solo ventas cerradas

      // ctwa_clid del anuncio
      let ctwaClid = '';
      try { ctwaClid = String(JSON.parse(String((c as any).origen_anuncio ?? '{}'))?.ctwa_clid ?? ''); } catch { /* */ }
      if (!ctwaClid) { sinClid++; continue; }

      const from = String((c as any).id);
      const tel10 = from.replace(/^57/, '').slice(-10);

      // Valor de la venta (del pedido confirmado)
      let valor = 0;
      try {
        const { data: ped } = await supabase.from('clientes_funnelish')
          .select('valor').eq('telefono', tel10).eq('confirmado', true)
          .order('confirmado_at', { ascending: false }).limit(1).maybeSingle();
        valor = Number(String(ped?.valor ?? '').replace(/[^\d]/g, '')) || 0;
      } catch { /* */ }
      if (valor <= 0) valor = 129900; // valor mínimo por defecto

      const r = await enviarConversionCTWA({
        ctwaClid, valor, telefono: from, eventId: `venta-${from}`,
      });
      if (r.ok) {
        await supabase.from('conversations').update({ capi_enviado_at: new Date().toISOString() }).eq('id', from);
        enviados++;
      } else {
        fallaron++;
        console.error('[CAPI] falló envío', from, r.error);
      }
    }
  });

  return NextResponse.json({ status: 'ok', enviados, sinClid, fallaron, tenants, errores });
}

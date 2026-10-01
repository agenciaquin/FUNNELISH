import { NextRequest, NextResponse } from 'next/server';
import { alcanceCron, porCadaTenant } from '@/lib/cron-tenant';

export const dynamic = 'force-dynamic';

/**
 * Apaga el bot en las conversaciones que ya se marcaron como VENTA REALIZADA
 * hace más de 30 minutos. Después de la venta el bot ya no hace falta y podría
 * dañarla respondiendo de más; se deja el chat en manos del asesor.
 *
 * Se ejecuta por cron cada pocos minutos. Idempotente. MULTI-TENANT: recorre
 * cada empresa activa y apaga solo sus conversaciones.
 */

const MINUTOS = 30;

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // sin CRON_SECRET no corre: antes quedaba abierto a cualquiera
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  // Cron (clave) → todas las empresas; alguien del panel con sesión → solo la suya
  const alcance = await alcanceCron(autorizado(req));
  if (!alcance) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const limite = new Date(Date.now() - MINUTOS * 60_000).toISOString();
  let apagados = 0;

  const { tenants, errores } = await porCadaTenant(async (supabase) => {
    // Ventas marcadas hace más de 30 min con el bot todavía encendido (de este tenant)
    const { data: pendientes } = await supabase
      .from('conversations')
      .select('id')
      .not('vendido_at', 'is', null)
      .lte('vendido_at', limite)
      .eq('bot_enabled', true);

    const ids = (pendientes ?? []).map((c: any) => c.id);
    if (ids.length === 0) return;

    await supabase
      .from('conversations')
      .update({ bot_enabled: false, vendido_at: null })
      .in('id', ids);
    apagados += ids.length;
  }, alcance.soloTenantId);

  return NextResponse.json({ status: 'ok', apagados, tenants, errores });
}

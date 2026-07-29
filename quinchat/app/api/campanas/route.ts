import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { construirInforme } from '@/lib/campanas';

/**
 * Informe de rentabilidad por campaña en un rango de fechas.
 * ?desde=2026-07-01&hasta=2026-07-20
 */
export async function GET(req: NextRequest) {
  try {
    const hoy   = new Date().toISOString().slice(0, 10);
    const desde = req.nextUrl.searchParams.get('desde') || hoy;
    const hasta = req.nextUrl.searchParams.get('hasta') || hoy;

    const supabase = createServerSupabaseClient();

    const { data: gastos, error: e1 } = await supabase
      .from('campanas_gasto')
      .select('plataforma, campana, campana_id, fecha, gasto, estado')
      .gte('fecha', desde).lte('fecha', hasta);

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    // Los pedidos se filtran por día completo
    const { data: pedidos, error: e2 } = await supabase
      .from('clientes_funnelish')
      .select('utm_campaign, utm_source, confirmado, estado, valor, created_at')
      .gte('created_at', `${desde}T00:00:00`)
      .lte('created_at', `${hasta}T23:59:59`);

    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    const informe = construirInforme(gastos ?? [], pedidos ?? []);

    // Cuántos pedidos llegaron sin origen (no se pueden atribuir)
    const sinOrigen = (pedidos ?? []).filter(p => !p.utm_campaign).length;

    return NextResponse.json({ ...informe, sinOrigen, desde, hasta });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

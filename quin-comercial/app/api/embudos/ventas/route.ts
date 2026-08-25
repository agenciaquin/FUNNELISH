import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/**
 * Contador de ventas por embudo, con filtro de fecha.
 * ?desde=ISO&hasta=ISO  (ambos opcionales)
 *
 * Cuenta los pedidos REALES (excluye 'cancelado' y 'duplicado') agrupados por
 * el embudo (funnel_slug) del que entraron. MULTI-TENANT: solo del tenant actual.
 *
 * Devuelve:
 *   porEmbudo   = { [slug]: { total, confirmadas } }
 *   sinAtribuir = { total, confirmadas }   ← ventas del chat o pedidos viejos sin slug
 *   columnaLista = false si la BD aún no tiene la columna funnel_slug (falta migración)
 */
export async function GET(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const desde = req.nextUrl.searchParams.get('desde');
  const hasta = req.nextUrl.searchParams.get('hasta');

  const supabase = createServerSupabaseClient();
  let consulta = supabase
    .from('clientes_funnelish')
    .select('funnel_slug, confirmado, estado, created_at')
    .eq('tenant_id', tid)
    .not('estado', 'in', '("cancelado","duplicado")')
    .order('created_at', { ascending: false })
    .limit(10000);
  if (desde) consulta = consulta.gte('created_at', desde);
  if (hasta) consulta = consulta.lte('created_at', hasta);

  const { data, error } = await consulta;
  if (error) {
    // Si la columna funnel_slug todavía no existe (falta correr la migración),
    // no se rompe: se responde vacío para que el panel muestre "—" y un aviso.
    if (/funnel_slug|column/i.test(error.message ?? '')) {
      return NextResponse.json({ porEmbudo: {}, sinAtribuir: { total: 0, confirmadas: 0 }, columnaLista: false });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const porEmbudo: Record<string, { total: number; confirmadas: number }> = {};
  const sinAtribuir = { total: 0, confirmadas: 0 };
  for (const r of (data ?? []) as any[]) {
    const slug = String(r.funnel_slug ?? '').trim();
    const destino = slug ? (porEmbudo[slug] ??= { total: 0, confirmadas: 0 }) : sinAtribuir;
    destino.total += 1;
    if (r.confirmado) destino.confirmadas += 1;
  }

  return NextResponse.json({ porEmbudo, sinAtribuir, columnaLista: true });
}

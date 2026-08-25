import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const aNum = (v: any) => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;

/** Prendas de un pedido: por precio (packs), por cantidad, o por el nombre. */
function prendasDe(p: any): number {
  const valor = aNum(p.valor);
  if (valor >= 285000) return 3;
  if (valor >= 185000) return 2;
  const cant = Number(p.cantidad) || 0;
  if (cant > 0) return cant;
  const m = String(p.producto ?? '').toUpperCase().match(/PACK\s*X?\s*(\d)/);
  if (m) return Number(m[1]);
  if (/\b(DOS|2)\s+COLORES\b/.test(String(p.producto ?? '').toUpperCase())) return 2;
  if (/\b(TRES|3)\s+COLORES\b/.test(String(p.producto ?? '').toUpperCase())) return 3;
  return 1;
}

/**
 * Ventas confirmadas agrupadas por CAMPAÑA (utm_campaign), en un rango de fechas.
 * Devuelve por cada campaña: pedidos, prendas y $ vendido; más los totales.
 * ?desde=YYYY-MM-DD &hasta=YYYY-MM-DD &origen=web|todos
 */
export async function GET(req: NextRequest) {
  const desde   = req.nextUrl.searchParams.get('desde'); // YYYY-MM-DD (opcional)
  const hasta   = req.nextUrl.searchParams.get('hasta');
  const soloWeb = req.nextUrl.searchParams.get('origen') !== 'todos';

  const supabase = createServerSupabaseClient();
  let q = supabase
    .from('clientes_funnelish')
    .select('referencia, valor, cantidad, producto, utm_campaign, utm_source, confirmado, estado, confirmado_at, created_at')
    .eq('confirmado', true)
    .limit(5000);

  if (soloWeb) q = q.like('referencia', 'web-%');
  if (desde)   q = q.gte('created_at', `${desde}T00:00:00`);
  if (hasta)   q = q.lte('created_at', `${hasta}T23:59:59`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filas = (data ?? []).filter(
    p => !/CANCELAD|ANULAD/.test(String((p as any).estado ?? '').toUpperCase())
  );

  // Agrupa por campaña (sin campaña => "Directo / sin campaña").
  const mapa = new Map<string, { campana: string; fuente: string; pedidos: number; prendas: number; vendido: number }>();
  for (const p of filas) {
    const campana = String((p as any).utm_campaign ?? '').trim() || 'Directo / sin campaña';
    const fuente  = String((p as any).utm_source ?? '').trim();
    const clave = campana.toLowerCase();
    const g = mapa.get(clave) ?? { campana, fuente, pedidos: 0, prendas: 0, vendido: 0 };
    g.pedidos += 1;
    g.prendas += prendasDe(p);
    g.vendido += aNum((p as any).valor);
    if (!g.fuente && fuente) g.fuente = fuente;
    mapa.set(clave, g);
  }

  const campanas = [...mapa.values()].sort((a, b) => b.prendas - a.prendas);
  const totales = campanas.reduce(
    (t, c) => ({ pedidos: t.pedidos + c.pedidos, prendas: t.prendas + c.prendas, vendido: t.vendido + c.vendido }),
    { pedidos: 0, prendas: 0, vendido: 0 },
  );

  return NextResponse.json({ campanas, totales });
}

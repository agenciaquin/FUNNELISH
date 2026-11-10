import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Contador de ventas de «Mi Página» (10-nov-2026, dueño) — SOLO LECTURA.
 *  GET ?dias=1|7|30&origen=pagina|todos
 *   · origen 'pagina' = pedidos que entraron desde Mi Página (utm_source 'mi-pagina', lo pone el enlace de la tienda).
 *   · origen 'todos'  = todos los pedidos de embudos (funnel_slug).
 *  ventas  = pedidos CONFIRMADOS · pedidos = todos (sin papelera ni duplicados) · prendas = suma de `cantidad` de las ventas.
 *  Devuelve: hoy, total del período, por día (hora Colombia) y RANKING de embudos (el que más vende primero).
 * Se guarda 2 min en memoria (la base es pequeña: no golpearla en horas pico).
 */
const cache = new Map<string, { t: number; datos: any }>();
const diaCo = (iso: string) => new Date(Date.parse(iso) - 5 * 3600_000).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const sp = req.nextUrl.searchParams;
  const dias = [1, 7, 30].includes(Number(sp.get('dias'))) ? Number(sp.get('dias')) : 7;
  const origen = sp.get('origen') === 'todos' ? 'todos' : 'pagina';
  const llave = `${dias}:${origen}`;
  const c = cache.get(llave);
  if (c && Date.now() - c.t < 2 * 60_000) return NextResponse.json({ ...c.datos, cache: true });

  const supabase = createServerSupabaseClient();
  const hoy = diaCo(new Date().toISOString());
  // Inicio del período = medianoche de Colombia de hace (dias-1) días
  const desdeDia = diaCo(new Date(Date.now() - (dias - 1) * 86400_000).toISOString());
  const desde = new Date(Date.parse(`${desdeDia}T00:00:00Z`) + 5 * 3600_000).toISOString();

  let q = supabase.from('clientes_funnelish').select('funnel_slug, confirmado, cantidad, estado, papelera_at, created_at, utm_source')
    .gte('created_at', desde).not('funnel_slug', 'is', null).limit(10000);
  if (origen === 'pagina') q = q.eq('utm_source', 'mi-pagina');
  const [{ data, error }, { data: fun }] = await Promise.all([
    q,
    supabase.from('funnels').select('slug, nombre, producto, imagenes').limit(400),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const nombreDe = new Map<string, { nombre: string; foto: string | null }>();
  for (const f of (fun ?? []) as any[]) {
    nombreDe.set(String(f.slug).toLowerCase(), {
      nombre: String(f.producto || f.nombre || f.slug),
      foto: Array.isArray(f.imagenes) && f.imagenes[0] ? String(f.imagenes[0]) : null,
    });
  }

  const vacio = () => ({ ventas: 0, pedidos: 0, prendas: 0 });
  const total = vacio(), deHoy = vacio();
  const porDia = new Map<string, ReturnType<typeof vacio>>();
  for (let i = dias - 1; i >= 0; i--) porDia.set(diaCo(new Date(Date.now() - i * 86400_000).toISOString()), vacio());
  const rank = new Map<string, ReturnType<typeof vacio>>();

  for (const p of (data ?? []) as any[]) {
    if (p.papelera_at || String(p.estado ?? '') === 'duplicado') continue;
    const dia = diaCo(p.created_at);
    const venta = p.confirmado === true;
    const prendas = venta ? Math.max(1, Number(p.cantidad) || 1) : 0;
    const slug = String(p.funnel_slug).toLowerCase();
    for (const acc of [total, dia === hoy ? deHoy : null, porDia.get(dia) ?? null, rank.get(slug) ?? rank.set(slug, vacio()).get(slug)!]) {
      if (!acc) continue;
      acc.pedidos++;
      if (venta) { acc.ventas++; acc.prendas += prendas; }
    }
  }

  const ranking = [...rank.entries()]
    .map(([slug, v]) => ({ slug, ...v, nombre: nombreDe.get(slug)?.nombre ?? slug, foto: nombreDe.get(slug)?.foto ?? null }))
    .sort((a, b) => b.ventas - a.ventas || b.prendas - a.prendas || b.pedidos - a.pedidos);

  const datos = { dias, origen, hoy: deHoy, total, por_dia: [...porDia.entries()].map(([dia, v]) => ({ dia, ...v })), ranking };
  cache.set(llave, { t: Date.now(), datos });
  return NextResponse.json(datos);
}

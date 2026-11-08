import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Cifras para las tarjetas de «Mis Embudos» — SOLO LECTURA (08-nov-2026).
 * Últimos 30 días, por embudo:
 *  · ventas   = pedidos web reales (clientes_funnelish con funnel_slug, sin duplicados ni papelera)
 *  · visitas  = llegadas a la página (funnel_eventos paso 'landing', con el índice slug+paso+fecha)
 *  · conv     = ventas / visitas
 * Se guarda 10 min en memoria para no cargar la base cada vez que se abre Embudos.
 */
let cache: { t: number; datos: Record<string, { ventas: number; visitas: number; conv: number }> } | null = null;

export async function GET() {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  if (cache && Date.now() - cache.t < 10 * 60_000) return NextResponse.json({ dias: 30, embudos: cache.datos, cache: true });

  const supabase = createServerSupabaseClient();
  const desde = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [{ data: fun }, { data: ped }] = await Promise.all([
    supabase.from('funnels').select('slug').or('eliminado.is.null,eliminado.eq.false').limit(400),
    supabase.from('clientes_funnelish').select('funnel_slug, estado, papelera_at')
      .not('funnel_slug', 'is', null).gte('created_at', desde).limit(10000),
  ]);
  const ventas = new Map<string, number>();
  for (const p of (ped ?? []) as any[]) {
    if (p.papelera_at || String(p.estado ?? '') === 'duplicado') continue;
    const s = String(p.funnel_slug).toLowerCase();
    ventas.set(s, (ventas.get(s) ?? 0) + 1);
  }
  const slugs = (fun ?? []).map((f: any) => String(f.slug));
  const visitas = new Map<string, number>();
  // Conteos por embudo en tandas de 8 (consultas livianas por índice)
  for (let i = 0; i < slugs.length; i += 8) {
    await Promise.all(slugs.slice(i, i + 8).map(async s => {
      const { count } = await supabase.from('funnel_eventos').select('id', { count: 'exact', head: true })
        .eq('slug', s).eq('paso', 'landing').gte('created_at', desde);
      visitas.set(s, count ?? 0);
    }));
  }
  const datos: Record<string, { ventas: number; visitas: number; conv: number }> = {};
  for (const s of slugs) {
    const v = ventas.get(s.toLowerCase()) ?? 0, l = visitas.get(s) ?? 0;
    datos[s] = { ventas: v, visitas: l, conv: l > 0 ? Math.round((v / l) * 1000) / 10 : 0 };
  }
  cache = { t: Date.now(), datos };
  return NextResponse.json({ dias: 30, embudos: datos });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { haySesion } from '@/lib/live/admin-guard';

export const dynamic = 'force-dynamic';

/**
 * POST: duplica un live completo.
 *  · El live (video, textos, comentarios, checkout, píxeles) → copia en BORRADOR,
 *    con título "(copia)" y un link nuevo que no choca con otro live ni embudo.
 *  · Los productos y sus colores → se COPIAN (son independientes: editar la copia
 *    no cambia el live original).
 *  · La línea de tiempo → se copia apuntando a los productos copiados.
 * El original no se toca.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data: live, error } = await supabase.from('live_lives').select('*').eq('id', id).maybeSingle();
  if (error || !live) return NextResponse.json({ error: 'No se encontró el live.' }, { status: 404 });

  // ── Link nuevo libre: <slug>-copia, -copia-2, -copia-3… ──
  const base = String(live.slug).replace(/-copia(-\d+)?$/, '').slice(0, 50);
  let slug = '';
  for (let n = 1; n <= 30; n++) {
    const cand = n === 1 ? `${base}-copia` : `${base}-copia-${n}`;
    const [{ data: otroLive }, { data: embudo }] = await Promise.all([
      supabase.from('live_lives').select('id').eq('slug', cand).maybeSingle(),
      supabase.from('funnels').select('id').eq('slug', cand).maybeSingle(),
    ]);
    if (!otroLive && !embudo) { slug = cand; break; }
  }
  if (!slug) return NextResponse.json({ error: 'No se encontró un link libre para la copia.' }, { status: 409 });

  // ── 1) El live ──
  const { id: _id, creado_en: _c, slug: _s, titulo, estado: _e, ...resto } = live as any;
  const { data: nuevo, error: e1 } = await supabase.from('live_lives').insert({
    ...resto,
    slug,
    titulo: `${String(titulo ?? 'Live').replace(/\s*\(copia\)$/i, '')} (copia)`.slice(0, 120),
    estado: 'borrador',
  }).select('id').single();
  if (e1 || !nuevo) return NextResponse.json({ error: e1?.message ?? 'No se pudo crear la copia.' }, { status: 500 });
  const nuevoId = nuevo.id as string;

  const mapa = new Map<string, string>(); // producto original → producto copia
  try {
    // ── 2) Productos (copias independientes) + colores ──
    const { data: enlaces } = await supabase.from('live_lives_productos')
      .select('producto_id, orden').eq('live_id', id).order('orden');
    const ids = (enlaces ?? []).map((e: any) => e.producto_id);
    if (ids.length) {
      const [{ data: prods }, { data: cols }] = await Promise.all([
        supabase.from('live_productos').select('*').in('id', ids),
        supabase.from('live_producto_colores').select('*').in('producto_id', ids),
      ]);
      for (const p of prods ?? []) {
        const { id: pid, creado_en: _pc, ...datosP } = p as any;
        const { data: np, error: ep } = await supabase.from('live_productos').insert(datosP).select('id').single();
        if (ep || !np) throw new Error(ep?.message ?? 'No se pudo copiar un producto.');
        mapa.set(String(pid), String(np.id));
        const colores = (cols ?? []).filter((c: any) => String(c.producto_id) === String(pid))
          .map(({ id: _ci, producto_id: _pi, ...c }: any) => ({ ...c, producto_id: np.id }));
        if (colores.length) {
          const { error: ec } = await supabase.from('live_producto_colores').insert(colores);
          if (ec) throw new Error(ec.message);
        }
      }
      const nuevosEnlaces = (enlaces ?? [])
        .filter((e: any) => mapa.has(String(e.producto_id)))
        .map((e: any) => ({ live_id: nuevoId, producto_id: mapa.get(String(e.producto_id)), orden: e.orden ?? 0 }));
      if (nuevosEnlaces.length) {
        const { error: el } = await supabase.from('live_lives_productos').insert(nuevosEnlaces);
        if (el) throw new Error(el.message);
      }
    }

    // ── 3) Línea de tiempo (apuntando a los productos copiados) ──
    const { data: eventos } = await supabase.from('live_timeline_eventos').select('*').eq('live_id', id);
    if (eventos?.length) {
      const copia = eventos.map(({ id: _ei, live_id: _li, ...ev }: any) => ({
        ...ev,
        live_id: nuevoId,
        producto_id: ev.producto_id ? (mapa.get(String(ev.producto_id)) ?? null) : null,
      }));
      const { error: et } = await supabase.from('live_timeline_eventos').insert(copia);
      if (et) throw new Error(et.message);
    }
  } catch (e: any) {
    // Si algo falla a medias, se borra la copia para no dejar un live incompleto.
    await supabase.from('live_lives').delete().eq('id', nuevoId);
    const copiados = [...mapa.values()];
    if (copiados.length) {
      await supabase.from('live_producto_colores').delete().in('producto_id', copiados);
      await supabase.from('live_productos').delete().in('id', copiados);
    }
    return NextResponse.json({ error: 'No se pudo duplicar: ' + (e?.message ?? 'error') }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: nuevoId, slug });
}

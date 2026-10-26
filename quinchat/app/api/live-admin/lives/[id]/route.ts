import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { haySesion } from '@/lib/live/admin-guard';

export const dynamic = 'force-dynamic';

// GET: un live completo (datos + productos vinculados + colores + línea de tiempo).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data: live, error } = await supabase.from('live_lives').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!live) return NextResponse.json({ error: 'no existe' }, { status: 404 });

  const [{ data: enlaces }, { data: timeline }] = await Promise.all([
    supabase.from('live_lives_productos').select('producto_id, orden').eq('live_id', id).order('orden'),
    supabase.from('live_timeline_eventos').select('*').eq('live_id', id).order('inicio_seg'),
  ]);
  const ids = (enlaces ?? []).map((e: any) => e.producto_id);
  let productos: any[] = [];
  if (ids.length) {
    const [{ data: prods }, { data: cols }] = await Promise.all([
      supabase.from('live_productos').select('*').in('id', ids),
      supabase.from('live_producto_colores').select('*').in('producto_id', ids).order('orden'),
    ]);
    const orden = new Map<string, number>((enlaces ?? []).map((e: any) => [String(e.producto_id), e.orden ?? 0]));
    productos = (prods ?? [])
      .map((p: any) => ({ ...p, colores: (cols ?? []).filter((c: any) => c.producto_id === p.id) }))
      .sort((a, b) => (orden.get(String(a.id)) ?? 0) - (orden.get(String(b.id)) ?? 0));
  }
  return NextResponse.json({ live, productos, timeline: timeline ?? [] });
}

const CAMPOS = ['slug', 'titulo', 'tienda_nombre', 'tienda_logo', 'etiqueta_grabada', 'video_url', 'poster_url', 'duracion_seg', 'whatsapp', 'modo', 'estado', 'ciclo_inicio', 'comentarios', 'embudo_slug', 'pixel_meta', 'pixel_tiktok'];

// PATCH: actualiza campos del live.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, any> = {};
  for (const k of CAMPOS) if (k in b) patch[k] = b[k];
  if ('etiqueta_grabada' in patch) {
    const v = String(patch.etiqueta_grabada ?? '').trim();
    patch.etiqueta_grabada = (!v || /en vivo/i.test(v)) ? 'Presentación grabada' : v.slice(0, 60);
  }
  // Píxeles: solo el ID (números/letras). Si pegan el código completo, se extrae el ID.
  if ('pixel_meta' in patch) {
    const v = String(patch.pixel_meta ?? '').trim();
    const id15 = v.match(/\d{10,20}/)?.[0] ?? '';
    if (v && !id15) return NextResponse.json({ error: 'El Pixel de Meta debe ser el número del píxel (ej. 1234567890123456).' }, { status: 400 });
    patch.pixel_meta = id15 || null;
  }
  if ('pixel_tiktok' in patch) {
    const v = String(patch.pixel_tiktok ?? '').trim();
    const idTk = (v.match(/ttq\.load\(\s*['"]([A-Z0-9]{10,30})['"]/i)?.[1] ?? v.match(/^[A-Z0-9]{10,30}$/i)?.[0] ?? '').toUpperCase();
    if (v && !idTk) return NextResponse.json({ error: 'El Pixel de TikTok debe ser el ID del píxel (ej. CXXXXXXXXXXXXXXXXXXX).' }, { status: 400 });
    patch.pixel_tiktok = idTk || null;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nada que actualizar' }, { status: 400 });
  const supabase = createServerSupabaseClient();

  // Slug: formato de link y sin chocar con otro live ni con un embudo (comparten pedido.klixmant.shop/<slug>)
  if ('slug' in patch) {
    const s = String(patch.slug ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    if (!s) return NextResponse.json({ error: 'La dirección (slug) no puede quedar vacía.' }, { status: 400 });
    const [{ data: otroLive }, { data: embudo }] = await Promise.all([
      supabase.from('live_lives').select('id').eq('slug', s).neq('id', id).maybeSingle(),
      supabase.from('funnels').select('id').eq('slug', s).maybeSingle(),
    ]);
    if (embudo) return NextResponse.json({ error: `"${s}" ya es el link de un embudo. Elige otro nombre.` }, { status: 409 });
    if (otroLive) return NextResponse.json({ error: `"${s}" ya lo usa otro live.` }, { status: 409 });
    patch.slug = s;
  }
  const { error } = await supabase.from('live_lives').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: borra el live (sus productos quedan; se desvinculan en cascada).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('live_lives').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

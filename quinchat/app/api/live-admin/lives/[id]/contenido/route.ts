import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { haySesion } from '@/lib/live/admin-guard';

export const dynamic = 'force-dynamic';

const num = (v: any) => Number(v) || 0;
const TIPOS = new Set(['producto', 'pregunta_frecuente', 'comentario']);

/**
 * PUT: reemplaza de una vez los PRODUCTOS vinculados y la LÍNEA DE TIEMPO del live.
 * Body: { productos: [{producto_id, orden}], timeline: [{inicio_seg, fin_seg, tipo, producto_id?, pregunta?, respuesta?, autor?, texto?, es_demo?}] }
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const supabase = createServerSupabaseClient();

  // Productos vinculados
  if (Array.isArray(b?.productos)) {
    await supabase.from('live_lives_productos').delete().eq('live_id', id);
    const filas = b.productos
      .map((p: any, i: number) => ({ live_id: id, producto_id: String(p?.producto_id ?? ''), orden: Number(p?.orden ?? i) }))
      .filter((p: any) => p.producto_id);
    if (filas.length) {
      const { error } = await supabase.from('live_lives_productos').insert(filas);
      if (error) return NextResponse.json({ error: `productos: ${error.message}` }, { status: 500 });
    }
  }

  // Línea de tiempo
  if (Array.isArray(b?.timeline)) {
    await supabase.from('live_timeline_eventos').delete().eq('live_id', id);
    const filas = b.timeline
      .filter((e: any) => TIPOS.has(e?.tipo) && num(e?.fin_seg) > num(e?.inicio_seg))
      .map((e: any, i: number) => ({
        live_id: id,
        inicio_seg: num(e.inicio_seg),
        fin_seg: num(e.fin_seg),
        tipo: e.tipo,
        producto_id: e.tipo === 'producto' ? (e.producto_id || null) : null,
        pregunta: e.tipo === 'pregunta_frecuente' ? (e.pregunta ?? '') : null,
        respuesta: e.tipo === 'pregunta_frecuente' ? (e.respuesta ?? '') : null,
        autor: e.tipo === 'comentario' ? (e.autor ?? 'Cliente DEMO') : null,
        texto: e.tipo === 'comentario' ? (e.texto ?? '') : null,
        es_demo: e.tipo === 'comentario' ? (e.es_demo !== false) : false,
        orden: i,
      }));
    if (filas.length) {
      const { error } = await supabase.from('live_timeline_eventos').insert(filas);
      if (error) return NextResponse.json({ error: `timeline: ${error.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { normalizarPregunta } from '@/lib/faq';

export const dynamic = 'force-dynamic';

/** Listar preguntas por estado: ?estado=propuesta | aprobada | descartada */
export async function GET(req: NextRequest) {
  const estado = req.nextUrl.searchParams.get('estado') ?? 'propuesta';
  const supabase = createServerSupabaseClient();

  // Propuestas: las más preguntadas primero. Aprobadas: por fecha de aprobación.
  const orden = estado === 'aprobada' ? 'aprobada_at' : 'veces';
  const { data, error } = await supabase
    .from('faq_bot')
    .select('*')
    .eq('estado', estado)
    .order(orden, { ascending: false })
    .limit(400);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count: pendientes } = await supabase
    .from('faq_bot').select('*', { count: 'exact', head: true }).eq('estado', 'propuesta');
  const { count: aprobadas } = await supabase
    .from('faq_bot').select('*', { count: 'exact', head: true }).eq('estado', 'aprobada');

  return NextResponse.json({ faqs: data ?? [], pendientes: pendientes ?? 0, aprobadas: aprobadas ?? 0 });
}

/** Aprobar, descartar, restaurar, borrar, crear o editar una pregunta. */
export async function POST(req: NextRequest) {
  try {
    const { accion, id, pregunta, respuesta, categoria } = await req.json();
    const supabase = createServerSupabaseClient();
    const ahora = new Date().toISOString();

    if (accion === 'aprobar') {
      if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
      const cambios: Record<string, unknown> = { estado: 'aprobada', aprobada_at: ahora };
      if (pregunta?.trim())  cambios.pregunta = pregunta.trim();
      if (respuesta?.trim())  cambios.respuesta = respuesta.trim();
      if (categoria)          cambios.categoria = categoria;
      const { error } = await supabase.from('faq_bot').update(cambios).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'guardar') {
      // Editar sin cambiar el estado (corregir una ya aprobada, por ejemplo).
      if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
      const cambios: Record<string, unknown> = {};
      if (pregunta?.trim())  cambios.pregunta = pregunta.trim();
      if (respuesta?.trim())  cambios.respuesta = respuesta.trim();
      if (categoria)          cambios.categoria = categoria;
      if (!Object.keys(cambios).length) return NextResponse.json({ ok: true });
      const { error } = await supabase.from('faq_bot').update(cambios).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'descartar') {
      if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
      const { error } = await supabase.from('faq_bot')
        .update({ estado: 'descartada', aprobada_at: null }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'restaurar') {
      if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
      const { error } = await supabase.from('faq_bot')
        .update({ estado: 'propuesta' }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'borrar-definitivo') {
      if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
      const { error } = await supabase.from('faq_bot').delete().eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'crear') {
      if (!pregunta?.trim() || !respuesta?.trim())
        return NextResponse.json({ error: 'Escribe la pregunta y la respuesta.' }, { status: 400 });
      const { error } = await supabase.from('faq_bot').insert({
        pregunta: pregunta.trim(),
        pregunta_norm: normalizarPregunta(pregunta),
        respuesta: respuesta.trim(),
        categoria: categoria ?? 'Otros',
        estado: 'aprobada',
        veces: 1,
        creada_at: ahora,
        aprobada_at: ahora,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'aprobar-todas') {
      const { error } = await supabase.from('faq_bot')
        .update({ estado: 'aprobada', aprobada_at: ahora }).eq('estado', 'propuesta');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

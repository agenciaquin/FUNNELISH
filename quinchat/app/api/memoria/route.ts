import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

/** Listar reglas por estado: ?estado=propuesta | aprobada | descartada */
export async function GET(req: NextRequest) {
  const estado = req.nextUrl.searchParams.get('estado') ?? 'propuesta';
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('memoria_bot')
    .select('*')
    .eq('estado', estado)
    .order(estado === 'aprobada' ? 'aprobada_at' : 'creada_at', { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cuántas hay de cada tipo, para los contadores del panel
  const { count: pendientes } = await supabase
    .from('memoria_bot').select('*', { count: 'exact', head: true }).eq('estado', 'propuesta');
  const { count: aprendidas } = await supabase
    .from('memoria_bot').select('*', { count: 'exact', head: true }).eq('estado', 'aprobada');

  return NextResponse.json({ reglas: data ?? [], pendientes: pendientes ?? 0, aprendidas: aprendidas ?? 0 });
}

/** Aprobar, descartar, editar o crear una regla a mano. */
export async function POST(req: NextRequest) {
  try {
    const { accion, id, regla, categoria } = await req.json();
    const supabase = createServerSupabaseClient();
    const ahora = new Date().toISOString();

    if (accion === 'aprobar') {
      if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
      const cambios: Record<string, unknown> = { estado: 'aprobada', aprobada_at: ahora };
      // Permite corregir el texto en el mismo momento de aprobar
      if (regla?.trim()) cambios.regla = regla.trim();
      if (categoria) cambios.categoria = categoria;
      const { error } = await supabase.from('memoria_bot').update(cambios).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'descartar') {
      if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
      // NO se borra: se marca como descartada para que el bot NUNCA vuelva a
      // proponerla. Si se borrara, mañana la sugeriría otra vez.
      const { error } = await supabase.from('memoria_bot')
        .update({ estado: 'descartada', aprobada_at: null }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'restaurar') {
      if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
      const { error } = await supabase.from('memoria_bot')
        .update({ estado: 'propuesta' }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'borrar-definitivo') {
      if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
      const { error } = await supabase.from('memoria_bot').delete().eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'crear') {
      if (!regla?.trim()) return NextResponse.json({ error: 'Escribe la regla.' }, { status: 400 });
      const { error } = await supabase.from('memoria_bot').insert({
        regla: regla.trim(),
        categoria: categoria ?? 'Otros',
        estado: 'aprobada',
        creada_at: ahora,
        aprobada_at: ahora,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'aprobar-todas') {
      const { error } = await supabase.from('memoria_bot')
        .update({ estado: 'aprobada', aprobada_at: ahora }).eq('estado', 'propuesta');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

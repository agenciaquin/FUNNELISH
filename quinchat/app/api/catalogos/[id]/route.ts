import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

/** PUT /api/catalogos/[id] — actualizar familia/patrón, o restaurar de la papelera */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const supabase = createServerSupabaseClient();

  // Restaurar desde la papelera → vuelve a estar activo
  if (body.accion === 'restaurar') {
    const { error } = await supabase.from('catalogos_bot').update({ activo: true }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const campos: Record<string, unknown> = { familia: body.familia, patron: body.patron };
  if (body.anuncios !== undefined) campos.anuncios = String(body.anuncios ?? '').trim() || null;

  let { data, error } = await supabase
    .from('catalogos_bot').update(campos).eq('id', id)
    .select('*, catalogo_colores(*)').single();

  // Si aún no existe la columna anuncios, se guarda sin ella
  if (error && /column .*anuncios.* does not exist/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('catalogos_bot').update({ familia: body.familia, patron: body.patron }).eq('id', id)
      .select('*, catalogo_colores(*)').single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * DELETE /api/catalogos/[id]
 *  - normal: manda el catálogo a la PAPELERA (activo=false, recuperable).
 *  - ?permanente=1: lo elimina de verdad (y sus colores en cascada). Irreversible.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permanente = req.nextUrl.searchParams.get('permanente') === '1';
  const supabase = createServerSupabaseClient();

  if (permanente) {
    const { error } = await supabase.from('catalogos_bot').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, permanente: true });
  }

  const { error } = await supabase.from('catalogos_bot').update({ activo: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

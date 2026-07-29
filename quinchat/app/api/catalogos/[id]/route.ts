import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

/** PUT /api/catalogos/[id] — actualizar familia o patrón */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const supabase = createServerSupabaseClient();
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

/** DELETE /api/catalogos/[id] — eliminar catálogo (y sus colores en cascada) */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('catalogos_bot').update({ activo: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

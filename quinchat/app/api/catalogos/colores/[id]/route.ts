import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

/** PUT /api/catalogos/colores/[id] — actualizar un color */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('catalogo_colores')
    .update({
      color:           body.color,
      nombre_producto: body.nombre_producto,
      url_imagen:      body.url_imagen ?? null,
      ...(body.orden !== undefined ? { orden: body.orden } : {}),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/catalogos/colores/[id] — eliminar un color */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('catalogo_colores').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

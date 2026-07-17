import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

/** PUT /api/catalogos/[id] — actualizar familia o patrón */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('catalogos_bot')
    .update({ familia: body.familia, patron: body.patron })
    .eq('id', params.id)
    .select('*, catalogo_colores(*)')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/catalogos/[id] — eliminar catálogo (y sus colores en cascada) */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('catalogos_bot').update({ activo: false }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

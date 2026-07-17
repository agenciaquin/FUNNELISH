import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

/** POST /api/catalogos/[id]/colores — agregar color a un catálogo */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const color           = String(body.color           ?? '').trim();
  const nombre_producto = String(body.nombre_producto ?? '').trim();
  const url_imagen      = String(body.url_imagen      ?? '').trim() || null;
  if (!color || !nombre_producto)
    return NextResponse.json({ error: 'color y nombre_producto requeridos' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('catalogo_colores')
    .insert({ catalogo_id: params.id, color, nombre_producto, url_imagen })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

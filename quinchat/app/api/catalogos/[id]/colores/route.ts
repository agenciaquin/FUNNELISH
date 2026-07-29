import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { estamparNombre } from '@/lib/watermark';

/** POST /api/catalogos/[id]/colores — agregar color a un catálogo */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const color           = String(body.color           ?? '').trim();
  const nombre_producto = String(body.nombre_producto ?? '').trim();
  const url_imagen      = String(body.url_imagen      ?? '').trim() || null;
  if (!color || !nombre_producto)
    return NextResponse.json({ error: 'color y nombre_producto requeridos' }, { status: 400 });

  const supabase = createServerSupabaseClient();

  // Estampar el nombre del producto en la foto (marca de agua). Guarda la
  // original aparte para poder re-estampar si luego cambia el nombre.
  let urlImagen  = url_imagen;
  let urlOriginal: string | null = null;
  if (url_imagen) {
    const marcada = await estamparNombre(supabase, url_imagen, nombre_producto, `${id}-${Date.now()}`);
    urlOriginal = url_imagen;
    urlImagen   = marcada ?? url_imagen;
  }

  const { data, error } = await supabase
    .from('catalogo_colores')
    .insert({ catalogo_id: id, color, nombre_producto, url_imagen: urlImagen, url_original: urlOriginal })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

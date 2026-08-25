import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { estamparNombre } from '@/lib/watermark';
import { tenantActual } from '@/lib/tenant';

/** PUT /api/catalogos/colores/[id] — actualizar un color */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const supabase = createServerSupabaseClient();

  const nombre = String(body.nombre_producto ?? '').trim();
  const urlEntrante = body.url_imagen ? String(body.url_imagen) : null;

  // Estado actual (para saber cuál es la foto ORIGINAL limpia y si algo cambió).
  const { data: actual } = await supabase
    .from('catalogo_colores')
    .select('url_imagen, url_original, nombre_producto')
    .eq('id', id).eq('tenant_id', tid).maybeSingle();
  if (!actual) return NextResponse.json({ error: 'Color no encontrado' }, { status: 404 });

  let urlImagen  = urlEntrante;
  let urlOriginal = (actual as any)?.url_original ?? null;

  if (urlEntrante && nombre) {
    // ¿Subieron una foto NUEVA? (distinta a la marcada y a la original guardada)
    const esNueva = urlEntrante !== (actual as any)?.url_imagen
                 && urlEntrante !== (actual as any)?.url_original;
    // Fuente limpia sobre la que estampar: la nueva, o la original ya guardada.
    const fuente = esNueva ? urlEntrante : (urlOriginal ?? urlEntrante);

    const cambioNombre = nombre !== String((actual as any)?.nombre_producto ?? '');
    // Solo re-estampar si hay foto nueva o cambió el nombre (evita trabajo al reordenar).
    if (esNueva || cambioNombre || !(actual as any)?.url_original) {
      const marcada = await estamparNombre(supabase, fuente, nombre, id);
      urlOriginal = fuente;
      urlImagen   = marcada ?? fuente; // si falla la marca, usa la original
    } else {
      urlImagen = (actual as any)?.url_imagen ?? urlEntrante;
    }
  }

  const { data, error } = await supabase
    .from('catalogo_colores')
    .update({
      color:           body.color,
      nombre_producto: body.nombre_producto,
      url_imagen:      urlImagen,
      url_original:    urlOriginal,
      ...(body.orden !== undefined ? { orden: body.orden } : {}),
    })
    .eq('id', id)
    .eq('tenant_id', tid)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/catalogos/colores/[id] — eliminar un color */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('catalogo_colores').delete().eq('id', id).eq('tenant_id', tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

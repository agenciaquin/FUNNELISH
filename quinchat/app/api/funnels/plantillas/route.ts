import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Plantillas de EMBUDO (diseño por bloques o embudo completo).
// Tabla: plantillas_embudo (la tabla `plantillas` es de WhatsApp).

/** Lista las plantillas de embudo. */
export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('plantillas_embudo').select('*').order('creado_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plantillas: data ?? [] });
}

/** Crea una plantilla nueva (diseño o embudo completo). */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const nombre = String(b?.nombre ?? '').trim();
    if (!nombre) return NextResponse.json({ error: 'Falta el nombre de la plantilla.' }, { status: 400 });

    const fila = {
      nombre,
      categoria: String(b?.categoria ?? '').trim() || null,
      tipo: b?.tipo === 'completa' ? 'completa' : 'diseno',
      layout: b?.layout ?? null,
      datos: b?.datos ?? null,
      thumb: String(b?.thumb ?? '').trim() || null,
    };

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.from('plantillas_embudo').insert(fila).select('id').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

/** Actualiza una plantilla existente. */
export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json();
    const id = String(b?.id ?? '');
    if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

    const cambios: Record<string, any> = {};
    if (b.nombre !== undefined)    cambios.nombre    = String(b.nombre).trim();
    if (b.categoria !== undefined) cambios.categoria = String(b.categoria).trim() || null;
    if (b.tipo !== undefined)      cambios.tipo      = b.tipo === 'completa' ? 'completa' : 'diseno';
    if (b.layout !== undefined)    cambios.layout    = b.layout ?? null;
    if (b.datos !== undefined)     cambios.datos     = b.datos ?? null;
    if (b.thumb !== undefined)     cambios.thumb     = String(b.thumb ?? '').trim() || null;

    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from('plantillas_embudo').update(cambios).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

/** Elimina una plantilla. */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('plantillas_embudo').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

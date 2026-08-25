import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/** PUT /api/catalogos/[id] — actualizar familia o patrón */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const supabase = createServerSupabaseClient();
  const campos: Record<string, unknown> = { familia: body.familia, patron: body.patron };
  if (body.anuncios !== undefined) campos.anuncios = String(body.anuncios ?? '').trim() || null;
  if (body.anuncios_fechas !== undefined) campos.anuncios_fechas = (body.anuncios_fechas && typeof body.anuncios_fechas === 'object') ? body.anuncios_fechas : {};
  if (body.mensaje_bienvenida !== undefined) campos.mensaje_bienvenida = String(body.mensaje_bienvenida ?? '').trim() || null;
  if (body.llamado_accion !== undefined) campos.llamado_accion = String(body.llamado_accion ?? '').trim() || null;
  if (body.usar_entrenamiento !== undefined) campos.usar_entrenamiento = body.usar_entrenamiento === true;

  let { data, error } = await supabase
    .from('catalogos_bot').update(campos).eq('id', id).eq('tenant_id', tid)
    .select('*, catalogo_colores(*)').single();

  // Si faltan las columnas nuevas (CTA / entrenamiento), reintenta sin ellas.
  if (error && /column .*(llamado_accion|usar_entrenamiento).* does not exist/i.test(error.message)) {
    const c1: Record<string, unknown> = { familia: body.familia, patron: body.patron };
    if (body.anuncios !== undefined) c1.anuncios = String(body.anuncios ?? '').trim() || null;
    if (body.anuncios_fechas !== undefined) c1.anuncios_fechas = (body.anuncios_fechas && typeof body.anuncios_fechas === 'object') ? body.anuncios_fechas : {};
    if (body.mensaje_bienvenida !== undefined) c1.mensaje_bienvenida = String(body.mensaje_bienvenida ?? '').trim() || null;
    ({ data, error } = await supabase
      .from('catalogos_bot').update(c1).eq('id', id).eq('tenant_id', tid)
      .select('*, catalogo_colores(*)').single());
  }
  // Si aún no existe la columna anuncios, se guarda sin ella
  if (error && /column .*(anuncios_fechas|mensaje_bienvenida).* does not exist/i.test(error.message)) {
    const c2: Record<string, unknown> = { familia: body.familia, patron: body.patron };
    if (body.anuncios !== undefined) c2.anuncios = String(body.anuncios ?? '').trim() || null;
    ({ data, error } = await supabase
      .from('catalogos_bot').update(c2).eq('id', id).eq('tenant_id', tid)
      .select('*, catalogo_colores(*)').single());
  }
  if (error && /column .*anuncios.* does not exist/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('catalogos_bot').update({ familia: body.familia, patron: body.patron }).eq('id', id).eq('tenant_id', tid)
      .select('*, catalogo_colores(*)').single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** PATCH /api/catalogos/[id] — restaurar un catálogo desde la papelera. */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const supabase = createServerSupabaseClient();
  let { error } = await supabase.from('catalogos_bot').update({ activo: true, eliminado_at: null }).eq('id', id).eq('tenant_id', tid);
  // Si aún no existe la columna eliminado_at, restaurar solo con activo.
  if (error && /eliminado_at|column/i.test(error.message ?? '')) {
    ({ error } = await supabase.from('catalogos_bot').update({ activo: true }).eq('id', id).eq('tenant_id', tid));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/catalogos/[id] — a la papelera (activo=false). ?definitivo=1 borra de verdad. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const definitivo = req.nextUrl.searchParams.get('definitivo') === '1';
  const supabase = createServerSupabaseClient();

  if (definitivo) {
    // Borra las variantes primero (por si no hay cascada) y luego el producto.
    await supabase.from('catalogo_colores').delete().eq('catalogo_id', id).eq('tenant_id', tid);
    const { error } = await supabase.from('catalogos_bot').delete().eq('id', id).eq('tenant_id', tid);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  let { error } = await supabase.from('catalogos_bot').update({ activo: false, eliminado_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', tid);
  if (error && /eliminado_at|column/i.test(error.message ?? '')) {
    ({ error } = await supabase.from('catalogos_bot').update({ activo: false }).eq('id', id).eq('tenant_id', tid));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

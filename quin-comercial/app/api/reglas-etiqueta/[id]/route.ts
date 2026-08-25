import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/** PATCH /api/reglas-etiqueta/[id] — editar condición/etiqueta o activar/desactivar. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const campos: Record<string, unknown> = {};
  if (body.condicion !== undefined) campos.condicion = String(body.condicion ?? '').trim();
  if (body.etiqueta  !== undefined) campos.etiqueta  = String(body.etiqueta ?? '').trim();
  if (body.etiqueta_adicional !== undefined) campos.etiqueta_adicional = String(body.etiqueta_adicional ?? '').trim() || null;
  if (body.activo    !== undefined) campos.activo    = body.activo === true;
  if (!Object.keys(campos).length) return NextResponse.json({ error: 'nada que actualizar' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  let { data, error } = await supabase
    .from('reglas_etiqueta').update(campos).eq('id', id).eq('tenant_id', tid)
    .select('*').single();
  // Si la columna nueva aún no existe (migración sin correr), reintenta sin ella.
  if (error && /column .*etiqueta_adicional.* does not exist/i.test(error.message)) {
    const { etiqueta_adicional, ...resto } = campos as any;
    ({ data, error } = await supabase
      .from('reglas_etiqueta').update(resto).eq('id', id).eq('tenant_id', tid)
      .select('*').single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/reglas-etiqueta/[id] — eliminar la regla. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('reglas_etiqueta').delete().eq('id', id).eq('tenant_id', tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

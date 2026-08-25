import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/** PUT /api/catalogos/variables/[id] — actualizar una variable. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const b = await req.json();
  const campos: Record<string, unknown> = {};
  if (b?.nombre !== undefined)    campos.nombre    = String(b.nombre ?? '').trim();
  if (b?.icono !== undefined)     campos.icono     = String(b.icono ?? '✨').slice(0, 4) || '✨';
  if (b?.con_color !== undefined) campos.con_color = b.con_color === true;
  if (b?.no_repite !== undefined) campos.no_repite = b.no_repite === true;
  if (b?.opciones !== undefined)  campos.opciones  = Array.isArray(b.opciones) ? b.opciones : [];
  if (b?.orden !== undefined)     campos.orden     = Number(b.orden ?? 0) || 0;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('catalogo_variables').update(campos).eq('id', id).eq('tenant_id', tid).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** PATCH /api/catalogos/variables/[id] — restaurar desde la papelera. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from('catalogo_variables').update({ activo: true, eliminado_at: null }).eq('id', id).eq('tenant_id', tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/catalogos/variables/[id] — a la papelera; ?definitivo=1 borra de verdad. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const definitivo = req.nextUrl.searchParams.get('definitivo') === '1';
  const supabase = createServerSupabaseClient();

  const { error } = definitivo
    ? await supabase.from('catalogo_variables').delete().eq('id', id).eq('tenant_id', tid)
    : await supabase.from('catalogo_variables').update({ activo: false, eliminado_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

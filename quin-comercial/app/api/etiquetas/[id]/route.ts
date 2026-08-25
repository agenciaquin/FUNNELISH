import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  let { data, error } = await supabase
    .from('etiquetas')
    .update(body)
    .eq('id', id)
    .eq('tenant_id', tid)
    .select()
    .single();

  // Reintento sin columnas nuevas si la BD todavía no está migrada.
  if (error && /es_estado|base_id|column/i.test(error.message ?? '')) {
    const { es_estado, base_id, ...resto } = body as any;
    ({ data, error } = await supabase
      .from('etiquetas')
      .update(resto)
      .eq('id', id)
      .eq('tenant_id', tid)
      .select()
      .single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from('etiquetas')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

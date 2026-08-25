import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

export async function GET() {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('etiquetas')
    .select('*')
    .eq('tenant_id', tid)
    .order('nombre', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const fila: Record<string, unknown> = { ...body, tenant_id: tid };
  let { data, error } = await supabase.from('etiquetas').insert(fila).select().single();

  // Si la BD aún no tiene las columnas nuevas (es_estado / base_id), se reintenta
  // sin ellas para no romper mientras el cliente no haya corrido la migración.
  if (error && /es_estado|base_id|column/i.test(error.message ?? '')) {
    const { es_estado, base_id, ...resto } = fila as any;
    ({ data, error } = await supabase.from('etiquetas').insert(resto).select().single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

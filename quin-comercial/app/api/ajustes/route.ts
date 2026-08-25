import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

// Ajustes del panel: un registro POR EMPRESA (tenant). Antes era una fila única
// global (id=1); ahora cada cliente tiene el suyo, con upsert por tenant_id.

export async function GET() {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ajustes')
    .select('*')
    .eq('tenant_id', tid)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {});
}

export async function PUT(request: Request) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const body = await request.json();
  // No se acepta id/tenant_id del cliente: se fija el de la sesión.
  const { id: _id, tenant_id: _tid, ...campos } = body ?? {};

  const { data, error } = await supabase
    .from('ajustes')
    .upsert(
      { ...campos, tenant_id: tid, updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/**
 * Ajustes del panel guardados en la base (no en el navegador), para que sean
 * iguales en el computador y en el celular, y para todo el equipo.
 * MULTI-TENANT: cada clave es POR EMPRESA (unique tenant_id + clave).
 */

export async function GET(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const clave = req.nextUrl.searchParams.get('clave');
  const supabase = createServerSupabaseClient();

  if (clave) {
    const { data } = await supabase
      .from('configuracion').select('valor')
      .eq('tenant_id', tid).eq('clave', clave).maybeSingle();
    return NextResponse.json({ valor: data?.valor ?? null });
  }

  const { data } = await supabase
    .from('configuracion').select('clave, valor').eq('tenant_id', tid);
  const todo: Record<string, string> = {};
  for (const f of data ?? []) todo[f.clave] = f.valor;
  return NextResponse.json(todo);
}

export async function POST(req: NextRequest) {
  try {
    const tid = await tenantActual();
    if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { clave, valor } = await req.json();
    if (!clave) return NextResponse.json({ error: 'Falta la clave.' }, { status: 400 });

    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from('configuracion').upsert(
      { tenant_id: tid, clave: String(clave), valor: String(valor ?? ''), actualizado_at: new Date().toISOString() },
      { onConflict: 'tenant_id,clave' }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

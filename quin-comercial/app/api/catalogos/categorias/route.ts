import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/** GET /api/catalogos/categorias — lista (o ?papelera=1). */
export async function GET(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const papelera = req.nextUrl.searchParams.get('papelera') === '1';
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('catalogo_categorias').select('*')
    .eq('tenant_id', tid).eq('activo', !papelera)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/catalogos/categorias — crear categoría. */
export async function POST(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const b = await req.json();
  const nombre = String(b?.nombre ?? '').trim();
  if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });

  const fila = {
    tenant_id: tid,
    nombre,
    columnas: Array.isArray(b?.columnas) ? b.columnas.map((x: any) => String(x)) : [],
    activo: true,
  };
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('catalogo_categorias').insert(fila).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

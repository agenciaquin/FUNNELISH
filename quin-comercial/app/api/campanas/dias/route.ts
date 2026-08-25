import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/** Qué días de gasto hay cargados, para poder revisarlos y corregirlos. */
export async function GET() {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('campanas_gasto')
    .select('plataforma, fecha, gasto')
    .eq('tenant_id', tid)
    .order('fecha', { ascending: false })
    .limit(3000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mapa = new Map<string, { plataforma: string; fecha: string; total: number; campanas: number }>();
  for (const g of data ?? []) {
    const clave = `${g.plataforma}|${g.fecha}`;
    const item = mapa.get(clave) ?? { plataforma: g.plataforma, fecha: g.fecha, total: 0, campanas: 0 };
    item.total += Number(g.gasto ?? 0);
    item.campanas++;
    mapa.set(clave, item);
  }

  const dias = [...mapa.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return NextResponse.json({ dias });
}

/** Borra el gasto de un día y plataforma. Sirve para corregir una carga mal hecha. */
export async function DELETE(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const plataforma = req.nextUrl.searchParams.get('plataforma');
  const fecha      = req.nextUrl.searchParams.get('fecha');
  if (!plataforma || !fecha) {
    return NextResponse.json({ error: 'Falta la plataforma o la fecha.' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from('campanas_gasto').delete()
    .eq('tenant_id', tid).eq('plataforma', plataforma).eq('fecha', fecha);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

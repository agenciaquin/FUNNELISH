import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/** GET /api/catalogos — lista los catálogos del cliente con sus colores.
 *  ?papelera=1 → solo los eliminados (activo=false) para la papelera. */
export async function GET(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const papelera = req.nextUrl.searchParams.get('papelera') === '1';
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('catalogos_bot')
    .select('*, catalogo_colores(*)')
    .eq('tenant_id', tid)
    .eq('activo', !papelera)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/catalogos — crear catálogo */
export async function POST(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const familia = String(body.familia ?? '').trim();
  const patron  = String(body.patron  ?? familia).trim();
  if (!familia) return NextResponse.json({ error: 'familia requerida' }, { status: 400 });

  const anuncios = String(body.anuncios ?? '').trim() || null;
  const anuncios_fechas = (body.anuncios_fechas && typeof body.anuncios_fechas === 'object') ? body.anuncios_fechas : {};
  const mensaje_bienvenida = String(body.mensaje_bienvenida ?? '').trim() || null;
  const llamado_accion = String(body.llamado_accion ?? '').trim() || null;
  const usar_entrenamiento = body.usar_entrenamiento === true;
  const supabase = createServerSupabaseClient();

  let { data, error } = await supabase
    .from('catalogos_bot').insert({ familia, patron, anuncios, anuncios_fechas, mensaje_bienvenida, llamado_accion, usar_entrenamiento, tenant_id: tid })
    .select('*, catalogo_colores(*)').single();

  // Si faltan las columnas nuevas (CTA / entrenamiento), reintenta sin ellas.
  if (error && /column .*(llamado_accion|usar_entrenamiento).* does not exist/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('catalogos_bot').insert({ familia, patron, anuncios, anuncios_fechas, mensaje_bienvenida, tenant_id: tid })
      .select('*, catalogo_colores(*)').single());
  }
  if (error && /column .*(anuncios_fechas|mensaje_bienvenida).* does not exist/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('catalogos_bot').insert({ familia, patron, anuncios, tenant_id: tid })
      .select('*, catalogo_colores(*)').single());
  }
  if (error && /column .*anuncios.* does not exist/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('catalogos_bot').insert({ familia, patron, tenant_id: tid })
      .select('*, catalogo_colores(*)').single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

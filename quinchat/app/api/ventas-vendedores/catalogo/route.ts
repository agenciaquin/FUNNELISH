import { NextResponse } from 'next/server';
import { sincronizarCatalogo, ultimaSync } from '@/lib/ventas-vendedores/catalogo';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Estado de la copia del catálogo. */
export async function GET() {
  const supabase = createServerSupabaseClient();
  const [s, prod, vars] = await Promise.all([
    ultimaSync(),
    Promise.resolve(supabase.from('vv_cat_productos').select('id_item', { count: 'exact', head: true }).eq('activo', true).eq('personalizado', false)),
    Promise.resolve(supabase.from('vv_cat_variantes').select('id', { count: 'exact', head: true }).eq('activo', true)),
  ]);
  return NextResponse.json({ ...s, productos: prod.count ?? 0, variantes: vars.count ?? 0 });
}

/** Botón «Actualizar catálogo». */
export async function POST() {
  const r = await sincronizarCatalogo('boton');
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}

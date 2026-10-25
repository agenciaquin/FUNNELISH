import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { haySesion } from '@/lib/live/admin-guard';

export const dynamic = 'force-dynamic';

/**
 * Lista el catálogo existente (catalogos_bot + catalogo_colores) para poder
 * IMPORTAR un producto al live sin volver a cargar fotos.
 * Devuelve: [{ catalogo_id, familia, colores: [{ nombre, foto_url }] }]
 */
export async function GET() {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const supabase = createServerSupabaseClient();

  const [{ data: fams, error }, { data: cols }] = await Promise.all([
    supabase.from('catalogos_bot').select('id, familia').order('familia'),
    supabase.from('catalogo_colores').select('catalogo_id, color, nombre_producto, url_imagen, orden, activo').order('orden'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const porCat = new Map<string, { nombre: string; foto_url: string }[]>();
  for (const c of cols ?? []) {
    if (c.activo === false) continue;
    const url = String(c.url_imagen ?? '');
    if (!url.startsWith('http')) continue;
    const arr = porCat.get(String(c.catalogo_id)) ?? [];
    arr.push({ nombre: String(c.color || c.nombre_producto || 'Color'), foto_url: url });
    porCat.set(String(c.catalogo_id), arr);
  }

  const productos = (fams ?? [])
    .map((f: any) => ({ catalogo_id: String(f.id), familia: String(f.familia ?? ''), colores: porCat.get(String(f.id)) ?? [] }))
    .filter(p => p.colores.length > 0);

  return NextResponse.json({ productos });
}

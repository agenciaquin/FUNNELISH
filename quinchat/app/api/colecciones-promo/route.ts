import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Colecciones del catálogo de promociones: catálogos filtrados con su propio link.
 *   /promos?col=<slug>   → muestra solo los productos de esa colección.
 * Una colección incluye productos por: lista manual (producto_ids),
 * palabra clave (nombre/categoría/color), y/o categoría exacta.
 * Combinable con ?v=<vendedor>.
 */
function slugify(s: string): string {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 28) || 'coleccion';
}

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('colecciones_promo')
    .select('*')
    .order('creado_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ colecciones: data ?? [] });
}

export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'body inválido' }, { status: 400 }); }

  const nombre = String(b?.nombre ?? '').trim();
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre de la colección.' }, { status: 400 });

  const titulo = String(b?.titulo ?? '').trim() || null;
  const palabra = String(b?.palabra ?? '').trim() || null;
  const categoria = String(b?.categoria ?? '').trim() || null;
  const producto_ids: string[] = Array.isArray(b?.producto_ids)
    ? b.producto_ids.map((x: any) => String(x)).filter(Boolean)
    : [];

  if (!palabra && !categoria && producto_ids.length === 0) {
    return NextResponse.json({ error: 'Elige al menos productos, una palabra clave o una categoría.' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  // Editar existente
  if (b?.id) {
    const upd: any = { nombre, titulo, palabra, categoria, producto_ids };
    if (typeof b?.activo === 'boolean') upd.activo = b.activo;
    const { data, error } = await supabase.from('colecciones_promo').update(upd).eq('id', String(b.id)).select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ coleccion: data });
  }

  // Crear: slug único a partir del nombre
  const base = slugify(nombre);
  let slug = base;
  for (let i = 0; i < 30; i++) {
    const { data: existe } = await supabase.from('colecciones_promo').select('id').eq('slug', slug).maybeSingle();
    if (!existe) break;
    slug = `${base}-${i + 2}`;
  }

  const { data, error } = await supabase
    .from('colecciones_promo')
    .insert({ nombre, slug, titulo, palabra, categoria, producto_ids, activo: true })
    .select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coleccion: data });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('colecciones_promo').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

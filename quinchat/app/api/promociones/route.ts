import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Promociones: productos que se muestran en la página instantánea /promos.
 * - GET            → solo activos.
 * - GET ?admin=1   → todos (para administrar en el panel).
 * - POST           → crea o actualiza (si trae id).
 * - DELETE ?id=    → borra.
 *
 * Todo esto es del panel y pide sesión aquí mismo, además del middleware: sin
 * ella cualquiera podía cambiar precios, stock o borrar promociones. La página
 * pública /promos no llama a esta ruta: lee la base en el servidor.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const admin = req.nextUrl.searchParams.get('admin') === '1';
  const supabase = createServerSupabaseClient();
  let q = supabase.from('promociones').select('*').order('orden', { ascending: true }).order('creado_at', { ascending: false });
  if (!admin) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promociones: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'body inválido' }, { status: 400 }); }

  const nombre = String(b?.nombre ?? '').trim();
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre del producto.' }, { status: 400 });

  const tallas = Array.isArray(b?.tallas) ? b.tallas.map((t: any) => String(t).trim()).filter(Boolean) : [];
  // Stock por talla: { "CABALLERO - M": 3, ... }. Solo se guardan tallas que existen.
  const stockIn = (b?.stock && typeof b.stock === 'object') ? b.stock : {};
  const stock: Record<string, number> = {};
  for (const t of tallas) {
    const n = Math.round(Number(stockIn[t]));
    if (Number.isFinite(n) && n >= 0) stock[t] = n; // solo si el usuario puso un número
  }

  const fila: any = {
    nombre,
    referencia:  String(b?.referencia ?? '').trim() || null,
    destacado:   b?.destacado === true,
    anclado:     b?.anclado === true,
    descripcion: String(b?.descripcion ?? '').trim() || null,
    foto:        String(b?.foto ?? '').trim() || null,
    precio:      Math.round(Number(b?.precio ?? 0)) || 0,
    precio_antes: b?.precio_antes ? Math.round(Number(b.precio_antes)) : null,
    precio_dos:  b?.precio_dos ? Math.round(Number(b.precio_dos)) : null,
    precio_tres: b?.precio_tres ? Math.round(Number(b.precio_tres)) : null,
    tallas,
    stock,
    activo:      b?.activo !== false,
    orden:       Math.round(Number(b?.orden ?? 0)) || 0,
  };
  // Colores/variantes solo se tocan si vienen en el body (para no borrarlos al editar desde el panel).
  if (Array.isArray(b?.colores)) fila.colores = b.colores.map((c: any) => String(c).trim()).filter(Boolean);
  if (b?.variantes && typeof b.variantes === 'object') fila.variantes = b.variantes;
  if (b?.fotos && typeof b.fotos === 'object') fila.fotos = b.fotos;
  if (typeof b?.categoria !== 'undefined') fila.categoria = String(b.categoria ?? '').trim() || null;

  const supabase = createServerSupabaseClient();
  const id = String(b?.id ?? '').trim();
  const { error } = id
    ? await supabase.from('promociones').update(fila).eq('id', id)
    : await supabase.from('promociones').insert(fila);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('promociones').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

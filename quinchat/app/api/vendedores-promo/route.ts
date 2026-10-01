import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Vendedores del catálogo de promociones.
 * Cada vendedor tiene un `codigo` que se usa en el link personalizado:
 *   /promos?v=<codigo>
 * En ese modo el catálogo oculta "COMPRAR AQUÍ" y el botón
 * "COMPRAR POR WHATSAPP" apunta al celular de ese vendedor.
 *
 * Todo es del panel y pide sesión aquí mismo, además del middleware: el GET
 * devuelve el token de cada vendedor, y con un token se descuenta stock.
 */

// Deja el celular en 10 dígitos (quita +57 / 57 y todo lo que no sea número).
function normTel(raw: string): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('57') && d.length >= 12) return d.slice(2, 12);
  return d.slice(-10);
}

// Convierte el nombre en un código corto para el link (sin tildes ni espacios).
function slugify(s: string): string {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'vendedor';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('vendedores_promo')
    .select('*')
    .neq('codigo', '__principal__') // registro interno de la tienda, no es un vendedor
    .order('creado_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendedores: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'body inválido' }, { status: 400 }); }

  const nombre = String(b?.nombre ?? '').trim();
  const celular = normTel(b?.celular);
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre del vendedor.' }, { status: 400 });
  if (!/^3\d{9}$/.test(celular)) return NextResponse.json({ error: 'El celular no es válido (debe tener 10 dígitos y empezar por 3).' }, { status: 400 });

  const supabase = createServerSupabaseClient();

  // Actualizar uno existente.
  if (b?.id) {
    const upd: any = { nombre, celular };
    if (typeof b?.activo === 'boolean') upd.activo = b.activo;
    const { data, error } = await supabase.from('vendedores_promo').update(upd).eq('id', String(b.id)).select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ vendedor: data });
  }

  // Crear: genera un código único a partir del nombre.
  const base = slugify(nombre);
  let codigo = base;
  for (let i = 0; i < 30; i++) {
    const { data: existe } = await supabase.from('vendedores_promo').select('id').eq('codigo', codigo).maybeSingle();
    if (!existe) break;
    codigo = `${base}-${i + 2}`;
  }

  // Token secreto del vendedor: habilita el botón "Marcar vendido" en el link.
  const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^a-z0-9]/gi, '').slice(0, 12);

  const { data, error } = await supabase
    .from('vendedores_promo')
    .insert({ nombre, celular, codigo, token, activo: true })
    .select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendedor: data });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('vendedores_promo').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

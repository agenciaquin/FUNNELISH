import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { haySesion } from '@/lib/live/admin-guard';

export const dynamic = 'force-dynamic';

const aInt = (v: any) => Math.max(0, Math.round(Number(v) || 0));
const CAMPOS = ['nombre', 'descripcion', 'ficha_tela', 'ficha_cuidados', 'precio', 'precio_antes', 'promo_etiqueta', 'promo_unidades', 'promo_precio', 'tallas', 'activo'];
const ENTEROS = new Set(['precio', 'precio_antes', 'promo_unidades', 'promo_precio']);

// PATCH: actualiza un producto y, si vienen colores, los reemplaza por completo.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const supabase = createServerSupabaseClient();

  const patch: Record<string, any> = {};
  for (const k of CAMPOS) if (k in b) patch[k] = ENTEROS.has(k) ? (b[k] == null ? null : aInt(b[k])) : b[k];
  if (Object.keys(patch).length) {
    const { error } = await supabase.from('live_productos').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Reemplazar colores (borrar e insertar) solo si el cliente mandó la lista.
  if (Array.isArray(b?.colores)) {
    await supabase.from('live_producto_colores').delete().eq('producto_id', id);
    const filas = b.colores.map((c: any, i: number) => ({
      producto_id: id, nombre: String(c?.nombre ?? '').trim() || 'Color',
      hex: c?.hex ?? '#888', foto_url: String(c?.foto_url ?? '').trim(), orden: i,
    })).filter((c: any) => c.foto_url);
    if (filas.length) {
      const { error } = await supabase.from('live_producto_colores').insert(filas);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}

// DELETE: borra el producto (sus colores y vínculos caen en cascada).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('live_productos').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

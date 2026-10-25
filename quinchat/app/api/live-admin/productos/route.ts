import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { haySesion } from '@/lib/live/admin-guard';

export const dynamic = 'force-dynamic';

const aInt = (v: any) => Math.max(0, Math.round(Number(v) || 0));

// GET: todos los productos (con colores) para elegir en el editor.
export async function GET() {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const supabase = createServerSupabaseClient();
  const [{ data: prods, error }, { data: cols }] = await Promise.all([
    supabase.from('live_productos').select('*').order('creado_en', { ascending: false }),
    supabase.from('live_producto_colores').select('*').order('orden'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const productos = (prods ?? []).map((p: any) => ({ ...p, colores: (cols ?? []).filter((c: any) => c.producto_id === p.id) }));
  return NextResponse.json({ productos });
}

// POST: crea un producto (+ colores opcionales).
export async function POST(req: NextRequest) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const supabase = createServerSupabaseClient();

  const { data: prod, error } = await supabase.from('live_productos').insert({
    nombre: String(b?.nombre ?? '').trim() || 'Producto',
    descripcion: b?.descripcion ?? null,
    ficha_tela: b?.ficha_tela ?? null,
    ficha_cuidados: b?.ficha_cuidados ?? null,
    precio: aInt(b?.precio),
    precio_antes: b?.precio_antes ? aInt(b.precio_antes) : null,
    promo_etiqueta: b?.promo_etiqueta ?? null,
    promo_unidades: b?.promo_unidades ? aInt(b.promo_unidades) : null,
    promo_precio: b?.promo_precio ? aInt(b.promo_precio) : null,
    tallas: Array.isArray(b?.tallas) && b.tallas.length ? b.tallas : ['S', 'M', 'L', 'XL'],
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const colores = Array.isArray(b?.colores) ? b.colores : [];
  if (colores.length) {
    const filas = colores.map((c: any, i: number) => ({
      producto_id: prod.id, nombre: String(c?.nombre ?? '').trim() || 'Color',
      hex: c?.hex ?? '#888', foto_url: String(c?.foto_url ?? '').trim(), orden: i,
    })).filter((c: any) => c.foto_url);
    if (filas.length) await supabase.from('live_producto_colores').insert(filas);
  }
  return NextResponse.json({ ok: true, id: prod.id });
}

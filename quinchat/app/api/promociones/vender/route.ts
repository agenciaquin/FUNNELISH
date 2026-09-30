import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * "Marcar como vendido" desde el link del vendedor.
 * Descuenta 1 unidad del color+talla indicados. Solo funciona si el `token`
 * coincide con el del vendedor (código), para que un cliente no pueda descontar.
 */
export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'body inválido' }, { status: 400 }); }

  const promoId = String(b?.promoId ?? '').trim();
  const color = String(b?.color ?? '').trim();
  const talla = String(b?.talla ?? '').trim();
  const codigo = String(b?.codigo ?? '').trim();
  const token = String(b?.token ?? '').trim();

  if (!promoId) return NextResponse.json({ error: 'Falta el producto.' }, { status: 400 });
  if (!talla) return NextResponse.json({ error: 'Elige la talla que se vendió.' }, { status: 400 });
  if (!codigo || !token) return NextResponse.json({ error: 'Link de vendedor inválido.' }, { status: 403 });

  const supabase = createServerSupabaseClient();

  // 1) Validar que el token corresponde a ese vendedor.
  const { data: vend } = await supabase
    .from('vendedores_promo')
    .select('token, activo, nombre')
    .eq('codigo', codigo)
    .maybeSingle();
  if (!vend || !vend.activo || String(vend.token) !== token) {
    return NextResponse.json({ error: 'No autorizado para descontar stock.' }, { status: 403 });
  }

  // 2) Traer stock/variantes del producto.
  const { data: promo } = await supabase.from('promociones').select('stock, variantes').eq('id', promoId).maybeSingle();
  if (!promo) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });

  const stock: Record<string, number> = (promo.stock && typeof promo.stock === 'object') ? { ...promo.stock } : {};
  const variantes: Record<string, Record<string, number>> =
    (promo.variantes && typeof promo.variantes === 'object') ? JSON.parse(JSON.stringify(promo.variantes)) : {};
  const usaVariantes = Object.keys(variantes).length > 0;

  // 3) Descontar 1 unidad.
  if (usaVariantes) {
    const porColor = variantes[color];
    if (!porColor || (porColor[talla] ?? 0) <= 0) {
      return NextResponse.json({ error: `Ya no hay stock de ${color || 'ese color'} talla ${talla.replace('CABALLERO - ', '').replace('DAMA - ', '')}.` }, { status: 409 });
    }
    porColor[talla] = porColor[talla] - 1;
    if (Object.prototype.hasOwnProperty.call(stock, talla)) stock[talla] = Math.max(0, (stock[talla] ?? 0) - 1);
  } else {
    if (Object.prototype.hasOwnProperty.call(stock, talla)) {
      if ((stock[talla] ?? 0) <= 0) return NextResponse.json({ error: `Ya no hay stock en la talla ${talla}.` }, { status: 409 });
      stock[talla] = stock[talla] - 1;
    }
    // Si esa talla no lleva control de stock, no hay nada que descontar.
  }

  // 4) Guardar.
  const upd: any = { stock };
  if (usaVariantes) upd.variantes = variantes;
  const { error } = await supabase.from('promociones').update(upd).eq('id', promoId);
  if (error) return NextResponse.json({ error: 'No se pudo actualizar el stock.' }, { status: 500 });

  const restanteColor = usaVariantes ? (variantes[color]?.[talla] ?? 0) : (stock[talla] ?? null);
  const restanteTotal = usaVariantes
    ? Object.values(variantes).reduce((s, m) => s + Object.values(m).reduce((a, n) => a + (Number(n) || 0), 0), 0)
    : Object.values(stock).reduce((a, n) => a + (Number(n) || 0), 0);

  return NextResponse.json({ ok: true, restanteColor, restanteTotal });
}

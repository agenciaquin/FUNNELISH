import type { Funnel } from '@/lib/funnels';

/**
 * DESCUENTO EN LA TIENDA (11-nov-2026, dueño) — opción B.
 *
 * La plantilla del descuento por entrega lleva un botón «Ver la tienda» con un CÓDIGO PROPIO de ese cliente:
 *   https://pedido.klixmant.shop/web/tienda?d=<CODIGO>
 * Solo quien entra con un código VÁLIDO ve el descuento (letrero arriba + precios rebajados en la tienda y en el
 * checkout del embudo). Sin código, o con uno vencido/usado, la página y los embudos salen a PRECIO NORMAL
 * (las campañas activas no cambian). El código se valida en el SERVIDOR al mostrar la página y al recibir el
 * pedido, y se marca usado (una sola compra por código).
 *
 * Tabla: descuentos_entrega.codigo (único) / usado_at / usado_ref. Vigencia: 30 días desde el envío.
 */
export const VIGENCIA_DIAS = 30;
export const TIENDA_DESCUENTO = 'https://pedido.klixmant.shop/web/tienda';
export const urlTiendaDescuento = (codigo: string) => `${TIENDA_DESCUENTO}?d=${encodeURIComponent(codigo)}`;

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I
export function nuevoCodigo(n = 10): string {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, b => LETRAS[b % LETRAS.length]).join('');
}
export const codigoValido = (c: unknown): c is string => typeof c === 'string' && /^[A-Z0-9]{8,16}$/.test(c);

export interface DescuentoActivo { codigo: string; monto: number; nombre: string | null; telefono: string }

/** El código existe, se envió, no se ha usado y no ha vencido. Si no, null (la página sale a precio normal). */
export async function validarDescuento(supabase: any, codigo: unknown): Promise<DescuentoActivo | null> {
  const c = String(codigo ?? '').trim().toUpperCase();
  if (!codigoValido(c)) return null;
  try {
    const { data } = await supabase.from('descuentos_entrega')
      .select('codigo, monto, nombre, telefono, estado, enviado_at, usado_at').eq('codigo', c).maybeSingle();
    if (!data || data.estado !== 'enviado' || data.usado_at || !data.enviado_at) return null;
    if (Date.now() - Date.parse(data.enviado_at) > VIGENCIA_DIAS * 86400_000) return null;
    const monto = Math.max(0, Number(data.monto) || 0);
    if (!monto) return null;
    return { codigo: c, monto, nombre: data.nombre ?? null, telefono: String(data.telefono ?? '') };
  } catch { return null; }
}

/** Marca el código como usado por este pedido (solo una vez). true = se marcó ahora. */
export async function marcarDescuentoUsado(supabase: any, codigo: string, referencia: string): Promise<boolean> {
  const { data } = await supabase.from('descuentos_entrega')
    .update({ usado_at: new Date().toISOString(), usado_ref: referencia })
    .eq('codigo', codigo).is('usado_at', null).select('codigo');
  return !!data?.length;
}

/**
 * Copia del embudo con el descuento aplicado (UNA vez por compra, no por prenda): baja el precio de cada
 * variante y deja el precio original tachado. No toca el embudo guardado.
 */
export function funnelConDescuento(f: Funnel, monto: number): Funnel {
  const baja = (p: number) => Math.max(0, Math.round(Number(p) || 0) - monto);
  const antes = (p: number, pa?: number | null) => Math.max(Number(pa) || 0, Number(p) || 0) || undefined;
  return {
    ...f,
    precio: baja(f.precio),
    precio_antes: antes(f.precio, f.precio_antes) ?? null,
    variantes: (f.variantes ?? []).map(v => ({ ...v, precio: baja(v.precio || f.precio), precioAntes: antes(v.precio || f.precio, v.precioAntes) })),
  };
}

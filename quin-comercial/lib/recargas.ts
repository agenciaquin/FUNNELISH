// =====================================================
// Recargas de conversaciones (Mercado Pago Checkout).
// Solo servidor. Los precios los define la agencia.
// =====================================================

export interface Paquete { conversaciones: number; precio: number } // precio en COP

// TODO Agencia QUIN: ajusta estos precios cuando quieras.
export const PAQUETES: Paquete[] = [
  { conversaciones: 500,  precio: 37000 },
  { conversaciones: 1000, precio: 69000 },
  { conversaciones: 2500, precio: 159000 },
  { conversaciones: 5000, precio: 289000 },
];

export const MONEDA = 'COP';

export function paqueteDe(conversaciones: number): Paquete | null {
  return PAQUETES.find(p => p.conversaciones === conversaciones) ?? null;
}

// =====================================================
// Verificación y acreditación de pagos (compartido por el webhook y la
// confirmación al volver de Mercado Pago). Consultamos el pago con NUESTRO
// token, así nadie puede sumar crédito con una llamada falsa.
// =====================================================

/**
 * Busca un pago en Mercado Pago. Primero por id (lo más confiable); si no hay
 * id, lo busca por external_reference (la recarga). Devuelve el objeto del pago
 * o null. Nunca lanza.
 */
export async function buscarPago(
  token: string,
  opts: { payment_id?: string; external_reference?: string },
): Promise<any | null> {
  const payment_id = (opts.payment_id ?? '').trim();
  const external_reference = (opts.external_reference ?? '').trim();
  try {
    if (payment_id) {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) return await r.json();
    }
    if (external_reference) {
      const r = await fetch(
        `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(external_reference)}&sort=date_created&criteria=desc`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (r.ok) {
        const d = await r.json();
        const results: any[] = d?.results ?? [];
        return results.find(p => p.status === 'approved') ?? results[0] ?? null;
      }
    }
  } catch { /* sin conexión con MP */ }
  return null;
}

/**
 * Si el pago está aprobado, marca la recarga como aprobada y suma el crédito a
 * la empresa. Es ATÓMICO e idempotente: solo suma si la recarga seguía
 * "pendiente" (usa un update condicional), así nunca suma dos veces aunque el
 * webhook y la confirmación corran a la vez.
 */
export async function acreditarPagoAprobado(
  admin: any,
  pago: any,
): Promise<{ estado: 'acreditado' | 'ya' | 'nada'; tenant_id?: string; cantidad?: number; creditos?: number }> {
  if (!pago || pago.status !== 'approved') return { estado: 'nada' };
  const recargaId = String(pago.external_reference ?? '');
  if (!recargaId) return { estado: 'nada' };

  const { data: rec } = await admin
    .from('recargas').select('id, tenant_id, cantidad, estado').eq('id', recargaId).maybeSingle();
  if (!rec) return { estado: 'nada' };
  if (rec.estado === 'aprobada') return { estado: 'ya', tenant_id: rec.tenant_id, cantidad: rec.cantidad };

  // Marca aprobada SOLO si sigue pendiente → gana una sola llamada (anti doble crédito).
  const { data: upd } = await admin
    .from('recargas')
    .update({ estado: 'aprobada', mp_payment_id: String(pago.id ?? ''), aprobada_at: new Date().toISOString() })
    .eq('id', rec.id).eq('estado', 'pendiente').select('id, tenant_id, cantidad');
  if (!upd || upd.length === 0) return { estado: 'ya', tenant_id: rec.tenant_id, cantidad: rec.cantidad };

  const { data: t } = await admin.from('tenants').select('creditos').eq('id', rec.tenant_id).maybeSingle();
  const nuevo = (t?.creditos ?? 0) + rec.cantidad;
  await admin.from('tenants').update({ creditos: nuevo, creditos_tope: nuevo }).eq('id', rec.tenant_id);

  return { estado: 'acreditado', tenant_id: rec.tenant_id, cantidad: rec.cantidad, creditos: nuevo };
}

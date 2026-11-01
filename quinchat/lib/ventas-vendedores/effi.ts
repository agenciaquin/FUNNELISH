import { createServerSupabaseClient } from '@/lib/supabase';
import { ajustesVV } from './config';

/**
 * Subida de una preventa a Effi (módulo Ventas Vendedores).
 *
 * ESTADO: en SIMULACIÓN. QuinChat todavía no tiene la documentación ni las
 * credenciales de la API de Effi, así que aquí se arma la solicitud con los datos
 * reales de la venta, se valida y se GUARDA (effi_payload), pero NO se envía.
 * Cuando lleguen la documentación y las variables EFFI_API_URL / EFFI_API_TOKEN,
 * se completa `enviarReal()` con el formato exacto. Mientras tanto, aunque el
 * interruptor diga 'real', no sale nada.
 *
 * Protecciones: si la venta ya tiene remisión no se vuelve a subir; cada intento
 * queda en vv_eventos; la llave de idempotencia es el código de la preventa.
 */

export function validarParaEffi(venta: any, items: any[]): string[] {
  const e: string[] = [];
  if (!venta.cliente_nombre) e.push('Falta el nombre del cliente');
  if (!/^3\d{9}$/.test(String(venta.cliente_celular ?? ''))) e.push('Celular inválido');
  if (!venta.departamento) e.push('Falta el departamento');
  if (!venta.municipio) e.push('Falta el municipio');
  if (!venta.direccion) e.push('Falta la dirección');
  if (!items.length) e.push('La venta no tiene prendas');
  for (const it of items) {
    if (!it.id_variante) e.push(`Prenda sin variante real: ${it.catalogo ?? it.descripcion ?? '—'}`);
    if (!it.cantidad || it.cantidad < 1) e.push(`Cantidad inválida: ${it.catalogo ?? '—'}`);
  }
  if (!venta.total) e.push('Falta el total');
  return e;
}

/** Solicitud a Effi con los datos reales (formato provisional hasta tener la documentación). */
export function armarSolicitud(venta: any, items: any[]) {
  return {
    idempotencia: venta.codigo,
    cliente: {
      nombre: venta.cliente_nombre, celular: venta.cliente_celular, identificacion: venta.cliente_identificacion || null,
      departamento: venta.departamento, municipio: venta.municipio, direccion: venta.direccion,
      barrio: venta.barrio || null, complemento: venta.complemento || null, referencia: venta.referencia_dir || null,
    },
    transportadora: venta.transportadora || null,
    pago: { tipo: venta.tipo_pago, total: Number(venta.total), abono: Number(venta.abono || 0), cobrar: Number(venta.total) - Number(venta.abono || 0) },
    prendas: items.map(it => ({
      catalogo: it.catalogo, id_catalogo: it.id_catalogo, referencia: it.referencia, sku: it.sku,
      // Por confirmar con Effi: si "Observación concepto" lleva este id de variante
      observacion_concepto: it.id_variante, color: it.color, talla: it.talla, cantidad: it.cantidad, precio: it.precio,
    })),
    vendedor: { telefono: venta.vendedor_tel, nombre: venta.vendedor_nombre },
    observaciones: venta.observaciones || null,
  };
}

export async function subirAEffi(ventaId: string, quien: string): Promise<{ ok: boolean; mensaje: string; simulado?: boolean; errores?: string[] }> {
  const supabase = createServerSupabaseClient();
  const { data: venta } = await supabase.from('vv_ventas').select('*').eq('id', ventaId).maybeSingle();
  if (!venta) return { ok: false, mensaje: 'Venta no encontrada' };
  if (venta.effi_remision) return { ok: false, mensaje: `Ya está en Effi (remisión ${venta.effi_remision}). No se vuelve a subir.` };
  if (venta.estado === 'enviando_effi') return { ok: false, mensaje: 'Ya se está enviando. Espera el resultado.' };
  if (['cancelada', 'recibida', 'incompleta', 'ambigua', 'esperando_confirmacion'].includes(venta.estado)) {
    return { ok: false, mensaje: 'La venta aún no está confirmada por el vendedor.' };
  }
  const { data: items } = await supabase.from('vv_items').select('*').eq('venta_id', ventaId).order('id');
  const errores = validarParaEffi(venta, items ?? []);
  if (errores.length) {
    await supabase.from('vv_eventos').insert({ venta_id: ventaId, tipo: 'validacion', quien, detalle: { ok: false, errores } });
    return { ok: false, mensaje: 'La venta no pasa la validación.', errores };
  }
  const solicitud = armarSolicitud(venta, items ?? []);
  const a = await ajustesVV(true);
  const listoReal = a.envio_effi === 'real' && !!process.env.EFFI_API_URL && !!process.env.EFFI_API_TOKEN;

  if (!listoReal) {
    await supabase.from('vv_ventas').update({
      estado: 'lista_effi', effi_estado: 'simulado', effi_payload: solicitud, actualizado_at: new Date().toISOString(),
    }).eq('id', ventaId);
    await supabase.from('vv_eventos').insert({ venta_id: ventaId, tipo: 'effi_simulado', quien, detalle: { solicitud } });
    return { ok: true, simulado: true, mensaje: 'Simulación: la solicitud quedó armada y guardada. No se envió a Effi.' };
  }

  // Envío real: pendiente de la documentación de la API de Effi.
  await supabase.from('vv_eventos').insert({ venta_id: ventaId, tipo: 'effi_error', quien, detalle: { error: 'Integración real con Effi aún no implementada' } });
  return { ok: false, mensaje: 'El envío real a Effi aún no está implementado: falta la documentación de su API.' };
}

import { createServerSupabaseClient } from '@/lib/supabase';
import { armarRemision } from './effi-remision';
import { ajustesVV } from './config';
import { effiPost, effiEscrituraConfigurada } from '@/lib/effi-api';

/**
 * Subida de una preventa a Effi (módulo Ventas Vendedores).
 *
 * ESTADO: VISTA PREVIA (07-nov-2026). Se arma la remisión con el formato real de
 * Effi (effi-remision.ts), consultando Effi solo con GET, y se GUARDA en effi_payload.
 * NO se envía: el POST real llega en la Fase 3, con autorización del dueño y clave
 * de escritura. Aunque el interruptor diga 'real', hoy no sale nada.
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
      correo: venta.cliente_correo || 'gerencia@klixmant.com',
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

/**
 * ENVÍO REAL a Effi (POST api/remision_v). Candados:
 *  1. Clave de escritura aparte (EFFI_API_TOKEN_ESCRITURA).
 *  2. Autorización: el código de la venta está en ajustes_bot.effi_remision.autorizadas,
 *     o el módulo está en envio_effi = 'real' (uso diario, Fase 4).
 *  3. Bloqueo atómico: solo una petición puede pasar la venta a 'enviando_effi'.
 *  4. idempotency_key qc-<código>: si se repite, Effi responde 409 y no crea otra.
 *  5. Clientes nuevos: todavía NO se crean por API (Fase 3 = cliente ya existente).
 */
async function enviarReal(venta: any, payload: any, rem: Awaited<ReturnType<typeof armarRemision>>, quien: string) {
  const supabase = createServerSupabaseClient();
  const ahora = new Date().toISOString();
  const guardarVista = () => supabase.from('vv_ventas').update({ effi_payload: payload, actualizado_at: ahora }).eq('id', venta.id);

  if (!effiEscrituraConfigurada()) {
    await guardarVista();
    return { ok: false, mensaje: 'Falta la clave de escritura de Effi (EFFI_API_TOKEN_ESCRITURA en Vercel). No se envió nada.' };
  }
  const { data: cfg } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'effi_remision').maybeSingle();
  const autorizadas: string[] = Array.isArray((cfg?.valor as any)?.autorizadas) ? (cfg!.valor as any).autorizadas : [];
  const a = await ajustesVV(true);
  if (!autorizadas.includes(venta.codigo) && a.envio_effi !== 'real') {
    await guardarVista();
    return { ok: false, mensaje: 'Esta venta no está autorizada para subir a Effi todavía. No se envió nada.' };
  }
  if (!rem.solicitud?.cliente || rem.crear_cliente) {
    await guardarVista();
    return { ok: false, mensaje: 'El cliente no existe en Effi y la creación de clientes por API aún no está habilitada. Créalo en Effi y vuelve a intentar.' };
  }

  // Bloqueo atómico
  const { data: tomada } = await supabase.from('vv_ventas')
    .update({ estado: 'enviando_effi', effi_payload: payload, effi_intentos: (Number(venta.effi_intentos) || 0) + 1, actualizado_at: ahora })
    .eq('id', venta.id).is('effi_remision', null).in('estado', ['confirmada', 'lista_effi', 'error_effi', 'escalada'])
    .select('id').maybeSingle();
  if (!tomada) return { ok: false, mensaje: 'La venta ya se está enviando o ya está en Effi.' };

  let status = 0, json: any = null, falla: string | null = null;
  try {
    ({ status, json } = await effiPost('remision_v', rem.solicitud));
  } catch (e: any) {
    falla = e?.message ?? String(e);
  }
  const fin = new Date().toISOString();

  if (!falla && (status === 200 || status === 201) && json?.ok) {
    const d = json.data ?? {};
    const numero = String(d.id_transaccion || (d.prefijo ? `${d.prefijo}-${d.id}` : d.id) || '').trim() || 'creada';
    await supabase.from('vv_ventas').update({
      estado: 'en_effi', effi_estado: 'enviada', effi_remision: numero, effi_enviado_at: fin,
      effi_respuesta: { status, ...json }, actualizado_at: fin,
    }).eq('id', venta.id);
    await supabase.from('vv_eventos').insert({ venta_id: venta.id, tipo: 'effi_enviada', quien, detalle: { remision: numero, respuesta: json } });
    return { ok: true, mensaje: `✅ Remisión creada en Effi: ${numero} (total ${d.total ?? '—'}).` };
  }

  const msg = falla
    ? `Sin respuesta de Effi (${falla}). Revisa en Effi si la remisión quedó creada antes de reintentar; si se reintenta, Effi rechaza el duplicado.`
    : status === 409
      ? 'Effi dice que esta remisión YA fue creada (clave anti-duplicado). Búscala en Effi y anota el número; no se creó otra.'
      : `Effi rechazó la remisión (${status}): ${json?.mensaje ?? ''} ${JSON.stringify(json?.errores ?? json?.errors ?? '')}`.trim();
  await supabase.from('vv_ventas').update({
    estado: 'error_effi', effi_estado: 'error', effi_respuesta: { status, falla, ...(json ?? {}) }, actualizado_at: fin,
  }).eq('id', venta.id);
  await supabase.from('vv_eventos').insert({ venta_id: venta.id, tipo: 'effi_error', quien, detalle: { error: msg, status, respuesta: json } });
  return { ok: false, mensaje: msg };
}

export async function subirAEffi(ventaId: string, quien: string, enviar = false): Promise<{ ok: boolean; mensaje: string; simulado?: boolean; errores?: string[] }> {
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

  // 07-nov-2026: remisión con el formato REAL de Effi (solo consulta a Effi; no se envía).
  const rem = await armarRemision(venta, items ?? []);
  const ahora = new Date().toISOString();
  const payload = { formato: 'remision_v', solicitud: rem.solicitud, crear_cliente: rem.crear_cliente, vista: rem.vista, avisos: rem.avisos, errores: rem.errores, armado_at: ahora };
  if (!rem.ok) {
    await supabase.from('vv_ventas').update({ effi_payload: payload, actualizado_at: ahora }).eq('id', ventaId);
    await supabase.from('vv_eventos').insert({ venta_id: ventaId, tipo: 'validacion', quien, detalle: { ok: false, errores: rem.errores } });
    return { ok: false, mensaje: 'Falta completar datos para Effi.', errores: rem.errores };
  }

  if (enviar) return enviarReal(venta, payload, rem, quien);

  // Primer clic: solo vista previa. El envío real es un segundo paso explícito.
  await supabase.from('vv_ventas').update({
    estado: 'lista_effi', effi_estado: 'simulado', effi_payload: payload, actualizado_at: ahora,
  }).eq('id', ventaId);
  await supabase.from('vv_eventos').insert({ venta_id: ventaId, tipo: 'effi_simulado', quien, detalle: { solicitud: rem.solicitud, crear_cliente: rem.crear_cliente } });
  return { ok: true, simulado: true, mensaje: 'Vista previa lista: así quedaría la remisión en Effi. No se envió nada.' };
}

import { createServerSupabaseClient } from '@/lib/supabase';
import { effiGet } from '@/lib/effi-api';
import { sinTildes } from './catalogo';

/**
 * Arma la REMISIÓN DE VENTA de Effi (POST api/remision_v) para una preventa del
 * módulo Ventas Vendedores, con el formato real de la documentación de Effi.
 *
 * Aquí SOLO se consulta Effi (GET: cliente, departamento, ciudad, artículo).
 * Nunca se crea, modifica ni anula nada. El envío real vive aparte y exige
 * autorización del dueño + clave de escritura (Fase 3 del plan).
 *
 * Reglas del dueño (07-nov-2026, docs/PLAN-subir-ventas-effi.md):
 *  · Sin cédula → se identifica al cliente con su celular.
 *  · El precio YA incluye IVA 19% → a Effi va la base sin IVA y Effi lo suma.
 *  · Contraentrega = forma «Contado a 1 día» (2) por lo que falta cobrar (sin medio de pago).
 *  · Lo ya pagado (abono o pago total) = forma «Contado» (1) → Transferencia, caja QUIN JOSUE.
 *  · Transportadora = «Ubicación de venta»: CR si queda algo por cobrar, SR si está pago.
 *  · Centro de costos AGENCIA QUIN; vendedor = el de quien vendió.
 */

/** Ids de Effi (consultados el 07-nov-2026 con la clave de lectura). */
export const EFFI_IDS = {
  sucursal: 1, bodega: 1, centro_costos: 12, divisa: 'COP', trm: 1, pais: 47,
  iva19: 1,
  forma_contado_1_dia: 2,   // crédito: queda por cobrar (contraentrega)
  forma_contado: 1,         // contado: exige medio de pago
  medio_transferencia: 5,
  caja_sucursal: 1, caja_quin_josue: 5,
  t_dni_cedula: 2,
};

/** Ubicaciones de venta (transportadoras) de Effi: [con recaudo, sin recaudo]. */
export const UBICACIONES: Record<string, { cr: number; sr: number }> = {
  'CIUDAD BONITA': { cr: 32, sr: 33 },
  'INTER RAPIDISIMO': { cr: 29, sr: 28 },
  'ENVIA': { cr: 27, sr: 26 },
  'COORDINADORA': { cr: 25, sr: 24 },
  'SERVIENTREGA': { cr: 23, sr: 22 },
  'JOSE ENVIOS': { cr: 21, sr: 20 },
};
export const NOMBRES_UBICACION: Record<number, string> = {
  33: 'CIUDAD BONITA SR', 32: 'CIUDAD BONITA CR', 31: 'INTER PROPIO', 30: 'PUNTO DE VENTA',
  29: 'INTER RAPIDISIMO CR', 28: 'INTER RAPIDISIMO SR', 27: 'ENVIA CR', 26: 'ENVIA SR',
  25: 'COORDINADORA CR', 24: 'COORDINADORA SR', 23: 'SERVIENTREGA CR', 22: 'SERVIENTREGA SR',
  21: 'JOSE ENVIOS CR', 20: 'JOSE ENVIOS SR',
};

/** Configuración editable (ajustes_bot clave 'effi_remision'); estos son los valores por defecto. */
interface ConfigRemision {
  /** Teléfono del vendedor (57 + 10) → código del tercero empleado en Effi. */
  vendedores: Record<string, { tercero: number; nombre: string }>;
  /** Municipio (sin tildes, minúsculas) → transportadora. */
  transportadoras: Record<string, string>;
  /** Id de la cuenta bancaria KLIXMANT SAS para las transferencias (api/cuenta). */
  cuenta_transferencia: number | null;
}
const CONFIG_DEFECTO: ConfigRemision = {
  vendedores: { '573143534918': { tercero: 46502, nombre: 'QUINO AGENCIA' } },
  transportadoras: { bucaramanga: 'CIUDAD BONITA' },
  cuenta_transferencia: null,
};

async function configRemision(): Promise<ConfigRemision> {
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'effi_remision').maybeSingle();
    const v = (data?.valor ?? {}) as Partial<ConfigRemision>;
    return {
      vendedores: { ...CONFIG_DEFECTO.vendedores, ...(v.vendedores ?? {}) },
      transportadoras: { ...CONFIG_DEFECTO.transportadoras, ...(v.transportadoras ?? {}) },
      cuenta_transferencia: v.cuenta_transferencia ?? CONFIG_DEFECTO.cuenta_transferencia,
    };
  } catch { return CONFIG_DEFECTO; }
}

/** "Interrapidísimo" / "inter rapidisimo cr" → "INTER RAPIDISIMO". */
function normalizarTransportadora(t: string): string | null {
  const s = sinTildes(t).toUpperCase().replace(/\b(CR|SR)\b/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const compacto = s.replace(/\s/g, '');
  for (const k of Object.keys(UBICACIONES)) if (k.replace(/\s/g, '') === compacto) return k;
  if (/^INTER/.test(compacto)) return 'INTER RAPIDISIMO';
  return null;
}

const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const dinero = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export interface Remision {
  ok: boolean;
  errores: string[];
  avisos: string[];
  /** Cuerpo exacto para POST api/remision_v (cliente puede faltar si hay que crearlo). */
  solicitud: Record<string, any> | null;
  /** Si el cliente no existe en Effi: cuerpo para POST api/cliente. */
  crear_cliente: Record<string, any> | null;
  /** Resumen legible para la vista previa del panel. */
  vista: Record<string, any>;
}

export async function armarRemision(venta: any, items: any[]): Promise<Remision> {
  const errores: string[] = [];
  const avisos: string[] = [];
  const cfg = await configRemision();

  // ── Dinero ────────────────────────────────────────────────────────────
  const total = Number(venta.total) || 0;
  const pagadoTodo = ['contado', 'anticipado'].includes(String(venta.tipo_pago ?? '').toLowerCase());
  const pagado = pagadoTodo ? total : Math.min(total, Number(venta.abono) || 0);
  const porCobrar = Math.max(0, total - pagado);
  const sumaPrendas = items.reduce((s, it) => s + (Number(it.precio) || 0) * (Number(it.cantidad) || 0), 0);
  if (!total) errores.push('Falta el total de la venta');
  if (items.some(it => !Number(it.precio))) errores.push('Hay prendas sin precio');
  else if (total && Math.round(sumaPrendas) !== Math.round(total)) {
    errores.push(`La suma de las prendas (${dinero(sumaPrendas)}) no cuadra con el total (${dinero(total)})`);
  }

  // ── Transportadora → ubicación de venta ───────────────────────────────
  const muni = sinTildes(venta.municipio);
  const transp = normalizarTransportadora(String(venta.transportadora ?? '')) ?? (cfg.transportadoras[muni] ? normalizarTransportadora(cfg.transportadoras[muni]) : null);
  let ubicacion: number | null = null;
  if (!transp) errores.push(`Falta la transportadora para ${venta.municipio || 'este municipio'} (escríbela en «Transportadora»: CIUDAD BONITA, INTER RAPIDISIMO, ENVIA, COORDINADORA, SERVIENTREGA o JOSE ENVIOS)`);
  else ubicacion = porCobrar > 0 ? UBICACIONES[transp].cr : UBICACIONES[transp].sr;

  // ── Vendedor ──────────────────────────────────────────────────────────
  const vend = cfg.vendedores[String(venta.vendedor_tel ?? '')] ?? null;
  if (!vend) errores.push(`El vendedor ${venta.vendedor_nombre || venta.vendedor_tel} no está enlazado a un empleado de Effi`);

  // ── Consultas a Effi (solo lectura) ───────────────────────────────────
  let idProvincia: number | null = null, idCiudad: number | null = null;
  let cliente: { tercero: number; nombre: string; id: string } | null = null;
  const articulos: ({ id: number; descripcion: string; referencia: string } | null)[] = [];
  try {
    // Departamento
    const deptoN = sinTildes(venta.departamento);
    if (!deptoN) errores.push('Falta el departamento');
    else {
      const prov = await effiGet('provincia', { nombre: String(venta.departamento).slice(0, 40), pais: EFFI_IDS.pais, por_pagina: 100 });
      const p = (prov?.data ?? []).find((x: any) => sinTildes(x.nombre) === deptoN)
        ?? ((prov?.data ?? []).length === 1 ? prov.data[0] : null);
      if (!p) errores.push(`Effi no reconoce el departamento «${venta.departamento}»`);
      else idProvincia = Number(p.id);
    }
    // Ciudad
    if (idProvincia) {
      if (!muni) errores.push('Falta el municipio');
      else {
        const ciu = await effiGet('ciudad', { nombre: String(venta.municipio).slice(0, 40), provincia: idProvincia, por_pagina: 100 });
        const c = (ciu?.data ?? []).find((x: any) => sinTildes(x.nombre) === muni)
          ?? ((ciu?.data ?? []).length === 1 ? ciu.data[0] : null);
        if (!c) errores.push(`Effi no tiene «${venta.municipio}» en ${venta.departamento}`);
        else idCiudad = Number(c.id);
      }
    }
    // Cliente: por cédula; si no, por celular
    const ced = String(venta.cliente_identificacion ?? '').replace(/\D/g, '');
    const cel = String(venta.cliente_celular ?? '').replace(/\D/g, '').slice(-10);
    if (ced) {
      const r = await effiGet('cliente', { numero: ced, por_pagina: 5 });
      const x = (r?.data ?? [])[0];
      if (x) cliente = { tercero: Number(x.tercero), nombre: x.nombre, id: x.id };
    }
    if (!cliente && cel) {
      const r = await effiGet('cliente', { numero: cel, por_pagina: 5 });
      const x = (r?.data ?? [])[0];
      if (x) cliente = { tercero: Number(x.tercero), nombre: x.nombre, id: x.id };
    }
    if (!cliente && cel && !ced) {
      const r = await effiGet('cliente', { celular: cel, por_pagina: 5 });
      const lista = (r?.data ?? []).filter((x: any) => String(x.celular ?? '').replace(/\D/g, '').endsWith(cel));
      if (lista.length === 1) cliente = { tercero: Number(lista[0].tercero), nombre: lista[0].nombre, id: lista[0].id };
      else if (lista.length > 1) avisos.push(`Hay ${lista.length} clientes en Effi con el celular ${cel}; se creará/usará el de identificación ${cel}`);
    }
    // Artículos por referencia (SKU sin espacios)
    for (const it of items) {
      const ref = String(it.sku ?? '').replace(/\s+/g, '').toUpperCase();
      if (!ref) { errores.push(`Prenda sin SKU: ${it.catalogo ?? '—'}`); articulos.push(null); continue; }
      const r = await effiGet('articulo', { referencia: ref, por_pagina: 5 });
      const a = (r?.data ?? []).find((x: any) => String(x.referencia ?? '').toUpperCase() === ref);
      if (!a) { errores.push(`No existe en Effi el artículo con Ref. ${ref}`); articulos.push(null); continue; }
      if (String(a.vigente) !== '1' || String(a.ventas) !== '1') errores.push(`El artículo ${ref} no está habilitado para ventas en Effi`);
      if (!/19/.test(String(a.impuesto ?? ''))) avisos.push(`El artículo ${ref} tiene impuesto «${a.impuesto ?? 'ninguno'}»; se envía IVA 19%`);
      articulos.push({ id: Number(a.id), descripcion: String(a.descripcion ?? it.sku), referencia: ref });
    }
  } catch (e: any) {
    errores.push(`No se pudo consultar Effi: ${e?.message ?? e}`);
  }

  // ── Cliente nuevo ─────────────────────────────────────────────────────
  const identificacion = String(venta.cliente_identificacion ?? '').replace(/\D/g, '') || String(venta.cliente_celular ?? '').replace(/\D/g, '').slice(-10);
  const direccionTxt = [venta.direccion, venta.barrio].filter(Boolean).join(' ').trim();
  const referenciaTxt = [venta.complemento, venta.referencia_dir].filter(Boolean).join(' · ').trim();
  let crear_cliente: Record<string, any> | null = null;
  if (!cliente) {
    if (!venta.cliente_nombre) errores.push('Falta el nombre del cliente');
    crear_cliente = {
      t_dni: EFFI_IDS.t_dni_cedula, numero: identificacion, nombre: String(venta.cliente_nombre ?? '').slice(0, 120),
      celular: String(venta.cliente_celular ?? '').replace(/\D/g, '').slice(-10),
      whatsapp: String(venta.cliente_celular ?? '').replace(/\D/g, '').slice(-10),
      email: venta.cliente_correo || 'Gerenciaquin7@gmail.com',
      direcciones: [{ id_pais: EFFI_IDS.pais, id_provincia: idProvincia, id_ciudad: idCiudad, direccion: direccionTxt, referencia: referenciaTxt }],
    };
    avisos.push(`El cliente no existe en Effi: se creará con identificación ${identificacion}${venta.cliente_identificacion ? '' : ' (celular, no dio cédula)'}`);
  }
  if (!direccionTxt) errores.push('Falta la dirección');

  // ── Pagos ─────────────────────────────────────────────────────────────
  const t_forma_pago: number[] = [], valor_forma_pago: number[] = [];
  const medio_pago: number[] = [], valor_medio_pago: number[] = [], sucursal_caja_medio_pago: number[] = [], id_caja_medio_pago: number[] = [], cuenta_medio_pago: (number | null)[] = [];
  if (porCobrar > 0) { t_forma_pago.push(EFFI_IDS.forma_contado_1_dia); valor_forma_pago.push(porCobrar); }
  if (pagado > 0) {
    t_forma_pago.push(EFFI_IDS.forma_contado); valor_forma_pago.push(pagado);
    medio_pago.push(EFFI_IDS.medio_transferencia); valor_medio_pago.push(pagado);
    sucursal_caja_medio_pago.push(EFFI_IDS.caja_sucursal); id_caja_medio_pago.push(EFFI_IDS.caja_quin_josue);
    cuenta_medio_pago.push(cfg.cuenta_transferencia);
    if (!cfg.cuenta_transferencia) errores.push('Falta el id de la cuenta bancaria KLIXMANT SAS (pago por transferencia)');
  }

  // ── Conceptos ─────────────────────────────────────────────────────────
  // El precio del vendedor ya trae IVA: a Effi va la base (Effi suma el 19%).
  const base = (p: number) => Math.round((p / 1.19) * 10000) / 10000;
  const totalCalculado = items.reduce((s, it) => s + Math.round(base(Number(it.precio) || 0) * 1.19 * 100) / 100 * (Number(it.cantidad) || 0), 0);
  if (total && Math.abs(totalCalculado - total) >= 0.01) avisos.push(`Redondeo: Effi podría calcular ${totalCalculado.toFixed(2)} en vez de ${total}`);

  const observacion = [`QuinChat ${venta.codigo}`, `Cel ${venta.cliente_celular ?? ''}`, venta.observaciones].filter(Boolean).join(' · ').slice(0, 255);
  const solicitud: Record<string, any> = {
    idempotency_key: `qc-${venta.codigo}`.slice(0, 36),
    sucursal: EFFI_IDS.sucursal, bodega: EFFI_IDS.bodega, centro_costos: EFFI_IDS.centro_costos,
    fecha_entrega: hoyBogota(), divisa: EFFI_IDS.divisa, trm: EFFI_IDS.trm,
    cliente: cliente?.tercero ?? null,
    id_pais_cliente: EFFI_IDS.pais, id_provincia_cliente: idProvincia, id_ciudad_cliente: idCiudad,
    direccion_cliente: direccionTxt, referencia_cliente: referenciaTxt || undefined,
    vendedor: vend?.tercero ?? null, ubicacion_venta: ubicacion,
    observacion,
    articulo: articulos.map(a => a?.id ?? null),
    descripcion: articulos.map((a, i) => a?.descripcion ?? items[i]?.sku ?? ''),
    cantidad: items.map(it => Number(it.cantidad) || 0),
    precio: items.map(it => base(Number(it.precio) || 0)),
    impuestos: Object.fromEntries(items.map((_, i) => [String(i + 1), [EFFI_IDS.iva19]])),
    observacion_concepto: items.map(it => String(it.id_variante ?? '')),
    t_forma_pago, valor_forma_pago,
    ...(medio_pago.length ? { medio_pago, valor_medio_pago, sucursal_caja_medio_pago, id_caja_medio_pago, cuenta_medio_pago } : {}),
  };
  for (const it of items) if (!it.id_variante) errores.push(`Prenda sin ID de variante: ${it.catalogo ?? '—'}`);

  const vista = {
    cliente: cliente ? `${cliente.nombre} (ya existe en Effi · tercero ${cliente.tercero})` : `${venta.cliente_nombre} — NUEVO, identificación ${identificacion}`,
    direccion: `${direccionTxt}${referenciaTxt ? ` · ${referenciaTxt}` : ''} · ${venta.municipio}, ${venta.departamento}`,
    ciudad_ids: `ciudad ${idCiudad ?? '—'} · depto ${idProvincia ?? '—'}`,
    vendedor: vend ? `${vend.nombre} (${vend.tercero})` : '—',
    ubicacion: ubicacion ? `${NOMBRES_UBICACION[ubicacion]} (${ubicacion})` : '—',
    centro_costos: 'AGENCIA QUIN (12)',
    prendas: items.map((it, i) => ({
      articulo: articulos[i] ? `${articulos[i]!.referencia} (${articulos[i]!.id})` : '—',
      descripcion: articulos[i]?.descripcion ?? it.sku, observacion: String(it.id_variante ?? '—'),
      estampado: `${it.catalogo ?? ''} · ${it.color ?? ''} · ${it.talla ?? ''}`,
      cantidad: it.cantidad, precio_con_iva: Number(it.precio) || 0, precio_sin_iva: base(Number(it.precio) || 0),
    })),
    pagos: [
      ...(porCobrar > 0 ? [`Contado a 1 día ${dinero(porCobrar)} (por cobrar)`] : []),
      ...(pagado > 0 ? [`Contado ${dinero(pagado)} · Transferencia · caja QUIN JOSUE`] : []),
    ],
    total: dinero(total),
  };

  return { ok: errores.length === 0, errores, avisos, solicitud, crear_cliente, vista };
}

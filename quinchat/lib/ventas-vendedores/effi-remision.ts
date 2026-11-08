import { createServerSupabaseClient } from '@/lib/supabase';
import { effiGet } from '@/lib/effi-api';
import { sinTildes } from './catalogo';
import { esOficinaInter, DIR_OFICINA_INTER } from './desde-chat';

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
  depto_cundinamarca: 789,
  ciudad_bogota: 12688,   // «Bogotá D.C.» en Effi
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
  vendedores: {
    '573143534918': { tercero: 46502, nombre: 'QUINO AGENCIA' },
    // Ventas pasadas desde el chat con «Enviar al panel de Effi» (08-nov-2026, dueño):
    'panel-funnel': { tercero: 26524, nombre: 'FUNNELISTH LANDING' },   // Chat Funnel
    'panel-whatsapp': { tercero: 46502, nombre: 'QUINO AGENCIA' },      // Chat WhatsApp
  },
  transportadoras: { bucaramanga: 'CIUDAD BONITA' },
  cuenta_transferencia: 6,   // KLIXMANT SAS · Bancolombia ahorros (elegida por el dueño, 08-nov-2026)
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

/**
 * Transportadora recomendada por municipio (tabla transportadoras_municipios, copia de kls-app
 * del 08-nov-2026). La tabla guarda solo las excepciones; la fila ('*','*') es la regla general.
 * En kls-app los centros poblados van como «MUNICIPIO - CENTRO POBLADO»; el casco urbano es la fila
 * sin « - », o la que dice «MUNICIPIO - MUNICIPIO, DISTRITO…».
 */
const nTx = (s: unknown) => sinTildes(s).toUpperCase().replace(/,?\s*D\.?\s*C\.?$/, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export async function transportadoraDeMunicipio(departamento: string, municipio: string): Promise<{
  transportadora: string; abono: boolean; entrega_dias: number | null; restriccion: string | null; cantidad_minima: number; exacta: boolean;
} | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('transportadoras_municipios').select('departamento, municipio, transportadora, abono, entrega_dias, restriccion, cantidad_minima');
  // 08-nov-2026: faltaba el permiso de lectura y el error quedaba escondido («Falta la transportadora»).
  if (error) throw new Error(`No se pudo leer la tabla de transportadoras: ${error.message}`);
  const filas = data ?? [];
  const def = filas.find((f: any) => f.departamento === '*') ?? null;
  const m = nTx(municipio), d = nTx(departamento);
  if (!m) return def ? { ...def, exacta: false } : null;
  const base = (f: any) => nTx(String(f.municipio).split(' - ')[0]);
  let candidatas = filas.filter((f: any) => f.departamento !== '*' && base(f) === m);
  // «Cúcuta» → «SAN JOSÉ DE CÚCUTA», «Cartagena» → «CARTAGENA DE INDIAS»
  if (!candidatas.length && m.length >= 4) candidatas = filas.filter((f: any) => f.departamento !== '*' && (base(f).endsWith(` ${m}`) || base(f).startsWith(`${m} `)));
  const casco = (f: any) => {
    const partes = String(f.municipio).split(' - ');
    if (partes.length === 1) return true;
    const sub = nTx(partes.slice(1).join(' - '));
    return sub.startsWith(m) || /DISTRITO/.test(sub);
  };
  const delDepto = candidatas.filter((f: any) => { const fd = nTx(f.departamento); return !d || fd === d || fd.startsWith(d) || d.startsWith(fd); });
  const pool = delDepto.length ? delDepto : candidatas;
  const elegida = pool.find(casco) ?? null;
  if (elegida) return { ...elegida, exacta: true };
  return def ? { ...def, exacta: false } : null;
}

/** Nombre de lugar comparable: sin tildes, sin «D.C.», sin signos. «Bogotá, D.C.» → «bogota». */
const normLugar = (t: unknown) => sinTildes(t).replace(/\bd\s*\.?\s*c\s*\.?(?=\s|$)/g, ' ').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
/**
 * Correos de la empresa para clientes SIN correo (regla del dueño, 08-nov-2026): se ALTERNAN.
 * El turno se guarda en ajustes_bot «correos_por_defecto» ({ lista, siguiente }).
 * avanzar=false solo mira cuál toca (vista previa); avanzar=true lo usa y pasa el turno (al crear el cliente).
 */
export const CORREOS_DEFECTO = ['Gerenciaquin7@gmail.com', 'creativoquin@gmail.com'];
export const correoValido = (t: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(t ?? '').trim());
export async function correoPorDefecto(avanzar: boolean): Promise<string> {
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'correos_por_defecto').maybeSingle();
    const lista: string[] = Array.isArray((data?.valor as any)?.lista) && (data!.valor as any).lista.length ? (data!.valor as any).lista : CORREOS_DEFECTO;
    const i = Math.abs(Number((data?.valor as any)?.siguiente) || 0) % lista.length;
    if (avanzar) {
      await supabase.from('ajustes_bot').upsert({ clave: 'correos_por_defecto', valor: { lista, siguiente: (i + 1) % lista.length }, actualizado_at: new Date().toISOString() }, { onConflict: 'clave' });
    }
    return lista[i];
  } catch { return CORREOS_DEFECTO[0]; }
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Total como lo calcula Effi: subtotal (bases de 2 decimales × cantidad) + IVA 19 % redondeado. */
function totalEffi(bases: number[], cantidades: number[]): number {
  const sub = r2(bases.reduce((s, b, i) => s + b * (cantidades[i] || 0), 0));
  return r2(sub + r2(sub * 0.19));
}
/** Bases sin IVA (2 decimales) cuyo total en Effi da EXACTO el total con IVA del vendedor. */
function ajustarBases(precios: number[], cantidades: number[], total: number): number[] {
  const bases = precios.map(p => r2(p / 1.19));
  if (!total || Math.abs(totalEffi(bases, cantidades) - total) < 0.005) return bases;
  // Se toca primero una prenda de cantidad 1 (cada centavo mueve el total ~1,19 centavos)
  const orden = cantidades.map((c, i) => i).sort((a, b) => (cantidades[a] === 1 ? 0 : 1) - (cantidades[b] === 1 ? 0 : 1));
  for (const k of orden) {
    for (let paso = 1; paso <= 5; paso++) {
      for (const signo of [-1, 1]) {
        const prueba = [...bases];
        prueba[k] = r2(prueba[k] + signo * paso * 0.01);
        if (Math.abs(totalEffi(prueba, cantidades) - total) < 0.005) return prueba;
      }
    }
  }
  return bases;
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
  // Orden: la que escribió el asesor → ajuste manual por municipio → tabla de transportadoras (kls-app)
  let transp = normalizarTransportadora(String(venta.transportadora ?? '')) ?? (cfg.transportadoras[muni] ? normalizarTransportadora(cfg.transportadoras[muni]) : null);
  // Regla del dueño (08-nov-2026): reclama en OFICINA de Interrapidísimo → Interrapidísimo, sin importar la ciudad.
  const oficinaInter = esOficinaInter([venta.direccion, venta.referencia_dir, venta.complemento, venta.observaciones].filter(Boolean).join(' '));
  if (!transp && oficinaInter) transp = 'INTER RAPIDISIMO';
  // Regla del dueño (08-nov-2026): Bogotá (aunque llegue «Bogotá, Bogotá») va con COORDINADORA.
  const esBogota = normLugar(venta.municipio) === 'bogota' || (!normLugar(venta.municipio) && normLugar(venta.departamento) === 'bogota');
  if (!transp && esBogota) transp = 'COORDINADORA';
  if (!transp && !String(venta.transportadora ?? '').trim()) {
    const rec = await transportadoraDeMunicipio(String(venta.departamento ?? ''), String(venta.municipio ?? ''))
      .catch((e: any) => { errores.push(e?.message ?? String(e)); return null; });
    if (rec) {
      if (/NO HAY CUBRIMIENTO/i.test(rec.transportadora)) {
        errores.push(`No hay cubrimiento de transportadora en ${venta.municipio} (${venta.departamento}). Elige una a mano o confirma con despacho.`);
      } else {
        transp = normalizarTransportadora(rec.transportadora);
        if (!rec.exacta) avisos.push(`Transportadora por regla general: ${rec.transportadora} (${venta.municipio} no tiene una especial).`);
        if (rec.abono && porCobrar > 0 && pagado === 0) avisos.push(`${venta.municipio} pide ABONO según la tabla de transportadoras.`);
        if (rec.restriccion) avisos.push(`${rec.transportadora}: ${rec.restriccion}`);
        if (rec.cantidad_minima > 0) avisos.push(`${venta.municipio}: cantidad mínima de venta ${rec.cantidad_minima}.`);
      }
    }
  }
  let ubicacion: number | null = null;
  if (!transp) { if (!errores.some(e => e.startsWith('No hay cubrimiento'))) errores.push(`Falta la transportadora para ${venta.municipio || 'este municipio'} (escríbela en «Transportadora»: CIUDAD BONITA, INTER RAPIDISIMO, ENVIA, COORDINADORA, SERVIENTREGA o JOSE ENVIOS)`); }
  else ubicacion = porCobrar > 0 ? UBICACIONES[transp].cr : UBICACIONES[transp].sr;

  // ── Vendedor ──────────────────────────────────────────────────────────
  // Preventas viejas del panel quedaron con vendedor «panel» (antes de separar Funnel / WhatsApp):
  // se toma el de la línea del chat (funnel → FUNNELISTH LANDING, ventas → QUINO AGENCIA).
  let telVend = String(venta.vendedor_tel ?? '');
  if (telVend === 'panel' && venta.conversacion_id) {
    const { data: conv } = await createServerSupabaseClient().from('conversations').select('linea').eq('id', venta.conversacion_id).maybeSingle();
    telVend = conv?.linea === 'ventas' ? 'panel-whatsapp' : 'panel-funnel';
  }
  const vend = cfg.vendedores[telVend] ?? null;
  if (!vend) errores.push(`El vendedor ${venta.vendedor_nombre || venta.vendedor_tel} no está enlazado a un empleado de Effi`);

  // ── Consultas a Effi (solo lectura) ───────────────────────────────────
  let idProvincia: number | null = null, idCiudad: number | null = null;
  let cliente: { tercero: number; nombre: string; id: string } | null = null;
  const articulos: ({ id: number; descripcion: string; referencia: string } | null)[] = [];
  try {
    // Departamento
    // En Effi Bogotá es la ciudad 12688 «Bogotá D.C.» del departamento 789 CUNDINAMARCA (dueño, 08-nov-2026).
    if (esBogota) { idProvincia = EFFI_IDS.depto_cundinamarca; idCiudad = EFFI_IDS.ciudad_bogota; }
    const deptoTxt = /^bogota\b/.test(normLugar(venta.departamento)) ? 'Cundinamarca' : String(venta.departamento ?? '');
    const deptoN = sinTildes(deptoTxt);
    if (esBogota) { /* ids fijos */ }
    else if (!deptoN) errores.push('Falta el departamento');
    else {
      const prov = await effiGet('provincia', { nombre: deptoTxt.slice(0, 40), pais: EFFI_IDS.pais, por_pagina: 100 });
      const p = (prov?.data ?? []).find((x: any) => sinTildes(x.nombre) === deptoN)
        ?? ((prov?.data ?? []).length === 1 ? prov.data[0] : null);
      if (!p) errores.push(`Effi no reconoce el departamento «${venta.departamento}»`);
      else idProvincia = Number(p.id);
    }
    // Ciudad
    if (idProvincia && !esBogota) {
      if (!muni) errores.push('Falta el municipio');
      else {
        const ciu = await effiGet('ciudad', { nombre: String(venta.municipio).slice(0, 40), provincia: idProvincia, por_pagina: 100 });
        const lista = ciu?.data ?? [];
        const m = normLugar(venta.municipio);
        // 1) igual (sin tildes, sin «D.C.» ni signos) · 2) el municipio principal, no sus localidades
        //    («Suba (Bogotá D.C.)») · 3) si solo hay una
        const c = lista.find((x: any) => sinTildes(x.nombre) === muni)
          ?? lista.find((x: any) => normLugar(x.nombre) === m)
          ?? lista.find((x: any) => !/\(/.test(String(x.nombre)) && (normLugar(x.nombre).startsWith(`${m} `) || m.startsWith(`${normLugar(x.nombre)} `)))
          ?? (lista.length === 1 ? lista[0] : null);
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
  // Oficina de Interrapidísimo → siempre el mismo texto, sin barrio ni referencia de calle
  const direccionTxt = oficinaInter ? DIR_OFICINA_INTER : [venta.direccion, venta.barrio].filter(Boolean).join(' ').trim();
  const referenciaTxt = oficinaInter ? '' : [venta.complemento, venta.referencia_dir].filter(Boolean).join(' · ').trim();
  let crear_cliente: Record<string, any> | null = null;
  if (!cliente) {
    if (!venta.cliente_nombre) errores.push('Falta el nombre del cliente');
    crear_cliente = {
      t_dni: EFFI_IDS.t_dni_cedula, numero: identificacion, nombre: String(venta.cliente_nombre ?? '').slice(0, 120),
      celular: String(venta.cliente_celular ?? '').replace(/\D/g, '').slice(-10),
      whatsapp: String(venta.cliente_celular ?? '').replace(/\D/g, '').slice(-10),
      // Sin correo válido del cliente → uno de los correos de la empresa, alternando (se fija al enviar)
      email: correoValido(venta.cliente_correo) ? String(venta.cliente_correo).trim() : await correoPorDefecto(false),
      correo_por_defecto: !correoValido(venta.cliente_correo),
      direcciones: [{ id_pais: EFFI_IDS.pais, id_provincia: idProvincia, id_ciudad: idCiudad, direccion: direccionTxt, referencia: referenciaTxt }],
    };
    avisos.push(`El cliente no existe en Effi: se creará con identificación ${identificacion}${venta.cliente_identificacion ? '' : ' (celular, no dio cédula)'}`);
    if (crear_cliente.correo_por_defecto) avisos.push(`El cliente no dio correo: se usará ${crear_cliente.email} (se alternan los correos de la empresa).`);
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
  // Effi guarda la base con 2 decimales y calcula total = base·cant + 19 %. Con varias prendas el
  // redondeo podía dar 1 centavo de más y Effi rechazaba la remisión (08-nov-2026: 194.900,01 ≠ 194.900).
  // Por eso se ajusta la base de una prenda en ±1 centavo hasta que el total de Effi cuadre EXACTO.
  const bases = ajustarBases(items.map(it => Number(it.precio) || 0), items.map(it => Number(it.cantidad) || 0), total);
  const base = (_p: number, i: number) => bases[i];
  const totalCalculado = totalEffi(bases, items.map(it => Number(it.cantidad) || 0));
  if (total && Math.abs(totalCalculado - total) >= 0.005) errores.push(`Redondeo: Effi calcularía ${totalCalculado.toFixed(2)} en vez de ${total}. Ajusta un precio en 1 peso.`);

  // Regla del dueño (08-nov-2026): en Effi va SOLO la observación de la venta (sin código QuinChat ni celular).
  const observacion = String(venta.observaciones ?? '').trim().slice(0, 255) || undefined;
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
    precio: items.map((it, i) => base(Number(it.precio) || 0, i)),
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
      cantidad: it.cantidad, precio_con_iva: Number(it.precio) || 0, precio_sin_iva: base(Number(it.precio) || 0, i),
    })),
    pagos: [
      ...(porCobrar > 0 ? [`Contado a 1 día ${dinero(porCobrar)} (por cobrar)`] : []),
      ...(pagado > 0 ? [`Contado ${dinero(pagado)} · Transferencia · caja QUIN JOSUE`] : []),
    ],
    total: dinero(total),
  };

  return { ok: errores.length === 0, errores, avisos, solicitud, crear_cliente, vista };
}

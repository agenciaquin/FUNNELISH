import { createServerSupabaseClient } from '@/lib/supabase';
import { effiConfigurado, effiGet, listarGuias, listarRemisiones } from '@/lib/effi-api';

/**
 * PANEL DE NOVEDADES (09-nov-2026) — módulo independiente, SOLO LECTURA en Effi.
 *
 * Una «novedad» es una guía de Effi que la transportadora dejó con problema de entrega:
 *  estado Effi-commerce «Novedad», o estado de la transportadora con novedad / incidencia / siniestro /
 *  intento de entrega / telemercadeo / reclame en oficina — mientras NO esté entregada, devuelta ni anulada.
 * Solo de los vendedores de Effi FUNNELISTH LANDING y QUINO AGENCIA (por la remisión de la guía).
 *
 * Fuente: la API de Effi (reusa listarGuias / listarRemisiones de lib/effi-api.ts, misma API key) o la copia
 * que ya deja la sincronización de cada hora (effi_guias_api / effi_remisiones_api). No escribe en esas tablas.
 * Guarda solo en novedades_effi (una fila por guía → sin duplicados), novedades_effi_historial y novedades_effi_sync.
 * Effi no da el detalle escrito de la novedad: el «motivo» es el estado que reporta la transportadora.
 */

export const VENDEDORES_NOVEDADES = ['FUNNELISTH LANDING', 'QUINO AGENCIA'];
const esVendedorObjetivo = (v: unknown) => {
  const t = String(v ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
  return (/FUNNEL/.test(t) && /LANDING/.test(t)) || t === 'QUINO AGENCIA';
};

export type EstadoGestion = 'nueva' | 'pendiente' | 'en_gestion' | 'solucionada';

interface GuiaN {
  id: string; guia: string | null; transportadora: string | null;
  estado: string; estado_com: string; tel_raw: string; nombre: string | null;
  ciudad: string | null; depto: string | null; direccion: string | null;
  recaudo: number | null; fecha: string | null; vigente: boolean; anulada: boolean;
  copia_at?: string | null;   // cuándo se copió de Effi (solo fuente «copia»)
  url: string | null; id_ref: string | null; contenido: string | null;
}

/** ¿La guía está HOY en novedad? */
export function esNovedadActiva(g: { estado?: string | null; estado_com?: string | null; vigente?: boolean; anulada?: boolean }): boolean {
  if (g.anulada || g.vigente === false) return false;
  const com = String(g.estado_com ?? '');
  if (/devoluci|devuelt|entregad/i.test(com)) return false;
  const est = String(g.estado ?? '');
  if (/entregad|devuelt|devoluci/i.test(est) && !/novedad/i.test(est)) return false;
  return /novedad/i.test(com) || /retiro en oficina/i.test(com)
    || /novedad|incidencia|siniestr|intento de entrega|telemercadeo|reclame en oficina/i.test(est);
}

/** Resultado en Effi cuando la guía YA NO está en novedad. */
function resultadoEffi(g: GuiaN): 'entregada' | 'devuelta' | 'anulada' | 'en_ruta' {
  if (g.anulada || !g.vigente) return 'anulada';
  const t = `${g.estado} ${g.estado_com}`;
  if (/devoluci|devuelt|retorn/i.test(t)) return 'devuelta';
  if (/entregad/i.test(t)) return 'entregada';
  return 'en_ruta';
}

/** Teléfono: el primero que sea un celular válido de 10 dígitos (sin +57). Devuelve null si no hay. */
export function telefonoValido(raw: unknown): string | null {
  const grupos = String(raw ?? '').split(/[^\d+]+/).map(s => s.replace(/\D/g, '')).filter(Boolean);
  // también por si vino todo pegado con +57
  for (const g0 of grupos) {
    let g = g0;
    if (g.length === 12 && g.startsWith('57')) g = g.slice(2);
    if (g.length === 10 && /^3\d{9}$/.test(g)) return g;
  }
  for (const g0 of grupos) { let g = g0; if (g.length === 12 && g.startsWith('57')) g = g.slice(2); if (g.length === 10) return g; }
  return null;
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const fechaIso = (v: unknown) => {
  const t = String(v ?? '').trim(); if (!t) return null;
  return /[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t.replace(' ', 'T')}Z`;
};

function desdeApi(g: any): GuiaN {
  return {
    id: String(g.id), guia: g.guia ?? null,
    transportadora: g.nombre_transportadora_efficommerce || g.nombre_transportadora || null,
    estado: String(g.estado ?? ''), estado_com: String(g.estado_efficommerce ?? ''),
    tel_raw: String(g.telefonos_destinatario ?? ''), nombre: g.nombre_destinatario ?? null,
    ciudad: g.nombre_ciudad_destinatario ?? null, depto: g.nombre_provincia_destinatario ?? null,
    direccion: g.direccion_destinatario ?? null, recaudo: num(g.valor_recaudo), fecha: fechaIso(g.fecha_trans),
    vigente: String(g.vigente ?? '1') !== '0', anulada: !!g.fecha_anular,
    url: g.url_guia_transportadora ?? null,
    id_ref: /REMISI/i.test(String(g.tipo_trans_ref ?? '')) && g.id_ref != null ? String(g.id_ref) : null,
    contenido: g.contenido ?? null,
  };
}
function desdeCopia(g: any): GuiaN {
  return {
    id: String(g.id_effi), guia: g.guia ?? null, transportadora: g.transportadora ?? null,
    estado: String(g.estado ?? ''), estado_com: String(g.estado_efficommerce ?? ''),
    tel_raw: String(g.tel_raw ?? g.telefono ?? ''), nombre: g.nombre ?? null,
    ciudad: g.ciudad ?? null, depto: g.departamento ?? null, direccion: g.direccion ?? null,
    recaudo: num(g.valor_recaudo), fecha: g.fecha_trans ?? null,
    vigente: g.vigente !== false, anulada: !!g.fecha_anular, url: g.url_guia ?? null,
    id_ref: /REMISI/i.test(String(g.tipo_trans_ref ?? '')) && g.id_ref != null ? String(g.id_ref) : null,
    contenido: g.contenido ?? null, copia_at: g.actualizado_at ?? null,
  };
}

// ── «Logística → Novedades de guías» de Effi (GET novedad_guia_transporte) ─────────────────────
// El nombre de la ruta sigue el patrón de la app (app/guia_transporte ↔ api/guia_transporte). Los nombres de los
// campos se leen con tolerancia hasta confirmar la respuesta real (se guarda cruda en effi_novedades_api).
export interface NovedadEffi {
  id: string; id_guia: string | null; codigo: string | null; texto: string | null; aclaracion: string | null;
  estado: string | null; vigente: boolean; soluciones: number | null; fecha: string | null;
}
const valor = (v: unknown) => (v == null ? '' : String(v).trim());
function campo(o: any, claves: RegExp[], soloTexto = false): string | null {
  for (const re of claves) for (const [k, v] of Object.entries(o ?? {})) {
    const t = valor(v);
    if (re.test(k) && t && typeof v !== 'object' && (!soloTexto || !/^\d+([.,]\d+)?$/.test(t))) return t;
  }
  return null;
}
export function leerNovedadEffi(d: any): NovedadEffi {
  // Campos reales de Effi (comprobado el 09-nov-2026): nombre_novedad, id_novedad (código), aclaracion, estado_novedad,
  // tipo_novedad, cant_gestion, fecha_trans_transportadora, id_guia, url_foto, fecha_solucion
  const texto = campo(d, [/^nombre_novedad$/, /^descripcion_novedad/, /^nombre_causal/], true);
  const codigo = campo(d, [/^id_novedad$/, /^codigo_novedad$/]);
  return {
    id: valor(d?.id ?? d?.id_novedad ?? d?.id_novedad_guia_transporte ?? d?.id_transaccion),
    id_guia: campo(d, [/^id_guia_transporte$/, /^guia_transporte$/, /^id_guia$/]),
    codigo: codigo && /^\d+$/.test(codigo) ? codigo : null,
    texto, aclaracion: campo(d, [/aclaraci/], true),
    estado: campo(d, [/^estado_novedad$/, /^nombre_estado_novedad$/], true) ?? campo(d, [/^est_novedad$/]),
    vigente: valor(d?.vigente ?? '1') !== '0',
    soluciones: (() => { const v = campo(d, [/^cant_gestion$/, /cant.*soluc/, /^soluciones$/]); const n = Number(v); return v != null && Number.isFinite(n) ? n : null; })(),
    fecha: fechaIso(campo(d, [/^fecha_trans$/, /^fecha_trans_transportadora$/, /^fecha_novedad$/])),
  };
}
/** ¿La novedad de Effi sigue esperando solución? («1 - Pendiente de solución») */
export const novedadPendiente = (n: NovedadEffi) =>
  n.vigente && (!n.estado || /pendiente/i.test(n.estado) || n.estado === '1') && !/solucionad|cerrad|resuelt/i.test(n.estado ?? '');
export const textoNovedad = (n: NovedadEffi | null | undefined) =>
  n ? [[n.codigo, n.texto].filter(Boolean).join(' - '), n.aclaracion ? `Aclaración: ${n.aclaracion}` : ''].filter(Boolean).join(' · ') || null : null;

/** Todas las novedades de guías de Effi entre dos fechas (paginando de a 100). */
export async function listarNovedadesEffi(desde: string, hasta: string, maxPaginas = 20): Promise<any[]> {
  const todas: any[] = [];
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const j = await effiGet('novedad_guia_transporte', { desde, hasta, pagina, por_pagina: 100 });
    todas.push(...(Array.isArray(j.data) ? j.data : []));
    const total = Number(j?.paginacion?.total_paginas) || 1;
    if (pagina >= total) break;
  }
  return todas;
}

const DIAS = 30;
const hoyCol = () => new Date(Date.now() - 5 * 3600_000);

/** Lee las guías de los últimos DIAS días (de Effi o de la copia) y actualiza las novedades. */
export async function sincronizarNovedades(fuente: 'effi' | 'copia', origen: string) {
  const supabase = createServerSupabaseClient();
  const { data: log } = await supabase.from('novedades_effi_sync').insert({ origen: `${origen}:${fuente}` }).select('id').single();
  let nNovEffi: number | null = null, errNovEffi: string | null = null;
  const cerrar = async (r: { ok: boolean; guias?: number; nuevas?: number; cambios?: number; error?: string }) => {
    if (log?.id) await supabase.from('novedades_effi_sync').update({ fin: new Date().toISOString(), ok: r.ok, guias: r.guias ?? 0, nuevas: r.nuevas ?? 0, cambios: r.cambios ?? 0, error: r.error ?? null, novedades_effi: nNovEffi, error_novedades: errNovEffi }).eq('id', log.id);
    return { ...r, fuente, novedades_effi: nNovEffi, error_novedades: errNovEffi };
  };

  try {
    const hasta = new Date(hoyCol().getTime() + 86400_000).toISOString().slice(0, 10);   // Effi: `hasta` exclusivo
    const desde = new Date(hoyCol().getTime() - DIAS * 86400_000).toISOString().slice(0, 10);

    // 1) Guías
    let guias: GuiaN[] = [];
    if (fuente === 'effi') {
      if (!effiConfigurado()) return cerrar({ ok: false, error: 'Falta EFFI_API_TOKEN en Vercel' });
      guias = (await listarGuias(desde, hasta, 40)).filter(g => g?.id != null).map(desdeApi);
    } else {
      for (let d = 0; d < 20000; d += 1000) {
        const { data, error } = await supabase.from('effi_guias_api')
          .select('id_effi, guia, transportadora, estado, estado_efficommerce, telefono, tel_raw:datos->>telefonos_destinatario, nombre, ciudad, departamento, direccion, valor_recaudo, fecha_trans, fecha_anular, vigente, url_guia, tipo_trans_ref, id_ref, actualizado_at, contenido:datos->>contenido')
          .gte('fecha_trans', `${desde}T00:00:00Z`).order('id_effi').range(d, d + 999);
        if (error) throw new Error(error.message);
        guias.push(...(data ?? []).map(desdeCopia));
        if ((data ?? []).length < 1000) break;
      }
    }

    // 1b) «Novedades de guías» de Effi (el PORQUÉ). Si la ruta falla, sigue con el estado de la guía.
    if (fuente === 'effi') {
      try {
        const crudas = await listarNovedadesEffi(desde, hasta);
        const unicas = new Map<string, any>();
        for (const d of crudas) { const n = leerNovedadEffi(d); if (n.id) unicas.set(n.id, { d, n }); }
        const filasN = [...unicas.values()].map(x => ({
          id_novedad: x.n.id, id_guia: x.n.id_guia, datos: x.d, actualizado_at: new Date().toISOString(),
        }));
        for (let i = 0; i < filasN.length; i += 200) {
          const { error } = await supabase.from('effi_novedades_api').upsert(filasN.slice(i, i + 200), { onConflict: 'id_novedad' });
          if (error) throw new Error(error.message);
        }
        nNovEffi = filasN.length;
      } catch (e: any) { errNovEffi = e?.message ?? String(e); }
    }
    const novPorGuia = new Map<string, NovedadEffi>();
    {
      const { data } = await supabase.from('effi_novedades_api').select('datos').order('id_novedad').limit(5000);
      for (const r of data ?? []) {
        const n = leerNovedadEffi((r as any).datos); if (!n.id_guia) continue;
        const prev = novPorGuia.get(n.id_guia);
        // por guía gana la más reciente (fecha; si no, el id más alto)
        if (!prev || (Date.parse(n.fecha ?? '') || Number(n.id)) >= (Date.parse(prev.fecha ?? '') || Number(prev.id))) novPorGuia.set(n.id_guia, n);
      }
    }
    const activaDe = (g: GuiaN) => esNovedadActiva(g) || (!!novPorGuia.get(g.id) && novedadPendiente(novPorGuia.get(g.id)!) && !g.anulada);

    // 2) Remisión de cada guía → vendedor (copia; lo que falte se pide a Effi si la fuente es Effi)
    const refs = [...new Set(guias.map(g => g.id_ref).filter(Boolean))] as string[];
    const rem = new Map<string, { id: string; vendedor: string; obs: string | null }>();
    for (let i = 0; i < refs.length; i += 300) {
      const { data } = await supabase.from('effi_remisiones_api').select('id_effi, id_transaccion, vendedor, obs:datos->>observacion').in('id_effi', refs.slice(i, i + 300));
      for (const r of data ?? []) rem.set(String(r.id_effi), { id: String(r.id_transaccion ?? r.id_effi), vendedor: String(r.vendedor ?? ''), obs: (r as any).obs || null });
    }
    // Solo hace falta conocer el vendedor de las guías que están (o estuvieron) en novedad
    const { data: abiertas } = await supabase.from('novedades_effi').select('*').or('activa_en_effi.eq.true,estado.neq.solucionada');
    const previas = new Map<string, any>((abiertas ?? []).map((n: any) => [String(n.id_guia_effi), n]));
    // Guías en novedad que ya tuvieron tarjeta (aunque esté solucionada): se reabre la misma, nunca se duplica
    const activasIds = guias.filter(g => activaDe(g) && !previas.has(g.id)).map(g => g.id);
    for (let i = 0; i < activasIds.length; i += 300) {
      const { data } = await supabase.from('novedades_effi').select('*').in('id_guia_effi', activasIds.slice(i, i + 300));
      for (const n of data ?? []) previas.set(String((n as any).id_guia_effi), n);
    }
    const interesan = guias.filter(g => activaDe(g) || previas.has(g.id));
    const faltan = interesan.filter(g => g.id_ref && !rem.has(g.id_ref));
    if (faltan.length && fuente === 'effi') {
      try {
        for (const r of await listarRemisiones(desde, hasta, 40)) {
          if (r?.id != null) rem.set(String(r.id), { id: String(r.id_transaccion || r.id), vendedor: String(r.nombre_vendedor ?? ''), obs: r.observacion || null });
        }
      } catch { /* sin vendedor: esas guías no entran (no se adivina) */ }
    }

    const objetivo = interesan.filter(g => previas.has(g.id) || (g.id_ref && esVendedorObjetivo(rem.get(g.id_ref)?.vendedor)));
    const ahora = new Date().toISOString();
    let nuevas = 0, cambios = 0;

    // 3) Producto y foto (del pedido en QuinChat: clientes_funnelish; si no, venta del módulo de vendedores)
    const nuevasGuias = objetivo.filter(g => !previas.has(g.id) && activaDe(g));
    const telDe = new Map(nuevasGuias.map(g => [g.id, telefonoValido(g.tel_raw)]));
    const tels = [...new Set([...telDe.values()].filter(Boolean))] as string[];
    const pedidos = new Map<string, any[]>();
    if (tels.length) {
      const { data } = await supabase.from('clientes_funnelish').select('telefono, producto, talla, foto_producto, created_at').in('telefono', tels).order('created_at', { ascending: false }).limit(2000);
      for (const p of data ?? []) { const k = String(p.telefono); pedidos.set(k, [...(pedidos.get(k) ?? []), p]); }
      const sinPedido = tels.filter(t => !pedidos.has(t));
      if (sinPedido.length) {
        const { data: vv } = await supabase.from('vv_ventas').select('id, cliente_celular, creado_at').in('cliente_celular', sinPedido).is('papelera_at', null).order('creado_at', { ascending: false });
        const ids = (vv ?? []).map((v: any) => v.id);
        const { data: its } = ids.length ? await supabase.from('vv_items').select('venta_id, nombre, color, talla, foto_oficial, foto_vendedor').in('venta_id', ids) : { data: [] as any[] };
        for (const v of vv ?? []) {
          const it = (its ?? []).filter((i: any) => i.venta_id === v.id);
          if (!it.length) continue;
          const k = String(v.cliente_celular);
          pedidos.set(k, [...(pedidos.get(k) ?? []), {
            producto: it.map((i: any) => [i.nombre, i.color].filter(Boolean).join(' ')).join(' + '),
            talla: it.map((i: any) => i.talla).filter(Boolean).join(' / '),
            foto_producto: it[0].foto_oficial || it[0].foto_vendedor || null, created_at: v.creado_at,
          }]);
        }
      }
    }
    const pedidoDe = (tel: string | null, fecha: string | null) => {
      const lista = tel ? pedidos.get(tel) ?? [] : [];
      if (!lista.length) return null;
      const f = fecha ? Date.parse(fecha) : Date.now();
      // el pedido más reciente ANTES de la guía (con 1 día de margen); si no hay, el más reciente
      return lista.find(p => Date.parse(p.created_at) <= f + 86400_000) ?? lista[0];
    };

    // 4) Nuevas → una fila por guía (índice único: nunca se duplica)
    if (nuevasGuias.length) {
      const filas = nuevasGuias.map(g => {
        const tel = telDe.get(g.id) ?? null, p = pedidoDe(tel, g.fecha), r = g.id_ref ? rem.get(g.id_ref) : undefined;
        const ne = novPorGuia.get(g.id);
        return {
          id_guia_effi: g.id, guia: g.guia, transportadora: g.transportadora,
          id_remision: r?.id ?? g.id_ref, vendedor: r?.vendedor ?? null,
          cliente: g.nombre, telefono: tel, telefono_original: g.tel_raw || null,
          ciudad: g.ciudad, departamento: g.depto, direccion: g.direccion,
          producto: p?.producto ?? null, talla: p?.talla ?? null, foto: p?.foto_producto ?? null, contenido_effi: g.contenido,
          valor_recaudo: g.recaudo, estado_effi: g.estado || null, estado_effi_comercio: g.estado_com || null,
          motivo: textoNovedad(ne) || g.estado || g.estado_com || null,
          id_novedad_effi: ne?.id ?? null, novedad_texto: textoNovedad(ne), aclaracion: ne?.aclaracion ?? null,
          estado_novedad_effi: ne?.estado ?? null, soluciones: ne?.soluciones ?? null, fecha_novedad: ne?.fecha ?? null,
          observacion_effi: r?.obs ?? null, url_guia: g.url, fecha_guia: g.fecha,
          estado: 'nueva', activa_en_effi: true,
        };
      });
      const { data: ins, error } = await supabase.from('novedades_effi').upsert(filas, { onConflict: 'id_guia_effi', ignoreDuplicates: true }).select('id, id_guia_effi, motivo');
      if (error) throw new Error(`guardar novedades: ${error.message}`);
      nuevas = (ins ?? []).length;
      if (ins?.length) await supabase.from('novedades_effi_historial').insert(ins.map((n: any) => ({ novedad_id: n.id, tipo: 'effi', detalle: `Llegó la novedad desde Effi: ${n.motivo ?? ''}`.trim(), por: 'Effi' })));
    }

    // 5) Cambios de estado de las que ya estaban
    for (const g of objetivo) {
      const n = previas.get(g.id); if (!n) continue;
      if (fuente === 'copia' && g.copia_at && n.actualizado_at && Date.parse(n.actualizado_at) > Date.parse(g.copia_at)) continue;
      const activa = activaDe(g);
      const estadoTxt = g.estado || g.estado_com || null;
      const ne = novPorGuia.get(g.id);
      const cambioGuia = (n.estado_effi ?? null) !== (g.estado || null) || (n.estado_effi_comercio ?? null) !== (g.estado_com || null);
      const cambioNov = !!ne && ((n.id_novedad_effi ?? null) !== ne.id || (n.estado_novedad_effi ?? null) !== (ne.estado ?? null) || (n.soluciones ?? null) !== (ne.soluciones ?? null));
      const cambioEffi = cambioGuia || cambioNov;
      if (!cambioEffi && activa === n.activa_en_effi) continue;
      const upd: Record<string, any> = { estado_effi: g.estado || null, estado_effi_comercio: g.estado_com || null, activa_en_effi: activa, actualizado_at: ahora };
      const hist: { tipo: string; detalle: string }[] = [];
      if (cambioGuia) hist.push({ tipo: 'effi', detalle: `Guía en Effi: ${n.estado_effi || n.estado_effi_comercio || '—'} → ${estadoTxt ?? '—'}` });
      if (cambioNov && ne) {
        Object.assign(upd, { id_novedad_effi: ne.id, novedad_texto: textoNovedad(ne), aclaracion: ne.aclaracion, estado_novedad_effi: ne.estado, soluciones: ne.soluciones, fecha_novedad: ne.fecha });
        hist.push({ tipo: 'effi', detalle: `Novedad Effi #${ne.id}: ${textoNovedad(ne) ?? '—'}${ne.estado ? ` · ${ne.estado}` : ''}${ne.soluciones != null ? ` · ${ne.soluciones} solución(es)` : ''}` });
      }
      if (activa) {
        upd.motivo = textoNovedad(ne) || estadoTxt;
        if (n.resultado === 'en_ruta') upd.resultado = null;   // volvió a novedad: ya no está «en ruta»
        if (n.estado === 'solucionada') {           // volvió a caer en novedad → se reabre la MISMA tarjeta
          Object.assign(upd, { estado: 'nueva', resultado: null, solucionada_at: null, visto_at: null, estado_cambio_at: ahora });
          hist.push({ tipo: 'estado', detalle: 'Reabierta: la guía volvió a quedar en novedad' });
        }
      } else {
        const res = resultadoEffi(g);
        if (res !== 'en_ruta') {
          Object.assign(upd, { estado: 'solucionada', resultado: res, solucionada_at: ahora, estado_cambio_at: ahora });
          hist.push({ tipo: 'estado', detalle: `Solucionada automáticamente: ${res === 'entregada' ? 'Effi la marcó ENTREGADA' : res === 'devuelta' ? 'Effi la marcó en DEVOLUCIÓN' : 'guía ANULADA en Effi'}` });
        } else {
          upd.resultado = 'en_ruta';
        }
      }
      const { error } = await supabase.from('novedades_effi').update(upd).eq('id', n.id);
      if (!error) {
        cambios++;
        await supabase.from('novedades_effi_historial').insert(hist.map(h => ({ novedad_id: n.id, tipo: h.tipo, detalle: h.detalle, por: 'Effi' })));
      }
    }
    return cerrar({ ok: true, guias: guias.length, nuevas, cambios });
  } catch (e: any) {
    return cerrar({ ok: false, error: e?.message ?? String(e) });
  }
}

/** Decide si toca sincronizar y con qué fuente (para no golpear a Effi con cada panel abierto). */
export async function sincronizarSiToca(origen: string, forzarEffi = false) {
  const supabase = createServerSupabaseClient();
  const { data: ult } = await supabase.from('novedades_effi_sync').select('origen, inicio, fin, ok').order('inicio', { ascending: false }).limit(20);
  const enCurso = (ult ?? []).find((s: any) => !s.fin && Date.now() - Date.parse(s.inicio) < 3 * 60_000);
  if (enCurso) return { ok: true, omitida: 'Ya hay una sincronización en curso' };
  const ultEffi = (ult ?? []).find((s: any) => String(s.origen).endsWith(':effi') && s.ok);
  const ultCualquiera = (ult ?? [])[0];
  const hace = (s: any) => (s ? Date.now() - Date.parse(s.inicio) : Infinity);
  if (forzarEffi) {
    if (hace(ultEffi) < 60_000) return { ok: true, omitida: 'Se acaba de traer de Effi hace menos de un minuto' };
    return sincronizarNovedades('effi', origen);
  }
  if (hace(ultEffi) > 10 * 60_000) return sincronizarNovedades('effi', origen);
  if (hace(ultCualquiera) > 2 * 60_000) return sincronizarNovedades('copia', origen);
  return { ok: true, omitida: 'Al día' };
}

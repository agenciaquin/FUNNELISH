import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Sincronización con la API de Effi — SOLO LECTURA (servicios GET).
 * QuinChat nunca crea, modifica ni anula nada en Effi desde aquí.
 *
 * Documentación (Effi → Integraciones → Documentación API), resumida en docs/EFFI-API-NOTAS.md:
 *  · Authorization: Bearer <API key>  (variable EFFI_API_TOKEN en Vercel)
 *  · GET https://effi.com.co/api/guia_transporte?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&pagina=N&por_pagina=100
 *  · GET https://effi.com.co/api/remision_v?desde=…&hasta=…&pagina=N&por_pagina=100  (remisiones de venta)
 *  · 120 peticiones/min; si se pasa responde 429 con Retry-After.
 */
const BASE = (process.env.EFFI_API_URL || 'https://effi.com.co/api').replace(/\/+$/, '');

export function effiConfigurado(): boolean {
  return !!process.env.EFFI_API_TOKEN;
}

export async function effiGet(ruta: string, params: Record<string, string | number>): Promise<any> {
  const token = process.env.EFFI_API_TOKEN;
  if (!token) throw new Error('Falta EFFI_API_TOKEN en Vercel');
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const url = `${BASE}/${ruta.replace(/^\/+/, '')}?${qs}`;
  for (let intento = 0; intento < 3; intento++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(25_000) });
    if (res.status === 429) {
      const espera = Math.min(20, Number(res.headers.get('retry-after')) || 5);
      await new Promise(r => setTimeout(r, espera * 1000));
      continue;
    }
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) {
      const msg = j?.mensaje || `HTTP ${res.status}`;
      if (res.status === 401) throw new Error(`Effi rechazó la API key (401): ${msg}. Revisa que no esté vencida (360 días).`);
      throw new Error(`Effi respondió ${res.status}: ${msg}`);
    }
    return j;
  }
  throw new Error('Effi: demasiadas peticiones (429) — se intenta en la próxima sincronización');
}

/**
 * ESCRITURA en Effi (POST). Usa una clave APARTE: EFFI_API_TOKEN_ESCRITURA (Vercel).
 * Solo la usa la subida de remisiones de Ventas Vendedores, con autorización del dueño.
 * No reintenta: un POST repetido lo frena Effi con el idempotency_key (409).
 */
export function effiEscrituraConfigurada(): boolean {
  return !!process.env.EFFI_API_TOKEN_ESCRITURA;
}
export async function effiPost(ruta: string, cuerpo: Record<string, any>): Promise<{ status: number; json: any }> {
  const token = process.env.EFFI_API_TOKEN_ESCRITURA;
  if (!token) throw new Error('Falta EFFI_API_TOKEN_ESCRITURA en Vercel');
  const res = await fetch(`${BASE}/${ruta.replace(/^\/+/, '')}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo), cache: 'no-store', signal: AbortSignal.timeout(45_000),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

/** Todas las guías creadas entre dos fechas (paginando de a 100). */
export async function listarGuias(desde: string, hasta: string, maxPaginas = 60): Promise<any[]> {
  const todas: any[] = [];
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const j = await effiGet('guia_transporte', { desde, hasta, pagina, por_pagina: 100 });
    todas.push(...(Array.isArray(j.data) ? j.data : []));
    const total = Number(j?.paginacion?.total_paginas) || 1;
    if (pagina >= total) break;
  }
  return todas;
}

// ── Estado de la guía → estados que ya usa QuinChat (effi_guias) ─────────────
// Mientras no tengamos la lista oficial de estados de Effi, se clasifica por
// palabras (conservador: lo que no se reconoce queda "en_camino").
export type EstadoQuin = 'entregada' | 'en_camino' | 'devuelta' | 'novedad' | 'anulada';
export function estadoQuin(g: any): EstadoQuin {
  const anulada = !!g?.fecha_anular || String(g?.vigente ?? '1') === '0';
  if (anulada) return 'anulada';
  const t = `${g?.estado ?? ''} ${g?.estado_efficommerce ?? ''}`.toLowerCase();
  if (/devoluci|devuelt|retorn/.test(t)) return 'devuelta';
  if (/entregad/.test(t)) return 'entregada';
  if (/novedad|incidencia|siniestr/.test(t)) return 'novedad';
  return 'en_camino';
}

const tel10 = (t: unknown) => String(t ?? '').replace(/\D/g, '').slice(-10);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const fecha = (v: unknown) => (v ? String(v) : null);

const PRIORIDAD: EstadoQuin[] = ['en_camino', 'novedad', 'anulada', 'devuelta', 'entregada'];

/**
 * Trae las guías de los últimos `dias` días, las guarda completas en effi_guias_api
 * y actualiza effi_guias (teléfono → estado/flete) que usan "Estado en Effi" y META ADS.
 */
export async function sincronizarGuiasEffi(origen: 'cron' | 'boton', dias = 60) {
  const supabase = createServerSupabaseClient();
  const hoy = new Date(Date.now() - 5 * 3600_000);                 // fecha de Colombia
  // Effi trata `hasta` como EXCLUSIVO (hasta=hoy no trae las guías de hoy; comprobado
  // el 04-nov-2026: con hasta=03-nov no llegó ninguna del 3, con hasta=04-nov llegaron 172).
  // Por eso se pide hasta MAÑANA.
  const hasta = new Date(hoy.getTime() + 86400_000).toISOString().slice(0, 10);
  const desde = new Date(hoy.getTime() - dias * 86400_000).toISOString().slice(0, 10);
  // Una sola sincronización a la vez: si el cron y el botón coinciden, chocaban al
  // reescribir effi_guias ("duplicate key effi_guias_pkey", 05-nov-2026).
  const { data: enCurso } = await supabase.from('effi_sync_log').select('id')
    .is('fin', null).gte('inicio', new Date(Date.now() - 5 * 60_000).toISOString()).limit(1);
  if (enCurso?.length) return { ok: false, error: 'Ya hay una sincronización en curso; intenta en un par de minutos.', desde, hasta };
  const { data: reg } = await supabase.from('effi_sync_log').insert({ origen, desde, hasta }).select('id').single();
  const cerrar = async (r: { ok: boolean; guias?: number; telefonos?: number; error?: string }) => {
    if (reg?.id) await supabase.from('effi_sync_log').update({ fin: new Date().toISOString(), ok: r.ok, guias: r.guias ?? 0, telefonos: r.telefonos ?? 0, error: r.error ?? null }).eq('id', reg.id);
    return { ...r, desde, hasta };
  };

  if (!effiConfigurado()) return cerrar({ ok: false, error: 'Falta EFFI_API_TOKEN en Vercel' });

  let guias: any[];
  try { guias = await listarGuias(desde, hasta); }
  catch (e: any) { return cerrar({ ok: false, error: e?.message ?? String(e) }); }

  // 1) Copia completa (upsert por id de Effi)
  const filas = guias.filter(g => g?.id != null).map(g => ({
    id_effi: String(g.id),
    guia: g.guia ?? null, guia_adicional: g.guia_adicional ?? null,
    transportadora: g.nombre_transportadora_efficommerce || g.nombre_transportadora || null,
    estado: g.estado ?? null, est_guia: g.est_guia ?? null, estado_efficommerce: g.estado_efficommerce ?? null,
    telefono: tel10(g.telefonos_destinatario) || null,
    nombre: g.nombre_destinatario ?? null, cedula: g.id_destinatario ?? null,
    ciudad: g.nombre_ciudad_destinatario ?? null, departamento: g.nombre_provincia_destinatario ?? null,
    direccion: g.direccion_destinatario ?? null,
    valor_recaudo: num(g.valor_recaudo), valor_flete: num(g.valor_flete),
    fecha_trans: fecha(g.fecha_trans), fecha_envio: fecha(g.fecha_envio),
    fecha_estado_final: fecha(g.fecha_estado_final), fecha_anular: fecha(g.fecha_anular),
    vigente: String(g.vigente ?? '1') !== '0',
    url_guia: g.url_guia_transportadora ?? null,
    tipo_trans_ref: g.tipo_trans_ref ?? null, id_ref: g.id_ref ?? null,
    datos: g, actualizado_at: new Date().toISOString(),
  }));
  try {
    // Lotes de 100: con 500 filas (cada una con su JSON completo) Supabase cortaba por
    // "statement timeout" (05-nov-2026).
    for (let i = 0; i < filas.length; i += 100) {
      const { error } = await supabase.from('effi_guias_api').upsert(filas.slice(i, i + 100), { onConflict: 'id_effi' });
      if (error) throw new Error(error.message);
    }
  } catch (e: any) { return cerrar({ ok: false, guias: filas.length, error: `guardar guías: ${e?.message}` }); }

  // 2) Resumen por teléfono para effi_guias (gana la guía más reciente; empate → estado más avanzado)
  const porTel = new Map<string, { estado: EstadoQuin; flete: number; fecha: number }>();
  for (const g of guias) {
    const t = tel10(g?.telefonos_destinatario);
    if (t.length !== 10) continue;
    const estado = estadoQuin(g);
    const f = Date.parse(String(g?.fecha_trans ?? '')) || 0;
    const prev = porTel.get(t);
    if (!prev || f > prev.fecha || (f === prev.fecha && PRIORIDAD.indexOf(estado) > PRIORIDAD.indexOf(prev.estado))) {
      porTel.set(t, { estado, flete: Math.round(Number(g?.valor_flete) || 0), fecha: f });
    }
  }
  const telefonos = [...porTel.keys()];
  try {
    for (let i = 0; i < telefonos.length; i += 300) {
      const lote = telefonos.slice(i, i + 300);
      // Se conserva el motivo de anulación que ya venía del archivo de Effi
      const { data: previas } = await supabase.from('effi_guias').select('telefono, motivo').in('telefono', lote);
      const motivo = new Map((previas ?? []).map((p: any) => [String(p.telefono), String(p.motivo ?? '')]));
      // upsert por teléfono (antes: borrar + insertar, que chocaba si dos procesos coincidían)
      const { error: upErr } = await supabase.from('effi_guias').upsert(lote.map(t => ({
        telefono: t, estado: porTel.get(t)!.estado, flete: porTel.get(t)!.flete, motivo: motivo.get(t) ?? '',
        actualizado_at: new Date().toISOString(),
      })), { onConflict: 'telefono' });
      if (upErr) throw new Error(upErr.message);
    }
  } catch (e: any) { return cerrar({ ok: false, guias: filas.length, error: `actualizar cruce: ${e?.message}` }); }

  // 3) Remisiones de venta (ventas subidas a Effi que quizá aún no tienen guía).
  //    Si falla, NO tumba la sincronización de guías: solo queda anotado.
  const rem = await sincronizarRemisionesEffi(hasta, 20);
  if (reg?.id) await supabase.from('effi_sync_log').update({ remisiones: rem.n, error_remisiones: rem.error ?? null }).eq('id', reg.id);

  // 4) Descuento por entrega (si está encendido): plantilla a las guías recién ENTREGADAS.
  let descuentos: any = null;
  try {
    const { procesarDescuentosEntrega } = await import('@/lib/descuento-entrega');
    descuentos = await procesarDescuentosEntrega(supabase);
  } catch (e: any) { descuentos = { error: e?.message ?? String(e) }; }

  // 5) Aviso «pedido listo para reclamar» (Panel de Novedades). Apagado por defecto; máx. 3 por pasada
  //    para no alargar esta sincronización. Si falla, no afecta nada de lo anterior.
  let avisosOficina: any = null, avisosIntento: any = null;
  try {
    const { procesarAvisosOficina } = await import('@/lib/aviso-oficina');
    avisosOficina = await procesarAvisosOficina(supabase, undefined, 3);
  } catch (e: any) { avisosOficina = { error: e?.message ?? String(e) }; }
  // 6) Aviso «Intento de entrega» (Panel de Novedades). Apagado por defecto. Primero se ponen al día las tarjetas
  //    del panel con la copia recién bajada (sin ir otra vez a Effi) y luego máx. 2 avisos por pasada.
  try {
    const { ajustesIntento, procesarAvisosIntento } = await import('@/lib/aviso-intento');
    const { AVISO_DIRECCION_SRV } = await import('@/lib/aviso-direccion');
    const [onI, onD] = [(await ajustesIntento(supabase)).activo, (await AVISO_DIRECCION_SRV.ajustes(supabase)).activo];
    if (onI || onD) {
      const { sincronizarNovedades } = await import('@/lib/novedades-effi');
      await sincronizarNovedades('copia', 'cron');
      avisosIntento = {
        intento: onI ? await procesarAvisosIntento(supabase, undefined, 2) : { apagado: true },
        direccion: onD ? await AVISO_DIRECCION_SRV.procesar(supabase, undefined, 2) : { apagado: true },
      };
    } else avisosIntento = { apagado: true };
  } catch (e: any) { avisosIntento = { error: e?.message ?? String(e) }; }

  return { ...(await cerrar({ ok: true, guias: filas.length, telefonos: telefonos.length })), remisiones: rem.n, error_remisiones: rem.error ?? null, descuentos, avisos_oficina: avisosOficina, avisos_intento: avisosIntento };
}

/** Todas las remisiones de venta entre dos fechas (GET remision_v, paginando de a 100). */
export async function listarRemisiones(desde: string, hasta: string, maxPaginas = 40): Promise<any[]> {
  const todas: any[] = [];
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const j = await effiGet('remision_v', { desde, hasta, pagina, por_pagina: 100 });
    todas.push(...(Array.isArray(j.data) ? j.data : []));
    const total = Number(j?.paginacion?.total_paginas) || 1;
    if (pagina >= total) break;
  }
  return todas;
}

/** Fecha de Effi ("2026-09-02 14:14:49") → ISO. La API la da en UTC (comprobado el
 *  04-nov-2026: una remisión con "21:55" ya estaba en la sincronización de las 17:16
 *  hora Colombia = 22:16 UTC), así que se marca como UTC. */
const fechaCol = (v: unknown) => {
  const t = String(v ?? '').trim();
  if (!t) return null;
  return /[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t.replace(' ', 'T')}Z`;
};

/** ¿La remisión está anulada? (por el texto del estado; `vigente` se guarda pero no se usa
 *  hasta confirmar con datos reales qué significa en remisiones). */
export const remisionAnulada = (r: { estado?: string | null }) => /anulad/i.test(String(r?.estado ?? ''));

/**
 * Copia las remisiones de venta de los últimos `dias` días en effi_remisiones_api.
 * Solo lectura en Effi. `hasta` ya viene como MAÑANA (Effi lo trata exclusivo).
 */
export async function sincronizarRemisionesEffi(hasta: string, dias = 20): Promise<{ n: number; error?: string }> {
  const supabase = createServerSupabaseClient();
  const desde = new Date(Date.parse(hasta) - (dias + 1) * 86400_000).toISOString().slice(0, 10);
  try {
    const rems = await listarRemisiones(desde, hasta);
    const filas = rems.filter(r => r?.id_transaccion || r?.id).map(r => ({
      id_transaccion: String(r.id_transaccion || `${r.prefijo ?? ''}-${r.id}`),
      id_effi: r.id != null ? String(r.id) : null,
      telefono: tel10(r.telefono_cliente) || null,
      nombre: r.nombre_cliente ?? null, cedula: r.id_cliente ?? null,
      ciudad: r.nombre_ciudad ?? null, departamento: r.nombre_provincia ?? null,
      direccion: r.direccion_cliente ?? null,
      estado: r.estado ?? null, est_remision_v: r.est_remision_v ?? null,
      vigente: r.vigente != null ? String(r.vigente) : null,
      total: num(r.total),
      guia: r.guia ?? null, id_guia_transporte: r.id_guia_transporte ?? null,
      fecha_trans: fechaCol(r.fecha_trans),
      vendedor: r.nombre_vendedor ?? null, responsable: r.nombre_responsable ?? null,
      datos: r, actualizado_at: new Date().toISOString(),
    }));
    for (let i = 0; i < filas.length; i += 500) {
      const { error } = await supabase.from('effi_remisiones_api').upsert(filas.slice(i, i + 500), { onConflict: 'id_transaccion' });
      if (error) throw new Error(error.message);
    }
    return { n: filas.length };
  } catch (e: any) {
    return { n: 0, error: e?.message ?? String(e) };
  }
}

export async function ultimaSyncEffi() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('effi_sync_log').select('*').order('inicio', { ascending: false }).limit(1).maybeSingle();
  return data;
}

/**
 * RECOMPRA tras el DESCUENTO (10-nov-2026, dueño).
 *
 * Cuando un cliente ya entregado recibe el descuento y vuelve a comprar, todo lo que ya estaba en
 * Effi o en el panel ANTES del «corte» es la compra VIEJA. Así el pedido nuevo se puede subir a Effi
 * aunque el cliente ya tenga una remisión, y sale como «sin subir» hasta que se suba.
 *
 * CORTE de un teléfono = el más reciente de:
 *   · el último descuento ENVIADO por plantilla (descuentos_entrega, estado 'enviado', enviado_at);
 *   · la última recompra registrada con la etiqueta COMPRO EN DESCUENTO (clientes_funnelish
 *     estado 'recompra_descuento') menos 24 h (descuentos mandados a mano, sin fila en descuentos_entrega).
 *
 *  · `descuentoDe(conv)`  → corte de ese chat (o null).
 *  · `cortesRecompra()`   → { tel10: corte } de todos.
 *  · `recompras()`        → chats con corte Y señal de compra nueva después (etiqueta COMPRO EN DESCUENTO
 *                           o pedido nuevo en clientes_funnelish). Solo esos pasan a «por subir».
 * Solo lee. No toca descuentos_entrega, Effi ni ventas.
 */

export const tel10 = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-10);

/** Effi guarda la hora sin zona fiable: margen para cruzar remisiones con el corte. */
export const MARGEN_MS = 6 * 3600_000;
const ANTES_RECOMPRA_MS = 24 * 3600_000;
/** ¿La fecha `t` es de DESPUÉS del corte `desde`? (lo de antes es la compra vieja) */
export const esNueva = (t: string | null | undefined, desde: string, margen = 0) =>
  !!t && Date.parse(t) >= Date.parse(desde) - margen;

const masNueva = (a: string | undefined, b: string) => (!a || Date.parse(b) > Date.parse(a) ? b : a);

// Tablas pequeñas, pero la lista de chats pregunta cada 30 s: se guardan 2 min.
let cacheCortes: { t: number; datos: Map<string, string> } | null = null;

/** { tel10: corte } de todos los clientes con descuento enviado o recompra registrada. */
export async function cortesRecompra(supabase: any, tels?: string[]): Promise<Map<string, string>> {
  if (!tels && cacheCortes && Date.now() - cacheCortes.t < 2 * 60_000) return cacheCortes.datos;
  const out = new Map<string, string>();
  try {
    let qd = supabase.from('descuentos_entrega').select('telefono, enviado_at')
      .eq('estado', 'enviado').not('enviado_at', 'is', null).limit(5000);
    let qr = supabase.from('clientes_funnelish').select('telefono, created_at')
      .eq('estado', 'recompra_descuento').is('papelera_at', null).limit(5000);
    if (tels) {
      qd = qd.in('telefono', tels);
      qr = qr.in('telefono', [...tels, ...tels.map(t => `57${t}`)]);
    }
    const [{ data: descs }, { data: recs }] = await Promise.all([qd, qr]);
    for (const d of (descs ?? []) as any[]) {
      const t = tel10(d.telefono);
      if (t.length === 10) out.set(t, masNueva(out.get(t), new Date(d.enviado_at).toISOString()));
    }
    for (const r of (recs ?? []) as any[]) {
      const t = tel10(r.telefono);
      if (t.length === 10 && r.created_at) out.set(t, masNueva(out.get(t), new Date(Date.parse(r.created_at) - ANTES_RECOMPRA_MS).toISOString()));
    }
  } catch { /* sin datos: todo queda como antes */ }
  if (!tels) cacheCortes = { t: Date.now(), datos: out };
  return out;
}

/** Corte de un chat (solo chats con número: 57 + 10 dígitos). */
export async function descuentoDe(supabase: any, conv: string): Promise<string | null> {
  const d = String(conv ?? '').replace(/\D/g, '');
  if (!/^(57)?\d{10}$/.test(d)) return null;
  const t = tel10(d);
  return (await cortesRecompra(supabase, [t])).get(t) ?? null;
}

let cache: { t: number; datos: Record<string, string> } | null = null;

/** { '57<tel>': corte } de los chats que VOLVIERON A COMPRAR después del corte. */
export async function recompras(supabase: any): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.t < 2 * 60_000) return cache.datos;
  const out: Record<string, string> = {};
  try {
    const desde = await cortesRecompra(supabase);
    const tels = [...desde.keys()];
    for (let i = 0; i < tels.length; i += 300) {
      const lote = tels.slice(i, i + 300);
      const [{ data: convs }, { data: peds }] = await Promise.all([
        // Señal 1: el asesor puso la etiqueta «COMPRO EN DESCUENTO»
        supabase.from('conversations').select('id').in('id', lote.map(t => `57${t}`)).ilike('label', '%COMPRO EN DESCUENTO%'),
        // Señal 2: entró un pedido nuevo (embudo o recompra registrada) después del corte
        supabase.from('clientes_funnelish').select('telefono, created_at').in('telefono', [...lote, ...lote.map(t => `57${t}`)])
          .is('papelera_at', null).order('created_at', { ascending: false }).limit(2000),
      ]);
      for (const c of (convs ?? []) as any[]) { const t = tel10(c.id); if (desde.has(t)) out[`57${t}`] = desde.get(t)!; }
      for (const p of (peds ?? []) as any[]) {
        const t = tel10(p.telefono), d = desde.get(t);
        if (d && esNueva(p.created_at, d)) out[`57${t}`] = d;
      }
    }
  } catch { /* sin datos: la lista queda como antes */ }
  cache = { t: Date.now(), datos: out };
  return out;
}

export type EstadoEffiRecompra = 'subida' | 'remision' | 'anulada' | 'sin_subir';

/**
 * Estado en Effi de las ventas NUEVAS (después del corte), mirando SOLO lo de Effi posterior al corte:
 * remisión con guía → 'subida' · sin guía o marcada a mano → 'remision' · solo anuladas → 'anulada' · nada → 'sin_subir'.
 * Entrada: [{ tel, conv, corte }]. Salida: { tel10: estado }.
 */
export async function estadoEffiRecompras(
  supabase: any, items: { tel: string; conv: string; corte: string }[],
): Promise<Map<string, EstadoEffiRecompra>> {
  const out = new Map<string, EstadoEffiRecompra>();
  if (!items.length) return out;
  const corteDe = new Map(items.map(i => [i.tel, i.corte]));
  for (const i of items) out.set(i.tel, 'sin_subir');
  try {
    const tels = [...corteDe.keys()];
    const minCorte = new Date(Math.min(...items.map(i => Date.parse(i.corte))) - MARGEN_MS).toISOString();
    const [{ data: rems }, { data: vincs }] = await Promise.all([
      supabase.from('effi_remisiones_api').select('telefono, estado, vigente, guia, fecha_trans')
        .in('telefono', tels).gte('fecha_trans', minCorte).limit(2000),
      supabase.from('effi_vinculos').select('conversacion_id, creado_at').in('conversacion_id', items.map(i => i.conv)),
    ]);
    const peso: Record<EstadoEffiRecompra, number> = { sin_subir: 0, anulada: 1, remision: 2, subida: 3 };
    const subir = (t: string, e: EstadoEffiRecompra) => { if (peso[e] > peso[out.get(t) ?? 'sin_subir']) out.set(t, e); };
    for (const r of (rems ?? []) as any[]) {
      const t = tel10(r.telefono), c = corteDe.get(t);
      if (!c || !esNueva(r.fecha_trans, c, MARGEN_MS)) continue;
      const anulada = String(r.vigente ?? '') === '0' || /anulad|cancelad/i.test(String(r.estado ?? ''));
      subir(t, anulada ? 'anulada' : r.guia ? 'subida' : 'remision');
    }
    for (const v of (vincs ?? []) as any[]) {
      const t = tel10(v.conversacion_id), c = corteDe.get(t);
      if (c && esNueva(v.creado_at, c)) subir(t, 'remision');
    }
  } catch { /* sin datos: quedan «sin subir» */ }
  return out;
}

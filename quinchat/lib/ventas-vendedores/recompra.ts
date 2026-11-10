/**
 * RECOMPRA tras el DESCUENTO POR ENTREGA (10-nov-2026, dueño).
 *
 * Cuando a un cliente ya entregado se le manda la plantilla de descuento (descuentos_entrega,
 * estado 'enviado'), todo lo que ya estaba en Effi o en el panel ANTES de ese envío es la compra
 * VIEJA. Así el chat puede subir un pedido NUEVO a Effi aunque ya tenga una remisión.
 *
 *  · `descuentoDe(conv)`      → fecha del último descuento enviado a ese chat (o null).
 *  · `recompras()`            → chats con descuento Y señal de compra nueva después de él
 *                               (etiqueta COMPRO EN DESCUENTO o pedido nuevo en clientes_funnelish).
 *                               Solo esos pasan a «pendientes por subir» en la lista de chats.
 * Solo lee. No toca descuentos_entrega, Effi ni ventas.
 */

const tel10 = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-10);

/** La compra vieja es de días antes (se entregó y luego salió el descuento). Margen por horas de Effi. */
export const MARGEN_MS = 6 * 3600_000;
/** ¿La fecha `t` es de DESPUÉS del descuento `desde`? (lo de antes es la compra vieja) */
export const esNueva = (t: string | null | undefined, desde: string, margen = 0) =>
  !!t && Date.parse(t) >= Date.parse(desde) - margen;

/** Último descuento ENVIADO a este chat (solo chats con número: 57 + 10 dígitos). */
export async function descuentoDe(supabase: any, conv: string): Promise<string | null> {
  const d = String(conv ?? '').replace(/\D/g, '');
  if (!/^(57)?\d{10}$/.test(d)) return null;
  const { data } = await supabase.from('descuentos_entrega').select('enviado_at')
    .eq('telefono', tel10(d)).eq('estado', 'enviado').not('enviado_at', 'is', null)
    .order('enviado_at', { ascending: false }).limit(1).maybeSingle();
  return data?.enviado_at ?? null;
}

// La lista de chats pregunta cada 30 s: se guarda 2 min (no golpear la base en horas pico).
let cache: { t: number; datos: Record<string, string> } | null = null;

/** { '57<tel>': fecha del descuento } de los chats que VOLVIERON A COMPRAR después del descuento. */
export async function recompras(supabase: any): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.t < 2 * 60_000) return cache.datos;
  const out: Record<string, string> = {};
  try {
    const { data: descs } = await supabase.from('descuentos_entrega').select('telefono, enviado_at')
      .eq('estado', 'enviado').not('enviado_at', 'is', null).order('enviado_at', { ascending: true }).limit(5000);
    const desde = new Map<string, string>(); // tel10 → último descuento
    for (const d of (descs ?? []) as any[]) { const t = tel10(d.telefono); if (t.length === 10) desde.set(t, d.enviado_at); }
    const tels = [...desde.keys()];
    for (let i = 0; i < tels.length; i += 300) {
      const lote = tels.slice(i, i + 300);
      const [{ data: convs }, { data: peds }] = await Promise.all([
        // Señal 1: el asesor puso la etiqueta «COMPRO EN DESCUENTO»
        supabase.from('conversations').select('id, label').in('id', lote.map(t => `57${t}`)).ilike('label', '%COMPRO EN DESCUENTO%'),
        // Señal 2: entró un pedido nuevo (embudo o recompra registrada) después del descuento
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

// =====================================================
// Clasificación de pedidos — FUENTE ÚNICA DE VERDAD
// La usan TODAS las pantallas (Pedidos, Estadísticas) para que los
// números cuadren siempre. No cambia la recepción de pedidos: solo
// LEE la referencia/UTM ya guardada y la traduce a canal/fuente.
// =====================================================

export type Canal = 'funnelish' | 'embudos' | 'whatsapp' | 'promociones' | 'sin_identificar';

export const CANAL_LABEL: Record<Canal, string> = {
  funnelish:      'Funnelish',
  embudos:        'Embudos QuinChat',
  whatsapp:       'WhatsApp (bot)',
  promociones:    'Promociones',
  sin_identificar:'Sin identificar',
};

/**
 * Canal de VENTA según el prefijo de `referencia`:
 *  web-…    → embudos propios de QuinChat
 *  venta-… / wa-… → bot de ventas de WhatsApp (ambos nacen en el chat de WhatsApp)
 *  promo-…  → promociones / links de vendedores (NO suma en estadísticas)
 *  número   → Funnelish (plataforma externa)
 *  resto    → sin identificar
 */
export function canalDePedido(referencia?: string | null): Canal {
  const r = String(referencia ?? '').trim();
  if (/^web-/i.test(r))                    return 'embudos';
  if (/^venta-/i.test(r) || /^wa-/i.test(r)) return 'whatsapp';
  if (/^promo-/i.test(r))                  return 'promociones';
  if (/^\d+$/.test(r))                     return 'funnelish';
  return 'sin_identificar';
}

export type Fuente = 'tiktok' | 'meta' | 'organico' | 'directo' | 'sin_identificar';

export const FUENTE_LABEL: Record<Fuente, string> = {
  tiktok:         'TikTok Ads',
  meta:           'Meta Ads',
  organico:       'Orgánico',
  directo:        'Directo',
  sin_identificar:'Sin identificar',
};

/**
 * Fuente PUBLICITARIA según la atribución guardada (utm_source/campaign/referrer).
 * No inventa atribución: si no hay señal clara, queda "sin identificar".
 */
export function fuenteDePedido(
  utm_source?: string | null,
  utm_campaign?: string | null,
  referrer?: string | null,
): Fuente {
  const s = String(utm_source ?? '').toLowerCase();
  const c = String(utm_campaign ?? '').trim();
  const ref = String(referrer ?? '').toLowerCase();

  if (/tiktok|tik\.?tok|ttclid|\btt\b/.test(s) || /tiktok/.test(ref)) return 'tiktok';
  if (/facebook|instagram|meta|\bfb\b|\big\b/.test(s))                return 'meta';
  if (/^\d{10,}$/.test(c))                                            return 'meta'; // IDs de anuncio Meta
  if (/organic|org[áa]nico/.test(s))                                  return 'organico';
  if (/direct|directo/.test(s))                                       return 'directo';
  return 'sin_identificar';
}

/** Logo/emoji corto para pintar la fuente en listas. */
export const FUENTE_ICONO: Record<Fuente, string> = {
  tiktok: '⬛', meta: '🔵', organico: '🌱', directo: '➡️', sin_identificar: '❔',
};

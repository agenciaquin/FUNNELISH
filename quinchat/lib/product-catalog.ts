/**
 * Catálogo de imágenes de productos KLIXMANT.
 * ⚠️  ARCHIVO GENERADO AUTOMÁTICAMENTE — NO EDITAR A MANO.
 * Para agregar productos: coloca la foto en /img y ejecuta:
 *   node generar-catalogo.js
 */

const BASE = 'https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/';

/** URL de imagen cuando el producto no está en el catálogo */
export const FALLBACK_IMAGE = `${BASE}placeholder.png`;

const CATALOG: Record<string, string> = {
  // ── ARGENTINA ───────────────────────────────────────────────────
  'ARGENTINA AZUL -  DORADO CAPOTA':       `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/ARGENTINA%20AZUL%20-%20%20DORADO%20CAPOTA.jpeg`,
  'ARGENTINA AZUL 2026':                   `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/ARGENTINA%20AZUL%202026.jpg`,
  'ARGENTINA BLANCO MARFIL 2026':          `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/ARGENTINA%20BLANCO%20MARFIL%202026.jpg`,
  'ARGENTINA NEGRO 2026':                  `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/ARGENTINA%20NEGRO%202026.jpg`,
  // ── BEIGE ───────────────────────────────────────────────────────
  'BEIGE CO FRANJA 2026':                  `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/BEIGE%20CO%20FRANJA%202026.jpg`,
  'BEIGE NEW YORK':                        `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/BEIGE%20NEW%20YORK.jpg`,
  // ── BLANCO ──────────────────────────────────────────────────────
  'BLANCO CO FRANJA 2026':                 `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/BLANCO%20CO%20FRANJA%202026.jpg`,
  'BLANCO MARFIL NEW YORK':                `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/BLANCO%20MARFIL%20NEW%20YORK.jpg`,
  // ── BM ──────────────────────────────────────────────────────────
  'BM AMARILLO ÉLITE 2026':                `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/BM%20AMARILLO%20%C3%89LITE%202026.jpg`,
  'BM AZUL OSCURO ÉLITE 2026':             `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/BM%20AZUL%20OSCURO%20%C3%89LITE%202026.jpg`,
  'BM BLANCO MARFIL ÉLITE 2026':           `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/BM%20BLANCO%20MARFIL%20%C3%89LITE%202026.jpg`,
  'BM NEGRO ÉLITE 2026':                   `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/BM%20NEGRO%20%C3%89LITE%202026.jpg`,
  // ── NEGRO ───────────────────────────────────────────────────────
  'NEGRO CO FRANJA 2026':                  `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/NEGRO%20CO%20FRANJA%202026.jpg`,
  'NEGRO NEW YORK':                        `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/NEGRO%20NEW%20YORK.jpg`,
  // ── PACK ────────────────────────────────────────────────────────
  'PACK X2':                               `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/PACK%20X2.jpg`,
  'PACK X3':                               `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/PACK%20X3%20.jpg`,
  // ── PORTUGAL ────────────────────────────────────────────────────
  'PORTUGAL  ROJO 2026':                   `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/PORTUGAL%20%20ROJO%202026.jpg`,
  'PORTUGAL BLANCO MARFIL 2026':           `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/PORTUGAL%20BLANCO%20MARFIL%202026.jpg`,
  'PORTUGAL NEGRO 2026':                   `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/PORTUGAL%20NEGRO%202026.jpg`,
  // ── RETRO ───────────────────────────────────────────────────────
  'RETRO  BLANCO MARFIL 1990':             `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/RETRO%20%20BLANCO%20MARFIL%201990.jpeg`,
  'RETRO AMARILLO 1990':                   `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/RETRO%20AMARILLO%201990.jpg`,
  'RETRO AMARILLO MARIPOSA  CUELLO ALTO':  `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/RETRO%20AMARILLO%20MARIPOSA%20%20CUELLO%20ALTO.jpeg`,
  'RETRO NEGRO 1990':                      `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/RETRO%20NEGRO%201990.jpeg`,
  'RETRO ROJO 1990':                       `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/RETRO%20ROJO%201990.jpeg`,
  // ── ROJO ────────────────────────────────────────────────────────
  'ROJO CO FRANJA 2026':                   `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/ROJO%20CO%20FRANJA%202026.jpg`,
  'ROJO NEW YORK':                         `https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/ROJO%20NEW%20YORK.jpg`,
};

/**
 * Devuelve la URL pública de la imagen del producto.
 * 1. Coincidencia exacta (case-insensitive)
 * 2. Coincidencia parcial (contiene)
 * 3. Coincidencia por palabras clave (mayor score gana)
 * Si no encuentra nada, devuelve FALLBACK_IMAGE.
 */
export function getProductImageUrl(productName: string): string {
  if (!productName?.trim()) return FALLBACK_IMAGE;
  const key = productName.trim().toUpperCase();

  // 1. Exacta
  for (const [catalogKey, url] of Object.entries(CATALOG)) {
    if (catalogKey.toUpperCase() === key) return url;
  }

  // 2. Parcial
  for (const [catalogKey, url] of Object.entries(CATALOG)) {
    const ck = catalogKey.toUpperCase();
    if (key.includes(ck) || ck.includes(key)) return url;
  }

  // 3. Por palabras clave (≥ 3 chars para evitar falsos positivos)
  const words = key.split(/\s+/).filter(w => w.length >= 3);
  let bestUrl   = FALLBACK_IMAGE;
  let bestScore = 0;
  for (const [catalogKey, url] of Object.entries(CATALOG)) {
    const ck    = catalogKey.toUpperCase();
    const score = words.filter(w => ck.includes(w)).length;
    if (score > bestScore) { bestScore = score; bestUrl = url; }
  }

  return bestUrl;
}

/**
 * Catálogo de imágenes de productos KLIXMANT.
 * Las imágenes están hosteadas en GitHub Pages (URL pública).
 * Agregar aquí cada producto nuevo con su URL de imagen.
 */

const BASE = 'https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/';

/** URL de imagen cuando el producto no está en el catálogo */
export const FALLBACK_IMAGE = `${BASE}placeholder.png`;

const CATALOG: Record<string, string> = {
  // ── CO FRANJA ─────────────────────────────────────────────────────────
  'NEGRO CO FRANJA 2026':               `${BASE}NEGRO%20CO%20FRANJA%202026.jpg`,
  'BLANCO CO FRANJA 2026':              `${BASE}BLANCO%20CO%20FRANJA%202026.jpg`,
  'BEIGE CO FRANJA 2026':               `${BASE}BEIGE%20CO%20FRANJA%202026.jpg`,
  'ROJO CO FRANJA 2026':                `${BASE}ROJO%20CO%20FRANJA%202026.jpg`,
  // ── BM ÉLITE ──────────────────────────────────────────────────────────
  'BM NEGRO ÉLITE 2026':                `${BASE}BM%20NEGRO%20%C3%89LITE%202026.jpg`,
  'BM AMARILLO ÉLITE 2026':             `${BASE}BM%20AMARILLO%20%C3%89LITE%202026.jpg`,
  'BM AZUL OSCURO ÉLITE 2026':          `${BASE}BM%20AZUL%20OSCURO%20%C3%89LITE%202026.jpg`,
  'BM BLANCO MARFIL ÉLITE 2026':        `${BASE}BM%20BLANCO%20MARFIL%20%C3%89LITE%202026.jpg`,
  // ── PROM 1990 ─────────────────────────────────────────────────────────
  'PROM AMARILLO 1990':                 `${BASE}PROM%20AMARILLO%201990.jpg`,
  'PROM NEGRO 1990':                    `${BASE}PROM%20NEGRO%201990.jpg`,
  'PROM ROJO 1990':                     `${BASE}PROM%20ROJO%201990.jpg`,
  'PROM PACK X2 1990':                  `${BASE}PACK%20X2.jpg`,
  'PROM PACK X3 1990':                  `${BASE}PACK%20X3%20.jpg`,
  'PROM PACK 3 1990':                   `${BASE}PACK%20X3%20.jpg`,
  // ── PORTUGAL ──────────────────────────────────────────────────────────
  'PORTUGAL ROJO 2026':                 `${BASE}PORTUGAL%20%20ROJO%202026.jpg`,
  'PORTUGAL BLANCO MARFIL 2026':        `${BASE}PORTUGAL%20BLANCO%20MARFIL%202026.jpg`,
  'PORTUGAL NEGRO 2026':                `${BASE}PORTUGAL%20NEGRO%202026.jpg`,
  // ── ARGENTINA ─────────────────────────────────────────────────────────
  'ARGENTINA AZUL - DORADO CAPOTA':     `${BASE}ARGENTINA%20AZUL%20-%20%20DORADO%20CAPOTA.jpeg`,
  'ARGENTINA AZUL 2026':                `${BASE}ARGENTINA%20AZUL%202026.jpg`,
  'ARGENTINA BLANCO MARFIL 2026':       `${BASE}ARGENTINA%20BLANCO%20MARFIL%202026.jpg`,
  'ARGENTINA NEGRO 2026':               `${BASE}ARGENTINA%20NEGRO%202026.jpg`,
  // ── RETRO ─────────────────────────────────────────────────────────────
  'RETRO BLANCO MARFIL 1990':           `${BASE}RETRO%20%20BLANCO%20MARFIL%201990.jpeg`,
  'RETRO NEGRO 1990':                   `${BASE}RETRO%20NEGRO%201990.jpeg`,
  'RETRO AMARILLO 1990':                `${BASE}RETRO%20AMARILLO%201990.jpg`,
  'RETRO ROJO 1990':                    `${BASE}RETRO%20ROJO%201990.jpeg`,
  'RETRO AMARILLO MARIPOSA CUELLO ALTO':`${BASE}RETRO%20AMARILLO%20MARIPOSA%20%20CUELLO%20ALTO.jpeg`,
  // ── NEW YORK ──────────────────────────────────────────────────────────
  'NEGRO NEW YORK':                     `${BASE}NEGRO%20NEW%20YORK.jpg`,
  'ROJO NEW YORK':                      `${BASE}ROJO%20NEW%20YORK.jpg`,
  'BEIGE NEW YORK':                     `${BASE}BEIGE%20NEW%20YORK.jpg`,
  'BLANCO MARFIL NEW YORK':             `${BASE}BLANCO%20MARFIL%20NEW%20YORK.jpg`,
  // ── AGREGAR PRODUCTOS NUEVOS AQUÍ ─────────────────────────────────────
};

/**
 * Devuelve la URL pública de la imagen del producto.
 * Primero busca coincidencia exacta (case-insensitive),
 * luego coincidencia parcial por palabras clave.
 * Si no encuentra nada, devuelve la imagen placeholder.
 */
export function getProductImageUrl(productName: string): string {
  const key = productName.trim().toUpperCase();

  // 1. Coincidencia exacta
  for (const [catalogKey, url] of Object.entries(CATALOG)) {
    if (catalogKey.toUpperCase() === key) return url;
  }

  // 2. Coincidencia parcial (contiene)
  for (const [catalogKey, url] of Object.entries(CATALOG)) {
    const ck = catalogKey.toUpperCase();
    if (key.includes(ck) || ck.includes(key)) return url;
  }

  // 3. Coincidencia por palabras clave (≥2 chars)
  const words = key.split(/\s+/).filter(w => w.length >= 2);
  let bestUrl = FALLBACK_IMAGE;
  let bestScore = 0;
  for (const [catalogKey, url] of Object.entries(CATALOG)) {
    const ck = catalogKey.toUpperCase();
    const score = words.filter(w => ck.includes(w)).length;
    if (score > bestScore) { bestScore = score; bestUrl = url; }
  }

  return bestUrl;
}

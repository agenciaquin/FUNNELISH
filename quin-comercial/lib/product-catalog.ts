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

/** Lista de todos los nombres de producto disponibles en el catálogo */
export const PRODUCT_NAMES: string[] = Object.keys(CATALOG);

// ── Familias de producto ────────────────────────────────────────────────────
// Cada familia tiene palabras clave para detectarla en el texto del cliente.
// El filtro determina qué productos del catálogo pertenecen a ella.
interface Category {
  id:       string;
  keywords: string[];               // palabras que el cliente usa para referirse a esta familia
  filter:   (name: string) => boolean;
}

const CATEGORIES: Category[] = [
  {
    id:       'argentina',
    keywords: ['argentina'],
    filter:   n => n.startsWith('ARGENTINA'),
  },
  {
    id:       'bm_elite',
    keywords: ['bm', 'elite', 'élite', 'bm elite', 'bm élite'],
    filter:   n => n.startsWith('BM'),
  },
  {
    id:       'colombia',
    // "CO FRANJA" es la línea Colombia, el cliente puede decir "colombia" o "co franja"
    keywords: ['colombia', 'co franja', 'franja', 'seleccion', 'selección', 'tricolor'],
    filter:   n => n.includes('CO FRANJA'),
  },
  {
    id:       'new_york',
    keywords: ['new york', 'newyork', 'ny'],
    filter:   n => n.includes('NEW YORK'),
  },
  {
    id:       'portugal',
    keywords: ['portugal', 'cr7', 'cristiano'],
    filter:   n => n.startsWith('PORTUGAL'),
  },
  {
    id:       'retro',
    keywords: ['retro', '1990'],
    filter:   n => n.startsWith('RETRO'),
  },
  {
    id:       'prom',
    keywords: ['prom'],
    filter:   n => n.startsWith('PROM'),
  },
];

/**
 * Detecta la familia de producto mencionada en un texto.
 * Retorna el Category encontrado o null.
 */
export function detectCategory(text: string): Category | null {
  const t = text.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some(kw => t.includes(kw))) return cat;
  }
  return null;
}

export interface ProductMatch {
  name:  string;
  url:   string;
  score: number;
}

/**
 * Búsqueda contextual: entiende la conversación.
 *
 * 1. Intenta detectar la familia de producto en `currentText`.
 * 2. Si no la encuentra, busca en `historyTexts` (historial reciente).
 * 3. Si hay familia activa → filtra productos de esa familia y aplica palabras de color/variante.
 * 4. Si no hay familia → búsqueda general por palabras clave.
 *
 * @param currentText   Mensaje actual del cliente
 * @param historyTexts  Últimos N mensajes del chat (para contexto)
 */
export function findContextualProducts(
  currentText: string,
  historyTexts: string[] = [],
): ProductMatch[] {
  const allText = [currentText, ...historyTexts].filter(Boolean);

  // 1. Detectar familia en mensaje actual primero, luego historial
  let activeCategory: Category | null = null;
  for (const t of allText) {
    activeCategory = detectCategory(t);
    if (activeCategory) break;
  }

  // Palabras de color/variante del mensaje ACTUAL
  const currentUpper = currentText.trim().toUpperCase();
  const colorWords = currentUpper.split(/\s+/).filter(w => w.length >= 3);

  if (activeCategory) {
    // 2. Productos de la familia activa
    const familyProducts = Object.entries(CATALOG)
      .filter(([name]) => activeCategory!.filter(name.toUpperCase()))
      .map(([name, url]) => ({ name, url, score: 0 }));

    if (familyProducts.length === 0) return [];

    // 3. Filtrar por color dentro de la familia
    if (colorWords.length > 0) {
      const scored = familyProducts.map(p => ({
        ...p,
        score: colorWords.filter(w => p.name.toUpperCase().includes(w)).length,
      })).filter(p => p.score > 0).sort((a, b) => b.score - a.score);

      // Si hay coincidencias de color → devolver esas
      if (scored.length > 0) return scored;
    }

    // 4. Sin color específico → mostrar toda la familia
    return familyProducts.map(p => ({ ...p, score: 1 }));
  }

  // 5. Sin familia detectada → búsqueda general por palabras clave
  return findMatchingProducts(currentText);
}

/**
 * Devuelve TODOS los productos cuyo nombre contiene al menos `minScore`
 * palabras del texto buscado (≥ 3 caracteres). Ordenados por score desc.
 */
export function findMatchingProducts(searchText: string, minScore = 1): ProductMatch[] {
  if (!searchText?.trim()) return [];
  const key   = searchText.trim().toUpperCase();
  const words = key.split(/\s+/).filter(w => w.length >= 3);
  if (words.length === 0) return [];

  const results: ProductMatch[] = [];
  for (const [catalogKey, url] of Object.entries(CATALOG)) {
    const ck    = catalogKey.toUpperCase();
    const score = words.filter(w => ck.includes(w)).length;
    if (score >= minScore) results.push({ name: catalogKey, url, score });
  }
  return results.sort((a, b) => b.score - a.score);
}

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

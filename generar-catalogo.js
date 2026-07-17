/**
 * generar-catalogo.js
 * ───────────────────
 * Lee todas las imágenes de la carpeta /img y regenera automáticamente
 * quinchat/lib/product-catalog.ts
 *
 * USO:
 *   1. Agrega las fotos nuevas a la carpeta FUNNELISH/img/
 *   2. Ejecuta:  node generar-catalogo.js
 *   3. Haz git add . && git commit -m "fotos nuevas" && git push
 */

const fs   = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────────
const IMG_DIR  = path.join(__dirname, 'img');
const OUT_FILE = path.join(__dirname, 'quinchat', 'lib', 'product-catalog.ts');
const BASE_URL = 'https://raw.githubusercontent.com/agenciaquin/FUNNELISH/master/img/';

// Archivos que NO son productos (fondos, logos, etc.)
const SKIP_FILES = new Set([
  'placeholder.png',
  'BONO.png',
  'FONDO-INICIO.png',
  'ROBOT QUINO.png',
  'logo-quin.png',
]);

// ── Leer archivos ────────────────────────────────────────────────────────────
const imageFiles = fs.readdirSync(IMG_DIR)
  .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
  .filter(f => !SKIP_FILES.has(f))
  .sort();

if (imageFiles.length === 0) {
  console.error('❌ No se encontraron imágenes en', IMG_DIR);
  process.exit(1);
}

// ── Generar entradas del catálogo ────────────────────────────────────────────
function toProductKey(filename) {
  // "ROJO NEW YORK.jpg" → "ROJO NEW YORK"
  return filename.replace(/\.(jpg|jpeg|png|webp)$/i, '').trim();
}

function toEncodedUrl(filename) {
  // Encode filename but keep structure readable
  // Codifica espacio → %20, É → %C3%89, etc.
  const encoded = filename
    .split('')
    .map(c => {
      if (c === ' ')  return '%20';
      const code = c.charCodeAt(0);
      if (code > 127) return encodeURIComponent(c);
      return c;
    })
    .join('');
  return `${BASE_URL}${encoded}`;
}

// Agrupar por familia de producto (primera palabra)
const groups = {};
for (const file of imageFiles) {
  const key   = toProductKey(file);
  const first = key.split(' ')[0];
  if (!groups[first]) groups[first] = [];
  groups[first].push({ key, url: toEncodedUrl(file), file });
}

// ── Generar TypeScript ───────────────────────────────────────────────────────
const maxKeyLen = Math.max(...imageFiles.map(f => toProductKey(f).length));
const pad = (k) => ' '.repeat(Math.max(1, maxKeyLen - k.length + 2));

let catalogLines = [];
for (const [groupName, items] of Object.entries(groups)) {
  catalogLines.push(`  // ── ${groupName} ${'─'.repeat(Math.max(1, 60 - groupName.length))}`);
  for (const { key, url } of items) {
    catalogLines.push(`  '${key}':${pad(key)}\`${url}\`,`);
  }
}

const tsContent = `/**
 * Catálogo de imágenes de productos KLIXMANT.
 * ⚠️  ARCHIVO GENERADO AUTOMÁTICAMENTE — NO EDITAR A MANO.
 * Para agregar productos: coloca la foto en /img y ejecuta:
 *   node generar-catalogo.js
 */

const BASE = '${BASE_URL}';

/** URL de imagen cuando el producto no está en el catálogo */
export const FALLBACK_IMAGE = \`\${BASE}placeholder.png\`;

const CATALOG: Record<string, string> = {
${catalogLines.join('\n')}
};

/** Lista de todos los nombres de producto disponibles en el catálogo */
export const PRODUCT_NAMES: string[] = Object.keys(CATALOG);

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
  const words = key.split(/\\s+/).filter(w => w.length >= 3);
  let bestUrl   = FALLBACK_IMAGE;
  let bestScore = 0;
  for (const [catalogKey, url] of Object.entries(CATALOG)) {
    const ck    = catalogKey.toUpperCase();
    const score = words.filter(w => ck.includes(w)).length;
    if (score > bestScore) { bestScore = score; bestUrl = url; }
  }

  return bestUrl;
}
`;

fs.writeFileSync(OUT_FILE, tsContent, 'utf8');

console.log(`\n✅ Catálogo generado con ${imageFiles.length} productos`);
console.log(`   Archivo: ${OUT_FILE}`);
console.log('\nProductos incluidos:');
for (const [group, items] of Object.entries(groups)) {
  console.log(`  ${group}: ${items.map(i => i.key).join(' | ')}`);
}
console.log('\n👉 Siguiente paso: git add . && git commit -m "fotos nuevas" && git push');

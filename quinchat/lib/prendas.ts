/**
 * Cuenta cuántas PRENDAS trae una venta a partir del nombre del producto.
 * Un PACK X2 son 2 prendas, PACK X3 son 3, "DOS COLORES" son 2, etc.
 * Si no se detecta un combo, es 1 prenda.
 */
export function contarPrendas(producto: string | null | undefined): number {
  const t = String(producto ?? '').toUpperCase();
  if (!t.trim()) return 1;

  const pack = t.match(/PACK\s*X?\s*(\d)/);
  if (pack) return Math.max(1, parseInt(pack[1], 10));

  if (/\b(CUATRO|4)\s+COLORES\b/.test(t)) return 4;
  if (/\b(TRES|3)\s+COLORES\b/.test(t))   return 3;
  if (/\b(DOS|2)\s+COLORES\b/.test(t))    return 2;

  return 1;
}

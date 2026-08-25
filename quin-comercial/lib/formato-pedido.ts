/**
 * Formatea la línea de "Talla" para las fichas y confirmaciones.
 * Si el pedido es un PACK (varias prendas unidas con " + "), las separa en
 * líneas limpias, una por prenda. Si es una sola prenda, la deja igual.
 * NO cambia el dato guardado — solo cómo se muestra.
 *
 * Ej: "FERRARI NEGRO S - HOMBRE + MCLAREN BLANCO MARFIL M - HOMBRE" →
 *   Talla:
 *   👕 Prenda 1: FERRARI NEGRO S - HOMBRE
 *   👕 Prenda 2: MCLAREN BLANCO MARFIL M - HOMBRE
 */
export function lineaTalla(talla: string | null | undefined): string {
  const t = String(talla ?? '').trim() || '—';
  if (/\s\+\s/.test(t)) {
    const partes = t.split(/\s*\+\s*/).map(s => s.trim()).filter(Boolean);
    return 'Talla:\n' + partes.map((p, i) => `👕 Prenda ${i + 1}: ${p}`).join('\n');
  }
  return `Talla: ${t}`;
}

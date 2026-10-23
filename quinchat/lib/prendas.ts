/**
 * Cuenta cuántas PRENDAS trae una venta.
 *
 * El dato más confiable es la CANTIDAD que registra el bot y el PRECIO TOTAL
 * (el bot siempre cobra bien): un buzo solo cuesta ~$130.000, una pareja
 * $219.900, tres $310.000… así que del precio se deduce la cantidad sin
 * sobrecontar un producto individual (aunque su nombre lleve "+").
 */

const NUMWORD: Record<string, number> = {
  DOS: 2, TRES: 3, CUATRO: 4, CINCO: 5, SEIS: 6,
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
};

/** Señales SEGURAS en el texto (no sobrecuentan): PACK Xn, "N PRENDAS", PAREJA… */
export function contarPrendas(
  producto?: string | null,
  _talla?: string | null,
  _color?: string | null,
): number {
  const t = `${String(producto ?? '')} ${String(_talla ?? '')} ${String(_color ?? '')}`.toUpperCase();
  let n = 1;

  const pack = t.match(/PACK\s*X?\s*(\d)/);
  if (pack) n = Math.max(n, parseInt(pack[1], 10));

  const m = t.match(/\b(DOS|TRES|CUATRO|CINCO|SEIS|2|3|4|5|6)\s+(PRENDAS|COLORES|UNIDADES|BUZOS)\b/);
  if (m) n = Math.max(n, NUMWORD[m[1]] ?? 1);

  if (/\b(PAREJA|DUO|DÚO|COMBO\s*X?\s*2)\b/.test(t)) n = Math.max(n, 2);
  if (/\b(TRIO|TRÍO|COMBO\s*X?\s*3)\b/.test(t)) n = Math.max(n, 3);

  return Math.max(1, n);
}

// Escalera de precios de POLOS (promo): total → prendas. Son más baratos que
// los buzos, por eso tienen su propia tabla.
const LADDER_POLO: [number, number][] = [
  [95000, 1], [150000, 2], [210000, 3], [270000, 4], [330000, 5], [390000, 6],
];

function qtyPorLadder(valor: number, ladder: [number, number][], marginal: number): number {
  const max = ladder[ladder.length - 1];
  if (valor > max[0]) return max[1] + Math.round((valor - max[0]) / marginal); // >6 prendas al mayor
  let mejor = 1, mejorD = Infinity;
  for (const [total, q] of ladder) {
    const d = Math.abs(valor - total);
    if (d < mejorD) { mejorD = d; mejor = q; }
  }
  return Math.max(1, mejor);
}

/**
 * Deduce la cantidad desde el PRECIO TOTAL.
 * - Polos: escalera propia (1=$95.000, 2=$150.000, 3=$210.000…).
 * - Buzos y demás: ~$105.000 por prenda (130k→1, 219.9k→2, 310k→3…).
 */
export function prendasPorPrecio(valor: number | null | undefined, producto?: string | null): number {
  const v = Number(valor) || 0;
  if (v <= 0) return 1;
  if (/POLO/i.test(String(producto ?? ''))) return qtyPorLadder(v, LADDER_POLO, 62000);
  return Math.max(1, Math.round(v / 105000));
}

/**
 * Cantidad DEFINITIVA de una venta: el MAYOR entre lo que registró el bot,
 * lo deducido del precio y las señales del texto. Nunca menos de 1.
 */
export function prendasDeVenta(opts: {
  cantidadBot?: number | null;
  producto?: string | null;
  talla?: string | null;
  color?: string | null;
  valor?: number | null;
}): number {
  const bot = Number(opts.cantidadBot) > 0 ? Math.round(Number(opts.cantidadBot)) : 1;
  return Math.max(
    bot,
    prendasPorPrecio(opts.valor, opts.producto),
    contarPrendas(opts.producto, opts.talla, opts.color),
  );
}

/**
 * Recorta un texto a `max` caracteres SIN partir emojis.
 * `str.slice(0, n)` cuenta unidades UTF-16: si el corte cae en medio de un emoji
 * (🚚 = 2 unidades) queda medio emoji suelto y Supabase rechaza TODA la fila con
 * "Empty or invalid json". Pasó el 04-nov-2026: la conversación del pedido no se
 * creó y la confirmación no quedó en QuinChat aunque sí le llegó al cliente.
 */
export function recortar(texto: unknown, max: number): string {
  const s = String(texto ?? '');
  if (s.length <= max) return s;
  let out = '';
  for (const ch of s) {               // itera por puntos de código (emojis enteros)
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out;
}

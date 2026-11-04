/**
 * Une dirección y barrio poniendo la palabra "Barrio" antes del barrio:
 *   ("Calle 6# 15-73", "Popular") → "Calle 6# 15-73, Barrio Popular"
 * - Si el cliente ya escribió "barrio"/"B/"/"Br." delante, no se duplica.
 * - Si el barrio ya está dentro de la dirección, no se repite.
 * - Sin barrio → la dirección tal cual.
 */
export function unirDireccionBarrio(direccion: unknown, barrio: unknown): string {
  const dir = String(direccion ?? '').trim();
  const nombre = String(barrio ?? '').trim()
    .replace(/^(barrio|b\/|br\.?|bar\.?)\s*/i, '')
    .trim();
  if (!nombre || nombre === '—' || nombre.toLowerCase() === 'null') return dir;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (dir && norm(dir).includes(norm(nombre))) return dir;
  const conPalabra = `Barrio ${nombre}`;
  return dir ? `${dir}, ${conPalabra}` : conPalabra;
}

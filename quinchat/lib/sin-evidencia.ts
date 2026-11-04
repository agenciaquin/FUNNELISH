/**
 * La foto "ASI VA EMPACADO" (catálogo EVIDENCIA COMO SE DESPACHA LA PRENDA) es solo para
 * mostrarle al cliente cómo va empacado: NUNCA es la foto del producto que compró.
 * Este filtro la saca de cualquier búsqueda de "la última foto del chat".
 *  · por id: lo que manda el bot se guarda como "evid-…"
 *  · por URL: la foto del catálogo de evidencia (si el asesor la mandó a mano)
 */
export const EVIDENCIA_CATALOGO_ID = 'dc0aac19-38ae-46c9-9901-10aebadd5c07';

export function sinEvidencia<T>(q: T): T {
  return (q as any).not('id', 'like', 'evid-%').not('content', 'ilike', `%${EVIDENCIA_CATALOGO_ID}%`) as T;
}

export const esFotoEvidencia = (url: unknown) => String(url ?? '').includes(EVIDENCIA_CATALOGO_ID);

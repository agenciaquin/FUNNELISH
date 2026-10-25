// Etiqueta "Presentación grabada": el texto se puede editar, pero la etiqueta NO se puede ocultar
// ni dejar vacía, y no puede hacerse pasar por transmisión en vivo.

export const ETIQUETA_POR_DEFECTO = 'Presentación grabada';
export const ETIQUETA_MAX = 32;
const PROHIBIDO = /\b(en\s+vivo|en\s+directo|live)\b/i;

/** Devuelve un texto válido para la etiqueta; si no lo es, vuelve al predeterminado. */
export function etiquetaValida(texto: string | null | undefined): string {
  const t = (texto ?? '').replace(/\s+/g, ' ').trim().slice(0, ETIQUETA_MAX);
  if (!t || PROHIBIDO.test(t)) return ETIQUETA_POR_DEFECTO;
  return t;
}

/** Clave donde el panel guarda el texto editado (solo en este navegador, mientras no haya base de datos). */
export const claveEtiqueta = (slug: string) => `quin_live_etiqueta_${slug}`;

export function leerEtiqueta(slug: string, base?: string): string {
  try {
    const g = localStorage.getItem(claveEtiqueta(slug));
    if (g) return etiquetaValida(g);
  } catch { /* sin almacenamiento */ }
  return etiquetaValida(base);
}

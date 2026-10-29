/**
 * Reconoce qué catálogo de Klixmant pide el cliente a partir de lo que escribe.
 * Devuelve candidatos por `id`: los nombres se repiten (CONTRATO-API-CATALOGOS.md §4),
 * así que si dos catálogos se llaman igual salen los dos y el color desempata.
 */
export interface CatalogoKlixmant {
  id: number;
  nombre: string;
  categoria: string;
  colores: string[];
  tipos: string[];
}

export interface Candidato { catalogo: CatalogoKlixmant; puntos: number; colores: string[] }

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ');

// Palabras que no distinguen un catálogo de otro (tipo de prenda y relleno).
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'sin', 'un', 'una', 'en', 'mi', 'cuello', 'alto',
  'buzo', 'buzos', 'camiseta', 'chaqueta', 'polo', 'hoodie', 'saco', 'reflectivo', 'tg']);

const palabras = (s: string) => normalizar(s).split(/\s+/).filter(p => p.length >= 2 && !VACIAS.has(p));

export function identificarCatalogos(
  texto: string,
  catalogos: CatalogoKlixmant[],
  categoriasActivas?: Set<string>,
): Candidato[] {
  const dicho = new Set(palabras(texto));
  const frase = ` ${normalizar(texto)} `;
  const out: Candidato[] = [];
  for (const c of catalogos) {
    if (categoriasActivas && !categoriasActivas.has(c.categoria)) continue;
    const clave = palabras(c.nombre);
    if (!clave.length) continue;
    // Basta una palabra propia del nombre ("nacional"): el resto solo ordena a los candidatos.
    const acierto = clave.filter(p => dicho.has(p)).length / clave.length;
    if (!acierto) continue;
    const colores = c.colores.filter(col => frase.includes(` ${normalizar(col).trim()} `));
    out.push({ catalogo: c, puntos: acierto + (colores.length ? 0.5 : 0), colores });
  }
  return out.sort((a, b) => b.puntos - a.puntos);
}

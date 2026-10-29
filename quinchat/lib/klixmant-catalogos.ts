import { SERVIDOR_LOCAL } from '@/lib/freno-local';
import { identificarCatalogos, type CatalogoKlixmant } from '@/lib/klixmant-identificar';

/**
 * Lee los catálogos de Klixmant desde la API del reporte (CONTRATO-API-CATALOGOS.md §4).
 * Solo servidor: la llave nunca sale al navegador. Guarda la lista 10 minutos en memoria
 * para no llamar al reporte en cada mensaje (§11, consumo).
 */
const URL_REPORTE = process.env.REPORTE_API_URL || 'https://reporte-de-ventas-bwey.vercel.app';
const ORIGEN_FOTOS = 'https://pqcqeywhduryaoehleuh.supabase.co/storage/v1/object/public/klixmant-soft/';
const DURACION = 10 * 60_000;

export interface ListaKlixmant {
  version: number;
  generado: string;
  catalogos: (CatalogoKlixmant & { reflectivo: boolean; foto: string | null })[];
  categorias: string[];
  muestra: boolean;
}

// Sin llave en local: unos pocos catálogos de ejemplo para ver la pantalla. 973 es el del contrato.
const MUESTRA: ListaKlixmant = {
  version: 1,
  generado: new Date().toISOString(),
  catalogos: [
    { id: 973, nombre: 'NEW YORK', categoria: 'EQUIPOS', reflectivo: false, colores: ['Negro', 'Beige', 'Rojo', 'Blanco marfil'], tipos: ['Buzo'], foto: null },
    { id: 23, nombre: 'CUELLO ALTO BARCELONA', categoria: 'EQUIPOS', reflectivo: false, colores: ['Azul', 'Granate'], tipos: ['Buzo'], foto: null },
    { id: 31, nombre: 'CUELLO ALTO BARCELONA', categoria: 'EQUIPOS', reflectivo: false, colores: ['Negro'], tipos: ['Buzo', 'Camiseta'], foto: null },
    { id: 501, nombre: 'DUCATI', categoria: 'MOTOS', reflectivo: true, colores: ['Rojo', 'Negro'], tipos: ['Chaqueta'], foto: null },
    { id: 502, nombre: 'YAMAHA RACING', categoria: 'MOTOS', reflectivo: false, colores: ['Azul'], tipos: ['Camiseta'], foto: null },
  ],
  categorias: ['EQUIPOS', 'MOTOS'],
  muestra: true,
};

let guardada: { lista: ListaKlixmant; hasta: number } | null = null;

/** La lista de catálogos, o un error en texto para mostrar. Nunca inventa catálogos. */
export async function leerCatalogosKlixmant(): Promise<ListaKlixmant | { error: string; status: number }> {
  if (guardada && Date.now() < guardada.hasta) return guardada.lista;

  const llave = process.env.QUINCHAT_API_KEY;
  if (!llave) {
    if (SERVIDOR_LOCAL) return MUESTRA;
    return { error: 'Falta la llave de la API de catálogos.', status: 503 };
  }

  try {
    const r = await fetch(`${URL_REPORTE}/api/v1/catalogos`, {
      headers: { Authorization: `Bearer ${llave}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return { error: `El reporte respondió ${r.status}.`, status: 502 };
    const d = await r.json();
    if (!Array.isArray(d?.catalogos)) return { error: 'Respuesta del reporte sin catálogos.', status: 502 };
    // §5.6: el bot vuelve a validar cada foto antes de usarla.
    d.catalogos = d.catalogos.map((c: any) => ({
      ...c,
      foto: typeof c.foto === 'string' && c.foto.startsWith(ORIGEN_FOTOS) ? c.foto : null,
    }));
    const lista: ListaKlixmant = { ...d, muestra: false };
    guardada = { lista, hasta: Date.now() + DURACION };
    return lista;
  } catch {
    return { error: 'No se pudo leer el reporte.', status: 502 };
  }
}

/**
 * LA PUERTA: qué catálogos de Klixmant pide el cliente con lo que escribió.
 * Devuelve hasta 10 candidatos (Nacional tiene 8), el más probable primero; vacío si no nombra ninguno.
 * Si hay varios con los mismos puntos, quien la use debe preguntar cuál (no adivinar).
 * `categorias`: solo busca en esas (p. ej. las que el dueño active); sin ella, en todas.
 */
export async function reconocerCatalogo(texto: string, categorias?: string[]) {
  const lista = await leerCatalogosKlixmant();
  if ('error' in lista) return { candidatos: [], error: lista.error };
  const activas = categorias?.length ? new Set(categorias) : undefined;
  const candidatos = identificarCatalogos(texto, lista.catalogos, activas).slice(0, 10).map(c => ({
    id: c.catalogo.id,
    nombre: c.catalogo.nombre,
    categoria: c.catalogo.categoria,
    colores: c.catalogo.colores,
    color_pedido: c.colores,            // colores que el cliente nombró
    foto: (c.catalogo as ListaKlixmant['catalogos'][number]).foto,
    puntos: Math.round(c.puntos * 100) / 100,
  }));
  const dudoso = candidatos.length > 1 && candidatos[0].puntos === candidatos[1].puntos;
  return { candidatos, dudoso, muestra: lista.muestra };
}

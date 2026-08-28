import { createServerSupabaseClient } from '@/lib/supabase';
import type { LayoutEmbudo } from '@/lib/bloques';

/**
 * Embudos de venta propios.
 *
 * Cada embudo es una página de producto con su checkout contra entrega.
 * Los pedidos entran directo a la base — sin webhooks intermedios que se
 * puedan caer, que es lo que hoy pasa con Funnelish.
 */

/**
 * Una elección que debe hacer el cliente antes de comprar.
 * Un producto sencillo tiene una sola (la talla). Un pack de dos colores tiene
 * tres: color 1, color 2 y talla.
 */
/** Una opción concreta. Puede llevar foto (útil para los colores). */
export interface OpcionSelector {
  valor: string;
  imagen?: string;
}

export interface SelectorVariante {
  etiqueta: string;                        // "TALLA", "COLOR", "GÉNERO"
  grupo?: string;                          // "ELIGE BUZO 1" — agrupa varias elecciones
  opciones: (string | OpcionSelector)[];   // admite texto simple o con foto
}

/** Deja las opciones siempre en el mismo formato, vengan como vengan. */
export function normalizarOpciones(ops: (string | OpcionSelector)[]): OpcionSelector[] {
  return (ops ?? []).map(o => (typeof o === 'string' ? { valor: o } : o)).filter(o => o?.valor);
}

/** Una escudería/categoría que se puede combinar en el pack "arma tu pack". */
export interface CategoriaPack {
  nombre: string;              // "ESCUDERIA RED BULL"
  colores: OpcionSelector[];   // colores de esa escudería (con foto)
}

/**
 * Configuración del pack "ARMA TU PACK": el cliente elige, por cada buzo,
 * escudería → color → talla (en cascada). Si una variante trae `armarPack`,
 * la página de venta muestra ese constructor en vez de los selectores normales.
 */
export interface ArmarPackConfig {
  unidades: number;            // 2 (pack x2)
  categorias: CategoriaPack[]; // escuderías disponibles para combinar
  tallas: string[];            // tallas disponibles
  labelCategoria?: string;     // nombre del selector: "escudería", "marca", "equipo", "pareja"… (def: escudería)
  labelPrenda?: string;        // nombre de la prenda: "buzo", "camiseta"… (def: buzo)
}

export interface VarianteFunnel {
  id: string;            // 'verde', 'negro', 'pack2'…
  nombre: string;        // "NACIONAL VERDE 2026"
  precio: number;        // 139900
  precioAntes?: number;  // 195000 (tachado)
  imagen?: string;       // miniatura del selector
  tallas?: string[];     // atajo: equivale a un único selector de talla
  selectores?: SelectorVariante[]; // hasta 6 elecciones
  esPack?: boolean;
  armarPack?: ArmarPackConfig; // si existe → constructor "arma tu pack" (escudería+color+talla por buzo)
  estilo?: string;             // 'polos' → editor y checkout de VARIABLES POLOS (a prueba de renombrado)
}

export interface Funnel {
  id: string;
  slug: string;              // 'nacional-2026' → /p/nacional-2026
  activo: boolean;
  nombre: string;            // nombre interno
  titulo: string;            // titular de la página
  frases: string[];          // frases que rotan en el titular
  producto: string;          // nombre comercial
  precio: number;
  precio_antes: number | null;
  imagenes: string[];        // galería principal
  imagen_banner: string | null;
  imagen_clientes: string | null;
  imagen_detalle: string | null;
  caracteristicas: string[];
  tallas: string[];
  variantes: VarianteFunnel[];
  horas_contador: number;    // duración del contador
  personas_comprando: number;
  whatsapp: string;          // número que se muestra en la página de gracias
  pixel_meta: string | null;
  pixel_tiktok: string | null;
  audio_url: string | null;  // canción que suena de fondo al entrar a la página
  video_url: string | null;  // video de portada (reemplaza la galería si existe)
  color: string | null;      // color de acento (botón, precio, títulos). null = verde
  anuncios: string | null;   // IDs de anuncios (Meta/TikTok) que llevan a este producto
  miniatura_url: string | null; // miniatura flotante opcional (foto o video)
  layout: LayoutEmbudo | null;  // diseño por bloques; null = orden por defecto
  insignia: Insignia | null;    // botón flotante "MÁS VENDIDO 🔥" (posición fija)
  creado_at: string;
}

/** Insignia flotante "MÁS VENDIDO 🔥": el admin la arrastra y queda fija. */
export interface Insignia {
  activo?: boolean;
  texto?: string;   // por defecto "MÁS VENDIDO"
  x?: number;       // posición horizontal en % (0–100)
  y?: number;       // posición vertical en % (0–100)
}

/** Detecta si un enlace subido es un video (por su extensión). */
export function esVideo(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v|ogg|ogv)(\?|$)/i.test(url);
}

/**
 * Devuelve una versión LIVIANA (redimensionada + comprimida) de una foto de
 * NUESTRO storage de Supabase, para gastar mucho menos ancho de banda. Usa el
 * transformador de imágenes de Supabase (redimensiona y comprime al vuelo y
 * cachea el resultado). Videos y URLs externas se devuelven sin tocar.
 */
export function imgOptim(url: string | null | undefined, _ancho = 800, _calidad = 62): string {
  // Servimos la imagen ORIGINAL. (La optimización con /_next/image rompía las fotos
  // en producción, así que se dejó desactivada). El ahorro real está en los videos.
  return String(url ?? '');
}

/** Color de acento del embudo. Si no tiene, se usa el verde de siempre. */
export function acentoDe(color: string | null | undefined): { boton: string; texto: string } {
  const c = (color ?? '').trim();
  if (!c) return { boton: '#3DC12A', texto: '#0D8A3E' }; // verde por defecto
  return { boton: c, texto: c };
}

/** Trae un embudo por su dirección. Devuelve null si no existe o está apagado. */
export async function obtenerFunnel(slug: string): Promise<Funnel | null> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('funnels').select('*').eq('slug', slug).eq('activo', true).maybeSingle();

    if (error) { console.error(`[Funnels] error buscando "${slug}":`, error.message); return null; }
    if (!data)  { console.warn(`[Funnels] no existe el embudo "${slug}"`); return null; }

    return {
      ...data,
      imagenes:        parseLista(data.imagenes),
      caracteristicas: parseLista(data.caracteristicas),
      frases:          parseLista(data.frases),
      tallas:          parseLista(data.tallas),
      variantes:       parseJSON<VarianteFunnel[]>(data.variantes, []),
      layout:          parseJSON<LayoutEmbudo | null>(data.layout, null),
      insignia:        parseJSON<Insignia | null>(data.insignia, null),
    } as Funnel;
  } catch (e) {
    console.error('[Funnels] error leyendo el embudo:', e);
    return null;
  }
}

function parseLista(v: any): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch { return []; }
  }
  return [];
}

function parseJSON<T>(v: any, porDefecto: T): T {
  if (!v) return porDefecto;
  if (typeof v === 'object') return v as T;
  try { return JSON.parse(v) as T; } catch { return porDefecto; }
}

/** "$139.900" para mostrar en pantalla */
export function pesos(n: number): string {
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

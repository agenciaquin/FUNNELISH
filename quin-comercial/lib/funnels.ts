import { createServerSupabaseClient } from '@/lib/supabase';

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
  // Stock cuando la opción viene de un producto del catálogo (por color).
  stock?: number | null;
  politicaStock?: 'bloquear' | 'seguir';
  catColorId?: string; // fila catalogo_colores de la que salió (para stock real)
}

/** True si esta opción NO se puede elegir (stock 0 y política = bloquear). */
export function opcionAgotada(o?: { stock?: number | null; politicaStock?: string } | null): boolean {
  if (!o) return false;
  return typeof o.stock === 'number' && o.stock <= 0 && (o.politicaStock ?? 'bloquear') === 'bloquear';
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
  estilo?: string; // 'polos' → editor y checkout de VARIABLES POLOS
  // Stock del embudo (opcional). Si stock es null/undefined → ilimitado.
  //   politicaStock: qué pasa al llegar a 0 · 'bloquear' = no se puede elegir · 'seguir' = se sigue vendiendo.
  stock?: number | null;
  politicaStock?: 'bloquear' | 'seguir';
  // Si esta variante vino de un producto del catálogo, guarda el id de su fila
  // (catalogo_colores.id) para leer/descontar el stock REAL del catálogo.
  catColorId?: string;
}

/** True si esta variante NO se puede vender ahora (stock 0 y política = bloquear). */
export function varianteAgotada(v?: { stock?: number | null; politicaStock?: string } | null): boolean {
  if (!v) return false;
  return typeof v.stock === 'number' && v.stock <= 0 && (v.politicaStock ?? 'bloquear') === 'bloquear';
}

export type BloqueTipo = 'foto' | 'video' | 'texto' | 'boton' | 'collage' | 'contador';

/** Un bloque de contenido de la pagina de venta (constructor tipo Funnelish). */
export interface BloqueEmbudo {
  id: string;
  tipo: BloqueTipo;
  url?: string;          // foto / video / boton(url)
  titulo?: string;       // texto
  cuerpo?: string;       // texto
  centrado?: boolean;    // texto
  texto?: string;        // etiqueta del boton
  accion?: 'comprar' | 'url'; // boton
  urls?: string[];       // collage (varias fotos)
  horas?: number;        // contador (horas)
  ancla?: 'titular' | 'portada' | 'comprar' | 'precio'; // dónde va en la página
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
  bloques: BloqueEmbudo[];      // contenido por bloques (arriba del producto)
  // Cómo confirma el bot los pedidos de ESTE embudo:
  //  'agente' (o null) = el bot envía la confirmación y SIGUE atendiendo (cierra la venta él).
  //  'solo'            = el bot envía la confirmación y se APAGA; si el cliente responde,
  //                      lo atiende una persona (queda "PENDIENTE POR CONFIRMACIÓN").
  modo_confirmacion?: string | null;
  ocultar_boton2?: boolean;   // oculta el SEGUNDO botón "COMPRAR" (el de abajo) en la página
  catalogo_id?: string | null; // producto del catálogo al que está vinculado (stock en vivo)
  pie_empresa?: string | null; // nombre de la empresa que se muestra en el pie de página
  // Config de los CAMPOS del checkout (renombrar/ocultar fijos + campos propios).
  checkout_config?: any;
  creado_at: string;
}

/** Detecta si un enlace subido es un video (por su extensión). */
export function esVideo(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v|ogg|ogv)(\?|$)/i.test(url);
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

    const funnel = {
      ...data,
      imagenes:        parseLista(data.imagenes),
      caracteristicas: parseLista(data.caracteristicas),
      frases:          parseLista(data.frases),
      tallas:          parseLista(data.tallas),
      variantes:       parseJSON<VarianteFunnel[]>(data.variantes, []),
      bloques:         parseJSON<BloqueEmbudo[]>(data.bloques, []),
      checkout_config: parseJSON<any>(data.checkout_config, null),
    } as Funnel;

    // ── Stock EN VIVO del catálogo ──
    // Si el embudo está vinculado a un producto, se lee el stock real del catálogo
    // (por catColorId) y se mezcla en las opciones/variantes. Así la página obedece
    // siempre lo que diga el producto, aunque cambie después.
    if (data.catalogo_id) {
      try {
        const { data: colores } = await supabase
          .from('catalogo_colores').select('id, stock, stock_politica').eq('catalogo_id', data.catalogo_id);
        const byId = new Map((colores ?? []).map((c: any) => [String(c.id), c]));
        const pol = (p: any): 'bloquear' | 'seguir' | undefined => (p === 'seguir' || p === 'bloquear') ? p : undefined;
        funnel.variantes = (funnel.variantes ?? []).map(v => {
          const nv: VarianteFunnel = { ...v };
          // Stock a nivel de variante (si la variante salió de una fila del catálogo).
          if (v.catColorId && byId.has(String(v.catColorId))) {
            const c = byId.get(String(v.catColorId));
            nv.stock = typeof c.stock === 'number' ? c.stock : null;
            nv.politicaStock = pol(c.stock_politica) ?? v.politicaStock ?? 'bloquear';
          }
          // Stock por OPCIÓN (colores dentro del selector).
          if (Array.isArray(v.selectores)) {
            nv.selectores = v.selectores.map(s => ({
              ...s,
              opciones: (s.opciones ?? []).map(o => {
                const op: OpcionSelector = typeof o === 'string' ? { valor: o } : { ...o };
                if (op.catColorId && byId.has(String(op.catColorId))) {
                  const c = byId.get(String(op.catColorId));
                  op.stock = typeof c.stock === 'number' ? c.stock : null;
                  op.politicaStock = pol(c.stock_politica) ?? op.politicaStock ?? 'bloquear';
                }
                return op;
              }),
            }));
          }
          return nv;
        });
      } catch (e) { console.warn('[Funnels] no se pudo leer stock del catálogo:', e); }
    }

    return funnel;
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

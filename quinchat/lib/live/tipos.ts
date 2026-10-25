// QUIN LIVE SHOPPING — tipos compartidos (maqueta).
// El video y el overlay solo se hablan por estos tipos y por la línea de tiempo (JSON).

export type Talla = 'S' | 'M' | 'L' | 'XL';

export interface ColorProducto {
  id: string;
  nombre: string;
  hex: string;
  /** Foto del buzo en este color (la del selector de color). */
  foto: string;
}

export interface PromoProducto {
  /** Etiqueta visible, ej. "Pack x2". */
  etiqueta: string;
  /** Unidades que incluye el pack. */
  unidades: number;
  /** Precio total del pack en COP. */
  precioPack: number;
}

/** Datos reales del producto que el asistente puede usar. Si un dato falta, el asistente NO lo inventa. */
export interface FichaProducto {
  tela?: string;
  cuidados?: string;
}

export interface ProductoLive {
  id: string;
  nombre: string;
  descripcion: string;
  /** COP */
  precio: number;
  /** COP — precio antes, solo si hay promo. */
  precioAntes?: number;
  promo?: PromoProducto;
  tallas: Talla[];
  colores: ColorProducto[];
  ficha?: FichaProducto;
}

// ── Línea de tiempo (archivo JSON separado del video) ─────────────────────────
interface EventoBase {
  /** Segundo del video en que aparece. */
  inicio: number;
  /** Segundo del video en que desaparece. */
  fin: number;
}
export interface EventoProducto extends EventoBase {
  tipo: 'producto';
  contenido: { productoId: string };
}
export interface EventoPregunta extends EventoBase {
  tipo: 'pregunta_frecuente';
  contenido: { pregunta: string; respuesta: string };
}
export interface EventoComentario extends EventoBase {
  tipo: 'comentario';
  /** Los comentarios de la maqueta son datos de ejemplo, siempre marcados DEMO. */
  contenido: { autor: string; texto: string; demo: true };
}
export type EventoLinea = EventoProducto | EventoPregunta | EventoComentario;

export interface LineaDeTiempo {
  version: 1;
  /** Duración del video al que se escribió esta línea (referencial). */
  duracion: number;
  eventos: EventoLinea[];
}

export type ModoReproduccion = 'desde_inicio' | 'sincronizado';

export interface LiveConfig {
  slug: string;
  titulo: string;
  /** Texto de la etiqueta fija del encabezado (editable; nunca se oculta). Por defecto "Presentación grabada". */
  etiquetaGrabada?: string;
  tienda: { nombre: string; logo?: string };
  /** URL del video (Cloudflare R2). Nunca Supabase Storage. */
  videoUrl: string;
  posterUrl?: string;
  /** URL del JSON de la línea de tiempo. */
  timelineUrl: string;
  /** Número de WhatsApp con indicativo, sin +. */
  whatsapp: string;
  privacidadUrl: string;
  modo: ModoReproduccion;
  productos: ProductoLive[];
  /** Comentarios "de ambiente" (demo) que van apareciendo solos durante el live. */
  comentariosAuto?: string[];
  /** Slug del embudo cuyo checkout se usa al comprar (si está vacío, usa el BuySheet propio del live). */
  embudoSlug?: string;
}

export interface Seleccion {
  productoId: string;
  talla?: Talla;
  colorId?: string;
}

export interface PedidoDemo {
  productoId: string;
  talla: Talla;
  colorId: string;
  modalidad: 'unidad' | 'pack';
  cantidad: number;
  total: number;
  cliente: {
    nombre: string;
    celular: string;
    departamento: string;
    ciudad: string;
    direccion: string;
    barrio: string;
    notas: string;
  };
  autorizaDatos: true;
}

/**
 * MÓDULO «MI PÁGINA» (Embudos → Mi Página) — 08-nov-2026. Parte COMPARTIDA (panel + página pública):
 * solo tipos y funciones puras. Lo que consulta la base está en lib/mi-pagina-servidor.ts.
 *
 * Es una tienda web hecha con los EMBUDOS que ya existen. Es INDEPENDIENTE:
 *  · Tabla propia `mi_pagina` (borrador = lo que se edita; publicado = lo que ve el público).
 *  · Solo LEE embudos (funnels: nombre, fotos, precio), catálogos y promociones. No escribe en ellos.
 *  · Ruta pública: pedido.klixmant.shop/web/<slug>  (internamente /p/web/<slug>).
 *  · «Ver producto» abre el embudo tal cual: pedido.klixmant.shop/<slug-del-embudo>.
 */

export const BASE_TIENDA = 'https://pedido.klixmant.shop';

export type TipoSeccion = 'banner' | 'productos' | 'catalogos' | 'nuevos' | 'promociones' | 'opiniones' | 'contacto' | 'texto';

export interface Seccion { id: string; tipo: TipoSeccion; visible: boolean; titulo: string; texto?: string }
/** Un embudo en la tienda. visible=false → oculto (sigue en la lista). quitado=true → fuera de la tienda (se puede volver a agregar). */
export interface ProdSel {
  slug: string; visible: boolean; quitado?: boolean; foto?: string | null;
  /** Fotos del CARRUSEL de la tarjeta (cambian solas cada segundo). Vacío = solo la foto principal. */
  fotos?: string[];
}
export interface CatSel {
  id: string; visible: boolean; embudo: string | null; grupo: string; portada?: string | null;
}
export interface Opinion { nombre: string; texto: string; estrellas: number; foto?: string | null }

export interface ConfigPagina {
  marca: { nombre: string; logo: string | null; color: string; eslogan: string; pixel_meta?: string /* solo dígitos */; pixel_tiktok?: string };
  banner: { titulo: string; titulo2: string; subtitulo: string; imagen: string | null; boton: string; beneficios: string[]; productos: string[] /* embudos de la portada (máx. 3) */; mostrar_textos?: boolean /* false = solo fotos */ };
  secciones: Seccion[];
  productos: ProdSel[];
  catalogos: CatSel[];
  contacto: { whatsapp: string; instagram: string; texto: string };
  opiniones: Opinion[];
  nuevos_cantidad: number;
}

export const NOMBRE_SECCION: Record<TipoSeccion, string> = {
  banner: 'Portada', productos: 'Nuestros Productos', catalogos: 'Catálogos', nuevos: 'Nuevos ingresos',
  promociones: 'Promociones', opiniones: 'Opiniones', contacto: 'Contacto', texto: 'Texto libre',
};
export const ICONO_SECCION: Record<TipoSeccion, string> = {
  banner: '🖼️', productos: '🛍️', catalogos: '🗂️', nuevos: '⭐', promociones: '🔥', opiniones: '💬', contacto: '✉️', texto: '📝',
};

export const nuevoId = () => Math.random().toString(36).slice(2, 9);

export function configInicial(): ConfigPagina {
  return {
    marca: { nombre: 'Klixmant', logo: null, color: '#00A895', eslogan: 'Tienda Oficial' },
    banner: {
      titulo: 'Buzos y Camisetas', titulo2: 'Premium', subtitulo: '', imagen: null, boton: 'Ver productos',
      beneficios: ['Diseños exclusivos', 'Alta calidad', 'Envío nacional'],
      productos: [],
    },
    secciones: (['banner', 'productos', 'contacto'] as TipoSeccion[])
      .map(tipo => ({ id: nuevoId(), tipo, visible: true, titulo: tipo === 'banner' ? '' : NOMBRE_SECCION[tipo] })),
    productos: [],
    catalogos: [],
    contacto: { whatsapp: '', instagram: '', texto: 'Pago contra entrega en toda Colombia.' },
    opiniones: [],
    nuevos_cantidad: 8,
  };
}

/** Une lo guardado con los valores por defecto (por si la config es de una versión anterior). */
export function normalizarConfig(c: any): ConfigPagina {
  const d = configInicial();
  const x = (c && typeof c === 'object') ? c : {};
  let secciones: Seccion[] = Array.isArray(x.secciones) && x.secciones.length ? x.secciones : d.secciones;
  // Versión anterior sin la sección de embudos → se agrega justo después de la portada
  if (!secciones.some(s => s.tipo === 'productos')) {
    const i = secciones.findIndex(s => s.tipo === 'banner');
    secciones = [...secciones];
    secciones.splice(i + 1, 0, { id: nuevoId(), tipo: 'productos', visible: true, titulo: NOMBRE_SECCION.productos });
  }
  return {
    marca: { ...d.marca, ...(x.marca ?? {}) },
    banner: { ...d.banner, ...(x.banner ?? {}), beneficios: Array.isArray(x.banner?.beneficios) ? x.banner.beneficios : d.banner.beneficios,
      productos: Array.isArray(x.banner?.productos) ? x.banner.productos.filter((v: any) => typeof v === 'string').slice(0, 3) : [] },
    secciones,
    productos: Array.isArray(x.productos) ? x.productos.filter((p: any) => p && typeof p.slug === 'string') : [],
    catalogos: Array.isArray(x.catalogos) ? x.catalogos : [],
    contacto: { ...d.contacto, ...(x.contacto ?? {}) },
    opiniones: Array.isArray(x.opiniones) ? x.opiniones : [],
    nuevos_cantidad: Number(x.nuevos_cantidad) > 0 ? Math.min(24, Number(x.nuevos_cantidad)) : d.nuevos_cantidad,
  };
}

/**
 * Los embudos NUEVOS (que la página aún no conoce) entran solos al final, visibles.
 * Los que el dueño ocultó o quitó se respetan; los que ya no existen se descartan.
 */
export function sincronizarProductos(cfg: ConfigPagina, slugsExistentes: string[]): ConfigPagina {
  const existen = new Set(slugsExistentes);
  const conocidos = new Set(cfg.productos.map(p => p.slug));
  const productos = [
    ...cfg.productos.filter(p => existen.has(p.slug)),
    ...slugsExistentes.filter(s => !conocidos.has(s)).map(slug => ({ slug, visible: true })),
  ];
  return { ...cfg, productos };
}

/** Tipo de prenda por el nombre (para los filtros de la página). */
export function grupoSugerido(nombre: string): string {
  const t = String(nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/\bpack\b|\bx2\b|combo|pareja/.test(t)) return 'Packs';
  if (/camiseta|camisa|futbol/.test(t)) return 'Camisetas';
  if (/cuello alto/.test(t)) return 'Cuello alto';
  if (/chaqueta/.test(t)) return 'Chaquetas';
  if (/\bpolos?\b/.test(t)) return 'Polos';
  return 'Buzos';
}

/** Nombre bonito: «BUZO Y CAMISETA BUCAROS» → «Buzo y Camiseta Bucaros». */
export function nombreBonito(t: string): string {
  const menores = new Set(['y', 'de', 'del', 'la', 'el', 'en', 'con', 'x']);
  return String(t ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
    .split(' ').map((w, i) => (i > 0 && menores.has(w)) ? w : (/^(fc|tk|f1|bts|cr7)$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

// ── Datos reales para pintar la página ─────────────────────────────────────
export interface EmbudoWeb { slug: string; producto: string; precio: number | null; precio_antes: number | null; foto: string | null; fotos: string[] }
export interface ProductoWeb { id: string; color: string; foto: string; creado: string }
export interface CatalogoWeb { id: string; familia: string; portada: string | null; productos: ProductoWeb[]; embudo: EmbudoWeb | null }
export interface PromoWeb { id: string; nombre: string; foto: string | null; precio: number | null; precio_antes: number | null }
export interface DatosPagina { embudos: Record<string, EmbudoWeb>; catalogos: CatalogoWeb[]; promociones: PromoWeb[] }

/** Enlace a un embudo DESDE Mi Página: el mismo enlace + marca de origen (utm). Los enlaces de los anuncios no cambian. */
export const enlaceEmbudo = (slug: string) =>
  `${BASE_TIENDA}/${slug}?utm_source=mi-pagina&utm_medium=web&utm_campaign=tienda`;

export const pesosCOP = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n)) ? '' : `$${Math.round(Number(n)).toLocaleString('es-CO')}`;

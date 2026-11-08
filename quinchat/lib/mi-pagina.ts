import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * MÓDULO «MI PÁGINA» (Embudos → Mi Página) — 08-nov-2026.
 *
 * Una página web pública con los catálogos que el dueño elija. Es INDEPENDIENTE:
 *  · Tabla propia `mi_pagina` (borrador = lo que se edita; publicado = lo que ve el público).
 *  · Solo LEE catálogos (catalogos_bot / catalogo_colores), embudos (funnels: precio y enlace)
 *    y promociones. No escribe en ninguna de esas tablas.
 *  · Ruta pública: pedido.klixmant.shop/web/<slug>  (internamente /p/web/<slug>).
 *  · Comprar: si el catálogo tiene un embudo enlazado → su checkout real; si no → WhatsApp.
 */

export const BASE_TIENDA = 'https://pedido.klixmant.shop';

export type TipoSeccion = 'banner' | 'catalogos' | 'nuevos' | 'promociones' | 'opiniones' | 'contacto' | 'texto';

export interface Seccion { id: string; tipo: TipoSeccion; visible: boolean; titulo: string; texto?: string }
export interface CatSel {
  id: string;            // catalogos_bot.id
  visible: boolean;
  embudo: string | null; // slug del embudo que vende este catálogo
  grupo: string;         // filtro en la página (Buzos, Camisetas…)
  portada?: string | null;
}
export interface Opinion { nombre: string; texto: string; estrellas: number; foto?: string | null }

export interface ConfigPagina {
  marca: { nombre: string; logo: string | null; color: string; eslogan: string };
  banner: { titulo: string; subtitulo: string; imagen: string | null; boton: string };
  secciones: Seccion[];
  catalogos: CatSel[];
  contacto: { whatsapp: string; instagram: string; texto: string };
  opiniones: Opinion[];
  nuevos_cantidad: number;
}

export const NOMBRE_SECCION: Record<TipoSeccion, string> = {
  banner: 'Banner principal', catalogos: 'Catálogos destacados', nuevos: 'Nuevos ingresos',
  promociones: 'Promociones', opiniones: 'Opiniones', contacto: 'Contacto', texto: 'Texto libre',
};
export const ICONO_SECCION: Record<TipoSeccion, string> = {
  banner: '🖼️', catalogos: '🗂️', nuevos: '⭐', promociones: '🔥', opiniones: '💬', contacto: '✉️', texto: '📝',
};

export const nuevoId = () => Math.random().toString(36).slice(2, 9);

export function configInicial(): ConfigPagina {
  return {
    marca: { nombre: 'Klixmant', logo: null, color: '#00A895', eslogan: '' },
    banner: { titulo: 'Nueva Colección', subtitulo: 'Buzos · Camisetas · Chaquetas', imagen: null, boton: 'Ver catálogos' },
    secciones: (['banner', 'catalogos', 'nuevos', 'promociones', 'opiniones', 'contacto'] as TipoSeccion[])
      .map(tipo => ({ id: nuevoId(), tipo, visible: true, titulo: tipo === 'banner' ? '' : NOMBRE_SECCION[tipo] })),
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
  return {
    marca: { ...d.marca, ...(x.marca ?? {}) },
    banner: { ...d.banner, ...(x.banner ?? {}) },
    secciones: Array.isArray(x.secciones) && x.secciones.length ? x.secciones : d.secciones,
    catalogos: Array.isArray(x.catalogos) ? x.catalogos : [],
    contacto: { ...d.contacto, ...(x.contacto ?? {}) },
    opiniones: Array.isArray(x.opiniones) ? x.opiniones : [],
    nuevos_cantidad: Number(x.nuevos_cantidad) > 0 ? Math.min(24, Number(x.nuevos_cantidad)) : d.nuevos_cantidad,
  };
}

/** Tipo de prenda por el nombre del catálogo (para los filtros de la página). */
export function grupoSugerido(familia: string): string {
  const t = String(familia ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/camiseta|camisa/.test(t)) return 'Camisetas';
  if (/cuello alto/.test(t)) return 'Cuello alto';
  if (/chaqueta/.test(t)) return 'Chaquetas';
  if (/\bpolo\b/.test(t)) return 'Polos';
  if (/buzo|hoodie/.test(t)) return 'Buzos';
  return 'Buzos';
}

// ── Datos reales para pintar la página ─────────────────────────────────────
export interface ProductoWeb { id: string; color: string; foto: string; creado: string }
export interface CatalogoWeb {
  id: string; familia: string; portada: string | null; productos: ProductoWeb[];
  embudo: EmbudoWeb | null;
}
export interface PromoWeb { id: string; nombre: string; foto: string | null; precio: number | null; precio_antes: number | null }
export interface EmbudoWeb { slug: string; producto: string; precio: number | null; precio_antes: number | null }
/** catalogos: con `embudo` = null (se resuelve en la página con la config, para que la vista previa siga los cambios). */
export interface DatosPagina { catalogos: CatalogoWeb[]; promociones: PromoWeb[]; embudos: Record<string, EmbudoWeb> }

/**
 * Carga catálogos (con sus fotos activas), el embudo enlazado de cada uno y las promociones activas.
 * `ids` = solo esos catálogos; null = todos los activos (vista previa del panel).
 */
export async function cargarDatosPagina(cfg: ConfigPagina, ids: string[] | null): Promise<DatosPagina> {
  const supabase = createServerSupabaseClient();
  let q = supabase.from('catalogos_bot')
    .select('id, familia, fotos_portada, activo, eliminado_at, catalogo_colores(id, color, url_imagen, activo, orden, created_at)')
    .eq('activo', true).is('eliminado_at', null);
  if (ids) {
    if (!ids.length) return { catalogos: [], promociones: await promos(), embudos: {} };
    q = q.in('id', ids);
  }
  const { data: cats } = await q.limit(300);

  // Embudos: los enlazados en la config (público) o todos los activos (vista previa: ids = null)
  const slugs = [...new Set(cfg.catalogos.map(c => c.embudo).filter(Boolean) as string[])];
  let fq = supabase.from('funnels').select('slug, producto, precio, precio_antes, activo, eliminado').eq('activo', true);
  if (ids) fq = fq.in('slug', slugs.length ? slugs : ['__ninguno__']);
  const { data: fun } = await fq.limit(400);
  const embudos: Record<string, EmbudoWeb> = {};
  for (const f of (fun ?? []) as any[]) {
    if (f.eliminado) continue;
    embudos[f.slug] = { slug: f.slug, producto: f.producto ?? '', precio: f.precio != null ? Number(f.precio) : null, precio_antes: f.precio_antes != null ? Number(f.precio_antes) : null };
  }

  const catalogos: CatalogoWeb[] = (cats ?? []).map((c: any) => {
    const productos = ((c.catalogo_colores ?? []) as any[])
      .filter(x => x.activo !== false && x.url_imagen)
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0))
      .map(x => ({ id: String(x.id), color: String(x.color ?? ''), foto: String(x.url_imagen), creado: String(x.created_at ?? '') }));
    const portadaGuardada = Array.isArray(c.fotos_portada) ? (c.fotos_portada.find((u: any) => typeof u === 'string' && u) ?? null) : null;
    return { id: String(c.id), familia: String(c.familia ?? ''), portada: portadaGuardada || productos[0]?.foto || null, productos, embudo: null };
  });
  return { catalogos, promociones: await promos(), embudos };

  async function promos(): Promise<PromoWeb[]> {
    if (!cfg.secciones.some(s => s.tipo === 'promociones' && s.visible)) return [];
    const { data } = await supabase.from('promociones').select('id, nombre, foto, fotos, precio, precio_antes')
      .eq('activo', true).order('orden', { ascending: true }).limit(24);
    return (data ?? []).map((p: any) => ({
      id: String(p.id), nombre: String(p.nombre ?? ''),
      foto: p.foto || (Array.isArray(p.fotos) ? p.fotos.find((u: any) => typeof u === 'string') : null) || null,
      precio: p.precio ?? null, precio_antes: p.precio_antes ?? null,
    }));
  }
}

export const pesosCOP = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n)) ? '' : `$${Math.round(Number(n)).toLocaleString('es-CO')}`;

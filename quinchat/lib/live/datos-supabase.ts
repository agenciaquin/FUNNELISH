// QUIN LIVE SHOPPING — Lectura desde la base (Fase 2).
// SOLO servidor (usa service_role). La página /live/[slug] y las rutas /api/live
// leen de aquí; el navegador nunca habla con Supabase directo.
//
// Devuelve el MISMO shape que la maqueta (LiveConfig / LineaDeTiempo) para que
// el overlay y el video no cambien. La línea de tiempo se sirve por la ruta
// /api/live/[slug]/timeline (useTimeline la sigue pidiendo por URL).

import { createServerSupabaseClient } from '@/lib/supabase';
import { PRIVACIDAD_URL } from './config';
import type {
  ColorProducto, LineaDeTiempo, LiveConfig, ProductoLive, Talla, EventoLinea,
} from './tipos';

const TALLAS_OK: Talla[] = ['S', 'M', 'L', 'XL'];
const aTallas = (arr: any): Talla[] => {
  const l = (Array.isArray(arr) ? arr : []).map(String).filter((t): t is Talla => (TALLAS_OK as string[]).includes(t));
  return l.length ? l : TALLAS_OK;
};

/** Convierte una fila de live_productos (+ colores) al ProductoLive del front. */
function aProducto(p: any, colores: any[]): ProductoLive {
  const cols: ColorProducto[] = (colores ?? [])
    .filter(c => c.producto_id === p.id)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map(c => ({ id: String(c.id), nombre: String(c.nombre ?? ''), hex: String(c.hex ?? '#888'), foto: String(c.foto_url ?? '') }));
  const prod: ProductoLive = {
    id: String(p.id),
    nombre: String(p.nombre ?? ''),
    descripcion: String(p.descripcion ?? ''),
    precio: Number(p.precio) || 0,
    tallas: aTallas(p.tallas),
    colores: cols,
  };
  if (p.precio_antes) prod.precioAntes = Number(p.precio_antes) || undefined;
  if (p.promo_etiqueta && p.promo_precio) {
    prod.promo = { etiqueta: String(p.promo_etiqueta), unidades: Number(p.promo_unidades) || 2, precioPack: Number(p.promo_precio) || 0 };
  }
  if (p.ficha_tela || p.ficha_cuidados) {
    prod.ficha = { tela: p.ficha_tela ?? undefined, cuidados: p.ficha_cuidados ?? undefined };
  }
  return prod;
}

/**
 * Lee un live por slug desde la base y lo arma como LiveConfig.
 * Devuelve null si no existe o está archivado (para que la página caiga al demo o 404).
 */
export async function buscarLiveDB(slug: string): Promise<LiveConfig | null> {
  const supabase = createServerSupabaseClient();
  const { data: live, error } = await supabase
    .from('live_lives')
    .select('id, slug, titulo, tienda_nombre, tienda_logo, etiqueta_grabada, video_url, poster_url, whatsapp, modo, estado')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !live || live.estado === 'archivado') return null;

  // Productos del live (en orden) + sus colores
  const { data: enlaces } = await supabase
    .from('live_lives_productos').select('producto_id, orden').eq('live_id', live.id).order('orden');
  const ids = (enlaces ?? []).map((e: any) => e.producto_id);
  let productos: ProductoLive[] = [];
  if (ids.length) {
    const [{ data: prods }, { data: cols }] = await Promise.all([
      supabase.from('live_productos').select('*').in('id', ids),
      supabase.from('live_producto_colores').select('*').in('producto_id', ids),
    ]);
    const orden = new Map<string, number>((enlaces ?? []).map((e: any) => [String(e.producto_id), e.orden ?? 0]));
    productos = (prods ?? [])
      .map((p: any) => aProducto(p, cols ?? []))
      .sort((a, b) => (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0));
  }

  return {
    slug: live.slug,
    titulo: live.titulo,
    etiquetaGrabada: live.etiqueta_grabada ?? 'Presentación grabada',
    tienda: { nombre: live.tienda_nombre ?? 'KLIXMANT', logo: live.tienda_logo ?? undefined },
    videoUrl: live.video_url || '/live-demo/demo.mp4',
    posterUrl: live.poster_url ?? undefined,
    timelineUrl: `/api/live/${encodeURIComponent(live.slug)}/timeline`,
    whatsapp: live.whatsapp || '573000000000',
    privacidadUrl: PRIVACIDAD_URL,
    modo: (live.modo === 'sincronizado' ? 'sincronizado' : 'desde_inicio'),
    productos,
  };
}

/** Línea de tiempo del live (shape JSON que consume useTimeline). */
export async function timelineDeLive(slug: string): Promise<LineaDeTiempo | null> {
  const supabase = createServerSupabaseClient();
  const { data: live } = await supabase.from('live_lives').select('id, duracion_seg').eq('slug', slug).maybeSingle();
  if (!live) return null;
  const { data: evs } = await supabase
    .from('live_timeline_eventos')
    .select('inicio_seg, fin_seg, tipo, producto_id, pregunta, respuesta, autor, texto')
    .eq('live_id', live.id)
    .order('inicio_seg');

  const eventos: EventoLinea[] = (evs ?? []).map((e: any) => {
    const base = { inicio: Number(e.inicio_seg) || 0, fin: Number(e.fin_seg) || 0 };
    if (e.tipo === 'producto') return { ...base, tipo: 'producto', contenido: { productoId: String(e.producto_id ?? '') } };
    if (e.tipo === 'pregunta_frecuente') return { ...base, tipo: 'pregunta_frecuente', contenido: { pregunta: String(e.pregunta ?? ''), respuesta: String(e.respuesta ?? '') } };
    return { ...base, tipo: 'comentario', contenido: { autor: String(e.autor ?? 'Cliente DEMO'), texto: String(e.texto ?? ''), demo: true } };
  });

  return { version: 1, duracion: Number(live.duracion_seg) || 180, eventos };
}

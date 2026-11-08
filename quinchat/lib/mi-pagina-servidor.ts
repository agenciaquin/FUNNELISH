import { createServerSupabaseClient } from '@/lib/supabase';
import { esVideo } from '@/lib/funnels';
import type { ConfigPagina, DatosPagina, EmbudoWeb, CatalogoWeb, PromoWeb } from '@/lib/mi-pagina';

/**
 * Mi Página — consultas a la base (SOLO LECTURA). Solo se usa en el servidor.
 * `todo` = vista previa del panel: trae todos los embudos activos (para que cualquier cambio se vea al instante).
 * Público: solo los embudos visibles de la config.
 */
export async function embudosActivos(slugs: string[] | null): Promise<EmbudoWeb[]> {
  const supabase = createServerSupabaseClient();
  let q = supabase.from('funnels')
    .select('slug, producto, nombre, precio, precio_antes, miniatura_url, imagenes, variantes, activo, eliminado, creado_at')
    .eq('activo', true).order('creado_at', { ascending: false });
  if (slugs) q = q.in('slug', slugs.length ? slugs : ['__ninguno__']);
  const { data } = await q.limit(400);
  const usadas = new Set<string>();
  const sinQuery = (u: string) => u.split('?')[0];
  return ((data ?? []) as any[]).filter(f => !f.eliminado).map(f => {
    const imgs = (Array.isArray(f.imagenes) ? f.imagenes : []).filter((u: any) => typeof u === 'string' && u && !esVideo(u));
    const vars = (Array.isArray(f.variantes) ? f.variantes : []).map((v: any) => v?.imagen).filter((u: any) => typeof u === 'string' && u && !esVideo(u));
    // Primero la foto propia del producto (variantes): la 1.ª de «imagenes» suele ser un banner compartido entre embudos
    const fotos = [...new Set([f.miniatura_url, ...vars, ...imgs].filter((u: any) => typeof u === 'string' && u))] as string[];
    // Portada del producto: la primera foto que no esté usando ya otro embudo (al duplicar, la 1.ª foto quedaba compartida)
    const foto = fotos.find(u => !usadas.has(sinQuery(u))) ?? fotos[0] ?? null;
    if (foto) usadas.add(sinQuery(foto));
    return {
      slug: String(f.slug), producto: String(f.producto || f.nombre || f.slug),
      precio: f.precio != null ? Number(f.precio) : null, precio_antes: f.precio_antes != null ? Number(f.precio_antes) : null,
      foto, fotos: fotos.slice(0, 12),
    };
  });
}

export async function cargarDatosPagina(cfg: ConfigPagina, todo: boolean): Promise<DatosPagina> {
  const supabase = createServerSupabaseClient();
  const visible = (t: string) => cfg.secciones.some(s => s.tipo === t && s.visible);

  const slugs = todo ? null : cfg.productos.filter(p => p.visible && !p.quitado).map(p => p.slug);
  const lista = await embudosActivos(slugs);
  const embudos: Record<string, EmbudoWeb> = Object.fromEntries(lista.map(e => [e.slug, e]));

  // Catálogos y promociones solo si su sección está puesta (o en la vista previa)
  let catalogos: CatalogoWeb[] = [];
  if (todo || visible('catalogos') || visible('nuevos')) {
    let q = supabase.from('catalogos_bot')
      .select('id, familia, fotos_portada, catalogo_colores(id, color, url_imagen, activo, orden, created_at)')
      .eq('activo', true).is('eliminado_at', null);
    if (!todo) {
      const ids = cfg.catalogos.filter(c => c.visible).map(c => c.id);
      q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    }
    const { data: cats } = await q.limit(300);
    catalogos = ((cats ?? []) as any[]).map(c => {
      const productos = ((c.catalogo_colores ?? []) as any[])
        .filter(x => x.activo !== false && x.url_imagen)
        .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0))
        .map(x => ({ id: String(x.id), color: String(x.color ?? ''), foto: String(x.url_imagen), creado: String(x.created_at ?? '') }));
      const portada = Array.isArray(c.fotos_portada) ? (c.fotos_portada.find((u: any) => typeof u === 'string' && u) ?? null) : null;
      return { id: String(c.id), familia: String(c.familia ?? ''), portada: portada || productos[0]?.foto || null, productos, embudo: null };
    });
    // Los embudos enlazados a catálogos también se necesitan en lo público
    if (!todo) {
      const faltan = cfg.catalogos.map(c => c.embudo).filter((s): s is string => !!s && !embudos[s]);
      if (faltan.length) for (const e of await embudosActivos(faltan)) embudos[e.slug] = e;
    }
  }

  let promociones: PromoWeb[] = [];
  if (todo || visible('promociones')) {
    const { data } = await supabase.from('promociones').select('id, nombre, foto, fotos, precio, precio_antes')
      .eq('activo', true).order('orden', { ascending: true }).limit(24);
    promociones = ((data ?? []) as any[]).map(p => ({
      id: String(p.id), nombre: String(p.nombre ?? ''),
      foto: p.foto || (Array.isArray(p.fotos) ? p.fotos.find((u: any) => typeof u === 'string') : null) || null,
      precio: p.precio ?? null, precio_antes: p.precio_antes ?? null,
    }));
  }
  return { embudos, catalogos, promociones };
}

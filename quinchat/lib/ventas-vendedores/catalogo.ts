import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Copia local del catálogo de Klixmant (módulo Ventas Vendedores).
 *
 * Fuente: API pública de Klixmsoft (sin clave). Se descarga una vez al día y con
 * el botón «Actualizar catálogo»; el bot NUNCA la consulta en cada mensaje.
 * Lo que deja de venir se marca inactivo (nunca se borra). Si la respuesta viene
 * rara o mucho más chica que la copia actual, no se toca nada.
 */
export const URL_CATALOGO = 'https://klixmsoft-production.up.railway.app/api/catalogo/publico';

export const sinTildes = (t: unknown) =>
  String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const GENEROS: Record<number, string> = { 1: 'Hombre', 2: 'Dama', 3: 'Unisex', 4: 'Niño' };

/** "Talla M" → "M", "Niño 4" → "Niño 4". */
export const limpiarTalla = (t: unknown) => String(t ?? '').replace(/^talla\s+/i, '').trim();

const esPersonalizado = (nombre: string) => /^personalizado\b/i.test(nombre.trim());

function huellaDe(o: unknown): string {
  const s = JSON.stringify(o);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

interface Resultado {
  ok: boolean; catalogos: number; productos: number; variantes: number;
  nuevos: number; cambiados: number; inactivados: number; error?: string;
}

export async function sincronizarCatalogo(origen: 'cron' | 'boton'): Promise<Resultado> {
  const supabase = createServerSupabaseClient();
  const { data: reg } = await supabase.from('vv_cat_sync').insert({ origen }).select('id').single();
  const cerrar = async (r: Resultado) => {
    if (reg?.id) {
      await supabase.from('vv_cat_sync').update({
        fin: new Date().toISOString(), ok: r.ok, catalogos: r.catalogos, productos: r.productos,
        variantes: r.variantes, nuevos: r.nuevos, cambiados: r.cambiados, inactivados: r.inactivados,
        error: r.error ?? null,
      }).eq('id', reg.id);
    }
    return r;
  };
  const vacio: Resultado = { ok: false, catalogos: 0, productos: 0, variantes: 0, nuevos: 0, cambiados: 0, inactivados: 0 };

  // 1) Descargar
  let json: any;
  try {
    const res = await fetch(URL_CATALOGO, { cache: 'no-store', signal: AbortSignal.timeout(40_000) });
    if (!res.ok) return cerrar({ ...vacio, error: `Klixmsoft respondió ${res.status}` });
    json = await res.json();
  } catch (e: any) {
    return cerrar({ ...vacio, error: `No se pudo descargar: ${e?.message ?? e}` });
  }
  const catalogos: any[] = Array.isArray(json?.catalogos) ? json.catalogos : [];
  if (!json?.success || catalogos.length === 0) return cerrar({ ...vacio, error: 'Respuesta sin catálogos' });

  // 2) Armar filas
  const productos: any[] = [];
  const variantes: any[] = [];
  for (const c of catalogos) {
    const idCat = Number(c?.id);
    const nombreCat = String(c?.nombre_catalogo ?? '').trim();
    if (!idCat || !nombreCat) continue;
    const personalizado = c?.personalizado === true || esPersonalizado(nombreCat);
    for (const it of c?.catalogo_productos_items ?? []) {
      const idItem = Number(it?.id);
      if (!idItem) continue;
      const p = it?.productos ?? {};
      const vars = (it?.catalogo_productos_variantes ?? []).map((v: any) => ({
        id: Number(v?.id),
        id_item: idItem,
        id_catalogo: idCat,
        color: String(v?.colores?.nombre ?? '').trim() || null,
        color_id: Number(v?.colores?.id) || null,
        talla: limpiarTalla(v?.producto_variantes_ventas?.producto_variantes?.tallas?.nombre) || null,
        sku: String(v?.producto_variantes_ventas?.referencia_sku ?? '').trim() || null,
      })).filter((v: any) => v.id > 0);
      const colores = [...new Set(vars.map((v: any) => v.color).filter(Boolean))] as string[];
      const tallas  = [...new Set(vars.map((v: any) => v.talla).filter(Boolean))] as string[];
      const fila = {
        id_item: idItem, id_catalogo: idCat, catalogo: nombreCat, personalizado,
        reflectivo: c?.reflectivo === true,
        nombre: String(p?.nombre ?? '').trim() || null,
        referencia: String(p?.codigo_referencia ?? '').trim() || null,
        tipo: String(p?.tipos_prenda?.nombre ?? '').trim() || null,
        genero_id: Number(p?.genero_id) || null,
        foto_main: it?.imagen_main || it?.imagen_supabase || null,
        foto_card: it?.imagen_card || it?.imagen_card_webp || null,
        foto_thumb: it?.imagen_thumb || null,
        colores, tallas,
        busqueda: sinTildes([nombreCat, p?.nombre, p?.codigo_referencia, p?.tipos_prenda?.nombre, ...colores].join(' ')),
      };
      productos.push({ ...fila, huella: huellaDe({ fila, vars }), activo: true, actualizado: new Date().toISOString() });
      variantes.push(...vars);
    }
  }

  // 3) Protección: si viene mucho más chico que lo que hay, no se toca la copia
  const { count: activosAntes } = await supabase.from('vv_cat_productos').select('id_item', { count: 'exact', head: true }).eq('activo', true);
  if ((activosAntes ?? 0) > 100 && productos.length < (activosAntes ?? 0) * 0.5) {
    return cerrar({ ...vacio, catalogos: catalogos.length, productos: productos.length, error: `Respuesta sospechosa: ${productos.length} productos vs ${activosAntes} en la copia. No se tocó nada.` });
  }

  // 4) Detectar cambios
  const previos = new Map<number, string>();
  for (let desde = 0; ; desde += 1000) {
    const { data } = await supabase.from('vv_cat_productos').select('id_item, huella, activo').range(desde, desde + 999);
    for (const r of data ?? []) previos.set(r.id_item, r.activo ? String(r.huella) : 'inactivo');
    if (!data || data.length < 1000) break;
  }
  let nuevos = 0, cambiados = 0;
  const aEscribir = productos.filter(p => {
    const h = previos.get(p.id_item);
    if (h === undefined) { nuevos++; return true; }
    if (h !== p.huella) { cambiados++; return true; }
    return false;
  });
  const idsCambiados = new Set(aEscribir.map(p => p.id_item));
  const varsAEscribir = variantes.filter(v => idsCambiados.has(v.id_item))
    .map(v => ({ ...v, activo: true, actualizado: new Date().toISOString() }));

  try {
    for (let i = 0; i < aEscribir.length; i += 500) {
      const { error } = await supabase.from('vv_cat_productos').upsert(aEscribir.slice(i, i + 500), { onConflict: 'id_item' });
      if (error) throw new Error(`productos: ${error.message}`);
    }
    // Variantes: se dedupe por id (un id debería ser único; si se repite manda la última)
    const unicas = [...new Map(varsAEscribir.map(v => [v.id, v])).values()];
    for (let i = 0; i < unicas.length; i += 1000) {
      const { error } = await supabase.from('vv_cat_variantes').upsert(unicas.slice(i, i + 1000), { onConflict: 'id' });
      if (error) throw new Error(`variantes: ${error.message}`);
    }
    // Variantes que ya no vienen en un producto cambiado → inactivas
    const idsVarVigentes = new Set(variantes.map(v => v.id));
    const cambiadosLista = [...idsCambiados];
    for (let i = 0; i < cambiadosLista.length; i += 200) {
      const { data: vs } = await supabase.from('vv_cat_variantes').select('id').in('id_item', cambiadosLista.slice(i, i + 200)).eq('activo', true);
      const sobran = (vs ?? []).map((v: any) => v.id).filter((id: number) => !idsVarVigentes.has(id));
      if (sobran.length) await supabase.from('vv_cat_variantes').update({ activo: false }).in('id', sobran);
    }
    // Productos que ya no vienen → inactivos (con sus variantes)
    const vigentes = new Set(productos.map(p => p.id_item));
    const desaparecidos = [...previos.entries()].filter(([id, h]) => h !== 'inactivo' && !vigentes.has(id)).map(([id]) => id);
    for (let i = 0; i < desaparecidos.length; i += 200) {
      const lote = desaparecidos.slice(i, i + 200);
      await supabase.from('vv_cat_productos').update({ activo: false }).in('id_item', lote);
      await supabase.from('vv_cat_variantes').update({ activo: false }).in('id_item', lote);
    }
    return cerrar({
      ok: true, catalogos: catalogos.length, productos: productos.length, variantes: variantes.length,
      nuevos, cambiados, inactivados: desaparecidos.length,
    });
  } catch (e: any) {
    return cerrar({ ...vacio, catalogos: catalogos.length, productos: productos.length, variantes: variantes.length, nuevos, cambiados, error: e?.message ?? String(e) });
  }
}

/** Último resultado de sincronización (para el panel). */
export async function ultimaSync() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('vv_cat_sync').select('*').order('inicio', { ascending: false }).limit(1).maybeSingle();
  const { data: ultimaOk } = await supabase.from('vv_cat_sync').select('fin').eq('ok', true).order('inicio', { ascending: false }).limit(1).maybeSingle();
  return { ultima: data, ultimaOk: ultimaOk?.fin ?? null };
}

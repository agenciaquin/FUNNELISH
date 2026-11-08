import { createServerSupabaseClient } from '@/lib/supabase';
import { optimizarImagen, CACHE_UN_ANO } from '@/lib/optimizar-imagen-servidor';
import { URL_CATALOGO, sinTildes } from '@/lib/ventas-vendedores/catalogo';
import { ESTILO } from '@/lib/watermark';

/**
 * Fotos ROTULADAS de KlixmSoft para un catálogo de QuinChat (07-nov-2026).
 *
 * KlixmSoft tiene un servicio público que entrega la foto ya rotulada, igual a la que se
 * descarga desde su catálogo (encabezado con el nombre del catálogo, el tipo de prenda y el
 * color): GET /api/catalogo/imagen-descarga?itemId=<id del producto en el catálogo>.
 *
 * Aquí se busca el catálogo en KlixmSoft por su NOMBRE EN KLIXMSOFT (campo aparte; la familia
 * de QuinChat no se toca), se empareja cada color de QuinChat con el color de KlixmSoft, se
 * baja la foto rotulada, se comprime y se guarda como foto del color.
 *
 * Para que el botón «Marcar fotos» (re-estampar) no la vuelva a procesar, se guarda en
 * catalogo/marcas/…-<ESTILO>-… y url_original ≠ url_imagen (la misma foto, con ?v=).
 */
const BASE_KLIX = 'https://klixmsoft-production.up.railway.app';

/** Cómo se llama el color en QuinChat → cómo lo llama KlixmSoft. */
function colorNormal(c: string): string {
  let t = sinTildes(String(c ?? '').replace(/([a-z])([A-Z])/g, '$1 $2'));
  if (/marfil|crema|hueso|perla/.test(t)) return 'marfil';
  if (/beige|cafe claro|camel|cocoa/.test(t)) return 'cocoa';
  if (/azul oscuro|azul marino|navy/.test(t)) return 'azul navy';
  if (/verde oscuro|verde militar|oliva/.test(t)) return 'verde oscuro';
  if (/vino|burdeos/.test(t)) return 'vinotinto';
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

interface ItemKlix { id: number; color: string; genero: number | null; tipo: string; referencia: string }

/** Descarga el catálogo público de KlixmSoft y devuelve los catálogos con sus productos. */
async function catalogosKlix(): Promise<{ id: number; nombre: string; items: ItemKlix[] }[]> {
  const r = await fetch(URL_CATALOGO, { cache: 'no-store', signal: AbortSignal.timeout(40_000) });
  if (!r.ok) throw new Error(`KlixmSoft respondió ${r.status}`);
  const j = await r.json();
  return (j?.catalogos ?? []).map((c: any) => ({
    id: Number(c.id), nombre: String(c.nombre_catalogo ?? '').trim(),
    items: (c.catalogo_productos_items ?? []).map((it: any) => {
      const vs = it?.catalogo_productos_variantes ?? [];
      return {
        id: Number(it.id),
        color: String(vs.find((v: any) => v?.colores?.nombre)?.colores?.nombre ?? '').trim(),
        genero: Number(it?.productos?.genero_id) || null,
        tipo: String(it?.productos?.tipos_prenda?.nombre ?? ''),
        referencia: String(it?.productos?.codigo_referencia ?? ''),
      };
    }).filter((x: ItemKlix) => x.id > 0),
  }));
}

export interface ResultadoFotos {
  ok: boolean;
  mensaje: string;
  catalogo?: { id: number; nombre: string };
  colores?: { color: string; ok: boolean; detalle: string; foto?: string }[];
  sugerencias?: string[];
}

export async function traerFotosKlixmsoft(catalogoId: string, nombreKlix: string, soloNombre = false): Promise<ResultadoFotos> {
  const supabase = createServerSupabaseClient();
  const { data: cat } = await supabase.from('catalogos_bot')
    .select('id, familia, id_catalogo, nombre_klixmsoft, catalogo_colores(id, color, nombre_producto, url_imagen, url_original)')
    .eq('id', catalogoId).maybeSingle();
  if (!cat) return { ok: false, mensaje: 'Catálogo no encontrado' };

  const buscado = sinTildes(nombreKlix || cat.nombre_klixmsoft || '').toUpperCase();
  if (!buscado) return { ok: false, mensaje: 'Escribe el nombre del catálogo en KlixmSoft.' };

  let lista: Awaited<ReturnType<typeof catalogosKlix>>;
  try { lista = await catalogosKlix(); } catch (e: any) { return { ok: false, mensaje: `No se pudo leer KlixmSoft: ${e?.message ?? e}` }; }
  const klix = lista.find(c => sinTildes(c.nombre).toUpperCase() === buscado);
  if (!klix) {
    const palabras = buscado.split(' ').filter(w => w.length >= 3);
    const sugerencias = lista.filter(c => palabras.some(w => sinTildes(c.nombre).toUpperCase().includes(w))).map(c => c.nombre).slice(0, 12);
    return { ok: false, mensaje: `No existe en KlixmSoft un catálogo llamado «${nombreKlix}».`, sugerencias };
  }

  // Guardar el nombre (y el id si está libre). La familia de QuinChat NO cambia.
  const { error: eNom } = await supabase.from('catalogos_bot').update({ nombre_klixmsoft: klix.nombre, id_catalogo: klix.id }).eq('id', cat.id);
  if (eNom) await supabase.from('catalogos_bot').update({ nombre_klixmsoft: klix.nombre }).eq('id', cat.id); // id ya usado por otro catálogo
  if (soloNombre) return { ok: true, mensaje: `Nombre en KlixmSoft guardado: ${klix.nombre}`, catalogo: { id: klix.id, nombre: klix.nombre } };

  // Hombre primero (como en la vista de KlixmSoft); si no hay, cualquiera.
  const items = [...klix.items].sort((a, b) => (a.genero === 1 ? 0 : 1) - (b.genero === 1 ? 0 : 1));
  const colores: NonNullable<ResultadoFotos['colores']> = [];
  for (const c of (cat as any).catalogo_colores ?? []) {
    const objetivo = colorNormal(c.color);
    const item = items.find(i => colorNormal(i.color) === objetivo)
      ?? items.find(i => { const k = colorNormal(i.color); return k.startsWith(objetivo) || objetivo.startsWith(k); });
    if (!item) { colores.push({ color: c.color, ok: false, detalle: `KlixmSoft no tiene ese color (tiene: ${[...new Set(items.map(i => i.color))].join(', ')})` }); continue; }
    try {
      const r = await fetch(`${BASE_KLIX}/api/catalogo/imagen-descarga?itemId=${item.id}`, { cache: 'no-store', signal: AbortSignal.timeout(25_000) });
      const tipo = r.headers.get('content-type') || '';
      if (!r.ok || !tipo.startsWith('image/')) throw new Error(`KlixmSoft respondió ${r.status} ${tipo}`);
      const img = await optimizarImagen(Buffer.from(await r.arrayBuffer()), tipo);
      const v = Date.now().toString(36);
      const ruta = `catalogo/marcas/${c.id}-${ESTILO}-klx${item.id}-${v}.${img.ext}`;
      const { error: eUp } = await supabase.storage.from('chat-media').upload(ruta, img.buffer, { contentType: img.contentType, cacheControl: CACHE_UN_ANO, upsert: true });
      if (eUp) throw new Error(`storage: ${eUp.message}`);
      const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
      const url = `${supaUrl}/storage/v1/object/public/chat-media/${ruta}`;
      const { error: eUpd } = await supabase.from('catalogo_colores')
        .update({ url_imagen: `${url}?v=${v}`, url_original: url, klixmsoft_item_id: item.id }).eq('id', c.id);
      if (eUpd) throw new Error(eUpd.message);
      colores.push({ color: c.color, ok: true, detalle: `${item.color} · ${item.referencia}`, foto: `${url}?v=${v}` });
    } catch (e: any) {
      colores.push({ color: c.color, ok: false, detalle: e?.message ?? String(e) });
    }
  }
  const bien = colores.filter(x => x.ok).length;
  return {
    ok: bien > 0, catalogo: { id: klix.id, nombre: klix.nombre }, colores,
    mensaje: `${bien} de ${colores.length} fotos reemplazadas con las rotuladas de KlixmSoft (${klix.nombre}).`,
  };
}

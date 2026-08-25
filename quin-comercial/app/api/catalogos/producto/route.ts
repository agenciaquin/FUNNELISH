import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/**
 * POST /api/catalogos/producto — guarda un producto COMPLETO desde el editor nuevo.
 *
 * Escribe la fila de `catalogos_bot` (lo que el bot ya usa: familia, patron,
 * anuncios, mensajes) MÁS las columnas nuevas (categoria_id, columnas, fotos),
 * y sincroniza `catalogo_colores`: una fila por variante, con color +
 * nombre_producto + url_imagen (que es lo que el bot lee para vender) y además
 * `variante` (la selección completa) para volver a pintar la tabla al editar.
 *
 * Degradación con gracia: si faltan columnas nuevas (aún no corren el SQL), se
 * guarda igual sin ellas — nunca se rompe.
 */
export async function POST(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: 'body inválido' }, { status: 400 });

  const nm = String(b?.nm ?? '').trim();
  if (!nm) return NextResponse.json({ error: 'Ponle un nombre al producto.' }, { status: 400 });

  const patron = String(b?.pat ?? nm).trim().toUpperCase();
  const categoria_id = b?.catId ? String(b.catId) : null;
  const mensaje_bienvenida = String(b?.m1 ?? '').trim() || null;
  const llamado_accion = String(b?.m2 ?? '').trim() || null;

  // Anuncios: lista de IDs + fechas por ID (para el aviso de "más viejo").
  const ads = Array.isArray(b?.ads) ? b.ads : [];
  const idsAd: string[] = [];
  const anuncios_fechas: Record<string, string> = {};
  for (const a of ads) {
    const id = String(a?.id ?? '').trim();
    if (!id || idsAd.includes(id)) continue;
    idsAd.push(id);
    const ts = a?.ts ? new Date(a.ts) : new Date();
    anuncios_fechas[id] = isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString();
  }
  const anuncios = idsAd.length ? idsAd.join(' ') : null;

  const columnas = Array.isArray(b?.cols) ? b.cols : [];
  const fotos_portada = Array.isArray(b?.fotos) ? b.fotos.filter((u: any) => typeof u === 'string' && u) : [];
  const rows = Array.isArray(b?.rows) ? b.rows : [];
  const stock_activo = !!b?.stockOn;
  const stock_aviso = (stock_activo && b?.stockAviso != null && Number.isFinite(Number(b.stockAviso)))
    ? Math.max(0, Math.round(Number(b.stockAviso))) : null;
  const stock_vid = (stock_activo && b?.stockVid) ? String(b.stockVid) : null;

  const supabase = createServerSupabaseClient();

  // ── 1) Upsert de la fila del producto (catalogos_bot) ──
  const dbId = b?.dbId && typeof b.dbId === 'string' ? b.dbId : null;
  const full: Record<string, any> = {
    familia: nm, patron, tenant_id: tid, activo: true,
    mensaje_bienvenida, llamado_accion,
    anuncios, anuncios_fechas,
    categoria_id, columnas, fotos_portada, eliminado_at: null,
    stock_activo, stock_aviso, stock_vid,
  };

  // Quita columnas nuevas y reintenta si la BD aún no las tiene.
  const NUEVAS = /column .*(categoria_id|columnas|fotos_portada|eliminado_at|llamado_accion|usar_entrenamiento|anuncios_fechas|mensaje_bienvenida|anuncios|stock_activo|stock_aviso|stock_vid).* does not exist/i;
  async function guardarCabecera(fila: Record<string, any>): Promise<{ id?: string; error?: any }> {
    let res = dbId
      ? await supabase.from('catalogos_bot').update(fila).eq('id', dbId).eq('tenant_id', tid).select('id').single()
      : await supabase.from('catalogos_bot').insert(fila).select('id').single();
    if (res.error && NUEVAS.test(res.error.message ?? '')) {
      // Retira la columna que falta y reintenta (una a una hasta que pase).
      const m = (res.error.message ?? '').match(/column "?([a-z_]+)"?/i);
      if (m && m[1] && m[1] in fila) {
        const { [m[1]]: _q, ...resto } = fila;
        return guardarCabecera(resto);
      }
    }
    if (res.error) return { error: res.error };
    return { id: (res.data as any)?.id };
  }

  const cab = await guardarCabecera(full);
  if (cab.error || !cab.id) return NextResponse.json({ error: cab.error?.message ?? 'No se pudo guardar' }, { status: 500 });
  const catalogoId = cab.id;

  // ── 2) Sincronizar variantes (catalogo_colores) ──
  // Se reemplazan todas las de este producto por el set nuevo. Cada fila guarda
  // color + nombre_producto + url_imagen (lo que el bot vende) y `variante`.
  await supabase.from('catalogo_colores').delete().eq('catalogo_id', catalogoId).eq('tenant_id', tid);

  const filas = rows.map((r: any, i: number) => {
    const img = typeof r?.img === 'string' && r.img ? r.img : null;
    const color = String(r?.color ?? '').trim() || null;
    const nombre_producto = String(r?.nombre_producto ?? '').trim().toUpperCase() || nm.toUpperCase();
    const variante = (r?.variante && typeof r.variante === 'object') ? r.variante : {};
    const stock_politica = (r?.stock_politica === 'seguir' || r?.stock_politica === 'bloquear') ? r.stock_politica : null;
    const stock_tallas = (r?.stock_tallas && typeof r.stock_tallas === 'object' && !Array.isArray(r.stock_tallas))
      ? Object.fromEntries(Object.entries(r.stock_tallas).map(([k, val]) => [String(k), Math.max(0, Math.round(Number(val) || 0))])) : null;
    // El total SIEMPRE se deriva en el servidor: si hay stock por talla, es la suma.
    const stock = stock_tallas
      ? Object.values(stock_tallas).reduce((a: number, b: any) => a + (Number(b) || 0), 0)
      : ((r?.stock != null && Number.isFinite(Number(r.stock))) ? Math.max(0, Math.round(Number(r.stock))) : null);
    return { catalogo_id: catalogoId, tenant_id: tid, color, nombre_producto, url_imagen: img, url_original: img, orden: i, variante, stock, stock_politica, stock_tallas };
  });

  if (filas.length) {
    // Inserta; si falta ALGUNA columna nueva, quita SOLO esa (nombrada en el error) y reintenta.
    async function insertar(fs: any[]): Promise<{ error?: any }> {
      const res = await supabase.from('catalogo_colores').insert(fs);
      if (res.error) {
        const m = (res.error.message ?? '').match(/column "?([a-z_]+)"? .* does not exist/i);
        const col = m?.[1];
        if (col && ['variante', 'url_original', 'stock', 'stock_politica', 'stock_tallas'].includes(col) && col in (fs[0] ?? {})) {
          return insertar(fs.map(({ [col]: _q, ...resto }: any) => resto));
        }
      }
      return { error: res.error };
    }
    const ins = await insertar(filas);
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }

  // ── 3) Devolver el producto ya guardado con sus colores ──
  const { data } = await supabase
    .from('catalogos_bot').select('*, catalogo_colores(*)').eq('id', catalogoId).eq('tenant_id', tid).single();
  return NextResponse.json(data ?? { id: catalogoId }, { status: 200 });
}

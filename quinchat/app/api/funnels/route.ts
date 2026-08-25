import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Lista los embudos para el panel.
 * - Sin parámetro → solo activos (eliminado null o false).
 * - ?papelera=1   → solo los que están en la papelera (eliminado = true).
 * Degradación con gracia: si la columna `eliminado` aún no existe (falta la
 * migración), no rompe: la lista normal devuelve todo y la papelera vacía.
 */
export async function GET(req: NextRequest) {
  const papelera = req.nextUrl.searchParams.get('papelera') === '1';
  const supabase = createServerSupabaseClient();

  let q = supabase.from('funnels').select('*').order('creado_at', { ascending: false });
  q = papelera ? q.eq('eliminado', true) : q.or('eliminado.is.null,eliminado.eq.false');

  const { data, error } = await q;
  if (error) {
    if (/eliminado/i.test(error.message)) {
      if (papelera) return NextResponse.json({ embudos: [] });
      const { data: all, error: e2 } = await supabase
        .from('funnels').select('*').order('creado_at', { ascending: false });
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
      return NextResponse.json({ embudos: all ?? [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ embudos: data ?? [] });
}

/** Crea o actualiza un embudo. */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();

    if (!b?.slug?.trim() || !b?.producto?.trim()) {
      return NextResponse.json({ error: 'Falta la dirección o el nombre del producto.' }, { status: 400 });
    }

    // La dirección va en la URL: sin tildes, espacios ni mayúsculas
    const slug = String(b.slug).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    const fila = {
      slug,
      activo:            b.activo !== false,
      nombre:            String(b.nombre ?? b.producto).trim(),
      titulo:            String(b.titulo ?? '').trim(),
      producto:          String(b.producto).trim(),
      precio:            Number(b.precio ?? 0),
      precio_antes:      b.precio_antes ? Number(b.precio_antes) : null,
      imagenes:          Array.isArray(b.imagenes) ? b.imagenes : [],
      imagen_banner:     b.imagen_banner   || null,
      imagen_clientes:   b.imagen_clientes || null,
      imagen_detalle:    b.imagen_detalle  || null,
      caracteristicas:   Array.isArray(b.caracteristicas) ? b.caracteristicas : [],
      frases:            Array.isArray(b.frases) ? b.frases.slice(0, 5) : [],
      tallas:            Array.isArray(b.tallas) ? b.tallas : [],
      variantes:         Array.isArray(b.variantes) ? b.variantes : [],
      horas_contador:    Number(b.horas_contador ?? 10),
      personas_comprando: Number(b.personas_comprando ?? 27),
      whatsapp:           String(b.whatsapp ?? '').replace(/\D/g, ''),
      // Se limpian espacios: un ID o token con espacios rompe la llamada a Meta
      pixel_meta:         String(b.pixel_meta         ?? '').trim() || null,
      pixel_meta_token:   String(b.pixel_meta_token   ?? '').trim() || null,
      pixel_tiktok:       String(b.pixel_tiktok       ?? '').trim() || null,
      pixel_tiktok_token: String(b.pixel_tiktok_token ?? '').trim() || null,
      audio_url:          b.audio_url          || null,
      video_url:          b.video_url          || null,
      color:              b.color              || null,
      miniatura_url:      b.miniatura_url      || null,
      anuncios:           String(b.anuncios ?? '').trim() || null,
      layout:             b.layout ?? null,
      insignia:           b.insignia ?? null,
    };

    const supabase = createServerSupabaseClient();
    const { data: existe } = await supabase
      .from('funnels').select('id').eq('slug', slug).maybeSingle();

    let { error } = existe?.id
      ? await supabase.from('funnels').update(fila).eq('id', existe.id)
      : await supabase.from('funnels').insert(fila);

    // Si la base todavía no tiene alguna columna nueva (tokens o audio), se guarda
    // sin ella en vez de perder todo el embudo, y se avisa qué falta.
    if (error && /column .*(pixel_meta_token|pixel_tiktok_token|audio_url|video_url|color|miniatura_url|anuncios|layout|insignia).* does not exist/i.test(error.message)) {
      const { pixel_meta_token, pixel_tiktok_token, audio_url, video_url, color, miniatura_url, anuncios, layout, insignia, ...sinNuevas } = fila;
      const reintento = existe?.id
        ? await supabase.from('funnels').update(sinNuevas).eq('id', existe.id)
        : await supabase.from('funnels').insert(sinNuevas);
      if (reintento.error) return NextResponse.json({ error: reintento.error.message }, { status: 500 });

      return NextResponse.json({
        ok: true, slug,
        aviso: 'Se guardó, pero falta agregar en la base de datos las columnas nuevas (tokens / audio).',
      });
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, slug });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

/**
 * Envía a la papelera (borrado suave) o restaura embudos.
 * body: { accion: 'eliminar' | 'restaurar', ids: string[] }  (ids = slugs)
 */
export async function PATCH(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'body inválido' }, { status: 400 }); }

  const accion = b?.accion;
  const ids = Array.isArray(b?.ids) ? b.ids.map(String).map((s: string) => s.trim()).filter(Boolean) : [];
  if (!['eliminar', 'restaurar'].includes(accion) || ids.length === 0) {
    return NextResponse.json({ error: 'Falta la acción o los elementos.' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const patch = accion === 'eliminar'
    ? { eliminado: true,  eliminado_at: new Date().toISOString() }
    : { eliminado: false, eliminado_at: null };

  const { error } = await supabase.from('funnels').update(patch).in('slug', ids);
  if (error) {
    if (/eliminado/i.test(error.message)) {
      return NextResponse.json({
        error: 'Falta correr la migración: agrega las columnas eliminado / eliminado_at a la tabla funnels (sql/embudos-papelera.sql).',
      }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Borrado REAL y permanente (no papelera, no caché).
 * Acepta ?slug=x, ?id=x (uno) o ?ids=a,b,c (varios). Todos son slugs.
 */
export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const idsParam = sp.get('ids');
  const uno = sp.get('id') || sp.get('slug');
  const slugs = idsParam
    ? idsParam.split(',').map(s => s.trim()).filter(Boolean)
    : uno ? [uno] : [];

  if (slugs.length === 0) return NextResponse.json({ error: 'Falta la dirección.' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('funnels').delete().in('slug', slugs);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

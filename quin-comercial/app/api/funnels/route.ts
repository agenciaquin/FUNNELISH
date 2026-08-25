import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/** Lista los embudos del cliente para el panel.
 *  ?papelera=1 → solo los eliminados (papelera); sin él → solo los activos. */
export async function GET(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const papelera = req.nextUrl.searchParams.get('papelera') === '1';
  const supabase = createServerSupabaseClient();

  const base = () => supabase.from('funnels').select('*').eq('tenant_id', tid).order('creado_at', { ascending: false });
  let q = base();
  q = papelera ? q.eq('eliminado', true) : q.or('eliminado.is.null,eliminado.eq.false');
  let { data, error } = await q;

  // Si la columna 'eliminado' aún no existe (falta migración), degradar con gracia:
  // lista normal = todos; papelera = vacío.
  if (error && /eliminado|column/i.test(error.message ?? '')) {
    if (papelera) return NextResponse.json({ embudos: [] });
    ({ data, error } = await base());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ embudos: data ?? [] });
}

/** Enviar a la papelera (soft delete) o restaurar. Body: { accion, slugs[] }. */
export async function PATCH(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const accion = String(b?.accion ?? '');

  // ── Guardar SOLO los píxeles de un embudo (rápido, desde la lista) ──
  if (accion === 'pixels') {
    const slug = String(b?.slug ?? '').trim().toLowerCase();
    if (!slug) return NextResponse.json({ error: 'Falta la dirección.' }, { status: 400 });
    const supabase = createServerSupabaseClient();
    const patch: Record<string, any> = {
      pixel_meta:         String(b?.pixel_meta ?? '').trim()         || null,
      pixel_meta_token:   String(b?.pixel_meta_token ?? '').trim()   || null,
      pixel_tiktok:       String(b?.pixel_tiktok ?? '').trim()       || null,
      pixel_tiktok_token: String(b?.pixel_tiktok_token ?? '').trim() || null,
    };
    let { error } = await supabase.from('funnels').update(patch).eq('slug', slug).eq('tenant_id', tid);
    // Si faltan las columnas de token, se guarda sin ellas.
    if (error && /column .*(pixel_meta_token|pixel_tiktok_token).* does not exist/i.test(error.message)) {
      const { pixel_meta_token, pixel_tiktok_token, ...sinTokens } = patch;
      ({ error } = await supabase.from('funnels').update(sinTokens).eq('slug', slug).eq('tenant_id', tid));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const slugs = Array.isArray(b?.slugs) ? b.slugs.map((s: any) => String(s)).filter(Boolean) : [];
  if (!slugs.length || !['eliminar', 'restaurar'].includes(accion)) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  const patch = accion === 'eliminar'
    ? { eliminado: true,  eliminado_at: new Date().toISOString() }
    : { eliminado: false, eliminado_at: null };

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('funnels').update(patch).in('slug', slugs).eq('tenant_id', tid);
  if (error) {
    if (/eliminado|column/i.test(error.message ?? '')) {
      return NextResponse.json({ error: 'Falta correr la migración sql/funnel-papelera.sql en Supabase.' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, afectados: slugs.length });
}

/** Crea o actualiza un embudo. */
export async function POST(req: NextRequest) {
  try {
    const tid = await tenantActual();
    if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

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
      tenant_id:         tid,
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
      bloques:            Array.isArray(b.bloques) ? b.bloques : [],
      // Editor "todo es un bloque": lista ordenada. null = usar el dibujo clásico.
      layout:             Array.isArray(b.layout) && b.layout.length ? b.layout : null,
      // Segunda versión (borrador) de la página. No se publica; se arma aparte.
      layout_borrador:    Array.isArray(b.layout_borrador) && b.layout_borrador.length ? b.layout_borrador : null,
      // Cuál de las dos versiones se publica: 'cero' (bloques) o 'plantilla' (clásico).
      modo_publicado:     (b.modo_publicado === 'cero' || b.modo_publicado === 'plantilla') ? b.modo_publicado : null,
      // Confirmación del pedido: 'solo' (bot envía y se apaga) o 'agente' (bot confirma). null = agente.
      modo_confirmacion:  (b.modo_confirmacion === 'solo' || b.modo_confirmacion === 'agente') ? b.modo_confirmacion : null,
      // Oculta el SEGUNDO botón "COMPRAR" (el de abajo) en la página de venta.
      ocultar_boton2:     b.ocultar_boton2 === true,
      // Producto del catálogo al que está vinculado (stock en vivo). null = sin vínculo.
      catalogo_id:        b.catalogoId ? String(b.catalogoId) : null,
    };

    const supabase = createServerSupabaseClient();

    // slug_original: cuando se está MODIFICANDO un embudo existente (aunque le
    // cambien la dirección). Si viene, se actualiza ESE embudo en vez de crear
    // uno nuevo. Sin slug_original = crear nuevo.
    const slugOriginal = String(b.slug_original ?? '').trim().toLowerCase() || null;

    // ¿Cuál fila vamos a actualizar? Si hay slug_original, buscamos por él.
    let existe: { id: any; tenant_id: any } | null = null;
    if (slugOriginal) {
      const { data } = await supabase.from('funnels').select('id, tenant_id').eq('slug', slugOriginal).maybeSingle();
      existe = data ?? null;
    }
    // Si no hay slug_original (crear nuevo), o no se encontró, se cae al slug nuevo.
    if (!existe) {
      const { data } = await supabase.from('funnels').select('id, tenant_id').eq('slug', slug).maybeSingle();
      existe = data ?? null;
    }

    // La dirección NUEVA no puede pertenecer a OTRO embudo distinto (slug único global).
    const { data: dueñoNuevo } = await supabase.from('funnels').select('id, tenant_id').eq('slug', slug).maybeSingle();
    if (dueñoNuevo && dueñoNuevo.id !== existe?.id) {
      const deOtro = dueñoNuevo.tenant_id && dueñoNuevo.tenant_id !== tid;
      return NextResponse.json({
        error: deOtro
          ? 'Esa dirección (slug) ya está en uso por otra empresa. Elige otra.'
          : 'Esa dirección ya está en uso por otro de tus embudos. Elige otra.',
      }, { status: 409 });
    }

    let { error } = existe?.id
      ? await supabase.from('funnels').update(fila).eq('id', existe.id).eq('tenant_id', tid)
      : await supabase.from('funnels').insert(fila);

    // Si la base todavía no tiene alguna columna nueva (tokens o audio), se guarda
    // sin ella en vez de perder todo el embudo, y se avisa qué falta.
    if (error && /column .*(pixel_meta_token|pixel_tiktok_token|audio_url|video_url|color|miniatura_url|anuncios|bloques|layout|layout_borrador|modo_publicado|modo_confirmacion|ocultar_boton2|catalogo_id).* does not exist/i.test(error.message)) {
      const { pixel_meta_token, pixel_tiktok_token, audio_url, video_url, color, miniatura_url, anuncios, bloques, layout, layout_borrador, modo_publicado, modo_confirmacion, ocultar_boton2, catalogo_id, ...sinNuevas } = fila;
      const reintento = existe?.id
        ? await supabase.from('funnels').update(sinNuevas).eq('id', existe.id).eq('tenant_id', tid)
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

/** Elimina un embudo DE VERDAD (borrado permanente de la base de datos).
 *  ?slug=x (uno) o ?slugs=a,b,c (varios). Es real: no queda en caché. */
export async function DELETE(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const slug = req.nextUrl.searchParams.get('slug');
  const slugsParam = req.nextUrl.searchParams.get('slugs');
  const lista = slugsParam
    ? slugsParam.split(',').map(s => s.trim()).filter(Boolean)
    : (slug ? [slug] : []);
  if (!lista.length) return NextResponse.json({ error: 'Falta la dirección.' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('funnels').delete().in('slug', lista).eq('tenant_id', tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, borrados: lista.length });
}

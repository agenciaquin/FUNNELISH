import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { normalizarConfig, configInicial, sincronizarProductos, grupoSugerido } from '@/lib/mi-pagina';
import { embudosActivos } from '@/lib/mi-pagina-servidor';

export const dynamic = 'force-dynamic';

/**
 * Mi Página (panel). Exige sesión: en pedido.klixmant.shop el middleware deja pasar /api/ sin login.
 *  GET            → la página (se crea sola la primera vez con portada + TODOS los embudos activos),
 *                   los embudos (nombre, fotos, precio) y los catálogos. Solo lee embudos y catálogos.
 *  PUT  {slug, slug_anterior?, nombre, borrador}  → guarda el BORRADOR (no cambia lo publicado).
 *  POST {slug, accion: 'publicar' | 'ocultar' | 'mostrar'}
 */
const norm = (t: unknown) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;

export async function GET() {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const supabase = createServerSupabaseClient();
  const [{ data: paginas }, embudos, { data: cats }] = await Promise.all([
    supabase.from('mi_pagina').select('*').order('creado_at', { ascending: true }).limit(1),
    embudosActivos(null),
    supabase.from('catalogos_bot').select('id, familia, patron, catalogo_colores(url_imagen, activo)')
      .eq('activo', true).is('eliminado_at', null).order('created_at', { ascending: false }).limit(300),
  ]);
  const slugs = embudos.map(e => e.slug);

  let p: any = (paginas ?? [])[0] ?? null;
  if (!p) {
    // Primera vez: portada por defecto + todos los embudos activos, en el orden más reciente primero.
    const borrador = sincronizarProductos(configInicial(), slugs);
    const { data: nueva } = await supabase.from('mi_pagina')
      .upsert({ slug: 'klixmant', nombre: borrador.marca.nombre, borrador }, { onConflict: 'slug' }).select('*').single();
    p = nueva;
  }
  const borrador = p ? sincronizarProductos(normalizarConfig(p.borrador), slugs) : sincronizarProductos(configInicial(), slugs);

  const catalogos = ((cats ?? []) as any[]).map(c => {
    const fotos = ((c.catalogo_colores ?? []) as any[]).filter(x => x.activo !== false && x.url_imagen).map(x => String(x.url_imagen));
    const nom = norm(c.patron || c.familia);
    const sug = nom.length >= 4 ? embudos.find(f => ` ${norm(f.producto)} `.includes(` ${nom} `)) : null;
    return { id: String(c.id), familia: String(c.familia ?? ''), fotos: fotos.length, portada: fotos[0] ?? null, grupo: grupoSugerido(c.familia), embudo_sugerido: sug?.slug ?? null };
  });

  return NextResponse.json({
    pagina: p ? { slug: p.slug, nombre: p.nombre, publicada: p.publicada, publicado_at: p.publicado_at, actualizado_at: p.actualizado_at, borrador } : null,
    embudos,
    catalogos,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const b = await req.json().catch(() => null);
  const slug = String(b?.slug ?? '').trim().toLowerCase();
  if (!SLUG.test(slug)) return NextResponse.json({ error: 'La dirección solo puede tener letras minúsculas, números y guiones (2 a 41).' }, { status: 400 });
  const borrador = normalizarConfig(b?.borrador);
  const nombre = String(b?.nombre ?? borrador.marca.nombre ?? 'Mi página').slice(0, 80);
  const supabase = createServerSupabaseClient();
  const ahora = new Date().toISOString();
  const anterior = String(b?.slug_anterior ?? '').trim().toLowerCase();

  if (anterior && anterior !== slug) {
    const { data: ocupado } = await supabase.from('mi_pagina').select('slug').eq('slug', slug).maybeSingle();
    if (ocupado) return NextResponse.json({ error: 'Esa dirección ya está en uso.' }, { status: 409 });
    const { error } = await supabase.from('mi_pagina').update({ slug, nombre, borrador, actualizado_at: ahora }).eq('slug', anterior);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, slug });
  }
  const { error } = await supabase.from('mi_pagina').upsert({ slug, nombre, borrador, actualizado_at: ahora }, { onConflict: 'slug' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, slug, guardado_at: ahora });
}

export async function POST(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const b = await req.json().catch(() => null);
  const slug = String(b?.slug ?? '').trim().toLowerCase();
  const accion = String(b?.accion ?? '');
  const supabase = createServerSupabaseClient();
  const { data: p } = await supabase.from('mi_pagina').select('slug, borrador, publicado').eq('slug', slug).maybeSingle();
  if (!p) return NextResponse.json({ error: 'Primero guarda la página.' }, { status: 404 });
  const ahora = new Date().toISOString();
  let cambio: Record<string, any>;
  if (accion === 'publicar') cambio = { publicado: normalizarConfig(p.borrador), publicada: true, publicado_at: ahora };
  else if (accion === 'ocultar') cambio = { publicada: false };
  else if (accion === 'mostrar') {
    if (!p.publicado) return NextResponse.json({ error: 'Publica la página una vez antes de activarla.' }, { status: 400 });
    cambio = { publicada: true };
  } else return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  const { error } = await supabase.from('mi_pagina').update({ ...cambio, actualizado_at: ahora }).eq('slug', slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...cambio });
}

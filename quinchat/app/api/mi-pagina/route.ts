import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { normalizarConfig, grupoSugerido } from '@/lib/mi-pagina';

export const dynamic = 'force-dynamic';

/**
 * Mi Página (panel). Exige sesión: en pedido.klixmant.shop el middleware deja pasar /api/ sin login.
 *  GET            → la página (si existe) + catálogos activos + embudos activos (solo lectura).
 *  PUT  {slug, slug_anterior?, nombre, borrador}  → guarda el BORRADOR (no cambia lo publicado).
 *  POST {slug, accion: 'publicar' | 'ocultar' | 'mostrar'}
 * No escribe en catálogos ni embudos.
 */
const norm = (t: unknown) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;

export async function GET() {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const supabase = createServerSupabaseClient();
  const [{ data: paginas }, { data: cats }, { data: fun }] = await Promise.all([
    supabase.from('mi_pagina').select('*').order('creado_at', { ascending: true }).limit(1),
    supabase.from('catalogos_bot').select('id, familia, patron, created_at, catalogo_colores(url_imagen, activo)')
      .eq('activo', true).is('eliminado_at', null).order('created_at', { ascending: false }).limit(300),
    supabase.from('funnels').select('slug, producto, nombre, precio, activo, eliminado, imagenes, variantes')
      .eq('activo', true).limit(300),
  ]);
  const embudos = (fun ?? []).filter((f: any) => !f.eliminado);

  const catalogos = (cats ?? []).map((c: any) => {
    const fotos = ((c.catalogo_colores ?? []) as any[]).filter(x => x.activo !== false && x.url_imagen).map(x => String(x.url_imagen));
    // Embudo sugerido: comparte una foto con el catálogo, o su nombre contiene el del catálogo.
    const base = (u: string) => u.split('?')[0];
    const fotosSet = new Set(fotos.map(base));
    const nom = norm(c.patron || c.familia);
    const porFoto = embudos.find((f: any) => [...(f.imagenes ?? []), ...((f.variantes ?? []).map((v: any) => v?.imagen))]
      .some((u: any) => typeof u === 'string' && fotosSet.has(base(u))));
    const porNombre = nom.length >= 4 ? embudos.find((f: any) => ` ${norm(`${f.producto} ${f.nombre}`)} `.includes(` ${nom} `)) : null;
    const sug: any = porFoto ?? porNombre ?? null;
    return {
      id: String(c.id), familia: String(c.familia ?? ''), fotos: fotos.length, portada: fotos[0] ?? null,
      grupo: grupoSugerido(c.familia), embudo_sugerido: sug?.slug ?? null,
    };
  });

  const p = (paginas ?? [])[0] ?? null;
  return NextResponse.json({
    pagina: p ? { ...p, borrador: normalizarConfig(p.borrador) } : null,
    catalogos,
    embudos: embudos.map((f: any) => ({ slug: f.slug, producto: f.producto || f.nombre || f.slug, precio: f.precio != null ? Number(f.precio) : null })),
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

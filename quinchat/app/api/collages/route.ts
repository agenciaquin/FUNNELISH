import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * PANEL DE CATÁLOGOS (collages) — 09-nov-2026. Módulo independiente.
 * Solo LEE la copia del catálogo KLIXMANT (vv_cat_productos); guarda sus collages en catalogos_collage.
 *  GET                → lista de collages (marca «desactualizado» si cambió una foto o se apagó una prenda)
 *  GET ?buscar=texto  → prendas activas del catálogo para armar un collage personalizado (máx. 120)
 *  GET ?catalogos=texto|*  → catálogos KLIXMANT con sus prendas (1 por color, HOMBRE primero) + su collage automático
 *  POST {id?, nombre, familia, items}            → crea / actualiza el catálogo (sin imagen)
 *  PATCH {id, imagen_url, ancho, alto, firma}    → guarda el collage generado
 *  DELETE ?id=        → lo quita del panel (eliminado_at; no se borra)
 */
const GEN: Record<number, string> = { 1: 'HOMBRE', 2: 'DAMA', 3: 'NIÑO' };
const firmaDe = (items: any[]) => items.map(i => `${i.id_item}:${i.foto}`).join('|');

export async function GET(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const supabase = createServerSupabaseClient();
  const buscar = String(req.nextUrl.searchParams.get('buscar') ?? '').trim();

  const cat = req.nextUrl.searchParams.get('catalogos');
  if (cat != null) {
    let q = supabase.from('vv_cat_productos').select('id_item, id_catalogo, catalogo, referencia, genero_id, colores, foto_main, foto_card').eq('activo', true);
    for (const p of cat.trim() === '*' ? [] : cat.toUpperCase().split(/\s+/).filter(Boolean).slice(0, 4)) q = q.ilike('catalogo', `%${p}%`);
    const filas: any[] = [];
    for (let d = 0; d < 6000; d += 1000) {
      const { data } = await q.order('catalogo').order('genero_id').order('referencia').range(d, d + 999);
      filas.push(...(data ?? [])); if ((data ?? []).length < 1000) break;
    }
    // Un collage por catálogo: prendas de HOMBRE (si no hay, las que haya), sin repetir color
    const porCat = new Map<number, { id_catalogo: number; catalogo: string; items: any[] }>();
    for (const x of filas) {
      const c = porCat.get(x.id_catalogo) ?? { id_catalogo: x.id_catalogo, catalogo: x.catalogo, items: [] as any[] };
      porCat.set(x.id_catalogo, c);
      (c as any).todos = [...((c as any).todos ?? []), x];
    }
    const catalogos = [...porCat.values()].map((c: any) => {
      const hayH = c.todos.some((x: any) => x.genero_id === 1);
      const vistos = new Set<string>();
      const items = c.todos.filter((x: any) => !hayH || x.genero_id === 1).filter((x: any) => {
        const col = String((x.colores ?? [])[0] ?? '').toUpperCase(); if (vistos.has(col)) return false; vistos.add(col); return true;
      }).map((x: any) => {
        const color = String((x.colores ?? [])[0] ?? '').toUpperCase();
        return { id_item: x.id_item, nombre: `${x.catalogo} ${color}`.trim(), color, foto: x.foto_main || x.foto_card, referencia: x.referencia };
      });
      return { id_catalogo: c.id_catalogo, catalogo: c.catalogo, items };
    });
    const ids = catalogos.map(c => c.id_catalogo);
    const autos: any[] = [];
    for (let i = 0; i < ids.length; i += 300) {
      const { data } = await supabase.from('catalogos_collage').select('*').eq('tipo', 'auto').is('eliminado_at', null).in('id_catalogo', ids.slice(i, i + 300));
      autos.push(...(data ?? []));
    }
    const porId = new Map(autos.map(a => [a.id_catalogo, a]));
    return NextResponse.json({
      catalogos: catalogos.map(c => {
        const a = porId.get(c.id_catalogo);
        // Desactualizado: cambió la lista de prendas/fotos (o la descartada «no disponible» volvió)
        const firmaHoy = firmaDe(c.items);
        return { ...c, collage: a ? { ...a, desactualizado: !!a.imagen_url && a.firma !== firmaHoy } : null, firma_hoy: firmaHoy };
      }),
    });
  }

  if (buscar) {
    const palabras = buscar.toUpperCase().split(/\s+/).filter(Boolean).slice(0, 4);
    let q = supabase.from('vv_cat_productos')
      .select('id_item, id_catalogo, catalogo, referencia, tipo, genero_id, colores, foto_main, foto_card').eq('activo', true);
    for (const p of palabras) q = q.ilike('catalogo', `%${p}%`);
    const { data, error } = await q.order('catalogo').order('referencia').limit(120);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      prendas: (data ?? []).map((x: any) => {
        const color = String((x.colores ?? [])[0] ?? '').toUpperCase();
        return {
          id_item: x.id_item, catalogo: x.catalogo, referencia: x.referencia, tipo: x.tipo,
          genero: GEN[x.genero_id] ?? '', color,
          nombre: `${x.catalogo} ${color}`.trim(),           // nombre completo de la variante (catálogo + color)
          foto: x.foto_main || x.foto_card, miniatura: x.foto_card || x.foto_main,
        };
      }),
    });
  }

  const { data: lista, error } = await supabase.from('catalogos_collage').select('*').is('eliminado_at', null).neq('tipo', 'auto').order('actualizado_at', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // ¿Quedó desactualizado? (foto distinta o prenda apagada en KLIXMANT)
  const ids = [...new Set((lista ?? []).flatMap((c: any) => (c.items ?? []).map((i: any) => i.id_item)))];
  const vivos = new Map<number, { foto: string; activo: boolean }>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase.from('vv_cat_productos').select('id_item, foto_main, foto_card, activo').in('id_item', ids.slice(i, i + 300));
    for (const x of (data ?? []) as any[]) vivos.set(x.id_item, { foto: x.foto_main || x.foto_card, activo: x.activo !== false });
  }
  // Familias: traer sus collages (imágenes) en el orden elegido
  const idsHijos = [...new Set((lista ?? []).flatMap((c: any) => (c.hijos ?? []) as string[]))];
  const hijos = new Map<string, any>();
  if (idsHijos.length) {
    const { data } = await supabase.from('catalogos_collage').select('id, nombre, imagen_url, imagenes, items').in('id', idsHijos).is('eliminado_at', null);
    for (const h of (data ?? []) as any[]) hijos.set(h.id, h);
  }
  return NextResponse.json({
    collages: (lista ?? []).map((c: any) => {
      if (c.tipo === 'familia') {
        const hs = ((c.hijos ?? []) as string[]).map(id => hijos.get(id)).filter(Boolean);
        return { ...c, hijos_det: hs.map((h: any) => ({ id: h.id, nombre: h.nombre, imagenes: h.imagenes?.length ? h.imagenes : [h.imagen_url].filter(Boolean), prendas: (h.items ?? []).length })), desactualizado: false, cambios: 0 };
      }
      const its = (c.items ?? []) as any[];
      const cambios = its.filter(i => { const v = vivos.get(i.id_item); return !v || !v.activo || v.foto !== i.foto; }).length;
      return { ...c, desactualizado: !!c.imagen_url && (cambios > 0 || c.firma !== firmaDe(its)), cambios };
    }),
  });
}

export async function POST(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const b = await req.json().catch(() => null);
  const nombre = String(b?.nombre ?? '').trim().slice(0, 120);
  if (!nombre) return NextResponse.json({ error: 'Ponle nombre al catálogo.' }, { status: 400 });
  const supabaseT = createServerSupabaseClient();
  // Familia = varios collages unidos en un solo catálogo (ej. NACIONAL)
  if (b?.tipo === 'familia') {
    const hijos = (Array.isArray(b.hijos) ? b.hijos : []).map((x: any) => String(x)).filter((x: string) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 60);
    if (!hijos.length) return NextResponse.json({ error: 'Escoge al menos un collage.' }, { status: 400 });
    const fila = { nombre, familia: String(b?.familia ?? nombre).slice(0, 60), tipo: 'familia', hijos, items: [], actualizado_at: new Date().toISOString() };
    const r = b.id ? await supabaseT.from('catalogos_collage').update(fila).eq('id', b.id).select('id').single()
      : await supabaseT.from('catalogos_collage').insert(fila).select('id').single();
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: r.data.id });
  }
  const items = (Array.isArray(b?.items) ? b.items : []).slice(0, 27).map((i: any) => ({
    id_item: Number(i.id_item) || null, nombre: String(i.nombre ?? '').trim().slice(0, 80), color: String(i.color ?? '').slice(0, 30),
    foto: String(i.foto ?? ''), referencia: String(i.referencia ?? '').slice(0, 40),
  })).filter((i: any) => i.foto.startsWith('https://'));
  const fila = { nombre, familia: String(b?.familia ?? '').trim().slice(0, 60) || null, items, actualizado_at: new Date().toISOString() };
  const supabase = createServerSupabaseClient();
  // Automático: uno por catálogo KLIXMANT (si ya existe, se actualiza el mismo)
  if (b?.tipo === 'auto' && Number(b?.id_catalogo)) {
    const idc = Number(b.id_catalogo);
    const { data: ya } = await supabase.from('catalogos_collage').select('id').eq('tipo', 'auto').eq('id_catalogo', idc).is('eliminado_at', null).maybeSingle();
    const r = ya ? await supabase.from('catalogos_collage').update(fila).eq('id', ya.id).select('id').single()
      : await supabase.from('catalogos_collage').insert({ ...fila, tipo: 'auto', id_catalogo: idc }).select('id').single();
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: r.data.id });
  }
  if (b?.id) {
    const { error } = await supabase.from('catalogos_collage').update(fila).eq('id', b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: b.id });
  }
  const { data, error } = await supabase.from('catalogos_collage').insert(fila).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const b = await req.json().catch(() => null);
  const imagenes = (Array.isArray(b?.imagenes) ? b.imagenes : [b?.imagen_url]).map((u: any) => String(u ?? '')).filter((u: string) => u.startsWith('https://')).slice(0, 4);
  if (!b?.id || !imagenes.length) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  const supabase = createServerSupabaseClient();
  const { data: c } = await supabase.from('catalogos_collage').select('items').eq('id', b.id).maybeSingle();
  if (!c) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  const ahora = new Date().toISOString();
  const { error } = await supabase.from('catalogos_collage').update({
    imagen_url: imagenes[0], imagenes, ancho: Number(b.ancho) || null, alto: Number(b.alto) || null,
    firma: typeof b.firma === 'string' && b.firma.length < 20000 ? b.firma : firmaDe((c.items ?? []) as any[]), generado_at: ahora, actualizado_at: ahora,
  }).eq('id', b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  const supabase = createServerSupabaseClient();
  await supabase.from('catalogos_collage').update({ eliminado_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ ok: true });
}

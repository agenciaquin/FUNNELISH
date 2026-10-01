import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { esVideo } from '@/lib/funnels';
import { optimizarImagen } from '@/lib/optimizar-imagen-servidor';
import { subirArchivo } from '@/lib/subir-archivo';

export const maxDuration = 300; // procesar varias fotos puede tardar
export const dynamic = 'force-dynamic';

/**
 * Optimiza (redimensiona + comprime a JPG) TODAS las fotos pesadas de un embudo,
 * para que la página de venta cargue rápido en celular. Sube versiones livianas
 * con nombre nuevo y apunta el embudo a ellas — las originales NO se borran.
 *
 * body: { slug }
 */
// LEY DE PESO: ya no hay lado ni calidad propios (antes 1080 px / q72, por debajo
// del mínimo de 1440 px de la ley). Manda el compresor: foto-web, 250 kB, por escalones.

/** Descarga, redimensiona y recomprime una foto. Devuelve la URL nueva o la misma si no valía la pena. */
async function optimizarUna(supabase: any, slug: string, url: string): Promise<{ nueva: string; antes: number; despues: number } | null> {
  if (!url || !url.startsWith('http') || esVideo(url)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const original = Buffer.from(await res.arrayBuffer());
    const tipoCont = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0];
    const img = await optimizarImagen(original, tipoCont, 'foto-web');
    if (!img.optimizada) return null;            // ya cabía (o es GIF/SVG): no se toca
    // Nivel 4 (no cupo): el compresor ya lo registró; se guarda la mejor versión si mejora la original.
    if (img.buffer.length >= original.length) return null; // no mejoró

    const r = await subirArchivo({
      supabase, bucket: 'chat-media', prefijo: `embudos-opt/${slug}`, buffer: img.buffer,
      contentType: img.contentType, tipo: 'foto-web', origen: 'optimizar-fotos',
    });
    if (!r.subido || !r.url) { console.error('[Optimizar] upload:', r.error); return null; }
    return { nueva: r.url, antes: original.length, despues: r.buffer.length };
  } catch (e) {
    console.error('[Optimizar] error con', url, e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const slug = String(b?.slug ?? '').trim();
  if (!slug) return NextResponse.json({ error: 'Falta el embudo.' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: f, error } = await supabase.from('funnels').select('*').eq('slug', slug).maybeSingle();
  if (error || !f) return NextResponse.json({ error: 'No se encontró el embudo.' }, { status: 404 });

  const parse = (v: any): any => { if (!v) return v; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return v; } };

  const imagenes: string[] = Array.isArray(parse(f.imagenes)) ? parse(f.imagenes) : [];
  const variantes: any[]   = Array.isArray(parse(f.variantes)) ? parse(f.variantes) : [];

  // Mapa URL vieja → URL nueva (para no reprocesar la misma foto dos veces).
  const cache = new Map<string, string>();
  let fotos = 0, ahorroBytes = 0;

  async function opt(url: string): Promise<string> {
    if (!url || cache.has(url)) return cache.get(url) ?? url;
    const r = await optimizarUna(supabase, slug, url);
    if (r) { cache.set(url, r.nueva); fotos++; ahorroBytes += (r.antes - r.despues); return r.nueva; }
    cache.set(url, url);
    return url;
  }

  // Galería principal
  const nuevaGaleria: string[] = [];
  for (const u of imagenes) nuevaGaleria.push(await opt(u));

  // Fotos dentro de variantes (imagen de la variante y de sus opciones con foto)
  for (const v of variantes) {
    if (v?.imagen) v.imagen = await opt(String(v.imagen));
    if (Array.isArray(v?.selectores)) {
      for (const s of v.selectores) {
        if (Array.isArray(s?.opciones)) {
          for (let i = 0; i < s.opciones.length; i++) {
            const o = s.opciones[i];
            if (o && typeof o === 'object' && o.imagen) o.imagen = await opt(String(o.imagen));
          }
        }
      }
    }
  }

  // Imágenes sueltas del embudo
  const banner   = f.imagen_banner   ? await opt(String(f.imagen_banner))   : f.imagen_banner;
  const clientes = f.imagen_clientes ? await opt(String(f.imagen_clientes)) : f.imagen_clientes;
  const detalle  = f.imagen_detalle  ? await opt(String(f.imagen_detalle))  : f.imagen_detalle;

  const { error: upErr } = await supabase.from('funnels').update({
    imagenes: nuevaGaleria,
    variantes,
    imagen_banner: banner,
    imagen_clientes: clientes,
    imagen_detalle: detalle,
  }).eq('slug', slug);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    fotos_optimizadas: fotos,
    ahorro_mb: Number((ahorroBytes / 1048576).toFixed(1)),
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Actualiza SOLO ajustes rápidos de un embudo (píxeles/tokens y modo de
 * confirmación) sin tener que abrir el editor completo. Se usa desde los
 * botones de la lista de embudos.
 *
 * body: { slug, pixel_meta?, pixel_meta_token?, pixel_tiktok?, pixel_tiktok_token?, confirmacion_modo? }
 * Solo se tocan los campos que vengan en el body.
 */
const MODOS = new Set(['bot', 'agente', 'humano']);

export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'body inválido' }, { status: 400 }); }

  const slug = String(b?.slug ?? '').trim();
  if (!slug) return NextResponse.json({ error: 'Falta el embudo (slug).' }, { status: 400 });

  const patch: Record<string, any> = {};
  const limpio = (v: any) => String(v ?? '').trim() || null;

  if ('pixel_meta'         in b) patch.pixel_meta         = limpio(b.pixel_meta);
  if ('pixel_meta_token'   in b) patch.pixel_meta_token   = limpio(b.pixel_meta_token);
  if ('pixel_tiktok'       in b) patch.pixel_tiktok       = limpio(b.pixel_tiktok);
  if ('pixel_tiktok_token' in b) patch.pixel_tiktok_token = limpio(b.pixel_tiktok_token);
  if ('confirmacion_modo'  in b) {
    const m = String(b.confirmacion_modo ?? 'bot').trim();
    patch.confirmacion_modo = MODOS.has(m) ? m : 'bot';
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No hay nada que actualizar.' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('funnels').update(patch).eq('slug', slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

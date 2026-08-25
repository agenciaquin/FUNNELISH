import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { r2Configurado, r2PresignPut, r2PublicUrl } from '@/lib/r2';

/**
 * Crea un enlace firmado para que el navegador suba el archivo DIRECTO al
 * almacenamiento, sin pasar por el servidor. Así se evita el tope de ~4.5 MB
 * que Vercel impone a las funciones, y se pueden subir videos grandes.
 *
 * Si R2 está configurado (variables R2_*), usa Cloudflare R2 (ancho de banda
 * gratis). Si no, cae de vuelta a Supabase Storage. La respuesta trae `mode`
 * para que el navegador sepa cómo subir.
 */
export async function POST(req: NextRequest) {
  try {
    const { slug, ext } = await req.json();
    const limpio = String(ext ?? 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const ruta = `embudos/${String(slug ?? 'general')}/media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${limpio}`;

    // ── R2 (preferido): URL prefirmada PUT ──────────────────────────────────
    if (r2Configurado()) {
      return NextResponse.json({
        mode: 'r2',
        uploadUrl: r2PresignPut(ruta, 3600),
        publicUrl: r2PublicUrl(ruta),
        path: ruta,
      });
    }

    // ── Supabase (respaldo) ─────────────────────────────────────────────────
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.storage
      .from('chat-media').createSignedUploadUrl(ruta);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(ruta);
    return NextResponse.json({
      mode: 'supabase',
      path: data.path,
      token: data.token,
      publicUrl: pub?.publicUrl,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

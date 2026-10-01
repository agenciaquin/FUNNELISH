import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { CACHE_UN_ANO, optimizarImagen } from '@/lib/optimizar-imagen-servidor';

export const maxDuration = 60;

/** Sube una foto del embudo y devuelve su enlace público. */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const slug = String(form.get('slug') ?? 'general');

    if (!file) return NextResponse.json({ error: 'No llegó ninguna imagen.' }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen no puede pesar más de 8 MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Se comprime aquí y no solo en el navegador: así queda cubierta cualquier
    // subida, venga del panel, de una integración o de una llamada suelta.
    const img = await optimizarImagen(buffer, file.type);

    const ruta = `embudos/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${img.ext}`;

    const supabase = createServerSupabaseClient();
    const { error } = await supabase.storage
      .from('chat-media')
      .upload(ruta, img.buffer, {
        contentType: img.contentType,
        cacheControl: CACHE_UN_ANO,
        upsert: false,
      });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(ruta);
    return NextResponse.json({ ok: true, url: pub?.publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

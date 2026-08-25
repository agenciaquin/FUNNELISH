import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { r2Configurado, r2Subir } from '@/lib/r2';

export const maxDuration = 120;

/** Sube el video de portada de un embudo y devuelve su enlace público. */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const slug = String(form.get('slug') ?? 'general');

    if (!file) return NextResponse.json({ error: 'No llegó ningún video.' }, { status: 400 });
    if (!file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'El archivo debe ser un video (mp4, webm, mov…).' }, { status: 400 });
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'El video no puede pesar más de 50 MB. Recórtalo o bájale la calidad.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.type.split('/')[1] || 'mp4').replace('quicktime', 'mov');
    const ruta = `embudos/${slug}/video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

    // ── R2 (preferido) ──────────────────────────────────────────────────────
    if (r2Configurado()) {
      const url = await r2Subir(ruta, buffer, file.type);
      return NextResponse.json({ ok: true, url });
    }

    // ── Supabase (respaldo) ─────────────────────────────────────────────────
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.storage
      .from('chat-media').upload(ruta, buffer, { contentType: file.type, upsert: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(ruta);
    return NextResponse.json({ ok: true, url: pub?.publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Guarda el JPG del collage (armado en el navegador) tal cual, sin recomprimir. */
export async function POST(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const fd = await req.formData().catch(() => null);
  const f = fd?.get('file');
  const id = String(fd?.get('id') ?? '').replace(/[^a-z0-9-]/gi, '');
  if (!(f instanceof Blob) || !id) return NextResponse.json({ error: 'Falta la imagen' }, { status: 400 });
  if (f.size > 4_000_000) return NextResponse.json({ error: 'La imagen pesa demasiado' }, { status: 413 });
  const supabase = createServerSupabaseClient();
  // JPG del collage/portada, o una foto que el dueño sube para la portada (png/jpg/webp)
  const tipo = /^image\/(png|jpeg|webp)$/.test(f.type) ? f.type : 'image/jpeg';
  const ext = tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg';
  const ruta = `collages/${id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('chat-media').upload(ruta, Buffer.from(await f.arrayBuffer()), { contentType: tipo, upsert: false, cacheControl: '31536000' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: supabase.storage.from('chat-media').getPublicUrl(ruta).data.publicUrl });
}

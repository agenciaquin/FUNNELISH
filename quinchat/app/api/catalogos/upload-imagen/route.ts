import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { CACHE_UN_ANO, optimizarImagen } from '@/lib/optimizar-imagen-servidor';

export const maxDuration = 60; // sharp necesita margen con fotos grandes

const BUCKET = 'catalogo-imagenes';

/** POST /api/catalogos/upload-imagen — sube foto al Storage de Supabase */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Las fotos de catálogo acaban enviándose por WhatsApp, así que el optimizador
  // solo devuelve JPEG o PNG — nunca WebP, que Meta no entrega.
  const img = await optimizarImagen(buffer, file.type);

  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${img.ext}`;

  const opciones = {
    contentType: img.contentType,
    cacheControl: CACHE_UN_ANO,
    upsert: false,
  };

  // Subir al bucket
  let { data, error } = await supabase.storage.from(BUCKET).upload(name, img.buffer, opciones);

  // Si el bucket no existe, crearlo y reintentar
  if (error && (error.message.includes('not found') || error.message.includes('Bucket'))) {
    await supabase.storage.createBucket(BUCKET, { public: true });
    const retry = await supabase.storage.from(BUCKET).upload(name, img.buffer, opciones);
    data  = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data!.path);

  return NextResponse.json({ url: publicUrl });
}

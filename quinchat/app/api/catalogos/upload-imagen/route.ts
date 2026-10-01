import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import type { TipoArchivo } from '@/lib/ley-peso';
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
  // LEY DE PESO: foto de catálogo (250 kB) o, si el panel lo indica, gráfico con texto (400 kB).
  const tipo: TipoArchivo = String(formData.get('tipo') ?? '') === 'grafico-texto' ? 'grafico-texto' : 'foto-web';
  const img = await optimizarImagen(buffer, file.type, tipo);
  // LEY §1 punto 4: el peso NO rechaza. Solo lo técnicamente imposible (archivo dañado
  // o que no es una imagen). Si no cabe se guarda la mejor y se devuelve un `aviso`
  // visible pero no bloqueante.
  if (img.fallo) {
    return NextResponse.json({ error: 'No se pudo leer la imagen: el archivo está dañado o no es una imagen. Expórtala de nuevo como JPG o PNG e inténtalo otra vez.', codigo: 'ILEGIBLE' }, { status: 422 });
  }

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

  return NextResponse.json({ url: publicUrl, nivel: img.nivel, aviso: img.aviso });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { CACHE_UN_ANO, optimizarImagen } from '@/lib/optimizar-imagen-servidor';

/**
 * Foto asociada a una plantilla de WhatsApp.
 *
 * Meta solo usa la imagen que subes al crear la plantilla como ejemplo para
 * aprobarla; en cada envío hay que mandarle una foto real. Aquí se guarda esa
 * foto una vez y se reutiliza en todos los envíos, para no tener que pegar
 * enlaces a mano.
 */

export const maxDuration = 60; // sharp necesita margen con fotos grandes

const clavePara = (nombre: string) => `plantilla_img_${nombre}`;

export async function GET(req: NextRequest) {
  const nombre = req.nextUrl.searchParams.get('nombre');
  if (!nombre) return NextResponse.json({ url: null });

  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from('configuracion').select('valor').eq('clave', clavePara(nombre)).maybeSingle();

  return NextResponse.json({ url: data?.valor ?? null });
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, imagenBase64, imagenMime } = await req.json();
    if (!nombre || !imagenBase64) {
      return NextResponse.json({ error: 'Falta la plantilla o la imagen.' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const buffer = Buffer.from(String(imagenBase64).split(',').pop() ?? '', 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen no puede pesar más de 5 MB.' }, { status: 400 });
    }

    const mime = String(imagenMime || 'image/jpeg');

    // Esta foto se manda a Meta en cada envío, así que el optimizador solo puede
    // devolver JPEG o PNG. Nunca WebP: Meta lo acepta pero no entrega el mensaje.
    const img = await optimizarImagen(buffer, mime);

    const ruta = `plantillas/${nombre}-${Date.now()}.${img.ext}`;

    const { error: upErr } = await supabase.storage
      .from('chat-media')
      .upload(ruta, img.buffer, {
        contentType: img.contentType,
        cacheControl: CACHE_UN_ANO,
        upsert: true,
      });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(ruta);
    const url = pub?.publicUrl;
    if (!url) return NextResponse.json({ error: 'No se pudo obtener el enlace.' }, { status: 500 });

    await supabase.from('configuracion').upsert(
      { clave: clavePara(nombre), valor: url, actualizado_at: new Date().toISOString() },
      { onConflict: 'clave' }
    );

    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

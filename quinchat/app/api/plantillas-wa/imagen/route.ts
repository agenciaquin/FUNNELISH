import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { formatearPeso } from '@/lib/ley-peso';
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

/** Meta no acepta imágenes de más de 5 MB: límite externo, no de la LEY. */
const LIMITE_META = 5 * 1024 * 1024;

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
    // LEY DE PESO: foto-whatsapp (250 kB). El peso NO rechaza (LEY §1 punto 4): si no
    // cabe se guarda la mejor versión y se devuelve un `aviso`. Solo se rechaza lo que
    // Meta no puede recibir y no se puede arreglar aquí.
    const img = await optimizarImagen(buffer, mime, 'foto-whatsapp');
    if (img.fallo) {
      return NextResponse.json({ error: 'No se pudo leer la imagen: el archivo está dañado o no es una imagen. Expórtala de nuevo como JPG o PNG e inténtalo otra vez.', codigo: 'ILEGIBLE' }, { status: 422 });
    }
    if (img.contentType !== 'image/jpeg' && img.contentType !== 'image/png') {
      return NextResponse.json({ error: 'WhatsApp solo admite imágenes JPG o PNG. Convierte la imagen a uno de esos formatos y vuelve a subirla.', codigo: 'FORMATO' }, { status: 415 });
    }
    if (img.buffer.length > LIMITE_META) {
      return NextResponse.json({ error: `Meta no admite imágenes de más de 5 MB y esta pesa ${formatearPeso(img.buffer.length)} incluso comprimida. Recórtala o usa una versión más pequeña.`, codigo: 'LIMITE_META' }, { status: 413 });
    }

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

    return NextResponse.json({ ok: true, url, nivel: img.nivel, aviso: img.aviso });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

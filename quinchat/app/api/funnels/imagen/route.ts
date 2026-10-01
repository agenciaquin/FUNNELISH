import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import type { TipoArchivo } from '@/lib/ley-peso';
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
    // LEY DE PESO: foto de landing (250 kB). Si el panel avisa de que es un
    // gráfico con texto (banner, promo), el tope es el de los gráficos (400 kB).
    const tipo: TipoArchivo = String(form.get('tipo') ?? '') === 'grafico-texto' ? 'grafico-texto' : 'foto-web';
    const img = await optimizarImagen(buffer, file.type, tipo);
    // LEY §1 punto 4: el peso NO rechaza. Solo se rechaza lo técnicamente imposible
    // (archivo dañado o que no es una imagen). Si no cabe se guarda la mejor versión y
    // se devuelve un `aviso` visible pero no bloqueante.
    if (img.fallo) {
      return NextResponse.json({ error: 'No se pudo leer la imagen: el archivo está dañado o no es una imagen. Expórtala de nuevo como JPG o PNG e inténtalo otra vez.', codigo: 'ILEGIBLE' }, { status: 422 });
    }

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
    return NextResponse.json({ ok: true, url: pub?.publicUrl, nivel: img.nivel, aviso: img.aviso });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

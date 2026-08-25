import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/**
 * Foto asociada a una plantilla de WhatsApp.
 *
 * Meta solo usa la imagen que subes al crear la plantilla como ejemplo para
 * aprobarla; en cada envío hay que mandarle una foto real. Aquí se guarda esa
 * foto una vez y se reutiliza en todos los envíos, para no tener que pegar
 * enlaces a mano. Se guarda POR empresa (configuracion con clave por tenant).
 */

const clavePara = (nombre: string) => `plantilla_img_${nombre}`;

export async function GET(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ url: null });

  const nombre = req.nextUrl.searchParams.get('nombre');
  if (!nombre) return NextResponse.json({ url: null });

  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from('configuracion').select('valor')
    .eq('tenant_id', tid).eq('clave', clavePara(nombre)).maybeSingle();

  return NextResponse.json({ url: data?.valor ?? null });
}

export async function POST(req: NextRequest) {
  try {
    const tid = await tenantActual();
    if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

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
    const ext  = mime.includes('png') ? 'png' : 'jpg';
    // Carpeta por tenant para no mezclar archivos entre clientes.
    const ruta = `plantillas/${tid}/${nombre}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('chat-media').upload(ruta, buffer, { contentType: mime, upsert: true });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(ruta);
    const url = pub?.publicUrl;
    if (!url) return NextResponse.json({ error: 'No se pudo obtener el enlace.' }, { status: 500 });

    await supabase.from('configuracion').upsert(
      { tenant_id: tid, clave: clavePara(nombre), valor: url, actualizado_at: new Date().toISOString() },
      { onConflict: 'tenant_id,clave' }
    );

    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

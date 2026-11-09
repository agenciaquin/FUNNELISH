import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import {
  PLANTILLA_OFICINA, CUERPO_OFICINA, BOTONES_OFICINA, ajustesOficina, guardarAjustesOficina, estadoPlantillaOficina,
  crearPlantillaOficina, marcarPrevios, procesarAvisosOficina, completarRespuestas, guiasEnOficina,
} from '@/lib/aviso-oficina';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Aviso «Pedido listo para reclamar» (Panel de Novedades).
 *  GET                         → ajustes + estado de la plantilla en Meta + registro de avisos (con respuestas)
 *  POST multipart {file, solo_media?} → crea la plantilla en Meta (o solo cambia la imagen/video de los envíos)
 *  PATCH {accion:'activar'|'desactivar'|'pasada'|'enviar', ids?}
 */
export async function GET() {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const supabase = createServerSupabaseClient();
  const [cfg, tpl] = await Promise.all([ajustesOficina(supabase), estadoPlantillaOficina()]);
  const { data } = await supabase.from('avisos_oficina').select('*').order('creado_at', { ascending: false }).limit(150);
  const filas = await completarRespuestas(supabase, data ?? []);
  const cuenta = (e: string) => filas.filter((f: any) => f.estado === e).length;
  let enOficina = 0;
  try { enOficina = (await guiasEnOficina(supabase, cfg.vendedores)).length; } catch { /* nada */ }
  return NextResponse.json({
    ajustes: cfg, plantilla: { nombre: PLANTILLA_OFICINA, cuerpo: CUERPO_OFICINA, botones: BOTONES_OFICINA, ...tpl },
    avisos: filas, en_oficina: enOficina,
    contadores: { enviado: cuenta('enviado'), respondieron: filas.filter((f: any) => f.respuesta).length, previo: cuenta('previo'), error: cuenta('error'), omitido: cuenta('omitido') },
  });
}

export async function POST(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Falta la imagen o el video.' }, { status: 400 });
  const mime = String((file as any).type || '');
  if (mime === 'image/gif') return NextResponse.json({ error: 'Meta no acepta GIF en las plantillas. Conviértelo a video MP4 (por ejemplo en ezgif.com → GIF to MP4) y súbelo.' }, { status: 400 });
  if (!['image/jpeg', 'image/png', 'video/mp4'].includes(mime)) return NextResponse.json({ error: 'Sube una imagen JPG o PNG, o un video MP4.' }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 4 * 1024 * 1024) return NextResponse.json({ error: 'El archivo no puede pasar de 4 MB.' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  // 1) Se guarda para los envíos (Meta pide un enlace público en cada mensaje)
  const ext = mime === 'video/mp4' ? 'mp4' : mime === 'image/png' ? 'png' : 'jpg';
  const ruta = `plantillas/${PLANTILLA_OFICINA}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('chat-media').upload(ruta, buf, { contentType: mime, cacheControl: '31536000', upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const url = supabase.storage.from('chat-media').getPublicUrl(ruta).data?.publicUrl;
  if (!url) return NextResponse.json({ error: 'No se pudo obtener el enlace del archivo.' }, { status: 500 });
  const media_tipo = mime === 'video/mp4' ? 'VIDEO' : 'IMAGE';

  if (form?.get('solo_media')) {
    const tpl = await estadoPlantillaOficina();
    if (tpl.formato && tpl.formato !== media_tipo) return NextResponse.json({ error: `La plantilla aprobada lleva ${tpl.formato === 'VIDEO' ? 'video' : 'imagen'}: sube un archivo del mismo tipo.` }, { status: 400 });
    await guardarAjustesOficina(supabase, { media_url: url, media_tipo });
    return NextResponse.json({ ok: true, url });
  }

  // 2) Crear la plantilla en Meta (si ya existe, Meta lo dice y no se duplica)
  const ya = await estadoPlantillaOficina();
  if (ya.status) return NextResponse.json({ error: `La plantilla ya existe en Meta (${ya.status}). Si quieres cambiar la imagen de los envíos usa «Cambiar imagen».` }, { status: 409 });
  const r = await crearPlantillaOficina(buf, mime);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  await guardarAjustesOficina(supabase, { media_url: url, media_tipo, plantilla_creada_at: new Date().toISOString() });
  return NextResponse.json({ ok: true, status: r.status, sin_emoji: r.sin_emoji ?? false });
}

export async function PATCH(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const b = await req.json().catch(() => ({}));
  const supabase = createServerSupabaseClient();
  const cfg = await ajustesOficina(supabase);

  if (b?.accion === 'desactivar') {
    await guardarAjustesOficina(supabase, { activo: false });
    return NextResponse.json({ ok: true });
  }
  if (b?.accion === 'activar') {
    const tpl = await estadoPlantillaOficina();
    if (tpl.status !== 'APPROVED') return NextResponse.json({ error: `Meta aún no aprueba la plantilla (${tpl.status ?? 'no creada'}). No se activa.` }, { status: 400 });
    if (!cfg.media_url) return NextResponse.json({ error: 'Falta la imagen o el video del encabezado.' }, { status: 400 });
    const previos = await marcarPrevios(supabase, cfg.vendedores);
    await guardarAjustesOficina(supabase, { activo: true, desde: new Date().toISOString() });
    return NextResponse.json({ ok: true, previos });
  }
  if (b?.accion === 'pasada') return NextResponse.json(await procesarAvisosOficina(supabase));
  if (b?.accion === 'enviar') {
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, 10);
    if (!ids.length) return NextResponse.json({ error: 'Elige a quién mandar.' }, { status: 400 });
    return NextResponse.json(await procesarAvisosOficina(supabase, ids, 10));
  }
  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
}

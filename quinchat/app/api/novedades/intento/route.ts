import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import {
  PLANTILLA_INTENTO, CUERPO_INTENTO, ajustesIntento, guardarAjustesIntento, estadoPlantillaIntento, crearPlantillaIntento,
  marcarPreviosIntento, procesarAvisosIntento, completarRespuestasIntento, novedadesEnIntento,
} from '@/lib/aviso-intento';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Aviso «Intento de entrega» (Panel de Novedades). Misma forma que /api/novedades/oficina.
 *  GET  → ajustes + estado de la plantilla en Meta + registro (con respuestas)
 *  POST → crea la plantilla `novedad_intento_entrega` en Meta (UTILIDAD, texto exacto del dueño)
 *  PATCH {accion:'activar'|'desactivar'|'pasada'|'enviar', ids?(claves)}
 */
export async function GET() {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const supabase = createServerSupabaseClient();
  const [cfg, tpl] = await Promise.all([ajustesIntento(supabase), estadoPlantillaIntento()]);
  const { data } = await supabase.from('avisos_intento').select('*').order('creado_at', { ascending: false }).limit(150);
  const filas = await completarRespuestasIntento(supabase, data ?? []);
  const cuenta = (e: string) => filas.filter((f: any) => f.estado === e).length;
  let enNovedad = 0;
  try { enNovedad = (await novedadesEnIntento(supabase)).length; } catch { /* nada */ }
  return NextResponse.json({
    ajustes: cfg, plantilla: { nombre: PLANTILLA_INTENTO, cuerpo: CUERPO_INTENTO, botones: [], ...tpl },
    // en la tabla, «motivo» muestra el detalle del envío (como en el aviso de oficina)
    avisos: filas.map((f: any) => ({ ...f, novedad: f.motivo, motivo: f.detalle })), en_novedad: enNovedad,
    contadores: { enviado: cuenta('enviado'), respondieron: filas.filter((f: any) => f.respuesta).length, previo: cuenta('previo'), error: cuenta('error'), omitido: cuenta('omitido') },
  });
}

export async function POST() {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const supabase = createServerSupabaseClient();
  const ya = await estadoPlantillaIntento();
  if (ya.status) return NextResponse.json({ error: `La plantilla ya existe en Meta (${ya.status}).` }, { status: 409 });
  const r = await crearPlantillaIntento();
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  await guardarAjustesIntento(supabase, { plantilla_creada_at: new Date().toISOString() });
  return NextResponse.json({ ok: true, status: r.status });
}

export async function PATCH(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const b = await req.json().catch(() => ({}));
  const supabase = createServerSupabaseClient();
  if (b?.accion === 'desactivar') { await guardarAjustesIntento(supabase, { activo: false }); return NextResponse.json({ ok: true }); }
  if (b?.accion === 'activar') {
    const tpl = await estadoPlantillaIntento();
    if (tpl.status !== 'APPROVED') return NextResponse.json({ error: `Meta aún no aprueba la plantilla (${tpl.status ?? 'no creada'}). No se activa.` }, { status: 400 });
    const previos = await marcarPreviosIntento(supabase);
    await guardarAjustesIntento(supabase, { activo: true, desde: new Date().toISOString() });
    return NextResponse.json({ ok: true, previos });
  }
  if (b?.accion === 'pasada') return NextResponse.json(await procesarAvisosIntento(supabase));
  if (b?.accion === 'enviar') {
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, 10);
    if (!ids.length) return NextResponse.json({ error: 'Elige a quién mandar.' }, { status: 400 });
    return NextResponse.json(await procesarAvisosIntento(supabase, ids, 10));
  }
  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
}

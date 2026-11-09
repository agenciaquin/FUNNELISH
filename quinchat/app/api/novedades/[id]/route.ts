import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ESTADOS = ['nueva', 'pendiente', 'en_gestion', 'solucionada'] as const;
const NOMBRE: Record<string, string> = { nueva: 'Nueva', pendiente: 'Pendiente', en_gestion: 'En gestión', solucionada: 'Solucionada' };

/** GET → novedad completa + historial.  PATCH {estado?, nota?, visto?} → cambia el estado de GESTIÓN del equipo (no toca Effi). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { data: n } = await supabase.from('novedades_effi').select('*').eq('id', Number(id)).maybeSingle();
  if (!n) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  const { data: h } = await supabase.from('novedades_effi_historial').select('id, at, tipo, detalle, por').eq('novedad_id', n.id).order('at', { ascending: false }).limit(300);
  // Todas las novedades que Effi registró para esta guía («Logística → Novedades de guías»), la más reciente primero
  const { data: ne } = await supabase.from('effi_novedades_api').select('id_novedad, datos').eq('id_guia', n.id_guia_effi).limit(30);
  const novedadesEffi = (ne ?? []).map((r: any) => {
    const d = r.datos ?? {};
    return {
      id: r.id_novedad, codigo: d.id_novedad ?? null, nombre: d.nombre_novedad ?? null, tipo: d.tipo_novedad ?? null,
      aclaracion: d.aclaracion ?? null, estado: d.estado_novedad ?? null, gestiones: d.cant_gestion ?? null,
      fecha_transportadora: d.fecha_trans_transportadora ?? null, fecha_effi: d.fecha_trans ?? null,
      fecha_solucion: d.fecha_solucion ?? null, fecha_ultima_gestion: d.fecha_ultima_gestion ?? null,
      guia_novedad: d.guia_novedad ?? d.guia ?? null, foto: d.url_foto ?? null, servicio: d.servicio ?? null,
      flete: d.valor_flete ?? null, transportadora: d.nombre_transportadora_efficommerce ?? d.nombre_transportadora ?? null,
    };
  }).sort((a: any, b: any) => Number(b.id) - Number(a.id));
  // Avisos de texto enviados a este cliente con TODO lo que respondió (fotos de recibos, referencias…)
  const { AVISOS_TEXTO } = await import('@/lib/avisos-texto-registro');
  const avisos: any[] = [];
  for (const { srv } of AVISOS_TEXTO) {
    const { data: fs } = await supabase.from(srv.cfg.tabla).select('*').eq('id_guia_effi', n.id_guia_effi).order('creado_at', { ascending: false }).limit(5);
    for (const f of await srv.completarRespuestas(supabase, fs ?? [])) avisos.push({ ...f, tipo: srv.cfg.nombreCorto });
  }
  return NextResponse.json({ novedad: n, historial: h ?? [], novedades_effi: novedadesEffi, avisos });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const supabase = createServerSupabaseClient();
  const { data: n } = await supabase.from('novedades_effi').select('id, estado, visto_at').eq('id', Number(id)).maybeSingle();
  if (!n) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  const ahora = new Date().toISOString();
  const upd: Record<string, any> = {};
  const hist: { tipo: string; detalle: string }[] = [];

  // Al abrirla por primera vez: deja de ser «nueva» y pasa a «pendiente»
  if (b?.visto && !n.visto_at) {
    upd.visto_at = ahora;
    if (n.estado === 'nueva') { upd.estado = 'pendiente'; upd.estado_cambio_at = ahora; hist.push({ tipo: 'estado', detalle: 'Vista por el equipo: Nueva → Pendiente' }); }
  }
  if (b?.estado && (ESTADOS as readonly string[]).includes(b.estado) && b.estado !== (upd.estado ?? n.estado)) {
    const antes = upd.estado ?? n.estado;
    upd.estado = b.estado; upd.estado_cambio_at = ahora; upd.visto_at = upd.visto_at ?? n.visto_at ?? ahora;
    if (b.estado === 'solucionada') { upd.solucionada_at = ahora; upd.resultado = 'equipo'; } else { upd.solucionada_at = null; upd.resultado = null; }
    hist.push({ tipo: 'estado', detalle: `${NOMBRE[antes] ?? antes} → ${NOMBRE[b.estado]}` });
  }
  // Dirección corregida (dirección incompleta / no localizada). Se guarda aquí; Effi NO se modifica: se confirma y se copia.
  if (typeof b?.direccion_corregida === 'string') {
    const dir = b.direccion_corregida.replace(/\s+/g, ' ').trim().slice(0, 500);
    upd.direccion_corregida = dir || null; upd.direccion_corregida_at = ahora; upd.direccion_corregida_por = auth.quien;
    upd.direccion_confirmada = !!b.confirmar_direccion && !!dir;
    hist.push({ tipo: 'nota', detalle: b.confirmar_direccion && dir ? `🏠 Dirección CONFIRMADA (pendiente de pasar a Effi / transportadora): ${dir}` : `🏠 Dirección corregida (borrador): ${dir || '—'}` });
  }
  const nota = String(b?.nota ?? '').trim().slice(0, 2000);
  if (nota) hist.push({ tipo: 'nota', detalle: nota });
  if (!Object.keys(upd).length && !hist.length) return NextResponse.json({ ok: true });
  if (Object.keys(upd).length) {
    upd.actualizado_at = ahora;
    const { error } = await supabase.from('novedades_effi').update(upd).eq('id', n.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (hist.length) await supabase.from('novedades_effi_historial').insert(hist.map(h => ({ novedad_id: n.id, tipo: h.tipo, detalle: h.detalle, por: auth.quien })));
  return NextResponse.json({ ok: true });
}

/** POST {tipo:'oficina'|'intento'|'direccion'|'incompleta'} → manda YA el aviso a este cliente (con la plantilla aprobada; una sola vez). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const supabase = createServerSupabaseClient();
  const { data: n } = await supabase.from('novedades_effi').select('id, id_guia_effi, id_novedad_effi').eq('id', Number(id)).maybeSingle();
  if (!n) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  if (b?.tipo === 'oficina') {
    const { procesarAvisosOficina } = await import('@/lib/aviso-oficina');
    const r: any = await procesarAvisosOficina(supabase, [String(n.id_guia_effi)], 1, { ignorarInterruptor: true });
    if (r.enviados) return NextResponse.json({ ok: true, mensaje: '✅ Aviso de oficina enviado.' });
    const { data: f } = await supabase.from('avisos_oficina').select('estado, motivo').eq('id_guia_effi', n.id_guia_effi).maybeSingle();
    return NextResponse.json({ ok: false, error: r.error ?? (f?.estado === 'enviado' ? 'Ya se le había enviado.' : f?.motivo) ?? 'Esta guía ya no está en oficina en Effi.' }, { status: 400 });
  }
  const { avisoTextoDe } = await import('@/lib/avisos-texto-registro');
  const av = avisoTextoDe(b?.tipo);
  if (av) {
    const srv = av.srv;
    const caso = (await srv.novedadesEnCaso(supabase)).find((x: any) => x.id === n.id);
    if (!caso) return NextResponse.json({ ok: false, error: `La novedad ya no es de «${srv.cfg.nombreCorto}».` }, { status: 400 });
    const r: any = await srv.procesar(supabase, [caso.clave], 1, { ignorarInterruptor: true });
    if (r.enviados) return NextResponse.json({ ok: true, mensaje: `✅ Aviso de ${srv.cfg.nombreCorto.toLowerCase()} enviado.` });
    const { data: f } = await supabase.from(srv.cfg.tabla).select('estado, detalle').eq('clave', caso.clave).maybeSingle();
    return NextResponse.json({ ok: false, error: r.error ?? (f?.estado === 'enviado' ? 'Ya se le había enviado.' : f?.detalle) ?? 'No se pudo enviar.' }, { status: 400 });
  }
  return NextResponse.json({ error: 'Tipo de aviso desconocido' }, { status: 400 });
}

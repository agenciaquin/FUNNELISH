import { NextRequest, NextResponse, after } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sincronizarSiToca } from '@/lib/novedades-effi';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * PANEL DE NOVEDADES (09-nov-2026) — módulo independiente.
 *  GET            → novedades (abiertas + solucionadas de los últimos 30 días) + contadores + última sincronización
 *  POST {forzar?} → sincroniza con Effi si toca (cada 10 min de Effi, cada 2 min de la copia); forzar = traer de Effi ya
 */
export async function GET() {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const supabase = createServerSupabaseClient();
  const hace30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data, error } = await supabase.from('novedades_effi')
    .select('id, id_guia_effi, id_novedad_effi, novedad_texto, guia, transportadora, id_remision, vendedor, cliente, telefono, telefono_original, ciudad, departamento, producto, talla, foto, valor_recaudo, estado_effi, estado_effi_comercio, motivo, estado, resultado, activa_en_effi, fecha_guia, detectada_at, visto_at, estado_cambio_at, solucionada_at')
    .or(`estado.neq.solucionada,solucionada_at.gte.${hace30}`)
    .order('detectada_at', { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const lista: any[] = data ?? [];
  // Avisos automáticos de cada tarjeta (oficina / intento de entrega): enviado, respuesta o si aún se puede mandar
  const ids = lista.map(n => n.id_guia_effi);
  const ao = new Map<string, any>(), ai = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 300) {
    const lote = ids.slice(i, i + 300);
    const [{ data: o }, { data: it }] = await Promise.all([
      supabase.from('avisos_oficina').select('id_guia_effi, estado, enviado_at, respuesta, respuesta_at, motivo').in('id_guia_effi', lote),
      supabase.from('avisos_intento').select('id_guia_effi, clave, estado, enviado_at, respuesta, respuesta_at, detalle, creado_at').in('id_guia_effi', lote).order('creado_at', { ascending: false }),
    ]);
    for (const r of o ?? []) ao.set(String(r.id_guia_effi), r);
    for (const r of it ?? []) if (!ai.has(String(r.id_guia_effi))) ai.set(String(r.id_guia_effi), r);
  }
  for (const n of lista) {
    const est = `${n.estado_effi ?? ''} ${n.estado_effi_comercio ?? ''}`;
    n.aplica_oficina = n.activa_en_effi && /inter/i.test(String(n.transportadora ?? '')) && /reclame en oficina|retiro en oficina/i.test(est);
    n.aplica_intento = n.activa_en_effi && (/intento de entrega/i.test(est) || /^701 -|se visita, no se logra entrega/i.test(String(n.novedad_texto ?? '')));
    n.aviso_oficina = ao.get(String(n.id_guia_effi)) ?? null;
    n.aviso_intento = ai.get(String(n.id_guia_effi)) ?? null;
  }
  const cuenta = (e: string) => lista.filter((n: any) => n.estado === e).length;
  const { data: sync } = await supabase.from('novedades_effi_sync').select('origen, inicio, fin, ok, error, novedades_effi, error_novedades').not('fin', 'is', null).order('inicio', { ascending: false }).limit(1).maybeSingle();
  const { data: syncEffi } = await supabase.from('novedades_effi_sync').select('inicio, ok').like('origen', '%:effi').eq('ok', true).order('inicio', { ascending: false }).limit(1).maybeSingle();
  return NextResponse.json({
    novedades: lista,
    contadores: { todas: lista.length, nueva: cuenta('nueva'), pendiente: cuenta('pendiente'), en_gestion: cuenta('en_gestion'), solucionada: cuenta('solucionada') },
    ultima_sync: sync ?? null, ultima_effi: syncEffi?.inicio ?? null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const b = await req.json().catch(() => ({}));
  const r = await sincronizarSiToca(`panel:${auth.quien}`.slice(0, 60), !!b?.forzar);
  // Aviso «Intento de entrega»: si está encendido y hubo sincronización, se revisa DESPUÉS de responder (no frena el panel)
  if (!(r as any).omitida) after(async () => {
    try { const { procesarAvisosIntento } = await import('@/lib/aviso-intento'); await procesarAvisosIntento(undefined, undefined, 5); }
    catch (e) { console.error('[Novedades] aviso intento:', e); }
  });
  return NextResponse.json(r, { status: (r as any).ok === false ? 502 : 200 });
}

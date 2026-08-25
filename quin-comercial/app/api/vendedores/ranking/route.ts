import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { VENDEDORES, LIMITE_INCENTIVO_SEG, CONCURSO_INICIO } from '@/lib/vendedores';
import { tenantActual } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/** Fecha YYYY-MM-DD en hora Colombia (UTC-5). */
function fechaColombia(offsetDias = 0): string {
  const t = Date.now() - 5 * 3_600_000 + offsetDias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Ranking de vendedores. Acepta un RANGO de fechas:
 *   ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD   (para las nóminas: 1–10, 11–20, 21–fin)
 *   ?fecha=YYYY-MM-DD                    (un solo día)
 * Por defecto: hoy en Colombia.
 *
 * En un rango, "ventas" es el ACUMULADO del periodo (suma de los cierres diarios)
 * y el promedio de respuesta se calcula sobre TODO el rango (= la nómina).
 */
export async function GET(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const hoy = fechaColombia(0);
  const desde = sp.get('desde') || sp.get('fecha') || hoy;
  const hasta = sp.get('hasta') || sp.get('fecha') || hoy;
  const supabase = createServerSupabaseClient();

  // ── Reportes en el rango → acumulado por vendedor ───────────────────────────
  const { data: reps } = await supabase
    .from('vendedor_reportes').select('telefono, ventas, actualizado_at, fecha')
    .eq('tenant_id', tid)
    .gte('fecha', desde).lte('fecha', hasta);
  const ventasPorTel = new Map<string, { ventas: number; actualizado_at: string }>();
  for (const r of reps ?? []) {
    const tel = String((r as any).telefono);
    const prev = ventasPorTel.get(tel) ?? { ventas: 0, actualizado_at: '' };
    prev.ventas += Number((r as any).ventas) || 0;
    const act = String((r as any).actualizado_at ?? '');
    if (act > prev.actualizado_at) prev.actualizado_at = act;
    ventasPorTel.set(tel, prev);
  }

  // ── Preguntas en el rango → tiempo de respuesta + tasa ──────────────────────
  const { data: pregs } = await supabase
    .from('vendedor_preguntas')
    .select('telefono, respuesta_seg, respondido_at')
    .eq('tenant_id', tid)
    .gte('enviado_at', `${desde}T00:00:00`).lte('enviado_at', `${hasta}T23:59:59`);
  const statsPorTel = new Map<string, { preguntas: number; respondidas: number; sumaSeg: number }>();
  for (const p of pregs ?? []) {
    const tel = String((p as any).telefono);
    const s = statsPorTel.get(tel) ?? { preguntas: 0, respondidas: 0, sumaSeg: 0 };
    s.preguntas++;
    if ((p as any).respondido_at) {
      s.respondidas++;
      s.sumaSeg += Number((p as any).respuesta_seg) || 0;
    }
    statsPorTel.set(tel, s);
  }

  // El concurso cuenta solo desde CONCURSO_INICIO (antes es prueba).
  const concursoActivo = hasta >= CONCURSO_INICIO;

  const ranking = VENDEDORES.map(v => {
    const rep = ventasPorTel.get(v.telefono);
    const st  = statsPorTel.get(v.telefono) ?? { preguntas: 0, respondidas: 0, sumaSeg: 0 };
    const ventas = rep ? rep.ventas : null;                 // null = no reportó en el periodo
    const promedioSeg = st.respondidas > 0 ? Math.round(st.sumaSeg / st.respondidas) : null;
    const tasa = st.preguntas > 0 ? Math.round((st.respondidas / st.preguntas) * 100) : null;
    // Gana el incentivo si en el periodo respondió >=3 veces y promedia < 1h30m
    const ganaDescuento = concursoActivo && promedioSeg != null && st.respondidas >= 3 && promedioSeg < LIMITE_INCENTIVO_SEG;

    let estado: 'activo' | 'lento' | 'sin-responder';
    if (st.respondidas === 0) estado = 'sin-responder';
    else if (promedioSeg != null && promedioSeg > 30 * 60) estado = 'lento';
    else estado = 'activo';

    return {
      telefono: v.telefono,
      nombre: v.nombre,
      ventas,
      promedioSeg,
      tasa,
      respondidas: st.respondidas,
      preguntas: st.preguntas,
      estado,
      ultimaActualizacion: rep?.actualizado_at ?? null,
      // En rango, la "nómina" es el propio periodo seleccionado.
      promedioNominaSeg: promedioSeg,
      nominaRespondidas: st.respondidas,
      ganaDescuento,
    };
  }).sort((a, b) => (b.ventas ?? -1) - (a.ventas ?? -1));

  const totalVentas = ranking.reduce((s, r) => s + (r.ventas ?? 0), 0);
  const reportaron  = ranking.filter(r => r.ventas != null).length;
  const activos     = ranking.filter(r => r.estado === 'activo').length;
  const ganadores   = ranking.filter(r => r.ganaDescuento).length;

  return NextResponse.json({
    desde, hasta,
    concurso: { activo: concursoActivo, inicio: CONCURSO_INICIO },
    limiteSeg: LIMITE_INCENTIVO_SEG,
    ranking,
    resumen: { totalVentas, reportaron, activos, equipo: VENDEDORES.length, ganadores },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { contarPrendas } from '@/lib/prendas';

export const dynamic = 'force-dynamic';

// Ganancia que suma cada prenda vendida.
const VALOR_PRENDA = 600;
// Metas mensuales en cadena: al pasar una, se activa la siguiente.
const METAS = [800, 1100, 1500];

/**
 * Prendas de un pedido según su VALOR (precio total). Con umbrales para no dejar
 * huecos: 1 unidad ~$129.900, 2 ~$219.900, 3 ~$310.000.
 *   < $185.000            → 1 prenda
 *   $185.000 – $284.999   → 2 prendas
 *   ≥ $285.000            → 3 prendas
 */
function prendasPorValor(valor: number): number {
  if (valor >= 285000) return 3;
  if (valor >= 185000) return 2;
  return 1;
}

/** Cuántas prendas cuenta un pedido: por su valor; si no hay valor, cae al nombre. */
function prendasDelPedido(v: any): number {
  const valorNum = Number(String(v.valor ?? '').replace(/[^\d]/g, '')) || 0;
  if (valorNum > 0) return prendasPorValor(valorNum);
  if (Number(v.cantidad) > 0) return Number(v.cantidad);
  return contarPrendas(v.producto);
}

/** Devuelve {y, m, d} en hora de Colombia para una fecha dada. */
function bogota(fecha: Date) {
  const s = fecha.toLocaleString('en-US', { timeZone: 'America/Bogota' });
  const d = new Date(s);
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
}

/** 'YYYY-MM-DD' de una fecha en hora de Colombia (para comparar rangos). */
function iso(fecha: Date): string {
  const { y, m, d } = bogota(fecha);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Progreso del MES ACTUAL hacia las metas de prendas.
 * Fuente: clientes_funnelish confirmadas este mes, excluyendo las que se sacaron
 * de "VENTA REALIZADA" (canceladas, pendientes, programadas, abono por verificar).
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();

  // Filtro opcional por rango de fechas (para sumar un día o periodo específico).
  const desde = req.nextUrl.searchParams.get('desde'); // 'YYYY-MM-DD'
  const hasta = req.nextUrl.searchParams.get('hasta') || desde;

  const ahora = new Date();
  const hoy = bogota(ahora);
  const diasDelMes = new Date(hoy.y, hoy.m + 1, 0).getDate();
  const diaActual = hoy.d;
  const diasRestantes = Math.max(1, diasDelMes - diaActual + 1); // incluye hoy

  // Traemos las confirmadas de los últimos ~45 días y filtramos por mes en JS
  // (evita líos de zona horaria en la consulta).
  const hace45 = new Date(Date.now() - 45 * 86_400_000).toISOString();

  const { data: ventas, error } = await supabase
    .from('clientes_funnelish')
    .select('telefono, producto, confirmado_at, created_at, cantidad, valor')
    .eq('confirmado', true)
    .gte('created_at', hace45)   // created_at siempre existe (no perder ventas sin confirmado_at)
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lista = ventas ?? [];

  // Etiquetas actuales: si una venta ya no está en "VENTA REALIZADA", no cuenta.
  const convIds = [...new Set(lista.map((v: any) => `57${String(v.telefono ?? '').replace(/^57/, '')}`))];
  const labelPorConv = new Map<string, string>();
  if (convIds.length) {
    try {
      const { data: convs } = await supabase
        .from('conversations').select('id, label').in('id', convIds);
      for (const c of convs ?? []) {
        labelPorConv.set(String((c as any).id), String((c as any).label ?? '').toUpperCase());
      }
    } catch { /* si falla, se cuentan todas las confirmadas */ }
  }

  let prendasMes = 0;
  let prendasHoy = 0;

  for (const v of lista) {
    const lab = labelPorConv.get(`57${String((v as any).telefono ?? '').replace(/^57/, '')}`);
    // Solo se descuentan las ventas realmente ANULADAS o CANCELADAS. Las que están
    // en abono/programado/pendiente siguen siendo ventas realizadas y SÍ cuentan.
    if (lab != null && /CANCELAD|ANULAD/.test(lab)) continue;

    // Fecha de la venta: la de confirmación; si no está, la de creación.
    const fecha = (v as any).confirmado_at ?? (v as any).created_at;
    if (!fecha) continue;
    const f = bogota(new Date(fecha));
    if (f.y !== hoy.y || f.m !== hoy.m) continue; // solo el mes actual (del 1 en adelante)

    // Prendas del pedido: por su VALOR (1 unidad, 2 o 3 según el precio).
    const n = prendasDelPedido(v);
    prendasMes += n;
    if (f.d === diaActual) prendasHoy += n;
  }

  // Meta activa: la primera que aún no se alcanza (o la máxima si ya se superaron todas)
  const metaActiva = METAS.find(m => prendasMes < m) ?? METAS[METAS.length - 1];
  const todasLogradas = prendasMes >= METAS[METAS.length - 1];
  const faltan = Math.max(0, metaActiva - prendasMes);
  const metaDiaria = faltan > 0 ? Math.ceil(faltan / diasRestantes) : 0;

  // Ritmo del mes: dónde deberías ir a estas alturas del mes.
  const esperadoAhora = metaActiva * (diaActual / diasDelMes);
  const diferencia = Math.round(prendasMes - esperadoAhora);

  // ── Filtro por fecha (rango específico) ─────────────────────────────────────
  // Consulta aparte: el rango puede ser cualquier día, no solo el mes actual.
  let rango: { desde: string; hasta: string; prendas: number; dinero: number } | null = null;
  if (desde && hasta) {
    // Buffer de 1 día a cada lado para no perder registros por la zona horaria.
    const gte = `${desde}T00:00:00-05:00`;
    const lte = `${hasta}T23:59:59-05:00`;
    const { data: enRango } = await supabase
      .from('clientes_funnelish')
      .select('telefono, producto, confirmado_at, cantidad, valor')
      .eq('confirmado', true)
      .not('confirmado_at', 'is', null)
      .gte('confirmado_at', gte)
      .lte('confirmado_at', lte)
      .limit(5000);

    // Etiquetas de esas conversaciones (para excluir las que salieron de venta realizada)
    const idsR = [...new Set((enRango ?? []).map((v: any) => `57${String(v.telefono ?? '').replace(/^57/, '')}`))];
    const labelR = new Map<string, string>();
    if (idsR.length) {
      try {
        const { data: convs } = await supabase.from('conversations').select('id, label').in('id', idsR);
        for (const c of convs ?? []) labelR.set(String((c as any).id), String((c as any).label ?? '').toUpperCase());
      } catch { /* si falla, se cuentan todas */ }
    }

    let prendasR = 0;
    for (const v of enRango ?? []) {
      const lab = labelR.get(`57${String((v as any).telefono ?? '').replace(/^57/, '')}`);
      if (lab != null && /CANCELAD|ANULAD/.test(lab)) continue;
      const s = iso(new Date((v as any).confirmado_at));
      if (s < desde || s > hasta) continue; // recorte exacto en hora de Colombia
      prendasR += prendasDelPedido(v);
    }
    rango = { desde, hasta, prendas: prendasR, dinero: prendasR * VALOR_PRENDA };
  }

  return NextResponse.json({
    rango,
    prendasMes,
    dineroMes: prendasMes * VALOR_PRENDA,
    prendasHoy,
    valorPrenda: VALOR_PRENDA,
    metas: METAS,
    metaActiva,
    metaIndice: METAS.indexOf(metaActiva) + 1, // 1, 2, 3
    todasLogradas,
    faltan,
    progresoPct: Math.min(100, Math.round((prendasMes / metaActiva) * 100)),
    diaActual,
    diasDelMes,
    diasRestantes,
    metaDiaria,
    ritmo: diferencia >= 0 ? 'adelantado' : 'atrasado',
    diferenciaRitmo: Math.abs(diferencia),
  });
}

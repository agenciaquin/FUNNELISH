import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Reporte de entregas del remarketing.
 * - GET /api/remarketing/reporte            → lista de campañas recientes con su resumen.
 * - GET /api/remarketing/reporte?id=CAMPANA  → resumen (embudo) de una campaña.
 *
 * Estados de cada envío (el más avanzado que se haya alcanzado):
 *   enviado → entregado → leído → respondió   (fallido = no salió).
 * Como se guarda solo el estado más alto, "leído" implica "entregado", y
 * "respondió" implica "leído" y "entregado". El resumen lo reconstruye así.
 */

interface Fila {
  estado: string;
  entregado_at?: string | null;
  leido_at?: string | null;
  respondido_at?: string | null;
}

/**
 * Cuenta cada dimensión por su DATO REAL (la marca de tiempo que puso Meta), no
 * por inferencia. Así "entregado" y "leído" reflejan únicamente lo que WhatsApp
 * confirmó; nada se infla. "Respondió" solo cuenta si además hubo entrega real.
 */
function resumir(filas: Fila[]) {
  let enviados = 0, entregados = 0, leidos = 0, respondieron = 0, fallidos = 0;
  for (const f of filas) {
    if (f.estado === 'fallido') { fallidos++; continue; }
    enviados++; // Meta aceptó el envío
    if (f.entregado_at) entregados++;
    if (f.leido_at) leidos++;
    if (f.respondido_at && f.entregado_at) respondieron++; // solo si de verdad se entregó
  }
  return { total: filas.length, enviados, entregados, leidos, respondieron, fallidos };
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  const supabase = createServerSupabaseClient();

  // Detalle de UNA campaña.
  if (id) {
    const { data, error } = await supabase
      .from('remarketing_envios')
      .select('estado, entregado_at, leido_at, respondido_at').eq('campana_id', id).limit(10000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ campanaId: id, ...resumir((data ?? []) as Fila[]) });
  }

  // Lista de campañas recientes (agrupadas por campana_id).
  const { data, error } = await supabase
    .from('remarketing_envios')
    .select('campana_id, template, estado, enviado_at, entregado_at, leido_at, respondido_at')
    .order('enviado_at', { ascending: false })
    .limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const grupos = new Map<string, { template: string; enviado_at: string; filas: Fila[] }>();
  for (const r of data ?? []) {
    const g = grupos.get(r.campana_id) ?? { template: r.template ?? '', enviado_at: r.enviado_at, filas: [] as Fila[] };
    g.filas.push({ estado: r.estado, entregado_at: r.entregado_at, leido_at: r.leido_at, respondido_at: r.respondido_at });
    if (r.enviado_at > g.enviado_at) g.enviado_at = r.enviado_at;
    grupos.set(r.campana_id, g);
  }
  const campanas = [...grupos.entries()]
    .map(([campanaId, g]) => ({ campanaId, template: g.template, fecha: g.enviado_at, ...resumir(g.filas) }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .slice(0, 20);

  return NextResponse.json({ campanas });
}

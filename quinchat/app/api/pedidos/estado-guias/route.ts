import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { grupoDeGuia, type GrupoGuia } from '@/lib/effi-estados';

export const dynamic = 'force-dynamic';

/**
 * ESTADO DE PEDIDO — guías de Effi (copia en effi_guias_api, la llena «Sincronizar con Effi»)
 * agrupadas por el estado normalizado de Effi (`estado_efficommerce`):
 *   Generada · En tránsito (incluye En reparto) · En oficina · Entregada · Devuelta · Novedad · Anulada
 * ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (por fecha de creación de la guía; por defecto 30 días)
 */
export async function GET(req: NextRequest) {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const hoy = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
  const hace30 = new Date(Date.now() - 5 * 3600_000 - 30 * 86400_000).toISOString().slice(0, 10);
  const desde = req.nextUrl.searchParams.get('desde') || hace30;
  const hasta = req.nextUrl.searchParams.get('hasta') || hoy;

  const supabase = createServerSupabaseClient();
  const filas: any[] = [];
  for (let d = 0; d < 20000; d += 1000) {
    const { data, error } = await supabase.from('effi_guias_api')
      .select('id_effi, guia, transportadora, estado, estado_efficommerce, vigente, telefono, nombre, ciudad, departamento, valor_recaudo, fecha_trans, fecha_estado_final, url_guia, actualizado_at')
      .gte('fecha_trans', `${desde}T00:00:00Z`).lte('fecha_trans', `${hasta}T23:59:59Z`)
      .order('fecha_trans', { ascending: false }).range(d, d + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) break;
    filas.push(...data);
    if (data.length < 1000) break;
  }

  const conteo: Record<GrupoGuia, number> = { generada: 0, transito: 0, oficina: 0, entregada: 0, devuelta: 0, novedad: 0, anulada: 0 };
  const guias = filas.map(g => {
    const grupo = grupoDeGuia(g);
    conteo[grupo]++;
    return { ...g, grupo };
  });
  const { data: ult } = await supabase.from('effi_sync_log').select('inicio, ok').order('inicio', { ascending: false }).limit(1).maybeSingle();
  return NextResponse.json({ desde, hasta, total: guias.length, conteo, guias, ultimaSync: ult ?? null });
}

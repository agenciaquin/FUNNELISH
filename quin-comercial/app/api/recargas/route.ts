import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';
import { PAQUETES } from '@/lib/recargas';

export const dynamic = 'force-dynamic';

/**
 * Estado de recargas de la empresa logueada.
 * GET → { creditos, creditos_tope, paquetes, historial, pasarelaLista }
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  const admin = createServerSupabaseClient();
  const pasarelaLista = !!process.env.MERCADOPAGO_ACCESS_TOKEN;

  const { data: t, error } = await admin
    .from('tenants').select('creditos, creditos_tope').eq('id', tid).maybeSingle();
  if (error) {
    if (/column .*creditos.* does not exist/i.test(error.message)) {
      return NextResponse.json({ creditos: 0, creditos_tope: 0, paquetes: PAQUETES, historial: [], pasarelaLista, faltaMigracion: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let historial: any[] = [];
  const { data: recs } = await admin
    .from('recargas').select('id, cantidad, monto, estado, creado_at, aprobada_at')
    .eq('tenant_id', tid).order('creado_at', { ascending: false }).limit(20);
  historial = recs ?? [];

  let diasPrueba = 0;
  try {
    const { data: tp } = await admin.from('tenants').select('prueba_hasta').eq('id', tid).maybeSingle();
    if (tp?.prueba_hasta) {
      const ms = new Date(tp.prueba_hasta).getTime() - Date.now();
      diasPrueba = ms > 0 ? Math.ceil(ms / (24 * 3600 * 1000)) : 0;
    }
  } catch { /* columna aún no existe */ }

  // Conversaciones que ha atendido el bot de esta empresa (acumulado).
  let conversaciones = 0;
  try {
    const { data: tc } = await admin.from('tenants').select('conversaciones_usadas').eq('id', tid).maybeSingle();
    conversaciones = Number((tc as any)?.conversaciones_usadas ?? 0);
  } catch { /* columna aún no existe */ }

  return NextResponse.json({
    diasPrueba,
    creditos: t?.creditos ?? 0,
    creditos_tope: t?.creditos_tope ?? 0,
    conversaciones,
    paquetes: PAQUETES,
    historial,
    pasarelaLista,
  });
}

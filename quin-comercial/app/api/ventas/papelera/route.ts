import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * Papelera de ventas (borrado suave). Guarda 30 días.
 *   POST { id, accion: 'enviar' | 'restaurar' }
 *  - enviar    → marca papelera_at = ahora (se oculta de la lista).
 *  - restaurar → papelera_at = null (vuelve a la lista).
 */
export async function POST(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id, accion } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const papelera_at = accion === 'restaurar' ? null : new Date().toISOString();

  const { error } = await supabase
    .from('clientes_funnelish')
    .update({ papelera_at })
    .eq('id', id)
    .eq('tenant_id', tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, papelera_at });
}

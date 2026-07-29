import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Acciones sobre uno o varios pedidos desde el panel.
 *
 *   cancelar  → queda marcado como cancelado (sigue visible, no suma a lo vendido)
 *   eliminar  → se borra de verdad (para los pedidos de prueba)
 *   restaurar → vuelve a quedar "por confirmar"
 */
export async function POST(req: NextRequest) {
  const body   = await req.json().catch(() => ({}));
  const ids    = Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : [];
  const accion = String(body?.accion ?? '');

  if (ids.length === 0) {
    return NextResponse.json({ error: 'No hay pedidos seleccionados' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  if (accion === 'eliminar') {
    const { error } = await supabase.from('clientes_funnelish').delete().in('id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, afectados: ids.length });
  }

  if (accion === 'cancelar' || accion === 'restaurar') {
    const cambios = accion === 'cancelar'
      ? { estado: 'cancelado', confirmado: false }
      : { estado: 'pendiente',  confirmado: false };

    const { error } = await supabase.from('clientes_funnelish').update(cambios).in('id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, afectados: ids.length });
  }

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
}

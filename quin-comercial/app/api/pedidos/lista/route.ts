import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/**
 * Pedidos para el panel.
 * ?origen=web (solo los de nuestras páginas) | todos
 * ?dias=7
 */
export async function GET(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const origen = req.nextUrl.searchParams.get('origen') ?? 'web';
  const dias   = Number(req.nextUrl.searchParams.get('dias') ?? 7);
  const desde  = new Date(Date.now() - dias * 86_400_000).toISOString();

  const supabase = createServerSupabaseClient();
  let consulta = supabase
    .from('clientes_funnelish')
    .select('id, referencia, nombre, telefono, producto, talla, valor, direccion, ciudad, departamento, correo, confirmado, estado, abono, abono_recibido, utm_source, utm_campaign, created_at')
    .eq('tenant_id', tid)
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(400);

  // Los pedidos de nuestras páginas llevan referencia que empieza por "web-"
  if (origen === 'web') consulta = consulta.like('referencia', 'web-%');

  const { data, error } = await consulta;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pedidos = data ?? [];

  // Miniatura del producto: la primera foto que el bot le mandó a ese cliente.
  // Se traen todas de una sola vez para no consultar pedido por pedido.
  try {
    const convIds = [...new Set(pedidos
      .map(p => `57${String(p.telefono ?? '').replace(/\D/g, '').slice(-10)}`)
      .filter(id => id.length === 12))];

    if (convIds.length > 0) {
      const { data: imgs } = await supabase
        .from('messages').select('conversation_id, content, created_at')
        .eq('tenant_id', tid)
        .in('conversation_id', convIds)
        .eq('type', 'image').eq('role', 'assistant')
        .order('created_at', { ascending: true });

      const primeraFoto = new Map<string, string>();
      for (const m of imgs ?? []) {
        const c = String((m as any).content ?? '');
        if (!c.startsWith('http')) continue;
        const conv = String((m as any).conversation_id);
        if (!primeraFoto.has(conv)) primeraFoto.set(conv, c);
      }

      for (const p of pedidos) {
        const conv = `57${String(p.telefono ?? '').replace(/\D/g, '').slice(-10)}`;
        (p as any).foto = primeraFoto.get(conv) ?? null;
      }
    }
  } catch { /* si no hay fotos, la lista igual funciona */ }
  const resumen = {
    total:       pedidos.length,
    confirmados: pedidos.filter(p => p.confirmado).length,
    cancelados:  pedidos.filter(p => String(p.estado).toLowerCase() === 'cancelado').length,
    vendido:     pedidos
      .filter(p => p.confirmado)
      .reduce((s, p) => s + (Number(String(p.valor ?? '').replace(/[^\d]/g, '')) || 0), 0),
  };

  return NextResponse.json({ pedidos, resumen });
}

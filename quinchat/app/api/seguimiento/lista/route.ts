import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Pedidos para el panel de Seguimiento (conciliación con Effi).
 * Devuelve cada pedido con su foto, teléfono y el estado (etiqueta) de QuinChat.
 * ?dias=30
 */
export async function GET(req: NextRequest) {
  const dias  = Number(req.nextUrl.searchParams.get('dias') ?? 30);
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  // ?papelera=1 → solo lo enviado a papelera en los últimos 30 días
  const soloPapelera = req.nextUrl.searchParams.get('papelera') === '1';
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const supabase = createServerSupabaseClient();

  let query = supabase
    .from('clientes_funnelish')
    .select('id, referencia, nombre, telefono, producto, talla, valor, confirmado, estado, created_at, papelera_at');
  if (soloPapelera) {
    query = query.not('papelera_at', 'is', null).gte('papelera_at', hace30);
  } else {
    query = query.is('papelera_at', null).gte('created_at', desde);
  }
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(600);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const pedidos = data ?? [];

  // Fotos (primera del bot) + etiqueta de la conversación, de una sola vez
  try {
    const convIds = [...new Set(pedidos
      .map(p => `57${String(p.telefono ?? '').replace(/\D/g, '').slice(-10)}`)
      .filter(id => id.length === 12))];

    if (convIds.length) {
      const [{ data: imgs }, { data: convs }] = await Promise.all([
        supabase.from('messages').select('conversation_id, content, created_at')
          .in('conversation_id', convIds).eq('type', 'image').eq('role', 'assistant')
          .order('created_at', { ascending: true }),
        supabase.from('conversations').select('id, label').in('id', convIds),
      ]);

      const foto = new Map<string, string>();
      for (const m of imgs ?? []) {
        const c = String((m as any).content ?? '');
        const conv = String((m as any).conversation_id);
        if (c.startsWith('http') && !foto.has(conv)) foto.set(conv, c);
      }
      const etiqueta = new Map<string, string>();
      for (const c of convs ?? []) etiqueta.set(String(c.id), String((c as any).label ?? ''));

      for (const p of pedidos) {
        const conv = `57${String(p.telefono ?? '').replace(/\D/g, '').slice(-10)}`;
        (p as any).foto = foto.get(conv) ?? null;
        (p as any).etiqueta = etiqueta.get(conv) ?? '';
      }
    }
  } catch { /* si falla, la lista igual sirve */ }

  return NextResponse.json({ pedidos });
}

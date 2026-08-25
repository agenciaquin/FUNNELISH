import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/**
 * Detalle de un pedido para la ventana del panel, incluyendo las fotos
 * que el bot le envió al cliente (que son las del producto que eligió).
 */
export async function GET(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el pedido.' }, { status: 400 });

  const supabase = createServerSupabaseClient();

  const { data: pedido, error } = await supabase
    .from('clientes_funnelish').select('*').eq('id', id).eq('tenant_id', tid).maybeSingle();

  if (error)   return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pedido) return NextResponse.json({ error: 'No existe ese pedido.' }, { status: 404 });

  // Las primeras fotos que el bot mandó son las del producto comprado
  let imagenes: string[] = [];
  try {
    const tel = String(pedido.telefono ?? '').replace(/\D/g, '').slice(-10);
    const { data: imgs } = await supabase
      .from('messages').select('content')
      .eq('tenant_id', tid)
      .eq('conversation_id', `57${tel}`).eq('type', 'image').eq('role', 'assistant')
      .order('created_at', { ascending: true }).limit(4);

    imagenes = ([...new Set((imgs ?? []).map((m: any) => m.content))]
      .filter((u: any) => typeof u === 'string' && u.startsWith('http')) as string[]).slice(0, 3);
  } catch { /* si no hay fotos, no pasa nada */ }

  return NextResponse.json({ pedido, imagenes });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Detalle de un pedido para la ventana del panel, incluyendo las fotos
 * que el bot le envió al cliente (que son las del producto que eligió).
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el pedido.' }, { status: 400 });

  const supabase = createServerSupabaseClient();

  const { data: pedido, error } = await supabase
    .from('clientes_funnelish').select('*').eq('id', id).maybeSingle();

  if (error)   return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pedido) return NextResponse.json({ error: 'No existe ese pedido.' }, { status: 404 });

  // 1º: la foto guardada CON ESTE pedido (la correcta). Evita agarrar fotos
  // viejas del historial cuando el mismo número hizo varios pedidos (pruebas).
  let imagenes: string[] = [];
  const propia = String(pedido.foto_producto ?? '').trim();
  if (propia.startsWith('http')) imagenes = [propia];

  // 2º: si el pedido no tiene foto guardada, se toma la MÁS RECIENTE que el bot
  // le mandó a ese número (no la más vieja), que corresponde a este pedido.
  if (imagenes.length === 0) {
    try {
      const tel = String(pedido.telefono ?? '').replace(/\D/g, '').slice(-10);
      const { data: imgs } = await supabase
        .from('messages').select('content')
        .eq('conversation_id', `57${tel}`).eq('type', 'image').eq('role', 'assistant')
        .order('created_at', { ascending: false }).limit(4);

      imagenes = ([...new Set((imgs ?? []).map((m: any) => m.content))]
        .filter((u: any) => typeof u === 'string' && u.startsWith('http')) as string[]).slice(0, 3);
    } catch { /* si no hay fotos, no pasa nada */ }
  }

  return NextResponse.json({ pedido, imagenes });
}

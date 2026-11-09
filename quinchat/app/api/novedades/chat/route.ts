import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Busca el chat del cliente en QuinChat (Chat Funnel y Chat WhatsApp) por su teléfono de Effi.
 * Normaliza con o sin +57. SOLO LEE: no crea conversaciones ni cambia el número.
 *  GET ?tel=3001234567 → { valido, telefono, encontrado, id?, linea?, nombre? }
 */
export async function GET(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  let t = String(req.nextUrl.searchParams.get('tel') ?? '').replace(/\D/g, '');
  if (t.length === 12 && t.startsWith('57')) t = t.slice(2);
  if (!/^\d{10}$/.test(t)) return NextResponse.json({ valido: false, telefono: t, encontrado: false });
  const supabase = createServerSupabaseClient();
  const ids = [`57${t}`, t, `+57${t}`, `57${t}@funnel`, `${t}@funnel`];
  // También el chat guardado en el pedido cuando no es 57+teléfono (chats CO.xxxx o celular de otra persona)
  const { data: ped } = await supabase.from('clientes_funnelish').select('conversation_id').eq('telefono', t).not('conversation_id', 'is', null).limit(5);
  for (const p of ped ?? []) if (p.conversation_id) ids.push(String(p.conversation_id));
  const { data: convs } = await supabase.from('conversations').select('id, linea, contact_name, last_message_time').in('id', [...new Set(ids)]);
  const lista = (convs ?? []).sort((a: any, b: any) => Date.parse(b.last_message_time ?? 0) - Date.parse(a.last_message_time ?? 0));
  if (!lista.length) return NextResponse.json({ valido: true, telefono: t, encontrado: false });
  const c: any = lista[0];
  return NextResponse.json({ valido: true, telefono: t, encontrado: true, id: c.id, linea: c.linea === 'ventas' ? 'ventas' : 'funnel', nombre: c.contact_name ?? null, otros: lista.length - 1 });
}

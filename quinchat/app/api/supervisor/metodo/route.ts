import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function conSesion() { return !!(await getServerSession(authOptions)); }

/** GET: el método de venta aprendido del asesor. */
export async function GET() {
  if (!(await conSesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'metodo_asesor').maybeSingle();
  const v = data?.valor ?? null;
  return NextResponse.json({ metodo: v?.metodo ?? null, activo: v ? v.activo !== false : false, actualizado: v?.actualizado ?? null, chats: v?.chats ?? 0 });
}

/** POST { activo }: el bot usa (o deja de usar) el método aprendido. */
export async function POST(req: NextRequest) {
  if (!(await conSesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { activo } = await req.json().catch(() => ({}));
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'metodo_asesor').maybeSingle();
  if (!data?.valor) return NextResponse.json({ error: 'Aún no hay método aprendido.' }, { status: 404 });
  await supabase.from('ajustes_bot').update({ valor: { ...data.valor, activo: !!activo }, actualizado_at: new Date().toISOString() }).eq('clave', 'metodo_asesor');
  return NextResponse.json({ ok: true, activo: !!activo });
}

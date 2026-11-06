import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Interruptor del envío AUTOMÁTICO de la plantilla de carrito (ajustes_bot «carritos_auto»). */
export async function GET() {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'carritos_auto').maybeSingle();
  const v = (data?.valor ?? {}) as any;
  return NextResponse.json({ activo: v.activo === true, minutos: Number(v.minutos) || 10, max_horas: Number(v.max_horas) || 24 });
}

export async function POST(req: NextRequest) {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'carritos_auto').maybeSingle();
  const actual = (data?.valor ?? {}) as any;
  const activo = b?.activo === true;
  // Al ENCENDER se guarda desde cuándo: solo se recuperan carritos NUEVOS (de ahí en
  // adelante), así no sale una ráfaga de mensajes a los carritos viejos.
  const valor = { minutos: 10, max_horas: 24, ...actual, activo, ...(activo && !actual.activo ? { desde: new Date().toISOString() } : {}) };
  await supabase.from('ajustes_bot').upsert({ clave: 'carritos_auto', valor, actualizado_at: new Date().toISOString() }, { onConflict: 'clave' });
  return NextResponse.json({ ok: true, ...valor });
}

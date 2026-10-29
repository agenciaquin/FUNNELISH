import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { soloBienvenidaHasta, fijarSoloBienvenida } from '@/lib/ajustes-bot';

export const dynamic = 'force-dynamic';

async function conSesion() { return !!(await getServerSession(authOptions)); }

/** GET: estado del modo "solo bienvenida". */
export async function GET() {
  if (!(await conSesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const hasta = await soloBienvenidaHasta();
  return NextResponse.json({ activo: hasta > Date.now(), hasta: hasta ? new Date(hasta).toISOString() : null });
}

/**
 * POST { activo: true }  → activa hasta las 23:59 de hoy (hora Colombia).
 * POST { activo: false } → lo apaga y vuelve a PRENDER el bot en los chats que
 *                          apagó este modo (salvo ventas cerradas o con humano).
 */
export async function POST(req: NextRequest) {
  if (!(await conSesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { activo } = await req.json().catch(() => ({}));
  if (activo) {
    const col = new Date(Date.now() - 5 * 3_600_000);
    const finDia = new Date(Date.UTC(col.getUTCFullYear(), col.getUTCMonth(), col.getUTCDate() + 1, 4, 59, 59));
    await fijarSoloBienvenida(finDia);
    return NextResponse.json({ ok: true, activo: true, hasta: finDia.toISOString() });
  }
  await fijarSoloBienvenida(null);
  const supabase = createServerSupabaseClient();
  const { data: apagados } = await supabase.from('conversations').select('id, label').not('bot_off_modo', 'is', null);
  const reactivar = (apagados ?? [])
    .filter((c: any) => !/VENTA REALIZADA|HUMANO|PEDIDO CANCELADO|OFICINA REVISAR HUMANO|VENDEDOR/i.test(String(c.label ?? '')))
    .map((c: any) => c.id);
  if (reactivar.length) await supabase.from('conversations').update({ bot_enabled: true }).in('id', reactivar);
  await supabase.from('conversations').update({ bot_off_modo: null }).not('bot_off_modo', 'is', null);
  return NextResponse.json({ ok: true, activo: false, reactivados: reactivar.length });
}

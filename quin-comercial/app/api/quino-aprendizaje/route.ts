import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Panel "Aprendizaje de Quino" (solo super-admin).
 * Cerebro COMPARTIDO de la agencia: no lleva tenant_id.
 * GET    → lista todo (lo nuevo/no revisado primero).
 * POST   → agrega una solución a mano { problema, solucion }.
 * PATCH  → edita/aprueba/descarta/marca revisada { id, ... }.
 * DELETE → borra { id }.
 */
function esSuper(session: any): boolean {
  return session && session.rol === 'superadmin';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!esSuper(session)) return NextResponse.json({ error: 'requiere super-admin' }, { status: 403 });

  const admin = createServerSupabaseClient();
  const { data, error } = await admin
    .from('quino_aprendizaje')
    .select('*')
    .order('revisada', { ascending: true })
    .order('actualizada_at', { ascending: false })
    .limit(500);
  if (error) {
    if (/relation .*quino_aprendizaje.* does not exist/i.test(error.message)) {
      return NextResponse.json({ items: [], faltaMigracion: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!esSuper(session)) return NextResponse.json({ error: 'requiere super-admin' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const problema = String(body?.problema ?? '').trim().slice(0, 400);
  const solucion = String(body?.solucion ?? '').trim().slice(0, 1200);
  if (!problema || !solucion) return NextResponse.json({ error: 'faltan problema y solución' }, { status: 400 });

  const admin = createServerSupabaseClient();
  const { error } = await admin.from('quino_aprendizaje').insert({
    problema, solucion, estado: 'aprobada', veces_util: 1, revisada: true, origen_slug: 'manual',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!esSuper(session)) return NextResponse.json({ error: 'requiere super-admin' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const id = String(body?.id ?? '');
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  const cambios: Record<string, any> = { actualizada_at: new Date().toISOString() };
  if (typeof body.problema === 'string') cambios.problema = body.problema.trim().slice(0, 400);
  if (typeof body.solucion === 'string') cambios.solucion = body.solucion.trim().slice(0, 1200);
  if (body.estado === 'aprobada' || body.estado === 'descartada') cambios.estado = body.estado;
  if (typeof body.revisada === 'boolean') cambios.revisada = body.revisada;

  const admin = createServerSupabaseClient();
  const { error } = await admin.from('quino_aprendizaje').update(cambios).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!esSuper(session)) return NextResponse.json({ error: 'requiere super-admin' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const id = String(body?.id ?? '');
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  const admin = createServerSupabaseClient();
  const { error } = await admin.from('quino_aprendizaje').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

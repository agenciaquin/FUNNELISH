import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { haySesion } from '@/lib/live/admin-guard';

export const dynamic = 'force-dynamic';

/**
 * Moderación de comentarios del público (solo equipo con login).
 *  GET    ?live_id=… → últimos comentarios (visibles y ocultos)
 *  PATCH  { id, estado: 'visible' | 'oculto' }
 *  DELETE ?id=…
 */
export async function GET(req: NextRequest) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const liveId = req.nextUrl.searchParams.get('live_id');
  if (!liveId) return NextResponse.json({ error: 'falta live_id' }, { status: 400 });
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('live_comentarios')
    .select('id, nombre, texto, segundo, estado, creado_en')
    .eq('live_id', liveId).order('id', { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comentarios: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const estado = b?.estado === 'oculto' ? 'oculto' : 'visible';
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('live_comentarios').update({ estado }).eq('id', Number(b?.id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('live_comentarios').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

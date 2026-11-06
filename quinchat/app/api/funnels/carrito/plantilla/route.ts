import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

import { enviarPlantillaCarrito } from '@/lib/carrito-plantilla';

/** GET ?ids=a,b → estado de envío de cada carrito (para pintar el botón). */
export async function GET(req: NextRequest) {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const ids = String(req.nextUrl.searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 500);
  if (!ids.length) return NextResponse.json({ estados: {} });
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('carritos_abandonados')
    .select('id, plantilla_enviada_at, plantilla_error, auto_estado').in('id', ids);
  const estados: Record<string, { enviada_at: string | null; error: string | null; auto: string | null }> = {};
  for (const c of data ?? []) estados[(c as any).id] = { enviada_at: (c as any).plantilla_enviada_at, error: (c as any).plantilla_error, auto: (c as any).auto_estado ?? null };
  return NextResponse.json({ estados });
}

/** POST { id } → envía la plantilla de carrito abandonado a ese cliente (una sola vez). */
export async function POST(req: NextRequest) {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'Falta el carrito.' }, { status: 400 });
  const r = await enviarPlantillaCarrito(createServerSupabaseClient(), String(id));
  const { status, ...resto } = r;
  return NextResponse.json(resto, { status });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';
import { guardarAprendizaje } from '@/lib/quino-aprendizaje';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * El cliente marcó 👍 (o dijo "ya funcionó"): guardamos lo que sirvió para
 * que Quino ayude al siguiente. Body: { problema, solucion }.
 * problema = lo que preguntó el cliente; solucion = la respuesta de Quino.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const problema = String(body?.problema ?? '');
  const solucion = String(body?.solucion ?? '');
  if (!problema || !solucion) return NextResponse.json({ error: 'faltan datos' }, { status: 400 });

  // Slug de la empresa (solo para saber de dónde salió; no es dato sensible).
  let slug: string | null = null;
  try {
    const admin = createServerSupabaseClient();
    const { data } = await admin.from('tenants').select('slug').eq('id', tid).maybeSingle();
    slug = data?.slug ?? null;
  } catch { /* opcional */ }

  const r = await guardarAprendizaje(problema, solucion, slug);
  return NextResponse.json({ ok: r.ok, motivo: r.motivo });
}

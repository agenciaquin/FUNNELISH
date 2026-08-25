import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/plantillas-embudo/usar
 * Clona una PLANTILLA de embudo en los embudos de la empresa del usuario.
 * La copia queda editable como suya (nuevo slug, es_plantilla=false).
 * Body: { id }  (id de la plantilla)
 */
function rnd() { return Math.random().toString(36).slice(2, 7); }

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const id = String(body?.id ?? '');
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  const admin = createServerSupabaseClient();
  const { data: tpl, error: eSel } = await admin
    .from('funnels').select('*').eq('id', id).eq('es_plantilla', true).maybeSingle();
  if (eSel) return NextResponse.json({ error: eSel.message }, { status: 500 });
  if (!tpl) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });

  // Copia sin las columnas propias del registro original
  const resto: any = { ...tpl };
  delete resto.id;
  delete resto.tenant_id;
  delete resto.es_plantilla;
  delete resto.creado_at;
  const base = String(resto.slug ?? 'embudo');
  delete resto.slug;

  // Slug único global (la plantilla ya usa el original; la copia necesita uno nuevo)
  let slug = `${base}-${rnd()}`;
  for (let i = 0; i < 6; i++) {
    const { data: ex } = await admin.from('funnels').select('id').eq('slug', slug).maybeSingle();
    if (!ex) break;
    slug = `${base}-${rnd()}`;
  }

  const { error } = await admin
    .from('funnels')
    .insert({ ...resto, tenant_id: tid, slug, es_plantilla: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, slug });
}

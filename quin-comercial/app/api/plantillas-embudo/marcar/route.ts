import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/plantillas-embudo/marcar  (solo super-admin)
 * Marca/desmarca un embudo propio como PLANTILLA (visible para todos los clientes).
 * Body: { id, es_plantilla }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  if ((session as any).rol !== 'superadmin') {
    return NextResponse.json({ error: 'requiere super-admin' }, { status: 403 });
  }
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const id = String(body?.id ?? '');
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  const admin = createServerSupabaseClient();
  const { error } = await admin
    .from('funnels')
    .update({ es_plantilla: !!body.es_plantilla })
    .eq('id', id)
    .eq('tenant_id', tid); // solo puede marcar embudos de su propia empresa
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

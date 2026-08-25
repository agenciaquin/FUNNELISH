import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { mintSupabaseToken } from '@/lib/supabase-token';

export const dynamic = 'force-dynamic';

/**
 * GET /api/supabase-token
 * Devuelve un JWT fresco de Supabase (con el tenant_id del usuario logueado)
 * para que el navegador refresque el token antes de que expire y no se caiga el
 * tiempo real en sesiones largas.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const token = mintSupabaseToken((session as any).tenantId);
  if (!token) return NextResponse.json({ error: 'sin token' }, { status: 503 });

  return NextResponse.json({ token });
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Las rutas del módulo exigen sesión del panel por sí mismas: en el dominio de la
 * tienda (pedido.klixmant.shop) el middleware deja pasar todo /api/ sin login.
 */
export async function exigirSesion(): Promise<{ error: NextResponse | null; quien: string }> {
  const s = await getServerSession(authOptions);
  if (!s) return { error: NextResponse.json({ error: 'no autorizado' }, { status: 401 }), quien: '' };
  return { error: null, quien: s.user?.name || s.user?.email || 'panel' };
}

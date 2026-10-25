import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * El editor de QUIN LIVE SHOPPING solo lo usa el equipo (panel con login).
 * Las rutas /api/live-admin/* comprueban la sesión en el servidor, así quedan
 * protegidas incluso si se llamaran desde el dominio público de la tienda.
 */
export async function haySesion(): Promise<boolean> {
  try {
    const s = await getServerSession(authOptions);
    return !!s;
  } catch {
    return false;
  }
}

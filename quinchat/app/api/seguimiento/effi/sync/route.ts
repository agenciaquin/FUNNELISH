import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sincronizarGuiasEffi, ultimaSyncEffi, effiConfigurado } from '@/lib/effi-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Estado de la última sincronización con Effi. */
export async function GET() {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  return NextResponse.json({ configurado: effiConfigurado(), ultima: await ultimaSyncEffi() });
}

/** Botón «Sincronizar con Effi» del panel (trae las guías de los últimos 60 días). */
export async function POST() {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const r = await sincronizarGuiasEffi('boton', 60);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}

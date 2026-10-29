import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { aprenderDelAsesor } from '@/lib/aprender-asesor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST: "Aprender de mis respuestas de hoy" (desde el panel del Supervisor). */
export async function POST() {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await aprenderDelAsesor()) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 });
  }
}

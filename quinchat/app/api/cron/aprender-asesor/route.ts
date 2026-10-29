import { NextRequest, NextResponse } from 'next/server';
import { aprenderDelAsesor } from '@/lib/aprender-asesor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Aprende de las respuestas manuales del asesor del día (cron, con ?secret=CRON_SECRET). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const ok = req.headers.get('authorization') === `Bearer ${secret}` || req.nextUrl.searchParams.get('secret') === secret;
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await aprenderDelAsesor()) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 });
  }
}

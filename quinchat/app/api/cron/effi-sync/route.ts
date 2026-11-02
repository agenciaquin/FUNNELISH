import { NextRequest, NextResponse } from 'next/server';
import { sincronizarGuiasEffi } from '@/lib/effi-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Sincroniza las guías de Effi (solo lectura). Cron con ?secret=CRON_SECRET, cada 30–60 min. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const ok = req.headers.get('authorization') === `Bearer ${secret}` || req.nextUrl.searchParams.get('secret') === secret;
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  const r = await sincronizarGuiasEffi('cron', 60);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}

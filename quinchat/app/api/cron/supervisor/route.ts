import { NextRequest, NextResponse } from 'next/server';
import { correrSupervisor } from '@/lib/supervisor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Supervisor del bot de ventas: audita una tanda de chats terminados.
 * Llamarlo desde el cron externo cada 30–60 min (con ?secret=CRON_SECRET).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const ok = req.headers.get('authorization') === `Bearer ${secret}` || req.nextUrl.searchParams.get('secret') === secret;
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  try {
    const r = await correrSupervisor();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 });
  }
}

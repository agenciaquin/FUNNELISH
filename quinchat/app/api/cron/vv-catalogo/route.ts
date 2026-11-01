import { NextRequest, NextResponse } from 'next/server';
import { sincronizarCatalogo } from '@/lib/ventas-vendedores/catalogo';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Copia diaria del catálogo Klixmant (módulo Ventas Vendedores). Cron con ?secret=CRON_SECRET. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const ok = req.headers.get('authorization') === `Bearer ${secret}` || req.nextUrl.searchParams.get('secret') === secret;
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  const r = await sincronizarCatalogo('cron');
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}

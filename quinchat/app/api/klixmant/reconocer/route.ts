import { NextRequest, NextResponse } from 'next/server';
import { haySesion } from '@/lib/live/admin-guard';
import { reconocerCatalogo } from '@/lib/klixmant-catalogos';

/**
 * GET ?texto=…&categorias=EQUIPOS,MOTOS → { candidatos, dudoso, muestra }. Solo lee.
 * Ejemplo: /api/klixmant/reconocer?texto=tienen el de nacional en negro
 */
export async function GET(req: NextRequest) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const texto = (q.get('texto') ?? '').slice(0, 500);
  if (!texto.trim()) return NextResponse.json({ error: 'Falta el texto.' }, { status: 400 });
  const categorias = q.get('categorias')?.split(',').map(s => s.trim()).filter(Boolean);
  const r = await reconocerCatalogo(texto, categorias);
  return NextResponse.json(r, { status: r.error ? 502 : 200 });
}

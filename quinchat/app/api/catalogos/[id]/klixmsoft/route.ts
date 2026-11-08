import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { traerFotosKlixmsoft } from '@/lib/catalogo-klixmsoft-fotos';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/catalogos/[id]/klixmsoft  { nombre_klixmsoft, solo_nombre? }
 *  - Guarda el «Nombre en KlixmSoft» del catálogo (la familia de QuinChat no cambia).
 *  - Si no es solo_nombre: reemplaza la foto de cada color por la foto ROTULADA de KlixmSoft.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const r = await traerFotosKlixmsoft(id, String(b?.nombre_klixmsoft ?? ''), b?.solo_nombre === true);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

import { NextResponse } from 'next/server';
import { haySesion } from '@/lib/live/admin-guard';
import { leerCatalogosKlixmant } from '@/lib/klixmant-catalogos';

/** Vista previa de los catálogos de Klixmant. Solo lee; no guarda nada. */
export async function GET() {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const r = await leerCatalogosKlixmant();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}

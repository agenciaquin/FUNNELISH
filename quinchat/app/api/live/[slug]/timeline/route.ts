import { NextResponse } from 'next/server';
import { timelineDeLive } from '@/lib/live/datos-supabase';

export const dynamic = 'force-dynamic';

// Línea de tiempo de un live (JSON que consume useTimeline en el navegador).
// Público pero de solo lectura; nunca expone la base directamente.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const linea = await timelineDeLive(slug);
  if (!linea) return NextResponse.json({ version: 1, duracion: 180, eventos: [] });
  return NextResponse.json(linea);
}

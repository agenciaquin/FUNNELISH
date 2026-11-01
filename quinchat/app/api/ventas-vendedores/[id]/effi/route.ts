import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { subirAEffi } from '@/lib/ventas-vendedores/effi';

export const dynamic = 'force-dynamic';

/** Subir la preventa a Effi (hoy: simulación). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  const r = await subirAEffi(id, session?.user?.name || session?.user?.email || 'panel');
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

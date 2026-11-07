import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { subirAEffi } from '@/lib/ventas-vendedores/effi';

export const dynamic = 'force-dynamic';

/** Subir la preventa a Effi (hoy: simulación). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const session = await getServerSession(authOptions);
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  // enviar:true = envío REAL (segundo paso, tras ver la vista previa). Sin él, solo vista previa.
  const r = await subirAEffi(id, session?.user?.name || session?.user?.email || 'panel', b?.enviar === true);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

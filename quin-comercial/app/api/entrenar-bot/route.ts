import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { interpretarEntrenamiento, aplicarPropuesta, type Propuesta } from '@/lib/entrenador-bot';

export const dynamic = 'force-dynamic';

/**
 * Entrenador del bot (GRATIS para el cliente — corre con la llave de la agencia).
 * Dos acciones:
 *  - accion:'interpretar' { mensaje, historial?, contexto? } → { reply, propuestas } (NO guarda)
 *  - accion:'aplicar' { propuestas:[...] } → guarda las reglas confirmadas → { ok, guardadas }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'Sin empresa' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const accion = String(body?.accion ?? 'interpretar');

  if (accion === 'aplicar') {
    const propuestas: Propuesta[] = Array.isArray(body?.propuestas) ? body.propuestas : [];
    if (!propuestas.length) return NextResponse.json({ error: 'No hay nada que guardar.' }, { status: 400 });
    let guardadas = 0;
    const errores: string[] = [];
    for (const p of propuestas.slice(0, 8)) {
      const r = await aplicarPropuesta(tid, p);
      if (r.ok) guardadas++; else if (r.error) errores.push(r.error);
    }
    return NextResponse.json({ ok: guardadas > 0, guardadas, errores });
  }

  // accion === 'interpretar'
  const mensaje = String(body?.mensaje ?? '').trim();
  if (!mensaje) return NextResponse.json({ error: 'Escribe un mensaje.' }, { status: 400 });
  const historial = Array.isArray(body?.historial) ? body.historial : [];
  const contexto = typeof body?.contexto === 'string' ? body.contexto : null;

  const res = await interpretarEntrenamiento({ tid, mensaje, historial, contexto });
  return NextResponse.json(res);
}

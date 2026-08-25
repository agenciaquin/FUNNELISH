import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { proveedorDe, llamarProveedor } from '@/lib/ia-proveedores';

export const dynamic = 'force-dynamic';

/** POST { proveedor, api_key, modelo? } → prueba la llave con un mensaje mínimo. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  if (!(await tenantActual())) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const info = proveedorDe(String(b?.proveedor ?? ''));
  if (!info) return NextResponse.json({ error: 'proveedor inválido' }, { status: 400 });
  if (!b?.api_key) return NextResponse.json({ error: 'falta la API key' }, { status: 400 });

  try {
    const { texto } = await llamarProveedor(info, String(b.api_key), (b.modelo || info.modeloDefault), [{ role: 'user', content: 'Responde solo con: OK' }], 20);
    return NextResponse.json({ ok: true, muestra: (texto || '').slice(0, 40) });
  } catch (e: any) {
    const st = e?.status;
    const msg = st === 401 || st === 403 ? 'Llave inválida' : st === 429 ? 'Sin cuota ahora mismo (429)' : (e?.message || 'No respondió');
    return NextResponse.json({ ok: false, status: st ?? 0, error: msg });
  }
}

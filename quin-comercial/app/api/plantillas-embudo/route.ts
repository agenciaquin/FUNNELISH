import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Plantillas de embudo.
 * GET → { esAdmin, plantillas, misEmbudos }.
 *   - plantillas: embudos marcados como plantilla (visibles para TODOS los clientes).
 *   - misEmbudos: solo para super-admin, sus embudos para poder marcar cuáles son plantilla.
 * Pasa por el servidor (service_role) porque las plantillas viven en el tenant de la
 * agencia y deben verlas todos los clientes (RLS no lo permitiría desde el navegador).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  const esAdmin = (session as any).rol === 'superadmin';

  const admin = createServerSupabaseClient();

  const { data: plantillas, error } = await admin
    .from('funnels')
    .select('id, slug, producto, precio, imagenes, es_plantilla')
    .eq('es_plantilla', true)
    .order('producto');

  // Si la columna es_plantilla aún no existe (falta correr la migración), no rompas:
  if (error) {
    if (/column .*es_plantilla.* does not exist/i.test(error.message)) {
      return NextResponse.json({ esAdmin, plantillas: [], misEmbudos: [], faltaMigracion: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let misEmbudos: any[] = [];
  if (esAdmin && tid) {
    const { data } = await admin
      .from('funnels')
      .select('id, slug, producto, es_plantilla')
      .eq('tenant_id', tid)
      .order('creado_at', { ascending: false });
    misEmbudos = data ?? [];
  }

  return NextResponse.json({ esAdmin, plantillas: plantillas ?? [], misEmbudos });
}

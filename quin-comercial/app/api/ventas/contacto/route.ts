import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * Marca / desmarca "mensaje enviado al cliente" en el panel Estado en Effi.
 *   POST { id, marcado: boolean }
 *  - marcado=true  → contacto_at = ahora (ya se le escribió).
 *  - marcado=false → contacto_at = null  (aún no).
 */
export async function POST(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id, marcado } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const contacto_at = marcado ? new Date().toISOString() : null;

  const { error } = await supabase
    .from('clientes_funnelish')
    .update({ contacto_at })
    .eq('id', id)
    .eq('tenant_id', tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, contacto_at });
}

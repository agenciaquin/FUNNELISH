import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { ajustesDescuento, fotoPlantilla } from '@/lib/descuento-entrega';
import { listarPlantillas } from '@/lib/whatsapp-templates';

export const dynamic = 'force-dynamic';

/** Estado del descuento por entrega: interruptor, plantilla y últimos envíos. */
export async function GET() {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const supabase = createServerSupabaseClient();
  const cfg = await ajustesDescuento(supabase);
  let plantillaEstado = 'no existe';
  let pideFoto = false;
  try {
    const { plantillas } = await listarPlantillas();
    const t = (plantillas ?? []).find(p => p.name === cfg.plantilla);
    if (t) { plantillaEstado = t.status; pideFoto = t.tieneImagen; }
  } catch { plantillaEstado = 'desconocido'; }
  const foto = await fotoPlantilla(supabase, cfg.plantilla);
  const { data: ultimos } = await supabase.from('descuentos_entrega')
    .select('guia, telefono, nombre, estado, motivo, enviado_at, creado_at').order('creado_at', { ascending: false }).limit(50);
  const { count: enviados } = await supabase.from('descuentos_entrega').select('guia', { count: 'exact', head: true }).eq('estado', 'enviado');
  return NextResponse.json({ ...cfg, plantillaEstado, pideFoto, foto, enviados: enviados ?? 0, ultimos: ultimos ?? [] });
}

/** { activo } — al encender se guarda `desde`: solo cuentan las entregas de ahí en adelante. */
export async function POST(req: NextRequest) {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const supabase = createServerSupabaseClient();
  const actual = await ajustesDescuento(supabase);
  const activo = b?.activo === true;
  const valor = { ...actual, activo, ...(activo && !actual.activo ? { desde: new Date().toISOString() } : {}) };
  await supabase.from('ajustes_bot').upsert({ clave: 'descuento_entrega', valor, actualizado_at: new Date().toISOString() }, { onConflict: 'clave' });
  return NextResponse.json({ ok: true, ...valor });
}

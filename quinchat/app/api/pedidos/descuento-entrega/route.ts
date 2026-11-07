import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { ajustesDescuento, fotoPlantilla } from '@/lib/descuento-entrega';
import { listarPlantillas } from '@/lib/whatsapp-templates';

export const dynamic = 'force-dynamic';

/** Estado del descuento por entrega: interruptor, plantilla y últimos envíos. */
export async function GET(req: NextRequest) {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const supabase = createServerSupabaseClient();
  const cfg = await ajustesDescuento(supabase);
  let plantillaEstado = 'no existe';
  let pideFoto = false;
  try {
    const { plantillas } = await listarPlantillas();
    const v2 = (plantillas ?? []).find(p => p.name === `${cfg.plantilla}_v2` && p.status === 'APPROVED');
    const t = v2 ?? (plantillas ?? []).find(p => p.name === cfg.plantilla);
    if (t) { plantillaEstado = t.status; pideFoto = t.tieneImagen; cfg.plantilla = t.name; }
  } catch { plantillaEstado = 'desconocido'; }
  const foto = await fotoPlantilla(supabase, cfg.plantilla);  // de la plantilla en uso (v2 si ya está aprobada)
  const { data: ultimos } = await supabase.from('descuentos_entrega')
    .select('guia, telefono, nombre, estado, motivo, enviado_at, creado_at').order('creado_at', { ascending: false }).limit(50);
  const { count: enviados } = await supabase.from('descuentos_entrega').select('guia', { count: 'exact', head: true }).eq('estado', 'enviado');
  // Resumen por CLIENTE (un cliente puede tener varias guías) + lista completa si se pide
  const { data: todos } = await supabase.from('descuentos_entrega')
    .select('guia, telefono, nombre, estado, motivo, monto, enviado_at, creado_at, usado_at')
    .order('creado_at', { ascending: false }).limit(5000);
  const filas = todos ?? [];
  const resumen = {
    clientes: new Set(filas.filter(f => f.estado === 'enviado').map(f => f.telefono)).size,
    enviados: filas.filter(f => f.estado === 'enviado').length,
    omitidos: filas.filter(f => f.estado === 'omitido').length,
    errores: filas.filter(f => f.estado === 'error').length,
    usados: filas.filter(f => f.usado_at).length,
    hoy: filas.filter(f => f.estado === 'enviado' && f.enviado_at && new Date(Date.parse(f.enviado_at) - 5 * 3600_000).toISOString().slice(0, 10) === new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10)).length,
  };
  const lista = req.nextUrl.searchParams.get('lista') === '1' ? filas : undefined;
  return NextResponse.json({ ...cfg, plantillaEstado, pideFoto, foto, enviados: enviados ?? 0, ultimos: ultimos ?? [], resumen, lista });
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

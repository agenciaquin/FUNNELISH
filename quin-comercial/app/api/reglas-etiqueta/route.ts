import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';
import { sembrarReglasDefault } from '@/lib/reglas-etiqueta';

/** GET /api/reglas-etiqueta — lista las reglas de la empresa (siembra las de
 *  por defecto la primera vez para que funcione sin configurar nada). */
export async function GET() {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createServerSupabaseClient();
  let { data, error } = await supabase
    .from('reglas_etiqueta').select('*').eq('tenant_id', tid)
    .order('created_at', { ascending: true });

  if (error && /relation .*reglas_etiqueta.* does not exist/i.test(error.message)) {
    return NextResponse.json([]); // la migración aún no se corrió
  }
  if (!error && (!data || data.length === 0)) {
    await sembrarReglasDefault(supabase, tid);
    ({ data, error } = await supabase
      .from('reglas_etiqueta').select('*').eq('tenant_id', tid)
      .order('created_at', { ascending: true }));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/reglas-etiqueta — crear una regla nueva.
 *  Acepta {condicion, etiqueta} o {reglas:[{condicion,etiqueta}]} (bulk, lo usa Quino). */
export async function POST(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const entrada: any[] = Array.isArray(body?.reglas) ? body.reglas : [body];
  const filas = entrada
    .map(r => ({
      tenant_id: tid,
      condicion: String(r?.condicion ?? '').trim(),
      etiqueta:  String(r?.etiqueta ?? '').trim(),
      etiqueta_adicional: String(r?.etiqueta_adicional ?? '').trim() || null,
      activo:    r?.activo === false ? false : true,
    }))
    .filter(r => r.condicion && r.etiqueta);

  if (!filas.length) return NextResponse.json({ error: 'condicion y etiqueta requeridas' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  let { data, error } = await supabase.from('reglas_etiqueta').insert(filas).select('*');
  // Si la columna nueva aún no existe (migración sin correr), reintenta sin ella.
  if (error && /column .*etiqueta_adicional.* does not exist/i.test(error.message)) {
    const sinAdic = filas.map(({ etiqueta_adicional, ...rest }) => rest);
    ({ data, error } = await supabase.from('reglas_etiqueta').insert(sinAdic).select('*'));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], { status: 201 });
}

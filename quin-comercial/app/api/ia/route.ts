import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';
import { encriptar, mascara, desencriptar } from '@/lib/cripto';
import { PROVEEDORES, proveedorDe } from '@/lib/ia-proveedores';

export const dynamic = 'force-dynamic';

/** GET → catálogo de proveedores + integraciones (enmascaradas) + modo de respaldo.
 *  Ahora cada integración es una FILA independiente (con su `id`), así se pueden
 *  tener varias llaves del mismo proveedor (ej. dos Groq). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  const admin = createServerSupabaseClient();
  let integraciones: any[] = [];
  try {
    const { data } = await admin.from('ai_integraciones').select('*').eq('tenant_id', tid).order('prioridad', { ascending: true });
    integraciones = (data ?? []).map((x: any) => ({
      id: x.id, proveedor: x.proveedor, etiqueta: x.etiqueta ?? null,
      modelo: x.modelo, prioridad: x.prioridad, activo: x.activo,
      estado: x.estado, mask: mascara(desencriptar(x.api_key_cifrada)),
      soporta_vision: x.soporta_vision ?? null, modelo_vision: x.modelo_vision ?? null,
      // Uso / límites para la barra "cuánto lleva y cuánto le queda".
      rl_limite: x.rl_limite ?? null, rl_restante: x.rl_restante ?? null,
      rl_unidad: x.rl_unidad ?? null, rl_reset_at: x.rl_reset_at ?? null,
      rl_fuente: x.rl_fuente ?? null, uso_hoy: x.uso_hoy ?? 0,
    }));
  } catch { integraciones = []; }

  let ia_respaldo = 'creditos';
  try { const { data: t } = await admin.from('tenants').select('ia_respaldo').eq('id', tid).maybeSingle(); ia_respaldo = t?.ia_respaldo ?? 'creditos'; } catch {}

  return NextResponse.json({
    proveedores: PROVEEDORES.map(p => ({
      id: p.id, nombre: p.nombre, gratis: p.gratis, modeloDefault: p.modeloDefault, ayuda: p.ayuda,
      soportaVision: p.soportaVision ?? false, modeloVision: p.modeloVision ?? null,
      soportaAudio: p.soportaAudio ?? false, modeloAudio: p.modeloAudio ?? null,
      recomendado: p.recomendado ?? false,
    })),
    integraciones, ia_respaldo,
  });
}

/** POST → crear o actualizar UNA llave.
 *  Body { id?, proveedor, api_key?, modelo?, etiqueta?, activo?, soporta_vision?, modelo_vision? }
 *  - Con `id` → actualiza esa fila.
 *  - Sin `id` → crea una fila nueva (permite varias del mismo proveedor). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const info = proveedorDe(String(b?.proveedor ?? ''));
  if (!info) return NextResponse.json({ error: 'proveedor inválido' }, { status: 400 });

  const admin = createServerSupabaseClient();

  const fila: any = {};
  if (b.modelo !== undefined) fila.modelo = (b.modelo || info.modeloDefault);
  if (typeof b.activo === 'boolean') fila.activo = b.activo;
  if (typeof b.etiqueta === 'string') fila.etiqueta = b.etiqueta.trim() || null;
  if (typeof b.soporta_vision === 'boolean') fila.soporta_vision = b.soporta_vision;
  if (b.modelo_vision !== undefined) fila.modelo_vision = (String(b.modelo_vision).trim() || null);
  if (b.api_key) { fila.api_key_cifrada = encriptar(String(b.api_key)); fila.estado = 'activa'; fila.enfriada_hasta = null; }

  // ── Actualizar una llave existente (por id) ──
  if (b.id) {
    const { data: row } = await admin.from('ai_integraciones').select('id').eq('tenant_id', tid).eq('id', b.id).maybeSingle();
    if (!row) return NextResponse.json({ error: 'llave no encontrada' }, { status: 404 });
    const { error } = await admin.from('ai_integraciones').update(fila).eq('id', b.id).eq('tenant_id', tid);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Compatibilidad: sin id, si ya existe UNA sola fila de ese proveedor y no
  //    piden explícitamente una nueva (nueva !== true), se actualiza esa. ──
  if (!b.nueva) {
    const { data: existentes } = await admin.from('ai_integraciones').select('id').eq('tenant_id', tid).eq('proveedor', info.id);
    if ((existentes?.length ?? 0) === 1) {
      const { error } = await admin.from('ai_integraciones').update(fila).eq('id', existentes![0].id).eq('tenant_id', tid);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
  }

  // ── Crear una fila nueva ──
  if (!b.api_key) return NextResponse.json({ error: 'Falta la API key.' }, { status: 400 });
  fila.tenant_id = tid;
  fila.proveedor = info.id;
  if (fila.modelo === undefined) fila.modelo = info.modeloDefault;
  if (fila.soporta_vision === undefined) fila.soporta_vision = info.soportaVision ?? false;
  // Etiqueta automática si no la mandan: "Groq #2", etc.
  if (!fila.etiqueta) {
    const { count: nDelProv } = await admin.from('ai_integraciones').select('*', { count: 'exact', head: true }).eq('tenant_id', tid).eq('proveedor', info.id);
    fila.etiqueta = `${info.nombre} #${(nDelProv ?? 0) + 1}`;
  }
  const { count } = await admin.from('ai_integraciones').select('*', { count: 'exact', head: true }).eq('tenant_id', tid);
  fila.prioridad = (count ?? 0) + 1;
  const { error } = await admin.from('ai_integraciones').insert(fila);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** PATCH → reordenar prioridad { orden: [id,...] } o modo de respaldo { ia_respaldo }. */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const admin = createServerSupabaseClient();

  if (Array.isArray(b?.orden)) {
    let i = 1;
    for (const id of b.orden) {
      await admin.from('ai_integraciones').update({ prioridad: i++ }).eq('tenant_id', tid).eq('id', String(id));
    }
  }
  // NOTA: el modo de respaldo con IA de agencia (ia_respaldo) YA NO se cambia
  // desde aquí. Es un permiso que controla el super-admin por empresa
  // (ver /api/admin/tenants). El cliente no puede activárselo solo.
  return NextResponse.json({ ok: true });
}

/** DELETE ?id= → quitar una llave (por id). Mantiene ?proveedor= por compatibilidad. */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });
  const admin = createServerSupabaseClient();

  const id = req.nextUrl.searchParams.get('id');
  if (id) { await admin.from('ai_integraciones').delete().eq('tenant_id', tid).eq('id', id); return NextResponse.json({ ok: true }); }

  const prov = req.nextUrl.searchParams.get('proveedor');
  if (prov) { await admin.from('ai_integraciones').delete().eq('tenant_id', tid).eq('proveedor', prov); return NextResponse.json({ ok: true }); }

  return NextResponse.json({ error: 'falta id' }, { status: 400 });
}

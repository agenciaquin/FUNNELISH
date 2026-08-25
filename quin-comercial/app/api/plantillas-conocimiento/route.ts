import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';
import { PLANTILLAS_SEED, detectarCampos } from '@/lib/plantillas-conocimiento';

export const dynamic = 'force-dynamic';

const camposDe = (contenido: string, campos?: any[]) =>
  (Array.isArray(campos) && campos.length)
    ? campos
    : detectarCampos(contenido).map((clave: string) => ({ clave, etiqueta: clave.replace(/_/g, ' ').toLowerCase() }));

// Carga las plantillas semilla (BASE) la primera vez (por nombre, para no duplicar).
async function asegurarSemillas(admin: any) {
  try {
    const { data: existentes } = await admin.from('plantillas_conocimiento').select('nombre');
    const nombres = new Set((existentes ?? []).map((x: any) => x.nombre));
    const faltan = PLANTILLAS_SEED.filter(p => !nombres.has(p.nombre));
    if (faltan.length) {
      await admin.from('plantillas_conocimiento').insert(
        // tenant_id se queda NULL → son plantillas BASE de la agencia.
        faltan.map(p => ({ nombre: p.nombre, descripcion: p.descripcion, contenido: p.contenido, campos: p.campos, origen: 'sistema' })),
      );
    }
  } catch { /* si la tabla aún no existe, la lista saldrá vacía */ }
}

/** GET → plantillas BASE (de la agencia) + las propias de esta empresa. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  const esSuperadmin = (session as any)?.rol === 'superadmin';

  const admin = createServerSupabaseClient();
  await asegurarSemillas(admin);

  let filas: any[] = [];
  try {
    let q = admin.from('plantillas_conocimiento').select('*').order('creado_at', { ascending: true });
    // Cada quien ve las BASE (tenant_id null) + las suyas.
    q = tid ? q.or(`tenant_id.is.null,tenant_id.eq.${tid}`) : q.is('tenant_id', null);
    const { data } = await q;
    filas = data ?? [];
  } catch {
    // Si la columna tenant_id aún no existe, mostramos todas (compatibilidad).
    try { const { data } = await admin.from('plantillas_conocimiento').select('*').order('creado_at', { ascending: true }); filas = data ?? []; } catch { filas = []; }
  }

  const plantillas = filas.map((p: any) => {
    const esBase = !p.tenant_id;
    return {
      ...p,
      es_base: esBase,
      // La BASE solo la edita el super-admin; la propia, su dueña.
      editable: esBase ? esSuperadmin : (p.tenant_id === tid),
    };
  });

  return NextResponse.json({ plantillas, esSuperadmin });
}

/** POST → crear una plantilla nueva, o DUPLICAR una existente a una copia propia.
 *  Crear: super-admin → BASE (tenant_id null); cliente → propia (tenant_id).
 *  Duplicar: body { duplicar: <id> } → copia editable con el tenant del usuario. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  const esSuperadmin = (session as any)?.rol === 'superadmin';

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const admin = createServerSupabaseClient();

  // ── DUPLICAR: cualquier usuario puede llevarse una copia editable ──
  if (b?.duplicar) {
    const { data: src } = await admin.from('plantillas_conocimiento').select('*').eq('id', String(b.duplicar)).maybeSingle();
    if (!src) return NextResponse.json({ error: 'La plantilla a duplicar no existe.' }, { status: 404 });
    const { data, error } = await admin.from('plantillas_conocimiento')
      .insert({
        nombre: `${src.nombre} (mi copia)`,
        descripcion: src.descripcion,
        contenido: src.contenido,
        campos: src.campos,
        origen: 'usuario',
        tenant_id: tid,   // la copia queda a nombre de esta empresa → editable por ella
      })
      .select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id, duplicada: true });
  }

  // ── CREAR nueva ──
  const nombre = String(b?.nombre ?? '').trim();
  const contenido = String(b?.contenido ?? '').trim();
  if (!nombre || !contenido) return NextResponse.json({ error: 'Faltan nombre o contenido.' }, { status: 400 });

  const { data, error } = await admin.from('plantillas_conocimiento')
    .insert({
      nombre,
      descripcion: String(b?.descripcion ?? '').trim() || null,
      contenido,
      campos: camposDe(contenido, b?.campos),
      // super-admin arma la BASE compartida; el cliente arma la suya propia.
      origen: esSuperadmin ? 'sistema' : 'usuario',
      tenant_id: esSuperadmin ? null : tid,
    })
    .select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}

/** PUT → editar una plantilla (con permisos). */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  const esSuperadmin = (session as any)?.rol === 'superadmin';

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const id = String(b?.id ?? '');
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  const admin = createServerSupabaseClient();
  const { data: t } = await admin.from('plantillas_conocimiento').select('tenant_id').eq('id', id).maybeSingle();
  if (!t) return NextResponse.json({ error: 'La plantilla no existe.' }, { status: 404 });
  const esBase = !t.tenant_id;
  if (esBase && !esSuperadmin) return NextResponse.json({ error: 'Solo el administrador puede editar las plantillas base. Duplícala para tener tu propia copia editable.' }, { status: 403 });
  if (!esBase && t.tenant_id !== tid) return NextResponse.json({ error: 'No puedes editar una plantilla de otra empresa.' }, { status: 403 });

  const patch: any = {};
  if (typeof b.nombre === 'string') patch.nombre = b.nombre.trim();
  if (typeof b.descripcion === 'string') patch.descripcion = b.descripcion.trim() || null;
  if (typeof b.contenido === 'string') { patch.contenido = b.contenido; patch.campos = camposDe(b.contenido, b?.campos); }
  else if (Array.isArray(b?.campos)) patch.campos = b.campos;

  const { error } = await admin.from('plantillas_conocimiento').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE ?id= → eliminar una plantilla (con permisos). */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  const esSuperadmin = (session as any)?.rol === 'superadmin';

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  const admin = createServerSupabaseClient();
  const { data: t } = await admin.from('plantillas_conocimiento').select('tenant_id').eq('id', id).maybeSingle();
  if (!t) return NextResponse.json({ ok: true });
  const esBase = !t.tenant_id;
  if (esBase && !esSuperadmin) return NextResponse.json({ error: 'Solo el administrador puede eliminar las plantillas base.' }, { status: 403 });
  if (!esBase && t.tenant_id !== tid) return NextResponse.json({ error: 'No puedes eliminar una plantilla de otra empresa.' }, { status: 403 });

  await admin.from('plantillas_conocimiento').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}

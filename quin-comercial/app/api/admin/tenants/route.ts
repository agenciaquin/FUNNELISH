import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { hashPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

/**
 * Administración de EMPRESAS (solo super-admin).
 * Sirve para dar de alta un cliente nuevo (empresa + su usuario de login) SIN SQL.
 * Todo pasa por el servidor (service_role); se verifica el rol en el servidor.
 *
 * GET  → lista de empresas (para la pantalla de admin).
 * POST → crea empresa + su primer usuario. Body:
 *        { nombre, slug, usuario: { email, password, nombre } }
 */

async function soloSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: 'no autorizado', status: 401 as const };
  if ((session as any).rol !== 'superadmin') return { error: 'requiere super-admin', status: 403 as const };
  return { ok: true as const };
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export async function GET() {
  const guard = await soloSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createServerSupabaseClient();
  let data: any[] | null = null;
  let error: any = null;
  ({ data, error } = await admin
    .from('tenants')
    .select('id, nombre, slug, activo, creado_at, wa_phone_number_id, ia_respaldo, conversaciones_usadas')
    .order('creado_at', { ascending: false }));
  // Si falta alguna columna nueva en algún despliegue, reintenta sin ellas.
  if (error && /conversaciones_usadas/i.test(String(error.message ?? ''))) {
    ({ data, error } = await admin
      .from('tenants')
      .select('id, nombre, slug, activo, creado_at, wa_phone_number_id, ia_respaldo')
      .order('creado_at', { ascending: false }));
  }
  if (error && /ia_respaldo/i.test(String(error.message ?? ''))) {
    ({ data, error } = await admin
      .from('tenants')
      .select('id, nombre, slug, activo, creado_at, wa_phone_number_id')
      .order('creado_at', { ascending: false }));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Conteo de usuarios por empresa (para mostrar cuántos logins tiene cada una)
  const { data: uss } = await admin.from('usuarios').select('tenant_id');
  const conteo: Record<string, number> = {};
  for (const u of uss ?? []) {
    const t = String((u as any).tenant_id ?? '');
    if (t) conteo[t] = (conteo[t] ?? 0) + 1;
  }

  const empresas = (data ?? []).map((t: any) => ({
    id: t.id,
    nombre: t.nombre,
    slug: t.slug,
    activo: t.activo,
    creado_at: t.creado_at,
    wa_conectado: !!t.wa_phone_number_id,
    usuarios: conteo[String(t.id)] ?? 0,
    // Conversaciones atendidas por el bot (acumulado) → estadística de uso.
    conversaciones: Number(t.conversaciones_usadas ?? 0),
    // Acceso a la IA de agencia: ON si no está 'apagado' (null histórico = ON).
    ia_agencia: (t.ia_respaldo ?? 'creditos') !== 'apagado',
  }));
  return NextResponse.json({ empresas });
}

export async function POST(req: NextRequest) {
  const guard = await soloSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const nombre = String(body?.nombre ?? '').trim();
  const slug   = String(body?.slug ?? '').trim().toLowerCase();
  const uEmail = String(body?.usuario?.email ?? '').trim().toLowerCase();
  const uPass  = String(body?.usuario?.password ?? '');
  const uNom   = String(body?.usuario?.nombre ?? '').trim() || nombre;

  if (!nombre) return NextResponse.json({ error: 'Falta el nombre de la empresa' }, { status: 400 });
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: 'Slug inválido (usa minúsculas, números y guiones; 2–40)' }, { status: 400 });
  if (!uEmail || !uPass) return NextResponse.json({ error: 'Falta el correo o la contraseña del usuario' }, { status: 400 });
  if (uPass.length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });

  const admin = createServerSupabaseClient();

  // Slug único
  const { data: slugEx } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle();
  if (slugEx) return NextResponse.json({ error: `El slug "${slug}" ya está en uso` }, { status: 409 });

  // Correo único (no puede repetirse entre usuarios)
  const { data: mailEx } = await admin.from('usuarios').select('id').eq('email', uEmail).maybeSingle();
  if (mailEx) return NextResponse.json({ error: `El correo "${uEmail}" ya está registrado` }, { status: 409 });

  // Crear empresa (con 5 días de prueba gratis).
  // ia_respaldo:'apagado' → el cliente NUEVO arranca SIN acceso a la IA de
  // agencia; el dueño se lo activa a mano desde Empresas cuando quiera.
  const pruebaHasta = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
  let insT = await admin.from('tenants').insert({ nombre, slug, activo: true, prueba_hasta: pruebaHasta, ia_respaldo: 'apagado' }).select('id').single();
  if (insT.error && /column .*(prueba_hasta|ia_respaldo).* does not exist/i.test(insT.error.message)) {
    insT = await admin.from('tenants').insert({ nombre, slug, activo: true }).select('id').single();
  }
  const nuevo = insT.data; const eT = insT.error;
  if (eT || !nuevo) return NextResponse.json({ error: eT?.message ?? 'No se pudo crear la empresa' }, { status: 500 });

  // Crear su usuario de login (rol 'cliente')
  const { error: eU } = await admin.from('usuarios').insert({
    email: uEmail, password: hashPassword(uPass), nombre: uNom, rol: 'cliente', tenant_id: nuevo.id,
  });
  if (eU) {
    // Revertir la empresa si el usuario falla, para no dejar basura
    await admin.from('tenants').delete().eq('id', nuevo.id);
    return NextResponse.json({ error: 'No se pudo crear el usuario: ' + eU.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tenant_id: nuevo.id, slug });
}

/** PATCH → el super-admin activa/desactiva el acceso de una empresa a la IA de
 *  agencia. Body { id, ia_agencia: boolean }. Solo super-admin. */
export async function PATCH(req: NextRequest) {
  const guard = await soloSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const id = String(body?.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'falta id de empresa' }, { status: 400 });
  if (typeof body?.ia_agencia !== 'boolean') return NextResponse.json({ error: 'ia_agencia debe ser true/false' }, { status: 400 });

  const admin = createServerSupabaseClient();
  const modo = body.ia_agencia ? 'creditos' : 'apagado';
  const { error } = await admin.from('tenants').update({ ia_respaldo: modo }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ia_agencia: body.ia_agencia });
}

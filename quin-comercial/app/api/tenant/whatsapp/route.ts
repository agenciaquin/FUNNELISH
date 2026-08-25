import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Ajustes de WhatsApp de la EMPRESA logueada.
 * Pasa por el servidor (service_role) porque la tabla `tenants` no es accesible
 * desde el navegador (guarda tokens sensibles). Cada quien solo ve/edita SU empresa.
 *
 * GET  → devuelve la config actual (el access token viene enmascarado).
 * POST → guarda la config { wa_phone_number_id, wa_phone_number_id_ventas,
 *        wa_verify_token, wa_waba_id, wa_app_id, wa_access_token, nombre }.
 *        Campos vacíos NO se tocan; el access token solo se cambia si mandas uno nuevo.
 */

/** Enmascara un token: muestra solo los últimos 4 caracteres. */
function enmascarar(v: string | null | undefined): string {
  const s = String(v ?? '');
  if (!s) return '';
  return s.length <= 4 ? '••••' : `••••••••${s.slice(-4)}`;
}

// Número visible del bot (ej. +57 317…). Se lo preguntamos a Meta con el
// phone_number_id + token de la empresa, y lo guardamos en caché 6 h para no
// consultar en cada carga del panel.
const numCache = new Map<string, { v: string; hasta: number }>();
async function numeroDisplay(phoneId: string, token: string): Promise<{ num: string; debug: string }> {
  if (!phoneId || !token) return { num: '', debug: 'sin phoneId o token' };
  const ahora = Date.now();
  const c = numCache.get(phoneId);
  if (c && c.hasta > ahora) return { num: c.v, debug: 'cache' };
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}?fields=display_phone_number`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    const txt = await res.text();
    if (!res.ok) return { num: '', debug: `Meta ${res.status}: ${txt.slice(0, 300)}` };
    let d: any = {}; try { d = JSON.parse(txt); } catch {}
    const num = String(d?.display_phone_number ?? '').trim();
    if (num) numCache.set(phoneId, { v: num, hasta: ahora + 6 * 60 * 60 * 1000 });
    return { num, debug: num ? 'ok' : `respuesta sin display_phone_number: ${txt.slice(0, 200)}` };
  } catch (e: any) { return { num: '', debug: 'excepción: ' + String(e?.message ?? e).slice(0, 200) }; }
}

const CAMPOS = [
  'wa_phone_number_id',
  'wa_phone_number_id_ventas',
  'wa_verify_token',
  'wa_waba_id',
  'wa_app_id',
] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  const admin = createServerSupabaseClient();
  // Intenta traer también wa_numero (guardado desde los mensajes entrantes).
  let data: any = null; let error: any = null;
  ({ data, error } = await admin
    .from('tenants')
    .select('nombre, slug, activo, wa_numero, wa_numero_dueno, wa_phone_number_id, wa_phone_number_id_ventas, wa_verify_token, wa_waba_id, wa_app_id, wa_access_token')
    .eq('id', tid)
    .maybeSingle());
  if (error && /wa_numero/i.test(String(error.message ?? ''))) {
    ({ data, error } = await admin
      .from('tenants')
      .select('nombre, slug, activo, wa_phone_number_id, wa_phone_number_id_ventas, wa_verify_token, wa_waba_id, wa_app_id, wa_access_token')
      .eq('id', tid)
      .maybeSingle());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'empresa no encontrada' }, { status: 404 });

  // Número visible del bot: primero el guardado (de los mensajes entrantes, sin
  // permisos extra); si aún no hay, se intenta preguntar a Meta como respaldo.
  let wa_numero = String(data.wa_numero ?? '').trim();
  let wa_numero_debug = wa_numero ? 'guardado' : '';
  if (!wa_numero) {
    const rNum = await numeroDisplay(String(data.wa_phone_number_id ?? ''), String(data.wa_access_token ?? ''));
    wa_numero = rNum.num;
    wa_numero_debug = rNum.debug;
  }

  return NextResponse.json({
    nombre: data.nombre ?? '',
    slug: data.slug ?? '',
    activo: data.activo ?? true,
    wa_numero,
    wa_numero_debug,
    // Número del dueño donde el bot envía ventas y traspasos a humano.
    wa_numero_dueno: String(data.wa_numero_dueno ?? '').trim(),
    wa_phone_number_id: data.wa_phone_number_id ?? '',
    wa_phone_number_id_ventas: data.wa_phone_number_id_ventas ?? '',
    wa_verify_token: data.wa_verify_token ?? '',
    wa_waba_id: data.wa_waba_id ?? '',
    wa_app_id: data.wa_app_id ?? '',
    // Nunca devolvemos el token real: solo si está puesto y sus últimos 4.
    wa_access_token_set: !!data.wa_access_token,
    wa_access_token_masked: enmascarar(data.wa_access_token),
    // La URL del webhook que el cliente pega en Meta (por empresa, por su slug).
    webhook_url: `/api/whatsapp/webhook/${data.slug ?? ''}`,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const cambios: Record<string, string> = {};
  for (const campo of CAMPOS) {
    if (typeof body[campo] === 'string') cambios[campo] = String(body[campo]).trim();
  }
  if (typeof body.nombre === 'string' && body.nombre.trim()) cambios.nombre = String(body.nombre).trim();

  // Número del dueño (avisos de venta / traspaso a humano). Se guarda solo dígitos.
  // Se permite vaciarlo (para desvincular), por eso se acepta aunque venga "".
  if (typeof body.wa_numero_dueno === 'string') {
    cambios.wa_numero_dueno = String(body.wa_numero_dueno).replace(/\D/g, '');
  }

  // El access token solo se actualiza si viene uno nuevo NO vacío (para no borrarlo sin querer).
  if (typeof body.wa_access_token === 'string' && body.wa_access_token.trim()) {
    cambios.wa_access_token = String(body.wa_access_token).trim();
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: 'nada que actualizar' }, { status: 400 });
  }

  const admin = createServerSupabaseClient();
  const { error } = await admin.from('tenants').update(cambios).eq('id', tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, actualizados: Object.keys(cambios) });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { hashPassword } from '@/lib/password';
import { permitido } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function slugify(s: string): string {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 38);
}

async function slugLibre(admin: any, base: string): Promise<string> {
  let s = base || 'empresa';
  if (s.length < 2) s = 'empresa';
  for (let i = 0; i < 60; i++) {
    const cand = i === 0 ? s : `${s}-${i + 1}`;
    const { data } = await admin.from('tenants').select('id').eq('slug', cand).maybeSingle();
    if (!data) return cand;
  }
  return `${s}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Registro público (autoservicio): crea empresa + usuario 'cliente'.
 * No requiere sesión. El admin también puede crear cuentas desde el panel
 * (esa vía sigue en /api/admin/tenants). Body { nombre, email, password }.
 */
export async function POST(req: NextRequest) {
  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const nombre = String(b?.nombre ?? '').trim();
  const email  = String(b?.email ?? '').trim().toLowerCase();
  const pass   = String(b?.password ?? '');

  if (!nombre) return NextResponse.json({ error: 'Escribe el nombre de tu negocio.' }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Correo inválido.' }, { status: 400 });
  if (pass.length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });

  // Anti-abuso: máx 5 registros por hora por correo.
  if (!(await permitido(`registro:${email}`, 5, 3600))) {
    return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 });
  }

  const admin = createServerSupabaseClient();

  const { data: mailEx } = await admin.from('usuarios').select('id').eq('email', email).maybeSingle();
  if (mailEx) return NextResponse.json({ error: 'Ese correo ya está registrado. Inicia sesión.' }, { status: 409 });

  const slug = await slugLibre(admin, slugify(nombre));

  const pruebaHasta = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(); // 5 días gratis
  let ins = await admin.from('tenants').insert({ nombre, slug, activo: true, prueba_hasta: pruebaHasta }).select('id').single();
  if (ins.error && /column .*prueba_hasta.* does not exist/i.test(ins.error.message)) {
    ins = await admin.from('tenants').insert({ nombre, slug, activo: true }).select('id').single();
  }
  const nuevo = ins.data; const eT = ins.error;
  if (eT || !nuevo) return NextResponse.json({ error: eT?.message ?? 'No se pudo crear la cuenta.' }, { status: 500 });

  const { error: eU } = await admin.from('usuarios').insert({
    email, password: hashPassword(pass), nombre, rol: 'cliente', tenant_id: nuevo.id,
  });
  if (eU) {
    await admin.from('tenants').delete().eq('id', nuevo.id);
    return NextResponse.json({ error: 'No se pudo crear el usuario: ' + eU.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug });
}

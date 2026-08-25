import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET → devuelve el entrenamiento (system_prompt) de la empresa activa, filtrando
 * por tenant_id EXPLÍCITO. Antes el panel leía por el navegador sin filtrar y con
 * .single(): al haber 2+ empresas con prompt, fallaba y mostraba la plantilla por
 * defecto. Leyendo por servidor con el tenant explícito, siempre trae el correcto.
 */
// Claves permitidas: el entrenamiento principal y la memoria de comportamiento.
const CLAVES = new Set(['system_prompt', 'comportamiento']);
const claveDe = (k: any) => (CLAVES.has(String(k)) ? String(k) : 'system_prompt');

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  const key = claveDe(req.nextUrl.searchParams.get('key'));
  const admin = createServerSupabaseClient();
  const { data } = await admin
    .from('bot_config').select('value')
    .eq('tenant_id', tid).eq('key', key).maybeSingle();
  return NextResponse.json({ value: data?.value ?? null });
}

/**
 * Guarda el entrenamiento (system_prompt) del bot de la empresa activa.
 * Se hace en el SERVIDOR con service_role y tenant_id EXPLÍCITO, para que el
 * guardado nunca se pierda por temas de RLS/tenant del navegador.
 * Body: { value }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const value = String(b?.value ?? '');
  const key = claveDe(b?.key);
  if (!value.trim()) return NextResponse.json({ error: 'entrenamiento vacío' }, { status: 400 });

  const admin = createServerSupabaseClient();
  const { error } = await admin
    .from('bot_config')
    .upsert({ tenant_id: tid, key, value }, { onConflict: 'tenant_id,key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, guardado: value.length });
}

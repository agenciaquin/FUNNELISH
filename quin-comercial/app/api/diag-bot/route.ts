import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Diagnóstico del guardado del entrenamiento. Solo lectura, sin exponer secretos.
 * Dice: qué empresa ve el servidor, si hay system_prompt para esa empresa, y en
 * qué empresas están guardados los prompts (para ver si quedó en otro lado).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado (inicia sesión)' }, { status: 401 });
  const tid = await tenantActual();
  const admin = createServerSupabaseClient();

  const resumen = (v: any) => {
    const s = String(v ?? '');
    return { largo: s.length, inicio: s.slice(0, 70) };
  };

  // Empresa que ve el servidor
  let empresa: any = null;
  try {
    const { data } = await admin.from('tenants').select('id, slug, nombre').eq('id', tid).maybeSingle();
    empresa = data ?? null;
  } catch (e: any) { empresa = { error: e?.message }; }

  // Prompt de ESTA empresa
  let miPrompt: any = null;
  try {
    const { data } = await admin.from('bot_config').select('value, updated_at').eq('tenant_id', tid).eq('key', 'system_prompt').maybeSingle();
    miPrompt = data ? { existe: true, ...resumen(data.value), updated_at: data.updated_at } : { existe: false };
  } catch (e: any) { miPrompt = { error: e?.message }; }

  // TODOS los prompts guardados (en qué empresas están)
  let todos: any[] = [];
  try {
    const { data } = await admin.from('bot_config').select('tenant_id, value, updated_at').eq('key', 'system_prompt');
    todos = (data ?? []).map((r: any) => ({ tenant_id: r.tenant_id, largo: String(r.value ?? '').length, updated_at: r.updated_at }));
  } catch (e: any) { todos = [{ error: e?.message }]; }

  return NextResponse.json({
    sesion: { email: (session.user as any)?.email ?? null, tenantId_en_sesion: (session as any)?.tenantId ?? null },
    tenantActual_servidor: tid,
    empresa,
    jwt_secret_configurado: !!process.env.SUPABASE_JWT_SECRET,   // si es false, el panel no puede LEER (RLS)
    mi_system_prompt: miPrompt,
    todos_los_system_prompt: todos,
  });
}

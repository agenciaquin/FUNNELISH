import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/**
 * Guarda (o actualiza) la suscripción push de un dispositivo.
 * La llama el panel cuando el usuario activa los avisos.
 * MULTI-TENANT: la suscripción pertenece a la empresa del usuario logueado.
 */
export async function POST(req: NextRequest) {
  try {
    const tid = await tenantActual();
    if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const endpoint = body?.endpoint as string | undefined;
    const p256dh   = body?.keys?.p256dh as string | undefined;
    const auth     = body?.keys?.auth as string | undefined;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'suscripción incompleta' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Un dispositivo = un endpoint POR empresa. Si ya existe para este tenant, no duplicar.
    const { data: existente } = await supabase
      .from('push_subscriptions').select('id')
      .eq('endpoint', endpoint).eq('tenant_id', tid).maybeSingle();

    if (existente?.id) {
      await supabase.from('push_subscriptions')
        .update({ p256dh, auth }).eq('id', existente.id).eq('tenant_id', tid);
    } else {
      const { error } = await supabase.from('push_subscriptions').insert({
        endpoint, p256dh, auth, created_at: new Date().toISOString(), tenant_id: tid,
      });
      if (error) {
        console.error('[Push] insert suscripción error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 });
  }
}

/** Elimina la suscripción (cuando el usuario desactiva los avisos). */
export async function DELETE(req: NextRequest) {
  try {
    const tid = await tenantActual();
    if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: 'falta endpoint' }, { status: 400 });

    const supabase = createServerSupabaseClient();
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('tenant_id', tid);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 });
  }
}

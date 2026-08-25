import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Finaliza el registro del número de WhatsApp llamando directo a la API de Meta
 * (/register). Es más confiable que el botón "Registrarte" de la interfaz de Meta,
 * que falla seguido. Usa el Access Token + Phone Number ID ya guardados de la
 * empresa, más un PIN de 6 dígitos (verificación en dos pasos).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const pin = String(body?.pin ?? '').trim();
  if (!/^\d{6}$/.test(pin)) return NextResponse.json({ ok: false, error: 'El PIN debe ser de 6 dígitos.' });

  const admin = createServerSupabaseClient();
  const { data } = await admin.from('tenants').select('wa_phone_number_id, wa_access_token').eq('id', tid).maybeSingle();
  const phoneId = String(data?.wa_phone_number_id ?? '').trim();
  const token = String(data?.wa_access_token ?? '').trim();
  if (!phoneId) return NextResponse.json({ ok: false, error: 'Falta el Phone Number ID. Guárdalo arriba y dale Guardar primero.' });
  if (!token) return NextResponse.json({ ok: false, error: 'Falta el Access Token. Guárdalo arriba y dale Guardar primero.' });

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/register`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    });
    const d = await r.json().catch(() => ({} as any));

    if (r.ok && (d?.success === true || d?.success === 'true')) {
      return NextResponse.json({ ok: true });
    }
    const err = d?.error ?? {};
    const texto = String(err?.error_user_msg || err?.message || '');
    // "already registered" → lo tomamos como éxito (ya quedó).
    if (/already registered|ya (está|esta) registrad/i.test(texto)) {
      return NextResponse.json({ ok: true, yaEstaba: true });
    }
    return NextResponse.json({ ok: false, error: texto || 'Meta no completó el registro. Revisa PIN, token y Phone Number ID.' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Error conectando con Meta.' });
  }
}

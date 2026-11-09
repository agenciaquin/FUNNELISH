import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Mi Página → visita (PageView) a Meta por la API de conversiones (servidor). PÚBLICO, sin sesión.
 * Solo para páginas PUBLICADAS que tengan píxel + token. Usa el mismo event_id que el píxel del
 * navegador, así Meta no cuenta la visita dos veces. El token nunca sale del servidor.
 * body: { slug, event_id, url, fbp?, fbc? }
 */
const GRAPH = 'https://graph.facebook.com/v19.0';

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const slug = String(b?.slug ?? '').trim().toLowerCase();
  const eventId = String(b?.event_id ?? '').slice(0, 80);
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug) || !eventId) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: p } = await supabase.from('mi_pagina').select('publicada, publicado, meta_token').eq('slug', slug).maybeSingle();
  const pixel = String((p?.publicado as any)?.marca?.pixel_meta ?? '').replace(/\D/g, '');
  const token = String(p?.meta_token ?? '').trim();
  if (!p?.publicada || !pixel || !token) return NextResponse.json({ ok: false, motivo: 'sin-capi' });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || undefined;
  const ua = req.headers.get('user-agent') ?? undefined;
  const url = String(b?.url ?? '').startsWith('https://') ? String(b.url).slice(0, 500) : `https://pedido.klixmant.shop/web/${slug}`;
  const user_data: Record<string, unknown> = {};
  if (ip) user_data.client_ip_address = ip;
  if (ua) user_data.client_user_agent = ua;
  if (typeof b?.fbp === 'string' && b.fbp.startsWith('fb.')) user_data.fbp = b.fbp.slice(0, 200);
  if (typeof b?.fbc === 'string' && b.fbc.startsWith('fb.')) user_data.fbc = b.fbc.slice(0, 300);

  try {
    const res = await fetch(`${GRAPH}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [{
        event_name: 'PageView', event_time: Math.floor(Date.now() / 1000), event_id: eventId,
        action_source: 'website', event_source_url: url, user_data,
      }] }),
    });
    if (!res.ok) { console.warn('[MiPagina CAPI]', (await res.text()).slice(0, 300)); return NextResponse.json({ ok: false }); }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.warn('[MiPagina CAPI] red', e);
    return NextResponse.json({ ok: false });
  }
}

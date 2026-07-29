import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { createHash } from 'node:crypto';

export const dynamic = 'force-dynamic';

/**
 * Prueba la conexión con Meta (Conversions API) para un embudo.
 * Manda un evento de compra de prueba y devuelve TAL CUAL lo que responde Meta,
 * para saber si el token sirve y si el evento se está recibiendo.
 *
 * Uso: /api/funnels/probar-capi?slug=red-bull
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'Falta ?slug=' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: f } = await supabase
    .from('funnels').select('slug, producto, precio, pixel_meta, pixel_meta_token')
    .eq('slug', slug).maybeSingle();

  if (!f) return NextResponse.json({ error: `No existe el embudo "${slug}"` }, { status: 404 });

  const diagnostico: Record<string, unknown> = {
    embudo: f.slug,
    tienePixelId: !!f.pixel_meta,
    pixelId: f.pixel_meta ?? null,
    tieneToken: !!f.pixel_meta_token,
    largoDelToken: f.pixel_meta_token ? String(f.pixel_meta_token).length : 0,
  };

  if (!f.pixel_meta || !f.pixel_meta_token) {
    return NextResponse.json({
      ...diagnostico,
      resultado: '❌ Falta el ID del píxel o el token en este embudo.',
    });
  }

  const hash = (v: string) => createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
  const body = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: `prueba-${Date.now()}`,
      action_source: 'website',
      event_source_url: `https://pedido.klixmant.shop/${f.slug}`,
      user_data: {
        ph: [hash('573001234567')],
        country: [hash('co')],
      },
      custom_data: { currency: 'COP', value: Number(f.precio ?? 1000), content_name: 'PRUEBA' },
    }],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${f.pixel_meta}/events?access_token=${encodeURIComponent(String(f.pixel_meta_token))}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
    const texto = await res.text();
    return NextResponse.json({
      ...diagnostico,
      estadoHttp: res.status,
      respuestaDeMeta: texto,
      resultado: res.ok
        ? '✅ Meta ACEPTÓ el evento de prueba. El token sirve.'
        : '❌ Meta RECHAZÓ el evento. Mira "respuestaDeMeta" para el motivo.',
    });
  } catch (e: any) {
    return NextResponse.json({ ...diagnostico, resultado: `❌ Error de red: ${e?.message}` });
  }
}

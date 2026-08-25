import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Beacon PÚBLICO: cada página del embudo avisa por qué paso pasó el visitante.
// No requiere sesión (los clientes son anónimos). El tenant se deriva del
// embudo (por su slug) en el servidor — nunca se confía en el cliente.
const PASOS = new Set(['landing', 'scroll_fin', 'pedido', 'talla', 'datos', 'boton', 'compra']);

export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 200 }); }

  const slug = String(b?.slug ?? '').trim().toLowerCase();
  const paso = String(b?.paso ?? '').trim().toLowerCase();
  if (!slug || !PASOS.has(paso)) return NextResponse.json({ ok: false }, { status: 200 });

  try {
    const admin = createServerSupabaseClient();
    // Deriva el tenant dueño del embudo desde el slug (no del cliente).
    const { data: f } = await admin.from('funnels').select('tenant_id').eq('slug', slug).maybeSingle();

    await admin.from('funnel_eventos').insert({
      tenant_id: f?.tenant_id ?? null,
      slug,
      paso,
      referencia: b?.referencia ? String(b.referencia).slice(0, 120) : null,
      utm_source: b?.utm_source ? String(b.utm_source).slice(0, 120) : null,
      utm_medium: b?.utm_medium ? String(b.utm_medium).slice(0, 120) : null,
      utm_campaign: b?.utm_campaign ? String(b.utm_campaign).slice(0, 160) : null,
      referrer: b?.referrer ? String(b.referrer).slice(0, 300) : null,
    });
  } catch { /* nunca romper la página del cliente por registrar un evento */ }

  return NextResponse.json({ ok: true }, { status: 200 });
}

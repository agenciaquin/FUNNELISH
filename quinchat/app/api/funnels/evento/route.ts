import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Beacon PÚBLICO: cada página del embudo avisa por qué paso pasó el visitante.
const PASOS = new Set(['landing', 'scroll_fin', 'pedido', 'talla', 'datos', 'boton', 'compra']);

export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 200 }); }

  const slug = String(b?.slug ?? '').trim().toLowerCase();
  const paso = String(b?.paso ?? '').trim().toLowerCase();
  if (!slug || !PASOS.has(paso)) return NextResponse.json({ ok: false }, { status: 200 });

  try {
    const admin = createServerSupabaseClient();
    await admin.from('funnel_eventos').insert({
      slug,
      paso,
      utm_source: b?.utm_source ? String(b.utm_source).slice(0, 120) : null,
      utm_medium: b?.utm_medium ? String(b.utm_medium).slice(0, 120) : null,
      utm_campaign: b?.utm_campaign ? String(b.utm_campaign).slice(0, 160) : null,
      referrer: b?.referrer ? String(b.referrer).slice(0, 300) : null,
    });
  } catch { /* nunca romper la página del cliente por registrar un evento */ }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// GET: diagnóstico. Dice si la tabla existe, cuántos eventos hay y si se puede
// insertar (para ver el error real de la base). Abrir /api/funnels/evento.
export async function GET() {
  const admin = createServerSupabaseClient();
  let total: number | null = null;
  let insertOk = false;
  let error: string | null = null;

  const cont = await admin.from('funnel_eventos').select('*', { count: 'exact', head: true });
  if (cont.error) error = `count: ${cont.error.message}`;
  else total = cont.count ?? 0;

  const ins = await admin.from('funnel_eventos').insert({ slug: '_diag', paso: 'landing' });
  if (ins.error) error = `insert: ${ins.error.message}`;
  else insertOk = true;

  return NextResponse.json({
    tabla_existe: cont.error == null,
    total_eventos: total,
    insert_ok: insertOk,
    error,
  });
}

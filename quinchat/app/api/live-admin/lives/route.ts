import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { haySesion } from '@/lib/live/admin-guard';

export const dynamic = 'force-dynamic';

const slugify = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || `live-${Date.now()}`;

// GET: lista de lives (resumen para el panel).
export async function GET() {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('live_lives')
    .select('id, slug, titulo, estado, video_url, whatsapp, etiqueta_grabada, creado_en')
    .order('creado_en', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Conteo de productos por live (una sola consulta)
  const ids = (data ?? []).map(l => l.id);
  const conteo = new Map<string, number>();
  if (ids.length) {
    const { data: links } = await supabase.from('live_lives_productos').select('live_id').in('live_id', ids);
    for (const l of links ?? []) conteo.set(String(l.live_id), (conteo.get(String(l.live_id)) ?? 0) + 1);
  }
  return NextResponse.json({ lives: (data ?? []).map(l => ({ ...l, productos: conteo.get(String(l.id)) ?? 0 })) });
}

// POST: crea un live nuevo (borrador).
export async function POST(req: NextRequest) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const titulo = String(b?.titulo ?? '').trim() || 'Nuevo live';
  const slug = slugify(b?.slug || titulo);
  const supabase = createServerSupabaseClient();

  // slug único
  const { data: existe } = await supabase.from('live_lives').select('id').eq('slug', slug).maybeSingle();
  const slugFinal = existe ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : slug;

  const { data, error } = await supabase.from('live_lives').insert({
    slug: slugFinal,
    titulo,
    tienda_nombre: String(b?.tienda_nombre ?? 'KLIXMANT'),
    tienda_logo: b?.tienda_logo ?? '/logo-agencia-quin.png',
    video_url: b?.video_url ?? null,
    whatsapp: b?.whatsapp ?? '573000000000',
    estado: 'borrador',
    duracion_seg: Number(b?.duracion_seg) || 180,
  }).select('id, slug').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, live: data });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

/** GET /api/catalogos — lista todos los catálogos con sus colores */
export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('catalogos_bot')
    .select('*, catalogo_colores(*)')
    .eq('activo', true)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/catalogos — crear catálogo */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const familia = String(body.familia ?? '').trim();
  const patron  = String(body.patron  ?? familia).trim();
  if (!familia) return NextResponse.json({ error: 'familia requerida' }, { status: 400 });

  const anuncios = String(body.anuncios ?? '').trim() || null;
  const supabase = createServerSupabaseClient();

  let { data, error } = await supabase
    .from('catalogos_bot').insert({ familia, patron, anuncios })
    .select('*, catalogo_colores(*)').single();

  if (error && /column .*anuncios.* does not exist/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('catalogos_bot').insert({ familia, patron })
      .select('*, catalogo_colores(*)').single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

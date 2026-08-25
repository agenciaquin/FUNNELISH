import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * DIAGNÓSTICO de fotos del catálogo. Para cada color revisa la foto MARCADA
 * (url_imagen, la que usa el bot) y la ORIGINAL (url_original). Clasifica:
 *  - ok:          la marcada carga bien.
 *  - recuperable: la marcada está rota pero la original sirve (el bot ya la manda).
 *  - rota_total:  las dos están rotas (hay que resubir la foto de ese color).
 */
async function estado(url: string | null): Promise<string> {
  if (!url || !url.startsWith('http')) return 'sin-url';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { method: 'GET', signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return `HTTP ${r.status}`;
    if (!/image\//i.test(r.headers.get('content-type') ?? '')) return 'no-imagen';
    return 'ok';
  } catch (e: any) {
    return e?.name === 'AbortError' ? 'timeout' : 'no-responde';
  }
}

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data: colores, error } = await supabase
    .from('catalogo_colores')
    .select('color, nombre_producto, url_imagen, url_original')
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ok: any[] = [];
  const recuperables: any[] = [];
  const rotas: any[] = [];

  // En tandas de 8 para no saturar
  const lista = colores ?? [];
  for (let i = 0; i < lista.length; i += 8) {
    const tanda = lista.slice(i, i + 8);
    await Promise.all(tanda.map(async (c: any) => {
      const marcada = await estado(c.url_imagen);
      const item: any = { color: c.color, producto: c.nombre_producto, url_imagen: c.url_imagen };
      if (marcada === 'ok') { ok.push({ color: c.color, producto: c.nombre_producto }); return; }
      const original = await estado(c.url_original);
      item.estado_marcada = marcada;
      item.estado_original = original;
      item.url_original = c.url_original;
      if (original === 'ok') recuperables.push(item);
      else rotas.push(item);
    }));
  }

  return NextResponse.json({
    total: lista.length,
    ok: ok.length,
    recuperables: recuperables.length,   // el bot ya las manda usando la original
    rotas_totales: rotas.length,          // hay que resubir la foto
    detalle_recuperables: recuperables,
    detalle_rotas: rotas,
  });
}

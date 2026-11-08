import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { prellenarDesdeChat, productoConVariantes, buscarEnCatalogo, crearDesdeChat } from '@/lib/ventas-vendedores/desde-chat';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * «Enviar al panel de Effi» desde el chat.
 *  GET ?conv=57…          → datos propuestos (pedido + chat + catálogo). No escribe nada.
 *  GET ?producto=<id_item> → producto del catálogo con sus variantes (color/talla/ID/SKU).
 *  GET ?q=<texto>          → buscador del catálogo KLIXMANT.
 *  POST {conv, datos, prendas, forzar?} → crea la preventa con los datos FINALES confirmados.
 */
export async function GET(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.get('producto')) {
      const p = await productoConVariantes(Number(sp.get('producto')));
      return p ? NextResponse.json(p) : NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    if (sp.get('q') != null) return NextResponse.json({ resultados: await buscarEnCatalogo(String(sp.get('q'))) });
    // ¿Este chat ya tiene una preventa en el panel? (para pintar el botón en azul). Consulta liviana, sin IA.
    if (sp.get('existe')) {
      const c = String(sp.get('existe')).replace(/\D/g, '');
      const supabase = createServerSupabaseClient();
      const { data } = await supabase.from('vv_ventas').select('codigo, estado, effi_remision, creado_at')
        .eq('conversacion_id', c).neq('estado', 'cancelada').order('creado_at', { ascending: false }).limit(1).maybeSingle();
      return NextResponse.json({ existente: data ?? null });
    }
    const conv = String(sp.get('conv') ?? '').replace(/\D/g, '');
    if (!/^57\d{10}$/.test(conv)) return NextResponse.json({ error: 'Chat inválido' }, { status: 400 });
    return NextResponse.json(await prellenarDesdeChat(conv));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ ok: false, mensaje: 'Datos inválidos' }, { status: 400 });
  const r = await crearDesdeChat(b, auth.quien);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

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
    // Etapa Effi de TODOS los chats con preventa (barra de color en la lista de chats). Liviana, sin IA.
    // 'effi' = ya tiene remisión en Effi · 'panel' = está en el Centro Maestro EFFI sin subir.
    if (sp.get('estados_chat')) {
      const supabase = createServerSupabaseClient();
      const { data } = await supabase.from('vv_ventas').select('conversacion_id, effi_remision')
        .not('conversacion_id', 'is', null).neq('estado', 'cancelada').limit(5000);
      const mapa: Record<string, 'panel' | 'effi'> = {};
      for (const v of data ?? []) {
        const id = String(v.conversacion_id);
        if (v.effi_remision) mapa[id] = 'effi';
        else if (!mapa[id]) mapa[id] = 'panel';
      }
      // Empalme con Effi: ventas que se subieron A MANO a Effi estos días (sin pasar por el panel)
      for (const id of Object.keys(await remisionesManuales(supabase))) if (!mapa[id] || mapa[id] === 'panel') mapa[id] = 'effi';
      return NextResponse.json({ estados: mapa });
    }
    // ¿Este chat ya tiene una preventa en el panel? (para pintar el botón en azul). Consulta liviana, sin IA.
    if (sp.get('existe')) {
      const c = String(sp.get('existe')).replace(/\D/g, '');
      const supabase = createServerSupabaseClient();
      const { data } = await supabase.from('vv_ventas').select('codigo, estado, effi_remision, creado_at')
        .eq('conversacion_id', c).neq('estado', 'cancelada').order('creado_at', { ascending: false }).limit(1).maybeSingle();
      if (data?.effi_remision) return NextResponse.json({ existente: data });
      // Subida a mano en Effi (empalme): se muestra en azul con su remisión
      const manual = (await remisionesManuales(supabase, c))[c];
      if (manual) return NextResponse.json({ existente: { codigo: data?.codigo ?? 'subida a mano en Effi', estado: data?.estado ?? 'en_effi', effi_remision: manual, manual: true } });
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

/**
 * EMPALME con Effi (08-nov-2026): ventas que ya están en Effi aunque NO pasaron por el panel
 * (las subieron a mano). Se cruzan las remisiones copiadas de Effi (effi_remisiones_api, se
 * sincroniza cada hora) de los últimos 20 días por CLIENTE (celular) y VENDEDOR:
 *   chat del Funnel (línea funnel)   ↔ vendedor FUNNELISTH LANDING
 *   chat de WhatsApp (línea ventas)  ↔ vendedor QUINO AGENCIA
 * Las anuladas no cuentan. Solo lee. Devuelve { conversacion: número de remisión }.
 */
// La lista de chats pregunta cada 30 s: el cruce completo se guarda 5 min (Effi se sincroniza cada hora).
let cacheManuales: { t: number; datos: Record<string, string> } | null = null;

async function remisionesManuales(supabase: any, soloConv?: string): Promise<Record<string, string>> {
  if (!soloConv && cacheManuales && Date.now() - cacheManuales.t < 5 * 60_000) return cacheManuales.datos;
  const r = await calcularManuales(supabase, soloConv);
  if (!soloConv) cacheManuales = { t: Date.now(), datos: r };
  return r;
}

async function calcularManuales(supabase: any, soloConv?: string): Promise<Record<string, string>> {
  try {
    const desde = new Date(Date.now() - 20 * 86400_000).toISOString();
    let q = supabase.from('effi_remisiones_api').select('telefono, vendedor, estado, id_transaccion, id_effi, fecha_trans')
      .in('vendedor', ['FUNNELISTH LANDING', 'QUINO AGENCIA']).gte('fecha_trans', desde).not('telefono', 'is', null);
    if (soloConv) q = q.eq('telefono', soloConv.replace(/\D/g, '').slice(-10));
    const { data: rems } = await q.order('fecha_trans', { ascending: false }).limit(3000);
    const vivas = ((rems ?? []) as any[]).filter(r => !/anulad/i.test(String(r.estado ?? '')));
    if (!vivas.length) return {};
    const ids = [...new Set(vivas.map(r => `57${String(r.telefono).replace(/\D/g, '').slice(-10)}`))];
    const lineas = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 300) {
      const { data: convs } = await supabase.from('conversations').select('id, linea').in('id', ids.slice(i, i + 300));
      for (const c of (convs ?? []) as any[]) lineas.set(String(c.id), String(c.linea ?? 'funnel').toLowerCase());
    }
    const out: Record<string, string> = {};
    for (const r of vivas) {
      const id = `57${String(r.telefono).replace(/\D/g, '').slice(-10)}`;
      if (out[id] || !lineas.has(id)) continue;
      const linea = lineas.get(id) === 'ventas' ? 'ventas' : 'funnel';
      const coincide = (linea === 'funnel' && r.vendedor === 'FUNNELISTH LANDING') || (linea === 'ventas' && r.vendedor === 'QUINO AGENCIA');
      if (coincide) out[id] = String(r.id_effi ?? r.id_transaccion ?? 'Effi');
    }
    return out;
  } catch { return {}; }
}

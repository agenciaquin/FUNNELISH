import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { prellenarDesdeChat, productoConVariantes, buscarEnCatalogo, crearDesdeChat, convDelPanel } from '@/lib/ventas-vendedores/desde-chat';
import { createServerSupabaseClient } from '@/lib/supabase';
import { descuentoDe, recompras, esNueva, MARGEN_MS } from '@/lib/ventas-vendedores/recompra';

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
      // RECOMPRA (10-nov-2026): en los chats que volvieron a comprar tras el descuento, lo de ANTES del
      // descuento es la compra vieja y no cuenta → el pedido nuevo queda «por subir» hasta que se suba.
      const recompra = await recompras(supabase);
      const vieja = (id: string, t: string | null | undefined, margen = 0) => !!recompra[id] && !esNueva(t, recompra[id], margen);
      const { data } = await supabase.from('vv_ventas').select('conversacion_id, effi_remision, creado_at')
        .not('conversacion_id', 'is', null).neq('estado', 'cancelada').limit(5000);
      const mapa: Record<string, 'panel' | 'effi'> = {};
      for (const v of data ?? []) {
        const id = String(v.conversacion_id);
        if (vieja(id, v.creado_at)) continue;
        if (v.effi_remision) mapa[id] = 'effi';
        else if (!mapa[id]) mapa[id] = 'panel';
      }
      // Empalme con Effi: ventas que se subieron A MANO a Effi estos días (sin pasar por el panel)
      for (const [id, m] of Object.entries(await remisionesManuales(supabase))) {
        if (vieja(id, m.fecha, MARGEN_MS)) continue;
        if (!mapa[id] || mapa[id] === 'panel') mapa[id] = 'effi';
      }
      // Marcadas a mano con «Ya está en Effi» (remisión verificada)
      const { data: vinc } = await supabase.from('effi_vinculos').select('conversacion_id, creado_at').limit(5000);
      for (const v of (vinc ?? []) as any[]) if (!vieja(String(v.conversacion_id), v.creado_at)) mapa[String(v.conversacion_id)] = 'effi';
      return NextResponse.json({ estados: mapa });
    }
    // ¿Este chat ya tiene una preventa en el panel? (para pintar el botón en azul). Consulta liviana, sin IA.
    if (sp.get('existe')) {
      const crudo = String(sp.get('existe'));
      const c = convDelPanel(crudo) ?? crudo.replace(/\D/g, '');
      const supabase = createServerSupabaseClient();
      // RECOMPRA (10-nov-2026, dueño): si al cliente ya se le mandó el DESCUENTO, lo que está en Effi/panel
      // de ANTES es la compra vieja: va en `recompra.anterior` y el botón ofrece «Subir nuevo pedido a Effi».
      const desc = await descuentoDe(supabase, c);
      let anterior: any = null;
      const responder = (existente: any) => NextResponse.json({ existente, recompra: desc ? { desde: desc, anterior } : null });
      // Marcada a mano con «Ya está en Effi»
      const { data: vinc } = await supabase.from('effi_vinculos').select('remision, telefono_effi, cliente_effi, creado_at')
        .in('conversacion_id', [...new Set([crudo, c])]).limit(1).maybeSingle();
      const existenteVinc = vinc ? { codigo: 'marcada a mano', estado: 'en_effi', effi_remision: vinc.remision, manual: true, vinculo: vinc } : null;
      if (existenteVinc && (!desc || esNueva(vinc!.creado_at, desc))) return responder(existenteVinc);
      if (existenteVinc) anterior = existenteVinc;
      let { data } = await supabase.from('vv_ventas').select('codigo, estado, effi_remision, creado_at')
        .eq('conversacion_id', c).neq('estado', 'cancelada').order('creado_at', { ascending: false }).limit(1).maybeSingle();
      if (data && desc && !esNueva(data.creado_at, desc)) { anterior = anterior ?? data; data = null; }
      if (data?.effi_remision) return responder(data);
      // Subida a mano en Effi (empalme): se muestra en azul con su remisión
      // (los chats con nombre de usuario «CO.…» no traen teléfono: no se cruzan por número)
      const manual = /^\d+$/.test(c) ? (await remisionesManuales(supabase, c))[c] : undefined;
      if (manual && desc && !esNueva(manual.fecha, desc, MARGEN_MS)) {
        anterior = anterior ?? { codigo: 'subida a mano en Effi', estado: 'en_effi', effi_remision: manual.remision, manual: true };
      } else if (manual) {
        return responder({ codigo: data?.codigo ?? 'subida a mano en Effi', estado: data?.estado ?? 'en_effi', effi_remision: manual.remision, manual: true });
      }
      return responder(data ?? null);
    }
    const conv = convDelPanel(sp.get('conv'));
    if (!conv) return NextResponse.json({ error: 'Chat inválido' }, { status: 400 });
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
  if (b.accion === 'vincular') return vincularManual(b, auth.quien);
  if (b.accion === 'desvincular') {
    const supabase = createServerSupabaseClient();
    await supabase.from('effi_vinculos').delete().eq('conversacion_id', String(b.conv ?? ''));
    return NextResponse.json({ ok: true, mensaje: 'Se quitó la marca «Ya está en Effi».' });
  }
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
type Manual = { remision: string; fecha: string | null };
let cacheManuales: { t: number; datos: Record<string, Manual> } | null = null;

async function remisionesManuales(supabase: any, soloConv?: string): Promise<Record<string, Manual>> {
  if (!soloConv && cacheManuales && Date.now() - cacheManuales.t < 5 * 60_000) return cacheManuales.datos;
  const r = await calcularManuales(supabase, soloConv);
  if (!soloConv) cacheManuales = { t: Date.now(), datos: r };
  return r;
}

async function calcularManuales(supabase: any, soloConv?: string): Promise<Record<string, Manual>> {
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
    const out: Record<string, Manual> = {};
    for (const r of vivas) {
      const id = `57${String(r.telefono).replace(/\D/g, '').slice(-10)}`;
      if (out[id] || !lineas.has(id)) continue;
      const linea = lineas.get(id) === 'ventas' ? 'ventas' : 'funnel';
      const coincide = (linea === 'funnel' && r.vendedor === 'FUNNELISTH LANDING') || (linea === 'ventas' && r.vendedor === 'QUINO AGENCIA');
      if (coincide) out[id] = { remision: String(r.id_effi ?? r.id_transaccion ?? 'Effi'), fecha: r.fecha_trans ?? null };
    }
    return out;
  } catch { return {}; }
}

/**
 * Botón «Ya está en Effi» (08-nov-2026): el asesor pega el número de la remisión y el teléfono con el
 * que quedó en Effi (a veces el cliente da otro número). Se VERIFICA contra la copia de remisiones de
 * Effi; si no está, se trae lo de los últimos 3 días de Effi (solo lectura) y se vuelve a buscar.
 * Solo si coinciden remisión y teléfono se marca el chat como subido. Nunca escribe en Effi.
 */
async function vincularManual(b: any, quien: string) {
  const conv = String(b.conv ?? '').trim();
  const remision = String(b.remision ?? '').replace(/\D/g, '');
  const tel = String(b.telefono ?? '').replace(/\D/g, '').slice(-10);
  if (!conv) return NextResponse.json({ ok: false, mensaje: 'Chat inválido.' }, { status: 400 });
  if (!remision) return NextResponse.json({ ok: false, mensaje: 'Pega el número (ID) de la remisión de Effi.' }, { status: 400 });
  if (!/^\d{10}$/.test(tel)) return NextResponse.json({ ok: false, mensaje: 'El teléfono debe tener 10 dígitos.' }, { status: 400 });
  const supabase = createServerSupabaseClient();
  const buscar = async () => {
    const { data } = await supabase.from('effi_remisiones_api').select('id_effi, id_transaccion, telefono, nombre, estado, vendedor, total, fecha_trans')
      .or(`id_effi.eq.${remision},id_transaccion.eq.${remision}`).limit(1).maybeSingle();
    return data as any;
  };
  let r = await buscar();
  if (!r) {
    // Puede ser de hoy y la copia de Effi aún no la trae: se actualiza la copia de los últimos días
    try {
      const { sincronizarRemisionesEffi } = await import('@/lib/effi-api');
      const manana = new Date(Date.now() - 5 * 3600_000 + 86400_000).toISOString().slice(0, 10);
      await sincronizarRemisionesEffi(manana, 3);
      r = await buscar();
    } catch { /* sin conexión con Effi */ }
  }
  if (!r) return NextResponse.json({ ok: false, mensaje: `❌ No encontré la remisión ${remision} en Effi (últimos 20 días). Revisa el número.` }, { status: 404 });
  if (/anulad/i.test(String(r.estado ?? ''))) return NextResponse.json({ ok: false, mensaje: `❌ La remisión ${remision} está ANULADA en Effi.` }, { status: 400 });
  const telEffi = String(r.telefono ?? '').replace(/\D/g, '').slice(-10);
  if (telEffi !== tel) {
    return NextResponse.json({ ok: false, mensaje: `❌ La remisión ${remision} existe, pero en Effi tiene el teléfono ${telEffi ? `…${telEffi.slice(-4)}` : '(vacío)'}, no ${tel}. Revisa el número.` }, { status: 400 });
  }
  const { error } = await supabase.from('effi_vinculos').upsert({
    conversacion_id: conv, remision: String(r.id_effi ?? r.id_transaccion ?? remision), telefono_effi: tel,
    cliente_effi: r.nombre ?? null, quien, creado_at: new Date().toISOString(),
  }, { onConflict: 'conversacion_id' });
  if (error) return NextResponse.json({ ok: false, mensaje: `No se pudo guardar: ${error.message}` }, { status: 500 });
  return NextResponse.json({
    ok: true, remision: String(r.id_effi ?? remision),
    mensaje: `✅ Reconocida: remisión ${r.id_effi ?? remision} · ${r.nombre ?? ''} · ${r.vendedor ?? ''}${r.total ? ` · $${Math.round(Number(r.total)).toLocaleString('es-CO')}` : ''}. Quedó como subida a Effi.`,
  });
}

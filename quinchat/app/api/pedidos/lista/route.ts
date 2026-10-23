import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { nombresDeAnuncioMeta } from '@/lib/meta-ads';
import {
  canalDePedido, fuenteDePedido, CANAL_LABEL, FUENTE_LABEL,
  type Canal, type Fuente,
} from '@/lib/clasificacion-pedidos';

/**
 * Pedidos para el panel + desgloses por canal, fuente y día.
 *
 * Toda la clasificación sale de lib/clasificacion-pedidos (fuente única):
 *  - Canal: embudos | whatsapp | funnelish | promociones | sin_identificar
 *  - Fuente: tiktok | meta | organico | directo | sin_identificar
 *
 * Reglas acordadas:
 *  - WhatsApp = SOLO lo que nace en el chat de WhatsApp (referencia venta-/wa-).
 *  - Promociones (promo-) va APARTE y NO suma en las estadísticas de "Todas".
 *
 * Params:
 *  ?canal=todas|embudos|whatsapp|funnelish|promociones|sin_identificar
 *         (compat: 'funnel' = embudos; ?origen=todos = todas)
 *  ?fuente=tiktok|meta|organico|directo|sin_identificar
 *  ?estado=confirmado|pendiente|cancelado
 *  ?dias=7
 */
export async function GET(req: NextRequest) {
  const origen = req.nextUrl.searchParams.get('origen');
  let canal = (req.nextUrl.searchParams.get('canal') ?? '').toLowerCase();
  if (canal === 'funnel') canal = 'embudos';              // compat con el nombre viejo
  if (!canal) canal = origen === 'todos' ? 'todas' : 'embudos';
  const fuenteFiltro = (req.nextUrl.searchParams.get('fuente') ?? '').toLowerCase();
  const estadoFiltro = (req.nextUrl.searchParams.get('estado') ?? '').toLowerCase();

  // Rango de fechas. Si viene ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD se usa ese rango
  // (en zona horaria de Colombia, incluyendo todo el día). Si no, se usan ?dias=N.
  const desdeParam = req.nextUrl.searchParams.get('desde');
  const hastaParam = req.nextUrl.searchParams.get('hasta');
  const dias   = Math.max(1, Number(req.nextUrl.searchParams.get('dias') ?? 7));
  const ahora  = Date.now();

  let desde: string, hasta: string | null, desdePrevio: string, hastaPrevio: string | null, duracionMs: number;
  if (desdeParam && hastaParam) {
    desde = `${desdeParam}T00:00:00-05:00`;
    hasta = `${hastaParam}T23:59:59-05:00`;
    duracionMs = new Date(hasta).getTime() - new Date(desde).getTime();
    hastaPrevio = desde;
    desdePrevio = new Date(new Date(desde).getTime() - duracionMs).toISOString();
  } else {
    duracionMs = dias * 86_400_000;
    desde = new Date(ahora - duracionMs).toISOString();
    hasta = null;
    desdePrevio = new Date(ahora - 2 * duracionMs).toISOString();
    hastaPrevio = desde;
  }

  const supabase = createServerSupabaseClient();
  const COLS_BASE = 'id, referencia, nombre, telefono, producto, talla, valor, direccion, ciudad, departamento, correo, confirmado, estado, abono, abono_recibido, utm_source, utm_campaign, referrer, created_at';

  // Trae TODO el período (sin filtrar por prefijo en SQL): la clasificación se hace
  // en JS con la función central. Se reintenta sin columnas nuevas si no existen.
  async function traer(cols: string, desdeISO: string) {
    let c = supabase
      .from('clientes_funnelish')
      .select(cols)
      .gte('created_at', desdeISO);
    if (hasta) c = c.lte('created_at', hasta);
    return c.order('created_at', { ascending: false }).limit(2000);
  }

  let { data, error } = await traer(`${COLS_BASE}, foto_producto, funnel_slug`, desde);
  if (error) ({ data, error } = await traer(COLS_BASE, desde));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let todos = (data ?? []) as any[];

  // Clasificar cada pedido (canal + fuente) una sola vez.
  for (const p of todos) {
    p.canal  = canalDePedido(p.referencia);
    p.fuente = fuenteDePedido(p.utm_source, p.utm_campaign, p.referrer);
  }

  const esCancelado = (p: any) => String(p.estado ?? '').toLowerCase() === 'cancelado';
  const esDuplicado = (p: any) => String(p.estado ?? '').toLowerCase() === 'duplicado';
  const esPendiente = (p: any) => !p.confirmado && !esCancelado(p) && !esDuplicado(p);

  // ── Universo para ESTADÍSTICAS: todo MENOS promociones (acordado) ───────────
  const universo = todos.filter(p => p.canal !== 'promociones');

  // ── Desglose por CANAL (sobre el universo, sin promociones) ─────────────────
  const canalesOrden: Canal[] = ['funnelish', 'embudos', 'whatsapp', 'sin_identificar'];
  const porCanal = canalesOrden.map(cv => {
    const g = universo.filter(p => p.canal === cv);
    const conf = g.filter(p => p.confirmado).length;
    return {
      canal: cv, label: CANAL_LABEL[cv],
      total: g.length, confirmados: conf,
      pendientes: g.filter(esPendiente).length,
      cancelados: g.filter(esCancelado).length,
      valor: g.filter(p => p.confirmado).reduce((s, p) => s + (Number(String(p.valor ?? '').replace(/[^\d]/g, '')) || 0), 0),
      conversion: g.length ? Math.round((conf / g.length) * 100) : 0,
    };
  }).filter(c => c.total > 0);

  // ── Desglose por FUENTE publicitaria (sobre el universo) ────────────────────
  const fuentesOrden: Fuente[] = ['tiktok', 'meta', 'organico', 'directo', 'sin_identificar'];
  const porFuente = fuentesOrden.map(fv => {
    const g = universo.filter(p => p.fuente === fv);
    const conf = g.filter(p => p.confirmado).length;
    return {
      fuente: fv, label: FUENTE_LABEL[fv],
      total: g.length, confirmados: conf,
      pendientes: g.filter(esPendiente).length,
      cancelados: g.filter(esCancelado).length,
      valor: g.filter(p => p.confirmado).reduce((s, p) => s + (Number(String(p.valor ?? '').replace(/[^\d]/g, '')) || 0), 0),
      conversion: g.length ? Math.round((conf / g.length) * 100) : 0,
    };
  }).filter(f => f.total > 0);

  // ── Aplicar FILTROS del usuario para la lista y el resumen principal ────────
  let pedidos = todos;
  if (canal === 'todas')                 pedidos = pedidos.filter(p => p.canal !== 'promociones');
  else if (canal === 'promociones')      pedidos = pedidos.filter(p => p.canal === 'promociones');
  else                                   pedidos = pedidos.filter(p => p.canal === canal);
  if (fuenteFiltro) pedidos = pedidos.filter(p => p.fuente === fuenteFiltro);
  if (estadoFiltro === 'confirmado')     pedidos = pedidos.filter(p => p.confirmado);
  else if (estadoFiltro === 'pendiente') pedidos = pedidos.filter(esPendiente);
  else if (estadoFiltro === 'cancelado') pedidos = pedidos.filter(esCancelado);

  // La lista visible se limita para no pesar; los desgloses ya están calculados.
  pedidos = pedidos.slice(0, 400);

  // ── Miniatura del producto (foto propia del pedido; respaldo: 1ª foto del chat)
  for (const p of pedidos as any[]) {
    const propia = String(p.foto_producto ?? '').trim();
    p.foto = propia.startsWith('http') ? propia : null;
  }
  try {
    const faltan = (pedidos as any[]).some(p => !p.foto);
    const convIds = !faltan ? [] : [...new Set(pedidos
      .map(p => `57${String(p.telefono ?? '').replace(/\D/g, '').slice(-10)}`)
      .filter(id => id.length === 12))];
    if (convIds.length > 0) {
      const { data: imgs } = await supabase
        .from('messages').select('conversation_id, content, created_at')
        .in('conversation_id', convIds)
        .eq('type', 'image').eq('role', 'assistant')
        .order('created_at', { ascending: true });
      const primeraFoto = new Map<string, string>();
      for (const m of imgs ?? []) {
        const c = String((m as any).content ?? '');
        if (!c.startsWith('http')) continue;
        const conv = String((m as any).conversation_id);
        if (!primeraFoto.has(conv)) primeraFoto.set(conv, c);
      }
      for (const p of pedidos as any[]) {
        if (p.foto) continue;
        const conv = `57${String(p.telefono ?? '').replace(/\D/g, '').slice(-10)}`;
        p.foto = primeraFoto.get(conv) ?? null;
      }
    }
  } catch { /* si no hay fotos, la lista igual funciona */ }

  // ── De qué EMBUDO vino cada venta (cruzando por slug/referrer/nombre) ────────
  try {
    const { data: funnels } = await supabase
      .from('funnels').select('slug, nombre, producto, variantes').limit(500);
    const mapa = (funnels ?? []).map((f: any) => {
      let variantes: any[] = [];
      try { variantes = Array.isArray(f.variantes) ? f.variantes : JSON.parse(f.variantes ?? '[]'); } catch { /* */ }
      const nombres = [f.producto, ...variantes.map((v: any) => v?.nombre)]
        .map((n: any) => String(n ?? '').trim().toUpperCase()).filter((n: string) => n.length >= 3);
      return { slug: f.slug as string, nombre: (f.producto || f.nombre || f.slug) as string, nombres };
    });
    const porSlug = new Map(mapa.map(m => [m.slug, m]));
    const slugsValidos = new Set(mapa.map(m => m.slug));
    const slugDeUrl = (url: string): string | null => {
      const u = String(url ?? '');
      const partes = u.replace(/^https?:\/\/[^/]+/i, '').split(/[/?#]/).filter(Boolean);
      for (const seg of partes) {
        if (seg === 'p' || seg === 'pedido' || seg === 'gracias') continue;
        if (slugsValidos.has(seg)) return seg;
      }
      return null;
    };
    for (const p of pedidos) {
      const slugGuardado = String(p.funnel_slug ?? '').trim();
      if (slugGuardado && slugsValidos.has(slugGuardado)) {
        p.embudo_slug = slugGuardado;
        p.embudo_nombre = porSlug.get(slugGuardado)?.nombre || slugGuardado;
        continue;
      }
      const slugRef = slugDeUrl(p.referrer);
      if (slugRef) {
        p.embudo_slug = slugRef;
        p.embudo_nombre = porSlug.get(slugRef)?.nombre || slugRef;
        continue;
      }
      const prod = String(p.producto ?? '').toUpperCase();
      if (!prod) continue;
      const coincidencias = mapa.filter(m => m.nombres.some(n => prod.includes(n) || n.includes(prod.split(' - ')[0].trim())));
      if (coincidencias.length === 1) {
        p.embudo_slug = coincidencias[0].slug;
        p.embudo_nombre = coincidencias[0].nombre;
      }
    }
  } catch { /* si no se puede cruzar, la lista igual funciona */ }

  // ── Nombre de campaña (Meta) + plataforma por pedido ────────────────────────
  try {
    const mapaNombres = await nombresDeAnuncioMeta();
    for (const p of pedidos as any[]) {
      // Red de seguridad: si el pedido no trae utm_campaign/source sueltos pero el
      // referrer los contiene (checkout classic de Funnelish), los rescatamos para
      // mostrar la plataforma y campaña correctas en vez de "Directo".
      const ref = String(p.referrer ?? '');
      if (!String(p.utm_campaign ?? '').trim() && ref) {
        p.utm_campaign = (ref.match(/utm_campaign=([0-9]+)/i)?.[1] ?? ref.match(/utm_id=([0-9]+)/i)?.[1] ?? '') || p.utm_campaign;
      }
      if (!String(p.utm_source ?? '').trim() && ref) {
        p.utm_source = (ref.match(/utm_source=([^&]+)/i)?.[1] ?? (/fbclid=/i.test(ref) ? 'fb' : '')) || p.utm_source;
      }
      p.fuente = fuenteDePedido(p.utm_source, p.utm_campaign, p.referrer);
      const camp = String(p.utm_campaign ?? '').trim();
      p.plataforma = p.fuente === 'tiktok' ? 'tiktok' : p.fuente === 'meta' ? 'facebook' : null;
      p.campana_nombre = mapaNombres.get(camp) || null;
    }
  } catch { /* si Meta falla, quedan solo los IDs */ }

  // ── Serie POR DÍA (sobre el universo filtrado por canal/fuente/estado también) ─
  // Para la gráfica usamos el mismo conjunto que la lista pero SIN el corte de 400.
  let universoVista = todos;
  if (canal === 'todas')            universoVista = universoVista.filter(p => p.canal !== 'promociones');
  else if (canal === 'promociones') universoVista = universoVista.filter(p => p.canal === 'promociones');
  else                              universoVista = universoVista.filter(p => p.canal === canal);
  if (fuenteFiltro) universoVista = universoVista.filter(p => p.fuente === fuenteFiltro);

  const diaCol = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3600000).toISOString().slice(0, 10);
  const mapaDia = new Map<string, { total: number; conf: number; pend: number; canc: number; valor: number }>();
  for (const p of universoVista) {
    const d = diaCol(p.created_at);
    const g = mapaDia.get(d) ?? { total: 0, conf: 0, pend: 0, canc: 0, valor: 0 };
    g.total++;
    if (p.confirmado) { g.conf++; g.valor += Number(String(p.valor ?? '').replace(/[^\d]/g, '')) || 0; }
    else if (esCancelado(p)) g.canc++;
    else if (!esDuplicado(p)) g.pend++;
    mapaDia.set(d, g);
  }
  const porDia = [...mapaDia.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dia, g]) => ({ dia, ...g }));

  // ── Resumen principal (del conjunto filtrado por canal/fuente/estado) ───────
  const filtradoResumen = universoVista.filter(p =>
    estadoFiltro === 'confirmado' ? p.confirmado
    : estadoFiltro === 'pendiente' ? esPendiente(p)
    : estadoFiltro === 'cancelado' ? esCancelado(p)
    : true);
  const totalR = filtradoResumen.length;
  const confR  = filtradoResumen.filter(p => p.confirmado).length;
  const resumen = {
    total: totalR,
    confirmados: confR,
    pendientes: filtradoResumen.filter(esPendiente).length,
    cancelados: filtradoResumen.filter(esCancelado).length,
    vendido: filtradoResumen.filter(p => p.confirmado)
      .reduce((s, p) => s + (Number(String(p.valor ?? '').replace(/[^\d]/g, '')) || 0), 0),
    tasa: totalR ? Math.round((confR / totalR) * 100) : 0,
  };

  // ── Comparación con el período ANTERIOR equivalente (para los % de variación) ─
  let comparacion: any = null;
  try {
    const { data: prev } = await supabase
      .from('clientes_funnelish')
      .select('referencia, confirmado, estado, valor, created_at')
      .gte('created_at', desdePrevio).lt('created_at', hastaPrevio ?? desde)
      .limit(2000);
    let prevSet = (prev ?? []).map((p: any) => ({ ...p, canal: canalDePedido(p.referencia) }));
    if (canal === 'todas')            prevSet = prevSet.filter(p => p.canal !== 'promociones');
    else if (canal === 'promociones') prevSet = prevSet.filter(p => p.canal === 'promociones');
    else                              prevSet = prevSet.filter(p => p.canal === canal);
    const pct = (hoy: number, antes: number) => antes > 0 ? Math.round(((hoy - antes) / antes) * 100) : (hoy > 0 ? 100 : 0);
    const pConf = prevSet.filter(p => p.confirmado).length;
    comparacion = {
      total: pct(resumen.total, prevSet.length),
      confirmados: pct(resumen.confirmados, pConf),
      cancelados: pct(resumen.cancelados, prevSet.filter(p => String(p.estado).toLowerCase() === 'cancelado').length),
      vendido: pct(resumen.vendido, prevSet.filter(p => p.confirmado).reduce((s, p) => s + (Number(String(p.valor ?? '').replace(/[^\d]/g, '')) || 0), 0)),
    };
  } catch { /* sin comparación, el panel igual funciona */ }

  // Total de promociones aparte (solo informativo, NO entra en estadísticas)
  const promociones = {
    total: todos.filter(p => p.canal === 'promociones').length,
    confirmados: todos.filter(p => p.canal === 'promociones' && p.confirmado).length,
  };

  return NextResponse.json({ pedidos, resumen, porCanal, porFuente, porDia, comparacion, promociones });
}

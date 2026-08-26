import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { nombresDeAnuncioMeta } from '@/lib/meta-ads';

/**
 * Pedidos para el panel.
 * ?origen=web (solo los de nuestras páginas) | todos
 * ?dias=7
 */
export async function GET(req: NextRequest) {
  // Canal de venta: funnel (páginas web-%), whatsapp (bot wa-%), o todas.
  // Se acepta el viejo ?origen= para no romper llamadas anteriores.
  const origen = req.nextUrl.searchParams.get('origen');
  let canal = req.nextUrl.searchParams.get('canal') ?? '';
  if (!canal) canal = origen === 'todos' ? 'todas' : 'funnel';
  const dias   = Number(req.nextUrl.searchParams.get('dias') ?? 7);
  const desde  = new Date(Date.now() - dias * 86_400_000).toISOString();

  const supabase = createServerSupabaseClient();
  const COLS_BASE = 'id, referencia, nombre, telefono, producto, talla, valor, direccion, ciudad, departamento, correo, confirmado, estado, abono, abono_recibido, utm_source, utm_campaign, referrer, created_at';

  // Se intenta traer también foto_producto; si esa columna no existe en esta base,
  // se reintenta SIN ella para que la lista NUNCA se caiga (y los pedidos se vean).
  async function traer(cols: string) {
    let c = supabase
      .from('clientes_funnelish')
      .select(cols)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(400);
    if (canal === 'funnel')        c = c.like('referencia', 'web-%');
    else if (canal === 'whatsapp') c = c.like('referencia', 'wa-%');
    else                           c = c.or('referencia.like.web-%,referencia.like.wa-%');
    return c;
  }

  let { data, error } = await traer(`${COLS_BASE}, foto_producto, funnel_slug`);
  if (error) {
    // Reintento sin las columnas nuevas (por si no están migradas todavía).
    ({ data, error } = await traer(COLS_BASE));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pedidos = (data ?? []) as any[];

  // Miniatura del producto: PRIMERO la foto guardada CON ESTE pedido (la correcta,
  // la del producto que compró). Solo si el pedido no tiene foto propia, se usa
  // como respaldo la primera foto que el bot le mandó a ese cliente (puede ser de
  // otro producto de un chat anterior, por eso va de último).
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
        if (p.foto) continue; // ya tiene su foto propia (la correcta)
        const conv = `57${String(p.telefono ?? '').replace(/\D/g, '').slice(-10)}`;
        p.foto = primeraFoto.get(conv) ?? null;
      }
    }
  } catch { /* si no hay fotos, la lista igual funciona */ }

  // ── De qué EMBUDO vino cada venta (cruzando por nombre de producto/variantes) ──
  // El pedido no guarda el slug, así que se empareja el producto con los nombres de
  // cada embudo. Se agrega p.embudo_slug y p.embudo_nombre para el enlace de vista previa.
  try {
    const { data: funnels } = await supabase
      .from('funnels').select('slug, nombre, producto, variantes').limit(500);
    const mapa = (funnels ?? []).map((f: any) => {
      let variantes: any[] = [];
      try { variantes = Array.isArray(f.variantes) ? f.variantes : JSON.parse(f.variantes ?? '[]'); } catch { /* */ }
      const nombres = [f.producto, ...variantes.map((v: any) => v?.nombre)]
        .map((n: any) => String(n ?? '').trim().toUpperCase()).filter((n: string) => n.length >= 3);
      // Mostramos el PRODUCTO (así nombras cada embudo: "F1 ESCUDERIA TIK TOK"),
      // no el `nombre` interno (que suele quedar como "Nacional 2026 (copia)…" al duplicar).
      return { slug: f.slug as string, nombre: (f.producto || f.nombre || f.slug) as string, nombres };
    });
    const porSlug = new Map(mapa.map(m => [m.slug, m]));
    const slugsValidos = new Set(mapa.map(m => m.slug));

    // Saca el slug del embudo desde una URL (referrer): …/{slug}, …/{slug}/pedido, etc.
    const slugDeUrl = (url: string): string | null => {
      const u = String(url ?? '');
      if (!/klixmant\.shop/i.test(u) && !/\/p\//.test(u)) {
        // igual intentamos: tomar el primer segmento de ruta que sea un slug válido
      }
      const partes = u.replace(/^https?:\/\/[^/]+/i, '').split(/[/?#]/).filter(Boolean);
      for (const seg of partes) {
        if (seg === 'p' || seg === 'pedido' || seg === 'gracias') continue;
        if (slugsValidos.has(seg)) return seg;
      }
      return null;
    };

    for (const p of pedidos) {
      // 1º: si el pedido guardó el slug del embudo (nuevos pedidos) → EXACTO.
      const slugGuardado = String(p.funnel_slug ?? '').trim();
      if (slugGuardado && slugsValidos.has(slugGuardado)) {
        p.embudo_slug = slugGuardado;
        p.embudo_nombre = porSlug.get(slugGuardado)?.nombre || slugGuardado;
        continue;
      }
      // 2º: sacar el embudo del referrer (la URL de venta de donde vino) → confiable.
      const slugRef = slugDeUrl(p.referrer);
      if (slugRef) {
        p.embudo_slug = slugRef;
        p.embudo_nombre = porSlug.get(slugRef)?.nombre || slugRef;
        continue;
      }
      // 3º: pedidos viejos sin slug ni referrer → cruzar por nombre SOLO si hay UNA
      // sola coincidencia (si varios embudos comparten el nombre, no adivinamos).
      const prod = String(p.producto ?? '').toUpperCase();
      if (!prod) continue;
      const coincidencias = mapa.filter(m => m.nombres.some(n => prod.includes(n) || n.includes(prod.split(' - ')[0].trim())));
      if (coincidencias.length === 1) {
        p.embudo_slug = coincidencias[0].slug;
        p.embudo_nombre = coincidencias[0].nombre;
      }
    }
  } catch { /* si no se puede cruzar, la lista igual funciona */ }

  // Nombre de la campaña (desde Meta) + plataforma (Facebook / TikTok) por pedido.
  try {
    const mapaNombres = await nombresDeAnuncioMeta();
    for (const p of pedidos as any[]) {
      const src  = String(p.utm_source ?? '').toLowerCase();
      const camp = String(p.utm_campaign ?? '').trim();
      let plataforma: 'facebook' | 'tiktok' | null = null;
      if (/tiktok|tik.?tok|ttclid|\btt\b/.test(src)) plataforma = 'tiktok';
      else if (/facebook|instagram|meta|\bfb\b|\big\b/.test(src)) plataforma = 'facebook';
      else if (/^\d{10,}$/.test(camp)) plataforma = 'facebook'; // IDs de anuncio Meta
      p.plataforma = plataforma;
      p.campana_nombre = mapaNombres.get(camp) || null;
    }
  } catch { /* si Meta falla, quedan solo los IDs */ }

  const resumen = {
    total:       pedidos.length,
    confirmados: pedidos.filter(p => p.confirmado).length,
    cancelados:  pedidos.filter(p => String(p.estado).toLowerCase() === 'cancelado').length,
    vendido:     pedidos
      .filter(p => p.confirmado)
      .reduce((s, p) => s + (Number(String(p.valor ?? '').replace(/[^\d]/g, '')) || 0), 0),
  };

  return NextResponse.json({ pedidos, resumen });
}

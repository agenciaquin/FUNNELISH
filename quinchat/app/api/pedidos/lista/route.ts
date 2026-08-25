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
  let consulta = supabase
    .from('clientes_funnelish')
    .select('id, referencia, nombre, telefono, producto, talla, valor, direccion, ciudad, departamento, correo, confirmado, estado, abono, abono_recibido, utm_source, utm_campaign, created_at')
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(400);

  // Funnel = páginas propias (referencia "web-"); WhatsApp = bot (referencia "wa-").
  if (canal === 'funnel')        consulta = consulta.like('referencia', 'web-%');
  else if (canal === 'whatsapp') consulta = consulta.like('referencia', 'wa-%');
  else                           consulta = consulta.or('referencia.like.web-%,referencia.like.wa-%');

  const { data, error } = await consulta;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pedidos = data ?? [];

  // Miniatura del producto: la primera foto que el bot le mandó a ese cliente.
  // Se traen todas de una sola vez para no consultar pedido por pedido.
  try {
    const convIds = [...new Set(pedidos
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

      for (const p of pedidos) {
        const conv = `57${String(p.telefono ?? '').replace(/\D/g, '').slice(-10)}`;
        (p as any).foto = primeraFoto.get(conv) ?? null;
      }
    }
  } catch { /* si no hay fotos, la lista igual funciona */ }

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

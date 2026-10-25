import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { haySesion } from '@/lib/live/admin-guard';

export const dynamic = 'force-dynamic';

/**
 * VENTAS LIVE (solo lectura).
 * Un pedido es "del live" cuando entró por el checkout del embudo vinculado a
 * ese live: clientes_funnelish.funnel_slug = live_lives.embudo_slug.
 * No crea tablas ni duplica pedidos: lee la misma tabla que usa Pedidos.
 *
 * Query: desde, hasta (YYYY-MM-DD, hora Colombia) · live (slug) · estado
 * (pendiente|confirmado|cancelado) · ciudad · producto · pago · q · page
 * ?resumen=1 → solo KPIs + 3 ventas recientes (para la tarjeta de inicio).
 */

const POR_PAGINA = 25;
const aNum = (v: any) => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function estadoDe(p: any): 'cancelado' | 'confirmado' | 'pendiente' {
  if (/cancel|anulad/i.test(String(p.estado ?? ''))) return 'cancelado';
  if (p.confirmado) return 'confirmado';
  return 'pendiente';
}
function pagoDe(p: any): string {
  return Number(p.abono) > 0 ? 'Abono + contraentrega' : 'Contraentrega';
}
function colorDe(producto: string): string {
  const i = producto.lastIndexOf(' - ');
  return i > 0 ? producto.slice(i + 3).trim() : '';
}
// Inicio del día en Colombia (UTC-5) como ISO
const inicioCol = (ymd: string) => new Date(`${ymd}T00:00:00-05:00`).toISOString();
const finCol = (ymd: string) => new Date(`${ymd}T23:59:59.999-05:00`).toISOString();
const hoyCol = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const supabase = createServerSupabaseClient();

  // 1) Lives con embudo vinculado → mapa embudo_slug → live
  const { data: lives, error: eL } = await supabase
    .from('live_lives').select('slug, titulo, embudo_slug');
  if (eL) return NextResponse.json({ error: eL.message }, { status: 500 });
  const porEmbudo = new Map<string, { slug: string; titulo: string }>();
  for (const l of lives ?? []) if (l.embudo_slug) porEmbudo.set(String(l.embudo_slug), { slug: l.slug, titulo: l.titulo });
  const listaLives = (lives ?? []).filter(l => l.embudo_slug).map(l => ({ slug: l.slug, titulo: l.titulo }));
  const slugs = [...porEmbudo.keys()];
  if (!slugs.length) {
    return NextResponse.json({ lives: listaLives, kpis: { hoy: 0, mes: 0, valor: 0, prendas: 0, pendientes: 0, confirmados: 0 }, pedidos: [], total: 0, paginas: 0, recientes: [] });
  }

  // 2) Pedidos de esos embudos (no en papelera)
  const { data: filas, error } = await supabase
    .from('clientes_funnelish')
    .select('id, referencia, nombre, telefono, producto, talla, valor, cantidad, ciudad, departamento, direccion, estado, confirmado, abono, foto_producto, funnel_slug, created_at')
    .in('funnel_slug', slugs)
    .is('papelera_at', null)
    .order('created_at', { ascending: false })
    .limit(3000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const todos = (filas ?? []).map(p => {
    const producto = String(p.producto ?? '');
    const live = porEmbudo.get(String(p.funnel_slug));
    return {
      id: p.id,
      numero: String(p.referencia ?? p.id),
      fecha: p.created_at,
      live_slug: live?.slug ?? '',
      live_titulo: live?.titulo ?? String(p.funnel_slug ?? ''),
      foto: p.foto_producto ?? null,
      producto,
      talla: String(p.talla ?? ''),
      color: colorDe(producto),
      cantidad: Number(p.cantidad) || 1,
      cliente: String(p.nombre ?? ''),
      celular: String(p.telefono ?? ''),
      ciudad: String(p.ciudad ?? ''),
      departamento: String(p.departamento ?? ''),
      direccion: String(p.direccion ?? ''),
      valor: aNum(p.valor),
      pago: pagoDe(p),
      estado: estadoDe(p),
    };
  });

  // KPIs de hoy y del mes: sobre TODAS las ventas live (no dependen de los filtros)
  const hoy = hoyCol();
  const iniHoy = inicioCol(hoy);
  const iniMes = inicioCol(hoy.slice(0, 8) + '01');
  const noCancel = todos.filter(p => p.estado !== 'cancelado');
  const recientes = todos.slice(0, 3);

  if (sp.get('resumen') === '1') {
    return NextResponse.json({
      kpis: {
        hoy: noCancel.filter(p => p.fecha >= iniHoy).length,
        mes: noCancel.filter(p => p.fecha >= iniMes).length,
      },
      recientes,
    });
  }

  // 3) Filtros
  const desde = sp.get('desde'); const hasta = sp.get('hasta');
  const fLive = sp.get('live') || ''; const fEstado = sp.get('estado') || '';
  const fCiudad = sinTildes(sp.get('ciudad') || ''); const fProd = sinTildes(sp.get('producto') || '');
  const fPago = sp.get('pago') || ''; const q = sinTildes(sp.get('q') || '');

  let lista = todos;
  if (desde) lista = lista.filter(p => p.fecha >= inicioCol(desde));
  if (hasta) lista = lista.filter(p => p.fecha <= finCol(hasta));
  if (fLive) lista = lista.filter(p => p.live_slug === fLive);
  if (fEstado) lista = lista.filter(p => p.estado === fEstado);
  if (fCiudad) lista = lista.filter(p => sinTildes(p.ciudad).includes(fCiudad));
  if (fProd) lista = lista.filter(p => sinTildes(p.producto).includes(fProd));
  if (fPago) lista = lista.filter(p => p.pago === fPago);
  if (q) {
    const qd = q.replace(/\D/g, '');
    lista = lista.filter(p => sinTildes(p.cliente).includes(q) || sinTildes(p.numero).includes(q) || (qd.length >= 3 && p.celular.includes(qd)));
  }

  const validos = lista.filter(p => p.estado !== 'cancelado');
  const kpis = {
    hoy: noCancel.filter(p => p.fecha >= iniHoy).length,
    mes: noCancel.filter(p => p.fecha >= iniMes).length,
    valor: validos.reduce((s, p) => s + p.valor, 0),
    prendas: validos.reduce((s, p) => s + p.cantidad, 0),
    pendientes: lista.filter(p => p.estado === 'pendiente').length,
    confirmados: lista.filter(p => p.estado === 'confirmado').length,
  };

  const page = Math.max(1, Number(sp.get('page')) || 1);
  const total = lista.length;
  // ?todo=1 → todos los filtrados (para exportar el reporte)
  const pedidos = sp.get('todo') === '1' ? lista : lista.slice((page - 1) * POR_PAGINA, page * POR_PAGINA);

  return NextResponse.json({ lives: listaLives, kpis, pedidos, total, paginas: Math.ceil(total / POR_PAGINA), recientes });
}

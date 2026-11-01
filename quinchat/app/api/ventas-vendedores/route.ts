import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { PESTANAS, ESTADOS_CONTABLES, type Pestana } from '@/lib/ventas-vendedores/estados';
import { sinTildes } from '@/lib/ventas-vendedores/catalogo';

export const dynamic = 'force-dynamic';

/** Lista de la Cola de Preventas del módulo Ventas Vendedores (filtros + contadores + indicadores). */
export async function GET(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const sp = req.nextUrl.searchParams;
  const pestana = (sp.get('pestana') || 'todas') as Pestana;
  const q = sinTildes(sp.get('q') || '');
  const desde = sp.get('desde');
  const hasta = sp.get('hasta');
  const orden = sp.get('orden') === 'asc';
  const vendedor = sp.get('vendedor') || '';
  const ciudad = sinTildes(sp.get('ciudad') || '');
  const tipo = sinTildes(sp.get('tipo') || '');
  const verQA = sp.get('qa') === '1';

  const supabase = createServerSupabaseClient();
  let consulta = supabase.from('vv_ventas').select('*').order('creado_at', { ascending: orden }).limit(1500);
  if (desde) consulta = consulta.gte('creado_at', `${desde}T05:00:00Z`);            // 00:00 Colombia
  if (hasta) consulta = consulta.lt('creado_at', new Date(new Date(`${hasta}T05:00:00Z`).getTime() + 86400000).toISOString());
  const { data: ventas, error } = await consulta;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (ventas ?? []).map(v => v.id);
  const items: any[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase.from('vv_items').select('*').in('venta_id', ids.slice(i, i + 300)).order('id');
    items.push(...(data ?? []));
  }
  const porVenta = new Map<string, any[]>();
  for (const it of items) porVenta.set(it.venta_id, [...(porVenta.get(it.venta_id) ?? []), it]);

  let lista = (ventas ?? []).map(v => ({ ...v, items: porVenta.get(v.id) ?? [] }));
  const vendedores = [...new Map(lista.map(v => [v.vendedor_tel, v.vendedor_nombre || v.vendedor_tel])).entries()].map(([tel, nombre]) => ({ tel, nombre }));
  const ciudades = [...new Set(lista.map(v => v.municipio).filter(Boolean))].sort();
  const tipos = [...new Set(items.map(i => i.tipo).filter(Boolean))].sort();

  if (!verQA) lista = lista.filter(v => !v.es_prueba);
  if (vendedor) lista = lista.filter(v => v.vendedor_tel === vendedor);
  if (ciudad) lista = lista.filter(v => sinTildes(v.municipio).includes(ciudad));
  if (tipo) lista = lista.filter(v => v.items.some((i: any) => sinTildes(i.tipo) === tipo));
  if (q) {
    lista = lista.filter(v => sinTildes([
      v.cliente_nombre, v.cliente_celular, v.codigo, v.vendedor_nombre, v.vendedor_tel, v.municipio, v.effi_remision,
      ...v.items.flatMap((i: any) => [i.catalogo, i.referencia, i.sku, String(i.id_variante ?? '')]),
    ].join(' ')).includes(q));
  }

  const contadores: Record<string, number> = {};
  for (const p of PESTANAS) contadores[p.key] = p.estados ? lista.filter(v => p.estados!.includes(v.estado)).length : lista.length;
  const contables = lista.filter(v => ESTADOS_CONTABLES.includes(v.estado));
  const indicadores = {
    preventas: lista.filter(v => v.estado !== 'cancelada').length,
    totalNeto: contables.reduce((s, v) => s + (Number(v.total) || 0), 0),
    unidades: contables.reduce((s, v) => s + v.items.reduce((a: number, i: any) => a + (Number(i.cantidad) || 0), 0), 0),
    pendientes: contadores.pendientes ?? 0,
    errores: contadores.errores ?? 0,
  };
  const pest = PESTANAS.find(p => p.key === pestana);
  if (pest?.estados) lista = lista.filter(v => pest.estados!.includes(v.estado));

  return NextResponse.json({ ventas: lista.slice(0, 400), contadores, indicadores, opciones: { vendedores, ciudades, tipos } });
}

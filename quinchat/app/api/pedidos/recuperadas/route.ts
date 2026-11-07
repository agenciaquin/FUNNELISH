import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * VENTAS RECUPERADAS (solo lectura).
 *  · Carrito abandonado: el cliente recibió la plantilla de carrito y DESPUÉS hizo un pedido
 *    (mismo teléfono) dentro de los 7 días siguientes.
 *  · Descuento $15.000: el cliente recibió la plantilla de descuento por entrega y DESPUÉS
 *    hizo un pedido (mismo teléfono) dentro de los 30 días siguientes.
 * Se cuenta el PRIMER pedido posterior al envío; no cuenta pedidos cancelados ni duplicados.
 */
const DIAS_CARRITO = 7;
const DIAS_DESCUENTO = 30;
const tel10 = (t: unknown) => String(t ?? '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
const num = (v: unknown) => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;

export async function GET() {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const supabase = createServerSupabaseClient();

  const [{ data: carritos, error: e1 }, { data: descuentos, error: e2 }] = await Promise.all([
    supabase.from('carritos_abandonados').select('id, telefono, nombre, producto, plantilla_enviada_at')
      .not('plantilla_enviada_at', 'is', null).order('plantilla_enviada_at', { ascending: true }).limit(2000),
    supabase.from('descuentos_entrega').select('guia, telefono, nombre, enviado_at')
      .eq('estado', 'enviado').not('enviado_at', 'is', null).order('enviado_at', { ascending: true }).limit(5000),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });

  // Primer envío por teléfono (un cliente puede tener varios carritos o guías)
  const envCarrito = new Map<string, { at: string; nombre: string | null; extra: string | null }>();
  for (const c of carritos ?? []) {
    const t = tel10(c.telefono); if (!/^3\d{9}$/.test(t) || envCarrito.has(t)) continue;
    envCarrito.set(t, { at: c.plantilla_enviada_at, nombre: c.nombre, extra: c.producto });
  }
  const envDesc = new Map<string, { at: string; nombre: string | null; extra: string | null }>();
  for (const d of descuentos ?? []) {
    const t = tel10(d.telefono); if (!/^3\d{9}$/.test(t) || envDesc.has(t)) continue;
    envDesc.set(t, { at: d.enviado_at, nombre: d.nombre, extra: `guía ${d.guia}` });
  }

  const telefonos = [...new Set([...envCarrito.keys(), ...envDesc.keys()])];
  const minFecha = [...envCarrito.values(), ...envDesc.values()].map(v => v.at).sort()[0];
  const pedidos: any[] = [];
  if (telefonos.length && minFecha) {
    for (let i = 0; i < telefonos.length; i += 200) {
      const lote = telefonos.slice(i, i + 200);
      const { data, error } = await supabase.from('clientes_funnelish')
        .select('id, nombre, telefono, producto, talla, valor, confirmado, estado, created_at')
        .in('telefono', [...lote, ...lote.map(t => `57${t}`)]).gte('created_at', minFecha).order('created_at', { ascending: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      pedidos.push(...(data ?? []));
    }
  }
  const validos = pedidos.filter(p => !['cancelado', 'duplicado'].includes(String(p.estado ?? '').toLowerCase()));

  const armar = (env: Map<string, { at: string; nombre: string | null; extra: string | null }>, dias: number, tipo: 'carrito' | 'descuento') => {
    const ventas: any[] = [];
    for (const [t, e] of env) {
      const desde = Date.parse(e.at), hasta = desde + dias * 86400_000;
      const p = validos.find(x => tel10(x.telefono) === t && Date.parse(x.created_at) > desde && Date.parse(x.created_at) <= hasta);
      if (!p) continue;
      ventas.push({
        tipo, telefono: t, nombre: p.nombre || e.nombre, producto: p.producto, talla: p.talla,
        valor: num(p.valor), confirmado: !!p.confirmado, estado: p.estado, pedido_at: p.created_at,
        enviado_at: e.at, origen: e.extra, horas: Math.round((Date.parse(p.created_at) - desde) / 3600_000),
      });
    }
    ventas.sort((a, b) => Date.parse(b.pedido_at) - Date.parse(a.pedido_at));
    return {
      enviados: env.size,
      ventas: ventas.length,
      confirmadas: ventas.filter(v => v.confirmado).length,
      valor: ventas.filter(v => v.confirmado).reduce((s, v) => s + v.valor, 0),
      lista: ventas,
    };
  };

  return NextResponse.json({
    carrito: armar(envCarrito, DIAS_CARRITO, 'carrito'),
    descuento: armar(envDesc, DIAS_DESCUENTO, 'descuento'),
    reglas: { dias_carrito: DIAS_CARRITO, dias_descuento: DIAS_DESCUENTO },
  });
}

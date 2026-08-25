import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { obtenerFunnel } from '@/lib/funnels';

export const dynamic = 'force-dynamic';

// Estadísticas del embudo por paso: cuántos pasaron por cada paso, la conversión
// y dónde se cae la venta. Single-tenant (todo el negocio).
export async function GET(req: NextRequest) {
  const slug = String(req.nextUrl.searchParams.get('slug') ?? '').trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: 'falta slug' }, { status: 400 });
  const dias = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get('dias') ?? 7)));
  const desde = new Date(Date.now() - dias * 24 * 3600 * 1000).toISOString();

  const admin = createServerSupabaseClient();

  async function contar(paso: string): Promise<number> {
    try {
      const { count } = await admin.from('funnel_eventos')
        .select('*', { count: 'exact', head: true })
        .eq('slug', slug).eq('paso', paso).gte('created_at', desde);
      return count ?? 0;
    } catch { return 0; }
  }

  const [landing, scrollFin, pedido, talla, datos, boton] = await Promise.all([
    contar('landing'), contar('scroll_fin'), contar('pedido'),
    contar('talla'), contar('datos'), contar('boton'),
  ]);

  // "Compra realizada" = VENTAS REALES guardadas en la tabla (no el contador de la
  // página de gracias, que se infla con recargas). El pedido no guarda el slug, así
  // que se cruzan por el nombre del producto/variantes de este embudo.
  async function contarVentasReales(): Promise<number> {
    try {
      const f = await obtenerFunnel(slug);
      const nombres = [f?.producto, ...((f?.variantes ?? []).map(v => v.nombre))]
        .map(n => String(n ?? '').trim().toUpperCase()).filter(n => n.length >= 3);
      if (nombres.length === 0) return 0;
      const { data } = await admin.from('clientes_funnelish')
        .select('producto, estado')
        .like('referencia', 'web-%')
        .gte('created_at', desde)
        .neq('estado', 'duplicado')
        .limit(3000);
      return (data ?? []).filter(o => {
        const p = String((o as any).producto ?? '').toUpperCase();
        return nombres.some(n => p.includes(n) || n.includes(p.split(' - ')[0].trim()));
      }).length;
    } catch { return 0; }
  }
  const compra = await contarVentasReales();

  const pct = (n: number, base: number) => (base > 0 ? Math.round((n / base) * 1000) / 10 : 0);

  const TODOS = [
    { clave: 'landing',    nombre: 'Página de venta',      desc: 'Llegaron al anuncio',              total: landing,   emoji: '🎯', siempre: true },
    { clave: 'scroll_fin', nombre: 'Vieron toda la página', desc: 'Bajaron hasta el final (collage)', total: scrollFin, emoji: '📜', siempre: false },
    { clave: 'pedido',     nombre: 'Formulario de pedido',  desc: 'Dieron clic en comprar',           total: pedido,    emoji: '📝', siempre: true },
    { clave: 'talla',      nombre: 'Eligieron talla/color', desc: 'Seleccionaron su producto',        total: talla,     emoji: '📏', siempre: false },
    { clave: 'datos',      nombre: 'Llenaron sus datos',    desc: 'Escribieron nombre y WhatsApp',    total: datos,     emoji: '✍️', siempre: false },
    { clave: 'boton',      nombre: 'Clic en completar',     desc: 'Tocaron el botón de comprar',      total: boton,     emoji: '🖲️', siempre: false },
    { clave: 'compra',     nombre: 'Compra realizada',      desc: 'Completaron el pedido',            total: compra,    emoji: '💳', siempre: true },
  ];
  const usados = TODOS.filter(p => p.siempre || p.total > 0);
  const pasos = usados.map(p => ({
    clave: p.clave, nombre: p.nombre, desc: p.desc, total: p.total,
    pctDeInicio: pct(p.total, landing), emoji: p.emoji,
  }));

  const caidas = [];
  for (let i = 0; i < pasos.length - 1; i++) {
    const a = pasos[i], b = pasos[i + 1];
    const corto = (n: string) => n.replace('Página de venta', 'Página').replace('Formulario de pedido', 'Formulario');
    caidas.push({
      de: `${corto(a.nombre)} → ${corto(b.nombre)}`,
      perdidos: Math.max(0, a.total - b.total),
      pct: pct(Math.max(0, a.total - b.total), a.total),
    });
  }

  return NextResponse.json({
    slug, dias, pasos, caidas,
    conversion_total: pct(compra, landing),
    ventas: compra,
  });
}

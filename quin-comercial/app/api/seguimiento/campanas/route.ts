import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { gastoPorAnuncioMeta } from '@/lib/meta-ads';
import { tenantActual } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * Rendimiento de las campañas de WhatsApp (clic-a-WhatsApp).
 * Agrupa los chats por el ID del anuncio del que llegaron y cuenta:
 *  - mensajes (personas que escribieron desde esa campaña)
 *  - ventas realizadas de esa campaña
 * ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 */
export async function GET(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const desde = req.nextUrl.searchParams.get('desde');
  const hasta = req.nextUrl.searchParams.get('hasta');

  const supabase = createServerSupabaseClient();

  let q = supabase
    .from('conversations')
    .select('id, anuncio_id, label, created_at')
    .eq('tenant_id', tid)
    .not('anuncio_id', 'is', null);

  if (desde) q = q.gte('created_at', `${desde}T00:00:00`);
  if (hasta) q = q.lte('created_at', `${hasta}T23:59:59`);

  const { data, error } = await q.limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Nombre amigable del producto por ID de anuncio (embudos + catálogos)
  const nombrePorId = new Map<string, string>();
  try {
    const [{ data: fs }, { data: cs }] = await Promise.all([
      supabase.from('funnels').select('producto, anuncios').eq('tenant_id', tid).not('anuncios', 'is', null),
      supabase.from('catalogos_bot').select('familia, anuncios').eq('tenant_id', tid).not('anuncios', 'is', null),
    ]);
    const registrar = (nombre: string, anuncios: any) => {
      for (const id of String(anuncios ?? '').split(/[,\s]+/).map((x: string) => x.trim()).filter(Boolean)) {
        if (!nombrePorId.has(id)) nombrePorId.set(id, nombre);
      }
    };
    for (const f of fs ?? []) registrar(String((f as any).producto ?? ''), (f as any).anuncios);
    for (const c of cs ?? []) registrar(String((c as any).familia ?? ''), (c as any).anuncios);
  } catch { /* si falla, se muestran solo los IDs */ }

  // ── Estado de entrega de Effi por teléfono (entregada/devuelta/…/flete) ──────
  const effiPorTel = new Map<string, { estado: string; flete: number }>();
  try {
    const { data: guias } = await supabase.from('effi_guias').select('telefono, estado, flete').eq('tenant_id', tid);
    for (const g of guias ?? []) {
      const t = String((g as any).telefono ?? '').replace(/\D/g, '').slice(-10);
      if (t.length === 10) effiPorTel.set(t, { estado: String((g as any).estado ?? ''), flete: Number((g as any).flete) || 0 });
    }
  } catch { /* sin Effi, se muestran las métricas sin entrega */ }

  // Agrupar por anuncio_id
  type Grupo = { mensajes: number; ventas: number; entregadas: number; devueltas: number; enCamino: number; flete: number };
  const mapa = new Map<string, Grupo>();
  for (const c of data ?? []) {
    const id = String((c as any).anuncio_id ?? '').trim();
    if (!id) continue;
    if (!mapa.has(id)) mapa.set(id, { mensajes: 0, ventas: 0, entregadas: 0, devueltas: 0, enCamino: 0, flete: 0 });
    const g = mapa.get(id)!;
    g.mensajes++;
    const esVenta = String((c as any).label ?? '').toUpperCase().includes('VENTA REALIZADA');
    if (esVenta) {
      g.ventas++;
      // Cruce con Effi por el teléfono (el id de la conversación es 57 + teléfono)
      const tel = String((c as any).id ?? '').replace(/^57/, '').slice(-10);
      const ef = effiPorTel.get(tel);
      if (ef) {
        g.flete += ef.flete;
        if (ef.estado === 'entregada')      g.entregadas++;
        else if (ef.estado === 'devuelta')  g.devueltas++;
        else if (ef.estado === 'en_camino' || ef.estado === 'novedad') g.enCamino++;
      }
    }
  }

  // ── Gasto real desde Meta (Marketing API) ────────────────────────────────
  // Se cruza por el ID del anuncio: gasto ÷ ventas confirmadas = costo real por
  // venta (lo único que importa en pago contra entrega). Si no hay token
  // configurado, las campañas se muestran igual, solo sin las columnas de gasto.
  const meta = await gastoPorAnuncioMeta(desde, hasta);

  const campanas = [...mapa.entries()]
    .map(([id, g]) => {
      const ad = meta.porAnuncio.get(id);
      const gasto = ad ? Math.round(ad.gasto) : null;
      return {
        anuncioId: id,
        producto: nombrePorId.get(id) ?? '—',
        mensajes: g.mensajes,
        ventas: g.ventas,
        conversion: g.mensajes ? Math.round((g.ventas / g.mensajes) * 100) : 0,
        // Datos de Meta (null si no hay token o el anuncio no tiene gasto en el rango)
        estado: ad?.estado ?? null,
        activa: ad?.activo ?? null,
        gasto,
        impresiones: ad ? Math.round(ad.impresiones) : null,
        alcance: ad ? Math.round(ad.alcance) : null,
        clics: ad ? Math.round(ad.clics) : null,
        cpm: ad ? Math.round(ad.cpm) : null,
        cpc: ad ? Math.round(ad.cpc) : null,
        ctr: ad ? Math.round(ad.ctr * 100) / 100 : null,
        frecuencia: ad ? Math.round(ad.frecuencia * 10) / 10 : null,
        mensajesMeta: ad ? Math.round(ad.mensajesMeta) : null,   // conversaciones iniciadas según Meta
        thruplays: ad ? Math.round(ad.thruplays) : null,
        // Costo por conversación iniciada (dato oficial de Meta, más fiel que el nuestro)
        costoPorMensajeMeta: gasto != null && ad && ad.mensajesMeta > 0 ? Math.round(gasto / ad.mensajesMeta) : null,
        nombreAnuncio: ad?.nombre ?? null,
        costoPorMensaje: gasto != null && g.mensajes > 0 ? Math.round(gasto / g.mensajes) : null,
        costoPorVenta: gasto != null && g.ventas > 0 ? Math.round(gasto / g.ventas) : null,
        // ── Entrega (cruce con Effi) ──
        entregadas: g.entregadas,
        devueltas: g.devueltas,
        enCamino: g.enCamino,
        flete: g.flete,
        // Tasa de entrega = entregadas / (entregadas + devueltas) [solo guías que ya cerraron]
        tasaEntrega: (g.entregadas + g.devueltas) > 0 ? Math.round((g.entregadas / (g.entregadas + g.devueltas)) * 100) : null,
        // Costo por venta ENTREGADA (lo que de verdad importa en contraentrega)
        costoPorEntregada: gasto != null && g.entregadas > 0 ? Math.round(gasto / g.entregadas) : null,
      };
    })
    .sort((a, b) => (b.gasto ?? -1) - (a.gasto ?? -1) || b.mensajes - a.mensajes);

  // Totales para la cabecera del informe
  const totalGasto = campanas.reduce((s, c) => s + (c.gasto ?? 0), 0);
  const totalVentas = campanas.reduce((s, c) => s + c.ventas, 0);
  const totalMensajes = campanas.reduce((s, c) => s + c.mensajes, 0);
  const resumen = {
    gasto: totalGasto,
    ventas: totalVentas,
    mensajes: totalMensajes,
    costoPorVenta: totalVentas > 0 ? Math.round(totalGasto / totalVentas) : 0,
    costoPorMensaje: totalMensajes > 0 ? Math.round(totalGasto / totalMensajes) : 0,
    moneda: meta.moneda,
  };

  return NextResponse.json({
    campanas,
    resumen,
    gastoMeta: { ok: meta.ok, error: meta.error ?? null },
  });
}

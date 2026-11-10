import { NextRequest, NextResponse } from 'next/server';
import { EVIDENCIA_CATALOGO_ID } from '@/lib/sin-evidencia';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cortesRecompra, estadoEffiRecompras, esNueva, tel10 } from '@/lib/ventas-vendedores/recompra';

export const dynamic = 'force-dynamic';

/**
 * Lista de VENTAS CONFIRMADAS para la pestaña "Ventas" del panel.
 *
 * Fuente: clientes_funnelish con confirmado=true. Así queda un registro seguro
 * de cada venta cerrada (por el bot o a mano) SIN depender de que el mensaje de
 * WhatsApp al número de registro se entregue (que fallaba por la ventana de 24h).
 *
 * ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD  (sobre confirmado_at)
 */
export async function GET(req: NextRequest) {
  const desde = req.nextUrl.searchParams.get('desde');
  const hasta = req.nextUrl.searchParams.get('hasta');
  // origen: 'whatsapp' = ventas que cierra el bot vendedor (referencia venta-…)
  //         'funnel'   = ventas que entran por la página/Funnelish
  //         (vacío)    = todas
  const origen = req.nextUrl.searchParams.get('origen');
  const soloPapelera = req.nextUrl.searchParams.get('papelera') === '1';
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const supabase = createServerSupabaseClient();

  let q = supabase
    .from('clientes_funnelish')
    .select('id, nombre, telefono, producto, talla, valor, direccion, ciudad, departamento, correo, confirmado_at, abono, abono_recibido, referencia, papelera_at, contacto_at, conversation_id, estado, created_at')
    .eq('confirmado', true)
    .order('confirmado_at', { ascending: false })
    .limit(2000);

  // Papelera (borrado suave, 30 días)
  if (soloPapelera) q = q.not('papelera_at', 'is', null).gte('papelera_at', hace30);
  else              q = q.is('papelera_at', null);

  if (desde) q = q.gte('confirmado_at', `${desde}T00:00:00`);
  if (hasta) q = q.lte('confirmado_at', `${hasta}T23:59:59`);
  // El bot vendedor marca sus pedidos con referencia "venta-…"
  if (origen === 'whatsapp') q = q.like('referencia', 'venta-%');
  else if (origen === 'funnel') q = q.not('referencia', 'like', 'venta-%');

  const { data: ventas, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let lista = ventas ?? [];

  // Chat de la venta: el guardado (chats CO.xxxx sin número) o 57 + teléfono
  const convDe = (v: any) => v.conversation_id ? String(v.conversation_id) : `57${String(v.telefono ?? '').replace(/^57/, '')}`;
  const convIds = lista.map(convDe);

  // ── Estado ACTUAL según la etiqueta de la conversación ──────────────────────
  // El usuario cambia estados por la etiqueta del chat. Si una venta que estaba
  // como VENTA REALIZADA se pasó a otro estado (cancelada, pendiente, programada,
  // abono por verificar), YA NO cuenta como venta: se saca del reporte.
  const labelPorConv = new Map<string, string>();
  if (convIds.length) {
    try {
      for (let i = 0; i < convIds.length; i += 500) {
        const { data: convs } = await supabase
          .from('conversations').select('id, label').in('id', convIds.slice(i, i + 500));
        for (const c of convs ?? []) labelPorConv.set(String((c as any).id), String((c as any).label ?? '').toUpperCase());
      }
      lista = lista.filter((v: any) => {
        const lab = labelPorConv.get(convDe(v));
        if (lab == null) return true; // sin conversación → se mantiene
        // Si la etiqueta actual la sacó de "venta realizada", se excluye
        return !/CANCELAD|PENDIENTE|PROGRAMAD|ABONO POR VERIFIC/.test(lab);
      });
    } catch { /* si falla, se muestran todas las confirmadas */ }
  }

  // ── Foto del producto por venta ─────────────────────────────────────────────
  // La conversación se identifica con el teléfono + prefijo 57. Se toma la última
  // imagen que envió el bot en ese chat (la del color/producto final).
  const fotoPorConv = new Map<string, string>();
  if (convIds.length) {
    try {
      const { data: imgs } = await supabase
        .from('messages')
        .select('conversation_id, content, created_at')
        .in('conversation_id', convIds)
        .eq('type', 'image').not('id', 'like', 'evid-%').not('content', 'ilike', `%${EVIDENCIA_CATALOGO_ID}%`).eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(4000);
      for (const m of imgs ?? []) {
        const cid = String((m as any).conversation_id);
        const url = String((m as any).content ?? '');
        if (!fotoPorConv.has(cid) && url.startsWith('http')) fotoPorConv.set(cid, url);
      }
    } catch { /* si falla, se muestran sin foto */ }
  }

  // ── RECOMPRA tras el descuento (10-nov-2026, dueño) ─────────────────────────
  // «Estado en Effi» cruza por TELÉFONO: la compra nueva de un cliente que ya estaba en Effi salía «En Effi»
  // con la guía VIEJA. Las ventas de después del corte (descuento enviado o etiqueta COMPRO EN DESCUENTO)
  // se cruzan SOLO con lo de Effi posterior al corte → si no se ha subido, queda «sin subir».
  const recompraDe = new Map<string, string>(); // id venta → corte
  const effiRecompra = new Map<string, string>(); // tel10 → estado
  try {
    const cortes = await cortesRecompra(supabase);
    const items: { tel: string; conv: string; corte: string }[] = [];
    for (const v of lista as any[]) {
      const t = tel10(v.telefono), corte = cortes.get(t);
      const fecha = v.confirmado_at ?? v.created_at;
      if (corte && (v.estado === 'recompra_descuento' || esNueva(fecha, corte))) {
        recompraDe.set(String(v.id), corte);
        if (!items.some(i => i.tel === t)) items.push({ tel: t, conv: convDe(v), corte });
      }
    }
    for (const [t, e] of await estadoEffiRecompras(supabase, items)) effiRecompra.set(t, e);
  } catch { /* sin datos: se cruza como antes */ }

  const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

  const ventasSalida = lista.map((v: any) => {
    const conv = convDe(v);
    const valorNum = Number(String(v.valor ?? '').replace(/[^\d]/g, '')) || 0;
    const abono = Number(v.abono ?? 0);
    return {
      id: v.id,
      nombre: v.nombre ?? '—',
      telefono: v.telefono ?? '—',
      producto: v.producto ?? '—',
      talla: v.talla ?? '—',
      valor: v.valor ?? '—',
      valorNum,
      direccion: v.direccion ?? '—',
      ciudad: v.ciudad ?? '—',
      departamento: v.departamento ?? '—',
      correo: v.correo ?? '—',
      fecha: v.confirmado_at ?? null,
      foto: fotoPorConv.get(conv) ?? null,
      conversationId: conv,
      abono,
      abonoRecibido: v.abono_recibido === true,
      cobrar: abono && valorNum ? pesos(valorNum - abono) : null,
      contactado: !!v.contacto_at,
      // El asesor la marcó "VENTA PROCESADA POR CORREGIR" (dirección, talla… mal): sigue siendo venta
      porCorregir: /POR CORREGIR/.test(labelPorConv.get(conv) ?? ''),
      // Compra NUEVA tras el descuento: su estado en Effi solo mira lo subido después del corte
      ...(recompraDe.has(String(v.id)) ? {
        recompra: true,
        effiRecompra: effiRecompra.get(tel10(v.telefono)) ?? 'sin_subir',
      } : {}),
    };
  });

  const totalVentas = ventasSalida.length;
  const totalIngresos = ventasSalida.reduce((s: number, v: any) => s + v.valorNum, 0);
  const porCorregir = ventasSalida.filter((v: any) => v.porCorregir).length;

  return NextResponse.json({
    ventas: ventasSalida,
    resumen: { total: totalVentas, ingresos: totalIngresos, porCorregir },
  });
}

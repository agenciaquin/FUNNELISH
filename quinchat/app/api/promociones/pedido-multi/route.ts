import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendConfirmacionTemplate } from '@/lib/whatsapp';
import { FALLBACK_IMAGE } from '@/lib/product-catalog';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function normTel(raw: string): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('57') && d.length >= 12) return d.slice(2, 12);
  return d.slice(-10);
}
const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const tallaCorta = (t: string) => t.replace('CABALLERO - ', '').replace('DAMA - ', '');

/**
 * Compra de VARIOS productos a la vez (carrito) desde /promos.
 * Valida el stock de todo, guarda un pedido por producto, descuenta inventario
 * y envía UNA sola confirmación por WhatsApp con el resumen. El bot queda apagado.
 */
export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'body inválido' }, { status: 400 }); }

  const nombre = String(b?.nombre ?? '').trim();
  const tel10 = normTel(b?.telefono);
  const direccion = String(b?.direccion ?? '').trim() || '—';
  const ciudad = String(b?.ciudad ?? '').trim() || '—';
  const departamento = String(b?.departamento ?? '').trim() || '—';
  const correo = String(b?.correo ?? '').trim() || 'Gerenciaquin7@gmail.com';
  const items: any[] = Array.isArray(b?.items) ? b.items : [];

  if (!nombre) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
  if (!/^3\d{9}$/.test(tel10)) return NextResponse.json({ error: 'El teléfono (celular) no es válido.' }, { status: 400 });
  if (items.length === 0) return NextResponse.json({ error: 'El carrito está vacío.' }, { status: 400 });

  const waPhone = `57${tel10}`;
  const now = new Date().toISOString();
  const supabase = createServerSupabaseClient();

  // Normalizar items
  const norm = items.map((it: any) => {
    const tallas: string[] = Array.isArray(it?.tallas) && it.tallas.length
      ? it.tallas.map((t: any) => String(t).trim()).filter(Boolean)
      : String(it?.talla ?? '').split(' + ').map((s: string) => s.trim()).filter(Boolean);
    return {
      promoId: String(it?.promoId ?? '').trim(),
      producto: String(it?.producto ?? '').trim(),
      color: String(it?.color ?? '').trim(),
      talla: tallas.join(' + ') || 'Por confirmar',
      tallas,
      precio: Math.round(Number(it?.precio ?? 0)) || 0,
      foto: (() => { const f = String(it?.foto ?? '').trim(); return f.startsWith('http') ? f : null; })(),
    };
  }).filter(it => it.producto);

  if (norm.length === 0) return NextResponse.json({ error: 'No hay productos válidos.' }, { status: 400 });

  // 0) Validar y reservar inventario de TODO el carrito (en memoria) antes de guardar.
  const cache: Record<string, { stock: Record<string, number>; variantes: Record<string, Record<string, number>>; usa: boolean }> = {};
  for (const it of norm) {
    if (!it.promoId) continue;
    if (!cache[it.promoId]) {
      const { data: promo } = await supabase.from('promociones').select('stock, variantes').eq('id', it.promoId).maybeSingle();
      const stock = (promo?.stock && typeof promo.stock === 'object') ? { ...promo.stock } : {};
      const variantes = (promo?.variantes && typeof promo.variantes === 'object') ? JSON.parse(JSON.stringify(promo.variantes)) : {};
      cache[it.promoId] = { stock, variantes, usa: Object.keys(variantes).length > 0 };
    }
    const c = cache[it.promoId];
    const pedidas: Record<string, number> = {};
    for (const t of it.tallas) pedidas[t] = (pedidas[t] ?? 0) + 1;
    for (const [t, n] of Object.entries(pedidas)) {
      if (c.usa) {
        const porColor = c.variantes[it.color];
        if (!porColor || (porColor[t] ?? 0) < n) {
          return NextResponse.json({ error: `Ya no hay disponibilidad de "${it.producto}"${it.color ? ` (${it.color})` : ''} talla ${tallaCorta(t)}.` }, { status: 409 });
        }
        porColor[t] -= n;
        if (Object.prototype.hasOwnProperty.call(c.stock, t)) c.stock[t] = Math.max(0, (c.stock[t] ?? 0) - n);
      } else if (Object.prototype.hasOwnProperty.call(c.stock, t)) {
        if ((c.stock[t] ?? 0) < n) {
          return NextResponse.json({ error: `Ya no hay disponibilidad de "${it.producto}" talla ${tallaCorta(t)}.` }, { status: 409 });
        }
        c.stock[t] -= n;
      }
    }
  }

  // 1) Guardar un pedido por producto.
  let totalNum = 0;
  const lineas: string[] = [];
  let firstFoto: string | null = null;
  for (const it of norm) {
    const referencia = `promo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const valor = it.precio ? pesos(it.precio) : '$130.000';
    try {
      await supabase.from('clientes_funnelish').insert({
        telefono: tel10, nombre, producto: it.producto, talla: it.talla, valor,
        ciudad, departamento, direccion, correo,
        foto_producto: it.foto, referencia,
        estado: 'pendiente', wa_enviado: false, confirmado: false,
        cantidad: it.tallas.length || 1, created_at: now, updated_at: now,
      });
      if (it.foto) {
        await supabase.from('messages').insert({
          id: `promo-img-${referencia}`, conversation_id: waPhone,
          content: it.foto, role: 'assistant', type: 'image', whatsapp_id: null, created_at: now,
        });
      }
    } catch { /* seguir con los demás */ }
    totalNum += it.precio;
    if (!firstFoto) firstFoto = it.foto;
    lineas.push(`• ${it.producto}${it.color ? ` (${it.color})` : ''}${it.talla !== 'Por confirmar' ? ` talla ${it.talla.split(' + ').map(tallaCorta).join(', ')}` : ''} — ${valor}`);
  }

  // 2) Descontar inventario ya validado.
  for (const [promoId, c] of Object.entries(cache)) {
    try {
      const upd: any = { stock: c.stock };
      if (c.usa) upd.variantes = c.variantes;
      await supabase.from('promociones').update(upd).eq('id', promoId);
    } catch { /* no bloquear */ }
  }

  // 3) Una sola confirmación por WhatsApp (plantilla Meta aprobada).
  const valorTotal = pesos(totalNum);
  const productoResumen = norm.length > 1 ? `${norm.length} productos` : norm[0].producto;
  let enviado = false;
  try {
    const wamid = await sendConfirmacionTemplate(waPhone, {
      saludo: nombre.split(' ')[0] || nombre, nombre, telefono: tel10,
      direccion, ciudad, departamento, correo,
      talla: 'ver detalle', producto: productoResumen, valor: valorTotal,
      imageUrl: firstFoto || FALLBACK_IMAGE,
    });
    enviado = !!wamid;
    const resumen =
      `Hola ${nombre} 😊 te saluda Lilibeth. Tu pedido ya está listo para despacho 🚚\n\n` +
      `🛍️ *Tu pedido (${norm.length} ${norm.length === 1 ? 'producto' : 'productos'}):*\n${lineas.join('\n')}\n\n` +
      `Total a pagar: *${valorTotal}*\n` +
      `Nombre: ${nombre}\nTeléfono: ${tel10}\nDirección: ${direccion}\nCiudad: ${ciudad}\nDepartamento: ${departamento}\n` +
      `✅ Si todo está correcto responde: CONFIRMO`;
    await supabase.from('messages').insert({
      id: `promomulti-${Date.now()}`, conversation_id: waPhone,
      content: resumen, role: 'assistant', type: 'text', whatsapp_id: wamid, created_at: now,
    });
  } catch (e) { console.error('[PromoMulti] envío falló:', e); }

  // 4) Conversación con bot apagado.
  try {
    await supabase.from('conversations').upsert({
      id: waPhone, contact_name: nombre,
      last_message: `Pedido promo: ${norm.length} productos`, last_message_time: now,
      unread_count: 1, bot_enabled: false, label: 'PENDIENTE POR CONFIRMACIÓN',
    }, { onConflict: 'id' });
    if (enviado) {
      await supabase.from('clientes_funnelish')
        .update({ wa_enviado: true, wa_enviado_at: now, estado: 'wa_enviado' })
        .eq('telefono', tel10).eq('confirmado', false).gte('created_at', now);
    }
  } catch { /* no bloquear */ }

  return NextResponse.json({ ok: true, enviado, productos: norm.length });
}

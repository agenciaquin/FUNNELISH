import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendConfirmacionTemplate } from '@/lib/whatsapp';
import { FALLBACK_IMAGE } from '@/lib/product-catalog';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Deja el teléfono en 10 dígitos (quita +57 / 57 y no-dígitos). */
function normTel(raw: string): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('57') && d.length >= 12) return d.slice(2, 12);
  return d.slice(-10);
}

/**
 * Compra desde la página de promociones (formulario "llenar datos").
 * QUINO toma el pedido, le escribe al cliente la confirmación con los datos
 * y se APAGA (no vuelve a responder; lo atiende una persona).
 */
export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'body inválido' }, { status: 400 }); }

  const nombre    = String(b?.nombre ?? '').trim();
  const tel10     = normTel(b?.telefono);
  const producto  = String(b?.producto ?? '').trim();
  const talla     = String(b?.talla ?? '').trim() || 'Por confirmar';
  const direccion = String(b?.direccion ?? '').trim() || '—';
  const ciudad    = String(b?.ciudad ?? '').trim() || '—';
  const departamento = String(b?.departamento ?? '').trim() || '—';
  const correo    = String(b?.correo ?? '').trim() || 'Gerenciaquin7@gmail.com';
  const foto      = String(b?.foto ?? '').trim();
  const cantidad  = Math.min(3, Math.max(1, Math.round(Number(b?.cantidad ?? 1)) || 1));
  const precioNum = Math.round(Number(b?.precio ?? 0)) || 0;
  const valor     = precioNum ? `$${precioNum.toLocaleString('es-CO')}` : '$130.000';

  const promoId   = String(b?.promoId ?? '').trim();
  const colorSel  = String(b?.color ?? '').trim();
  // Tallas que se compran, una por prenda (ej. ["CABALLERO - M","DAMA - L"]).
  const tallasArr: string[] = Array.isArray(b?.tallas) && b.tallas.length
    ? b.tallas.map((t: any) => String(t).trim()).filter(Boolean)
    : String(talla).split(' + ').map(s => s.trim()).filter(Boolean);

  if (!nombre)  return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
  if (!/^3\d{9}$/.test(tel10)) return NextResponse.json({ error: 'El teléfono (celular) no es válido.' }, { status: 400 });
  if (!producto) return NextResponse.json({ error: 'Falta el producto.' }, { status: 400 });

  const waPhone = `57${tel10}`;
  const now = new Date().toISOString();
  const supabase = createServerSupabaseClient();
  const fotoOk = foto.startsWith('http') ? foto : null;

  // 0) Inventario por talla: valida y reserva ANTES de crear el pedido.
  //    Cada talla que tenga número en `stock` se descuenta; las que no tienen
  //    número no llevan control (siempre disponibles).
  let nuevoStock: Record<string, number> | null = null;
  let nuevasVariantes: Record<string, Record<string, number>> | null = null;
  if (promoId) {
    const { data: promo } = await supabase.from('promociones').select('stock, variantes').eq('id', promoId).maybeSingle();
    const stock: Record<string, number> = (promo?.stock && typeof promo.stock === 'object') ? { ...promo.stock } : {};
    const variantes: Record<string, Record<string, number>> =
      (promo?.variantes && typeof promo.variantes === 'object') ? JSON.parse(JSON.stringify(promo.variantes)) : {};
    const usaVariantes = Object.keys(variantes).length > 0;
    // Cuántas unidades se piden por talla.
    const pedidasPorTalla: Record<string, number> = {};
    for (const t of tallasArr) pedidasPorTalla[t] = (pedidasPorTalla[t] ?? 0) + 1;

    for (const [t, n] of Object.entries(pedidasPorTalla)) {
      if (usaVariantes) {
        // Control por color + talla.
        const porColor = variantes[colorSel];
        if (!porColor || !Object.prototype.hasOwnProperty.call(porColor, t)) {
          return NextResponse.json({ error: `Esa talla/color ya no está disponible.` }, { status: 409 });
        }
        if ((porColor[t] ?? 0) < n) {
          return NextResponse.json({ error: `Ya no hay disponibilidad en ${colorSel} talla ${t.replace('CABALLERO - ', '').replace('DAMA - ', '')}.` }, { status: 409 });
        }
        porColor[t] = (porColor[t] ?? 0) - n;
        if (Object.prototype.hasOwnProperty.call(stock, t)) stock[t] = Math.max(0, (stock[t] ?? 0) - n); // mantener agregado
      } else if (Object.prototype.hasOwnProperty.call(stock, t)) {
        if ((stock[t] ?? 0) < n) {
          return NextResponse.json({ error: `Ya no hay disponibilidad en la talla ${t}.` }, { status: 409 });
        }
        stock[t] = (stock[t] ?? 0) - n;
      }
    }
    nuevoStock = stock;
    nuevasVariantes = usaVariantes ? variantes : null;
  }

  // 1) Guardar el pedido (referencia promo-* para distinguirlo).
  const referencia = `promo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await supabase.from('clientes_funnelish').insert({
      telefono: tel10, nombre, producto, talla, valor,
      ciudad, departamento, direccion, correo,
      foto_producto: fotoOk, referencia,
      estado: 'pendiente', wa_enviado: false, confirmado: false,
      cantidad, created_at: now, updated_at: now,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'No se pudo guardar el pedido.' }, { status: 500 });
  }

  // 2) QUINO le escribe al cliente la confirmación con los datos (plantilla Meta).
  let enviado = false;
  const imagenHeader = fotoOk || FALLBACK_IMAGE;
  try {
    const wamid = await sendConfirmacionTemplate(waPhone, {
      saludo: nombre.split(' ')[0] || nombre, nombre, telefono: tel10,
      direccion, ciudad, departamento, correo, talla, producto, valor,
      imageUrl: imagenHeader,
    });
    enviado = !!wamid;

    // Guardar la foto y el mensaje en el chat del panel.
    if (fotoOk) {
      await supabase.from('messages').insert({
        id: `promo-img-${referencia}`, conversation_id: waPhone,
        content: fotoOk, role: 'assistant', type: 'image', whatsapp_id: null, created_at: now,
      });
    }
    const resumen =
      `Hola ${nombre} 😊 te saluda Lilibeth. Tu pedido ya está listo para despacho 🚚\n` +
      `Nombre: ${nombre}\nTeléfono: ${tel10}\nDirección: ${direccion}\nCiudad: ${ciudad}\n` +
      `Departamento: ${departamento}\nCorreo: ${correo}\nTalla: ${talla}\n` +
      `Producto: ${producto}\nValor a pagar: ${valor}\n` +
      `✅ Si todo está correcto responde: CONFIRMO`;
    await supabase.from('messages').insert({
      id: `promo-${referencia}`, conversation_id: waPhone,
      content: resumen, role: 'assistant', type: 'text', whatsapp_id: wamid, created_at: now,
    });
  } catch (e) {
    console.error('[Promo] envío plantilla falló:', e);
  }

  // 2.b) Descontar el inventario (ya validado arriba).
  if (promoId && nuevoStock) {
    try {
      const upd: any = { stock: nuevoStock };
      if (nuevasVariantes) upd.variantes = nuevasVariantes;
      await supabase.from('promociones').update(upd).eq('id', promoId);
    } catch (e) { console.error('[Promo] no se pudo descontar stock:', e); }
  }

  // 3) Crear/actualizar la conversación con el bot APAGADO (QUINO no vuelve a responder).
  try {
    await supabase.from('conversations').upsert({
      id: waPhone, contact_name: nombre,
      last_message: `Pedido promo: ${producto}`, last_message_time: now,
      unread_count: 1, bot_enabled: false, label: 'PENDIENTE POR CONFIRMACIÓN',
    }, { onConflict: 'id' });
    if (enviado) {
      await supabase.from('clientes_funnelish')
        .update({ wa_enviado: true, wa_enviado_at: now, estado: 'wa_enviado' })
        .eq('referencia', referencia);
    }
  } catch { /* no bloquear */ }

  return NextResponse.json({ ok: true, enviado });
}

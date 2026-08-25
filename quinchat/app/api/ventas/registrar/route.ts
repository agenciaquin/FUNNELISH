import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage, sendImageByUrl } from '@/lib/whatsapp';
import { chat } from '@/lib/quinchat/claude';
import { isDirOficina } from '@/lib/address';
import { lineaTalla } from '@/lib/formato-pedido';

/**
 * Registra una venta marcada A MANO desde el panel (etiqueta "VENTA REALIZADA")
 * y la reenvía a los supervisores (Lilibeth y el dueño), igual que cuando la
 * confirma el cliente.
 *
 * Dos casos:
 *  1) Hay pedido del FUNNEL en clientes_funnelish → se usa ese.
 *  2) Chat de WhatsApp puro (sin pedido) → la IA arma el pedido con los datos
 *     que el cliente escribió en el chat y se envía igual.
 *
 * Es idempotente: si ya estaba confirmado, no vuelve a enviar el registro.
 */

// Los destinatarios de la ficha se deciden según el tipo de chat (WhatsApp o
// Funnel), dentro del handler (ver DESTINOS más abajo).

const money = (n: number) => `$${n.toLocaleString('es-CO')}`;

/** Foto del producto: la más reciente que envió el bot/asesor en la misma tanda. */
async function fotosDelChat(supabase: any, from: string): Promise<string[]> {
  try {
    const { data: imgs } = await supabase
      .from('messages').select('content, created_at')
      .eq('conversation_id', from).eq('type', 'image')
      .in('role', ['assistant', 'agent'])
      .order('created_at', { ascending: false }).limit(8);
    const lista = (imgs ?? []).filter((m: any) => typeof m.content === 'string' && m.content.startsWith('http'));
    if (lista.length === 0) return [];
    const tope = new Date(lista[0].created_at).getTime();
    const mismaTanda = lista.filter((m: any) => tope - new Date(m.created_at).getTime() <= 120_000);
    return ([...new Set(mismaTanda.map((m: any) => m.content))] as string[]).slice(0, 2);
  } catch { return []; }
}

/** Extrae con IA los datos del cliente desde lo que escribió en el chat. */
async function extraerDatosDelChat(supabase: any, from: string): Promise<any> {
  const { data: msgs } = await supabase
    .from('messages').select('content, role, type, created_at')
    .eq('conversation_id', from).eq('type', 'text')
    .order('created_at', { ascending: false }).limit(40);
  const orden = (msgs ?? []).reverse();
  const texto = orden
    .filter((m: any) => typeof m.content === 'string' && m.content.trim() && !m.content.startsWith('http'))
    .map((m: any) => `${m.role === 'user' ? 'CLIENTE' : m.role === 'agent' ? 'ASESOR' : 'BOT'}: ${m.content.trim()}`)
    .join('\n')
    .slice(-6000);

  const sistema =
    `Eres un asistente que arma pedidos de una tienda colombiana de buzos (pago contra entrega).\n` +
    `Lee la conversación y devuelve SOLO un JSON con los datos del cliente para el despacho:\n` +
    `{"nombre":"","telefono":"","cedula":"","direccion":"","barrio":"","ciudad":"","departamento":"","correo":""}\n` +
    `Usa exactamente lo que escribió el CLIENTE. Si un dato no aparece, déjalo en "". No inventes. Responde solo el JSON.`;

  try {
    const resp = await chat({
      messages: [{ role: 'user', content: `Conversación:\n\n${texto}` }],
      tenantId: 'klixmant',
      systemPrompt: sistema,
      maxTokens: 500,
    });
    const crudo = resp.message.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const ini = crudo.indexOf('{'); const fin = crudo.lastIndexOf('}');
    if (ini < 0 || fin <= ini) return {};
    return JSON.parse(crudo.slice(ini, fin + 1));
  } catch (e: any) {
    console.error('[Ventas] extracción del chat falló:', e?.message);
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const { conversationId, producto: prodOverride, talla: tallaOverride, valor: valorOverride } = await req.json();
    if (!conversationId) {
      return NextResponse.json({ error: 'falta conversationId' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const from  = String(conversationId);
    const tel10 = from.replace(/^57/, '').slice(-10);

    // ¿La ficha es de un chat de WHATSAPP o del FUNNEL? Según eso cambia a quién llega:
    //  · WhatsApp (linea='ventas') → 3143534918 (tu chat) + Lilibeth (3187051499)
    //  · Funnel                    → 3167648391 (operación) + Lilibeth (3187051499)
    let esWhatsApp = false;
    try {
      const { data: convLinea } = await supabase.from('conversations')
        .select('linea').eq('id', from).maybeSingle();
      esWhatsApp = String(convLinea?.linea ?? '').toLowerCase() === 'ventas';
    } catch { /* si falla, se trata como funnel */ }
    const DESTINOS = esWhatsApp
      ? ['573143534918', '573187051499']
      : ['573167648391', '573187051499'];
    // Título de la ficha según el origen real del chat (no siempre WhatsApp).
    const tituloFicha = esWhatsApp
      ? '💬 *VENTA CONFIRMADA — CHAT WHATSAPP*'
      : '📊 *VENTA CONFIRMADA — CHAT FUNNEL*';

    // Pedido más reciente no cancelado de este cliente (viene del funnel o de una venta previa)
    const { data: pedido } = await supabase
      .from('clientes_funnelish')
      .select('id, nombre, producto, talla, direccion, ciudad, departamento, correo, valor, telefono, confirmado, abono, abono_recibido')
      .eq('telefono', tel10)
      .not('estado', 'in', '("cancelado","duplicado")')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    // ── CASO 2: no hay pedido → armar con los datos del chat (WhatsApp puro) ────
    if (!pedido) {
      const d = await extraerDatosDelChat(supabase, from);
      const producto = String(prodOverride ?? '').trim() || String(d.producto ?? '').trim();
      const talla    = String(tallaOverride ?? '').trim();
      const valorTxt = String(valorOverride ?? '').trim();
      const valorNum = Number(valorTxt.replace(/[^\d]/g, '')) || 0;
      const nombre   = String(d.nombre ?? '').trim();
      const direccion = String(d.direccion ?? '').trim();

      const ficha =
        `${tituloFicha}\n` +
        `_Marcada manualmente desde el panel_\n` +
        `Nombre: ${nombre || '—'}\n` +
        `Teléfono: ${String(d.telefono ?? '').replace(/\D/g, '').slice(-10) || tel10}\n` +
        (d.cedula ? `Cédula: ${d.cedula}\n` : '') +
        `Dirección: ${direccion || '—'}\n` +
        (d.barrio ? `Barrio: ${d.barrio}\n` : '') +
        `Ciudad: ${d.ciudad || '—'}\n` +
        `Departamento: ${d.departamento || '—'}\n` +
        (d.correo ? `Correo: ${d.correo}\n` : '') +
        `${lineaTalla(talla)}\n` +
        `Producto: ${producto || '—'}\n` +
        `Valor: ${valorNum ? money(valorNum) : (valorTxt || '—')} — PAGO CONTRA ENTREGA`;

      const fotos = await fotosDelChat(supabase, from);
      for (const s of DESTINOS) {
        if (fotos.length > 0) {
          try { await sendImageByUrl(s, fotos[0], ficha); } catch { /* ignorar */ }
          for (const u of fotos.slice(1)) { try { await sendImageByUrl(s, u, ''); } catch { /* ignorar */ } }
        } else {
          try { await sendTextMessage(s, ficha); } catch { /* ignorar */ }
        }
      }

      // Se guarda como venta confirmada (idempotencia + aparece en Ventas/Pedidos)
      try {
        await supabase.from('clientes_funnelish').insert({
          nombre, telefono: tel10, direccion,
          ciudad: String(d.ciudad ?? '').trim(),
          departamento: String(d.departamento ?? '').trim(),
          correo: String(d.correo ?? '').trim(),
          talla, producto,
          valor: valorNum ? money(valorNum) : valorTxt,
          confirmado: true,
          confirmado_at: new Date().toISOString(),
          estado: 'wa_manual',
          referencia: `wa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          created_at: new Date().toISOString(),
        });
      } catch (e: any) { console.error('[Ventas] no se pudo guardar venta WA:', e?.message); }

      return NextResponse.json({ ok: true, origen: 'chat-whatsapp' });
    }

    // ── CASO 1: hay pedido del funnel ──────────────────────────────────────────
    if (pedido.confirmado) {
      return NextResponse.json({ ok: false, motivo: 'ya-confirmado' });
    }

    if (typeof prodOverride === 'string' && prodOverride.trim()) pedido.producto = prodOverride.trim();
    if (typeof tallaOverride === 'string' && tallaOverride.trim()) pedido.talla = tallaOverride.trim();
    if (typeof valorOverride === 'string' && valorOverride.trim()) pedido.valor = valorOverride.trim();

    await supabase.from('clientes_funnelish').update({
      confirmado: true,
      confirmado_at: new Date().toISOString(),
      estado: 'confirmado',
      producto: pedido.producto,
      talla: pedido.talla,
      valor: pedido.valor,
    }).eq('id', pedido.id);

    // Los pedidos que se recogen en OFICINA siempre llevan abono de $5.000. Si el
    // flujo anterior no lo alcanzó a guardar, se aplica aquí para que la ficha
    // salga con el desglose correcto (Total / Abono / Cobrar), no con los datos de inicio.
    let abono = Number(pedido.abono ?? 0);
    if (!abono && isDirOficina(pedido.direccion)) {
      abono = 5000;
      try { await supabase.from('clientes_funnelish').update({ abono: 5000 }).eq('id', pedido.id); } catch { /* ignorar */ }
    }
    const valorNum = Number(String(pedido.valor ?? '').replace(/[^\d]/g, '')) || 0;
    const cobro = abono && valorNum
      ? `Total: ${money(valorNum)}\n` +
        `Abono: ${money(abono)} ${pedido.abono_recibido ? '✅ recibido' : '⏳ pendiente'}\n` +
        `*COBRAR: ${money(valorNum - abono)}*`
      : `Valor: ${pedido.valor ?? '—'}`;

    const registro =
      `${tituloFicha}\n` +
      `_Marcada manualmente desde el panel_\n` +
      `Nombre: ${pedido.nombre ?? '—'}\n` +
      `Teléfono: ${pedido.telefono ?? tel10}\n` +
      `Dirección: ${pedido.direccion ?? '—'}\n` +
      `Ciudad: ${pedido.ciudad ?? '—'}\n` +
      `Departamento: ${pedido.departamento ?? '—'}\n` +
      `Correo: ${pedido.correo ?? '—'}\n` +
      `${lineaTalla(pedido.talla)}\n` +
      `Producto: ${pedido.producto ?? '—'}\n` +
      cobro;

    const urls = await fotosDelChat(supabase, from);
    for (const s of DESTINOS) {
      if (urls.length > 0) {
        try { await sendImageByUrl(s, urls[0], registro); } catch { /* ignorar */ }
        for (const u of urls.slice(1)) { try { await sendImageByUrl(s, u, ''); } catch { /* ignorar */ } }
      } else {
        try { await sendTextMessage(s, registro); } catch { /* ignorar */ }
      }
    }

    return NextResponse.json({ ok: true, origen: 'funnel' });
  } catch (e: any) {
    console.error('[Ventas] registrar manual error:', e?.message);
    return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 });
  }
}

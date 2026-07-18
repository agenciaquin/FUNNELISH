import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage, sendAudioByUrl, sendImageByUrl } from '@/lib/whatsapp';
import { PRODUCT_NAMES, FALLBACK_IMAGE, getProductImageUrl } from '@/lib/product-catalog';
import { chat } from '@/lib/quinchat/claude';
import type { ChatRequest } from '@/lib/quinchat/types';

// ─── Helpers de dirección ─────────────────────────────────────────────────────

/**
 * Valida si una cadena es una dirección de domicilio completa.
 * Reglas definidas por el equipo Klixmant.
 */
function isCompleteAddress(addr: string | null | undefined): boolean {
  if (!addr || addr.trim() === '' || addr === '—') return false;
  const a = addr.toLowerCase().trim();
  if (a.length < 5) return false;

  // Calle / Carrera / Diagonal / Transversal / Avenida + número + # + número
  if (/\b(calle|carrera|diagonal|transversal|avenida|cl\b|cra\b|cr\b|kr\b|diag\b|av\b|cll\b)\s*\d+\s*[#\-]\s*\d/.test(a)) return true;

  // Manzana + Casa
  if (/\b(manzana|mz\.?)\b.{0,40}\b(casa|cs\.?)\b/.test(a)) return true;

  // Conjunto + Casa o Apartamento
  if (/\b(conjunto|conj\.?)\b.{0,60}\b(casa|cs\.?|apartamento|apto\.?|apt\.?)\b/.test(a)) return true;

  // Edificio + Apartamento
  if (/\b(edificio|edif\.?)\b.{0,40}\b(apartamento|apto\.?|apt\.?)\b/.test(a)) return true;

  // Vereda + Finca
  if (/\b(vereda|vda\.?)\b.{0,40}\b(finca)\b/.test(a)) return true;

  return false;
}

// ─── Frases de confirmación natural ──────────────────────────────────────────

const NATURAL_CONFIRM_PHRASES = [
  'si esta bien', 'sí está bien', 'si está bien', 'sí esta bien',
  'si correcto', 'sí correcto', 'si todo correcto', 'sí todo correcto',
  'todo correcto', 'todo está correcto', 'todo esta correcto',
  'si esos son mis datos', 'sí esos son mis datos', 'esos son mis datos',
  'si todo esta bien', 'sí todo está bien', 'sí todo esta bien',
  'confirmado', 'si confirmo', 'sí confirmo',
  'si eso es', 'sí eso es', 'si todo bien', 'sí todo bien',
  'así está bien', 'asi esta bien', 'de acuerdo', 'todo bien',
  'si perfecto', 'sí perfecto', 'perfecto así',
];

/** True cuando la dirección es recogida en oficina/interrapidísimo (no domicilio). */
function isDirOficina(addr: string | null | undefined): boolean {
  if (!addr || addr.trim() === '' || addr === '—') return false;
  const a = addr.toLowerCase();
  return a.includes('interrapid') || a.includes('reclamo') || a.includes('reclamar')
    || (a.includes('oficina') && !isCompleteAddress(addr));
}

// ─── Catálogo de colores desde la DB ─────────────────────────────────────────

interface ColorVariantDB {
  color: string;
  nombre_producto: string;
  url_imagen: string | null;
}

/**
 * Busca en la tabla catalogos_bot el catálogo que corresponde al producto
 * y, si se menciona un color, intenta encontrar la variante exacta.
 */
async function findColorVariantInDB(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  productoNombre: string,
  colorMentioned: string | null,
): Promise<{ familia: string; colores: ColorVariantDB[]; match: ColorVariantDB | null } | null> {
  const { data: catalogos } = await supabase
    .from('catalogos_bot')
    .select('id, familia, patron, catalogo_colores(color, nombre_producto, url_imagen)')
    .eq('activo', true);
  if (!catalogos?.length) return null;

  const pUpper = productoNombre.toUpperCase();
  const catalog = catalogos.find(c => pUpper.includes(c.patron.toUpperCase()));
  if (!catalog) return null;

  const colores: ColorVariantDB[] = catalog.catalogo_colores ?? [];
  if (!colorMentioned) return { familia: catalog.familia, colores, match: null };

  const cLower = colorMentioned.toLowerCase();
  const match = colores.find(c =>
    cLower.includes(c.color.toLowerCase()) ||
    c.color.toLowerCase().includes(cLower) ||
    c.nombre_producto.toUpperCase().split(/\s+/).some(w => w.length >= 4 && cLower.includes(w.toLowerCase()))
  ) ?? null;

  return { familia: catalog.familia, colores, match };
}

/** Detecta si el texto menciona un color */
const COLOR_NAMES = ['azul oscuro', 'rojo', 'negro', 'azul', 'blanco marfil', 'marfil', 'blanco', 'amarillo', 'beige', 'verde', 'gris', 'cocoa', 'azul navy', 'verde oscuro'];
function detectColorInText(textLower: string): string | null {
  return COLOR_NAMES.find(c => textLower.includes(c)) ?? null;
}

// ─── Helper para guardar mensajes ────────────────────────────────────────────

async function saveAndSend(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  from: string,
  content: string,
  type: 'text' | 'image' = 'text',
  wamid?: string | null,
) {
  const now = new Date().toISOString();
  await supabase.from('messages').insert({
    id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    conversation_id: from,
    content,
    role: 'assistant',
    type,
    whatsapp_id: wamid ?? undefined,
    created_at: now,
  });
  if (type === 'text') {
    await supabase.from('conversations').update({
      last_message: content.slice(0, 100),
      last_message_time: now,
    }).eq('id', from);
  }
}

// ─── GET — verificación Meta ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode      = params.get('hub.mode');
  const token     = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[Webhook] Meta verification OK');
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ─── POST — Mensajes entrantes WhatsApp ───────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ status: 'ok' }); }

  const value = body?.entry?.[0]?.changes?.[0]?.value;
  if (!value?.messages?.length) return NextResponse.json({ status: 'ok' });

  const supabase      = createServerSupabaseClient();
  const contactName   = value.contacts?.[0]?.profile?.name ?? 'Desconocido';

  for (const msg of value.messages) {
    const from  = msg.from as string;
    const msgId = msg.id  as string;

    // ── Imagen entrante — comprobante de abono ───────────────────────────────
    if (msg.type === 'image') {
      // Verificar que el bot esté activo para esta conversación
      const { data: convImg } = await supabase
        .from('conversations').select('bot_enabled').eq('id', from).maybeSingle();
      const botActivo = convImg ? (convImg.bot_enabled ?? true) : true;

      if (botActivo) {
        await supabase.from('conversations')
          .update({ label: 'ABONO POR VERIFICAR' }).eq('id', from);
        const finalMsg = '¡Gracias por tu compra, cuando lo envie te estara llegando el número de guía desde nuestro chatbot, cuyo número asociado es 3142576239, para que puedas realizarle seguimiento a tu paquete.';
        const ackWamid = await sendTextMessage(from, finalMsg);
        if (ackWamid) await saveAndSend(supabase, from, finalMsg, 'text', ackWamid);
      }
      continue;
    }

    // Solo texto de aquí en adelante
    if (msg.type !== 'text') continue;

    const text: string = msg.text?.body ?? '';
    if (!text.trim()) continue;

    // ── Upsert conversación ──────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('conversations').select('unread_count, bot_enabled').eq('id', from).maybeSingle();

    if (existing) {
      await supabase.from('conversations').update({
        contact_name: contactName,
        last_message: text,
        last_message_time: new Date().toISOString(),
        unread_count: (existing.unread_count ?? 0) + 1,
      }).eq('id', from);
    } else {
      await supabase.from('conversations').insert({
        id: from, contact_name: contactName,
        last_message: text, last_message_time: new Date().toISOString(),
        unread_count: 1, bot_enabled: true,
      });
    }

    // ── Resolver contexto de mensaje citado ──────────────────────────────────
    let replyToContent: string | null = null;
    if (msg.context?.id) {
      const { data: quotedMsg } = await supabase.from('messages').select('content, type')
        .or(`whatsapp_id.eq.${msg.context.id},id.eq.${msg.context.id}`).maybeSingle();
      if (quotedMsg) {
        if ((quotedMsg.type === 'image' || quotedMsg.type === 'video') && quotedMsg.content.startsWith('http'))
          replyToContent = quotedMsg.content;
        else if (quotedMsg.type === 'image')    replyToContent = '🖼️ Foto';
        else if (quotedMsg.type === 'audio')    replyToContent = '🎵 Audio';
        else if (quotedMsg.type === 'video')    replyToContent = '🎬 Video';
        else if (quotedMsg.type === 'document') replyToContent = '📎 Documento';
        else replyToContent = quotedMsg.content;
      } else {
        replyToContent = '💬';
      }
    }

    // ── Guardar mensaje entrante (idempotente) ───────────────────────────────
    await supabase.from('messages').upsert({
      id: msgId, conversation_id: from, content: text,
      role: 'user', type: 'text', reply_to: replyToContent,
      created_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    // ── Verificar bot activo ─────────────────────────────────────────────────
    const botEnabled = existing ? (existing.bot_enabled ?? true) : true;
    if (!botEnabled) continue;

    const textLower = text.toLowerCase();

    // ── Audio automático cuando pide oficina o municipio sin cobertura ────────
    const AUDIO_OFICINA   = 'https://bjbjqmbuzpyjvcugbusx.supabase.co/storage/v1/object/public/chat-media/audios-bot/abono-oficina.ogg';
    const AUDIO_MUNICIPIO = 'https://bjbjqmbuzpyjvcugbusx.supabase.co/storage/v1/object/public/chat-media/audios-bot/abono-municipio.ogg';
    const isOficina   = textLower.includes('interrapidisimo') || textLower.includes('interrapidísimo')
                     || textLower.includes('reclamar en oficina') || textLower.includes('recoger en oficina');
    const isMunicipio = textLower.includes('no llega contra entrega')
                     || textLower.includes('no hay contra entrega')
                     || textLower.includes('zona rural');

    if (isOficina || isMunicipio) {
      const audioUrl   = isOficina ? AUDIO_OFICINA : AUDIO_MUNICIPIO;
      const audioLabel = isOficina ? '🎵 Audio abono oficina' : '🎵 Audio abono municipio';
      const { data: existingAudio } = await supabase.from('messages').select('id')
        .eq('conversation_id', from).eq('type', 'audio').eq('content', audioUrl).maybeSingle();
      if (!existingAudio) {
        const audioWamid = await sendAudioByUrl(from, audioUrl);
        if (audioWamid) {
          const nowA = new Date().toISOString();
          await supabase.from('messages').insert({
            id: `bot-audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            conversation_id: from, content: audioUrl,
            role: 'assistant', type: 'audio', whatsapp_id: audioWamid, created_at: nowA,
          });
          await supabase.from('conversations').update({ last_message: audioLabel, last_message_time: nowA }).eq('id', from);
        }
      } else {
        const exp = `Te entiendo perfectamente 😊 Si dependiera de mí te lo enviamos sin abono, pero es una política del área de despacho. Los $5.000 son para garantizar el despacho. ¿Listo? 🙌`;
        const expWamid = await sendTextMessage(from, exp);
        await saveAndSend(supabase, from, exp, 'text', expWamid);
      }
      continue;
    }

    // ── Detección CONFIRMO ───────────────────────────────────────────────────
    const textClean = text.trim().toUpperCase();
    const isConfirmo = ['CONFIRMO', '✅ CONFIRMO', 'CONFIRMO ✅', 'SI CONFIRMO', 'SÍ CONFIRMO']
      .includes(textClean)
      || textClean.startsWith('CONFIRMO ')
      || textClean === 'SI'
      || textClean === 'SÍ';

    if (isConfirmo) {
      const tel10 = from.replace(/^57/, '').slice(-10);
      const { data: pedido } = await supabase
        .from('clientes_funnelish')
        .select('id, nombre, producto, talla, direccion, ciudad, departamento')
        .eq('telefono', tel10).eq('confirmado', false)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (pedido) {
        const missing: string[] = [];
        if (!pedido.talla || pedido.talla === 'Por confirmar')
          missing.push('talla del buzo (XS, S, M, L, XL, XXL, XXXL)');
        if (!isCompleteAddress(pedido.direccion))
          missing.push('dirección completa de domicilio (ej: Calle 15 # 20-30 Barrio)');
        if (!pedido.ciudad || pedido.ciudad === '—')
          missing.push('ciudad');
        if (!pedido.departamento || pedido.departamento === '—')
          missing.push('departamento');

        if (missing.length > 0) {
          const reask = missing.length === 1
            ? `Antes de confirmar necesito tu ${missing[0]}.`
            : `Antes de confirmar necesito:\n${missing.map(f => `• ${f}`).join('\n')}`;
          const wamid = await sendTextMessage(from, reask);
          await saveAndSend(supabase, from, reask, 'text', wamid);
          continue;
        }

        // Todo completo → confirmar
        await supabase.from('clientes_funnelish').update({
          confirmado: true, confirmado_at: new Date().toISOString(), estado: 'confirmado',
        }).eq('id', pedido.id);
        await supabase.from('conversations').update({ label: 'VENTA REALIZADA' }).eq('id', from);
      }

      const confirmReply = '¡Gracias por tu compra, cuando lo envie te estara llegando el número de guía desde nuestro chatbot, cuyo número asociado es 3142576239, para que puedas realizarle seguimiento a tu paquete.';
      const wamid = await sendTextMessage(from, confirmReply);
      await saveAndSend(supabase, from, confirmReply, 'text', wamid);
      continue;
    }

    // ── Buscar pedido pendiente ──────────────────────────────────────────────
    // Nota: NO filtramos por wa_enviado=true — puede llegar un mensaje del cliente
    // antes de que el webhook de Funnelish termine de marcar wa_enviado (race condition).
    const tel10 = from.replace(/^57/, '').slice(-10);
    const { data: pendingPedido } = await supabase
      .from('clientes_funnelish')
      .select('id, nombre, producto, talla, direccion, ciudad, departamento, valor, correo, telefono')
      .eq('telefono', tel10).eq('confirmado', false)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    // ── Sin pedido activo ────────────────────────────────────────────────────
    if (!pendingPedido) {
      // ¿Hay un pedido ya confirmado? (cliente confirmó y luego sigue escribiendo)
      const { data: confirmedPedido } = await supabase
        .from('clientes_funnelish')
        .select('nombre, producto, talla, valor, direccion, ciudad, departamento, correo, telefono')
        .eq('telefono', tel10).eq('wa_enviado', true).eq('confirmado', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (confirmedPedido) {
        // Pedido ya confirmado — Claude responde en contexto post-confirmación
        const { data: histConf } = await supabase
          .from('messages').select('content, role')
          .eq('conversation_id', from).order('created_at', { ascending: false }).limit(6);

        const sysConf =
          `Eres Josué de Klixmant. El cliente ya confirmó su pedido: *${confirmedPedido.producto}* — Valor: *${confirmedPedido.valor}*.\n` +
          `El pedido está confirmado y será despachado en las próximas 24 horas.\n` +
          `Si el cliente pregunta por el abono para Interrapidísimo u oficina: explica que son $5.000 de garantía requeridos por el área de despacho para garantizar el envío. Si insiste en que no puede, dile amablemente que lo pasarás con un asesor.\n` +
          `Si el cliente pregunta cuándo llega o el número de guía: dile que recibirá el número de guía por este mismo chat una vez despachado.\n` +
          `Sé amable, breve y tranquilizador. PROHIBIDO mencionar otros productos, catálogo ni precios de otros artículos.\n`;

        const histMsgs: ChatRequest['messages'] = [...(histConf ?? [])]
          .reverse()
          .filter((m: any) => m.content?.trim() && !m.content.startsWith('http'))
          .map((m: any) => ({
            role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content as string,
          }));
        if (!histMsgs.length || histMsgs[histMsgs.length - 1]?.role !== 'user') {
          histMsgs.push({ role: 'user', content: text });
        }

        try {
          const resp = await chat({ messages: histMsgs, tenantId: 'klixmant', systemPrompt: sysConf });
          const wamid = await sendTextMessage(from, resp.message);
          if (wamid) await saveAndSend(supabase, from, resp.message, 'text', wamid);
        } catch { /* ignorar error */ }
        continue;
      }

      // Genuinamente no hay pedido activo ni confirmado
      const noPedidoMsg = `Hola 😊 No encontramos un pedido activo para este número. Si ya realizaste tu compra, en unos minutos recibirás los detalles. Para ver el catálogo o hacer un pedido, un asesor puede ayudarte.`;
      const wamid = await sendTextMessage(from, noPedidoMsg);
      await saveAndSend(supabase, from, noPedidoMsg, 'text', wamid);
      continue;
    }

    // ── Solicitud de catálogo → redirigir a humano ───────────────────────────
    const catalogWords = ['catalogo', 'catálogo', 'más productos', 'mas productos',
      'otros productos', 'ver más', 'ver mas', 'qué más tienen', 'que mas tienen',
      'qué tienen', 'que tienen', 'diseños disponibles', 'que diseños', 'qué diseños',
      'ver todo', 'ver todos', 'más modelos', 'mas modelos'];
    if (catalogWords.some(w => textLower.includes(w))) {
      const handoff = `Para mostrarte todo el catálogo, te paso con un asesor que te puede ayudar 😊 Un momento por favor.`;
      const wamid = await sendTextMessage(from, handoff);
      await saveAndSend(supabase, from, handoff, 'text', wamid);
      await supabase.from('conversations').update({ label: 'VER CATÁLOGO - HUMANO' }).eq('id', from);
      continue;
    }

    // ── Auto-guardar talla ───────────────────────────────────────────────────
    let currentTalla = pendingPedido.talla ?? '';
    const tallaMatch = text.match(/\b(XS|S|M|L|XL|XXL|XXXL)\b/i);
    const clientGaveTalla = !!tallaMatch && (!currentTalla || currentTalla === 'Por confirmar');
    if (clientGaveTalla) {
      currentTalla = tallaMatch![1].toUpperCase();
      await supabase.from('clientes_funnelish').update({ talla: currentTalla }).eq('id', pendingPedido.id);
    }

    // ── Auto-guardar dirección (validación estricta) ──────────────────────────
    let currentDireccion = pendingPedido.direccion ?? '';
    const dirAlreadyComplete = isCompleteAddress(currentDireccion);
    const textIsAddress      = isCompleteAddress(text);
    const clientGaveDireccion = !dirAlreadyComplete && textIsAddress;
    if (clientGaveDireccion) {
      currentDireccion = text.trim();
      await supabase.from('clientes_funnelish').update({ direccion: currentDireccion }).eq('id', pendingPedido.id);
    }

    // ── Cambio de color ──────────────────────────────────────────────────────
    const colorChangeWords = [
      'cambiar el color', 'cambio de color', 'otro color', 'en otro color',
      'cambiarlo', 'cambien', 'pueden cambiar', 'me lo cambian',
      'cambiar por', 'cambiar a', 'cambiar al', 'cambiar el buzo',
      'me lo mandan en', 'lo quiero en', 'lo quiero de',
    ];
    const mentionedColor    = detectColorInText(textLower);
    const colorChangeIntent = colorChangeWords.some(w => textLower.includes(w))
      || (textLower.includes('cambiar') && !!mentionedColor) // "cambiar" + color
      || (textLower.includes('lo quiero') && !!mentionedColor);

    // Detectar si el bot preguntó por el color en su último mensaje
    const { data: lastBotMsg } = await supabase
      .from('messages').select('content')
      .eq('conversation_id', from).eq('role', 'assistant')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const lastBotAskedColor = !!(
      lastBotMsg?.content?.toLowerCase().includes('qué color') ||
      lastBotMsg?.content?.toLowerCase().includes('que color') ||
      lastBotMsg?.content?.toLowerCase().includes('a qué color') ||
      lastBotMsg?.content?.toLowerCase().includes('colores disponibles') ||
      lastBotMsg?.content?.toLowerCase().includes('tenemos:')
    );

    if (colorChangeIntent || (lastBotAskedColor && mentionedColor)) {
      // Buscar el catálogo del producto en la DB
      const catalogResult = await findColorVariantInDB(supabase, pendingPedido.producto, mentionedColor);

      if (!catalogResult) {
        // No hay catálogo definido para este producto → humano
        const msg = `Para cambiar el modelo, te paso con un asesor 😊 Un momento.`;
        const wamid = await sendTextMessage(from, msg);
        await saveAndSend(supabase, from, msg, 'text', wamid);
        await supabase.from('conversations').update({ label: 'CAMBIO PRODUCTO - HUMANO' }).eq('id', from);
        continue;
      }

      if (catalogResult.match) {
        // Color encontrado en el catálogo → actualizar pedido + enviar foto
        const newProduct = catalogResult.match.nombre_producto;
        await supabase.from('clientes_funnelish').update({ producto: newProduct }).eq('id', pendingPedido.id);

        const imgUrl = catalogResult.match.url_imagen || getProductImageUrl(newProduct);
        if (imgUrl && imgUrl !== FALLBACK_IMAGE) {
          const imgWamid = await sendImageByUrl(from, imgUrl, newProduct);
          await saveAndSend(supabase, from, imgUrl, 'image', imgWamid);
        }
        const confirmMsg = `✅ Listo, cambié tu pedido a *${newProduct}*.\n\nRevisa la foto y escribe *CONFIRMO* o "si está bien" para que despachemos en 24 horas. 🚚`;
        const wamid = await sendTextMessage(from, confirmMsg);
        await saveAndSend(supabase, from, confirmMsg, 'text', wamid);

      } else if (mentionedColor && catalogResult.colores.length) {
        // Mencionó un color pero no está en el catálogo → mostrar disponibles
        const colorList = catalogResult.colores.map(c => c.color).join(', ');
        const noColor = `Lo sentimos 😔 Ese color no está disponible para *${catalogResult.familia}*.\n\nColores disponibles: ${colorList}\n\n¿Cuál prefieres?`;
        const wamid = await sendTextMessage(from, noColor);
        await saveAndSend(supabase, from, noColor, 'text', wamid);

      } else {
        // No mencionó color → preguntar cuál quiere
        const colorList = catalogResult.colores.map(c => c.color).join(', ');
        const ask = `¡Claro! 😊 ¿A qué color quieres cambiarlo?\n\nPara *${catalogResult.familia}* tenemos: ${colorList || 'consulta con un asesor'}`;
        const wamid = await sendTextMessage(from, ask);
        await saveAndSend(supabase, from, ask, 'text', wamid);
      }
      continue;
    }

    // ── Estado actual de campos ──────────────────────────────────────────────
    const stillMissingTalla = !currentTalla || currentTalla === 'Por confirmar';
    const isDirOficinaType  = isDirOficina(currentDireccion);
    // Dir OK si es una dirección real completa. Las dirs de oficina no cuentan como "missing"
    // porque el abono es el sustituto — pero tampoco cuentan como "listas" para confirmar.
    const stillMissingDir   = !isCompleteAddress(currentDireccion) && !isDirOficinaType;

    // ── Respuesta fija si el cliente acaba de dar un dato ────────────────────
    let fixedReply: string | null = null;

    if (clientGaveTalla && clientGaveDireccion) {
      fixedReply = stillMissingTalla || stillMissingDir
        ? null // edge case — no debería pasar
        : `✅ Perfecto, talla *${currentTalla}* y dirección anotadas.\n\nTodo está listo 🎉 Responde *CONFIRMO*, "si está bien" o dime que confirmas para que despachemos tu *${pendingPedido.producto}*. 🚚`;
    } else if (clientGaveTalla) {
      if (isDirOficinaType) {
        // Dirección es oficina → recordar el abono en vez de pedir dirección
        fixedReply = `✅ Talla *${currentTalla}* anotada.\n\nRecuerda que para el despacho por la oficina de Interrapidísimo necesitas hacer el abono de $5.000. Cuando lo hayas hecho, envíame el comprobante por aquí 📷`;
      } else if (stillMissingDir) {
        fixedReply = `✅ Talla *${currentTalla}* confirmada.\n\n📍 Para completar el pedido necesito tu dirección de domicilio completa (ej: Calle 15 # 20-30, Barrio). ¿Cuál es?`;
      } else {
        fixedReply = `✅ Talla *${currentTalla}* confirmada. Todo listo 🎉\n\nEscribe *CONFIRMO*, "si está bien" o dime que confirmas para que despachemos tu *${pendingPedido.producto}*. 🚚`;
      }
    } else if (clientGaveDireccion) {
      fixedReply = stillMissingTalla
        ? `✅ Dirección anotada.\n\n📋 ¿Me confirmas tu talla del buzo? (XS, S, M, L, XL, XXL, XXXL)`
        : `✅ Dirección anotada. Todo listo 🎉\n\nEscribe *CONFIRMO*, "si está bien" o dime que confirmas para que despachemos tu *${pendingPedido.producto}*. 🚚`;
    }

    if (fixedReply) {
      const wamid = await sendTextMessage(from, fixedReply);
      await saveAndSend(supabase, from, fixedReply, 'text', wamid);
      continue;
    }

    // ── Confirmación por lenguaje natural cuando todo está completo ──────────
    // Solo se activa cuando: hay pedido + talla ok + dirección domicilio ok (no oficina) + mensaje corto afirmativo
    const allDataReady = !stillMissingTalla && !stillMissingDir && !isDirOficinaType;
    if (allDataReady && textLower.trim().length < 60 && NATURAL_CONFIRM_PHRASES.some(p => textLower.includes(p))) {
      await supabase.from('clientes_funnelish').update({
        confirmado: true, confirmado_at: new Date().toISOString(), estado: 'confirmado',
      }).eq('id', pendingPedido.id);
      await supabase.from('conversations').update({ label: 'VENTA REALIZADA' }).eq('id', from);
      const finalMsg = '¡Gracias por tu compra, cuando lo envie te estara llegando el número de guía desde nuestro chatbot, cuyo número asociado es 3142576239, para que puedas realizarle seguimiento a tu paquete.';
      const wamid = await sendTextMessage(from, finalMsg);
      await saveAndSend(supabase, from, finalMsg, 'text', wamid);
      continue;
    }

    // ── Claude como fallback (solo MODO CONFIRMACIÓN) ────────────────────────
    const { data: shortHistory } = await supabase
      .from('messages').select('content, role')
      .eq('conversation_id', from).order('created_at', { ascending: false }).limit(6);

    const missingList: string[] = [];
    if (stillMissingTalla) missingList.push('talla del buzo (XS, S, M, L, XL, XXL, XXXL)');
    if (stillMissingDir)   missingList.push('dirección completa de domicilio (ej: Calle 15 # 20-30)');

    const sysPrompt =
      `Eres Josué de Klixmant. Hablas con un cliente que ya tiene un pedido activo.\n` +
      `Pedido: *${pendingPedido.producto}* — Valor: *${pendingPedido.valor}*\n` +
      `${missingList.length > 0
        ? `Aún falta: ${missingList.join(' y ')}. Pide SOLO eso, de forma amable y breve.`
        : `Todos los datos están completos. Pídele que confirme el pedido (puede escribir CONFIRMO, "si está bien", "confirmado" o cualquier frase afirmativa).`
      }\n` +
      `PROHIBIDO: mencionar otros productos, catálogo, precios de otros artículos.\n` +
      `Si el cliente pregunta por el envío o cuándo llega, responde brevemente y vuelve al tema.\n` +
      `Si el cliente quiere cambiar de color, dile que puede decirte el color y lo cambias.\n` +
      `NUNCA escribas URLs ni enlaces.\n`;

    const chatHistory: ChatRequest['messages'] = [...(shortHistory ?? [])]
      .reverse()
      .filter((m: any) => m.content?.trim() && !m.content.startsWith('http'))
      .map((m: any) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content as string,
      }));

    if (!chatHistory.length || chatHistory[chatHistory.length - 1]?.role !== 'user') {
      chatHistory.push({ role: 'user', content: text });
    }

    let botReply: string;
    try {
      const resp = await chat({ messages: chatHistory, tenantId: 'klixmant', systemPrompt: sysPrompt });
      botReply = resp.message;
    } catch { continue; }

    const botWamid = await sendTextMessage(from, botReply);
    if (!botWamid) continue;
    await saveAndSend(supabase, from, botReply, 'text', botWamid);
  }

  return NextResponse.json({ status: 'ok' });
}

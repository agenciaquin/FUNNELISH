import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage, sendAudioByUrl, sendImageByUrl } from '@/lib/whatsapp';
import { PRODUCT_NAMES, FALLBACK_IMAGE, getProductImageUrl } from '@/lib/product-catalog';
import { chat } from '@/lib/quinchat/claude';
import type { ChatRequest } from '@/lib/quinchat/types';
import { isCompleteAddress, isDirOficina, getAddressQuestion } from '@/lib/address';
import { validateAddressLupap, getLupapMessage } from '@/lib/lupap';

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
// Colores en uppercase para filtrar palabras de color de los nombres de producto
const COLOR_NAMES_UPPER = new Set(COLOR_NAMES.map((c: string) => c.toUpperCase()));
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
        const dirQ = getAddressQuestion(pedido.direccion);
        if (dirQ) missing.push('dirección'); // marcador — se reemplaza abajo
        if (!pedido.ciudad || pedido.ciudad === '—')
          missing.push('ciudad');
        if (!pedido.departamento || pedido.departamento === '—')
          missing.push('departamento');

        if (missing.length > 0) {
          // Si la dirección está incompleta y es el único dato faltante, pregunta específica
          if (dirQ && missing.length === 1) {
            const wamid = await sendTextMessage(from, dirQ);
            await saveAndSend(supabase, from, dirQ, 'text', wamid);
          } else {
            const otherMissing = missing.filter(f => f !== 'dirección');
            const reaskParts: string[] = [];
            if (dirQ) reaskParts.push(dirQ);
            if (otherMissing.length > 0) reaskParts.push(`Antes de confirmar también necesito: ${otherMissing.join(', ')}.`);
            const reask = reaskParts.join('\n\n');
            const wamid = await sendTextMessage(from, reask);
            await saveAndSend(supabase, from, reask, 'text', wamid);
          }
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
        .select('id, nombre, producto, talla, valor, direccion, ciudad, departamento, correo, telefono')
        .eq('telefono', tel10).eq('confirmado', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (confirmedPedido) {
        // ── 1. Redirigir a asesor si pide catálogo de otro tipo de producto ──────
        const wantsOtherProduct = [
          'catálogo', 'catalogo', 'futbol', 'fútbol', 'pareja', 'equipos',
          'otro modelo', 'otra referencia', 'ver más productos', 'ver mas productos',
          'más referencias', 'mas referencias',
        ].some(w => textLower.includes(w));

        if (wantsOtherProduct) {
          const handoff = `Para mostrarte otros productos te paso con un asesor 😊 Un momento.`;
          const wamid = await sendTextMessage(from, handoff);
          await saveAndSend(supabase, from, handoff, 'text', wamid);
          await supabase.from('conversations').update({ label: 'VER CATÁLOGO - HUMANO' }).eq('id', from);
          continue;
        }

        // ── 2. Detección de intenciones ───────────────────────────────────────
        const wantsFoto = textLower.includes('foto') || textLower.includes('imagen');
        const mentionedColorConf = detectColorInText(textLower);

        // Leer último mensaje del bot para entender el contexto de la conversación
        const { data: lastBotMsgConf } = await supabase
          .from('messages').select('content')
          .eq('conversation_id', from).eq('role', 'assistant')
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        const lastBotContentConf = lastBotMsgConf?.content?.toLowerCase() ?? '';

        // El bot estaba en modo AGREGAR prenda (promo)
        const lastBotAskedAddColor =
          lastBotContentConf.includes('agregar') ||
          lastBotContentConf.includes('color quieres agregar') ||
          (lastBotContentConf.includes('promo') && lastBotContentConf.includes('color'));

        // El bot estaba en modo CAMBIAR color del pedido
        const lastBotAskedChangeColor =
          !lastBotAskedAddColor && (
            lastBotContentConf.includes('qué color quieres cambiarlo') ||
            lastBotContentConf.includes('cuál prefieres') ||
            (lastBotContentConf.includes('cambiar') && lastBotContentConf.includes('color'))
          );

        // ── Helpers ───────────────────────────────────────────────────────────

        // Colores únicos de la misma familia (sin duplicados por nombre_producto)
        const getColoresFamilia = async (productoRef: string) => {
          const { data: allC } = await supabase
            .from('catalogo_colores').select('color, nombre_producto, url_imagen')
            .not('url_imagen', 'is', null);
          const refWords = productoRef.toUpperCase().split(/\s+/);
          const brandWords = refWords.filter((w: string) => w.length >= 3 && !COLOR_NAMES_UPPER.has(w));
          const searchWords = brandWords.length > 0 ? brandWords : refWords.filter((w: string) => w.length >= 4);
          const all = (allC ?? []).filter((c: any) =>
            searchWords.some((w: string) => (c.nombre_producto as string).toUpperCase().includes(w))
          );
          // Deduplicar por nombre_producto
          return [...new Map(all.map((c: any) => [c.nombre_producto, c])).values()];
        };

        const updateProductoConf = async (newProducto: string, newValor?: string) => {
          if (confirmedPedido.id) {
            const upd: any = { producto: newProducto };
            if (newValor) upd.valor = newValor;
            await supabase.from('clientes_funnelish').update(upd).eq('id', confirmedPedido.id);
          }
        };

        const sendColorConfirm = async (newProducto: string, imgUrl: string | null | undefined) => {
          const url = imgUrl && imgUrl !== FALLBACK_IMAGE ? imgUrl : getProductImageUrl(newProducto);
          if (url && url !== FALLBACK_IMAGE) {
            const imgWamid = await sendImageByUrl(from, url, newProducto);
            await saveAndSend(supabase, from, url, 'image', imgWamid);
          }
          const msg = `✅ ¡Listo! Tu pedido fue actualizado a *${newProducto}*. Queda confirmado y lo despachamos en las próximas 24 horas. 🚚`;
          const wamid = await sendTextMessage(from, msg);
          await saveAndSend(supabase, from, msg, 'text', wamid);
        };

        const PROMO_PRICES_CONF: Record<number, string> = { 1: '$134.900', 2: '$229.900', 3: '$325.000' };

        // ── 3. AGREGAR prenda a la promo ──────────────────────────────────────
        // Frases que claramente significan "quiero otro buzo además del que ya tengo"
        const wantsAddPromoConf = [
          'quiero otro', 'quiero una más', 'quiero una mas', 'agrégame', 'agregame',
          'quiero dos', 'quiero 2', 'me llevo los dos', 'llevar los dos',
          'pack de dos', 'pack x2', 'promo de dos', 'promo x2',
          'quiero también', 'quiero tambien', 'quiero la promo',
          'para llevar los dos', 'no para cambiarlo', 'no quiero cambiarlo',
          'quiero ambos', 'quiero las dos', 'quiero los dos', 'una adicional',
          'uno adicional', 'quiero añadir', 'añadirme',
        ].some(w => textLower.includes(w));

        // También aplica si el bot preguntó por color a AGREGAR y el cliente respondió
        const isAddingFromContext = lastBotAskedAddColor && !!mentionedColorConf;

        if (wantsAddPromoConf || isAddingFromContext) {
          const famColorsAdd = await getColoresFamilia(confirmedPedido.producto);

          if (!mentionedColorConf) {
            // Solo dijo "quiero otro" sin color → preguntar qué color quiere agregar
            const colorList = famColorsAdd.map((c: any) => c.color).filter(Boolean).join(', ');
            const promoMsg =
              `¡Claro! 😊 Puedes aprovechar nuestras promos:\n` +
              `• *2 prendas:* $229.900\n• *3 prendas:* $325.000\n\n` +
              `¿Qué color quieres agregar?\nDisponibles: ${colorList || 'consulta con un asesor'}`;
            const wamid = await sendTextMessage(from, promoMsg);
            await saveAndSend(supabase, from, promoMsg, 'text', wamid);
            continue;
          }

          // Tiene color → buscar en la familia
          const matchAdd = famColorsAdd.find((c: any) =>
            (c.color ?? '').toLowerCase().includes(mentionedColorConf) ||
            mentionedColorConf.includes((c.color ?? '').toLowerCase()) ||
            (c.nombre_producto as string).toUpperCase().includes(mentionedColorConf.toUpperCase())
          );

          if (matchAdd) {
            // Contar cuántas prendas ya tiene (un "+" por cada prenda adicional)
            const currentProd = confirmedPedido.producto;
            const currentCount = currentProd.split('+').length;
            const newCount = Math.min(currentCount + 1, 3);
            const combinedProd = `${currentProd.trim()} + ${matchAdd.nombre_producto}`;
            const promoValor = PROMO_PRICES_CONF[newCount] ?? '$325.000';

            await updateProductoConf(combinedProd, promoValor);

            // Enviar foto de la nueva prenda
            if (matchAdd.url_imagen && matchAdd.url_imagen !== FALLBACK_IMAGE) {
              const imgWamid = await sendImageByUrl(from, matchAdd.url_imagen, matchAdd.nombre_producto);
              await saveAndSend(supabase, from, matchAdd.url_imagen, 'image', imgWamid);
            }

            const confirmMsg =
              `✅ ¡Perfecto! Te agregamos *${matchAdd.nombre_producto}*.\n\n` +
              `Tu pedido queda:\n*${combinedProd}*\n` +
              `Valor total: *${promoValor}* 🎉\n\n` +
              `Lo despachamos en las próximas 24 horas. 🚚`;
            const wamid = await sendTextMessage(from, confirmMsg);
            await saveAndSend(supabase, from, confirmMsg, 'text', wamid);
            continue;
          }

          // Color no encontrado en la familia
          const colorListAdd = famColorsAdd.map((c: any) => c.color).filter(Boolean).join(', ');
          const noMatchMsg =
            `Ese color no está disponible 😔\n` +
            `Para agregar a tu promo puedes elegir: ${colorListAdd}\n\n¿Cuál prefieres?`;
          const wamid = await sendTextMessage(from, noMatchMsg);
          await saveAndSend(supabase, from, noMatchMsg, 'text', wamid);
          continue;
        }

        // ── 4. CAMBIO de color del pedido actual ──────────────────────────────
        const currentProductUpper = confirmedPedido.producto.toUpperCase();
        const colorAlreadyInProduct = mentionedColorConf
          ? currentProductUpper.includes(mentionedColorConf.toUpperCase())
          : false;

        const colorChangeWordsConf = [
          'cambiar el color', 'cambio de color', 'otro color', 'en otro color',
          'cambiarlo', 'me lo cambian', 'cambiar por', 'cambiar a',
          'me lo mandan en', 'lo quiero en', 'lo quiero de', 'quiero cambiarlo',
          'quiero cambiar', 'quiero el negro', 'quiero el azul', 'quiero el rojo', 'quiero el blanco',
        ];

        const colorChangeIntentConf =
          colorChangeWordsConf.some(w => textLower.includes(w))
          || (textLower.includes('cambiar') && !!mentionedColorConf)
          || (textLower.includes('lo quiero') && !!mentionedColorConf)
          // Solo activa "cambio" si el bot estaba en contexto de CAMBIO — NO de agregar
          || (lastBotAskedChangeColor && !!mentionedColorConf)
          // Foto + color diferente al actual = cambio
          || (wantsFoto && !!mentionedColorConf && !colorAlreadyInProduct);

        // ── 5. Foto del producto actual (sin cambio de color) ─────────────────
        if (wantsFoto && !colorChangeIntentConf) {
          const productoActual = confirmedPedido.producto;
          let fotoUrl: string | null = null;
          const { data: exactF } = await supabase
            .from('catalogo_colores').select('url_imagen')
            .ilike('nombre_producto', productoActual).not('url_imagen', 'is', null)
            .limit(1).maybeSingle();
          if (exactF?.url_imagen) {
            fotoUrl = exactF.url_imagen as string;
          } else {
            const famColors = await getColoresFamilia(productoActual);
            if (famColors.length > 0) {
              const colorActual = detectColorInText(productoActual.toLowerCase());
              if (colorActual) {
                const matched = famColors.find((c: any) =>
                  (c.nombre_producto as string).toUpperCase().includes(colorActual.toUpperCase())
                );
                if (matched?.url_imagen) fotoUrl = matched.url_imagen as string;
              }
              if (!fotoUrl && famColors[0]?.url_imagen) fotoUrl = famColors[0].url_imagen as string;
            }
          }
          if (!fotoUrl) fotoUrl = getProductImageUrl(productoActual);

          if (fotoUrl && fotoUrl !== FALLBACK_IMAGE) {
            const imgWamid = await sendImageByUrl(from, fotoUrl, productoActual);
            await saveAndSend(supabase, from, fotoUrl, 'image', imgWamid);
            const fotoMsg = `📸 Aquí está la foto de tu *${productoActual}*. Tu pedido ya está confirmado y se despachará en las próximas 24 horas. 🚚`;
            const wamid = await sendTextMessage(from, fotoMsg);
            await saveAndSend(supabase, from, fotoMsg, 'text', wamid);
          } else {
            const noFotoMsg = `Tu pedido *${productoActual}* ya está confirmado y se despachará en las próximas 24 horas. 🚚 El número de guía te llegará por este chat.`;
            const wamid = await sendTextMessage(from, noFotoMsg);
            await saveAndSend(supabase, from, noFotoMsg, 'text', wamid);
          }
          continue;
        }

        // ── 6. Ejecutar cambio de color ───────────────────────────────────────
        if (colorChangeIntentConf) {
          const catalogResult = await findColorVariantInDB(supabase, confirmedPedido.producto, mentionedColorConf);

          if (catalogResult?.match) {
            await updateProductoConf(catalogResult.match.nombre_producto);
            await sendColorConfirm(catalogResult.match.nombre_producto, catalogResult.match.url_imagen);
            continue;
          }

          if (catalogResult && mentionedColorConf && catalogResult.colores.length) {
            const colorList = [...new Set(catalogResult.colores.map((c: any) => c.color))].join(', ');
            const noColorMsg = `Ese color no está disponible 😔 Para *${catalogResult.familia}* tenemos:\n${colorList}\n\n¿Cuál prefieres?`;
            const wamid = await sendTextMessage(from, noColorMsg);
            await saveAndSend(supabase, from, noColorMsg, 'text', wamid);
            continue;
          }

          if (catalogResult && !mentionedColorConf) {
            const colorList = [...new Set(catalogResult.colores.map((c: any) => c.color))].join(', ');
            const ask = `¡Claro! 😊 Para *${catalogResult.familia}* tenemos:\n${colorList}\n\n¿A cuál quieres cambiar?`;
            const wamid = await sendTextMessage(from, ask);
            await saveAndSend(supabase, from, ask, 'text', wamid);
            continue;
          }

          const famColors = await getColoresFamilia(confirmedPedido.producto);

          if (famColors.length > 0) {
            if (mentionedColorConf) {
              const match = famColors.find((c: any) =>
                (c.color ?? '').toLowerCase().includes(mentionedColorConf) ||
                mentionedColorConf.includes((c.color ?? '').toLowerCase()) ||
                (c.nombre_producto as string).toUpperCase().includes(mentionedColorConf.toUpperCase())
              );
              if (match) {
                await updateProductoConf(match.nombre_producto);
                await sendColorConfirm(match.nombre_producto, match.url_imagen);
                continue;
              }
              const colorList = famColors.map((c: any) => c.color).filter(Boolean).join(', ');
              const noColorMsg = `Ese color no está disponible 😔 Tenemos: ${colorList}\n\n¿Cuál prefieres?`;
              const wamid = await sendTextMessage(from, noColorMsg);
              await saveAndSend(supabase, from, noColorMsg, 'text', wamid);
              continue;
            }
            const colorList = famColors.map((c: any) => c.color).filter(Boolean).join(', ');
            const ask = `¡Claro! 😊 ¿A qué color quieres cambiarlo?\n\nTenemos disponibles: ${colorList}`;
            const wamid = await sendTextMessage(from, ask);
            await saveAndSend(supabase, from, ask, 'text', wamid);
            continue;
          }

          const handoffColor = `Para cambiar el color de tu pedido te paso con un asesor 😊 Un momento.`;
          const wamid = await sendTextMessage(from, handoffColor);
          await saveAndSend(supabase, from, handoffColor, 'text', wamid);
          await supabase.from('conversations').update({ label: 'CAMBIO COLOR - HUMANO' }).eq('id', from);
          continue;
        }

        // ── 5. Claude para Q&A general post-confirmación ──────────────────────
        const { data: histConf } = await supabase
          .from('messages').select('content, role')
          .eq('conversation_id', from).order('created_at', { ascending: false }).limit(14);

        const sysConf =
          `Eres Josué de Klixmant. El cliente ya confirmó su pedido: *${confirmedPedido.producto}* — Valor: *${confirmedPedido.valor}*.\n` +
          `El pedido está confirmado y será despachado en las próximas 24 horas.\n` +
          `Si el cliente pregunta por el abono para Interrapidísimo u oficina: explica que son $5.000 de garantía requeridos por el área de despacho. Si insiste, dile que lo pasarás con un asesor.\n` +
          `Si el cliente pregunta cuándo llega o el número de guía: dile que recibirá el número de guía por este chat una vez despachado.\n` +
          `Si el cliente quiere cambiar de color: pregúntale "¿A qué color quieres cambiarlo?" — NO digas que no puedes hacerlo.\n` +
          `Si el cliente pide la foto de su producto: responde "En un momento te la enviamos 📸" — NUNCA digas que no puedes enviar fotos.\n` +
          `Si el cliente quiere ver catálogo de otros productos completamente diferentes: dile que lo pasarás con un asesor.\n` +
          `Sé amable, breve y tranquilizador.\n`;

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

      // Sin pedido en DB — leer historial y responder con Claude basándose en la conversación
      const { data: histNoPedido } = await supabase
        .from('messages').select('content, role')
        .eq('conversation_id', from).order('created_at', { ascending: false }).limit(14);

      const sysNoPedido =
        `Eres Josué de Klixmant. Atiendes clientes por WhatsApp.\n` +
        `Este cliente no tiene un pedido activo en este momento.\n` +
        `Responde de forma amable y natural, continuando el hilo de la conversación según el historial.\n` +
        `Si el cliente pregunta por su pedido o cuándo llega: dile que en unos minutos recibirá la confirmación, o que puede escribirnos para ayudarle.\n` +
        `Si el cliente pide ver catálogo u otros productos: dile que un asesor puede ayudarle.\n` +
        `Sé breve, cálido y útil. NUNCA escribas URLs ni enlaces.\n`;

      const histNoPedidoMsgs: ChatRequest['messages'] = [...(histNoPedido ?? [])]
        .reverse()
        .filter((m: any) => m.content?.trim() && !m.content.startsWith('http'))
        .map((m: any) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content as string,
        }));
      if (!histNoPedidoMsgs.length || histNoPedidoMsgs[histNoPedidoMsgs.length - 1]?.role !== 'user') {
        histNoPedidoMsgs.push({ role: 'user', content: text });
      }

      try {
        const resp = await chat({ messages: histNoPedidoMsgs, tenantId: 'klixmant', systemPrompt: sysNoPedido });
        const wamid = await sendTextMessage(from, resp.message);
        if (wamid) await saveAndSend(supabase, from, resp.message, 'text', wamid);
      } catch { /* ignorar */ }
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

    // ── Dirección parcial: cliente mandó algo que parece dirección pero incompleta ──
    // Detectar si el texto tiene palabras típicas de dirección colombiana pero isCompleteAddress es false
    const looksLikePartialAddress = !dirAlreadyComplete && !clientGaveDireccion && (
      /\b(calle|carrera|diagonal|transversal|avenida|cl\b|cra\b|cr\b|kr\b|diag\b|av\b|cll\b|conjunto|conj|edificio|manzana|barrio|torre|vereda)\b/i.test(text)
    );
    if (looksLikePartialAddress) {
      // Guardar la dirección parcial en DB para que getAddressQuestion la use
      await supabase.from('clientes_funnelish').update({ direccion: text.trim() }).eq('id', pendingPedido.id);
      currentDireccion = text.trim();
      const partialQ = getAddressQuestion(currentDireccion) ?? '📍 Necesito la dirección completa. Por ejemplo: *Calle 15 # 20-30 Barrio Los Pinos*.';
      const wamid = await sendTextMessage(from, partialQ);
      await saveAndSend(supabase, from, partialQ, 'text', wamid);
      continue;
    }

    // ── Helper: colores de la misma familia en catalogo_colores ─────────────
    const getFamColores = async (productoRef: string) => {
      const { data: allC } = await supabase
        .from('catalogo_colores').select('color, nombre_producto, url_imagen')
        .not('url_imagen', 'is', null);
      const refWords = productoRef.toUpperCase().split(/\s+/);
      const brandWords = refWords.filter((w: string) => w.length >= 3 && !COLOR_NAMES_UPPER.has(w));
      const searchWords = brandWords.length > 0 ? brandWords : refWords.filter((w: string) => w.length >= 4);
      return (allC ?? []).filter((c: any) =>
        searchWords.some((w: string) => (c.nombre_producto as string).toUpperCase().includes(w))
      );
    };

    // ── Multi-prenda (promos) ─────────────────────────────────────────────────
    // 1 prenda: $134.900 | 2 prendas: $229.900 | 3 prendas: $325.000
    const PROMO_PRICES: Record<number, string> = { 1: '$134.900', 2: '$229.900', 3: '$325.000' };
    const allColorsInText = COLOR_NAMES.filter(c => textLower.includes(c));
    const mentionsDos = ['quiero dos', 'comprar dos', '2 prendas', '2 buzos', 'dos prendas',
      'dos buzos', 'los dos', 'las dos', 'quiero 2', 'pack x2', 'combo 2',
      'quiero comprar dos', 'quiero otro', 'quiero otra', 'quiero añadir',
      'añadir uno', 'añadir una', 'agregar uno', 'agregar una',
      'uno más', 'una más', 'uno mas', 'una mas'].some(w => textLower.includes(w));
    const mentionsTres = ['quiero tres', 'comprar tres', '3 prendas', '3 buzos', 'tres prendas',
      'tres buzos', 'quiero 3', 'pack x3', 'combo 3', 'quiero comprar tres'].some(w => textLower.includes(w));
    const isMultiPrenda = allColorsInText.length >= 2 || mentionsDos || mentionsTres;

    if (isMultiPrenda) {
      const famColoresMulti = await getFamColores(pendingPedido.producto);

      if (famColoresMulti.length > 0) {
        // Contar cuántas prendas quiere
        const itemCount = Math.min(
          mentionsTres || allColorsInText.length >= 3 ? 3
            : mentionsDos || allColorsInText.length >= 2 ? 2 : 1,
          3
        );

        // Buscar match en catálogo para cada color mencionado
        const matchedItems: Array<{ nombre_producto: string; url_imagen: string | null }> = [];
        for (const color of allColorsInText) {
          const match = famColoresMulti.find((c: any) =>
            (c.color ?? '').toLowerCase().includes(color) ||
            color.includes((c.color ?? '').toLowerCase()) ||
            (c.nombre_producto as string).toUpperCase().includes(color.toUpperCase())
          );
          if (match && !matchedItems.some(i => i.nombre_producto === match.nombre_producto)) {
            matchedItems.push({ nombre_producto: match.nombre_producto, url_imagen: match.url_imagen });
          }
        }

        // Si encontramos 2+ items del mismo catálogo → es multi-prenda
        if (matchedItems.length >= 2 || (mentionsDos && matchedItems.length >= 1)) {
          // Incluir producto actual si no está
          const currentIn = matchedItems.some(
            i => i.nombre_producto.toUpperCase() === (pendingPedido.producto ?? '').toUpperCase()
          );
          if (!currentIn && matchedItems.length < itemCount) {
            matchedItems.unshift({ nombre_producto: pendingPedido.producto, url_imagen: null });
          }

          const finalItems = matchedItems.slice(0, Math.max(itemCount, matchedItems.length > 3 ? 3 : matchedItems.length));
          const realCount = Math.min(finalItems.length, 3);
          const combinedProduct = finalItems.map(i => i.nombre_producto).join(' + ');
          const promoValue = PROMO_PRICES[realCount] ?? PROMO_PRICES[3];

          // Actualizar pedido en DB con combo + precio promo
          await supabase.from('clientes_funnelish')
            .update({ producto: combinedProduct, valor: promoValue })
            .eq('id', pendingPedido.id);

          // Enviar foto de cada prenda
          for (const item of finalItems) {
            const imgUrl = item.url_imagen || getProductImageUrl(item.nombre_producto);
            if (imgUrl && imgUrl !== FALLBACK_IMAGE) {
              const imgWamid = await sendImageByUrl(from, imgUrl, item.nombre_producto);
              await saveAndSend(supabase, from, imgUrl, 'image', imgWamid);
            }
          }

          // Mensaje de promo
          const itemLines = finalItems.map((item, i) => `${i + 1}. *${item.nombre_producto}*`).join('\n');
          const promoMsg = realCount > 1
            ? `🎉 ¡Promo activada! Tu pedido de ${realCount} prendas:\n${itemLines}\n\n💰 Valor total: *${promoValue}*\n\nRevisa las fotos y escribe *CONFIRMO* para que lo despachemos en 24h. 🚚`
            : `✅ Listo. Tu pedido:\n*${combinedProduct}* — *${promoValue}*\n\nEscribe *CONFIRMO* para confirmar. 🚚`;
          const wamid = await sendTextMessage(from, promoMsg);
          await saveAndSend(supabase, from, promoMsg, 'text', wamid);
          continue;
        }

        // "quiero otro" sin color → preguntar qué color + mostrar promo
        if ((mentionsDos || mentionsTres) && allColorsInText.length === 0) {
          const colorListPend = famColoresMulti.map((c: any) => c.color).filter(Boolean).join(', ');
          const promoCount = mentionsTres ? 3 : 2;
          const promoValorRef = PROMO_PRICES[promoCount];
          const askColorMsg =
            `¡Perfecto! 😊 Para la promo de ${promoCount} prendas: *${promoValorRef}*\n\n` +
            `¿Qué color quieres agregar y en qué talla?\n` +
            `Disponibles: ${colorListPend || 'consulta con un asesor'}`;
          const wamid = await sendTextMessage(from, askColorMsg);
          await saveAndSend(supabase, from, askColorMsg, 'text', wamid);
          continue;
        }
        // Colores no coinciden con la familia → seguir flujo normal
      }
      // famColores vacío → puede ser otra marca → seguir flujo normal (Claude fallback)
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
    const lastBotAskedAddColorPending =
      lastBotMsg?.content?.toLowerCase().includes('quieres agregar') ||
      lastBotMsg?.content?.toLowerCase().includes('color quieres agregar');

    if (lastBotAskedAddColorPending && mentionedColor) {
      const famColPend = await getFamColores(pendingPedido.producto);
      const matchPend = famColPend.find((c: any) =>
        (c.color ?? '').toLowerCase().includes(mentionedColor) ||
        (c.nombre_producto as string).toUpperCase().includes(mentionedColor.toUpperCase())
      );
      if (matchPend) {
        const currentCount = (pendingPedido.producto ?? '').split('+').length;
        const newCount = Math.min(currentCount + 1, 3);
        const combinedProd = `${pendingPedido.producto.trim()} + ${matchPend.nombre_producto}`;
        const promoValor = PROMO_PRICES[newCount] ?? '$325.000';
        await supabase.from('clientes_funnelish').update({ producto: combinedProd, valor: promoValor }).eq('id', pendingPedido.id);
        if (matchPend.url_imagen && matchPend.url_imagen !== FALLBACK_IMAGE) {
          const imgWamid = await sendImageByUrl(from, matchPend.url_imagen, matchPend.nombre_producto);
          await saveAndSend(supabase, from, matchPend.url_imagen, 'image', imgWamid);
        }
        const confirmMsg =
          `✅ ¡Promo activada! Tu pedido:\n*${combinedProd}*\n\n` +
          `💰 Valor: *${promoValor}*\n\nEscribe *CONFIRMO* para que lo despachemos en 24h. 🚚`;
        const wamid = await sendTextMessage(from, confirmMsg);
        await saveAndSend(supabase, from, confirmMsg, 'text', wamid);
        continue;
      }
    }

    if (colorChangeIntent || (lastBotAskedColor && mentionedColor)) {
      // Buscar el catálogo del producto en la DB
      const catalogResult = await findColorVariantInDB(supabase, pendingPedido.producto, mentionedColor);

      if (!catalogResult) {
        // Sin catalogos_bot — buscar directamente en catalogo_colores por palabras del producto
        const famColors = await getFamColores(pendingPedido.producto);

        if (famColors.length > 0) {
          if (mentionedColor) {
            const match = famColors.find((c: any) =>
              (c.color ?? '').toLowerCase().includes(mentionedColor) ||
              mentionedColor.includes((c.color ?? '').toLowerCase()) ||
              (c.nombre_producto as string).toUpperCase().includes(mentionedColor.toUpperCase())
            );
            if (match) {
              const newProduct = match.nombre_producto;
              await supabase.from('clientes_funnelish').update({ producto: newProduct }).eq('id', pendingPedido.id);
              const imgUrl = match.url_imagen || getProductImageUrl(newProduct);
              if (imgUrl && imgUrl !== FALLBACK_IMAGE) {
                const imgWamid = await sendImageByUrl(from, imgUrl, newProduct);
                await saveAndSend(supabase, from, imgUrl, 'image', imgWamid);
              }
              const confirmMsg = `✅ Listo, cambié tu pedido a *${newProduct}*.\n\nRevisa la foto y escribe *CONFIRMO* o "si está bien" para que despachemos en 24 horas. 🚚`;
              const wamid = await sendTextMessage(from, confirmMsg);
              await saveAndSend(supabase, from, confirmMsg, 'text', wamid);
              continue;
            }
            // Color mencionado no existe → mostrar disponibles
            const colorList = famColors.map((c: any) => c.color).join(', ');
            const noColorMsg = `Lo sentimos 😔 Ese color no está disponible.\n\nColores disponibles: ${colorList}\n\n¿Cuál prefieres?`;
            const wamid = await sendTextMessage(from, noColorMsg);
            await saveAndSend(supabase, from, noColorMsg, 'text', wamid);
            continue;
          }
          // No mencionó color → listar disponibles
          const colorList = famColors.map((c: any) => c.color).join(', ');
          const ask = `¡Claro! 😊 ¿A qué color quieres cambiarlo?\n\nTenemos disponibles: ${colorList}`;
          const wamid = await sendTextMessage(from, ask);
          await saveAndSend(supabase, from, ask, 'text', wamid);
          continue;
        }

        // No hay colores en DB para esta familia (puede ser otra marca) → asesor
        const msg = `Para cambiar el modelo, te paso con un asesor 😊 Un momento.`;
        const wamid = await sendTextMessage(from, msg);
        await saveAndSend(supabase, from, msg, 'text', wamid);
        await supabase.from('conversations').update({ label: 'CAMBIO PRODUCTO - HUMANO' }).eq('id', from);
        continue;
      }

      if (catalogResult.match) {
        // Color encontrado en catalogos_bot → actualizar pedido + enviar foto
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
        // Mencionó un color que no está → mostrar disponibles
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
        const addrQTalla = getAddressQuestion(currentDireccion) ?? '📍 Para completar el pedido necesito tu dirección de domicilio completa (ej: Calle 15 # 20-30, Barrio). ¿Cuál es?';
        fixedReply = `✅ Talla *${currentTalla}* confirmada.\n\n${addrQTalla}`;
      } else {
        fixedReply = `✅ Talla *${currentTalla}* confirmada. Todo listo 🎉\n\nEscribe *CONFIRMO*, "si está bien" o dime que confirmas para que despachemos tu *${pendingPedido.producto}*. 🚚`;
      }
    } else if (clientGaveDireccion) {
      // Validar dirección con Lupap (geocodificación real)
      const lupapCity = pendingPedido.ciudad ?? '';
      const lupapVal  = await validateAddressLupap(currentDireccion, lupapCity);
      const lupapMsg  = getLupapMessage(lupapVal, currentDireccion);

      if (lupapMsg) {
        // Lupap encontró un problema → enviar el mensaje específico (no confirmar la dirección)
        fixedReply = lupapMsg;
      } else {
        // Dirección verificada → confirmar normalmente
        fixedReply = stillMissingTalla
          ? `✅ Dirección anotada.\n\n📋 ¿Me confirmas tu talla del buzo? (XS, S, M, L, XL, XXL, XXXL)`
          : `✅ Dirección anotada. Todo listo 🎉\n\nEscribe *CONFIRMO*, "si está bien" o dime que confirmas para que despachemos tu *${pendingPedido.producto}*. 🚚`;
      }
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
      .eq('conversation_id', from).order('created_at', { ascending: false }).limit(14);

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
      `Si el cliente quiere agregar más prendas del MISMO catálogo: infórmale las promos: 2 prendas $229.900 — 3 prendas $325.000. Pídele que diga los colores que quiere.\n` +
      `Si el cliente quiere productos de OTRO catálogo diferente al que está confirmando: dile que lo pasarás con el asesor encargado de ese catálogo.\n` +
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

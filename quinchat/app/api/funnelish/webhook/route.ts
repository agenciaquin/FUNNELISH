import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage, sendConfirmacionTemplate, sendAudioByUrl, sendImageByUrl } from '@/lib/whatsapp';
import { getProductImageUrl, FALLBACK_IMAGE } from '@/lib/product-catalog';
import { createServerSupabaseClient } from '@/lib/supabase';
import { isCompleteAddress, getAddressQuestion } from '@/lib/address';
import { validateAddressLupap, getLupapMessage } from '@/lib/lupap';
import Jimp from 'jimp';

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  // Strip leading 57 country code, keep 10 digits
  if (digits.startsWith('57') && digits.length >= 12) return digits.slice(2, 12);
  return digits.slice(-10);
}

function buildMensaje(data: {
  nombre: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  correo: string;
  talla: string;
  producto: string;
  valor: string;
}): string {
  return [
    'Hola 😊 te saluda Lilibeth. Tu pedido ya está listo para despacho 🚚✨ Por favor confirma que estos datos estén correctos:',
    `Nombre: ${data.nombre}`,
    `Teléfono: ${data.telefono}`,
    `Dirección: ${data.direccion}`,
    `Ciudad: ${data.ciudad}`,
    `Departamento: ${data.departamento}`,
    `Correo: ${data.correo}`,
    `Talla: ${data.talla}`,
    `Nombre del Producto: ${data.producto}`,
    `Valor a pagar: ${data.valor}`,
    '✅ Si todo está correcto responde: CONFIRMO',
    '✏️ Si deseas corregir algún dato, escríbelo en este chat.',
    '🚚 Una vez confirmado, tu pedido será despachado en las próximas 24 horas.',
  ].join('\n');
}

/** Texto que replica el cuerpo del template de Meta (para mostrar en QuinChat) */
function buildMensajeTemplate(data: {
  saludo: string;
  nombre: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  correo: string;
  talla: string;
  producto: string;
  valor: string;
}): string {
  return [
    `Hola ${data.saludo} 😊 te saludo de klixmant Tu pedido ya está listo para despacho 🚚`,
    `Nombre: ${data.nombre}`,
    `Teléfono: ${data.telefono}`,
    `Dirección: ${data.direccion}`,
    `Ciudad: ${data.ciudad}`,
    `Departamento: ${data.departamento}`,
    `Correo: ${data.correo}`,
    `Talla: ${data.talla}`,
    `Producto: ${data.producto}`,
    `Valor a pagar: ${data.valor}`,
    '✅ Si todo está correcto responde: CONFIRMO',
    '✏️ Si deseas corregir algún dato, escríbelo en este chat.',
    '🚚 Una vez confirmado, tu pedido será despachado en las próximas 24 horas.',
  ].join('\n');
}

// ── Whitelist de prueba (solo estos números reciben WA mientras el bot está en desarrollo) ──
const TEST_WHITELIST = new Set([
  '3143534918',
  '3167648391',
  '3016728642',
  '3052923975',
]);

// ── Packs (PACK X2) ─────────────────────────────────────────────────────────────
// Funnelish envía las variantes concatenadas en variant_name, ej: "ROJO / NEGRO / HOMBRE - M".
// Separamos colores de talla y armamos el producto combinado "ROJO TOYOTA + NEGRO TOYOTA".
const COLORES_CONOCIDOS = [
  'AZUL OSCURO', 'AZUL REY', 'AZUL NAVY', 'AZUL', 'ROJO', 'NEGRO',
  'BLANCO MARFIL', 'MARFIL', 'BLANCO', 'AMARILLO', 'BEIGE', 'VERDE OSCURO', 'VERDE', 'GRIS', 'COCOA',
];

function parsePack(productoNombre: string, variantName: string): {
  esPack: boolean; familia: string; colores: string[]; productos: string[]; productoFinal: string; tallaFinal: string;
} {
  const packMatch = productoNombre.toUpperCase().match(/PACK\s*X?\s*(\d)/);
  const cantidad  = packMatch ? parseInt(packMatch[1], 10) : 0;
  // Por ahora solo PACK X2 (2 colores + 1 talla). X3 se agrega luego.
  if (cantidad !== 2) {
    return { esPack: false, familia: '', colores: [], productos: [], productoFinal: productoNombre, tallaFinal: '' };
  }
  const familia = productoNombre.replace(/PACK\s*X?\s*\d/i, '').trim().toUpperCase(); // "TOYOTA"
  const partes  = variantName.split('/').map(p => p.trim()).filter(Boolean);
  const colores: string[] = [];
  let talla = '';
  for (const p of partes) {
    const pUp    = p.toUpperCase();
    const limpio = pUp.replace(/[^A-Z0-9]/g, '');
    // Talla = contiene HOMBRE/DAMA, o es un token de talla puro. (NO usar "-" como señal.)
    const esTalla = /\b(HOMBRE|DAMA)\b/.test(pUp) || /^(XS|S|M|L|XL|XXL|XXXL)$/.test(limpio);
    if (esTalla) {
      if (!talla) talla = p;
    } else {
      // Color: usar el nombre reconocido (limpia basura tipo "BEIGE -")
      const color = COLORES_CONOCIDOS.find(c => pUp.includes(c));
      colores.push(color ?? pUp.replace(/[^A-Z0-9 ]/g, '').trim());
    }
  }
  const productos = colores.map(c => `${c} ${familia}`.trim());
  return {
    esPack:       productos.length >= 2,
    familia,
    colores,
    productos,
    productoFinal: productos.length ? productos.join(' + ') : productoNombre,
    tallaFinal:    talla || 'Por confirmar',
  };
}

// Busca la imagen de un COLOR dentro de una familia (estricto por color, evita repetir otro color).
async function buscarImagenColor(supabase: any, color: string, familia: string): Promise<string | null> {
  const { data } = await supabase
    .from('catalogo_colores').select('color, nombre_producto, url_imagen')
    .not('url_imagen', 'is', null);
  if (!data || !data.length) return null;
  const colU     = color.toUpperCase();
  const famWords = familia.toUpperCase().split(/\s+/).filter((w: string) => w.length >= 3);
  // Candidatos: SOLO los del color pedido (por columna color o por nombre)
  const cands = data.filter((r: any) => {
    const cU = (r.color ?? '').toUpperCase();
    const nU = (r.nombre_producto ?? '').toUpperCase();
    return cU === colU || cU.includes(colU) || nU.includes(colU);
  });
  if (!cands.length) return null;
  // Entre los del mismo color, el que más comparte con la familia
  let best: { url: string; score: number } | null = null;
  for (const r of cands) {
    const nU    = (r.nombre_producto ?? '').toUpperCase();
    const score = famWords.filter((w: string) => nU.includes(w)).length;
    if (!best || score > best.score) best = { url: r.url_imagen as string, score };
  }
  return best?.url ?? null;
}

// Busca la URL de imagen de un producto: exacta → por palabras → catálogo estático.
async function buscarImagenProducto(supabase: any, nombre: string): Promise<string> {
  if (nombre) {
    const { data: exactMatch } = await supabase
      .from('catalogo_colores').select('url_imagen')
      .ilike('nombre_producto', nombre).not('url_imagen', 'is', null)
      .limit(1).maybeSingle();
    if (exactMatch?.url_imagen) return exactMatch.url_imagen as string;

    const { data: allColors } = await supabase
      .from('catalogo_colores').select('nombre_producto, url_imagen')
      .not('url_imagen', 'is', null);
    if (allColors && allColors.length > 0) {
      const words = nombre.toUpperCase().split(/\s+/).filter((w: string) => w.length >= 3);
      let best: { url: string; score: number } | null = null;
      for (const row of allColors) {
        if (!row.nombre_producto || !row.url_imagen) continue;
        const name  = (row.nombre_producto as string).toUpperCase();
        const score = words.filter((w: string) => name.includes(w)).length;
        if (score > 0 && (!best || score > best.score)) best = { url: row.url_imagen as string, score };
      }
      if (best) return best.url;
    }
  }
  return getProductImageUrl(nombre);
}

// Une las fotos de un pack en una sola imagen (lado a lado) y la sube a Supabase Storage.
// Cachea por combinación: si ya existe el collage de ese combo, lo reutiliza.
// Devuelve la URL pública, o null si algo falla (para caer al envío por separado).
async function generarCollagePack(supabase: any, productos: string[], imagenes: string[]): Promise<string | null> {
  try {
    const bucket   = 'chat-media';
    const sanit    = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const fileName = `${productos.map(sanit).sort().join('__')}__v2.jpg`;
    const path     = `packs/${fileName}`;
    const supaUrl  = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    const publicUrl = `${supaUrl}/storage/v1/object/public/${bucket}/${path}`;

    // Caché: ¿ya existe el collage de este combo?
    const { data: existentes } = await supabase.storage.from(bucket).list('packs', { search: fileName });
    if (existentes && existentes.some((f: any) => f.name === fileName)) return publicUrl;

    // Componer las imágenes lado a lado, todas a la misma altura
    const H    = 900;
    const imgs = await Promise.all(imagenes.map((u: string) => Jimp.read(u)));
    imgs.forEach((im: any) => im.resize(Jimp.AUTO, H));
    const totalW = imgs.reduce((s: number, im: any) => s + im.getWidth(), 0);

    const canvas = new Jimp(totalW, H, 0xffffffff);
    let left = 0;
    imgs.forEach((im: any) => { canvas.composite(im, left, 0); left += im.getWidth(); });

    const buffer = await canvas.getBufferAsync(Jimp.MIME_JPEG);

    const { error: upErr } = await supabase.storage.from(bucket)
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
    if (upErr) { console.error('[Collage] upload error:', upErr.message); return null; }

    console.log(`[Collage] generado ${path}`);
    return publicUrl;
  } catch (e) {
    console.error('[Collage] error:', e);
    return null;
  }
}

// ── POST — Receive Funnelish purchase webhook ──────────────────────────────────
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only handle purchase events
  if (body.event && body.event !== 'purchase') {
    return NextResponse.json({ status: 'ignored' });
  }

  // ── Parse fields ─────────────────────────────────────────────────────────────
  const firstName  = String(body.first_name  ?? '').trim();
  const lastName   = String(body.last_name   ?? '').trim();
  const nombre     = [firstName, lastName].filter(Boolean).join(' ') || '—';

  const tel10      = normalizePhone(body.phone);
  const waPhone    = `57${tel10}`;

  const direccion    = String(body.address          ?? body.shipping_address ?? '—').trim();
  const ciudad       = String(body.city             ?? body.shipping_city    ?? '—').trim();
  const departamento = String(body.state            ?? body.shipping_state   ?? '—').trim();
  const correo       = String(body.optin_email      ?? 'Gerenciaquin7@gmail.com').trim() || 'Gerenciaquin7@gmail.com';

  const product        = Array.isArray(body.products) ? body.products[0] : null;
  let   productoNombre = product?.name     ? String(product.name).trim()         : '—';
  const variantName    = product?.variant_name ? String(product.variant_name).trim() : '';
  let   talla = (variantName && !variantName.toUpperCase().includes('SELECCIONA'))
    ? variantName
    : 'Por confirmar';
  const montoRaw = product?.amount ?? 0;
  const valor    = montoRaw ? `$${Number(montoRaw).toLocaleString('es-CO')}` : '$130.000';

  const referencia = String(body.id ?? '');

  if (!tel10) {
    console.warn('[Funnelish webhook] Missing phone, skipping');
    return NextResponse.json({ status: 'skipped', reason: 'no phone' });
  }

  // ── PACK X2: separar colores y talla; armar producto combinado ────────────────
  const pack = parsePack(productoNombre, variantName);
  const packProductos = pack.esPack ? pack.productos : [];
  if (pack.esPack) {
    productoNombre = pack.productoFinal;   // ej: "ROJO TOYOTA + NEGRO TOYOTA"
    talla          = pack.tallaFinal;      // ej: "HOMBRE - M"
  }
  const nombreImagenPrincipal = packProductos[0] ?? productoNombre;

  const mensaje = buildMensaje({ nombre, telefono: tel10, direccion, ciudad, departamento, correo, talla, producto: productoNombre, valor });

  const supabase = createServerSupabaseClient();

  // Buscar imagen(es). Para packs, una foto POR COLOR (estricto) para no repetir color.
  let imageUrl: string;
  let segundaImagenUrl: string | null;
  if (pack.esPack) {
    imageUrl = (await buscarImagenColor(supabase, pack.colores[0], pack.familia))
             ?? await buscarImagenProducto(supabase, packProductos[0]);
    segundaImagenUrl = pack.colores[1]
      ? ((await buscarImagenColor(supabase, pack.colores[1], pack.familia))
         ?? await buscarImagenProducto(supabase, packProductos[1]))
      : null;
    // Si ambas fotos resultaron iguales (un color sin foto), no repetir
    if (segundaImagenUrl && segundaImagenUrl === imageUrl) segundaImagenUrl = null;
  } else {
    imageUrl = await buscarImagenProducto(supabase, nombreImagenPrincipal);
    segundaImagenUrl = null;
  }

  // Pack con 2 fotos reales y DISTINTAS → unirlas en un collage y enviar UNA sola imagen.
  if (pack.esPack
      && imageUrl && imageUrl.startsWith('http') && imageUrl !== FALLBACK_IMAGE
      && segundaImagenUrl && segundaImagenUrl.startsWith('http') && segundaImagenUrl !== FALLBACK_IMAGE
      && imageUrl !== segundaImagenUrl) {
    const collage = await generarCollagePack(supabase, pack.productos, [imageUrl, segundaImagenUrl]);
    if (collage) { imageUrl = collage; segundaImagenUrl = null; } // collage OK → no enviar 2da por separado
  }

  const now = new Date().toISOString();

  // ── Guardar pedido en clientes_funnelish ──────────────────────────────────────
  // Usamos insert-or-update manual en lugar de upsert(onConflict:'referencia')
  // porque si 'referencia' no tiene UNIQUE constraint en Supabase, el upsert falla silenciosamente.
  const pedidoData = {
    telefono:    tel10,
    nombre,
    producto:    productoNombre,
    talla,
    valor,
    ciudad,
    departamento,
    direccion,
    correo,
    referencia,
    estado:      'pendiente',
    wa_enviado:  false,
    confirmado:  false,
    updated_at:  now,
  };

  // Intentar buscar por referencia primero (para actualizar si ya existe)
  let pedidoGuardado = false;
  if (referencia) {
    const { data: existing, error: findErr } = await supabase
      .from('clientes_funnelish').select('id').eq('referencia', referencia).maybeSingle();
    if (findErr) console.error('[Funnelish] buscar referencia error:', findErr.message);

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from('clientes_funnelish').update(pedidoData).eq('id', existing.id);
      if (updErr) console.error('[Funnelish] update existente error:', updErr.message);
      else pedidoGuardado = true;
    }
  }

  // Si no encontramos por referencia, insertar nuevo
  if (!pedidoGuardado) {
    const { error: insErr } = await supabase
      .from('clientes_funnelish').insert({ ...pedidoData, created_at: now });
    if (insErr) console.error('[Funnelish] insert nuevo error:', insErr.message);
    else pedidoGuardado = true;
  }

  console.log(`[Funnelish] pedido guardado=${pedidoGuardado} tel=${tel10} ref=${referencia || 'sin-ref'}`);

  // ── Send WhatsApp (solo whitelist mientras el bot está en desarrollo) ──────────
  const enWhitelist = TEST_WHITELIST.has(tel10);
  let sent = false;
  let templateSent = false;
  let templateWamid: string | null = null;

  // El template de Meta requiere imagen real en el header.
  // Si el producto no está en el catálogo, imageUrl es FALLBACK_IMAGE (placeholder.png)
  // que puede no existir → Meta acepta el envío (devuelve wamid) pero NO entrega el mensaje.
  // Solución: solo usar template si hay imagen real del producto.
  const hasRealImage = imageUrl && imageUrl.startsWith('http') && imageUrl !== FALLBACK_IMAGE;

  if (enWhitelist) {
    if (hasRealImage) {
      // Intentar template primero (funciona incluso sin ventana 24h)
      templateWamid = await sendConfirmacionTemplate(waPhone, {
        saludo:   firstName || nombre,
        nombre, telefono: tel10, direccion, ciudad, departamento,
        correo, talla, producto: productoNombre, valor, imageUrl,
      });
      templateSent = !!templateWamid;
      sent = templateSent;
    } else {
      console.warn(`[Funnelish] Producto "${productoNombre}" sin imagen en catálogo → usando texto plano`);
    }

    // Si el template falla o no hay imagen real → caer al texto plano
    if (!sent) {
      sent = !!(await sendTextMessage(waPhone, mensaje));
    }
  } else {
    console.log(`[Funnelish] Order ${referencia} → ${waPhone} | MODO PRUEBA: número no en whitelist`);
  }

  if (sent) {
    // Texto a guardar en QuinChat
    const mensajeAlmacenado = templateSent
      ? buildMensajeTemplate({
          saludo: firstName || nombre,
          nombre, telefono: tel10, direccion, ciudad, departamento,
          correo, talla, producto: productoNombre, valor,
        })
      : mensaje;

    // ── 1. Mark wa_enviado ──────────────────────────────────────────────────
    const { error: waErr } = await supabase
      .from('clientes_funnelish')
      .update({ wa_enviado: true, wa_enviado_at: now, estado: 'wa_enviado' })
      .eq('telefono', tel10)
      .eq('confirmado', false);
    if (waErr) console.error('[Funnelish] update wa_enviado error:', waErr.message);

    // ── 2. Upsert conversation ──────────────────────────────────────────────
    const { error: convErr } = await supabase.from('conversations').upsert({
      id:                waPhone,
      contact_name:      nombre,
      last_message:      mensajeAlmacenado.slice(0, 100),
      last_message_time: now,
      unread_count:      1,
      bot_enabled:       true,
      label:             'PENDIENTE POR CONFIRMACIÓN',
    }, { onConflict: 'id' });
    if (convErr) console.error('[Funnelish] upsert conversation error:', convErr.message);

    // ── 3. Guardar foto del producto ────────────────────────────────────────
    if (imageUrl && imageUrl.startsWith('http')) {
      const { error: imgErr } = await supabase.from('messages').insert({
        id:              `funnelish-img-${referencia || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conversation_id: waPhone,
        content:         imageUrl,
        role:            'assistant',
        type:            'image',
        whatsapp_id:     null,
        created_at:      now,
      });
      if (imgErr) console.error('[Funnelish] insert image error:', imgErr.message);
    }

    // ── 3b. Segunda foto (packs X2) ─────────────────────────────────────────
    if (enWhitelist && segundaImagenUrl && segundaImagenUrl.startsWith('http') && segundaImagenUrl !== FALLBACK_IMAGE) {
      const img2Wamid = await sendImageByUrl(waPhone, segundaImagenUrl, productoNombre);
      const { error: img2Err } = await supabase.from('messages').insert({
        id:              `funnelish-img2-${referencia || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conversation_id: waPhone,
        content:         segundaImagenUrl,
        role:            'assistant',
        type:            'image',
        whatsapp_id:     img2Wamid,
        created_at:      now,
      });
      if (img2Err) console.error('[Funnelish] insert segunda imagen error:', img2Err.message);
    }

    // ── 4. Guardar mensaje de confirmación ─────────────────────────────────
    const msgId = `funnelish-${referencia || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { error: msgErr } = await supabase.from('messages').insert({
      id:              msgId,
      conversation_id: waPhone,
      content:         mensajeAlmacenado,
      role:            'assistant',
      type:            'text',
      whatsapp_id:     templateWamid,
      created_at:      now,
    });
    if (msgErr) console.error('[Funnelish] insert template msg error:', msgErr.message);

    console.log(`[Funnelish] Saved to DB → conv=${waPhone} img=${!!imageUrl} msg=${!msgErr}`);

    // ── 5. Auto-send audio si la dirección es oficina/reclamo ──────────────
    const AUDIO_OFICINA_URL = 'https://bjbjqmbuzpyjvcugbusx.supabase.co/storage/v1/object/public/chat-media/audios-bot/abono-oficina.ogg';
    const dirLower = direccion.toLowerCase();
    const isOficinaDir = dirLower.includes('oficina')
      || dirLower.includes('reclamo')
      || dirLower.includes('interrapidisimo')
      || dirLower.includes('interrapidísimo');

    if (isOficinaDir) {
      const audioWamid = await sendAudioByUrl(waPhone, AUDIO_OFICINA_URL);
      if (audioWamid) {
        const { error: audioErr } = await supabase.from('messages').insert({
          id:              `funnelish-audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conversation_id: waPhone,
          content:         AUDIO_OFICINA_URL,
          role:            'assistant',
          type:            'audio',
          whatsapp_id:     audioWamid,
          created_at:      new Date().toISOString(),
        });
        if (audioErr) console.error('[Funnelish] insert audio error:', audioErr.message);
      }
    }

    // ── 6. Preguntar datos faltantes ────────────────────────────────────────
    // Dirección: primero verificar si es incompleta (tiene algo pero no es válida)
    const dirIncompleta = (direccion && direccion !== '—') && !isCompleteAddress(direccion);
    const dirFaltante   = !direccion || direccion === '—';

    const missingMsgs: string[] = [];

    // Dirección incompleta → pregunta específica según lo que falta
    if (dirFaltante) {
      missingMsgs.push('📍 Para completar tu pedido necesito tu *dirección de envío completa*. Por ejemplo: *Calle 15 # 20-30 Barrio Los Pinos* o *Conjunto Arboleda, Casa 5*.');
    } else if (dirIncompleta) {
      const addrQ = getAddressQuestion(direccion);
      if (addrQ) missingMsgs.push(addrQ);
    } else if (direccion && direccion !== '—') {
      // Dirección pasa validación local → verificar con Lupap (geocodificación real)
      const lupapResult = await validateAddressLupap(direccion, ciudad ?? '');
      const lupapMsg = getLupapMessage(lupapResult, direccion);
      if (lupapMsg) missingMsgs.push(lupapMsg);
    }

    if (!ciudad    || ciudad    === '—') missingMsgs.push('📋 ¿Me confirmas tu *ciudad de envío*?');
    if (!departamento || departamento === '—') missingMsgs.push('📋 ¿Me confirmas tu *departamento*?');
    if (talla === 'Por confirmar') missingMsgs.push('📋 ¿Cuál es tu *talla* del buzo? (XS, S, M, L, XL, XXL, XXXL)');

    for (const missingMsg of missingMsgs) {
      const missingWamid = await sendTextMessage(waPhone, missingMsg);
      if (missingWamid) {
        const { error: missErr } = await supabase.from('messages').insert({
          id:              `funnelish-ask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conversation_id: waPhone,
          content:         missingMsg,
          role:            'assistant',
          type:            'text',
          whatsapp_id:     missingWamid,
          created_at:      new Date().toISOString(),
        });
        if (missErr) console.error('[Funnelish] insert missing msg error:', missErr.message);
      }
    }
  }

  console.log(`[Funnelish] Order ${referencia} → ${waPhone} | sent=${sent} | img=${imageUrl}`);
  return NextResponse.json({ success: true, phone: waPhone, sent });
}

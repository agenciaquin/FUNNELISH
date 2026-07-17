import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage, sendConfirmacionTemplate, sendAudioByUrl } from '@/lib/whatsapp';
import { getProductImageUrl } from '@/lib/product-catalog';
import { createServerSupabaseClient } from '@/lib/supabase';

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
  const productoNombre = product?.name     ? String(product.name).trim()         : '—';
  const variantName    = product?.variant_name ? String(product.variant_name).trim() : '';
  const talla = (variantName && !variantName.toUpperCase().includes('SELECCIONA'))
    ? variantName
    : 'Por confirmar';
  const montoRaw = product?.amount ?? 0;
  const valor    = montoRaw ? `$${Number(montoRaw).toLocaleString('es-CO')}` : '$130.000';

  const referencia = String(body.id ?? '');

  if (!tel10) {
    console.warn('[Funnelish webhook] Missing phone, skipping');
    return NextResponse.json({ status: 'skipped', reason: 'no phone' });
  }

  const mensaje = buildMensaje({ nombre, telefono: tel10, direccion, ciudad, departamento, correo, talla, producto: productoNombre, valor });
  const imageUrl = getProductImageUrl(productoNombre);

  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();

  // ── Upsert in clientes_funnelish ──────────────────────────────────────────────
  await supabase
    .from('clientes_funnelish')
    .upsert({
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
      created_at:  now,
      updated_at:  now,
    }, { onConflict: 'referencia' })
    .select('id')
    .maybeSingle();

  // ── Send WhatsApp (solo whitelist mientras el bot está en desarrollo) ──────────
  const enWhitelist = TEST_WHITELIST.has(tel10);
  let sent = false;
  let templateSent = false;
  let templateWamid: string | null = null;

  if (enWhitelist) {
    // Intentar template primero (funciona incluso sin ventana 24h)
    templateWamid = await sendConfirmacionTemplate(waPhone, {
      saludo:   firstName || nombre,
      nombre, telefono: tel10, direccion, ciudad, departamento,
      correo, talla, producto: productoNombre, valor, imageUrl,
    });
    templateSent = !!templateWamid;
    sent = templateSent;

    // Si el template falla (ej: aún en revisión), caer al texto plano
    if (!sent) {
      console.warn('[Funnelish] Template failed, falling back to text message');
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
    const missing: string[] = [];
    if (!direccion || direccion === '—') missing.push('dirección completa de envío');
    if (!ciudad    || ciudad    === '—') missing.push('ciudad de envío');
    if (!departamento || departamento === '—') missing.push('departamento');
    if (talla === 'Por confirmar') missing.push('talla del buzo (XS, S, M, L, XL, XXL, XXXL)');

    if (missing.length > 0) {
      const missingMsg = missing.length === 1
        ? `📋 ¿Me confirmas tu ${missing[0]}?`
        : `📋 Para completar tu pedido necesito confirmar:\n${missing.map(f => `• Tu ${f}`).join('\n')}`;

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

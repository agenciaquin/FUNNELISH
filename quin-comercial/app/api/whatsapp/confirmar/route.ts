import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage } from '@/lib/whatsapp';
import { conLinea } from '@/lib/whatsapp-contexto';
import { supabaseTenant } from '@/lib/supabase-tenant';
import { createServerSupabaseClient } from '@/lib/supabase';

// CORS headers — ConfirmaYa runs on GitHub Pages (different origin)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};

// Preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

/**
 * POST /api/whatsapp/confirmar
 * Envía por el bot de WhatsApp el mensaje de confirmación de un pedido.
 * Auth: cabecera X-API-Key (secreto compartido, sin sesión).
 *
 * MULTI-TENANT: el cuerpo DEBE traer `tenant` (el slug de la empresa). De ahí se
 * sacan el tenant_id y SUS credenciales de WhatsApp, para responder por el número
 * correcto y guardar la conversación/mensaje con su tenant_id. Sin `tenant` no se
 * puede saber a qué empresa pertenece → 400 (no se crean filas sin dueño).
 *
 * NOTA: este endpoint es del flujo EXTERNO (ConfirmaYa). El flujo comercial usa el
 * embudo interno (/api/pedidos). Si no se usa, se puede retirar en la Fase 6.
 */
export async function POST(req: NextRequest) {
  // API key auth — evita requerir sesión para ConfirmaYa
  const apiKey = req.headers.get('X-API-Key');
  if (!apiKey || apiKey !== process.env.CONFIRMA_YA_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  let body: { telefono: string; mensaje: string; tenant?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS });
  }

  const { telefono, mensaje } = body;
  if (!telefono || !mensaje?.trim()) {
    return NextResponse.json({ error: 'Falta telefono o mensaje' }, { status: 400, headers: CORS });
  }

  // ── ¿De qué empresa es este pedido? ──────────────────────────────────────
  const slug = String(body.tenant ?? '').trim();
  if (!slug) {
    return NextResponse.json(
      { error: "Falta 'tenant' (slug de la empresa) para saber a quién pertenece el pedido." },
      { status: 400, headers: CORS },
    );
  }

  const admin = createServerSupabaseClient();
  const { data: t } = await admin
    .from('tenants')
    .select('id, activo, wa_access_token, wa_phone_number_id, wa_phone_number_id_ventas')
    .eq('slug', slug)
    .maybeSingle();
  if (!t?.id || t.activo === false) {
    return NextResponse.json({ error: 'Empresa no encontrada o inactiva' }, { status: 404, headers: CORS });
  }

  // telefono en formato WA: "573004362800" (indicativo + número)
  const waPhone = telefono.startsWith('57') ? telefono : `57${telefono.replace(/\D/g, '').slice(-10)}`;
  const tel10   = waPhone.replace(/^57/, '').slice(-10);
  const msgId   = `bot-confirmar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now     = new Date().toISOString();

  let enviado = false;

  // Todo dentro del contexto de línea del tenant: el mensaje sale por SU número
  // y las escrituras quedan con SU tenant_id (cliente Supabase aislado).
  await conLinea(
    {
      phoneId: t.wa_phone_number_id ?? '',
      tipo: 'funnel',
      accessToken: t.wa_access_token ?? undefined,
      tenantId: t.id,
      phoneIdVentas: t.wa_phone_number_id_ventas ?? undefined,
    },
    async () => {
      const sent = await sendTextMessage(waPhone, mensaje.trim());
      if (!sent) return;
      enviado = true;

      const supabase = supabaseTenant(t.id);

      // Marcar wa_enviado = true en el pedido
      await supabase
        .from('clientes_funnelish')
        .update({ wa_enviado: true, wa_enviado_at: now, estado: 'wa_enviado' })
        .eq('telefono', tel10)
        .eq('confirmado', false);

      // Upsert de la conversación para que aparezca en el panel de QuinChat
      await supabase.from('conversations').upsert({
        id:                waPhone,
        contact_name:      tel10,
        last_message:      mensaje.trim().slice(0, 80) + '…',
        last_message_time: now,
        unread_count:      0,
        bot_enabled:       true,
      }, { onConflict: 'tenant_id,id' });

      await supabase.from('messages').insert({
        id:              msgId,
        conversation_id: waPhone,
        content:         mensaje.trim(),
        role:            'assistant',
        type:            'text',
        whatsapp_id:     sent,
        created_at:      now,
      });
    },
  );

  if (!enviado) {
    return NextResponse.json({ error: 'Error enviando mensaje por WhatsApp' }, { status: 500, headers: CORS });
  }

  return NextResponse.json({ success: true, phone: waPhone }, { headers: CORS });
}

const WA_API_URL = 'https://graph.facebook.com/v19.0';

// ── Upload media to Meta and get media_id ─────────────────────────────────────
export async function uploadWhatsAppMedia(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) return null;

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType);
  form.append('file', new Blob([Uint8Array.from(buffer)], { type: mimeType }), filename);

  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) { console.error('[WhatsApp] uploadMedia failed:', await res.text()); return null; }
    const data = await res.json();
    return data.id as string;
  } catch (e) {
    console.error('[WhatsApp] uploadMedia network error:', e);
    return null;
  }
}

// ── Send a media message using a media_id ─────────────────────────────────────
// Returns: WhatsApp wamid string on success, null on failure
export async function sendMediaMessage(
  to: string,
  mediaId: string,
  type: 'image' | 'document' | 'audio' | 'video',
  options: { caption?: string; filename?: string } = {},
): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) return null;

  const mediaObj: Record<string, string> = { id: mediaId };
  if (options.caption && (type === 'image' || type === 'document')) mediaObj.caption = options.caption;
  if (options.filename && type === 'document') mediaObj.filename = options.filename;

  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type,
        [type]: mediaObj,
      }),
    });
    if (!res.ok) { console.error('[WhatsApp] sendMedia failed:', await res.text()); return null; }
    const data = await res.json();
    return (data.messages?.[0]?.id as string) ?? null;
  } catch (e) {
    console.error('[WhatsApp] sendMedia network error:', e);
    return null;
  }
}

/**
 * Sends a plain text message via WhatsApp Cloud API.
 * Returns: WhatsApp wamid string on success, null on failure.
 * Server-only — never call from browser code.
 */
export async function sendTextMessage(to: string, text: string): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.error('[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN');
    return null;
  }

  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[WhatsApp] sendText failed:', err);
      return null;
    }

    const data = await res.json();
    return (data.messages?.[0]?.id as string) ?? null;
  } catch (e) {
    console.error('[WhatsApp] Network error (sendText):', e);
    return null;
  }
}

// ── Send image by public URL (no media_id required) ──────────────────────────
export async function sendImageByUrl(to: string, imageUrl: string, caption?: string): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) return null;
  try {
    const imageObj: Record<string, string> = { link: imageUrl };
    if (caption) imageObj.caption = caption;
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'image',
        image: imageObj,
      }),
    });
    if (!res.ok) { console.error('[WhatsApp] sendImageByUrl failed:', await res.text()); return null; }
    const data = await res.json();
    return (data.messages?.[0]?.id as string) ?? null;
  } catch (e) {
    console.error('[WhatsApp] sendImageByUrl network error:', e);
    return null;
  }
}

// ── Send audio by public URL (no media_id required) ──────────────────────────
export async function sendAudioByUrl(to: string, audioUrl: string): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) return null;
  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'audio',
        audio: { link: audioUrl },
      }),
    });
    if (!res.ok) { console.error('[WhatsApp] sendAudioByUrl failed:', await res.text()); return null; }
    const data = await res.json();
    return (data.messages?.[0]?.id as string) ?? null;
  } catch (e) {
    console.error('[WhatsApp] sendAudioByUrl network error:', e);
    return null;
  }
}

// ── Template message ──────────────────────────────────────────────────────────

export interface ConfirmacionParams {
  saludo: string;   // {{1}} — nombre en el saludo "Hola {{1}} 😊"
  nombre: string;   // {{2}}
  telefono: string; // {{3}}
  direccion: string;// {{4}}
  ciudad: string;   // {{5}}
  departamento: string; // {{6}}
  correo: string;   // {{7}}
  talla: string;    // {{8}}
  producto: string; // {{9}}
  valor: string;    // {{10}}
  imageUrl: string;
}

/**
 * Sends the approved Meta template "confirmacion_pedido_klixmant".
 * Works for business-initiated messages (no 24h window required).
 * The template must be approved in Meta WhatsApp Manager before using this.
 *
 * Template variables (in order):
 *   {{1}} nombre  {{2}} telefono  {{3}} direccion  {{4}} ciudad
 *   {{5}} departamento  {{6}} correo  {{7}} talla
 *   {{8}} producto  {{9}} valor
 */
/** Returns the WhatsApp message ID (wamid) on success, null on failure */
export async function sendConfirmacionTemplate(
  to: string,
  params: ConfirmacionParams,
): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.error('[WhatsApp] Missing credentials for template send');
    return false;
  }

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'confirmacion_pedido_klixmant',
      language: { code: 'es' },
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: { link: params.imageUrl },
            },
          ],
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.saludo },      // {{1}} saludo
            { type: 'text', text: params.nombre },       // {{2}}
            { type: 'text', text: params.telefono },     // {{3}}
            { type: 'text', text: params.direccion },    // {{4}}
            { type: 'text', text: params.ciudad },       // {{5}}
            { type: 'text', text: params.departamento }, // {{6}}
            { type: 'text', text: params.correo },       // {{7}}
            { type: 'text', text: params.talla },        // {{8}}
            { type: 'text', text: params.producto },     // {{9}}
            { type: 'text', text: params.valor },        // {{10}}
          ],
        },
      ],
    },
  };

  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[WhatsApp] sendTemplate failed:', err);
      return null;
    }
    const data = await res.json();
    const wamid = (data.messages?.[0]?.id as string) ?? null;
    console.log('[WhatsApp] Template sent OK to', to, '| wamid:', wamid);
    return wamid;
  } catch (e) {
    console.error('[WhatsApp] Network error (sendTemplate):', e);
    return null;
  }
}

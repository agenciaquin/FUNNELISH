const WA_API_URL = 'https://graph.facebook.com/v19.0';

/**
 * Sends a plain text message via WhatsApp Cloud API.
 * Only works within the 24h customer-initiated window.
 * Server-only — never call from browser code.
 */
export async function sendTextMessage(to: string, text: string): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.error('[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN');
    return false;
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
    }

    return res.ok;
  } catch (e) {
    console.error('[WhatsApp] Network error (sendText):', e);
    return false;
  }
}

// ── Template message ──────────────────────────────────────────────────────────

export interface ConfirmacionParams {
  nombre: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  correo: string;
  talla: string;
  producto: string;
  valor: string;
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
export async function sendConfirmacionTemplate(
  to: string,
  params: ConfirmacionParams,
): Promise<boolean> {
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
            { type: 'text', text: params.nombre },
            { type: 'text', text: params.telefono },
            { type: 'text', text: params.direccion },
            { type: 'text', text: params.ciudad },
            { type: 'text', text: params.departamento },
            { type: 'text', text: params.correo },
            { type: 'text', text: params.talla },
            { type: 'text', text: params.producto },
            { type: 'text', text: params.valor },
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
    } else {
      console.log('[WhatsApp] Template sent OK to', to);
    }

    return res.ok;
  } catch (e) {
    console.error('[WhatsApp] Network error (sendTemplate):', e);
    return false;
  }
}

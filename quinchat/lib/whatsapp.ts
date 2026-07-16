const WA_API_URL = 'https://graph.facebook.com/v19.0';

/**
 * Sends a plain text message via WhatsApp Cloud API.
 * Returns true if Meta accepted the request.
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
      console.error('[WhatsApp] Send failed:', err);
    }

    return res.ok;
  } catch (e) {
    console.error('[WhatsApp] Network error:', e);
    return false;
  }
}

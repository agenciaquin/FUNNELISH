import { phoneIdActual } from '@/lib/whatsapp-contexto';
import { sendTextMessage, destinoWA } from '@/lib/whatsapp';

/**
 * Mensaje con botones de respuesta rápida (máx. 3, título ≤ 20 caracteres).
 * Si WhatsApp lo rechaza, se manda como texto normal para no dejar al vendedor sin pregunta.
 */
export async function enviarBotones(to: string, cuerpo: string, botones: { id: string; titulo: string }[]): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (phoneNumberId && token) {
    try {
      const r = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', recipient_type: 'individual', ...destinoWA(to), type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: cuerpo.slice(0, 1024) },
            action: { buttons: botones.slice(0, 3).map(b => ({ type: 'reply', reply: { id: b.id.slice(0, 256), title: b.titulo.slice(0, 20) } })) },
          },
        }),
      });
      if (r.ok) return ((await r.json())?.messages?.[0]?.id as string) ?? null;
      console.error('[VV] botones rechazados:', await r.text());
    } catch (e) { console.error('[VV] botones:', e); }
  }
  return sendTextMessage(to, `${cuerpo}\n\nResponde *SÍ* o *NO*.`);
}

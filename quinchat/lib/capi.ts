import { createHash } from 'node:crypto';

const GRAPH = 'https://graph.facebook.com/v19.0';

/** SHA-256 en minúsculas y sin espacios, como exige Meta para los datos del cliente. */
function hash(v: string): string {
  return createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
}

/**
 * Envía el evento de compra a Meta por la Conversions API (server-side).
 *
 * Esto hace que la venta aparezca en la campaña aunque el píxel del navegador se
 * pierda. Usa el mismo `eventId` que el píxel del navegador para que Meta
 * NO cuente la venta dos veces (deduplicación).
 */
export async function enviarCompraMeta(opciones: {
  pixelId: string | null | undefined;
  token: string | null | undefined;
  valor: number;
  telefono?: string;
  nombre?: string;
  apellidos?: string;
  correo?: string;
  ciudad?: string;
  departamento?: string;
  producto?: string;
  eventId: string;         // = la referencia del pedido (igual que en el navegador)
  fbc?: string; fbp?: string;
  urlOrigen?: string;      // página donde ocurrió la compra
}): Promise<boolean> {
  // Se limpian por si quedaron con espacios al copiarlos y pegarlos
  const pixelId = String(opciones.pixelId ?? '').trim();
  const token   = String(opciones.token   ?? '').trim();
  if (!pixelId || !token) return false;

  const tel = String(opciones.telefono ?? '').replace(/\D/g, '');
  const telE164 = tel ? (tel.startsWith('57') ? tel : `57${tel}`) : '';

  const user_data: Record<string, unknown> = {};
  if (telE164)            user_data.ph = [hash(telE164)];
  if (opciones.correo)    user_data.em = [hash(opciones.correo)];
  if (opciones.nombre)    user_data.fn = [hash(opciones.nombre)];
  if (opciones.apellidos) user_data.ln = [hash(opciones.apellidos)];
  if (opciones.ciudad)    user_data.ct = [hash(opciones.ciudad.replace(/\s/g, ''))];
  if (opciones.departamento) user_data.st = [hash(opciones.departamento.replace(/\s/g, ''))];
  user_data.country = [hash('co')];
  if (opciones.fbc) user_data.fbc = opciones.fbc;
  if (opciones.fbp) user_data.fbp = opciones.fbp;

  const body = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: opciones.eventId,           // deduplica con el píxel del navegador
      action_source: 'website',
      ...(opciones.urlOrigen ? { event_source_url: opciones.urlOrigen } : {}),
      user_data,
      custom_data: {
        currency: 'COP',
        value: Math.round(opciones.valor || 0),
        content_name: opciones.producto,
      },
    }],
  };

  try {
    const res = await fetch(`${GRAPH}/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('[CAPI Meta] error:', await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[CAPI Meta] fallo de red:', e);
    return false;
  }
}

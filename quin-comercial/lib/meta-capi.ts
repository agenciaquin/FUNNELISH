/**
 * Conversions API (CAPI) para anuncios de Click-to-WhatsApp.
 *
 * Le devuelve a Meta las VENTAS reales para que el algoritmo optimice por
 * compradores (no solo por gente que abre chat). Se envía un evento "Purchase"
 * asociado al `ctwa_clid` (el ID de clic que Meta manda cuando el cliente llega
 * de un anuncio de WhatsApp).
 *
 * Variables de entorno (Vercel):
 *   META_ADS_TOKEN          → token del System User con ads_management
 *   META_CAPI_DATASET_ID    → ID del Dataset (Orígenes de datos) conectado a la
 *                             cuenta de WhatsApp Business.
 */

const GRAPH = 'https://graph.facebook.com/v21.0';

export interface ConversionCTWA {
  ctwaClid: string;      // user_data.ctwa_clid (obligatorio para atribuir)
  valor: number;         // valor de la venta
  moneda?: string;       // por defecto COP
  eventId: string;       // id estable para que Meta no duplique (ej. venta-573...)
  eventTime?: number;    // unix seconds; por defecto ahora
  telefono?: string;     // opcional, se envía hasheado
}

async function sha256(txt: string): Promise<string> {
  const data = new TextEncoder().encode(txt.trim().toLowerCase());
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Envía un evento Purchase de CTWA a Meta. Devuelve {ok, error?}. */
export async function enviarConversionCTWA(ev: ConversionCTWA): Promise<{ ok: boolean; error?: string }> {
  const token = String(process.env.META_ADS_TOKEN ?? '').trim();
  const dataset = String(process.env.META_CAPI_DATASET_ID ?? '').trim();
  if (!token || !dataset) return { ok: false, error: 'Falta META_ADS_TOKEN o META_CAPI_DATASET_ID' };
  if (!ev.ctwaClid) return { ok: false, error: 'Sin ctwa_clid' };

  const user_data: Record<string, any> = { ctwa_clid: ev.ctwaClid };
  if (ev.telefono) {
    const tel = ev.telefono.replace(/\D/g, '');
    if (tel) user_data.ph = [await sha256(tel)];
  }

  const body = {
    data: [{
      event_name: 'Purchase',
      event_time: ev.eventTime ?? Math.floor(Date.now() / 1000),
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      event_id: ev.eventId,
      user_data,
      custom_data: { currency: ev.moneda ?? 'COP', value: ev.valor },
    }],
    access_token: token,
  };

  try {
    const res = await fetch(`${GRAPH}/${dataset}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.error) return { ok: false, error: json?.error?.message || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'fallo de red' };
  }
}

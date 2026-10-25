// Medición de QUIN LIVE SHOPPING — MAQUETA: solo imprime en consola.
// Más adelante se conecta aquí el Pixel de Meta (+ Conversions API), el Pixel de TikTok
// y la base de datos. Los componentes solo llaman a track(); no saben a dónde va.

export type EventoLive =
  | 'live_view'
  | 'video_play'
  | 'sound_on'
  | 'product_shown'
  | 'product_click'
  | 'buy_here_open'
  | 'order_submit'
  | 'buy_whatsapp_click';

export function track(evento: EventoLive, datos: Record<string, unknown> = {}): void {
  // TODO fase 2: fbq('trackCustom', ...) / ttq.track(...) / POST /api/live/evento
  console.info(`[QUIN LIVE] ${evento}`, { ...datos, t: new Date().toISOString() });
}

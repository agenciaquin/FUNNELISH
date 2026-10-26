// Medición de QUIN LIVE SHOPPING.
// Los componentes solo llaman a track(); aquí se decide a dónde va cada evento:
//  · Pixel de Meta (fbq) y Pixel de TikTok (ttq), si el live/embudo los tiene configurados.
//  · La COMPRA (Purchase / CompletePayment) la dispara el propio checkout del embudo
//    (FormularioPedido) + Conversions API del servidor, igual que en los embudos.

export type EventoLive =
  | 'live_view'
  | 'video_play'
  | 'sound_on'
  | 'product_shown'
  | 'product_click'
  | 'buy_here_open'
  | 'order_submit'
  | 'buy_whatsapp_click'
  // Asistente IA (maqueta)
  | 'ai_question'
  | 'ai_answer';

type Datos = Record<string, unknown>;

// Eventos personalizados (aparecen como "custom" en Meta/TikTok, útiles para públicos).
const CUSTOM: Partial<Record<EventoLive, string>> = {
  video_play: 'LiveVideoPlay',
  sound_on: 'LiveSonidoActivado',
  product_shown: 'LiveProductoMostrado',
};

// Para no inflar InitiateCheckout si abren y cierran el checkout varias veces.
let ultimoCheckout = 0;

function aPixeles(evento: EventoLive, d: Datos) {
  if (typeof window === 'undefined') return;
  const w = window as any;
  const valor = typeof d.precio === 'number' ? d.precio : undefined;
  const nombre = typeof d.nombre === 'string' ? d.nombre : undefined;
  const contentId = String(d.productoId ?? nombre ?? 'producto').slice(0, 100);
  const contents = [{ content_id: contentId, content_name: nombre, content_type: 'product', quantity: 1, price: valor }];

  try {
    // Abrir el checkout (botón ¡COMPRAR!, COMPRA AQUÍ o tocar la tarjeta)
    if (evento === 'buy_here_open' || evento === 'product_click') {
      const ahora = Date.now();
      if (ahora - ultimoCheckout < 30_000) return;
      ultimoCheckout = ahora;
      w.fbq?.('track', 'InitiateCheckout', { content_name: nombre, content_ids: [contentId], content_type: 'product', contents, value: valor, currency: 'COP' });
      w.ttq?.track('InitiateCheckout', { content_id: contentId, content_type: 'product', contents, content_name: nombre, value: valor, currency: 'COP' });
      return;
    }
    // Clic en WhatsApp = Contacto
    if (evento === 'buy_whatsapp_click') {
      w.fbq?.('track', 'Contact', { content_name: nombre });
      w.ttq?.track('Contact', { content_id: contentId, content_name: nombre });
      return;
    }
    const custom = CUSTOM[evento];
    if (custom) {
      w.fbq?.('trackCustom', custom, { content_ids: [contentId], content_name: nombre });
      w.ttq?.track(custom, { content_id: contentId, content_name: nombre });
    }
  } catch { /* un píxel nunca debe romper el live */ }
}

export function track(evento: EventoLive, datos: Datos = {}): void {
  aPixeles(evento, datos);
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[QUIN LIVE] ${evento}`, { ...datos, t: new Date().toISOString() });
  }
}

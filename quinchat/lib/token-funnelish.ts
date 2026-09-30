import { timingSafeEqual } from 'crypto';

/**
 * ¿El aviso de venta viene de verdad de Funnelish?
 *
 * Funnelish no firma sus webhooks, así que la URL que se le da lleva un token:
 *   https://…/api/funnelish/webhook?token=<FUNNELISH_WEBHOOK_TOKEN>
 * Sin esto, cualquiera que conozca la URL crea pedidos falsos y hace que se
 * mande una plantilla de confirmación (de pago) al número que quiera.
 *
 * El token solo protege esta entrada. El checkout propio (`/api/pedidos`) llega
 * al mismo proceso sin token, porque es público; allí el abuso lo frenan el
 * límite por IP y por teléfono y que solo se aceptan fotos de sitios propios.
 *
 * Si `FUNNELISH_WEBHOOK_TOKEN` no está configurada se deja pasar y se avisa:
 * cortar las ventas reales por una variable que falta sería peor. Hay que
 * configurarla, y añadir el `?token=` en Funnelish, antes de reactivar.
 */
export function tokenFunnelishValido(req: Request): boolean {
  const esperado = process.env.FUNNELISH_WEBHOOK_TOKEN;
  if (!esperado) {
    console.warn('[Funnelish] FUNNELISH_WEBHOOK_TOKEN no configurada: el webhook acepta cualquier aviso.');
    return true;
  }
  const recibido = new URL(req.url).searchParams.get('token') ?? req.headers.get('x-webhook-token') ?? '';
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

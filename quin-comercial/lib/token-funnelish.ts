import { createHmac, timingSafeEqual } from 'crypto';

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
 *
 * TOKEN POR CLIENTE: la ruta `/api/funnelish/webhook/<slug>` no acepta la
 * variable a secas, sino `HMAC-SHA256(FUNNELISH_WEBHOOK_TOKEN, <slug>)` en hex
 * (`tokenFunnelishDeCliente`). Así cada cliente tiene el suyo, no conoce la
 * clave general y su token no sirve contra la URL de otro cliente. No hace
 * falta guardar nada en la base: se recalcula. La URL de cada cliente la
 * imprime `npx tsx pruebas/token-por-cliente.ts <slug>`.
 * La ruta sin cliente (la de la agencia) sigue con la variable a secas.
 */
export function tokenFunnelishDeCliente(slug: string, clave = process.env.FUNNELISH_WEBHOOK_TOKEN ?? ''): string {
  return createHmac('sha256', clave).update(slug).digest('hex');
}

/** `slugCliente`: si se pasa, se espera el token de ese cliente (ver arriba). */
export function tokenFunnelishValido(req: Request, slugCliente?: string): boolean {
  const clave = process.env.FUNNELISH_WEBHOOK_TOKEN;
  if (!clave) {
    console.warn('[Funnelish] FUNNELISH_WEBHOOK_TOKEN no configurada: el webhook acepta cualquier aviso.');
    return true;
  }
  const esperado = slugCliente === undefined ? clave : tokenFunnelishDeCliente(slugCliente, clave);
  const recibido = new URL(req.url).searchParams.get('token') ?? req.headers.get('x-webhook-token') ?? '';
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

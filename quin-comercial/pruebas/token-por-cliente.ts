/**
 * Imprime la URL del webhook de Funnelish de un cliente, con SU token.
 *
 *   FUNNELISH_WEBHOOK_TOKEN=<la misma de Vercel> npx tsx pruebas/token-por-cliente.ts <slug> [<slug>…]
 *
 * Opcional: BASE=https://otro-dominio (por defecto https://www.klixmant.shop).
 * El token es HMAC-SHA256(FUNNELISH_WEBHOOK_TOKEN, slug) en hex, el mismo que
 * comprueba `app/api/funnelish/webhook/[tenant]/route.ts`. La clave general no
 * se imprime: a cada cliente se le da solo su URL. El slug es el de la tabla
 * `tenants` (el que sale en su dirección de la tienda), en minúsculas.
 *
 * No toca la base ni la red: solo calcula.
 */
import { tokenFunnelishDeCliente } from '../lib/token-funnelish';

// Sin recortar: la ruta usa la variable tal cual está en Vercel.
const clave = process.env.FUNNELISH_WEBHOOK_TOKEN ?? '';
const base = (process.env.BASE ?? 'https://www.klixmant.shop').replace(/\/+$/, '');
const slugs = process.argv.slice(2).map(s => s.trim()).filter(Boolean);

if (!clave) {
  console.error('Falta FUNNELISH_WEBHOOK_TOKEN en el entorno (la misma que en Vercel, quinchat-comercial).');
  process.exit(1);
}
if (slugs.length === 0) {
  console.error('Uso: npx tsx pruebas/token-por-cliente.ts <slug> [<slug>…]');
  process.exit(1);
}

for (const slug of slugs) {
  if (slug !== slug.toLowerCase()) console.warn(`Aviso: "${slug}" tiene mayúsculas; los slugs de tenants van en minúsculas.`);
  const token = tokenFunnelishDeCliente(slug, clave);
  console.log(`${slug}\t${base}/api/funnelish/webhook/${encodeURIComponent(slug)}?token=${token}`);
}

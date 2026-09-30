/**
 * ¿La foto que manda la página de venta es NUESTRA?
 *
 * `/api/pedidos` es público: cualquiera puede mandarle un pedido con la `imagen`
 * que quiera. Esa foto acaba en la plantilla de confirmación que sale del número
 * verificado de la marca, y con `imagenes[]` el servidor además descarga URLs
 * ajenas para armar collages. Por eso solo se aceptan fotos de sitios propios:
 *
 *  · el almacenamiento de Supabase (host de `NEXT_PUBLIC_SUPABASE_URL`),
 *  · el de R2 (host de `R2_PUBLIC_URL`, si existe),
 *  · los dominios de las tiendas,
 *  · el mismo dominio que recibió el pedido (la página que lo mandó; en Vercel el
 *    host no se puede falsear, porque es el que decide a qué proyecto llega).
 *
 * Si no es propia se ignora, y el pedido usa la foto del catálogo o la de
 * respaldo, como cuando la página no manda ninguna.
 *
 * Archivo idéntico en quinchat/ y quin-comercial/.
 */

const DOMINIOS_TIENDA = ['pedido.klixmant.shop', 'www.klixmant.shop', 'klixmant.shop', 'tienda.skioo.shop'];

function hostDe(url: string | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).host.toLowerCase(); } catch { return null; }
}

/** Devuelve la URL si es una foto de un sitio propio; si no, `undefined`. */
export function imagenPropia(valor: unknown, hostPeticion: string): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const texto = valor.trim();
  let url: URL;
  try { url = new URL(texto); } catch { return undefined; }

  const host = url.host.toLowerCase();
  const peticion = hostPeticion.trim().toLowerCase();
  const permitidos = [
    hostDe(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hostDe(process.env.R2_PUBLIC_URL),
    ...DOMINIOS_TIENDA,
  ].filter(Boolean) as string[];

  // https siempre; http solo desde el mismo dominio (desarrollo local)
  if (url.protocol === 'https:' && (permitidos.includes(host) || host === peticion)) return texto;
  if (url.protocol === 'http:' && peticion && host === peticion) return texto;
  return undefined;
}

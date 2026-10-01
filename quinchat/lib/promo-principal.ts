/**
 * "Marcar vendido" del enlace PRINCIPAL de /promos (el de la tienda, sin ?v=).
 *
 * Antes el token del vendedor `__principal__` se mandaba a TODOS los visitantes
 * de /promos (iba en el enlace de cada producto, `?k=`), y con él cualquiera
 * podía descontar stock con /api/promociones/vender.
 *
 * Ahora ese token no sale nunca en la página. El dueño abre una vez, en cada
 * teléfono, `https://pedido.klixmant.shop/promos?k=<token>`: el middleware lo
 * guarda en esta cookie (httpOnly, no la lee JavaScript) y quita el `?k=` de la
 * dirección. Desde ese teléfono, la ficha de cualquier producto muestra el botón
 * y la ruta /vender lee el token de la cookie, no del cuerpo.
 *
 * Solo una constante: el middleware también la importa y no debe arrastrar la
 * base de datos.
 */
export const COOKIE_PROMO_PRINCIPAL = 'promo_principal';

/** Un año: el dueño no tiene que volver a activar el teléfono cada semana. */
export const COOKIE_PROMO_PRINCIPAL_SEG = 60 * 60 * 24 * 365;

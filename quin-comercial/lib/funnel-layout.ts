// Modelo "todo es un bloque" para el editor de embudos.
// Un embudo puede guardarse como una lista ORDENADA de bloques (layout). Cada
// bloque tiene un `tipo`: unos son ESTRUCTURALES (leen los campos compartidos del
// embudo: banner, título, galería, precio, botón…) y otros son de CONTENIDO
// (texto, foto, testimonios, etc., con su propia data). Los campos compartidos
// (precio, variantes, imágenes) siguen siendo la fuente de verdad para el
// checkout; el layout solo define el ORDEN y qué se muestra.

export type BloqueLayout = {
  id: string;
  tipo: string;
  // Mostrar/ocultar el bloque sin borrarlo (👁 en el editor). undefined = visible.
  visible?: boolean;
  // Campos de bloques de contenido (texto/foto/video/…):
  url?: string; urls?: string[]; titulo?: string; cuerpo?: string; centrado?: boolean;
  texto?: string; accion?: string; horas?: number; altura?: number; items?: any[];
  // Estilo/opciones por bloque (bloques nuevos: mas_vendido, ventas, stock…).
  // Opcional y con defaults: los embudos viejos no lo tienen y no cambian.
  props?: Record<string, any>;
};

// Tipos que se dibujan leyendo los campos compartidos del embudo.
export const TIPOS_ESTRUCTURALES = new Set([
  'banner_clientes', 'titular', 'galeria', 'boton_comprar', 'precio',
  'contador_pagina', 'ultimas_unidades', 'detalle', 'caracteristicas', 'estrellas',
  // Gatillos mentales: bloque compuesto (urgencia + barra + precio + botón). Lee
  // el precio del embudo (precio / precio_antes), por eso es estructural.
  'gatillos',
  // 'checkout' también lee los campos compartidos (variantes, precio, formulario),
  // pero se dibuja aparte porque es interactivo (ver LayoutRender).
  'checkout',
]);

/** Bloques que forman el checkout completo (catálogo + formulario + comprar).
 *  Se agregan juntos con "Agregar checkout" y se mueven como una unidad. */
export function bloquesCheckout(): BloqueLayout[] {
  return [{ id: `checkout-${(_c++).toString(36)}${Math.random().toString(36).slice(2, 6)}`, tipo: 'checkout' }];
}

let _c = 0;
const nid = (t: string) => `${t}-${(_c++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Arma el layout por defecto de un embudo a partir de sus campos actuales,
 * en el MISMO orden en que hoy se dibuja la página. Sirve para "convertir" un
 * embudo viejo al editor de bloques sin perder nada.
 */
export function construirLayoutDesdeFunnel(f: any): BloqueLayout[] {
  const out: BloqueLayout[] = [];
  const porAncla = (a: string) => ((f?.bloques ?? []) as any[])
    .filter(b => (b.ancla || 'portada') === a)
    .map(b => ({ ...b }));

  if (f?.imagen_clientes) out.push({ id: nid('banner_clientes'), tipo: 'banner_clientes' });
  out.push({ id: nid('titular'), tipo: 'titular' });
  out.push(...porAncla('titular'));
  out.push({ id: nid('galeria'), tipo: 'galeria' });
  out.push(...porAncla('portada'));
  out.push({ id: nid('boton'), tipo: 'boton_comprar' });
  out.push(...porAncla('comprar'));
  out.push({ id: nid('precio'), tipo: 'precio' });
  out.push(...porAncla('precio'));
  if (Number(f?.horas_contador ?? 0) > 0) out.push({ id: nid('contador'), tipo: 'contador_pagina' });
  out.push({ id: nid('sep'), tipo: 'separador' });
  out.push({ id: nid('ultimas'), tipo: 'ultimas_unidades' });
  if (f?.imagen_detalle) out.push({ id: nid('detalle'), tipo: 'detalle' });
  if ((f?.caracteristicas ?? []).length) out.push({ id: nid('carac'), tipo: 'caracteristicas' });
  out.push({ id: nid('estrellas'), tipo: 'estrellas' });
  out.push({ id: nid('boton2'), tipo: 'boton_comprar' });
  return out;
}

/**
 * Plantilla "embudo que convierte": reproduce la estructura del embudo de
 * referencia (headline → portada → oferta → precio → CTA → urgencia → reseñas →
 * sellos → ventas en vivo → checkout). El cliente solo cambia fotos y textos.
 */
export function layoutEmbudoQueConvierte(): BloqueLayout[] {
  return [
    { id: nid('titular'), tipo: 'titular' },
    { id: nid('galeria'), tipo: 'galeria' },
    // Oferta / escasez (como el "OFERTA LIMITADA" de la referencia).
    { id: nid('gat1'), tipo: 'gatillos', props: { titulo: 'OFERTA LIMITADA', tituloColor: '#C1121F', tituloSize: 20, mensaje: 'SE ESTÁ AGOTANDO LA TALLA - L y TALLA - M', mensajeColor: '#0D0D0D', mensajeSize: 13, barra: 31, barraColor: '#C1121F', etiquetaNormal: 'PRECIO NORMAL', etiquetaOferta: 'OFERTA LIMITADA', precioColor: '#C1121F', tamOferta: 12, tamPrecio: 28, botonTexto: 'CLIC AQUI PARA COMPRAR', botonColor: '#1E9E5A', botonAncho: 100, botonForma: 'redondeado', sellos: [], anim: '', ancho: 100 } },
    { id: nid('precio'), tipo: 'precio' },
    { id: nid('cta1'), tipo: 'boton', texto: 'CLIC AQUÍ PARA COMPRAR →', accion: 'comprar' },
    { id: nid('contador'), tipo: 'contador_pagina' },
    // Urgencia con su propio botón.
    { id: nid('gat2'), tipo: 'gatillos', props: { titulo: 'EL STOCK SE ESTÁ AGOTANDO', tituloColor: '#C1121F', tituloSize: 20, mensaje: '⚠️ ¡No te quedes sin el tuyo!', mensajeColor: '#0D0D0D', mensajeSize: 13, barra: 22, barraColor: '#C1121F', etiquetaNormal: 'PRECIO NORMAL', etiquetaOferta: 'OFERTA LIMITADA', precioColor: '#C1121F', tamOferta: 12, tamPrecio: 28, botonTexto: 'COMPRAR CONTRA ENTREGA', botonColor: '#1E9E5A', botonAncho: 100, botonForma: 'redondeado', sellos: [], anim: '', ancho: 100 } },
    { id: nid('cta2'), tipo: 'boton', texto: 'COMPRA FÁCIL AQUÍ', accion: 'comprar' },
    { id: nid('ultimas'), tipo: 'ultimas_unidades' },
    // Prueba social (título + reseñas con estrellas).
    { id: nid('test'), tipo: 'testimonios', props: { titulo: '🔥 MILES DE CLIENTES YA NOS ELIGIERON' }, items: [
      { nombre: 'Juan Pablo C.', texto: 'Excelente calidad, llegó rapidísimo y tal cual la foto.', estrellas: 5, gatillo: true, boton: true, botonTexto: '🛒 LO QUIERO AHORA' },
      { nombre: 'Andrés Felipe G.', texto: 'Muy buena tela, quedé feliz con la compra 👌', estrellas: 5, boton: true, botonTexto: '🛒 LO QUIERO AHORA' },
      { nombre: 'Sebastián Martínez', texto: 'Pagué al recibir, todo perfecto. Recomendado.', estrellas: 5, boton: true, botonTexto: '🛒 LO QUIERO AHORA' },
      { nombre: 'David Rodríguez', texto: 'La mejor compra, ya pedí otra para mi hermano.', estrellas: 5, boton: true, botonTexto: '🛒 LO QUIERO AHORA' },
      { nombre: 'Danilo Ortiz', texto: 'Rápido el envío y muy buena atención por WhatsApp.', estrellas: 5, boton: true, botonTexto: '🛒 LO QUIERO AHORA' },
    ] },
    // Sellos de confianza.
    { id: nid('conf'), tipo: 'confianza', items: ['🛡️ Garantía 30 días', '💵 Pago contra entrega', '🚚 Envío gratis', '✅ Compra 100% segura'] },
    { id: nid('cta3'), tipo: 'boton', texto: 'COMPRAR CONTRA ENTREGA →', accion: 'comprar' },
    // Ventas en vivo (prueba social flotante).
    { id: nid('ventas'), tipo: 'ventas', props: { titulo: 'NUEVA VENTA REALIZADA', items: ['RED BULL NEGRO: Felipe P. ✅', 'Andrea M. acaba de comprar 🎉', 'Nuevo pedido confirmado ✅'], emoji: '🛒', color: '#0D0D0D', colorTexto: '#FFFFFF', posicion: 'bottom-right', delayInicial: 8, intervalo: 14, duracion: 3 } },
    // Checkout completo (catálogo + formulario + comprar).
    { id: nid('checkout'), tipo: 'checkout' },
  ];
}

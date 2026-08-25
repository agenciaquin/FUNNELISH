/**
 * Catálogo de BLOQUES de la página de venta (embudo) y el layout por defecto.
 *
 * Un embudo puede traer su propio `layout` (lista ordenada de bloques que se
 * prenden/apagan y se reordenan). Si no trae ninguno, se usa LAYOUT_POR_DEFECTO,
 * que replica exactamente el orden actual — así los embudos viejos NO cambian.
 *
 * Este archivo es puro (sin React ni Supabase) para poder usarlo tanto en la
 * página pública (servidor) como en el editor del panel (navegador).
 */

/** Una instancia de bloque dentro de una página. */
export interface Bloque {
  id: string;                     // clave única para React y para arrastrar
  tipo: string;                   // 'banner' | 'titular' | 'portada' | ...
  visible?: boolean;              // por defecto true; false = apagado
  props?: Record<string, any>;    // opciones del bloque (texto, imagen, alto…)
}

/** El diseño de una página: la lista ordenada de bloques (+ ajustes del checkout). */
export interface LayoutEmbudo {
  bloques: Bloque[];
  checkout?: Record<string, any>;   // textos/colores/sellos editables del checkout
}

/** Ajustes por defecto del checkout (todo editable desde el panel). */
export const CHECKOUT_DEFAULT = {
  titulo: 'Completa tus datos 👇',
  subtitulo: 'Sin pagar nada ahora · Confirmas por WhatsApp',
  tituloDatos: 'Datos para el envío',
  textoBoton: 'COMPLETAR MI PEDIDO',
  colorBoton: '',                 // vacío = usa el color de acento del embudo
  sellos: [
    { emoji: '🛡️', texto: 'Pagas al recibir' },
    { emoji: '🔁', texto: 'Cambios gratis' },
    { emoji: '🚚', texto: 'Envío gratis' },
  ] as { emoji: string; texto: string }[],
  mostrarSellos: true,
};

/** Definición de un tipo de bloque para el editor. */
export interface DefBloque {
  clave: string;
  nombre: string;
  emoji: string;
  desc: string;
  repetible: boolean;   // ¿se puede poner más de uno? (botón, texto, imagen…)
  contenido: boolean;   // ¿tiene contenido propio editable? (texto/imagen/espacio)
}

/** Catálogo de todos los bloques disponibles para armar una página. */
export const CATALOGO_BLOQUES: DefBloque[] = [
  { clave: 'banner',           nombre: 'Banner de clientes',        emoji: '🖼️', desc: 'Foto o video de tus clientes, arriba del todo.',        repetible: false, contenido: false },
  { clave: 'titular',          nombre: 'Titular',                   emoji: '🏷️', desc: 'El título grande (rota entre frases si tienes varias).', repetible: false, contenido: false },
  { clave: 'portada',          nombre: 'Portada (galería / video)', emoji: '📸', desc: 'La galería de fotos o el video del producto.',          repetible: false, contenido: false },
  { clave: 'boton',            nombre: 'Botón COMPRAR',             emoji: '🛒', desc: 'Botón de compra contra entrega. Puedes poner varios.',   repetible: true,  contenido: false },
  { clave: 'precio',           nombre: 'Precio',                    emoji: '💲', desc: 'Precio de hoy (y el precio tachado si lo tienes).',      repetible: false, contenido: false },
  { clave: 'contador',         nombre: 'Contador de oferta',        emoji: '⏳', desc: 'Cuenta regresiva para dar urgencia.',                   repetible: false, contenido: false },
  { clave: 'ultimas_unidades', nombre: 'Últimas unidades + detalle',emoji: '⚠️', desc: 'Aviso de "últimas unidades" y la foto de detalle.',      repetible: false, contenido: false },
  { clave: 'caracteristicas',  nombre: 'Características',             emoji: '✅', desc: 'Lista de beneficios del producto.',                     repetible: false, contenido: false },
  { clave: 'estrellas',        nombre: 'Estrellas de reseña',       emoji: '⭐', desc: 'Fila de 5 estrellas. Puedes poner varias.',             repetible: true,  contenido: false },
  { clave: 'testimonios',      nombre: 'Clientes felices',          emoji: '😊', desc: 'Reseñas de clientes (foto, nombre, estrellas) + sellos de confianza.', repetible: true, contenido: true },
  { clave: 'gatillos',         nombre: 'Gatillos mentales',         emoji: '🧠', desc: 'Sección en dos: oferta + sellos a un lado y caja de precio (ahorras + CTA) al otro.', repetible: true, contenido: true },
  { clave: 'stock',            nombre: 'Stock / escasez',           emoji: '📊', desc: 'Barra de "stock disponible" con mensaje de urgencia. Se puede fijar flotante.', repetible: true, contenido: true },
  { clave: 'mas_vendido',      nombre: 'Botón MÁS VENDIDO',         emoji: '🔥', desc: 'Sello flotante "MÁS VENDIDO". Al tocarlo baja al checkout y deja preseleccionado tu producto estrella.', repetible: false, contenido: true },
  { clave: 'ventas',           nombre: 'Ventas en vivo (flotante)', emoji: '🛒', desc: 'Aviso flotante "NUEVA VENTA REALIZADA" que va apareciendo solo, con los nombres y mensajes que tú pongas.', repetible: false, contenido: true },
  { clave: 'checkout',         nombre: 'Checkout (formulario)',     emoji: '🧾', desc: 'El formulario de pedido en la MISMA página. El botón COMPRAR baja hasta aquí.', repetible: false, contenido: false },
  { clave: 'checkout_pro',     nombre: 'Checkout PRO (cierre alto)',emoji: '⚡', desc: 'Checkout limpio por pasos: modelo (con foto), género, talla y cantidad. El botón se enciende al completar. El botón COMPRAR baja hasta aquí.', repetible: false, contenido: false },
  { clave: 'texto',            nombre: 'Texto libre',               emoji: '✍️', desc: 'Un texto tuyo (título o párrafo) donde quieras.',        repetible: true,  contenido: true  },
  { clave: 'imagen',           nombre: 'Imagen / Video extra',      emoji: '🎬', desc: 'Una foto o video extra en cualquier parte.',            repetible: true,  contenido: true  },
  { clave: 'espacio',          nombre: 'Espacio en blanco',         emoji: '↕️', desc: 'Separa bloques con un espacio.',                         repetible: true,  contenido: true  },
];

/** Contenido por defecto del bloque "Clientes felices". */
export const TESTIMONIOS_DEFAULT = {
  titulo: 'MILES YA CONFÍAN EN NOSOTROS',
  items: [
    { nombre: 'Juan P.',   estrellas: 5, texto: 'La calidad es increíble, muy cómodo y el envío fue súper rápido.', foto: '' },
    { nombre: 'María G.',  estrellas: 5, texto: 'Me encantó el diseño, se nota que es un producto premium. 100% recomendado.', foto: '' },
    { nombre: 'Carlos M.', estrellas: 5, texto: 'Ya he comprado varias veces, la tela es de la mejor calidad, no se encoge ni destiñe.', foto: '' },
  ] as { nombre: string; estrellas: number; texto: string; foto: string }[],
  badges: ['🛡️ Garantía 30 días', '💵 Pago contra entrega', '🚚 Envío gratis', '✅ Compra 100% segura'],
};

/** Contenido por defecto del bloque "Gatillos mentales". */
export const GATILLOS_DEFAULT = {
  titulo: 'OFERTA LIMITADA',
  colorTitulo: '#0D0D0D',
  tituloSize: 22,
  mensaje: 'SE ESTÁ AGOTANDO LA TALLA L',
  colorMensaje: '#DC2626',
  porcentaje: 30,
  colorBarra: '#DC2626',
  descripcion: 'DA CLIC EN COMPRAR, LLENA TUS DATOS DE ENVÍO Y APARTA TU PEDIDO DE FORMA FÁCIL Y RÁPIDA.',
  badges: ['🔁 Cambios fáciles', '💵 Pago contra entrega'],
  labelNormal: 'PRECIO NORMAL',
  labelOferta: 'OFERTA LIMITADA',
  colorPrecio: '#DC2626',
  cta: 'COMPRAR',
  colorCta: '#3DC12A',
  ctaSize: 18,
  ctaEscala: 1,
  ctaVariante: 'redondeado',
  font: '',
  mensajeSize: 12,
  descSize: 13,
  ofertaSize: 18,
  precioSize: 30,
  colorDesc: '#0D0D0D',
  colorOferta: '#0D0D0D',
};

/** Contenido por defecto del bloque "Stock / escasez". */
export const STOCK_DEFAULT = {
  titulo: 'STOCK DISPONIBLE',
  porcentaje: 25,
  mensaje: 'Quedan pocas unidades en algunos colores y tallas.',
  alerta: '¡No te quedes sin el tuyo!',
  color: '#DC2626',
};

/** Contenido por defecto del bloque "Botón MÁS VENDIDO". */
export const MAS_VENDIDO_DEFAULT = {
  texto: 'MÁS VENDIDO',
  emoji: '🔥',
  color: '#C1121F',
  colorTexto: '#FFFFFF',
  modelo: '',          // nombre del producto/modelo estrella a preseleccionar (vacío = solo baja al checkout)
  posicion: 'arriba',  // 'arriba' | 'centro' | 'abajo'
  size: 14,
};

/** Contenido por defecto del bloque "Ventas en vivo (flotante)". */
export const VENTAS_DEFAULT = {
  titulo: 'NUEVA VENTA REALIZADA',
  emoji: '🛒',
  items: [
    'RED BULL NEGRO: Felipe P.',
    'MCLAREN NARANJA: Juan G.',
    'MERCEDES: Andrés F.',
    'FERRARI ROJO: Camila R.',
  ] as string[],
  color: '#0D0D0D',
  colorTexto: '#FFD400',
  size: 12,
  posicion: 'inf-izq',       // inf-izq | inf-der | sup-izq | sup-der | centro
  delayInicial: 10,          // seg antes de la 1ª aparición
  intervalo: 15,             // seg entre apariciones
  duracion: 3,               // seg que dura visible cada vez
};

/** Busca la definición de un bloque por su clave. */
export function defDeBloque(tipo: string): DefBloque | undefined {
  return CATALOGO_BLOQUES.find(b => b.clave === tipo);
}

/** Tipografías disponibles para el editor visual. */
export const FUENTES: { nombre: string; css: string }[] = [
  { nombre: 'Predeterminada', css: '' },
  { nombre: 'Moderna (sans)', css: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
  { nombre: 'Elegante (serif)', css: 'Georgia, "Times New Roman", serif' },
  { nombre: 'Impacto', css: '"Arial Black", Impact, sans-serif' },
  { nombre: 'Redondeada', css: '"Trebuchet MS", "Segoe UI", sans-serif' },
  { nombre: 'Manuscrita', css: '"Comic Sans MS", "Segoe Print", cursive' },
  { nombre: 'Monoespaciada', css: '"Courier New", monospace' },
];

/** Animaciones disponibles (clases definidas en globals.css). */
export const ANIMACIONES: { nombre: string; clave: string; clase: string }[] = [
  { nombre: 'Ninguna',    clave: '',        clase: '' },
  { nombre: 'Palpita',    clave: 'palpita', clase: 'anim-palpita' },
  { nombre: 'Rebota',     clave: 'rebota',  clase: 'anim-rebota' },
  { nombre: 'Aparece',    clave: 'aparece', clase: 'anim-aparece' },
  { nombre: 'Brillo',     clave: 'brillo',  clase: 'anim-brillo' },
];

/** Tipos de botón para el editor. */
export const VARIANTES_BOTON: { clave: string; nombre: string }[] = [
  { clave: 'pill',       nombre: 'Redondo (pill)' },
  { clave: 'redondeado', nombre: 'Redondeado' },
  { clave: 'cuadrado',   nombre: 'Cuadrado' },
  { clave: 'borde',      nombre: 'Solo borde' },
  { clave: 'sombra',     nombre: 'Con sombra' },
  { clave: 'degradado',  nombre: 'Degradado' },
];

/** Devuelve la clase y el estilo de un botón según su variante y su color. */
export function botonVariante(v: string | undefined, bg: string): { clase: string; estilo: Record<string, string | number> } {
  switch (v) {
    case 'redondeado': return { clase: 'rounded-xl', estilo: { background: bg } };
    case 'cuadrado':   return { clase: 'rounded-md', estilo: { background: bg } };
    case 'borde':      return { clase: 'rounded-full border-2', estilo: { background: 'transparent', borderColor: bg, color: bg } };
    case 'sombra':     return { clase: 'rounded-full shadow-2xl', estilo: { background: bg } };
    case 'degradado':  return { clase: 'rounded-full', estilo: { background: `linear-gradient(90deg, ${bg}, rgba(0,0,0,0.35))` } };
    default:           return { clase: 'rounded-full', estilo: { background: bg } };
  }
}

/** Paleta de colores rápida para el editor. */
export const PALETA_COLORES: string[] = [
  '#0D0D0D', '#FFFFFF', '#C1121F', '#DC2626', '#F59E0B', '#FFD400',
  '#15803D', '#3DC12A', '#00A89D', '#2563EB', '#8B5CF6', '#EC4899',
  '#6B7280', '#78350F', '#065F46', '#1E3A8A',
];

/**
 * A partir de los props de estilo de un bloque, devuelve el `style` en línea y
 * la clase de animación. Si el bloque no trae props, no cambia nada (compatible).
 */
export function estiloBloque(props?: Record<string, any>): { style: Record<string, string | number>; anim: string } {
  const p = props ?? {};
  const style: Record<string, string | number> = {};
  if (Number(p.size) > 0) style.fontSize = `${Number(p.size)}px`;
  if (p.color) style.color = String(p.color);
  if (p.bg) style.background = String(p.bg);
  if (p.font) style.fontFamily = String(p.font);
  if (p.align) style.textAlign = p.align;
  const anim = ANIMACIONES.find(a => a.clave === p.anim)?.clase ?? '';
  return { style, anim };
}

/** Genera un id corto y único para un bloque nuevo (usado en el editor). */
export function nuevoIdBloque(): string {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** El orden por defecto: exactamente el mismo que la página tenía siempre. */
export function layoutPorDefecto(): Bloque[] {
  const orden = [
    'banner',
    'titular',
    'portada',
    'boton',
    'precio',
    'contador',
    'ultimas_unidades',
    'caracteristicas',
    'estrellas',
    'boton',
  ];
  return orden.map((tipo, i) => ({ id: `def_${i}_${tipo}`, tipo, visible: true }));
}

/**
 * Layout de CIERRE ALTO: una sola pantalla, checkout PRO embebido. Pensado para
 * máxima conversión (confianza arriba, prueba social, y el pedido sin cambiar
 * de página). Se usa en embudos nuevos que lo pidan; no cambia los existentes.
 */
export function layoutCierreAlto(): Bloque[] {
  const orden = [
    'titular',
    'portada',
    'boton',
    'precio',
    'estrellas',
    'caracteristicas',
    'ultimas_unidades',
    'checkout_pro',
  ];
  return orden.map((tipo, i) => ({ id: `ca_${i}_${tipo}`, tipo, visible: true }));
}

/**
 * Devuelve la lista de bloques que se debe renderizar: la del embudo si tiene
 * un layout válido, o la de por defecto. Filtra bloques desconocidos.
 */
export function bloquesARenderizar(layout: LayoutEmbudo | null | undefined): Bloque[] {
  const lista = layout?.bloques;
  if (Array.isArray(lista) && lista.length > 0) {
    return lista.filter(b => b && typeof b.tipo === 'string' && defDeBloque(b.tipo));
  }
  return layoutPorDefecto();
}

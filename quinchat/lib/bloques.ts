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

/** El diseño de una página: la lista ordenada de bloques. */
export interface LayoutEmbudo {
  bloques: Bloque[];
}

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
  { clave: 'checkout',         nombre: 'Checkout (formulario)',     emoji: '🧾', desc: 'El formulario de pedido en la MISMA página. El botón COMPRAR baja hasta aquí.', repetible: false, contenido: false },
  { clave: 'checkout_pro',     nombre: 'Checkout PRO (cierre alto)',emoji: '⚡', desc: 'Checkout limpio por pasos: modelo (con foto), género, talla y cantidad. El botón se enciende al completar. El botón COMPRAR baja hasta aquí.', repetible: false, contenido: false },
  { clave: 'texto',            nombre: 'Texto libre',               emoji: '✍️', desc: 'Un texto tuyo (título o párrafo) donde quieras.',        repetible: true,  contenido: true  },
  { clave: 'imagen',           nombre: 'Imagen / Video extra',      emoji: '🎬', desc: 'Una foto o video extra en cualquier parte.',            repetible: true,  contenido: true  },
  { clave: 'espacio',          nombre: 'Espacio en blanco',         emoji: '↕️', desc: 'Separa bloques con un espacio.',                         repetible: true,  contenido: true  },
];

/** Busca la definición de un bloque por su clave. */
export function defDeBloque(tipo: string): DefBloque | undefined {
  return CATALOGO_BLOQUES.find(b => b.clave === tipo);
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

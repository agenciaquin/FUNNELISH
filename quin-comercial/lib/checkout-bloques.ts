// ─────────────────────────────────────────────────────────────────────────────
// CHECKOUT POR BLOQUES — única fuente de verdad.
//
// El checkout de siempre es FIJO: el orden y los textos están escritos dentro de
// FormularioPedido. Aquí vive la versión por BLOQUES: una lista ordenada que
// describe qué se muestra, en qué orden y con qué texto.
//
// Reglas que se respetan aquí:
//  · Un embudo que NO tenga bloques sigue mostrando el checkout fijo, igual que
//    siempre. Los bloques son opcionales y se activan a mano (`bloquesPorDefecto`).
//  · Qué campos pide el formulario se decide en UN solo lugar (`camposDelCheckout`),
//    y de ahí lo leen el panel, la vista previa y el formulario público.
//  · Los números del resumen NO se editan: salen del producto (`resumenDelPedido`).
//    Un total escrito a mano sería un número creíble y falso.
// ─────────────────────────────────────────────────────────────────────────────

export type BloqueCk = {
  id: string;
  tipo: string;
  visible?: boolean;              // false = oculto (no se muestra al cliente)
  props?: Record<string, any>;
};

/** Los 8 datos que el pedido sabe guardar. No hay campos inventados. */
export const CAMPOS_PEDIDO = [
  'nombre', 'apellidos', 'whatsapp', 'correo',
  'direccion', 'barrio', 'municipio', 'departamento',
] as const;
export type CampoPedido = typeof CAMPOS_PEDIDO[number];

/** Etiqueta, tipo de teclado y ayuda de cada dato, tal como se ve hoy. */
export const CAMPO_INFO: Record<CampoPedido, { label: string; tipo?: string; placeholder?: string; auto?: string }> = {
  nombre:       { label: 'NOMBRE', auto: 'given-name' },
  apellidos:    { label: 'APELLIDOS', auto: 'family-name' },
  whatsapp:     { label: 'WHATSAPP', tipo: 'tel', placeholder: '3001234567', auto: 'tel' },
  correo:       { label: 'CORREO ELECTRÓNICO', tipo: 'email', auto: 'email' },
  direccion:    { label: 'DIRECCIÓN', placeholder: 'Calle 15 # 20-30', auto: 'street-address' },
  barrio:       { label: 'BARRIO' },
  municipio:    { label: 'MUNICIPIO' },
  departamento: { label: 'DEPARTAMENTO' },
};

/**
 * Hoy el checkout exige todos los datos MENOS el correo. Se conserva igual para
 * que activar los bloques no cambie lo que ya vive.
 */
export const OBLIGATORIO_POR_DEFECTO: Record<CampoPedido, boolean> = {
  nombre: true, apellidos: true, whatsapp: true, correo: false,
  direccion: true, barrio: true, municipio: true, departamento: true,
};

/**
 * Qué se pierde si se borra o se oculta cada cosa. Se muestra en rojo en el
 * panel: se puede borrar todo, pero nunca a ciegas.
 */
export const AVISO_CAMPO: Partial<Record<CampoPedido, string>> = {
  nombre:       'Sin NOMBRE el pedido llega sin saber a nombre de quién va.',
  whatsapp:     'Sin WHATSAPP no hay por dónde confirmar el pedido ni recuperar el carrito. La transportadora tampoco puede llamar.',
  direccion:    'Sin DIRECCIÓN el pedido llega sin a dónde despachar.',
  municipio:    'Sin MUNICIPIO la guía no se puede generar.',
  departamento: 'Sin DEPARTAMENTO la guía no se puede generar.',
  barrio:       'Sin BARRIO la entrega se vuelve más difícil en ciudades grandes.',
};

/** Aviso al quitar un bloque que no es un campo. */
export const AVISO_TIPO: Record<string, string> = {
  variantes: 'Sin este bloque el cliente no puede elegir color ni talla: el pedido llega sin saber qué prenda enviar.',
  boton:     'Sin el botón el cliente no tiene cómo enviar el pedido.',
  resumen:   'El cliente compra sin ver el total antes de confirmar.',
};

export type CkTipo = { tipo: string; label: string; icono: string; cat: string; unico?: boolean };

/** La paleta del checkout, por categorías. */
export const CK_TIPOS: CkTipo[] = [
  { tipo: 'producto',   label: 'Resumen del producto', icono: '🧾', cat: 'Producto', unico: true },
  { tipo: 'variantes',  label: 'Elegir color y talla', icono: '🎽', cat: 'Producto', unico: true },
  { tipo: 'resumen',    label: 'Resumen del pedido',   icono: '📦', cat: 'Producto', unico: true },
  { tipo: 'campo',      label: 'Dato del cliente',     icono: '✏️', cat: 'Datos del cliente' },
  { tipo: 'titulo',     label: 'Título',               icono: '🔠', cat: 'Texto' },
  { tipo: 'texto',      label: 'Párrafo',              icono: '📝', cat: 'Texto' },
  { tipo: 'espaciador', label: 'Espacio en blanco',    icono: '↕️', cat: 'Texto' },
  { tipo: 'sellos',     label: 'Sellos de confianza',  icono: '🛡️', cat: 'Confianza' },
  { tipo: 'pago',       label: 'Forma de pago',        icono: '💵', cat: 'Confianza', unico: true },
  { tipo: 'boton',      label: 'Botón COMPLETAR PEDIDO', icono: '🟢', cat: 'Llamado a la acción', unico: true },
];

export const CK_TIPO_LABEL = (t: string) => {
  const it = CK_TIPOS.find(x => x.tipo === t);
  return it ? `${it.icono} ${it.label}` : t;
};

let _n = 0;
const nid = (t: string) => `ck-${t}-${Date.now().toString(36)}${(_n++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Un bloque nuevo con sus valores por defecto. */
export function nuevoBloqueCk(tipo: string, campo?: CampoPedido): BloqueCk {
  const b: BloqueCk = { id: nid(tipo), tipo, props: {} };
  if (tipo === 'titulo')     b.props = { texto: 'ESCRIBE TU TÍTULO', size: 18, color: '', align: 'left' };
  if (tipo === 'texto')      b.props = { texto: 'Escribe aquí tu texto…', size: 12, color: '#6B6B6B', align: 'left', italica: true };
  if (tipo === 'espaciador') b.props = { alto: 16 };
  if (tipo === 'producto')   b.props = { mostrarFoto: true, etiquetaNormal: 'PRECIO NORMAL', etiquetaOferta: 'PRECIO EN PROMOCIÓN' };
  if (tipo === 'variantes')  b.props = { titulo: 'ELIGE COLOR Y TALLA ⬇️' };
  if (tipo === 'resumen')    b.props = { etiquetaProducto: 'PRODUCTO', etiquetaPrecio: 'PRECIO', etiquetaTotal: 'Total', textoEnvio: '' };
  if (tipo === 'sellos')     b.props = { items: [{ emoji: '🚚', texto: 'Envío a todo el país' }, { emoji: '🔒', texto: 'Compra 100% segura' }, { emoji: '✅', texto: 'Satisfacción garantizada' }] };
  if (tipo === 'pago')       b.props = { texto: 'CONTRA ENTREGA', color: '#F97316' };
  if (tipo === 'boton')      b.props = { texto: 'COMPLETAR MI PEDIDO', color: '', forma: 'pill', flotante: true };
  if (tipo === 'campo') {
    const c = (campo && (CAMPOS_PEDIDO as readonly string[]).includes(campo)) ? campo : 'nombre';
    const info = CAMPO_INFO[c as CampoPedido];
    b.props = { campo: c, etiqueta: info.label, placeholder: info.placeholder ?? '', obligatorio: OBLIGATORIO_POR_DEFECTO[c as CampoPedido] };
  }
  return b;
}

/**
 * El checkout de siempre, escrito como bloques. Es EXACTAMENTE el mismo orden y
 * los mismos textos que hoy ve el cliente: al activarlo no cambia nada en
 * pantalla, solo pasa a ser editable.
 */
export function bloquesPorDefecto(): BloqueCk[] {
  const campos = CAMPOS_PEDIDO.map(c => nuevoBloqueCk('campo', c));
  return [
    nuevoBloqueCk('variantes'),
    { ...nuevoBloqueCk('titulo'), props: { texto: '✅ DATOS PARA EL ENVÍO:', size: 18, color: '', align: 'left' } },
    { ...nuevoBloqueCk('texto'), props: { texto: 'Sus datos están protegidos y solo se usan para gestionar su pedido.', size: 12, color: '#6B6B6B', align: 'left', italica: true } },
    ...campos,
    nuevoBloqueCk('boton'),
    nuevoBloqueCk('resumen'),
    nuevoBloqueCk('pago'),
    { ...nuevoBloqueCk('texto'), props: { texto: 'Pagas cuando recibes. Te escribimos por WhatsApp para confirmar tu pedido.', size: 12, color: '#6B6B6B', align: 'center', italica: false } },
  ];
}

/** Lee lo guardado sin inventar: si no es una lista de bloques, no hay bloques. */
export function normalizarBloquesCk(valor: any): BloqueCk[] | null {
  if (!Array.isArray(valor)) return null;
  const out = valor
    .filter(b => b && typeof b === 'object' && typeof b.tipo === 'string')
    .map((b, i) => ({
      id: typeof b.id === 'string' && b.id ? b.id : `ck-${b.tipo}-${i}`,
      tipo: String(b.tipo),
      visible: b.visible === false ? false : undefined,
      props: (b.props && typeof b.props === 'object') ? b.props : {},
    }));
  return out.length ? out : null;
}

export type CampoCk = {
  id: CampoPedido;
  label: string;
  tipo?: string;
  placeholder?: string;
  auto?: string;
  obligatorio: boolean;
};

/**
 * QUÉ DATOS PIDE EL CHECKOUT. Única fuente de verdad: de aquí salen los campos
 * que se dibujan, los que se validan y los que se avisan como faltantes.
 * · Sin bloques → los 8 de siempre, todos obligatorios (checkout fijo).
 * · Con bloques → solo los campos que existen, visibles y en su orden.
 * Un campo repetido se cuenta una sola vez (el primero manda).
 */
export function camposDelCheckout(bloques: BloqueCk[] | null | undefined): CampoCk[] {
  if (!bloques || !bloques.length) {
    return CAMPOS_PEDIDO.map(id => ({ id, ...CAMPO_INFO[id], obligatorio: OBLIGATORIO_POR_DEFECTO[id] }));
  }
  const vistos = new Set<string>();
  const out: CampoCk[] = [];
  for (const b of bloques) {
    if (b.tipo !== 'campo' || b.visible === false) continue;
    const id = String(b.props?.campo ?? '') as CampoPedido;
    if (!(CAMPOS_PEDIDO as readonly string[]).includes(id) || vistos.has(id)) continue;
    vistos.add(id);
    const info = CAMPO_INFO[id];
    const etiqueta = String(b.props?.etiqueta ?? '').trim();
    out.push({
      id,
      label: etiqueta || info.label,
      tipo: info.tipo,
      placeholder: String(b.props?.placeholder ?? info.placeholder ?? '') || undefined,
      auto: info.auto,
      obligatorio: b.props?.obligatorio === undefined ? OBLIGATORIO_POR_DEFECTO[id] : b.props.obligatorio !== false,
    });
  }
  return out;
}

/** ¿El checkout tiene con qué vender? Lo que falte se dice en pantalla. */
export function problemasDelCheckout(bloques: BloqueCk[] | null | undefined): string[] {
  if (!bloques || !bloques.length) return [];
  const vivos = bloques.filter(b => b.visible !== false);
  const p: string[] = [];
  if (!vivos.some(b => b.tipo === 'boton')) p.push('No hay botón: el cliente no tiene cómo enviar el pedido.');
  if (!vivos.some(b => b.tipo === 'variantes')) p.push('No está el bloque de color y talla: el pedido llega sin saber qué prenda enviar.');
  const campos = camposDelCheckout(bloques).map(c => c.id);
  const faltan = (['nombre', 'whatsapp', 'direccion', 'municipio', 'departamento'] as CampoPedido[])
    .filter(c => !campos.includes(c));
  if (faltan.length) p.push(`Faltan datos para poder despachar: ${faltan.join(', ')}.`);
  return p;
}

/**
 * LOS NÚMEROS DEL RESUMEN. Salen del producto elegido, nunca de un texto.
 * `envio` es una ETIQUETA que escribe el dueño (ej. "GRATIS"); no suma ni resta,
 * porque hoy el sistema no cobra envío. Si algún día lo cobra, se suma aquí y
 * en un solo sitio.
 */
export function resumenDelPedido(
  variante: { nombre?: string; precio?: number | null; precioAntes?: number | null } | null | undefined,
  opciones?: { textoEnvio?: string },
): { nombre: string; precio: number | null; precioAntes: number | null; envio: string | null; total: number | null } {
  const precio = typeof variante?.precio === 'number' && isFinite(variante.precio) ? variante.precio : null;
  const antes = typeof variante?.precioAntes === 'number' && isFinite(variante.precioAntes) ? variante.precioAntes : null;
  const envioTxt = String(opciones?.textoEnvio ?? '').trim();
  return {
    nombre: String(variante?.nombre ?? '').trim(),
    precio,
    precioAntes: antes,
    envio: envioTxt || null,
    total: precio,           // el total es el precio del producto: no se edita
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKOUT POR BLOQUES — única fuente de verdad.
//
// El checkout se arma igual que la página de inicio: una lista ordenada de
// bloques. De aquí salen, para TODOS (panel, vista previa y página real):
//   · qué se muestra y en qué orden,
//   · qué datos se le piden al cliente y cuáles son obligatorios,
//   · qué números salen en el resumen.
//
// Reglas que se respetan aquí:
//  · Un embudo SIN bloques se comporta exactamente como hoy. Los bloques se
//    activan a mano y arrancan con lo que ese embudo ya tenía configurado
//    (`bloquesDesdeConfig`), así nada cambia solo ni se pierde en silencio.
//  · Un dato que el pedido no sabe guardar no se pide.
//  · El total no se escribe a mano: sale del precio del producto.
// ─────────────────────────────────────────────────────────────────────────────

export type BloqueCk = {
  id: string;
  tipo: string;
  visible?: boolean;              // false = oculto (no se muestra al cliente)
  props?: Record<string, any>;
};

/** Los 8 datos fijos que el pedido sabe guardar, en el orden de siempre. */
export const CAMPOS_PEDIDO = [
  'nombre', 'apellidos', 'whatsapp', 'correo',
  'direccion', 'barrio', 'departamento', 'municipio',
] as const;
export type CampoPedido = typeof CAMPOS_PEDIDO[number];

export const CAMPO_INFO: Record<CampoPedido, { label: string; tipo?: string; placeholder?: string; auto?: string }> = {
  nombre:       { label: 'NOMBRE', auto: 'given-name' },
  apellidos:    { label: 'APELLIDOS', auto: 'family-name' },
  whatsapp:     { label: 'WHATSAPP', tipo: 'tel', placeholder: '3001234567', auto: 'tel' },
  correo:       { label: 'CORREO ELECTRÓNICO', tipo: 'email', auto: 'email' },
  direccion:    { label: 'DIRECCIÓN', placeholder: 'Calle 15 # 20-30', auto: 'street-address' },
  barrio:       { label: 'BARRIO' },
  departamento: { label: 'DEPARTAMENTO' },
  municipio:    { label: 'MUNICIPIO' },
};

/** El correo es el único dato fijo que el pedido no exige. */
export const OBLIGATORIO_POR_DEFECTO: Record<CampoPedido, boolean> = {
  nombre: true, apellidos: true, whatsapp: true, correo: false,
  direccion: true, barrio: true, departamento: true, municipio: true,
};

/** Campos que el dueño inventa. Viajan al pedido como "extras". */
export type TipoExtra = 'texto' | 'notas' | 'telefono' | 'email' | 'selector' | 'checkbox' | 'fecha';
export type CampoExtra = { id: string; label: string; tipo: TipoExtra; requerido?: boolean; placeholder?: string; opciones?: string[] };
export const TIPOS_EXTRA: { v: TipoExtra; l: string }[] = [
  { v: 'texto', l: 'Texto corto' }, { v: 'notas', l: 'Notas (texto largo)' },
  { v: 'telefono', l: 'Teléfono' }, { v: 'email', l: 'Correo' },
  { v: 'selector', l: 'Selector (desplegable)' }, { v: 'checkbox', l: 'Casilla (sí/no)' },
  { v: 'fecha', l: 'Fecha' },
];

/** Qué se pierde si se borra o se oculta. Se dice en pantalla, en rojo. */
export const AVISO_CAMPO: Partial<Record<CampoPedido, string>> = {
  nombre:       'Sin NOMBRE el pedido llega sin saber a nombre de quién va.',
  whatsapp:     'Sin WHATSAPP no hay por dónde confirmar el pedido ni recuperar el carrito, y la transportadora no puede llamar.',
  direccion:    'Sin DIRECCIÓN el pedido llega sin a dónde despachar.',
  departamento: 'Sin DEPARTAMENTO la guía no se puede generar.',
  municipio:    'Sin MUNICIPIO la guía no se puede generar.',
  barrio:       'Sin BARRIO la entrega se vuelve más difícil en ciudades grandes.',
};
export const AVISO_TIPO: Record<string, string> = {
  variantes: 'Sin este bloque el cliente no puede elegir color ni talla: el pedido llega sin saber qué enviar.',
  boton:     'Sin el botón el cliente no tiene cómo enviar el pedido.',
  resumen:   'El cliente compra sin ver el total antes de confirmar.',
};

// ── Paleta del checkout (mismas categorías y forma que la de la página) ──────
export type CkItem = { tipo: string; label: string; ic: string; campo?: CampoPedido; unico?: boolean };
export const CK_PALETA_CATS: { cat: string; items: CkItem[] }[] = [
  { cat: 'Producto', items: [
    { tipo: 'producto',  label: 'Resumen arriba', ic: '🧾', unico: true },
    { tipo: 'variantes', label: 'Color y talla',  ic: '🎽', unico: true },
    { tipo: 'resumen',   label: 'Resumen del pedido', ic: '📦', unico: true },
  ] },
  { cat: 'Datos del cliente', items: CAMPOS_PEDIDO.map(c => ({
    tipo: 'campo', campo: c, label: CAMPO_INFO[c].label.replace(' ELECTRÓNICO', ''), ic: '✏️',
  })) },
  { cat: 'Campo propio', items: [
    { tipo: 'campo_extra', label: 'Campo personalizado', ic: '➕' },
  ] },
  { cat: 'Texto', items: [
    { tipo: 'titulo',     label: 'Título', ic: '🔠' },
    { tipo: 'texto',      label: 'Párrafo', ic: '📝' },
    { tipo: 'espaciador', label: 'Espaciador', ic: '↕️' },
  ] },
  { cat: 'Confianza', items: [
    { tipo: 'sellos', label: 'Sellos', ic: '🛡️' },
    { tipo: 'pago',   label: 'Forma de pago', ic: '💵', unico: true },
  ] },
  { cat: 'Llamado a la acción', items: [
    { tipo: 'boton', label: 'Botón comprar', ic: '🟢', unico: true },
  ] },
];

export const CK_META = (b: BloqueCk): { ic: string; label: string } => {
  if (b.tipo === 'campo') {
    const c = b.props?.campo as CampoPedido;
    return { ic: '✏️', label: String(b.props?.etiqueta ?? '').trim() || CAMPO_INFO[c]?.label || 'Dato' };
  }
  if (b.tipo === 'campo_extra') return { ic: '➕', label: String(b.props?.label ?? '').trim() || 'Campo propio' };
  for (const c of CK_PALETA_CATS) {
    const it = c.items.find(x => x.tipo === b.tipo);
    if (it) return { ic: it.ic, label: it.label };
  }
  return { ic: '🔲', label: b.tipo };
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
  if (tipo === 'variantes')  b.props = { titulo: 'ELIGE COLOR Y TALLA ⬇️', desplegable: false };
  if (tipo === 'resumen')    b.props = { etiquetaProducto: 'PRODUCTO', etiquetaPrecio: 'PRECIO', etiquetaTotal: 'Total', etiquetaEnvio: 'Envío', textoEnvio: '' };
  if (tipo === 'sellos')     b.props = { items: [{ emoji: '🚚', texto: 'Envío a todo el país' }, { emoji: '🔒', texto: 'Compra 100% segura' }, { emoji: '✅', texto: 'Satisfacción garantizada' }] };
  if (tipo === 'pago')       b.props = { texto: 'CONTRA ENTREGA', color: '#F97316' };
  if (tipo === 'boton')      b.props = { texto: 'COMPLETAR MI PEDIDO', color: '', forma: 'pill', flotante: true };
  if (tipo === 'campo_extra') b.props = { id: nid('extra').slice(3), label: 'Nuevo campo', tipoCampo: 'texto', requerido: false, placeholder: '', opciones: [] };
  if (tipo === 'campo') {
    const c: CampoPedido = (campo && (CAMPOS_PEDIDO as readonly string[]).includes(campo)) ? campo : 'nombre';
    b.props = { campo: c, etiqueta: CAMPO_INFO[c].label, placeholder: CAMPO_INFO[c].placeholder ?? '', obligatorio: OBLIGATORIO_POR_DEFECTO[c] };
  }
  return b;
}

/**
 * El checkout de ESTE embudo, escrito como bloques: mismo orden y mismos textos
 * que ya ve el cliente, respetando lo que el dueño hubiera renombrado, ocultado
 * o agregado. Al activarlo, en pantalla no cambia nada.
 */
export function bloquesDesdeConfig(cfg: any): BloqueCk[] {
  const c = (cfg && typeof cfg === 'object') ? cfg : {};
  const fijos: Record<string, { label?: string; oculto?: boolean }> = c.camposFijos ?? {};
  const extras: CampoExtra[] = Array.isArray(c.camposExtra) ? c.camposExtra : [];
  const out: BloqueCk[] = [];

  if (c.bloqueProducto !== false) out.push(nuevoBloqueCk('producto'));

  const vars = nuevoBloqueCk('variantes');
  vars.props = { ...vars.props, desplegable: c.variablesDesplegable === true };
  out.push(vars);

  const tit = nuevoBloqueCk('titulo');
  tit.props = { texto: '✅ DATOS PARA EL ENVÍO:', size: 18, color: '', align: 'left' };
  out.push(tit);

  const nota = nuevoBloqueCk('texto');
  nota.props = { texto: 'Sus datos están protegidos y solo se usan para gestionar su pedido.', size: 12, color: '#6B6B6B', align: 'left', italica: true };
  out.push(nota);

  for (const id of CAMPOS_PEDIDO) {
    const b = nuevoBloqueCk('campo', id);
    const f = fijos[id] ?? {};
    if (String(f.label ?? '').trim()) b.props!.etiqueta = String(f.label).trim();
    // Solo el correo se podía ocultar: se respeta como bloque oculto, no borrado.
    if (id === 'correo' && f.oculto) b.visible = false;
    out.push(b);
  }

  for (const e of extras) {
    const b = nuevoBloqueCk('campo_extra');
    b.props = {
      id: e.id, label: e.label, tipoCampo: e.tipo, requerido: !!e.requerido,
      placeholder: e.placeholder ?? '', opciones: Array.isArray(e.opciones) ? e.opciones : [],
    };
    out.push(b);
  }

  out.push(nuevoBloqueCk('boton'));
  out.push(nuevoBloqueCk('resumen'));
  out.push(nuevoBloqueCk('pago'));

  const cierre = nuevoBloqueCk('texto');
  cierre.props = { texto: 'Pagas cuando recibes. Te escribimos por WhatsApp para confirmar tu pedido.', size: 12, color: '#6B6B6B', align: 'center', italica: false };
  out.push(cierre);

  return out;
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
  id: CampoPedido; label: string; tipo?: string;
  placeholder?: string; auto?: string; obligatorio: boolean;
};

/**
 * QUÉ DATOS FIJOS PIDE EL CHECKOUT — única fuente de verdad.
 * Sin bloques: los de siempre, con lo que el dueño haya renombrado u ocultado.
 * Con bloques: solo los que estén puestos y visibles, en su orden.
 */
export function camposDelCheckout(bloques: BloqueCk[] | null | undefined, cfg?: any): CampoCk[] {
  if (bloques && bloques.length) {
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
        id, label: etiqueta || info.label, tipo: info.tipo, auto: info.auto,
        placeholder: String(b.props?.placeholder ?? info.placeholder ?? '') || undefined,
        obligatorio: b.props?.obligatorio === undefined ? OBLIGATORIO_POR_DEFECTO[id] : b.props.obligatorio !== false,
      });
    }
    return out;
  }
  const c = (cfg && typeof cfg === 'object') ? cfg : {};
  const fijos: Record<string, { label?: string; oculto?: boolean }> = c.camposFijos ?? {};
  return CAMPOS_PEDIDO
    .filter(id => !(id === 'correo' && fijos[id]?.oculto))
    .map(id => ({
      id, ...CAMPO_INFO[id],
      label: String(fijos[id]?.label ?? '').trim() || CAMPO_INFO[id].label,
      obligatorio: OBLIGATORIO_POR_DEFECTO[id],
    }));
}

/** LOS CAMPOS PROPIOS del checkout, en su orden. Misma regla que los fijos. */
export function extrasDelCheckout(bloques: BloqueCk[] | null | undefined, cfg?: any): CampoExtra[] {
  if (bloques && bloques.length) {
    const vistos = new Set<string>();
    const out: CampoExtra[] = [];
    for (const b of bloques) {
      if (b.tipo !== 'campo_extra' || b.visible === false) continue;
      const id = String(b.props?.id ?? '').trim();
      const label = String(b.props?.label ?? '').trim();
      if (!id || !label || vistos.has(id)) continue;   // sin nombre no se pide
      vistos.add(id);
      const tipo = String(b.props?.tipoCampo ?? 'texto') as TipoExtra;
      out.push({
        id, label,
        tipo: (TIPOS_EXTRA.some(t => t.v === tipo) ? tipo : 'texto'),
        requerido: b.props?.requerido === true,
        placeholder: String(b.props?.placeholder ?? '') || undefined,
        opciones: Array.isArray(b.props?.opciones) ? b.props.opciones.filter((o: any) => String(o).trim()) : [],
      });
    }
    return out;
  }
  const c = (cfg && typeof cfg === 'object') ? cfg : {};
  return Array.isArray(c.camposExtra) ? c.camposExtra : [];
}

/** ¿El checkout tiene con qué vender? Lo que falte se dice en pantalla. */
export function problemasDelCheckout(bloques: BloqueCk[] | null | undefined): string[] {
  if (!bloques || !bloques.length) return [];
  const vivos = bloques.filter(b => b.visible !== false);
  const p: string[] = [];
  if (!vivos.some(b => b.tipo === 'boton')) p.push('No hay botón: el cliente no tiene cómo enviar el pedido.');
  if (!vivos.some(b => b.tipo === 'variantes')) p.push('No está el bloque de color y talla: el pedido llega sin saber qué enviar.');
  const puestos = camposDelCheckout(bloques).map(c => c.id);
  const faltan = (['nombre', 'whatsapp', 'direccion', 'departamento', 'municipio'] as CampoPedido[]).filter(c => !puestos.includes(c));
  if (faltan.length) p.push(`Faltan datos para poder despachar: ${faltan.join(', ')}.`);
  const sinNombre = bloques.filter(b => b.tipo === 'campo_extra' && b.visible !== false && !String(b.props?.label ?? '').trim()).length;
  if (sinNombre) p.push(`Hay ${sinNombre} campo(s) propio(s) sin nombre: no se le muestran al cliente.`);
  return p;
}

/**
 * LOS NÚMEROS DEL RESUMEN. Salen del producto elegido, nunca de un texto.
 * `envio` es una ETIQUETA que escribe el dueño (ej. "GRATIS"); no suma ni resta,
 * porque hoy el sistema no cobra envío. Si algún día lo cobra, se suma aquí.
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
    precio, precioAntes: antes,
    envio: envioTxt || null,
    total: precio,           // el total es el precio del producto: no se edita
  };
}

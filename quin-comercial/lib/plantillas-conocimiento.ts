// =====================================================
// PLANTILLAS DE CONOCIMIENTO (biblioteca reutilizable)
// Un "cerebro" completo para un tipo de producto, en BLOQUES (estilo premium):
// [IDENTIDAD], [FLUJO], [OBJECIONES], [EJEMPLOS], [CIERRE]… Los modelos obedecen
// mucho mejor cuando el prompt está delimitado por bloques.
// La mecánica de venta queda fija; lo específico del producto (nombre, tela,
// precios, tallas, cuentas de pago) son campos {{...}} que se llenan al aplicar
// la plantilla al bot de un cliente. Estas semillas se cargan solas la primera
// vez (ver /api/plantillas-conocimiento).
// =====================================================

export interface CampoPlantilla {
  clave: string;        // aparece en el contenido como {{CLAVE}}
  etiqueta: string;     // nombre bonito para el formulario
  ejemplo?: string;     // valor de ejemplo (pre-llenado / default)
  multilinea?: boolean; // textarea en vez de input
  pregunta?: string;    // cómo se lo pregunta el Asistente Quino al cliente
  esencial?: boolean;   // el asistente SOLO pregunta los esenciales; el resto usa el ejemplo
}

export interface PlantillaSeed {
  nombre: string;
  descripcion: string;
  contenido: string;
  campos: CampoPlantilla[];
}

// Detecta los campos {{ASI}} dentro de un texto (para el formulario y el editor).
export function detectarCampos(contenido: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contenido)) !== null) set.add(m[1]);
  return [...set];
}

// Reemplaza {{CAMPO}} por su valor. Si falta un valor, deja el campo visible
// entre corchetes para que se note que hay que llenarlo.
export function aplicarValores(contenido: string, valores: Record<string, string>): string {
  return contenido.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_full, clave) => {
    const v = valores[clave];
    return v && v.trim() ? v : `[${clave}]`;
  });
}

// Estimación de tokens (aprox.): en español ~4 caracteres por token. Es una guía,
// no un número exacto. Sirve para el semáforo del editor.
export function estimarTokens(texto: string): number {
  return Math.max(1, Math.round((texto || '').length / 4));
}

// Semáforo para el entrenamiento COMPLETO (se envía en cada mensaje).
// Como no usamos RAG, el cerebro entero viaja siempre → umbrales realistas.
export function semaforoTokens(tokens: number): { color: string; texto: string } {
  if (tokens < 1500) return { color: '#00A89D', texto: 'liviano' };
  if (tokens < 2500) return { color: '#D97706', texto: 'medio' };
  return { color: '#DC2626', texto: 'pesado — conviene recortar' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Semilla #1: Ropa / prendas con pago CONTRA ENTREGA (base: bot de buzos).
// Sirve para camisetas, buzos, hoodies, gorras, etc. Solo cambian los campos.
// ─────────────────────────────────────────────────────────────────────────────
const PRENDAS_CONTRAENTREGA: PlantillaSeed = {
  nombre: 'Ropa / prendas — pago contra entrega',
  descripcion: 'Cerebro de venta premium (en bloques) para prendas con pago contra entrega en Colombia: identidad, método de venta, objeciones, ejemplos y mecánica de abono para recogida en oficina. Solo llena los datos de tu producto.',
  contenido: `[IDENTIDAD]
Eres {{ASESOR}}, asesor(a) de ventas de {{MARCA}} ({{DESCRIPCION_EMPRESA}}). Tu misión es ayudar al cliente a elegir y CERRAR la compra de {{PRODUCTO_PLURAL}} por WhatsApp.

[TONO]
Cercano, amable y seguro. Tuteas al cliente. Español colombiano natural, ni muy formal ni muy informal. Máximo 1 emoji por mensaje. Respuestas breves (2 a 4 líneas).

[OBJETIVO]
Prioridad 1: cerrar la venta. 2: tomar los datos del pedido. 3: resolver dudas. Nunca dejes una conversación sin un siguiente paso claro.

[FLUJO DE VENTA]
1. Saluda cálido y pregunta qué está buscando.
2. Detecta la necesidad con 1-2 preguntas (talla, color, para qué/para quién).
3. Recomienda 1-2 opciones concretas con su beneficio (no abrumes con todo el catálogo).
4. Maneja las objeciones (ver [OBJECIONES]).
5. Cierra: propón la compra directo — "¿te la aparto y pagas cuando la recibes?".
6. Toma los datos: nombre y apellido, celular, dirección completa con barrio y ciudad, {{PRODUCTO}}/color y talla.
7. Confirma el resumen del pedido y despídete dejando la puerta abierta.

[REGLAS]
- SIEMPRE que detectes interés, propón el cierre; no esperes pasivo.
- SIEMPRE confirma precio y disponibilidad antes de cerrar.
- El pago es CONTRA ENTREGA: el cliente paga al recibir.
- NUNCA inventes precios, tallas, stock ni promociones. Si no lo sabes, dilo o pásalo a un asesor.
- NUNCA hables de temas ajenos al negocio.
- No confirmes pedidos manualmente: el sistema lo hace cuando el cliente dice CONFIRMO.
- No compartas datos de pedidos de otros clientes.

[PRODUCTO]
Vendemos {{PRODUCTO_PLURAL}}: {{DESCRIPCION_PRODUCTO}}.
Material/tela: {{MATERIAL}}. Tallas: {{TALLAS}}. Colores/variantes: {{COLORES}}.

[PRECIOS]
{{PRECIOS}}

[ENVÍO]
Cobertura: {{COBERTURA}}. Modalidad: pago CONTRA ENTREGA (debe haber alguien en la dirección). Tiempos: {{TIEMPOS_ENTREGA}}. Municipios sin contra entrega: {{MUNICIPIOS_SIN_COBERTURA}}.

[PAGO Y ABONO]
Formas de pago: contra entrega; Nequi {{CUENTA_NEQUI}}; Bancolombia {{CUENTA_BANCOLOMBIA}}; Llave/Transfiya {{LLAVE}}.
- A domicilio: contra entrega, SIN abono (lo estándar).
- Recogida en oficina de la transportadora: SÍ se puede, pero requiere un abono de {{ABONO_MONTO}} que se descuenta del total. NUNCA digas que no se puede recoger en oficina. No la ofrezcas por iniciativa propia; solo si el cliente pregunta o no tiene dirección. Si objeta el abono: sé empático pero firme (es política de despacho, son solo {{ABONO_MONTO}} que se descuentan) y ofrécele el domicilio contra entrega. Si acepta, dale las cuentas, pide el comprobante por el chat y etiqueta "PENDIENTE DE ABONO".

[OBJECIONES]
- "Está caro" → resalta el valor/calidad y la facilidad del contra entrega (pagas al recibir); menciona si hay precio especial hoy.
- "Lo voy a pensar" → pregunta qué duda tiene y recuérdale que hay unidades limitadas.
- "¿Es seguro?" → pago contra entrega, solo pagas cuando lo tienes en la mano. {{GARANTIA}}
- "No sé mi talla" → {{GUIA_TALLAS}}

[EJEMPLOS]
Cliente: hola tienen {{PRODUCTO_PLURAL}}?
{{ASESOR}}: ¡Hola! 😊 Claro que sí. ¿Es para ti o para regalo, y qué talla usas?
Cliente: para mí, uso M
{{ASESOR}}: Perfecto. Te queda genial en talla M. Sale a {{PRECIO_EJEMPLO}} con envío gratis y pagas al recibir. ¿Te la aparto?
Cliente: está caro
{{ASESOR}}: Te entiendo 🙌 pero es de muy buena calidad y pagas solo cuando la tienes en la mano, sin riesgo. Hoy además tenemos precio especial. ¿La dejamos apartada?

[ESCALAMIENTO]
Si el cliente pide un humano, hay un reclamo, o no puedes resolver tras 2 intentos → responde "Te comunico con un asesor 🙌", marca la conversación como HUMANO y no sigas respondiendo en ese chat.

[CIERRE Y DATOS]
Al cerrar pide: nombre y apellido, celular, dirección completa con barrio y ciudad, {{PRODUCTO}}/color y talla. Confirma el resumen. Cuando el cliente diga CONFIRMO, el sistema lo procesa solo; tú solo responde que su pedido quedó confirmado y se despacha en las próximas 24 horas.

[PERSONALIZADOS / OTRAS REFERENCIAS]
{{CONTACTO_OTROS}}`,
  campos: [
    { clave: 'ASESOR', etiqueta: 'Nombre del asesor virtual', ejemplo: 'Camila', esencial: true, pregunta: 'Primero, ¿cómo quieres que se llame tu asesor virtual? (ej: Camila)' },
    { clave: 'MARCA', etiqueta: 'Nombre de la marca / empresa', ejemplo: 'KADEX', esencial: true, pregunta: '¿Cómo se llama tu marca o empresa?' },
    { clave: 'DESCRIPCION_EMPRESA', etiqueta: 'Descripción corta de la empresa', ejemplo: 'marca colombiana de camisetas estampadas', esencial: true, pregunta: 'En una frase, ¿qué es tu negocio? (ej: marca colombiana de camisetas estampadas)' },
    { clave: 'PRODUCTO', etiqueta: 'Producto (singular)', ejemplo: 'camiseta', esencial: true, pregunta: '¿Qué vendes? Dímelo en singular (ej: camiseta)' },
    { clave: 'PRODUCTO_PLURAL', etiqueta: 'Producto (plural)', ejemplo: 'camisetas', esencial: true, pregunta: '¿Y cómo lo dices en plural? (ej: camisetas)' },
    { clave: 'DESCRIPCION_PRODUCTO', etiqueta: 'Descripción del producto', ejemplo: 'camisetas estampadas en tendencia, para hombre', multilinea: true, esencial: true, pregunta: 'Descríbeme tu producto en pocas palabras (ej: camisetas estampadas en tendencia, para hombre)' },
    { clave: 'MATERIAL', etiqueta: 'Material / tela', ejemplo: 'algodón de alta calidad, suave y fresco', esencial: true, pregunta: '¿De qué material o tela es?' },
    { clave: 'TALLAS', etiqueta: 'Tallas disponibles', ejemplo: 'XS, S, M, L, XL (hombre)', esencial: true, pregunta: '¿Qué tallas manejas? (puedes escribirlo como quieras, ej: de la S a la XL, hombre)' },
    { clave: 'COLORES', etiqueta: 'Colores / variantes', ejemplo: 'según el diseño disponible', esencial: false, pregunta: '¿Qué colores o variantes tienes?' },
    { clave: 'PRECIOS', etiqueta: 'Precios (una línea por cantidad)', ejemplo: '- 1 unidad → $95.000\n- 2 unidades → $150.000\n- 3 unidades → $210.000\nEnvío GRATIS.', multilinea: true, esencial: true, pregunta: '¿Cuáles son tus precios? Escríbelo como quieras (ej: 1 en 95, 2 en 150, 3 en 210, envío gratis)' },
    { clave: 'PRECIO_EJEMPLO', etiqueta: 'Precio de ejemplo (para el diálogo)', ejemplo: '$95.000', esencial: false, pregunta: 'Un precio de ejemplo para los diálogos (ej: $95.000)' },
    { clave: 'COBERTURA', etiqueta: 'Cobertura de envío', ejemplo: 'todo Colombia', esencial: false, pregunta: '¿A dónde envías? (ej: todo Colombia)' },
    { clave: 'TIEMPOS_ENTREGA', etiqueta: 'Tiempos de entrega', ejemplo: 'entre 3 y 6 días hábiles según el municipio', esencial: false, pregunta: '¿Cuánto se demora la entrega?' },
    { clave: 'MUNICIPIOS_SIN_COBERTURA', etiqueta: 'Municipios sin contra entrega', ejemplo: 'ninguno (contra entrega en todo el país)', esencial: false, pregunta: '¿Hay zonas donde NO haces contra entrega? Si no, escribe "ninguno".' },
    { clave: 'CUENTA_NEQUI', etiqueta: 'Cuenta Nequi (número + nombre)', ejemplo: '3000000000 — (titular)', esencial: true, pregunta: '¿Cuál es tu Nequi para pagos y abonos? (número y nombre del titular)' },
    { clave: 'CUENTA_BANCOLOMBIA', etiqueta: 'Cuenta Bancolombia', ejemplo: 'Ahorros 000-000000-00 — (titular)', esencial: false, pregunta: '¿Tienes cuenta Bancolombia? (si no, sáltala)' },
    { clave: 'LLAVE', etiqueta: 'Llave / Transfiya', ejemplo: '3000000000', esencial: false, pregunta: '¿Tienes Llave/Transfiya? (si no, sáltala)' },
    { clave: 'ABONO_MONTO', etiqueta: 'Monto del abono para oficina', ejemplo: '$5.000', esencial: true, pregunta: 'Para recogida en oficina, ¿de cuánto es el abono? (ej: $5.000)' },
    { clave: 'GUIA_TALLAS', etiqueta: 'Guía de tallas (qué responder)', ejemplo: 'pregúntale qué talla usa normalmente; la horma es nacional estándar.', multilinea: true, esencial: false, pregunta: 'Si un cliente no sabe su talla, ¿qué le dirías?' },
    { clave: 'GARANTIA', etiqueta: 'Garantía', ejemplo: 'Garantía por defectos de fábrica o problemas de talla; se gestiona el cambio.', multilinea: true, esencial: true, pregunta: '¿Qué garantía ofreces?' },
    { clave: 'CONTACTO_OTROS', etiqueta: 'Qué hacer con personalizados / otras referencias', ejemplo: 'Si preguntan por personalizados o algo fuera del catálogo, dile que lo pasarás con un asesor.', multilinea: true, esencial: false, pregunta: '¿Qué hago si preguntan por algo fuera del catálogo o personalizado?' },
  ],
};

export const PLANTILLAS_SEED: PlantillaSeed[] = [PRENDAS_CONTRAENTREGA];

/**
 * Equipo de VENDEDORES (supervisión, no venta).
 *
 * Estos números NO son clientes: cuando escriben, el bot actúa como *supervisor*
 * de ventas (no les vende). Se les pregunta cuántas ventas llevan y se arma un
 * ranking. Ver: interceptación en el webhook y el cron de check-ins.
 */

export interface Vendedor { telefono: string; nombre: string; apodo?: string; genero?: 'F' | 'M'; }

/** Trato para el prompt: 'mujer' | 'hombre' | 'desconocido'. */
export function generoDe(v: Vendedor | null | undefined): 'mujer' | 'hombre' | 'desconocido' {
  if (v?.genero === 'F') return 'mujer';
  if (v?.genero === 'M') return 'hombre';
  return 'desconocido';
}

/** Nombre con el que QUINO le habla al vendedor (apodo si tiene, si no el primer nombre). */
export function nombreChat(v: Vendedor): string {
  return v.apodo || v.nombre.split(' ')[0];
}

/** Los 13 vendedores. `telefono` en formato 57 + 10 dígitos (como llega en Meta). */
export const VENDEDORES: Vendedor[] = [
  { telefono: '573169694859', nombre: 'Yamile León',          genero: 'F' },
  { telefono: '573169894776', nombre: 'César Aponte',         genero: 'M' },
  { telefono: '573214368273', nombre: 'Juan Manuel Sánchez', apodo: 'Juanma', genero: 'M' },
  { telefono: '573022307310', nombre: 'Lusy Quintero',        genero: 'F' },
  { telefono: '573189993455', nombre: 'Marisol',              genero: 'F' },
  { telefono: '573015967381', nombre: 'Nini Johana',          genero: 'F' },
  { telefono: '573112812655', nombre: 'Heidy Meneses',        genero: 'F' },
  { telefono: '573243675403', nombre: 'Erika Sánchez',        genero: 'F' },
  { telefono: '573025996238', nombre: 'Vanesa Meneses',       genero: 'F' },
  { telefono: '573184215090', nombre: 'Isaac Salazar',        genero: 'M' },
  { telefono: '573012022692', nombre: 'Santander Delgado',    genero: 'M' },
  { telefono: '573337074433', nombre: 'Jeiner Sánchez',       genero: 'M' },
  { telefono: '573017057764', nombre: 'Mayra Rojas',          genero: 'F' },
];

/** Normaliza cualquier número a 57 + 10 dígitos. */
export function normalizarTel(t: string | null | undefined): string {
  const d = String(t ?? '').replace(/\D/g, '');
  const diez = d.slice(-10);
  return diez.length === 10 ? `57${diez}` : d;
}

const MAPA = new Map(VENDEDORES.map(v => [v.telefono, v]));

/** ¿Este número es de un vendedor del equipo? */
export function esVendedor(telefono: string | null | undefined): boolean {
  return MAPA.has(normalizarTel(telefono));
}

/** Devuelve el vendedor por número, o null. */
export function vendedorDe(telefono: string | null | undefined): Vendedor | null {
  return MAPA.get(normalizarTel(telefono)) ?? null;
}

/**
 * Extrae el número de ventas de un mensaje del vendedor.
 * Entiende: "5", "llevo 5", "voy en 5 ventas", "cero", "ninguna", "5 hasta ahora".
 * Devuelve null si no logra entender un número (para pedirle que lo aclare).
 */
export function extraerVentas(texto: string): number | null {
  const t = String(texto ?? '').toLowerCase().trim();
  if (!t) return null;
  // Palabras que significan cero
  if (/\b(cero|ninguna|ninguno|nada|0)\b/.test(t) && !/\d\d/.test(t)) {
    // "0" o palabras de cero (evita confundir con "10" -> tiene doble dígito)
    if (/\b0\b/.test(t) || /\b(cero|ninguna|ninguno|nada)\b/.test(t)) return 0;
  }
  // Número escrito en dígitos (toma el primero razonable 0–999)
  const m = t.match(/\b(\d{1,3})\b/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 0 && n <= 999) return n;
  }
  // Números en palabras (1–20) por si acaso
  const palabras: Record<string, number> = {
    una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
    ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14,
    quince: 15, dieciseis: 16, dieciséis: 16, diecisiete: 17, dieciocho: 18,
    diecinueve: 19, veinte: 20,
  };
  for (const [p, n] of Object.entries(palabras)) {
    if (new RegExp(`\\b${p}\\b`).test(t)) return n;
  }
  return null;
}

/**
 * Tips diarios basados en LIBROS DE VENTAS famosos — uno por día (rota por fecha).
 * Cada uno trae el principio, su fuente y cómo aplicarlo por WhatsApp, para que
 * el equipo aprenda a vender de los mejores.
 */
export const TIPS_VENTAS: string[] = [
  'Reciprocidad: da algo primero (un consejo, una foto extra, un detalle) y el cliente sentirá que debe corresponder comprando. — *Influencia*, Robert Cialdini 🤝',
  'Escasez: la gente valora más lo que se puede acabar. "Quedan pocas de ese color" mueve la decisión. — *Influencia*, Cialdini ⏳',
  'Prueba social: "es de los más pedidos, muchas clientas ya lo tienen". Si otros compran, da confianza. — *Influencia*, Cialdini 👥',
  'La gente compra por EMOCIÓN y lo justifica con lógica. Véndeles primero cómo se van a ver y sentir. — Zig Ziglar 💓',
  'Puedes tener todo lo que quieras si ayudas a suficientes personas a tener lo que quieren. Sirve, no presiones. — Zig Ziglar 🌟',
  'Todo cierre empieza por creer TÚ en el producto. Si tú dudas, el cliente lo siente. — *Sell or Be Sold*, Grant Cardone 🔥',
  'Insiste con cariño: la mayoría de ventas se cierra después de varios "no". El seguimiento es oro. — Grant Cardone 🔁',
  'Domina el tono: un audio cálido y seguro vende más que 10 textos fríos. — *El método Lobo de Wall Street*, Jordan Belfort 🎙️',
  'Lleva la charla en línea recta al cierre: cada mensaje debe acercar al "sí", sin desviarse. — *Way of the Wolf*, Jordan Belfort ➡️',
  'Interésate DE VERDAD en el cliente: pregunta y escucha. A la gente le encanta que la entiendan. — Dale Carnegie 👂',
  'El sonido más dulce para alguien es su propio nombre. Úsalo en cada mensaje. — *Cómo ganar amigos*, Dale Carnegie 🙌',
  'No discutas la objeción: dale la razón y guía. "Tienes razón que es una inversión, por eso dura años". — Dale Carnegie 🧠',
  'Pregunta antes de ofrecer: descubre la NECESIDAD real (¿para ti, para regalo, para qué ocasión?). — *SPIN Selling*, Neil Rackham 🔎',
  'Haz que el cliente vea el problema de NO comprar: "sin abrigo bueno, el frío te gana". — *SPIN Selling*, Rackham ❄️',
  'El 80% de la venta es escuchar y el 20% hablar. Deja que el cliente se convenza solo. — Brian Tracy 👂',
  'Vende el resultado, no el producto: no es un buzo, es verse premium y abrigado. — *Psicología de ventas*, Brian Tracy ✨',
  'Repite las últimas palabras del cliente (efecto espejo): siente que lo entiendes y se abre. — *Rompe la barrera del no*, Chris Voss 🪞',
  'Un "no" no es el final: pregunta "¿qué te haría decir que sí?". — Chris Voss 🔑',
  'Etiqueta la emoción: "parece que te preocupa la talla, tranquilo, te ayudo a elegir". — Chris Voss 🎯',
  'Vender es servir: hoy todos vendemos. Ayuda genuinamente y el cierre llega. — *Vender es humano*, Daniel Pink 🌍',
  'Claridad vende: dile al cliente EXACTAMENTE el siguiente paso ("mándame tu talla y dirección"). — Daniel Pink 📍',
  'La gente no compra por razones lógicas, compra por razones emocionales. Conecta primero. — Jeffrey Gitomer ❤️',
  'A la gente le encanta comprar, pero odia que le vendan. Guía, no empujes. — *Little Red Book of Selling*, Gitomer 🚦',
  'Persiste con fe: "Persistiré hasta triunfar". Cada intento te acerca al sí. — *El vendedor más grande del mundo*, Og Mandino 💪',
  'Trata cada chat como si fuera tu última venta del día: con toda la energía. — Og Mandino ⚡',
  'Ofrece opciones cerradas: "¿te lo despacho hoy o mañana?" — no "¿lo quieres?". El cierre asumido vende. — Brian Tracy ✅',
  'Sube el ticket con el pack: "por poquito más te llevas dos". Anclaje de precio. — Cialdini + Cardone 📦',
  'Compromiso y coherencia: si el cliente dice "me gusta", recuérdaselo al cerrar. — *Influencia*, Cialdini 🔗',
  'Autoridad: habla con seguridad de la calidad, tela y garantía. El experto vende. — *Influencia*, Cialdini 🎓',
  'Responde rápido: la venta se enfría en minutos. El primero en contestar suele cerrar. — Grant Cardone ⚡',
  'Cierra siempre con una pregunta que avance: "¿confirmo tu pedido para despacharlo hoy?" — Zig Ziglar 🚀',
];

/** Tip del día (rota por fecha). */
export function tipDelDia(fecha = new Date()): string {
  const inicio = new Date(fecha.getFullYear(), 0, 0);
  const dia = Math.floor((fecha.getTime() - inicio.getTime()) / 86_400_000);
  return TIPS_VENTAS[dia % TIPS_VENTAS.length];
}

// ── Incentivo ────────────────────────────────────────────────────────────────
/** Límite de promedio de respuesta para ganar el incentivo: 1h 30m (en segundos). */
export const LIMITE_INCENTIVO_SEG = 90 * 60;
/** Días de cada periodo de nómina. */
export const DIAS_NOMINA = 10;
/** Fecha en que ARRANCA el concurso (antes es solo prueba, no cuenta). YYYY-MM-DD. */
export const CONCURSO_INICIO = '2026-07-27'; // lunes

// ── Marca de mensaje CRONOMETRADO ────────────────────────────────────────────
// Los vendedores creían que debían responder TODO mensaje para no dañar su tiempo
// de respuesta. En realidad SOLO cuenta el check-in de cada corte. Estas marcas
// se lo dejan claro: el ⏱️ señala el único mensaje que corre el reloj.
export const CRONO_HEADER = '⏱️ *MENSAJE CRONOMETRADO* ⏱️';
export const CRONO_NOTA =
  '🔔 _Ojo: este ⏱️ es el *único* mensaje que cuenta para tu tiempo de respuesta. ' +
  'Los demás mensajes NO afectan tu promedio, así que escríbeme con calma cuando quieras. ' +
  'Solo cuando veas el ⏱️ conviene responder rapidito._';
/** Envuelve un check-in con el encabezado de reloj arriba y la nota abajo. */
export function envolverCronometrado(cuerpo: string): string {
  return `${CRONO_HEADER}\n\n${cuerpo}\n\n${CRONO_NOTA}`;
}

/** Mensaje de cierre de fin de semana (sábado/domingo a las 2pm). */
export function mensajeFinDeSemana(nombre: string): string {
  const n = nombre.split(' ')[0];
  return (
    `¡Que tengas un excelente fin de semana, ${n}! 🎉☀️\n\n` +
    `Vende mucho 💪 y recuerda: entre *más ventas* cierres y *más bajo* el costo de tus campañas, *más altas* tus comisiones. 💰\n\n` +
    `El *lunes a las 8:00 a.m.* reiniciamos el conteo de ventas. Descansa y nos vemos con toda. 🚀`
  );
}

/** Primer mensaje: el bot se presenta y explica el incentivo. */
export function mensajePresentacion(nombre: string): string {
  const n = nombre.split(' ')[0];
  return (
    `¡Hola, ${n}! 👋 Soy *QUINO*, tu asistente de supervisión de ventas de Klixmant 🤖✨\n\n` +
    `Desde hoy te acompaño cada día para ayudarte a vender más:\n\n` +
    `📊 Cada 2 horas (8am–7pm) te preguntaré cuántas ventas llevas.\n` +
    `💡 Cada mañana te comparto un *tip de ventas* de los mejores libros del mundo (Cialdini, Zig Ziglar, Cardone, Carnegie…).\n` +
    `🏆 Verás tu posición en el ranking del equipo.\n\n` +
    `👉 Cuando te pregunte, respóndeme *solo con el número* (ej: 5). Si aún no cierras ninguna, escribe 0.\n\n` +
    `🎁 *Incentivo:* quien mantenga un *promedio de respuesta menor a 1 hora y 30 minutos* durante el periodo de nómina (cada 10 días) se gana un *5% de descuento en el costo de sus campañas* 💰.\n\n` +
    `⏱️ *IMPORTANTE — así funciona el tiempo de respuesta:*\n` +
    `Solo cuenta el mensaje que te llegue marcado con ⏱️ *MENSAJE CRONOMETRADO* (el corte de cada 2 horas). El reloj corre desde que te lo envío hasta que me respondes.\n` +
    `👉 Los *demás* mensajes NO afectan tu promedio: puedes escribirme con toda calma. Solo apúrate cuando veas el ⏱️.\n\n` +
    `Para empezar: ¿con cuántas ventas cerraste *ayer*? Respóndeme el número 🙌`
  );
}

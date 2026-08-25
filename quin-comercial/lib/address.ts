/**
 * Utilidades de validación de direcciones colombianas.
 * Usadas en los webhooks de Funnelish y WhatsApp.
 */

/** Devuelve true si la dirección es completa y válida para envío */
export function isCompleteAddress(addr: string | null | undefined): boolean {
  if (!addr || addr.trim() === '' || addr === '—') return false;
  const a = addr.toLowerCase().trim();
  if (a.length < 5) return false;

  // Prefijos de vía + abreviaturas comunes en Colombia (kra, cra, cll, dg, tv, mz…)
  // Sin \b final: la vía puede ir pegada al número ("Calle27A", "Cra44C")
  const VIA = String.raw`(?:calle|carrera|diagonal|transversal|avenida|autopista|manzana|clle|cll|cl|carr|cra|cr|kra|krra|kr|diag|dg|av|ave|tv|trans|mz)`;

  // Vía + número (puede llevar letra, ej "44C") + # o - + número
  if (new RegExp(String.raw`\b${VIA}\s*\d+\s*[a-z]?\s*[#\-]\s*\d`).test(a)) return true;

  // Formato sin # ni -: "Carrera 21 152 30" (3 números separados por espacio)
  if (new RegExp(String.raw`\b${VIA}\s*\d+\s*[a-z]?\s+\d+\s+\d+`).test(a)) return true;

  // Manzana + Casa
  if (/\b(manzana|mz\.?)\b.{0,40}\b(casa|cs\.?)\b/.test(a)) return true;

  // Conjunto + Casa o Apartamento
  if (/\b(conjunto|conj\.?)\b.{0,60}\b(casa|cs\.?|apartamento|apto\.?|apt\.?)\b/.test(a)) return true;

  // Edificio + Apartamento
  if (/\b(edificio|edif\.?)\b.{0,40}\b(apartamento|apto\.?|apt\.?)\b/.test(a)) return true;

  // Vereda + Finca
  if (/\b(vereda|vda\.?)\b.{0,40}\b(finca)\b/.test(a)) return true;

  // Regla permisiva: vía + al menos 2 números → se considera completa.
  // Cubre "Calle 3B 11 - 5 sur", "Cra 44C 31 42", "Diag 5 10 20", etc.
  const numeros = (a.match(/\d+/g) ?? []).length;
  if (numeros >= 2 && new RegExp(String.raw`\b${VIA}\s*\d`).test(a)) return true;

  // También: manzana/conjunto/edificio/torre/apto + casa/número con 2 números
  if (numeros >= 2 && /\b(manzana|mz|conjunto|conj|edificio|edif|torre|apartamento|apto|apt|casa|lote|urbanizaci|barrio)\b/.test(a)) return true;

  return false;
}

/** True si la dirección es de recogida en oficina de transportadora */
export function isDirOficina(addr: string | null | undefined): boolean {
  if (!addr || addr.trim() === '' || addr === '—') return false;
  const a = addr.toLowerCase();
  return a.includes('interrapid') || a.includes('reclamo') || a.includes('reclamar')
    || (a.includes('oficina') && !isCompleteAddress(addr));
}

/** Elige un elemento al azar (para que el bot no repita SIEMPRE el mismo texto). */
function alAzar<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
/** Primer nombre limpio (o vacío) para personalizar los mensajes. */
function primerNombre(nombre?: string | null): string {
  const n = String(nombre ?? '').trim().split(/\s+/)[0] || '';
  return /^[a-záéíóúñ]+$/i.test(n) ? n.charAt(0).toUpperCase() + n.slice(1) : '';
}

// ── Variantes de la pregunta de dirección (se elige una al azar) ─────────────
// SIN dirección todavía:
const Q_DIR_VACIA = [
  (n: string) => `📍 ${n ? n + ', p' : 'P'}ara enviarte el pedido necesito tu *dirección de envío completa* 🙏 Por ejemplo: *Calle 15 # 20-30, Barrio Los Pinos*.`,
  (n: string) => `📍 ¿Me pasas tu *dirección completa*${n ? `, ${n}` : ''}? Con barrio y número para que llegue sin vueltas 😊 Ej: *Carrera 8 # 12-34, Barrio Centro*.`,
  (n: string) => `📍 ¡Casi listo${n ? `, ${n}` : ''}! 🙌 Solo me falta tu *dirección completa* para el despacho. Ej: *Calle 5 # 10-20, Barrio San José*.`,
];
// Dirección CON texto pero sin número (vereda/urbanización) → confirmación suave:
const Q_DIR_INCOMPLETA = [
  (n: string) => `📍 ${n ? n + ', p' : 'P'}ara que tu pedido llegue sin problema, ¿me confirmas que la *dirección* ya está completa? Si le falta *barrio, torre o número de la casa*, agrégamelo 😊`,
  (n: string) => `📍 ¡Casi listo${n ? `, ${n}` : ''}! Quiero asegurarme de que tu *dirección* esté completa para que el domiciliario no se pierda. ¿La dejamos así o le agregas *barrio/número*? 🙌`,
  (n: string) => `📍 ${n ? n + ', ¿' : '¿'}tu *dirección* ya quedó completa? Si vives en *vereda o urbanización* y no tiene número, mándame un *punto de referencia* para el repartidor 🚚`,
];

/**
 * Devuelve la pregunta específica a hacer cuando la dirección está incompleta.
 * Retorna null si la dirección ya es válida. `nombre` personaliza el mensaje y
 * cada llamada elige una variante distinta (para no repetir el mismo texto).
 */
export function getAddressQuestion(addr: string | null | undefined, nombre?: string | null): string | null {
  if (isCompleteAddress(addr)) return null;
  const n = primerNombre(nombre);

  // RECOGIDA EN OFICINA: la dirección dice "Interrapidísimo/oficina/reclamar". No se
  // pide casa/torre; se le explica el ABONO de la oficina.
  if (isDirOficina(addr)) {
    return '📍 Veo que quieres *recoger en la oficina de Interrapidísimo* 😊\n\n'
      + 'Para el despacho a oficina se hace un *abono de $5.000* que se *descuenta del total* de tu pedido. '
      + 'Cuando lo hagas, me envías el *comprobante* por aquí 📷 y dejamos tu pedido listo para despacho. 🚚\n\n'
      + '¿Te paso los datos para el abono?';
  }

  // Sin dirección → pedir la dirección completa
  if (!addr || addr.trim() === '' || addr === '—' || addr.trim().length < 5) {
    return alAzar(Q_DIR_VACIA)(n);
  }

  // Tiene una dirección pero puede faltar detalle → confirmación suave (sin insistir de más)
  return alAzar(Q_DIR_INCOMPLETA)(n);
}

/**
 * True si un texto (normalmente el último mensaje del bot) es una PREGUNTA por la
 * dirección — cualquiera de las variantes, nuevas o viejas. Sirve para saber que,
 * si el cliente responde afirmando, ya contestó y no hay que volver a preguntar.
 */
export function esPreguntaDireccion(txt: string | null | undefined): boolean {
  const t = String(txt ?? '').toLowerCase();
  if (!t) return false;
  const mencionaDir = t.includes('direcci');
  if (!mencionaDir) return false;
  return /complet|correct|barrio|torre|n[uú]mero de la casa|punto de referencia|domiciliario|recibo de luz|calle \d+ #|env[íi]o|despacho/.test(t);
}

// ── Preguntas repetitivas del bot con variantes (talla y confirmación final) ──
const Q_TALLA = [
  (n: string) => `📋 ${n ? n + ', ¿' : '¿'}me confirmas la *talla* del buzo? (XS, S, M, L, XL, XXL, XXXL)`,
  (n: string) => `👕 ¿Qué *talla* usas${n ? `, ${n}` : ''}? Tenemos XS, S, M, L, XL, XXL y XXXL.`,
  (n: string) => `📏 Para dejar tu pedido listo${n ? `, ${n},` : ''} dime tu *talla*: XS, S, M, L, XL, XXL o XXXL 😊`,
];
/** Pregunta la talla, personalizada y variada. */
export function preguntaTalla(nombre?: string | null): string {
  return alAzar(Q_TALLA)(primerNombre(nombre));
}

const Q_CONFIRMAR = [
  (n: string) => `¿Me confirmas que está *todo correcto* para procesar tu despacho${n ? `, ${n}` : ''}? 😊🚚`,
  (n: string) => `${n ? n + ', ¿' : '¿'}confirmamos el pedido tal cual para enviártelo? 🚚 Responde *sí* y lo dejo en camino.`,
  (n: string) => `¿Todo bien con tu pedido${n ? `, ${n}` : ''}? Si está correcto, dime *sí* y lo despacho 🙌`,
];
/** Pregunta de confirmación final, personalizada y variada. */
export function preguntaConfirmarTodo(nombre?: string | null): string {
  return alAzar(Q_CONFIRMAR)(primerNombre(nombre));
}

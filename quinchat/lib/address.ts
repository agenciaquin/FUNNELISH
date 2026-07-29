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

/**
 * Devuelve la pregunta específica a hacer cuando la dirección está incompleta.
 * Retorna null si la dirección ya es válida.
 */
export function getAddressQuestion(addr: string | null | undefined): string | null {
  if (isCompleteAddress(addr)) return null;

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
    return '📍 Para completar tu pedido necesito tu *dirección de envío completa*. Por ejemplo: *Calle 15 # 20-30, Barrio Los Pinos*.';
  }

  // Tiene una dirección pero puede faltar detalle → confirmación suave (sin insistir de más)
  return '📍 ¿Me confirmas si tu dirección está correcta y completa? Si le falta *torre, apartamento, número de casa o barrio*, por favor agrégalo para que el envío llegue sin problema. 😊';
}

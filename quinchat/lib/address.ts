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
  const VIA = String.raw`(?:calle|carrera|diagonal|transversal|avenida|autopista|manzana|clle|cll|cl|carr|cra|cr|kra|krra|kr|diag|dg|av|ave|tv|trans|mz)\b`;

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

  if (!addr || addr.trim() === '' || addr === '—') {
    return '📍 Para completar tu pedido necesito tu *dirección de envío completa*. Por ejemplo: *Calle 15 # 20-30 Barrio Los Pinos* o *Conjunto Arboleda, Casa 5*.';
  }

  const a = addr.toLowerCase().trim();

  // Calle sin número completo (solo "Calle 45")
  const calleMatch = a.match(/\b(calle|cl\.?|cll\.?)\s*(\d+)/);
  if (calleMatch && !/[#\-]\s*\d/.test(a)) {
    return `📍 ¿Podrías indicarme el número completo? Por ejemplo: *${calleMatch[1].charAt(0).toUpperCase() + calleMatch[1].slice(1)} ${calleMatch[2]} # 23-18*.`;
  }

  // Carrera sin número completo
  const craMatch = a.match(/\b(carrera|cra\.?|cr\.?|kr\.?)\s*(\d+)/);
  if (craMatch && !/[#\-]\s*\d/.test(a)) {
    return `📍 ¿Podrías indicarme el número completo? Por ejemplo: *Carrera ${craMatch[2]} # 15-42*.`;
  }

  // Avenida sin número completo
  const avMatch = a.match(/\b(avenida|av\.?)\s*(\d+)/);
  if (avMatch && !/[#\-]\s*\d/.test(a)) {
    return `📍 ¿Podrías indicarme el número de la dirección en la avenida? Por ejemplo: *Avenida ${avMatch[2]} # 23-15*.`;
  }

  // Diagonal sin número completo
  const diagMatch = a.match(/\b(diagonal|diag\.?)\s*(\d+)/);
  if (diagMatch && !/[#\-]\s*\d/.test(a)) {
    return `📍 ¿Podrías indicarme el número completo? Por ejemplo: *Diagonal ${diagMatch[2]} # 12-30*.`;
  }

  // Transversal sin número completo
  const transMatch = a.match(/\b(transversal)\s*(\d+)/);
  if (transMatch && !/[#\-]\s*\d/.test(a)) {
    return `📍 ¿Podrías indicarme el número completo? Por ejemplo: *Transversal ${transMatch[2]} # 45-20*.`;
  }

  // Solo conjunto sin casa/apto
  if (/\b(conjunto|conj\.?)\b/.test(a) && !/\b(casa|apartamento|apto\.?|apt\.?)\b/.test(a)) {
    return `📍 ¿Cuál es el número de *casa o apartamento* dentro del conjunto?`;
  }

  // Solo edificio sin apto
  if (/\b(edificio|edif\.?)\b/.test(a) && !/\b(apartamento|apto\.?|apt\.?)\b/.test(a)) {
    return `📍 ¿Qué apartamento o piso corresponde en el edificio?`;
  }

  // Solo torre sin apto
  if (/\btorre\b/.test(a) && !/\b(apartamento|apto\.?|apt\.?|casa)\b/.test(a)) {
    return `📍 ¿Cuál es el número del apartamento en la torre?`;
  }

  // Solo apartamento sin edificio/conjunto/calle
  if (/\b(apartamento|apto\.?|apt\.?)\b/.test(a) &&
      !/\b(edificio|conjunto|calle|carrera|avenida|diagonal|transversal)\b/.test(a)) {
    return `📍 ¿En qué edificio o conjunto se encuentra el apartamento?`;
  }

  // Solo casa sin conjunto/manzana/calle
  if (/\bcasa\b/.test(a) &&
      !/\b(conjunto|manzana|mz\.?|calle|carrera|avenida|diagonal|transversal)\b/.test(a)) {
    return `📍 ¿En qué conjunto, manzana o dirección está ubicada la casa?`;
  }

  // Solo manzana sin casa
  if (/\b(manzana|mz\.?)\b/.test(a) && !/\b(casa|cs\.?)\b/.test(a)) {
    return `📍 ¿Cuál es el número de la *casa* en esa manzana?`;
  }

  // Solo barrio sin vía
  if (/\bbarrio\b/.test(a) &&
      !/\b(calle|carrera|avenida|diagonal|transversal|conjunto|edificio)\b/.test(a)) {
    return `📍 ¿Cuál es la dirección exacta (calle, carrera, etc.) en ese barrio?`;
  }

  // Solo lote
  if (/\blote\b/.test(a)) {
    return `📍 ¿En qué urbanización o dirección está ubicado el lote?`;
  }

  // Genérico
  return `📍 Necesito tu dirección completa para el envío. Por ejemplo: *Calle 15 # 20-30 Barrio Los Pinos* o *Conjunto Arboleda, Casa 5*.`;
}

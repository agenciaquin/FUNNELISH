import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de la "línea" (número) que está atendiendo el mensaje actual.
 *
 * Un mismo sistema atiende dos números de WhatsApp (funnel y ventas). Cuando
 * llega un mensaje, se guarda aquí el phone_number_id por el que entró, para que
 * todas las respuestas salgan por ESE mismo número, sin mezclar.
 *
 * Usa AsyncLocalStorage: es seguro aunque lleguen varios mensajes a la vez.
 */
interface Linea {
  phoneId: string;      // phone_number_id de Meta por el que entró/sale
  tipo: 'funnel' | 'ventas';
}

const almacen = new AsyncLocalStorage<Linea>();

/** Corre `fn` con la línea activa fijada. */
export function conLinea<T>(linea: Linea, fn: () => T): T {
  return almacen.run(linea, fn);
}

/**
 * Fija la línea activa para el resto de esta petición (sin envolver todo el
 * código). Cada petición tiene su propio contexto async, así que no se mezclan.
 */
export function entrarLinea(linea: Linea): void {
  almacen.enterWith(linea);
}

/** phone_number_id activo; si no hay contexto, usa el del funnel (env). */
export function phoneIdActual(): string | undefined {
  return almacen.getStore()?.phoneId ?? process.env.WHATSAPP_PHONE_NUMBER_ID;
}

/** Tipo de línea activa: 'funnel' (por defecto) o 'ventas'. */
export function tipoLineaActual(): 'funnel' | 'ventas' {
  return almacen.getStore()?.tipo ?? 'funnel';
}

/** Decide el tipo de línea a partir del phone_number_id que reportó Meta. */
export function tipoDeLinea(phoneId: string | undefined | null): 'funnel' | 'ventas' {
  const ventas = process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS;
  return ventas && phoneId && phoneId === ventas ? 'ventas' : 'funnel';
}

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de la "línea" (número) que está atendiendo el mensaje actual.
 *
 * Un mismo sistema atiende varios números de WhatsApp. Cuando llega un mensaje,
 * se guarda aquí el phone_number_id por el que entró, para que todas las
 * respuestas salgan por ESE mismo número, sin mezclar.
 *
 * MULTI-TENANT: además del número, se guarda de qué EMPRESA (tenant) es el
 * mensaje y con qué token de WhatsApp responder. Así cada cliente usa SUS
 * propias credenciales sin necesidad de variables de entorno por cliente.
 *
 * Usa AsyncLocalStorage: es seguro aunque lleguen varios mensajes a la vez.
 */
export interface Linea {
  phoneId: string;          // phone_number_id de Meta por el que entró/sale
  tipo: 'funnel' | 'ventas';
  // ── Multi-tenant (opcionales; si faltan, se usa el entorno = modo single) ──
  accessToken?: string;     // token de WhatsApp del tenant dueño de la línea
  tenantId?: string;        // empresa (tenant) dueña de esta conversación
  phoneIdVentas?: string;   // línea de ventas del tenant (para distinguir tipo)
}

/** Datos base del tenant que se inyectan antes de procesar un webhook. */
export type BaseLinea = Partial<Pick<Linea, 'accessToken' | 'tenantId' | 'phoneId' | 'phoneIdVentas'>>;

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

/**
 * Token de WhatsApp activo. En multi-tenant es el del tenant dueño de la línea;
 * si no hay contexto de tenant, cae al token del entorno (modo single-tenant).
 */
export function tokenActual(): string | undefined {
  return almacen.getStore()?.accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN;
}

/** tenant_id (empresa) dueño de la conversación actual, o null si no aplica. */
export function tenantActualId(): string | null {
  return almacen.getStore()?.tenantId ?? null;
}

/** Tipo de línea activa: 'funnel' (por defecto) o 'ventas'. */
export function tipoLineaActual(): 'funnel' | 'ventas' {
  return almacen.getStore()?.tipo ?? 'funnel';
}

/**
 * Decide el tipo de línea a partir del phone_number_id que reportó Meta.
 * En multi-tenant se pasa el `ventasId` del tenant; si no, usa el del entorno.
 */
export function tipoDeLinea(
  phoneId: string | undefined | null,
  ventasId?: string | null,
): 'funnel' | 'ventas' {
  const ventas = ventasId ?? process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS;
  return ventas && phoneId && phoneId === ventas ? 'ventas' : 'funnel';
}

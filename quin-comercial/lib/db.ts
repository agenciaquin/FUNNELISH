import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Helpers de acceso a la BD **con aislamiento por empresa (tenant)**.
 *
 * La app usa la llave `service_role`, que IGNORA las políticas RLS. Por eso el
 * aislamiento entre clientes se garantiza EN CÓDIGO: toda consulta a una tabla
 * con columna `tenant_id` debe filtrar por `tenant_id`, y toda inserción debe
 * escribirlo. Estos helpers hacen que el filtro vaya SIEMPRE y sea fácil de auditar.
 *
 * Nota supabase-js: `.eq()` va DESPUÉS de `.select()/.update()/.delete()`, por eso
 * hay un helper por operación (no se puede pre-filtrar sobre `.from()`).
 *
 * Regla de oro: nunca operar "sin filtro". Si no hay tenant, la ruta rechaza.
 */

/** SELECT scoped: `sb.from(tabla).select(cols).eq('tenant_id', tid)`. Encadena más .eq/.order/… */
export function selectDelTenant(sb: SupabaseClient, tabla: string, tid: string, cols = '*') {
  return sb.from(tabla).select(cols).eq('tenant_id', tid);
}

/** UPDATE scoped: solo toca filas de ESTE tenant. Encadena más .eq('id', …) etc. */
export function updateDelTenant(
  sb: SupabaseClient,
  tabla: string,
  tid: string,
  valores: Record<string, unknown>,
) {
  return sb.from(tabla).update(valores).eq('tenant_id', tid);
}

/** DELETE scoped: solo borra filas de ESTE tenant. Encadena más .eq('id', …) etc. */
export function deleteDelTenant(sb: SupabaseClient, tabla: string, tid: string) {
  return sb.from(tabla).delete().eq('tenant_id', tid);
}

/** INSERT escribiendo el `tenant_id` en cada fila (una o varias). Encadena `.select()` si hace falta. */
export function insertarDelTenant<T extends Record<string, unknown>>(
  sb: SupabaseClient,
  tabla: string,
  tid: string,
  filas: T | T[],
) {
  const arr = (Array.isArray(filas) ? filas : [filas]).map((f) => ({ ...f, tenant_id: tid }));
  return sb.from(tabla).insert(arr);
}

/** UPSERT fijando el `tenant_id` en cada fila. */
export function upsertDelTenant<T extends Record<string, unknown>>(
  sb: SupabaseClient,
  tabla: string,
  tid: string,
  filas: T | T[],
  opciones?: { onConflict?: string },
) {
  const arr = (Array.isArray(filas) ? filas : [filas]).map((f) => ({ ...f, tenant_id: tid }));
  return sb.from(tabla).upsert(arr, opciones);
}

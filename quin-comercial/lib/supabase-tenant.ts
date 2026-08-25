import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Cliente Supabase que AÍSLA por empresa (tenant) automáticamente.
 *
 * El bot (webhook + ventas.ts) hace CIENTOS de consultas. En vez de repetir
 * `.eq('tenant_id', tid)` en cada una (y arriesgarse a olvidar alguna → fuga de
 * datos entre clientes), este cliente lo hace solo: para toda tabla con columna
 * `tenant_id`, cada `select/update/delete` filtra por el tenant y cada
 * `insert/upsert` lo escribe. Lo demás (`.storage`, etc.) pasa sin cambios.
 *
 * Uso: `const supabase = supabaseTenant(tid)` y se usa igual que el cliente normal.
 * Si no hay tenant (modo single-tenant/legacy), usar el cliente normal.
 */

const TABLAS_TENANT = new Set<string>([
  'clientes_funnelish', 'conversations', 'messages', 'funnels', 'catalogos_bot',
  'catalogo_colores', 'etiquetas', 'plantillas', 'disparadores', 'contactos',
  'memoria_bot', 'faq_bot', 'objeciones_analisis', 'vendedor_reportes',
  'vendedor_preguntas', 'campanas_gasto', 'effi_guias', 'ajustes', 'configuracion',
  'bot_config', 'push_subscriptions',
]);

function conTid(rows: any, tid: string) {
  return (Array.isArray(rows) ? rows : [rows]).map((r: any) => ({ ...r, tenant_id: tid }));
}

export function supabaseTenant(tid: string): ReturnType<typeof createServerSupabaseClient> {
  const sb = createServerSupabaseClient();

  return new Proxy(sb, {
    get(target: any, prop) {
      if (prop !== 'from') {
        const v = target[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      }
      // Interceptar .from(tabla)
      return (tabla: string) => {
        const qb: any = target.from(tabla);
        if (!TABLAS_TENANT.has(tabla)) return qb; // tabla global: sin filtro

        return new Proxy(qb, {
          get(qTarget: any, qProp) {
            switch (qProp) {
              case 'select':
                return (...args: any[]) =>
                  qTarget.select(...(args.length ? args : ['*'])).eq('tenant_id', tid);
              case 'update':
                return (vals: any, opts?: any) => qTarget.update(vals, opts).eq('tenant_id', tid);
              case 'delete':
                return (opts?: any) => qTarget.delete(opts).eq('tenant_id', tid);
              case 'insert':
                return (rows: any, opts?: any) => qTarget.insert(conTid(rows, tid), opts);
              case 'upsert':
                return (rows: any, opts?: any) => qTarget.upsert(conTid(rows, tid), opts);
              default: {
                const v = qTarget[qProp];
                return typeof v === 'function' ? v.bind(qTarget) : v;
              }
            }
          },
        });
      };
    },
  }) as ReturnType<typeof createServerSupabaseClient>;
}

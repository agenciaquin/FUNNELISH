import { createServerSupabaseClient } from '@/lib/supabase';
import { supabaseTenant } from '@/lib/supabase-tenant';
import { conLinea } from '@/lib/whatsapp-contexto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ejecuta una tarea (cron) POR CADA empresa (tenant) activa.
 *
 * Los cron procesan datos de todos los clientes y muchos envían WhatsApp. Para
 * no mezclar datos ni números, esta función recorre los tenants activos y corre
 * `fn` una vez por cada uno, DENTRO de su contexto:
 *  - `sb` es un cliente Supabase ya aislado a ese tenant (ver lib/supabase-tenant).
 *  - el contexto de "línea" queda fijado con las credenciales de WhatsApp del
 *    tenant, así todo `sendTextMessage`/plantilla sale por el número correcto.
 *
 * `fn` recibe (sb, tenant). Si un tenant falla, se registra y se sigue con el
 * siguiente (un error de un cliente no debe frenar a los demás).
 */
export interface TenantCron {
  id: string;
  slug: string;
  wa_access_token: string | null;
  wa_phone_number_id: string | null;
  wa_phone_number_id_ventas: string | null;
}

export async function porCadaTenant(
  fn: (sb: SupabaseClient, tenant: TenantCron) => Promise<void>,
): Promise<{ tenants: number; errores: number }> {
  const admin = createServerSupabaseClient();
  const { data: tenants, error } = await admin
    .from('tenants')
    .select('id, slug, wa_access_token, wa_phone_number_id, wa_phone_number_id_ventas')
    .eq('activo', true);

  if (error) {
    console.error('[cron] no se pudieron leer los tenants:', error.message);
    return { tenants: 0, errores: 1 };
  }

  let errores = 0;
  for (const t of (tenants ?? []) as TenantCron[]) {
    const sb = supabaseTenant(t.id);
    try {
      await conLinea(
        {
          phoneId: t.wa_phone_number_id ?? '',
          tipo: 'funnel',
          accessToken: t.wa_access_token ?? undefined,
          tenantId: t.id,
          phoneIdVentas: t.wa_phone_number_id_ventas ?? undefined,
        },
        () => fn(sb, t),
      );
    } catch (e) {
      errores++;
      console.error(`[cron] error procesando tenant ${t.slug} (${t.id}):`, e);
    }
  }

  return { tenants: (tenants ?? []).length, errores };
}

import { createServerSupabaseClient } from '@/lib/supabase';
import { supabaseTenant } from '@/lib/supabase-tenant';
import { conLinea } from '@/lib/whatsapp-contexto';
import { tenantActual } from '@/lib/tenant';
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
 *
 * `soloTenantId`: si se pasa, recorre SOLO esa empresa. Es lo que usan los crons
 * cuando los lanza alguien del panel con sesión (sin la clave): en esta app
 * cualquiera se registra y saca una sesión, y no debe poder lanzar la IA de
 * todos los clientes. Ver `alcanceCron`.
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
  soloTenantId?: string,
): Promise<{ tenants: number; errores: number }> {
  const admin = createServerSupabaseClient();
  let consulta = admin
    .from('tenants')
    .select('id, slug, wa_access_token, wa_phone_number_id, wa_phone_number_id_ventas')
    .eq('activo', true);
  if (soloTenantId) consulta = consulta.eq('id', soloTenantId);
  const { data: tenants, error } = await consulta;

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

/**
 * Sobre qué empresas corre un cron, según quién lo lanza:
 *  · con la clave (`claveOk`, CRON_SECRET correcto) → todas: `{}`.
 *  · sin clave pero con sesión del panel → SOLO la empresa de esa sesión.
 *  · sin clave y sin sesión con empresa → `null`: la ruta responde 401.
 * Tener sesión NUNCA da acceso a todas las empresas.
 */
export async function alcanceCron(claveOk: boolean): Promise<{ soloTenantId?: string } | null> {
  if (claveOk) return {};
  const tid = await tenantActual();
  return tid ? { soloTenantId: tid } : null;
}

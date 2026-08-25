import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActualId } from '@/lib/whatsapp-contexto';
import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Devuelve el tenant_id (empresa) del usuario logueado, o null si no hay sesión.
 * Se usa en las rutas del panel para filtrar TODO por empresa.
 */
export async function tenantActual(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    return (session as any)?.tenantId ?? null;
  } catch {
    return null;
  }
}

/**
 * Tenant activo, sin importar el contexto:
 *  - Bot / cron: viene del AsyncLocalStorage (lo fija el webhook o el loop de cron).
 *  - Panel: viene de la sesión del usuario logueado.
 * Devuelve null si no se puede determinar (en ese caso la ruta debe RECHAZAR,
 * nunca operar "sin filtro").
 *
 * En el flujo PÚBLICO (páginas de venta) el tenant NO sale de aquí: se deduce del
 * embudo (funnel.tenant_id) y se pasa explícito.
 */
export async function tenantActivo(): Promise<string | null> {
  return tenantActualId() ?? (await tenantActual());
}

export interface CredsWA {
  wa_access_token: string | null;
  wa_phone_number_id: string | null;
  wa_phone_number_id_ventas: string | null;
}

/**
 * Credenciales de WhatsApp del tenant. Se usan en las rutas del panel que envían
 * mensajes (send, send-media…) para fijar la LÍNEA correcta y que el envío salga
 * por el número del cliente, no por el número por defecto del entorno.
 */
export async function credsTenant(tid: string): Promise<CredsWA | null> {
  const admin = createServerSupabaseClient();
  const { data } = await admin
    .from('tenants')
    .select('wa_access_token, wa_phone_number_id, wa_phone_number_id_ventas')
    .eq('id', tid)
    .maybeSingle();
  return (data as CredsWA) ?? null;
}

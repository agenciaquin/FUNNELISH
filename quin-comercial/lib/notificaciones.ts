import { createServerSupabaseClient } from '@/lib/supabase';

// Avisos del bot al DUEÑO del negocio: ventas confirmadas y solicitudes de
// traspaso a un humano. Cada empresa vincula su número en el panel
// (tenants.wa_numero_dueno). Si no lo ha vinculado, se usan los números de
// respaldo de la agencia para no perder ningún aviso durante la configuración.

const RESPALDO_AGENCIA = ['573143534918', '573187051499'];

/** Número del dueño (solo dígitos) o '' si no lo ha vinculado. */
export async function numeroDueno(tid?: string | null): Promise<string> {
  if (!tid) return '';
  try {
    const admin = createServerSupabaseClient();
    const { data } = await admin.from('tenants').select('wa_numero_dueno').eq('id', tid).maybeSingle();
    return String(data?.wa_numero_dueno ?? '').replace(/\D/g, '');
  } catch {
    return '';
  }
}

/** A dónde mandar los avisos: SOLO al dueño si vinculó su número; si no, al
 *  respaldo de la agencia (así nunca se pierde un aviso mientras configura). */
export async function destinosAviso(tid?: string | null): Promise<string[]> {
  const n = await numeroDueno(tid);
  return n ? [n] : [...RESPALDO_AGENCIA];
}

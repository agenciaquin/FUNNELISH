// =====================================================
// Rate limiting simple con la base de datos (sin servicios externos).
// Cuenta cuántas veces una "clave" (email, tenant, etc.) pidió algo en una
// ventana de tiempo y bloquea si se pasa del límite. Fail-open: si el mecanismo
// falla, NO bloquea (para no dejar a nadie afuera por un error).
// =====================================================

import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * @param clave      identifica quién pide (ej. `login:correo@x.com`, `recarga:<tenant>`)
 * @param max        máximo de intentos permitidos en la ventana
 * @param ventanaSeg tamaño de la ventana en segundos
 * @returns true si se permite; false si se pasó del límite.
 */
export async function permitido(clave: string, max: number, ventanaSeg: number): Promise<boolean> {
  try {
    const admin = createServerSupabaseClient();
    const desde = new Date(Date.now() - ventanaSeg * 1000).toISOString();

    // Limpia lo viejo de esta clave (mantiene la tabla pequeña).
    await admin.from('rate_limits').delete().eq('clave', clave).lt('creado_at', desde);

    const { count } = await admin
      .from('rate_limits').select('*', { count: 'exact', head: true })
      .eq('clave', clave).gte('creado_at', desde);

    if ((count ?? 0) >= max) return false;

    await admin.from('rate_limits').insert({ clave });
    return true;
  } catch {
    return true; // fail-open
  }
}

import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Registra un paso del embudo DESDE EL SERVIDOR (al renderizar la página).
 * Es 100% confiable: no depende del navegador del cliente, así que no lo afectan
 * los bloqueadores de anuncios ni la caché de la PWA. Se usa para los pasos que
 * son "cargas de página": landing, pedido (formulario) y compra (gracias).
 */
export async function registrarPasoServidor(
  slug: string,
  paso: string,
  utms?: Record<string, string>,
): Promise<void> {
  if (!slug || !paso) return;
  try {
    const admin = createServerSupabaseClient();
    await admin.from('funnel_eventos').insert({
      slug: slug.toLowerCase(),
      paso,
      utm_source: utms?.utm_source ?? null,
      utm_medium: utms?.utm_medium ?? null,
      utm_campaign: utms?.utm_campaign ?? null,
    });
  } catch { /* nunca romper la página por registrar un evento */ }
}

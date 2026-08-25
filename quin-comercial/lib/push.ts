import webpush from 'web-push';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActualId } from '@/lib/whatsapp-contexto';

/**
 * Notificaciones push del panel (Web Push / VAPID).
 * Las suscripciones de cada dispositivo se guardan en la tabla `push_subscriptions`.
 */

let configurado = false;

function configurar(): boolean {
  if (configurado) return true;
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) {
    console.warn('[Push] faltan las claves VAPID — notificaciones desactivadas');
    return false;
  }
  webpush.setVapidDetails('mailto:agenciaquin43@gmail.com', publica, privada);
  configurado = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envía una notificación a todos los dispositivos registrados.
 * Nunca lanza excepción: si algo falla, solo lo registra en consola.
 * Las suscripciones caducadas (404/410) se borran automáticamente.
 */
export async function enviarPushATodos(payload: PushPayload): Promise<number> {
  if (!configurar()) return 0;

  const supabase = createServerSupabaseClient();
  // MULTI-TENANT: notificar solo a los dispositivos de la empresa activa (si la hay).
  const tid = tenantActualId();
  let consulta = supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth');
  if (tid) consulta = consulta.eq('tenant_id', tid);
  const { data: subs, error } = await consulta;

  if (error) {
    console.error('[Push] error leyendo suscripciones:', error.message);
    return 0;
  }
  if (!subs || subs.length === 0) return 0;

  const cuerpo = JSON.stringify(payload);
  let enviadas = 0;

  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          cuerpo
        );
        enviadas++;
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404 || code === 410) {
          // Dispositivo desinstalado o permiso revocado → limpiar
          await supabase.from('push_subscriptions').delete().eq('id', s.id);
        } else {
          console.error('[Push] fallo enviando:', code, e?.message);
        }
      }
    })
  );

  return enviadas;
}

// Configuración de QUIN LIVE SHOPPING (maqueta).
// Todo lo "cambiable sin tocar componentes" vive aquí o en variables de entorno.

/**
 * Video del live. En producción apunta a Cloudflare R2, ej.:
 *   NEXT_PUBLIC_LIVE_VIDEO_URL=https://video.dominio.com/live/demo.mp4
 * En la maqueta usa el video de prueba generado (public/live-demo/demo.mp4).
 * NUNCA Supabase Storage.
 */
export const VIDEO_URL = process.env.NEXT_PUBLIC_LIVE_VIDEO_URL || '/live-demo/demo.mp4';

/** Número de WhatsApp de ventas (con indicativo 57, sin +). Placeholder en la maqueta. */
export const WHATSAPP_VENTAS = process.env.NEXT_PUBLIC_LIVE_WHATSAPP || '573000000000';

/** Enlace a la política de privacidad / tratamiento de datos (Ley 1581). */
export const PRIVACIDAD_URL = process.env.NEXT_PUBLIC_LIVE_PRIVACIDAD_URL || '/live/privacidad';

/**
 * Modo de reproducción.
 *  · 'desde_inicio'  → cada visitante empieza el video en 0:00 (implementado).
 *  · 'sincronizado'  → la posición se calcula por la hora (PREPARADO, sin implementar).
 */
export const MODO_REPRODUCCION: 'desde_inicio' | 'sincronizado' = 'desde_inicio';

/**
 * Preparado para el modo sincronizado (no se usa todavía):
 * dado el instante de "inicio" del ciclo y la duración, devuelve en qué segundo debería ir el video.
 */
export function posicionSincronizada(inicioEpochMs: number, duracionSeg: number, ahoraMs = Date.now()): number {
  if (duracionSeg <= 0) return 0;
  return (((ahoraMs - inicioEpochMs) / 1000) % duracionSeg + duracionSeg) % duracionSeg;
}

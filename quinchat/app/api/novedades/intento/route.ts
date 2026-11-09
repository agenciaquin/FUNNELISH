import { AVISO_INTENTO_SRV } from '@/lib/aviso-intento';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Aviso «Intento de entrega» (Panel de Novedades): GET registro · POST crear plantilla en Meta · PATCH activar/desactivar/pasada/enviar. */
export const { GET, POST, PATCH } = AVISO_INTENTO_SRV.rutas();

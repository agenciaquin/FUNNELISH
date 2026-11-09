import { AVISO_INCOMPLETA_SRV } from '@/lib/aviso-incompleta';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Aviso «Dirección incompleta» (Panel de Novedades): GET registro · POST crear plantilla en Meta · PATCH activar/desactivar/pasada/enviar. */
export const { GET, POST, PATCH } = AVISO_INCOMPLETA_SRV.rutas();

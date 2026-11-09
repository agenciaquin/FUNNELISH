import { AVISO_DIRECCION_SRV } from '@/lib/aviso-direccion';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Aviso «Dirección no localizada» (Panel de Novedades): GET registro · POST crear plantilla en Meta · PATCH activar/desactivar/pasada/enviar. */
export const { GET, POST, PATCH } = AVISO_DIRECCION_SRV.rutas();

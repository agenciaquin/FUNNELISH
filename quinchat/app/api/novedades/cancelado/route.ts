import { AVISO_CANCELADO_SRV } from '@/lib/aviso-cancelado';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Aviso «Pedido cancelado» (Panel de Novedades): GET registro · POST crear plantilla en Meta · PATCH activar/desactivar/pasada/enviar. */
export const { GET, POST, PATCH } = AVISO_CANCELADO_SRV.rutas();

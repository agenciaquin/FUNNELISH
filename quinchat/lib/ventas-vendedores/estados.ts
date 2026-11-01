/**
 * Estados del módulo Ventas Vendedores (se usa en servidor y en el panel).
 * Los estados internos se agrupan en las pestañas de la Cola de Preventas.
 */
export type EstadoVV =
  | 'recibida' | 'incompleta' | 'ambigua' | 'esperando_confirmacion'
  | 'confirmada' | 'lista_effi' | 'enviando_effi' | 'en_effi'
  | 'error_effi' | 'escalada' | 'cancelada';

/** Borradores abiertos: el vendedor sigue escribiendo sobre la misma venta. */
export const ESTADOS_ABIERTOS: EstadoVV[] = ['recibida', 'incompleta', 'ambigua', 'esperando_confirmacion'];
/** Ya no se pueden editar libremente (están o van hacia Effi). */
export const ESTADOS_BLOQUEADOS: EstadoVV[] = ['enviando_effi', 'en_effi'];

export const ETIQUETA_ESTADO: Record<EstadoVV, string> = {
  recibida: 'Recibida por WhatsApp',
  incompleta: 'Información incompleta',
  ambigua: 'Producto sin identificar',
  esperando_confirmacion: 'Esperando confirmación',
  confirmada: 'Confirmada por vendedor',
  lista_effi: 'Lista para Effi',
  enviando_effi: 'Enviando a Effi',
  en_effi: 'En Effi',
  error_effi: 'Error de integración',
  escalada: 'Escalada',
  cancelada: 'Cancelada',
};

export type Pestana = 'atender' | 'todas' | 'pendientes' | 'proceso' | 'procesadas' | 'errores' | 'escaladas' | 'canceladas';

export const PESTANAS: { key: Pestana; label: string; estados: EstadoVV[] | null; color: string; fondo: string }[] = [
  { key: 'atender',    label: 'Por atender', estados: ['confirmada', 'lista_effi'], color: '#141413', fondo: '#F1F0EC' },
  { key: 'todas',      label: 'Todas',       estados: null, color: '#FFFFFF', fondo: '#141413' },
  { key: 'pendientes', label: 'Pendientes',  estados: ['recibida', 'incompleta', 'ambigua', 'esperando_confirmacion'], color: '#B45309', fondo: '#FEF3C7' },
  { key: 'proceso',    label: 'En proceso',  estados: ['enviando_effi'], color: '#1D4ED8', fondo: '#DBEAFE' },
  { key: 'procesadas', label: 'Procesadas',  estados: ['en_effi'], color: '#15803D', fondo: '#DCFCE7' },
  { key: 'errores',    label: 'Errores',     estados: ['error_effi'], color: '#B91C1C', fondo: '#FEE2E2' },
  { key: 'escaladas',  label: 'Escaladas',   estados: ['escalada'], color: '#C2410C', fondo: '#FFEDD5' },
  { key: 'canceladas', label: 'Canceladas',  estados: ['cancelada'], color: '#57534E', fondo: '#E7E5E4' },
];

/** Color de la etiqueta de estado en tarjetas y detalle. */
export function colorEstado(e: string): { color: string; fondo: string } {
  const p = PESTANAS.find(p => p.key !== 'todas' && p.key !== 'atender' && p.estados?.includes(e as EstadoVV));
  if (e === 'confirmada' || e === 'lista_effi') return { color: '#1D4ED8', fondo: '#EFF6FF' };
  return p ? { color: p.color, fondo: p.fondo } : { color: '#57534E', fondo: '#F5F5F4' };
}

/** Estados que suman en "Total neto" (no cancelada ni borradores). */
export const ESTADOS_CONTABLES: EstadoVV[] = ['confirmada', 'lista_effi', 'enviando_effi', 'en_effi', 'error_effi', 'escalada'];

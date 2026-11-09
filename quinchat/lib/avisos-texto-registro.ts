import { AVISO_INTENTO_SRV } from '@/lib/aviso-intento';
import { AVISO_DIRECCION_SRV } from '@/lib/aviso-direccion';
import { AVISO_INCOMPLETA_SRV } from '@/lib/aviso-incompleta';

/** Todos los avisos SOLO TEXTO del Panel de Novedades (una entrada por tipo). Agregar uno nuevo = agregarlo aquí. */
export const AVISOS_TEXTO = [
  { tipo: 'intento', srv: AVISO_INTENTO_SRV },
  { tipo: 'direccion', srv: AVISO_DIRECCION_SRV },
  { tipo: 'incompleta', srv: AVISO_INCOMPLETA_SRV },
] as const;
export type TipoAvisoTexto = typeof AVISOS_TEXTO[number]['tipo'];
export const avisoTextoDe = (tipo: unknown) => AVISOS_TEXTO.find(a => a.tipo === tipo) ?? null;

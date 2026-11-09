import { avisoTexto } from '@/lib/aviso-novedad-texto';

/**
 * AVISO «INTENTO DE ENTREGA» (09-nov-2026) — Panel de Novedades. Motor común: lib/aviso-novedad-texto.ts.
 * Dispara con estado de la transportadora «Intento de entrega» o novedad de Effi «701 - Se visita, no se logra entrega».
 * Texto EXACTO del dueño. Interruptor ajustes_bot «aviso_intento» (APAGADO por defecto). Tabla avisos_intento.
 */
export const PLANTILLA_INTENTO = 'novedad_intento_entrega';
export const CUERPO_INTENTO = [
  '{{1}}! Tu pedido ya está en {{2}}🚗',
  'La transportadora nos indica que fueron a tu casa y no estabas',
  'Guía: {{3}}',
  'Nos preocupa que aún no hayas recibido',
  'Cuéntame por qué no pudiste recibir para solucionarlo con la transportadora.🙏',
].join('\n');

export const AVISO_INTENTO_SRV = avisoTexto({
  clave: 'aviso_intento', tabla: 'avisos_intento', plantilla: PLANTILLA_INTENTO, cuerpo: CUERPO_INTENTO,
  ejemplo: ['María', 'Bucaramanga', '240065170587'], nombreCorto: 'Intento de entrega', etiqueta: 'NOVEDAD ENTREGA',
  nota: g => `🚚 Intento de entrega fallido (guía ${g}). Se le avisó por plantilla; gestionar con la transportadora.`,
  prefijoMsg: 'tpl-intento-',
  filtroOr: 'estado_effi.ilike.%intento de entrega%,novedad_texto.ilike.701 -%,novedad_texto.ilike.%se visita, no se logra entrega%',
  coincide: n => /intento de entrega/i.test(String(n.estado_effi ?? '')) || /^701 -|se visita, no se logra entrega/i.test(String(n.novedad_texto ?? '')),
});

// Nombres que ya usaban el cron y el panel
export const ajustesIntento = AVISO_INTENTO_SRV.ajustes;
export const procesarAvisosIntento = AVISO_INTENTO_SRV.procesar;

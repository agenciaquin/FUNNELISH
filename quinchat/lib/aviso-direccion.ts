import { avisoTexto } from '@/lib/aviso-novedad-texto';

/**
 * AVISO «DIRECCIÓN NO LOCALIZADA» (09-nov-2026, dueño) — Panel de Novedades. Motor común: lib/aviso-novedad-texto.ts.
 * SOLO cuando Effi registra que la transportadora no localizó la dirección: «702 - No se localiza dirección del destinatario»
 * o «Dirección destinatario no existe». (No incluye «699 - Dirección incompleta».)
 * Le pide al cliente una foto de un recibo de luz/agua con su dirección y un punto de referencia; todo lo que responda
 * (fotos, textos, ubicación) queda en el aviso y en el historial de la novedad.
 * Texto EXACTO del dueño. Interruptor ajustes_bot «aviso_direccion» (APAGADO por defecto). Tabla avisos_direccion.
 */
export const PLANTILLA_DIRECCION = 'novedad_direccion_no_localizada';
export const CUERPO_DIRECCION = [
  '{{1}}! Tu pedido ya está en {{2}}.',
  '🚚 La transportadora nos indica que no lograron localizar tu dirección.',
  '¿Me ayudas enviándome una fotico de un recibo de luz o agua donde aparezca tu dirección para compartírsela a la transportadora?',
  '📋 Guía: {{3}}',
  '📍 Si tienes un punto de referencia adicional, también me lo regalas para solicitar que vuelvan a ofrecer tu pedido. 🙏',
].join('\n');

const NO_LOCALIZADA = /no se localiza direcci[oó]n|direcci[oó]n (del )?destinatario no existe|direcci[oó]n no localizada/i;

export const AVISO_DIRECCION_SRV = avisoTexto({
  clave: 'aviso_direccion', tabla: 'avisos_direccion', plantilla: PLANTILLA_DIRECCION, cuerpo: CUERPO_DIRECCION,
  ejemplo: ['María', 'Bucaramanga', '99053233278'], nombreCorto: 'Dirección no localizada', etiqueta: 'DIRECCION NO LOCALIZADA',
  nota: g => `📍 La transportadora no localizó la dirección (guía ${g}). Se le pidió recibo de luz/agua y punto de referencia.`,
  prefijoMsg: 'tpl-direccion-',
  filtroOr: 'novedad_texto.ilike.%no se localiza direcci%,novedad_texto.ilike.%destinatario no existe%,motivo.ilike.%no se localiza direcci%',
  coincide: n => NO_LOCALIZADA.test(String(n.novedad_texto ?? '')),
});

export const procesarAvisosDireccion = AVISO_DIRECCION_SRV.procesar;

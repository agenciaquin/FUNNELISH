import { avisoTexto, primerNombre, ciudadBonita } from '@/lib/aviso-novedad-texto';

/**
 * AVISO «DIRECCIÓN INCOMPLETA» (09-nov-2026, dueño) — Panel de Novedades. Motor común: lib/aviso-novedad-texto.ts.
 * Dispara con la novedad de Effi «699 - Dirección incompleta». Le pide al cliente torre, apartamento o detalle que falte.
 * 4 variables de Effi: {{1}} primer nombre · {{2}} ciudad · {{3}} dirección registrada en Effi · {{4}} guía.
 * Texto EXACTO del dueño. Interruptor ajustes_bot «aviso_incompleta» (APAGADO por defecto). Tabla avisos_incompleta.
 * La dirección corregida se guarda en la novedad (direccion_corregida) y NO se escribe en Effi: se confirma y se copia.
 */
export const PLANTILLA_INCOMPLETA = 'novedad_direccion_incompleta';
export const CUERPO_INCOMPLETA = [
  '{{1}}! Tu pedido ya está en {{2}}.',
  '🚚 La transportadora nos indica que tu dirección está incompleta. ¿Me regalas los datos que hacen falta, como torre, apartamento o algún detalle adicional?',
  '📍 Dirección registrada: {{3}}',
  '📋 Guía: {{4}}',
  'Si tienes un punto de referencia adicional, también me lo regalas para solicitar que vuelvan a ofrecer tu pedido. 🙏',
].join('\n');

export const AVISO_INCOMPLETA_SRV = avisoTexto({
  clave: 'aviso_incompleta', tabla: 'avisos_incompleta', plantilla: PLANTILLA_INCOMPLETA, cuerpo: CUERPO_INCOMPLETA,
  ejemplo: ['María', 'Bucaramanga', 'Cra 27 # 45-10 Conjunto Altos del Prado', '99053233278'],
  nombreCorto: 'Dirección incompleta', etiqueta: 'DIRECCION INCOMPLETA',
  nota: g => `🏠 Dirección incompleta (guía ${g}). Se le pidieron torre, apartamento o detalle adicional.`,
  prefijoMsg: 'tpl-incompleta-',
  filtroOr: 'novedad_texto.ilike.699 -%,novedad_texto.ilike.%direcci_n incompleta%',
  coincide: n => /^699 -|direcci[oó]n incompleta/i.test(String(n.novedad_texto ?? '')),
  variables: n => [primerNombre(n.cliente), ciudadBonita(n.ciudad), String(n.direccion ?? '').trim() || 'la que nos diste', String(n.guia)],
});

import { avisoTexto } from '@/lib/aviso-novedad-texto';

/**
 * AVISO «PEDIDO CANCELADO» (09-nov-2026, dueño) — Panel de Novedades. Motor común: lib/aviso-novedad-texto.ts.
 * Dispara con la novedad de Effi «801 - Pedido cancelado» (el cliente le dijo a la transportadora que cancelaba).
 * Le pide con cariño la oportunidad de entregarle el pedido. Texto del dueño, 3 botones rápidos.
 *  · NO se envía si la novedad ya tiene «cancelación definitiva» (la marca el equipo o el cliente lo dice claro).
 *  · Respuestas:
 *      «Sí, quiero recibirlo» (o un sí claro) → reentrega_solicitada: gestionar NUEVA ENTREGA con la transportadora.
 *      «no lo quiero / cancelado / devuélvanlo»… → cancelacion_definitiva: no se le escribe más (avisos automáticos).
 *      «Quiero explicar el motivo» / «Necesito ayuda» → queda en gestión para que responda un asesor.
 * Interruptor ajustes_bot «aviso_cancelado» (APAGADO por defecto). Tabla avisos_cancelado.
 */
export const PLANTILLA_CANCELADO = 'novedad_pedido_cancelado';
export const CUERPO_CANCELADO = [
  '¡{{1}}! Tu pedido ya se encuentra en {{2}}.',
  '😔 La transportadora nos informó que solicitaste cancelar tu pedido.',
  'Queremos pedirte un pequeño favor 🙏. Tu prenda fue preparada y enviada especialmente para ti, y cuando un paquete es devuelto, asumimos costos de envío y devolución que nos afectan bastante.',
  '¿Nos darías la oportunidad de entregártelo? Nos ayudarías muchísimo y queremos que disfrutes tu compra. 🥹',
  '📋 Guía: {{3}}',
  '💬 ¿Podemos contar contigo para recibirlo?',
].join('\n');
// Meta no acepta emojis en los botones (09-nov-2026): la plantilla quedó creada con estos textos
export const BOTONES_CANCELADO = ['Sí, quiero recibirlo', 'Quiero explicar el motivo', 'Necesito ayuda'];

const ACEPTA = /^(✅\s*)?s[ií]\b|quiero recibirlo|s[ií],? (lo|la) recibo|claro que s[ií]|lo recibo|la recibo|de acuerdo|listo,? (lo|la) recibo/i;
const DEFINITIVA = /no (lo |la )?(quiero|voy a recibir|necesito|recibo)|ya no (lo |la )?quiero|cancel(o|é|ado|ar)|devu[eé]lv|no me interesa|no gracias/i;

export const AVISO_CANCELADO_SRV = avisoTexto({
  clave: 'aviso_cancelado', tabla: 'avisos_cancelado', plantilla: PLANTILLA_CANCELADO, cuerpo: CUERPO_CANCELADO,
  ejemplo: ['María', 'Bucaramanga', '240065170587'], botones: BOTONES_CANCELADO,
  nombreCorto: 'Pedido cancelado', etiqueta: 'NOVEDAD CANCELADO',
  nota: g => `🛑 La transportadora reporta que el cliente canceló (guía ${g}). Se le pidió la oportunidad de entregar.`,
  prefijoMsg: 'tpl-cancelado-',
  filtroOr: 'novedad_texto.ilike.801%,novedad_texto.ilike.%pedido cancelado%',
  coincide: n => /^801 -|pedido cancelado/i.test(String(n.novedad_texto ?? '')),
  camposExtra: 'cancelacion_definitiva, reentrega_solicitada',
  permitido: n => (n.cancelacion_definitiva ? 'El cliente confirmó la cancelación definitiva' : null),
  alResponder: async (supabase, fila, nuevas) => {
    if (!fila.novedad_id) return;
    const textos = nuevas.filter(r => r.tipo === 'text' || r.tipo === 'button' || r.tipo === 'interactive').map(r => r.contenido.trim());
    const ahora = new Date().toISOString();
    for (const t of textos) {
      if (ACEPTA.test(t) && !/explicar|ayuda/i.test(t)) {
        await supabase.from('novedades_effi').update({ reentrega_solicitada: true, reentrega_at: ahora, cancelacion_definitiva: false, estado: 'en_gestion', estado_cambio_at: ahora, actualizado_at: ahora }).eq('id', fila.novedad_id);
        await supabase.from('novedades_effi_historial').insert({ novedad_id: fila.novedad_id, tipo: 'estado', detalle: '✅ El cliente ACEPTA recibir → gestionar NUEVA ENTREGA con la transportadora', por: 'Cliente' });
        return;
      }
      if (DEFINITIVA.test(t) && !ACEPTA.test(t)) {
        await supabase.from('novedades_effi').update({ cancelacion_definitiva: true, estado: 'en_gestion', estado_cambio_at: ahora, actualizado_at: ahora }).eq('id', fila.novedad_id);
        await supabase.from('novedades_effi_historial').insert({ novedad_id: fila.novedad_id, tipo: 'estado', detalle: `🛑 El cliente confirma la CANCELACIÓN («${t.slice(0, 120)}»). No se le envían más mensajes automáticos.`, por: 'Cliente' });
        return;
      }
    }
  },
});

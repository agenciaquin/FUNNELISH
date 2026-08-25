// Reglas de etiquetas automáticas.
// El cliente define (con Quino o desde el panel) cuándo el bot marca una etiqueta.
// Truco barato y confiable: las reglas se inyectan en el prompt del bot, y el bot
// agrega un marcador invisible [[ETIQUETA: X]] al final de su respuesta cuando se
// cumple la condición. El webhook detecta el marcador, aplica la etiqueta y lo
// borra del texto — sin gastar IA extra.

// Estados "de venta" (reemplazan al estado anterior). El resto son tags (se suman).
export const ESTADOS_VENTA = [
  'PENDIENTE POR CONFIRMACIÓN', 'VENTA REALIZADA', 'ANULADO EN EFFI',
  'PEDIDO CANCELADO', 'PEDIDO PROGRAMADO', 'ABONO POR VERIFICAR',
];

// Reglas que vienen puestas por defecto (para que funcione sin configurar nada).
export const REGLAS_DEFAULT: { condicion: string; etiqueta: string }[] = [
  { condicion: 'el cliente confirmó el pedido y ya dio su nombre y dirección de entrega', etiqueta: 'VENTA REALIZADA' },
  { condicion: 'el cliente envió el comprobante de pago o del abono', etiqueta: 'ABONO POR VERIFICAR' },
];

const esEstado = (et: string) => ESTADOS_VENTA.some(e => e.toUpperCase() === et.trim().toUpperCase());

/** Siembra las reglas por defecto para una empresa que aún no tiene ninguna. */
export async function sembrarReglasDefault(admin: any, tid: string): Promise<void> {
  try {
    const filas = REGLAS_DEFAULT.map(r => ({ tenant_id: tid, condicion: r.condicion, etiqueta: r.etiqueta, activo: true }));
    await admin.from('reglas_etiqueta').insert(filas);
  } catch { /* ignora si ya existían o falta la tabla */ }
}

/** Bloque de instrucciones para el prompt del bot, armado con las reglas activas.
 *  Si la empresa no tiene reglas, siembra las de por defecto la primera vez. */
export async function bloqueEtiquetas(admin: any, tid: string | null | undefined): Promise<string> {
  if (!tid) return '';
  try {
    let { data } = await admin.from('reglas_etiqueta').select('*').eq('tenant_id', tid).eq('activo', true);
    if (!data || data.length === 0) {
      await sembrarReglasDefault(admin, tid);
      ({ data } = await admin.from('reglas_etiqueta').select('*').eq('tenant_id', tid).eq('activo', true));
    }
    if (!data || data.length === 0) return '';
    const lineas = data.map((r: any) => {
      const adic = String(r.etiqueta_adicional ?? '').trim();
      const extra = adic ? ` [[ETIQUETA: ${adic}]]` : '';
      return `- Si ${String(r.condicion).trim()} → agrega [[ETIQUETA: ${String(r.etiqueta).trim()}]]${extra}`;
    }).join('\n');
    return `\n\n[ETIQUETAS AUTOMÁTICAS]\nCuando en la conversación se cumpla una de estas situaciones, agrega AL FINAL de tu respuesta el marcador EXACTO indicado. El cliente NUNCA lo verá (se borra antes de enviar). No menciones el marcador ni la etiqueta en tu texto visible, y solo ponlo cuando de verdad se cumpla:\n${lineas}`;
  } catch { return ''; }
}

/** Detecta los marcadores [[ETIQUETA: X]] en la respuesta del bot, aplica las
 *  etiquetas a la conversación (mismo formato "A | B") y devuelve el texto limpio.
 *  `sb` debe venir scopeado al tenant (como en el webhook). */
export async function aplicarMarcadores(sb: any, from: string, texto: string): Promise<string> {
  if (!texto) return texto;
  const re = /\[\[\s*ETIQUETA\s*:\s*([^\]]+?)\s*\]\]/gi;
  const encontradas = [...texto.matchAll(re)].map(m => m[1].trim()).filter(Boolean);
  // El marcador [[ASESOR]] (pasar a un humano) NUNCA debe llegar al cliente. La
  // ACCIÓN de escalar la hace el webhook; aquí solo se garantiza que no se vea.
  const limpio = texto
    .replace(re, '')
    .replace(/\[\[\s*ASESOR\s*\]\]/gi, '')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (encontradas.length === 0) return limpio;
  try {
    const { data: conv } = await sb.from('conversations').select('label').eq('id', from).maybeSingle();
    let labels = String(conv?.label ?? '').split('|').map((s: string) => s.trim()).filter(Boolean);
    let marcaVenta = false;
    for (const et of encontradas) {
      if (esEstado(et)) {
        // Un estado de venta reemplaza al estado anterior (conserva los tags).
        labels = labels.filter(l => !esEstado(l));
        if (et.trim().toUpperCase().includes('VENTA REALIZADA')) marcaVenta = true;
      }
      if (!labels.some(l => l.toUpperCase() === et.toUpperCase())) labels.push(et.trim());
    }
    const patch: any = { label: [...new Set(labels)].join(' | ') };
    if (marcaVenta) patch.vendido_at = new Date().toISOString();
    await sb.from('conversations').update(patch).eq('id', from);
  } catch { /* nunca romper la respuesta por etiquetar */ }
  return limpio;
}

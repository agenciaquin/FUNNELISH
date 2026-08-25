// ════════════════════════════════════════════════════════════════════════
// Etiquetas de RECLAMO EN OFICINA (para rescatar pedidos de alto riesgo).
//   🏢 OFICINA SIN ABONO → aún no paga el abono (en nuestro modelo, oficina
//      exige abono; estos son los que hay que salvar ofreciéndoles domicilio).
//   🏢 OFICINA CON ABONO → ya abonó, pedido asegurado.
// ════════════════════════════════════════════════════════════════════════

const RX_OFICINA = /^OFICINA (SIN|CON) ABONO$/i;

function parse(label: string | null | undefined): string[] {
  return (label ?? '').split('|').map(s => s.trim()).filter(Boolean);
}
function join(arr: string[]): string {
  return [...new Set(arr.map(s => s.trim()).filter(Boolean))].join(' | ');
}

/** ¿La dirección/texto indica que quiere reclamar en oficina? */
export function esOficina(texto: string | null | undefined): boolean {
  const t = String(texto ?? '').toLowerCase();
  return t.includes('interrapidisimo') || t.includes('interrapidísimo')
    || t.includes('reclamar en oficina') || t.includes('recoger en oficina')
    || t.includes('reclamo en oficina') || t.includes('en oficina');
}

/** Pone la etiqueta OFICINA SIN ABONO (quita cualquier etiqueta de oficina previa). */
export async function etiquetarOficinaSinAbono(supabase: any, from: string): Promise<void> {
  try {
    const { data } = await supabase.from('conversations').select('label').eq('id', from).maybeSingle();
    const actuales = parse(data?.label).filter(l => !RX_OFICINA.test(l));
    await supabase.from('conversations')
      .update({ label: join([...actuales, 'OFICINA SIN ABONO']) }).eq('id', from);
  } catch (e) { console.error('[Oficina] no se pudo etiquetar SIN ABONO:', e); }
}

/** El cliente abonó: si el pedido era de oficina, pasa de SIN a CON abono. */
export async function marcarOficinaAbonada(supabase: any, from: string): Promise<void> {
  try {
    const { data } = await supabase.from('conversations').select('label').eq('id', from).maybeSingle();
    const actuales = parse(data?.label);
    if (!actuales.some(l => RX_OFICINA.test(l))) return; // no era de oficina, no se toca
    const limpias = actuales.filter(l => !RX_OFICINA.test(l));
    await supabase.from('conversations')
      .update({ label: join([...limpias, 'OFICINA CON ABONO']) }).eq('id', from);
  } catch (e) { console.error('[Oficina] no se pudo marcar CON ABONO:', e); }
}

/** El cliente cambió a domicilio (dio dirección de casa): quita las etiquetas de oficina. */
export async function quitarEtiquetaOficina(supabase: any, from: string): Promise<void> {
  try {
    const { data } = await supabase.from('conversations').select('label').eq('id', from).maybeSingle();
    const actuales = parse(data?.label);
    if (!actuales.some(l => RX_OFICINA.test(l))) return;
    const limpias = actuales.filter(l => !RX_OFICINA.test(l));
    await supabase.from('conversations').update({ label: join(limpias) }).eq('id', from);
  } catch (e) { console.error('[Oficina] no se pudo quitar etiqueta:', e); }
}

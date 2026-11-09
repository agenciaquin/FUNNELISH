/**
 * ¿La remisión de Effi de una venta está ANULADA / CANCELADA? (09-nov-2026, dueño)
 * Una venta activa en Effi NO se puede eliminar del panel; solo cuando en Effi quedó anulada.
 * En la copia `effi_remisiones_api`: `vigente = '0'` = anulada (comprobado: de 202 con vigente 0, solo 2 tienen guía viva)
 * o el estado dice «anulad…/cancelad…».
 */
export const remisionEstaAnulada = (r: { vigente?: string | null; estado?: string | null } | null | undefined) =>
  !!r && (String(r.vigente ?? '') === '0' || /anulad|cancelad/i.test(String(r.estado ?? '')));

async function buscar(supabase: any, remision: string) {
  const { data } = await supabase.from('effi_remisiones_api').select('id_effi, id_transaccion, estado, vigente')
    .or(`id_effi.eq.${remision},id_transaccion.eq.${remision}`).limit(1).maybeSingle();
  return data as any;
}

/** Revisa la copia; si no aparece anulada, la pone al día con Effi (solo lectura) y vuelve a mirar. */
export async function remisionAnuladaEnEffi(supabase: any, remision: string, creadoAt?: string | null) {
  const rem = String(remision ?? '').replace(/\D/g, '');
  if (!rem) return { anulada: false, encontrada: false, estado: null as string | null };
  let r = await buscar(supabase, rem);
  if (!remisionEstaAnulada(r)) {
    try {
      const { sincronizarRemisionesEffi } = await import('@/lib/effi-api');
      const manana = new Date(Date.now() - 5 * 3600_000 + 86400_000).toISOString().slice(0, 10);
      const dias = Math.min(20, Math.max(2, Math.ceil((Date.now() - (Date.parse(creadoAt ?? '') || Date.now())) / 86400_000) + 1));
      await sincronizarRemisionesEffi(manana, dias);
      r = await buscar(supabase, rem);
    } catch { /* sin conexión con Effi: se queda con la copia */ }
  }
  return { anulada: remisionEstaAnulada(r), encontrada: !!r, estado: r ? `${r.estado ?? ''}${String(r.vigente) === '0' ? ' (no vigente)' : ''}` : null };
}

/** Para la lista: remisiones (de las ventas) que están anuladas según la copia de Effi. */
export async function remisionesAnuladas(supabase: any, remisiones: string[]): Promise<Set<string>> {
  const ids = [...new Set(remisiones.filter(Boolean).map(String))];
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 300) {
    const lote = ids.slice(i, i + 300);
    const { data } = await supabase.from('effi_remisiones_api').select('id_effi, id_transaccion, estado, vigente').in('id_effi', lote);
    for (const r of data ?? []) if (remisionEstaAnulada(r)) { out.add(String(r.id_effi)); if (r.id_transaccion) out.add(String(r.id_transaccion)); }
  }
  return out;
}

/** Grupo de una guía de Effi para el panel «Estado de pedido» (y el descuento por entrega). */
export type GrupoGuia = 'generada' | 'transito' | 'oficina' | 'entregada' | 'devuelta' | 'novedad' | 'anulada';

export function grupoDeGuia(g: { estado_efficommerce?: string | null; estado?: string | null; vigente?: boolean | null }): GrupoGuia {
  if (g.vigente === false) return 'anulada';
  const e = `${g.estado_efficommerce ?? ''} ${g.estado ?? ''}`.toLowerCase();
  if (/devoluci|devuelt/.test(e)) return 'devuelta';
  if (/entregad/.test(e)) return 'entregada';
  if (/retiro en oficina|reclame en oficina|oficina/.test(e)) return 'oficina';
  if (/novedad|incidencia/.test(e)) return 'novedad';
  if (/transito|tránsito|reparto|terminal|transporte|acopio|despachad|bodega|ruta/.test(e)) return 'transito';
  return 'generada';
}


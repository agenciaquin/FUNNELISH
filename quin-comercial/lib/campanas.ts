/**
 * Rentabilidad real por campaña.
 *
 * Cruza el gasto de publicidad (subido desde los Excel de TikTok y Meta) con las
 * ventas CONFIRMADAS por WhatsApp, que es lo único que cuenta en un negocio de
 * pago contra entrega. Ni Meta ni TikTok saben cuáles pedidos se confirmaron.
 */

/** Normaliza el nombre de una campaña para poder emparejarla entre fuentes. */
export function normalizarCampana(nombre: string | null | undefined): string {
  return String(nombre ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export type Calificacion = 'excelente' | 'buena' | 'regular' | 'mala' | 'sin-ventas' | 'sin-datos';

export const CALIFICACIONES: Record<Calificacion, { texto: string; color: string; fondo: string }> = {
  excelente:  { texto: 'Excelente',  color: '#15803D', fondo: 'rgba(21,128,61,0.10)'   },
  buena:      { texto: 'Buena',      color: '#65A30D', fondo: 'rgba(101,163,13,0.10)'  },
  regular:    { texto: 'Regular',    color: '#EA580C', fondo: 'rgba(234,88,12,0.10)'   },
  mala:       { texto: 'Mala',       color: '#DC2626', fondo: 'rgba(220,38,38,0.10)'   },
  'sin-ventas': { texto: 'Sin ventas', color: '#B91C1C', fondo: 'rgba(185,28,28,0.12)' },
  'sin-datos':  { texto: 'Sin datos',  color: '#9A9A9A', fondo: 'rgba(154,154,154,0.10)' },
};

/**
 * Qué tan buena está una campaña frente al costo por venta que te propusiste.
 * Devuelve también qué tan llena va la barra (0 a 100).
 */
export function calificar(
  costoPorVenta: number,
  confirmados: number,
  gasto: number,
  objetivo: number,
): { nivel: Calificacion; barra: number } {
  // Gastó y no vendió nada: es lo peor que puede pasar
  if (gasto > 0 && confirmados === 0) return { nivel: 'sin-ventas', barra: 3 };
  // Sin gasto cargado no se puede calificar: dar "excelente" sería engañoso
  if (gasto <= 0) return { nivel: 'sin-datos', barra: 0 };
  if (confirmados === 0 || !objetivo || objetivo <= 0) return { nivel: 'sin-datos', barra: 0 };

  // Qué tan lejos está del objetivo. Mayor que 1 = mejor de lo esperado.
  const bondad = objetivo / costoPorVenta;
  const barra  = Math.max(4, Math.min(100, Math.round(bondad * 50)));

  const nivel: Calificacion =
    bondad >= 1.5  ? 'excelente' :
    bondad >= 1.15 ? 'buena'     :
    bondad >= 0.85 ? 'regular'   : 'mala';

  return { nivel, barra };
}

/** Unifica cómo llega la plataforma: 'fb', 'facebook', 'ig' → meta. */
export function normalizarPlataforma(v: string | null | undefined): 'tiktok' | 'meta' | 'otro' {
  const s = String(v ?? '').toLowerCase().trim();
  if (!s) return 'otro';
  if (s.includes('tiktok') || s === 'tt') return 'tiktok';
  if (['fb', 'facebook', 'ig', 'instagram', 'meta'].some(x => s.includes(x))) return 'meta';
  return 'otro';
}

/** "$134.900" → 134900 */
export function aNumero(valor: string | number | null | undefined): number {
  if (typeof valor === 'number') return valor;
  const limpio = String(valor ?? '').replace(/[^\d]/g, '');
  return limpio ? Number(limpio) : 0;
}

export interface FilaCampana {
  campana: string;
  plataforma: string;
  estado: 'activa' | 'apagada' | '';  // según el Excel más reciente
  gasto: number;
  pedidos: number;
  confirmados: number;
  cancelados: number;
  pendientes: number;
  ingresos: number;        // valor de las ventas confirmadas
  tasaCierre: number;      // % confirmados sobre pedidos resueltos
  costoPorPedido: number;  // lo que reporta la plataforma
  costoPorVenta: number;   // el real: gasto ÷ confirmados
  ganancia: number;        // ingresos − gasto (sin costo de producto)
}

export interface Resumen {
  gasto: number;
  pedidos: number;
  confirmados: number;
  ingresos: number;
  costoPorVenta: number;
  tasaCierre: number;
}

/** Arma el informe cruzando gastos y pedidos. */
export function construirInforme(
  gastos: any[],
  pedidos: any[],
): { filas: FilaCampana[]; resumen: Resumen; sinCruzar: string[] } {
  // ── Gasto acumulado por campaña ──────────────────────────────────────────
  const porCampana = new Map<string, FilaCampana>();
  // Índice auxiliar: el UTM puede traer el identificador en vez del nombre
  // (Meta manda el ID numérico; TikTok manda el nombre).
  const porId = new Map<string, string>();
  // Fecha del dato más reciente CON estado. Los archivos viejos no lo traían,
  // así que se toma el estado más nuevo que exista, aunque no sea del último día.
  const ultimaFecha = new Map<string, string>();

  for (const g of gastos) {
    const clave = normalizarCampana(g.campana);
    if (!clave) continue;

    const id = String(g.campana_id ?? '').trim();
    if (id) porId.set(id, clave);

    const actual = porCampana.get(clave);
    if (actual) {
      actual.gasto += Number(g.gasto ?? 0);
      // Solo las filas que traen estado compiten por ser "la más reciente"
      const fecha = String(g.fecha ?? '');
      if (g.estado && fecha >= (ultimaFecha.get(clave) ?? '')) {
        ultimaFecha.set(clave, fecha);
        actual.estado = g.estado;
      }
    } else {
      if (g.estado) ultimaFecha.set(clave, String(g.fecha ?? ''));
      porCampana.set(clave, {
        campana: String(g.campana ?? '').trim(),
        plataforma: normalizarPlataforma(g.plataforma),
        estado: (g.estado ?? '') as 'activa' | 'apagada' | '',
        gasto: Number(g.gasto ?? 0),
        pedidos: 0, confirmados: 0, cancelados: 0, pendientes: 0,
        ingresos: 0, tasaCierre: 0, costoPorPedido: 0, costoPorVenta: 0, ganancia: 0,
      });
    }
  }

  // ── Pedidos por campaña ──────────────────────────────────────────────────
  const sinCruzar = new Set<string>();

  for (const p of pedidos) {
    const utm = String(p.utm_campaign ?? '').trim();
    if (!utm) continue;

    // Si el UTM es un identificador conocido, se traduce a su campaña
    const clave = porId.get(utm) ?? normalizarCampana(utm);

    let fila = porCampana.get(clave);
    if (!fila) {
      // Hay pedidos de una campaña de la que aún no se subió gasto
      sinCruzar.add(String(p.utm_campaign ?? '').trim());
      fila = {
        campana: String(p.utm_campaign ?? '').trim(),
        plataforma: normalizarPlataforma(p.utm_source),
        estado: '',
        gasto: 0,
        pedidos: 0, confirmados: 0, cancelados: 0, pendientes: 0,
        ingresos: 0, tasaCierre: 0, costoPorPedido: 0, costoPorVenta: 0, ganancia: 0,
      };
      porCampana.set(clave, fila);
    }

    const estado = String(p.estado ?? '').toLowerCase();
    if (estado === 'duplicado') continue; // los dobles clics no cuentan

    fila.pedidos++;
    if (p.confirmado === true) {
      fila.confirmados++;
      fila.ingresos += aNumero(p.valor);
    } else if (estado === 'cancelado') {
      fila.cancelados++;
    } else {
      fila.pendientes++;
    }
  }

  // ── Calcular métricas ────────────────────────────────────────────────────
  // Sin gasto y sin pedidos no hay nada que analizar: fuera del informe.
  const filas = [...porCampana.values()]
    .filter(f => f.gasto > 0 || f.pedidos > 0)
    .map(f => {
    const resueltos = f.confirmados + f.cancelados;
    f.tasaCierre     = resueltos > 0 ? Math.round((f.confirmados / resueltos) * 100) : 0;
    f.costoPorPedido = f.pedidos > 0 ? Math.round(f.gasto / f.pedidos) : 0;
    f.costoPorVenta  = f.confirmados > 0 ? Math.round(f.gasto / f.confirmados) : 0;
    f.ganancia       = f.ingresos - f.gasto;
    return f;
  }).sort((a, b) => {
    // 1) TikTok antes que Meta
    const orden = { tiktok: 0, meta: 1, otro: 2 } as Record<string, number>;
    const dPlat = (orden[a.plataforma] ?? 2) - (orden[b.plataforma] ?? 2);
    if (dPlat !== 0) return dPlat;

    // 2) Las que siguen encendidas primero: son sobre las que puedes actuar hoy
    const rango = (e: string) => (e === 'activa' ? 0 : e === 'apagada' ? 2 : 1);
    const dEstado = rango(a.estado) - rango(b.estado);
    if (dEstado !== 0) return dEstado;

    // 3) Y dentro de cada grupo, por gasto
    return b.gasto - a.gasto;
  });

  const resumen: Resumen = {
    gasto:       filas.reduce((s, f) => s + f.gasto, 0),
    pedidos:     filas.reduce((s, f) => s + f.pedidos, 0),
    confirmados: filas.reduce((s, f) => s + f.confirmados, 0),
    ingresos:    filas.reduce((s, f) => s + f.ingresos, 0),
    costoPorVenta: 0,
    tasaCierre: 0,
  };
  resumen.costoPorVenta = resumen.confirmados > 0 ? Math.round(resumen.gasto / resumen.confirmados) : 0;
  const resueltosTot = filas.reduce((s, f) => s + f.confirmados + f.cancelados, 0);
  resumen.tasaCierre = resueltosTot > 0 ? Math.round((resumen.confirmados / resueltosTot) * 100) : 0;

  return { filas, resumen, sinCruzar: [...sinCruzar] };
}

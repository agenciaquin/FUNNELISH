/**
 * Categorías de objeción para el análisis de chats perdidos.
 * Se comparten entre el backend (cron) y el panel, así que este archivo
 * NO debe importar nada del servidor (supabase, etc.).
 */

export const CATEGORIAS_OBJ = [
  'Precio',        // le pareció caro / no le alcanza
  'Desconfianza',  // miedo a estafa / quiere más pruebas
  'Talla',         // dudas de talla o medidas
  'Envío',         // cobertura, costo o tiempo de entrega
  'Indecisión',    // "lo pienso", lo consulta, más tarde
  'Producto',      // quería otro color/modelo que no había
  'Sin respuesta', // dejó de contestar (ghosting)
  'Otro',
] as const;

export type CategoriaObj = typeof CATEGORIAS_OBJ[number];

/** Color de cada categoría para el tablero. */
export const COLOR_OBJ: Record<string, string> = {
  'Precio':        '#DC2626',
  'Desconfianza':  '#7C3AED',
  'Talla':         '#2563EB',
  'Envío':         '#0891B2',
  'Indecisión':    '#D97706',
  'Producto':      '#DB2777',
  'Sin respuesta': '#6B7280',
  'Otro':          '#4B5563',
};

/** Emoji para cada categoría. */
export const EMOJI_OBJ: Record<string, string> = {
  'Precio':        '💰',
  'Desconfianza':  '🛡️',
  'Talla':         '📏',
  'Envío':         '🚚',
  'Indecisión':    '🤔',
  'Producto':      '👕',
  'Sin respuesta': '👻',
  'Otro':          '❓',
};

/** Normaliza una categoría que devuelve el modelo a una de las válidas. */
export function normalizarCategoria(cat: unknown): CategoriaObj {
  const c = String(cat ?? '').trim().toLowerCase();
  if (c.startsWith('prec')) return 'Precio';
  if (c.startsWith('desc')) return 'Desconfianza';
  if (c.startsWith('tall') || c.includes('medid')) return 'Talla';
  if (c.startsWith('env') || c.includes('entrega') || c.includes('cobertura')) return 'Envío';
  if (c.startsWith('indec') || c.includes('piens') || c.includes('tarde') || c.includes('consult')) return 'Indecisión';
  if (c.startsWith('prod') || c.includes('color') || c.includes('modelo') || c.includes('agot')) return 'Producto';
  if (c.includes('respuesta') || c.includes('ghost') || c.includes('no contest') || c.includes('sin resp')) return 'Sin respuesta';
  const exacta = CATEGORIAS_OBJ.find(x => x.toLowerCase() === c);
  return (exacta as CategoriaObj) ?? 'Otro';
}

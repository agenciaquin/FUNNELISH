export type ConversationStatus = 'nuevo' | 'en_proceso' | 'resuelto' | 'cerrado';

export const STATUS_CONFIG: Record<ConversationStatus, { label: string; color: string; bg: string; border: string }> = {
  nuevo:      { label: 'Nuevo',      color: '#EAB308', bg: 'rgba(234,179,8,0.12)',    border: 'rgba(234,179,8,0.35)'    },
  en_proceso: { label: 'En proceso', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',   border: 'rgba(59,130,246,0.35)'   },
  resuelto:   { label: 'Resuelto',   color: '#22C55E', bg: 'rgba(34,197,94,0.12)',    border: 'rgba(34,197,94,0.35)'    },
  cerrado:    { label: 'Cerrado',    color: '#6B7280', bg: 'rgba(107,114,128,0.12)',  border: 'rgba(107,114,128,0.35)'  },
};

export interface Conversation {
  id: string;              // WhatsApp phone number, e.g. "573001234567"
  contact_name: string;
  last_message: string;
  last_message_time: string; // ISO timestamp
  unread_count: number;
  bot_enabled: boolean;
  label: string | null;
  status: ConversationStatus;
  created_at: string;
  fijado?: boolean;   // se muestra siempre arriba de la lista
  linea?: string | null; // 'ventas' = bandeja Chat Ventas; null/'funnel' = Chat Funnel
  interaccion_bot?: boolean; // true si el cliente respondió después de que el bot escribió
}

export interface Etiqueta {
  id: string;
  nombre: string;
  color: string;
  descripcion?: string;
  // true  = ESTADO del pedido (uno solo a la vez; poner uno reemplaza al anterior)
  // false = etiqueta ADICIONAL (se suma encima del estado sin borrarlo)
  es_estado?: boolean;
  // Si esta fila de la BD PERSONALIZA una etiqueta por defecto (renombrar/recolorear),
  // aquí va el id de la fija que reemplaza. null/undefined = etiqueta nueva del cliente.
  base_id?: string | null;
}

/** Etiquetas del negocio: siempre disponibles (no dependen de la base de datos) */
export const ETIQUETAS_FIJAS: Etiqueta[] = [
  { id: 'pendconf',  nombre: 'PENDIENTE POR CONFIRMACIÓN', color: '#8B5CF6', es_estado: true  },
  { id: 'venta',     nombre: 'VENTA REALIZADA',            color: '#00847A', es_estado: true  },
  { id: 'abonover',  nombre: 'ABONO POR VERIFICAR',        color: '#F59E0B', es_estado: true  },
  { id: 'procesado', nombre: 'ANULADO EN EFFI',            color: '#DC2626', es_estado: true  },
  { id: 'progr',     nombre: 'PEDIDO PROGRAMADO',          color: '#14B8A6', es_estado: true  },
  { id: 'cancel',    nombre: 'PEDIDO CANCELADO',           color: '#EF4444', es_estado: true  },
  { id: 'humano',    nombre: 'HUMANO',                     color: '#6B7280', es_estado: false },
  { id: 'abono',     nombre: 'PENDIENTE DE ABONO',         color: '#EAB308', es_estado: false },
  { id: 'vendedor',  nombre: 'VENDEDOR',                   color: '#F59E0B', es_estado: false },
  { id: 'revlili',   nombre: 'POR REVISAR LILIBETH',       color: '#EC4899', es_estado: false },
];

/**
 * ESTADO del pedido: solo uno a la vez. Poner uno reemplaza al anterior.
 */
export const ESTADOS_CONV = [
  'PENDIENTE POR CONFIRMACIÓN',
  'VENTA REALIZADA',
  'ABONO POR VERIFICAR',
  'ANULADO EN EFFI',
  'PEDIDO PROGRAMADO',
  'PEDIDO CANCELADO',
];

/**
 * ETIQUETAS ADICIONALES: se suman al estado sin reemplazarlo.
 * Un chat puede estar en "VENTA REALIZADA" y además marcado como "HUMANO".
 */
export const TAGS_CONV = ['HUMANO', 'PENDIENTE DE ABONO'];

export function parseLabels(label: string | null | undefined): string[] {
  return (label ?? '').split('|').map(s => s.trim()).filter(Boolean);
}

export function joinLabels(arr: string[]): string {
  return [...new Set(arr.map(s => s.trim()).filter(Boolean))].join(' | ');
}

/**
 * Cambia el estado conservando las etiquetas adicionales que tuviera.
 * `estadosConocidos` = la lista COMPLETA de nombres de estado vigentes (incluye
 * los que el cliente agregó/renombró desde el panel), para que poner un estado
 * nuevo siga reemplazando al anterior. Si no se pasa, usa los de fábrica.
 */
export function conEstado(
  labelActual: string | null | undefined,
  estado: string | null,
  estadosConocidos: string[] = ESTADOS_CONV,
): string | null {
  const set = estadosConocidos.map(s => s.toUpperCase());
  const tags = parseLabels(labelActual).filter(l => !set.includes(l.toUpperCase()));
  const nuevo = joinLabels(estado ? [estado, ...tags] : tags);
  return nuevo || null;
}

/** Agrega o quita una etiqueta adicional sin tocar el estado. */
export function conTag(labelActual: string | null | undefined, tag: string): string | null {
  const actuales = parseLabels(labelActual);
  const tiene = actuales.some(l => l.toUpperCase() === tag.toUpperCase());
  const nuevos = tiene
    ? actuales.filter(l => l.toUpperCase() !== tag.toUpperCase())
    : [...actuales, tag];
  return joinLabels(nuevos) || null;
}

export interface Message {
  id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant' | 'agent';
  // 'user'      = incoming from WhatsApp customer
  // 'assistant' = auto-reply by Claude bot
  // 'agent'     = manual reply sent from this panel
  type: string; // 'text' | 'image' | 'audio' | 'video' | 'reaction' etc.
  created_at: string;
  media_url?: string;    // ephemeral object URL for outgoing media (in-session only)
  caption?: string;      // pie de foto/video que acompaña el archivo (persistido en BD)
  whatsapp_id?: string;  // WhatsApp wamid — used to match reply context
  reply_to?: string;     // content/URL of the message being quoted (if any)
  status?: string;       // estado de envío: sent | delivered | read | failed
  error_envio?: string;  // motivo que dio Meta cuando falló
}

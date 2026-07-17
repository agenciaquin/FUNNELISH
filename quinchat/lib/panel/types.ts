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
  whatsapp_id?: string;  // WhatsApp wamid — used to match reply context
  reply_to?: string;     // content/URL of the message being quoted (if any)
}

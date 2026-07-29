// =====================================================
// QUINCHAT — Tipos compartidos
// =====================================================

/** Rol en la conversación (igual que Anthropic SDK) */
export type MessageRole = 'user' | 'assistant';

/** Un mensaje individual del chat */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

/** Payload que recibe el API route POST /api/quinchat */
export interface ChatRequest {
  messages: Pick<ChatMessage, 'role' | 'content'>[];
  /** Para multi-tenant futuro: identifica al negocio/cliente */
  tenantId?: string;
  /** System prompt override (cargado desde bot_config en Supabase). Es la parte
   *  ESTABLE que se cachea y se reutiliza entre conversaciones. */
  systemPrompt?: string;
  /** Contexto VARIABLE por cliente (anuncio, pedido previo, promo). Va en un
   *  segundo bloque de system que NO se cachea, para no romper el caché. */
  systemDynamic?: string;
  /** Largo máximo de la respuesta. Por defecto 1024, suficiente para un chat. */
  maxTokens?: number;
  /**
   * Fotos que mandó el cliente en este turno. Se adjuntan al último mensaje
   * para que el modelo pueda VERLAS (reconocer el modelo, leer un comprobante…).
   */
  imagenes?: { mimeType: string; base64: string }[];
}

/** Respuesta exitosa del API route */
export interface ChatResponse {
  message: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** Respuesta de error del API route */
export interface ChatErrorResponse {
  error: string;
  code?: string;
}

// =====================================================
// Futuro: integración WhatsApp Cloud API
// Al conectar el webhook de Meta, los mensajes entrantes
// se convierten a ChatMessage[] con role='user' y se
// pasan al mismo lib/quinchat/claude.ts — mismo flujo.
// =====================================================

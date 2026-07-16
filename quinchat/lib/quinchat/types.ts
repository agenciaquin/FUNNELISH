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

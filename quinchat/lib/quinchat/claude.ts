// =====================================================
// QUINCHAT — Cliente Claude (server-only)
// Este archivo SOLO se ejecuta en el servidor (API route).
// La API key nunca llega al navegador.
// =====================================================

import Anthropic from '@anthropic-ai/sdk';
import { getSystemPrompt } from './systemPrompt';
import type { ChatRequest, ChatResponse } from './types';

// Instancia singleton — se crea una vez por proceso en Vercel
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY no está configurada. ' +
        'Agrégala en las variables de entorno de Vercel o en .env.local.'
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

/**
 * Envía los mensajes a Claude y retorna la respuesta del asistente.
 * Modelo: claude-sonnet-4-6 (último Sonnet disponible).
 */
export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const client = getClient();

  // Validación básica
  if (!req.messages || req.messages.length === 0) {
    throw new Error('Se requiere al menos un mensaje.');
  }

  // Límite de seguridad: máximo 50 turnos de historial para evitar costos excesivos
  const MAX_HISTORY = 50;
  const messages = req.messages.slice(-MAX_HISTORY);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: getSystemPrompt(req.tenantId),
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  // Extraer texto de la respuesta
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude no retornó un bloque de texto válido.');
  }

  return {
    message: textBlock.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// =====================================================
// FUTURO: Streaming
// Para respuestas en tiempo real, reemplaza client.messages.create
// por client.messages.stream() y retorna un ReadableStream.
// El API route usaría: return new StreamingTextResponse(stream)
//
// FUTURO: WhatsApp Cloud API
// El webhook de Meta llama POST /api/whatsapp/webhook
// Ese route parsea el payload de Meta, construye ChatRequest,
// llama a chat() aquí, y envía la respuesta via WhatsApp API.
// =====================================================

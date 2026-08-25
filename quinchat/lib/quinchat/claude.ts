// =====================================================
// QUINCHAT — Cliente Claude (server-only)
// Este archivo SOLO se ejecuta en el servidor (API route).
// La API key nunca llega al navegador.
// =====================================================

import Anthropic from '@anthropic-ai/sdk';
import { getSystemPrompt } from './systemPrompt';
import type { ChatRequest, ChatResponse } from './types';

// Modelo del bot. Por defecto Haiku 4.5: rápido y ~70% más barato que Sonnet,
// suficiente para tomar pedidos, confirmar datos y responder objeciones.
// Para volver a Sonnet, define en Vercel la variable:  QUINCHAT_MODEL=claude-sonnet-4-6
const MODEL = process.env.QUINCHAT_MODEL || 'claude-haiku-4-5-20251001';

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
 * Modelo: ver constante MODEL (por defecto Haiku 4.5, con caché de prompt).
 */
export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const client = getClient();

  // Validación básica
  if (!req.messages || req.messages.length === 0) {
    throw new Error('Se requiere al menos un mensaje.');
  }

  // Límite de historial: 20 turnos. Suficiente para no perder el hilo del pedido
  // y bastante más barato que mandar 50 en cada mensaje (esos tokens NO se cachean).
  const MAX_HISTORY = 20;
  const messages = req.messages.slice(-MAX_HISTORY);

  // Las fotos del cliente se adjuntan al ÚLTIMO mensaje, para que el modelo
  // pueda verlas (reconocer el modelo del buzo, leer un comprobante, etc.).
  const fotos = (req.imagenes ?? []).filter(i => i?.base64);
  const armados = messages.map((m, i) => {
    const esUltimo = i === messages.length - 1;
    if (!esUltimo || fotos.length === 0 || m.role !== 'user') {
      return { role: m.role, content: m.content };
    }
    return {
      role: m.role,
      content: [
        ...fotos.map(f => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: (f.mimeType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: f.base64,
          },
        })),
        { type: 'text' as const, text: m.content || 'Mira esta foto.' },
      ],
    };
  });

  // El prompt del sistema (con el catálogo + reglas) es lo más largo y estable.
  // Lo marcamos con cache_control para que Claude lo cachee: en los mensajes
  // siguientes de la misma conversación (dentro de ~5 min) no se reprocesa y
  // cuesta ~10% de lo normal. Ese es el gran ahorro.
  const systemText = req.systemPrompt ?? getSystemPrompt(req.tenantId);
  // Bloque 1 (estable): se cachea. Con TTL de 1 HORA (en vez de 5 min) la misma
  // caché se REUTILIZA muchísimo más entre clientes y mensajes, así casi no se
  // REESCRIBE (que es lo caro). Bloque 2 (dinámico): datos del cliente; NO se cachea.
  const bloqueDinamico: any[] = (req.systemDynamic && req.systemDynamic.trim())
    ? [{ type: 'text', text: req.systemDynamic }]
    : [];

  const crear = (ttlLargo: boolean) => client.messages.create({
    model: MODEL,
    max_tokens: req.maxTokens ?? 1024,
    system: [
      { type: 'text', text: systemText, cache_control: ttlLargo ? { type: 'ephemeral', ttl: '1h' } : { type: 'ephemeral' } },
      ...bloqueDinamico,
    ] as any,
    messages: armados as any,
  }, ttlLargo ? { headers: { 'anthropic-beta': 'extended-cache-ttl-2025-04-11' } } : undefined);

  // Intenta con caché de 1h; si el entorno no la soporta, cae a la de 5 min
  // (comportamiento anterior) para NO romper nunca la respuesta del bot.
  let response;
  try { response = await crear(true); }
  catch { response = await crear(false); }

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

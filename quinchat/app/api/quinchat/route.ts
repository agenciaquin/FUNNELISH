// =====================================================
// QUINCHAT — API Route segura
// POST /api/quinchat
//
// La ANTHROPIC_API_KEY solo existe en el servidor.
// El cliente (browser) nunca la ve.
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/quinchat/claude';
import type { ChatRequest, ChatErrorResponse } from '@/lib/quinchat/types';

// Limitar tamaño del body para evitar abusos
export const maxDuration = 30; // segundos (límite Vercel hobby plan)

export async function POST(req: NextRequest) {
  try {
    // Parsear y validar el body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json<ChatErrorResponse>(
        { error: 'Body inválido — se espera JSON.' },
        { status: 400 }
      );
    }

    const { messages, tenantId } = body as Partial<ChatRequest>;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json<ChatErrorResponse>(
        { error: 'Se requiere al menos un mensaje en el array "messages".' },
        { status: 400 }
      );
    }

    // Validar estructura de cada mensaje
    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        return NextResponse.json<ChatErrorResponse>(
          { error: 'Cada mensaje debe tener "role" y "content" (string).' },
          { status: 400 }
        );
      }
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        return NextResponse.json<ChatErrorResponse>(
          { error: 'Role inválido. Solo se permiten "user" y "assistant".' },
          { status: 400 }
        );
      }
    }

    // Llamar a Claude (server-side, con la API key del entorno)
    const result = await chat({ messages, tenantId });

    return NextResponse.json(result, { status: 200 });

  } catch (err: unknown) {
    console.error('[QUINCHAT API] Error:', err);

    // Error de configuración (sin API key)
    if (err instanceof Error && err.message.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json<ChatErrorResponse>(
        { error: 'El servicio no está configurado correctamente. Contacta al administrador.', code: 'MISSING_API_KEY' },
        { status: 503 }
      );
    }

    // Error de rate limit de Anthropic
    if (err instanceof Error && err.message.includes('rate limit')) {
      return NextResponse.json<ChatErrorResponse>(
        { error: 'Demasiadas solicitudes. Espera unos segundos e intenta de nuevo.', code: 'RATE_LIMIT' },
        { status: 429 }
      );
    }

    return NextResponse.json<ChatErrorResponse>(
      { error: 'Error interno del servidor. Intenta de nuevo.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// =====================================================
// FUTURO: GET /api/whatsapp/webhook
// Verificación del webhook de Meta (token challenge)
//
// FUTURO: POST /api/whatsapp/webhook
// Recibe mensajes de WhatsApp, llama a chat(), responde via API de Meta
// =====================================================

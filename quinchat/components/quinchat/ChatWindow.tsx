'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import type { ChatMessage, ChatRequest, ChatResponse, ChatErrorResponse } from '@/lib/quinchat/types';

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! 👋 Soy QUINCHAT, el asistente de KLIXMANT.\n¿En qué te puedo ayudar hoy? 🖤✨',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Hacer scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setError(null);

    // Agregar mensaje del usuario optimistamente
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const body: ChatRequest = {
        messages: updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      const res = await fetch('/api/quinchat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = (await res.json()) as ChatErrorResponse;
        throw new Error(errData.error || `Error ${res.status}`);
      }

      const data = (await res.json()) as ChatResponse;

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.message,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
      // Quitar el mensaje del usuario si falló (para que pueda reintentar)
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  function clearChat() {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: '¡Hola! 👋 Soy QUINCHAT, el asistente de KLIXMANT.\n¿En qué te puedo ayudar hoy? 🖤✨',
        timestamp: Date.now(),
      },
    ]);
    setError(null);
  }

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A2A] bg-[#0D0D0D]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-gold flex items-center justify-center text-brand-black font-bold text-sm">
            Q
          </div>
          <div>
            <p className="text-brand-white font-semibold text-sm leading-tight">QUINCHAT</p>
            <p className="text-brand-gold text-xs">Asistente KLIXMANT</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Indicador online */}
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            En línea
          </span>
          {/* Botón limpiar */}
          <button
            onClick={clearChat}
            title="Limpiar conversación"
            className="text-gray-600 hover:text-brand-gold transition-colors text-xs"
          >
            ✕ Limpiar
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0 scroll-smooth">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && <TypingIndicator />}

        {error && (
          <div className="text-center mb-4">
            <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2 inline-block">
              ⚠️ {error}
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={sendMessage}
        disabled={isLoading}
      />
    </div>
  );
}

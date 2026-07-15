'use client';

import { useState, useRef, useEffect } from 'react';
import type { Conversation, Message, ConversationStatus } from '@/lib/panel/types';
import { STATUS_CONFIG } from '@/lib/panel/types';
import { createBrowserSupabaseClient } from '@/lib/supabase';

function formatMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  conversation: Conversation | null;
  messages: Message[];
  onMessageSent: (msg: Message) => void;
  onConversationsUpdate: () => void;
}

export default function ChatArea({ conversation, messages, onMessageSent, onConversationsUpdate }: Props) {
  const [input, setInput]           = useState('');
  const [sending, setSending]       = useState(false);
  const [botEnabled, setBotEnabled] = useState(true);
  const [status, setStatus]         = useState<ConversationStatus>('nuevo');
  const [statusOpen, setStatusOpen] = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase    = createBrowserSupabaseClient();

  // Sync with selected conversation
  useEffect(() => {
    setBotEnabled(conversation?.bot_enabled ?? true);
    setStatus((conversation?.status ?? 'nuevo') as ConversationStatus);
    setStatusOpen(false);
  }, [conversation?.id, conversation?.bot_enabled, conversation?.status]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [input]);

  // Close status dropdown on outside click
  useEffect(() => {
    if (!statusOpen) return;
    const handler = () => setStatusOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [statusOpen]);

  async function sendMessage() {
    if (!input.trim() || !conversation || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: conversation.id, message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        onMessageSent({
          id: data.id ?? `agent-${Date.now()}`,
          conversation_id: conversation.id,
          content: text,
          role: 'agent',
          type: 'text',
          created_at: new Date().toISOString(),
        });
        onConversationsUpdate();
      } else {
        const err = await res.json();
        console.error('[Send error]', err);
        alert('No se pudo enviar el mensaje. Verifica los credenciales de WhatsApp.');
        setInput(text);
      }
    } catch (e) {
      console.error('[Send error]', e);
      setInput(text);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  async function toggleBot() {
    if (!conversation) return;
    const newVal = !botEnabled;
    setBotEnabled(newVal);
    await supabase
      .from('conversations')
      .update({ bot_enabled: newVal })
      .eq('id', conversation.id);
  }

  async function changeStatus(newStatus: ConversationStatus) {
    if (!conversation) return;
    setStatus(newStatus);
    setStatusOpen(false);
    await supabase
      .from('conversations')
      .update({ status: newStatus })
      .eq('id', conversation.id);
    onConversationsUpdate();
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0A0A0A] text-gray-700 select-none">
        <div className="text-5xl mb-3 opacity-20">💬</div>
        <p className="text-sm text-gray-600">No se ha seleccionado ninguna conversación</p>
      </div>
    );
  }

  const initial = conversation.contact_name.charAt(0).toUpperCase() || '?';
  const statusCfg = STATUS_CONFIG[status];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1C1C1C] bg-[#080808] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center text-sm font-bold text-[#C9A84C]">
            {initial}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{conversation.contact_name}</div>
            <div className="text-[10px] text-gray-600">+{conversation.id}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status selector */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setStatusOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
              style={{ color: statusCfg.color, background: statusCfg.bg, borderColor: statusCfg.border }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusCfg.color }} />
              {statusCfg.label}
              <span className="text-[10px] opacity-60">▾</span>
            </button>

            {statusOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#111] border border-[#252525] rounded-xl shadow-xl z-20 overflow-hidden min-w-[150px]">
                {(Object.keys(STATUS_CONFIG) as ConversationStatus[]).map(s => {
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => changeStatus(s)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-all hover:bg-white/5 ${
                        status === s ? 'bg-white/[0.04]' : ''
                      }`}
                      style={{ color: cfg.color }}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
                      {cfg.label}
                      {status === s && <span className="ml-auto text-[10px] opacity-60">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bot toggle */}
          <button
            onClick={toggleBot}
            title={botEnabled ? 'Bot activo — click para pausar' : 'Bot pausado — click para activar'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              botEnabled
                ? 'bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/25 hover:bg-[#C9A84C]/20'
                : 'bg-white/[0.04] text-gray-500 border-white/10 hover:text-gray-300'
            }`}
          >
            🤖 Bot {botEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-2">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-24 text-gray-700 text-xs">
            Sin mensajes aún
          </div>
        )}

        {messages.map(msg => {
          const isOutgoing = msg.role === 'assistant' || msg.role === 'agent';

          return (
            <div key={msg.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[68%] px-3.5 py-2.5 rounded-2xl text-sm leading-snug relative ${
                  isOutgoing
                    ? 'bg-[#C9A84C] text-black rounded-br-sm'
                    : 'bg-[#1A1A1A] text-white border border-[#252525] rounded-bl-sm'
                }`}
              >
                {msg.role === 'agent' && (
                  <span className="text-[9px] text-black/50 font-semibold uppercase tracking-wide block mb-0.5">
                    Agente
                  </span>
                )}
                {msg.role === 'assistant' && (
                  <span className="text-[9px] text-black/50 font-semibold uppercase tracking-wide block mb-0.5">
                    Bot IA
                  </span>
                )}

                <span className="whitespace-pre-wrap break-words">{msg.content}</span>

                <div className={`text-[9px] mt-1.5 text-right ${isOutgoing ? 'text-black/40' : 'text-gray-600'}`}>
                  {formatMsgTime(msg.created_at)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="px-4 py-3 border-t border-[#1C1C1C] bg-[#080808] shrink-0">
        {!botEnabled && (
          <div className="mb-2 text-[10px] text-[#C9A84C]/70 text-center">
            Bot pausado — respondiendo manualmente
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
            rows={1}
            className="flex-1 bg-[#141414] border border-[#252525] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40 resize-none transition-colors leading-relaxed"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            title="Enviar"
            className="w-10 h-10 bg-[#C9A84C] text-black rounded-xl flex items-center justify-center text-base font-bold shrink-0 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#d4b05c] active:scale-95 transition-all"
          >
            {sending ? <span className="animate-spin text-xs">⏳</span> : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
}

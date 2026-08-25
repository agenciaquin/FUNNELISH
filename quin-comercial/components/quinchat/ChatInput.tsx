'use client';

import { useRef, useEffect, KeyboardEvent } from 'react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export default function ChatInput({ value, onChange, onSend, disabled }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ajustar altura del textarea automáticamente
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [value]);

  // Enter = enviar, Shift+Enter = salto de línea
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  }

  return (
    <div className="flex items-end gap-3 p-4 border-t border-[#2A2A2A] bg-[#0D0D0D]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Escribe tu mensaje..."
        rows={1}
        className="
          flex-1 resize-none bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl
          px-4 py-3 text-sm text-brand-white placeholder-gray-600
          focus:outline-none focus:border-brand-gold transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          leading-relaxed
        "
      />

      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        aria-label="Enviar mensaje"
        className="
          w-11 h-11 flex-shrink-0 rounded-xl bg-brand-gold text-brand-black
          flex items-center justify-center
          hover:bg-brand-gold-light active:bg-brand-gold-dark
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors
        "
      >
        {/* Ícono de enviar */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
        </svg>
      </button>
    </div>
  );
}

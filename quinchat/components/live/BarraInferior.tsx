'use client';

import { useState } from 'react';

/**
 * Barra inferior fija: [ COMPRAR AHORA ] [ Deja tu comentario… ] [ Compartir ].
 * COMPRAR AHORA es el botón principal (≈48 % del ancho, 60 px de alto).
 */
interface Props {
  onComprar: () => void;
  onComentar: (texto: string) => void;
  onCompartir: () => void;
}

export default function BarraInferior({ onComprar, onComentar, onCompartir }: Props) {
  const [texto, setTexto] = useState('');

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    onComentar(t.slice(0, 140));
    setTexto('');
  };

  return (
    <div className="pointer-events-auto flex items-center gap-2 bg-black px-3 pt-2.5 pb-[max(env(safe-area-inset-bottom),10px)]">
      <button
        onClick={onComprar}
        className="basis-[48%] shrink-0 min-w-0 h-[60px] rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white font-extrabold uppercase whitespace-nowrap flex items-center justify-center gap-1.5 shadow-[0_6px_18px_rgba(255,60,80,.45)] active:scale-95 transition-transform text-[clamp(12px,3.9vw,16px)]"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 7h12l1 13H5L6 7z" /><path d="M9 10V6a3 3 0 0 1 6 0v4" />
        </svg>
        Comprar ahora
      </button>
      <form onSubmit={enviar} className="flex-1 min-w-0">
        <input
          id="live-comentario"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          maxLength={140}
          enterKeyHint="send"
          placeholder="Deja tu comentario…"
          aria-label="Escribe un comentario"
          className="w-full h-11 rounded-full border border-white/20 bg-white/10 px-3 text-[12.5px] text-white placeholder:text-white/55 focus:outline-none focus:border-white/50"
        />
      </form>
      <button onClick={onCompartir} aria-label="Compartir" className="shrink-0 w-10 h-11 flex items-center justify-center text-white active:scale-90 transition-transform">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 4l7 6-7 6v-4c-5 0-8 1.5-10 6 0-6 3-11 10-11V4z" />
        </svg>
      </button>
    </div>
  );
}

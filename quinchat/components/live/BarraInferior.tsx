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
    <div className="pointer-events-auto flex items-center gap-2 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),10px)] bg-gradient-to-t from-black/75 to-black/30">
      {/* Botón principal: blanco, discreto y elegante */}
      <button
        onClick={onComprar}
        className="shrink-0 h-[52px] w-[clamp(132px,40vw,165px)] rounded-[12px] bg-white text-neutral-900 font-extrabold whitespace-nowrap flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,.25)] active:scale-[.97] transition-transform text-[15px] tracking-wide"
      >
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 7h12l1 13H5L6 7z" /><path d="M9 10V6a3 3 0 0 1 6 0v4" />
        </svg>
        ¡COMPRAR!
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
          className="w-full h-[46px] rounded-full border border-white/15 bg-black/40 backdrop-blur-sm px-4 text-[13px] text-white placeholder:text-white/55 focus:outline-none focus:border-white/40"
        />
      </form>
      <button onClick={onCompartir} aria-label="Compartir" className="shrink-0 w-9 h-11 flex items-center justify-center text-white/85 active:scale-90 transition-transform">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 4l7 6-7 6v-4c-5 0-8 1.5-10 6 0-6 3-11 10-11V4z" />
        </svg>
      </button>
    </div>
  );
}

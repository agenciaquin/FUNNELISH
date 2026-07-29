'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reproduce una canción de fondo en la página de venta.
 *
 * Los navegadores NO dejan que una página arranque sonido sola al entrar, así
 * que la música empieza en el primer gesto de la persona (toque, deslizar,
 * clic). En celular eso ocurre casi de inmediato. Igual dejamos un botón
 * flotante para silenciar o volver a poner la música cuando quiera.
 */
export default function MusicaFondo({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [sonando, setSonando] = useState(false);
  const [arrancó, setArrancó] = useState(false);

  useEffect(() => {
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;

    const intentar = () => {
      audio.play().then(() => {
        setSonando(true);
        setArrancó(true);
        quitar();
      }).catch(() => { /* aún no hay permiso: se reintenta en el próximo gesto */ });
    };

    const quitar = () => {
      ['pointerdown', 'touchstart', 'keydown', 'scroll'].forEach(ev =>
        window.removeEventListener(ev, intentar));
    };

    // Se intenta ya (por si el navegador lo permite) y en el primer gesto
    intentar();
    ['pointerdown', 'touchstart', 'keydown', 'scroll'].forEach(ev =>
      window.addEventListener(ev, intentar, { passive: true }));

    return () => { quitar(); audio.pause(); audioRef.current = null; };
  }, [url]);

  function alternar() {
    const audio = audioRef.current;
    if (!audio) return;
    if (sonando) { audio.pause(); setSonando(false); }
    else { audio.play().then(() => { setSonando(true); setArrancó(true); }).catch(() => {}); }
  }

  return (
    <button
      onClick={alternar}
      aria-label={sonando ? 'Silenciar música' : 'Poner música'}
      className="fixed bottom-3 right-3 z-40 w-11 h-11 rounded-full bg-black/75 text-white shadow-lg flex items-center justify-center text-lg backdrop-blur"
    >
      <span className={sonando ? 'animate-pulse' : ''}>{sonando ? '🔊' : '🔇'}</span>
      {/* Puntico que invita a tocar hasta que arranca la primera vez */}
      {!arrancó && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#3DC12A] border-2 border-white animate-pulse" />
      )}
    </button>
  );
}

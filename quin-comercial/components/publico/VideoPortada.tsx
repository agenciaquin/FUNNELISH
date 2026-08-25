'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Video de portada del embudo. Arranca solo (los navegadores solo permiten
 * autoplay si va SIN sonido), así que empieza en silencio y se activa el audio
 * en el primer toque de la persona. También hay un botón para silenciar/activar.
 */
export default function VideoPortada({ url, poster }: { url: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [conSonido, setConSonido] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    const activarSonido = () => {
      if (!ref.current) return;
      ref.current.muted = false;
      ref.current.volume = 1;
      ref.current.play().then(() => setConSonido(true)).catch(() => {});
      quitar();
    };
    const quitar = () => ['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
      window.removeEventListener(ev, activarSonido));

    v.play().catch(() => {}); // arranca en silencio
    ['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
      window.addEventListener(ev, activarSonido, { passive: true }));

    return quitar;
  }, [url]);

  function alternar(e: React.MouseEvent) {
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    if (conSonido) { v.muted = true; setConSonido(false); }
    else { v.muted = false; v.volume = 1; v.play().catch(() => {}); setConSonido(true); }
  }

  return (
    <div className="relative bg-black">
      <video
        ref={ref}
        src={url}
        poster={poster}
        loop
        muted
        playsInline
        autoPlay
        onPause={() => { ref.current?.play().catch(() => {}); }}
        className="w-full max-h-[80vh] object-contain"
      />
      {/* Botón de sonido siempre visible */}
      <button
        onClick={alternar}
        aria-label={conSonido ? 'Silenciar video' : 'Activar sonido'}
        className="absolute top-2 right-2 z-10 w-10 h-10 rounded-full bg-black/70 text-white flex items-center justify-center text-lg shadow-lg backdrop-blur"
      >{conSonido ? '🔊' : '🔇'}</button>
      {!conSonido && (
        <button
          onClick={alternar}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-white/90 text-black text-xs font-bold shadow-lg animate-pulse"
        >🔊 Toca para activar el sonido</button>
      )}
    </div>
  );
}

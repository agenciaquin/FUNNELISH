'use client';

import { useEffect, useRef, useState } from 'react';
import { esVideo, imgOptim } from '@/lib/funnels';

// Solo UN video de la página se queda con el sonido, para que no suenen varios a la vez.
let audioTomado = false;

/**
 * Muestra una foto o un video según el enlace. El video corre en bucle y NO se
 * pausa al tocar. El sonido se enciende con el primer TOQUE real (no con el
 * scroll: el scroll no da permiso de audio en los navegadores). Tocar el video
 * o el botón también activa/silencia el sonido.
 */
export default function Medio({
  url, alt = '', className = '', poster,
}: { url: string; alt?: string; className?: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const video = esVideo(url);
  const [sonando, setSonando] = useState(false);

  // Enciende el sonido de verdad. Devuelve true si quedó sonando.
  function encender(): boolean {
    const v = ref.current;
    if (!v) return false;
    v.muted = false;
    v.volume = 1;
    v.play().catch(() => {});
    const ok = !v.muted;
    setSonando(ok);
    return ok;
  }

  useEffect(() => {
    if (!video) return;
    const v = ref.current;
    if (!v) return;

    // Solo toques/teclas reales dan permiso de audio (el scroll NO)
    const eventos = ['pointerdown', 'touchstart', 'click', 'keydown'];
    const activar = () => {
      if (audioTomado || !ref.current) return;
      audioTomado = true;
      encender();
      quitar();
    };
    const quitar = () => eventos.forEach(ev => window.removeEventListener(ev, activar));

    v.play().catch(() => {}); // arranca en silencio
    eventos.forEach(ev => window.addEventListener(ev, activar, { passive: true }));

    return quitar;
  }, [video, url]);

  if (video) {
    return (
      <div className="relative">
        <video
          ref={ref}
          src={url}
          poster={poster}
          className={`${className} cursor-pointer`}
          muted
          loop
          playsInline
          autoPlay
          onPause={() => { ref.current?.play().catch(() => {}); }}
          onClick={() => {
            const v = ref.current;
            if (!v) return;
            if (v.muted) { audioTomado = true; encender(); }
            else { v.muted = true; setSonando(false); }
          }}
        />
        <button
          onClick={() => {
            const v = ref.current;
            if (!v) return;
            if (v.muted) { audioTomado = true; encender(); }
            else { v.muted = true; setSonando(false); }
          }}
          aria-label={sonando ? 'Silenciar' : 'Activar sonido'}
          className="absolute bottom-2 right-2 z-10 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center text-lg shadow-lg backdrop-blur"
        >{sonando ? '🔊' : '🔇'}</button>
        {!sonando && (
          <span className="absolute bottom-2 left-2 z-10 px-2.5 py-1 rounded-full bg-black/60 text-white text-[11px] font-semibold shadow-lg backdrop-blur animate-pulse">
            🔊 Toca para el sonido
          </span>
        )}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imgOptim(url, 900)} alt={alt} className={className} loading="lazy" />;
}

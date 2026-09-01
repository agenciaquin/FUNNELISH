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

    // El video NO arranca al cargar la página, sino cuando se acerca a la
    // pantalla. Antes se llamaba a `play()` aquí mismo, y como estos videos van
    // en secciones de más abajo (`imagen_clientes`, `imagen_detalle`), el
    // cliente se descargaba el archivo entero aunque no bajara nunca hasta él:
    // el de `pareja` pesa 23 MB. El `play()` es también lo que dispara la
    // descarga, así que retrasarlo es lo que ahorra los bytes; por eso los
    // escuchadores de audio se registran a la vez y no antes.
    let arrancado = false;
    const arrancar = () => {
      if (arrancado || !ref.current) return;
      arrancado = true;
      ref.current.play().catch(() => {}); // arranca en silencio
      eventos.forEach(ev => window.addEventListener(ev, activar, { passive: true }));
    };

    if (typeof IntersectionObserver === 'undefined') {
      arrancar(); // navegador sin soporte: como estaba antes
      return quitar;
    }

    // 300px de margen: empieza a cargar un poco antes de asomar, para que no se
    // vea el recuadro en negro al llegar.
    const vigia = new IntersectionObserver(
      entradas => { if (entradas.some(e => e.isIntersecting)) { arrancar(); vigia.disconnect(); } },
      { rootMargin: '300px' },
    );
    vigia.observe(v);

    return () => { vigia.disconnect(); quitar(); };
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
          // Sin `autoPlay` y con `preload="none"` el navegador no pide ni un
          // byte hasta que el vigía de arriba llama a `play()`. Con `autoPlay`
          // la descarga empieza al montar y el vigía no serviría de nada.
          preload="none"
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

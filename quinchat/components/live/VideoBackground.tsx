'use client';

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';

/**
 * CAPA 1 — VIDEO DE FONDO.
 * Su único trabajo es reproducir el video (9:16, pantalla completa, object-fit: cover).
 * No contiene comentarios, botones ni productos. Reporta el tiempo hacia arriba y nada más.
 */

export interface VideoHandle {
  setMuted: (silenciado: boolean) => void;
  reproducir: () => Promise<void>;
}

interface Props {
  src: string;
  poster?: string;
  handleRef?: Ref<VideoHandle>;
  onTiempo?: (segundos: number) => void;
  /** Primera vez que el video realmente se reproduce. */
  onPrimeraReproduccion?: () => void;
  /** El navegador bloqueó el autoplay (hay que mostrar un botón en el overlay). */
  onAutoplayBloqueado?: () => void;
  onReproduciendo?: (reproduciendo: boolean) => void;
}

/**
 * ÚNICO lugar que conoce el formato de la fuente.
 * Hoy: MP4 directo (Cloudflare R2). Para pasar a HLS basta con completar el
 * bloque .m3u8 con hls.js; el resto de la app no cambia.
 */
function conectarFuente(video: HTMLVideoElement, src: string): () => void {
  const esHls = /\.m3u8(\?|$)/i.test(src);
  if (esHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
    // TODO HLS: const Hls = (await import('hls.js')).default; const h = new Hls(); h.loadSource(src); h.attachMedia(video); return () => h.destroy();
    console.warn('[QUIN LIVE] Fuente HLS: falta instalar hls.js (fase siguiente).');
    return () => {};
  }
  video.src = src;
  return () => { video.removeAttribute('src'); video.load(); };
}

export default function VideoBackground({ src, poster, handleRef, onTiempo, onPrimeraReproduccion, onAutoplayBloqueado, onReproduciendo }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const quiereReproducir = useRef(true);
  const yaReprodujo = useRef(false);

  useImperativeHandle(handleRef, () => ({
    setMuted: (m: boolean) => { if (ref.current) ref.current.muted = m; },
    reproducir: async () => { quiereReproducir.current = true; await ref.current?.play(); },
  }), []);

  // Fuente + autoplay en silencio
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const desconectar = conectarFuente(v, src);
    v.play().catch(() => onAutoplayBloqueado?.());
    return desconectar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Se pausa cuando la pestaña no está visible (ahorra datos y batería)
  useEffect(() => {
    const alCambiar = () => {
      const v = ref.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else if (quiereReproducir.current) v.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, []);

  return (
    <video
      ref={ref}
      className="absolute inset-0 w-full h-full object-cover bg-black"
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      disablePictureInPicture
      controls={false}
      onTimeUpdate={e => onTiempo?.(e.currentTarget.currentTime)}
      onPlaying={() => {
        onReproduciendo?.(true);
        if (!yaReprodujo.current) { yaReprodujo.current = true; onPrimeraReproduccion?.(); }
      }}
      onPause={() => onReproduciendo?.(false)}
    />
  );
}

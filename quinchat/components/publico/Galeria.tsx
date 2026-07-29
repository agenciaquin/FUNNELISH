'use client';

import { useState, useEffect, useRef } from 'react';
import { esVideo } from '@/lib/funnels';

/** Carrusel de fotos del producto. Avanza solo, y se detiene si el cliente toca. */
export default function Galeria({
  imagenes, alt, segundos = 2,
}: { imagenes: string[]; alt: string; segundos?: number }) {
  const [i, setI] = useState(0);
  const [manual, setManual] = useState(false); // el cliente tomó el control
  const total = imagenes.length;
  const tocado = useRef(false);

  useEffect(() => {
    if (total < 2 || manual) return;
    const t = setInterval(() => setI(prev => (prev + 1) % total), segundos * 1000);
    return () => clearInterval(t);
  }, [total, manual, segundos]);

  if (total === 0) return null;

  const mover = (d: number) => {
    setManual(true); // si navega a mano, deja de moverse solo
    setI(prev => (prev + d + total) % total);
  };

  const irA = (idx: number) => { setManual(true); setI(idx); };

  return (
    <div className="w-full">
      <div
        className="relative bg-[#F2F2F2] overflow-hidden"
        onTouchStart={() => { tocado.current = true; setManual(true); }}
      >
        {/* Todas cargadas y superpuestas: el cambio es suave, sin parpadeo */}
        <div className="relative w-full aspect-square">
          {imagenes.map((src, idx) => {
            const clase = `absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              idx === i ? 'opacity-100' : 'opacity-0'
            }`;
            return esVideo(src) ? (
              <video
                key={idx} src={src} className={clase}
                muted loop playsInline autoPlay controls={idx === i}
                onClick={e => { const v = e.currentTarget; if (v.muted) { v.muted = false; v.play().catch(() => {}); } }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={idx} src={src} alt={alt} className={clase} loading={idx === 0 ? 'eager' : 'lazy'} />
            );
          })}
        </div>

        {total > 1 && (
          <>
            <button
              onClick={() => mover(-1)}
              aria-label="Anterior"
              className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-14 text-white text-3xl font-light drop-shadow-lg"
            >❮</button>
            <button
              onClick={() => mover(1)}
              aria-label="Siguiente"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-14 text-white text-3xl font-light drop-shadow-lg"
            >❯</button>

            {/* Puntitos de posición */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {imagenes.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === i ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex gap-1 p-1 bg-white overflow-x-auto">
          {imagenes.map((src, idx) => (
            <button
              key={idx}
              onClick={() => irA(idx)}
              className={`shrink-0 w-[23%] border-2 transition-colors ${
                idx === i ? 'border-[#0D8A3E]' : 'border-transparent'
              }`}
              aria-label={`Medio ${idx + 1}`}
            >
              {esVideo(src) ? (
                <div className="w-full aspect-square bg-black flex items-center justify-center text-white text-lg">▶</div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="w-full aspect-square object-cover" loading="lazy" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

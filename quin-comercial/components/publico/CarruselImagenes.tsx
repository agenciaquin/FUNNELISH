'use client';

import { useState, useEffect } from 'react';
import { esVideo } from '@/lib/funnels';
import { claseAnim } from '@/lib/bloque-estilo';

/**
 * Bloque "Carrusel de imágenes": foto grande + miniaturas debajo, con puntos,
 * paso automático (se detiene al tocar), botón opcional "Más vendido", tamaño y
 * animación de entrada. Todo se controla desde los props del bloque.
 */
export default function CarruselImagenes({ props }: { props?: Record<string, any> }) {
  const p = props ?? {};
  const urls: string[] = Array.isArray(p.urls) ? p.urls.filter(Boolean) : [];
  const total = urls.length;
  const [i, setI] = useState(0);
  const [manual, setManual] = useState(false);
  const auto = p.autoplay !== false;
  const seg = Math.max(1, Number(p.segundos) || 3);
  const rad = Number(p.redondeado) || 0;
  const h = Number(p.h) || 0;
  const ancho = Number(p.ancho) > 0 ? Number(p.ancho) : 100;
  const ajuste = p.ajuste === 'contain' ? 'contain' : 'cover';

  useEffect(() => {
    if (total < 2 || !auto || manual) return;
    const t = setInterval(() => setI(prev => (prev + 1) % total), seg * 1000);
    return () => clearInterval(t);
  }, [total, auto, manual, seg]);

  if (total === 0) return null;

  const irA = (idx: number) => { setManual(true); setI(((idx % total) + total) % total); };
  const activo = Math.min(i, total - 1);

  return (
    <div className={`px-3 py-3 ${claseAnim(p.anim)}`}>
      <div className="relative mx-auto overflow-hidden" style={{ borderRadius: rad, width: ancho < 100 ? `${ancho}%` : undefined, maxWidth: 520 }}>
        <div className="relative w-full bg-[#F2F2F2]" style={{ height: h > 0 ? h : undefined, aspectRatio: h > 0 ? undefined : '1 / 1' }}
          onTouchStart={() => setManual(true)}>
          {urls.map((src, idx) => {
            const clase = `absolute inset-0 w-full h-full transition-opacity duration-500 ${idx === activo ? 'opacity-100' : 'opacity-0'}`;
            return esVideo(src) ? (
              <video key={idx} src={src} className={clase} style={{ objectFit: ajuste }} muted loop playsInline autoPlay />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={idx} src={src} alt="" className={clase} style={{ objectFit: ajuste }} loading={idx === 0 ? 'eager' : 'lazy'} />
            );
          })}
          {p.masVendido && (
            <div className="absolute top-2 left-2 text-[12px] font-extrabold rounded-full px-2.5 py-1 shadow" style={{ background: p.mvColor || '#C1121F', color: p.mvColorTexto || '#fff' }}>
              {p.mvTexto || '🔥 MÁS VENDIDO'}
            </div>
          )}
          {total > 1 && (
            <>
              <button onClick={() => irA(activo - 1)} aria-label="Anterior" className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-14 text-white text-3xl font-light drop-shadow-lg">‹</button>
              <button onClick={() => irA(activo + 1)} aria-label="Siguiente" className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-14 text-white text-3xl font-light drop-shadow-lg">›</button>
            </>
          )}
        </div>
      </div>

      {/* Puntos */}
      {p.dots !== false && total > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {urls.map((_, idx) => (
            <button key={idx} onClick={() => irA(idx)} aria-label={`Ir a la foto ${idx + 1}`}
              className={`h-2 rounded-full transition-all ${idx === activo ? 'w-5 bg-[#0D0D0D]' : 'w-2 bg-[#CFCFCF]'}`} />
          ))}
        </div>
      )}

      {/* Miniaturas */}
      {p.miniaturas !== false && total > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto justify-center">
          {urls.map((u, idx) => (
            <button key={idx} onClick={() => irA(idx)} className={`shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${idx === activo ? 'border-[#00A89D]' : 'border-transparent'}`}>
              {esVideo(u)
                ? <video src={u} className="w-14 h-14 object-cover" muted playsInline />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={u} alt="" className="w-14 h-14 object-cover" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

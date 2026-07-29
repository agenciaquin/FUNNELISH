'use client';

import { useEffect, useRef, useState } from 'react';
import { esVideo } from '@/lib/funnels';

/**
 * Miniatura flotante opcional (foto o video) sobre la página de venta.
 * Aparece pequeña en una esquina, engancha la mirada, y al tocarla se agranda.
 * El cliente la puede cerrar con la ✕ para que no le estorbe.
 */
export default function MiniaturaFlotante({ url }: { url: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [grande, setGrande]   = useState(false);
  const [cerrada, setCerrada] = useState(false);
  const [sonando, setSonando] = useState(false);
  const video = esVideo(url);

  // Entra a los 2 segundos, para no competir con lo primero que ve el cliente
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, []);

  if (cerrada) return null;

  function alTocar() {
    const v = ref.current;
    if (!grande) {
      setGrande(true);
      if (v) { v.muted = false; v.volume = 1; v.play().catch(() => {}); setSonando(true); }
    } else if (v) {
      // Ya grande: el toque activa o silencia el sonido
      if (v.muted) { v.muted = false; v.play().catch(() => {}); setSonando(true); }
      else { v.muted = true; setSonando(false); }
    }
  }

  return (
    <div
      className={`fixed z-40 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      } ${grande ? 'bottom-4 right-3 w-64' : 'top-20 right-3 w-28'}`}
    >
      <div className="relative rounded-xl overflow-hidden shadow-2xl border-2 border-white bg-black">
        {video ? (
          <video
            ref={ref}
            src={url}
            className="w-full h-full object-cover cursor-pointer"
            muted loop playsInline autoPlay
            onPause={() => { ref.current?.play().catch(() => {}); }}
            onClick={alTocar}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={alTocar} />
        )}

        {/* Cerrar */}
        <button
          onClick={(e) => { e.stopPropagation(); setCerrada(true); }}
          aria-label="Cerrar"
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-black/80 text-white text-xs flex items-center justify-center shadow-lg"
        >✕</button>

        {/* Aviso de sonido, solo para video y mientras esté en silencio */}
        {video && !sonando && (
          <span className="absolute bottom-1 left-1 right-1 text-center text-[9px] font-bold text-white bg-black/60 rounded px-1 py-0.5">
            🔊 Toca para ver
          </span>
        )}
      </div>
    </div>
  );
}

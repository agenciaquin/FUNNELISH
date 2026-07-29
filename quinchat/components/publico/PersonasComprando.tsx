'use client';

import { useState, useEffect } from 'react';

/**
 * Aviso flotante de gente comprando. El número se mueve cada 15 segundos,
 * con tendencia a subir, para que no se vea estático.
 */
export default function PersonasComprando({ base = 27 }: { base?: number }) {
  const [n, setN] = useState(base);
  const [cambiando, setCambiando] = useState(false);
  const [visible, setVisible] = useState(false);

  // Aparece a los pocos segundos, no de golpe al abrir
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setCambiando(true);
      setN(prev => {
        // Sube casi siempre; de vez en cuando baja un poco para que sea creíble
        const sube = Math.random() > 0.25;
        const paso = 1 + Math.floor(Math.random() * 4);
        const nuevo = sube ? prev + paso : prev - Math.min(paso, 2);
        // Se mantiene en un rango razonable alrededor del número base
        return Math.max(Math.round(base * 0.55), Math.min(Math.round(base * 1.9), nuevo));
      });
      setTimeout(() => setCambiando(false), 600);
    }, 15000);
    return () => clearInterval(t);
  }, [base]);

  return (
    <div
      className={`fixed bottom-3 left-3 z-30 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-2 rounded-full bg-white/95 backdrop-blur border border-[#E0E0E0] shadow-lg px-3 py-2">
        <span className="relative flex w-2.5 h-2.5 shrink-0">
          <span className="absolute inline-flex w-full h-full rounded-full bg-[#3DC12A] opacity-60 animate-ping" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-[#3DC12A]" />
        </span>
        <span className="text-[12px] leading-tight">
          <strong
            className={`text-[#C1121F] transition-transform duration-300 inline-block ${
              cambiando ? 'scale-125' : 'scale-100'
            }`}
          >{n}</strong>{' '}
          <span className="text-[#0D0D0D]">personas están comprando</span>
        </span>
      </div>
    </div>
  );
}

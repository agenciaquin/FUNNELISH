'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reacciones estilo live de TikTok: corazones que SUBEN SOLOS de forma continua
 * (ritmo variable para que se sienta vivo) y además salen más al tocar.
 * Respeta prefers-reduced-motion (si está activo, no anima solo).
 */
interface Particula { id: number; dx: number; size: number; dur: number }
const MAX_PARTICULAS = 30;

export default function Reactions() {
  const [parts, setParts] = useState<Particula[]>([]);
  const sig = useRef(0);

  const lanzar = useCallback(() => {
    const id = ++sig.current;
    const dx = Math.round((Math.random() - 0.5) * 100);
    const size = 18 + Math.round(Math.random() * 18);
    const dur = 2.4 + Math.random() * 1.4;
    setParts(p => [...p.slice(-(MAX_PARTICULAS - 1)), { id, dx, size, dur }]);
    setTimeout(() => setParts(p => p.filter(x => x.id !== id)), dur * 1000 + 150);
  }, []);

  // Corazones automáticos continuos.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      lanzar();
      if (Math.random() > 0.55) setTimeout(lanzar, 160);      // a veces salen de a dos
      timer = setTimeout(loop, 650 + Math.random() * 1500);   // ritmo variable
    };
    timer = setTimeout(loop, 500);
    return () => clearTimeout(timer);
  }, [lanzar]);

  const tap = () => { lanzar(); setTimeout(lanzar, 110); if (Math.random() > 0.5) setTimeout(lanzar, 230); };

  return (
    <div className="relative flex flex-col items-center gap-2 pointer-events-auto">
      {parts.map(p => (
        <span
          key={p.id}
          aria-hidden
          className="absolute bottom-12 left-1/2 -ml-3 pointer-events-none select-none"
          style={{ fontSize: p.size, ['--dx' as string]: `${p.dx}px`, animation: `live-float ${p.dur}s ease-out forwards` }}
        >❤️</span>
      ))}
      <button onClick={tap} aria-label="Reaccionar con corazón" className="w-12 h-12 rounded-full bg-black/35 text-[26px] active:scale-90 transition-transform">❤️</button>
    </div>
  );
}

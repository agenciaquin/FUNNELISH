'use client';

import { useCallback, useRef, useState } from 'react';

/** Reacciones del PROPIO usuario: animaciones flotantes al tocar. Sin contadores ni reacciones de otros. */
interface Particula { id: number; emoji: string; dx: number }
const MAX_PARTICULAS = 24;

export default function Reactions() {
  const [parts, setParts] = useState<Particula[]>([]);
  const sig = useRef(0);

  const lanzar = useCallback((emoji: string) => {
    const id = ++sig.current;
    const dx = Math.round((Math.random() - 0.5) * 60);
    setParts(p => [...p.slice(-(MAX_PARTICULAS - 1)), { id, emoji, dx }]);
    setTimeout(() => setParts(p => p.filter(x => x.id !== id)), 1900);
  }, []);

  return (
    <div className="relative flex flex-col items-center gap-2 pointer-events-auto">
      {parts.map(p => (
        <span
          key={p.id}
          aria-hidden
          className="absolute bottom-12 left-1/2 -ml-3 text-2xl pointer-events-none select-none"
          style={{ ['--dx' as string]: `${p.dx}px`, animation: 'live-float 1.8s ease-out forwards' }}
        >{p.emoji}</span>
      ))}
      <button onClick={() => lanzar('🔥')} aria-label="Reaccionar con fuego" className="w-10 h-10 rounded-full bg-black/35 text-[20px] active:scale-90 transition-transform">🔥</button>
      <button onClick={() => lanzar('❤️')} aria-label="Reaccionar con corazón" className="w-11 h-11 rounded-full bg-black/35 text-[24px] active:scale-90 transition-transform">❤️</button>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reacciones estilo live: corazones rojos/rosados que nacen abajo a la derecha,
 * suben despacio balanceándose, con tamaños distintos, y se desvanecen.
 * Al tocar ❤ sale una ráfaga extra y el botón hace un pequeño "pop".
 * Solo CSS + JS liviano. Sin contadores ni cifras de interacciones.
 * Respeta prefers-reduced-motion (no anima solo).
 */
interface Particula { id: number; dx: number; size: number; dur: number; sway: number; color: string; delay: number }
const MAX = 26;
const COLORES = ['#ff2d55', '#ff4d6d', '#ff6b8b', '#ff8fab', '#ff3b5c', '#ffb3c6'];

function Corazon({ color, size }: { color: string; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.25))' }}>
      <path fill={color} d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

export default function Reactions() {
  const [parts, setParts] = useState<Particula[]>([]);
  const [pop, setPop] = useState(false);
  const sig = useRef(0);

  const lanzar = useCallback((rapido = false) => {
    const id = ++sig.current;
    const p: Particula = {
      id,
      dx: Math.round((Math.random() - 0.5) * 40),
      size: 16 + Math.round(Math.random() * 16),
      dur: (rapido ? 2.6 : 3.4) + Math.random() * 1.6,
      sway: 6 + Math.round(Math.random() * 10),
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
      delay: 0,
    };
    setParts(prev => [...prev.slice(-(MAX - 1)), p]);
    setTimeout(() => setParts(prev => prev.filter(x => x.id !== id)), p.dur * 1000 + 200);
  }, []);

  // Flujo continuo y suave (ritmo variable)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      lanzar();
      timer = setTimeout(loop, 900 + Math.random() * 1600);
    };
    timer = setTimeout(loop, 800);
    return () => clearTimeout(timer);
  }, [lanzar]);

  const tocar = () => {
    for (let i = 0; i < 5; i++) setTimeout(() => lanzar(true), i * 90);
    setPop(true); setTimeout(() => setPop(false), 260);
  };

  return (
    <div className="relative flex flex-col items-center pointer-events-auto">
      {/* Zona de vuelo: arranca justo encima del botón, no tapa la barra de compra */}
      <div className="absolute bottom-[46px] left-1/2 w-0 h-0 pointer-events-none">
        {parts.map(p => (
          <span key={p.id} className="absolute bottom-0 select-none"
            style={{ left: p.dx - p.size / 2, ['--sube' as string]: '-260px', animation: `live-rise ${p.dur}s ease-out forwards` }}>
            <span className="block" style={{ ['--sw' as string]: `${p.sway}px`, animation: `live-sway ${1.1 + (p.id % 3) * 0.3}s ease-in-out infinite alternate` }}>
              <Corazon color={p.color} size={p.size} />
            </span>
          </span>
        ))}
      </div>
      <button onClick={tocar} aria-label="Reaccionar con corazón"
        className={`w-11 h-11 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 ${pop ? 'scale-125' : 'scale-100'}`}>
        <Corazon color="#ff2d55" size={24} />
      </button>
    </div>
  );
}

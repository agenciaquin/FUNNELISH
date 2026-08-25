'use client';

import { useEffect, useRef, useState } from 'react';
import { chaChing, fanfarria, confeti, desbloquearAudio } from '@/lib/celebracion';

interface Metas {
  prendasMes: number;
  dineroMes: number;
  metaActiva: number;
  metaIndice: number;
  todasLogradas: boolean;
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const POS_KEY = 'monedero-pos';

interface Props { onAbrir: () => void; }

/**
 * Monedero flotante ARRASTRABLE. Suma $600 por prenda vendida este mes. Al entrar
 * una venta nueva hace "cha-ching" y salta; al cruzar una meta lanza confeti.
 * Se puede mover con el dedo/mouse a cualquier parte y recuerda dónde lo dejaste.
 * Un clic (sin arrastrar) abre el panel Tus metas.
 */
export default function MonederoFlotante({ onAbrir }: Props) {
  const [datos, setDatos] = useState<Metas | null>(null);
  const [brinca, setBrinca] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const anterior = useRef<{ prendas: number; indice: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ ox: number; oy: number; sx: number; sy: number; movido: boolean } | null>(null);

  // Habilita el audio en el primer gesto del usuario (los navegadores lo exigen).
  useEffect(() => {
    const desbloquear = () => desbloquearAudio();
    window.addEventListener('pointerdown', desbloquear, { once: true });
    return () => window.removeEventListener('pointerdown', desbloquear);
  }, []);

  // Posición inicial: la guardada, o arriba centrado.
  useEffect(() => {
    const ancho = btnRef.current?.offsetWidth ?? 200;
    let inicial = { x: Math.max(8, window.innerWidth / 2 - ancho / 2), y: 6 };
    try {
      const g = localStorage.getItem(POS_KEY);
      if (g) {
        const p = JSON.parse(g);
        if (typeof p.x === 'number' && typeof p.y === 'number') inicial = p;
      }
    } catch { /* sin posición guardada */ }
    setPos(clamp(inicial.x, inicial.y));
    // Al cambiar el tamaño de la ventana, no dejar el monedero fuera de vista.
    const alRedimensionar = () => setPos(p => (p ? clamp(p.x, p.y) : p));
    window.addEventListener('resize', alRedimensionar);
    return () => window.removeEventListener('resize', alRedimensionar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos]);

  function clamp(x: number, y: number) {
    const w = btnRef.current?.offsetWidth ?? 200;
    const h = btnRef.current?.offsetHeight ?? 34;
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(8, window.innerHeight - h - 8);
    return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(4, y), maxY) };
  }

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const r = await fetch('/api/metas', { cache: 'no-store' });
        if (!r.ok) return;
        const d: Metas = await r.json();
        if (!vivo) return;
        const prev = anterior.current;
        if (prev) {
          if (d.prendasMes > prev.prendas) {
            chaChing();
            setBrinca(true);
            setTimeout(() => setBrinca(false), 700);
          }
          if (d.metaIndice > prev.indice || (d.todasLogradas && prev.indice < 3)) {
            fanfarria();
            confeti();
          }
        }
        anterior.current = { prendas: d.prendasMes, indice: d.metaIndice };
        setDatos(d);
      } catch { /* reintenta en el próximo ciclo */ }
    };
    cargar();
    const t = setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, 12000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (!pos) return;
    btnRef.current?.setPointerCapture(e.pointerId);
    drag.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, movido: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    if (!drag.current.movido && Math.hypot(dx, dy) > 4) { drag.current.movido = true; setArrastrando(true); }
    if (drag.current.movido) setPos(clamp(e.clientX - drag.current.ox, e.clientY - drag.current.oy));
  }
  function onPointerUp(e: React.PointerEvent) {
    btnRef.current?.releasePointerCapture?.(e.pointerId);
    const d = drag.current;
    drag.current = null;
    setArrastrando(false);
    if (!d) return;
    if (d.movido) {
      try { if (pos) localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* ignorar */ }
    } else {
      onAbrir(); // fue un clic, no un arrastre
    }
  }

  if (!datos || !pos) {
    // Se renderiza oculto para poder medir el ancho antes de posicionar.
    return (
      <button ref={btnRef} aria-hidden className="fixed opacity-0 pointer-events-none top-1.5 left-1/2 flex items-center gap-2 pl-2.5 pr-3 py-1.5 text-[13px] font-semibold">
        <span>💰</span><span>{datos ? pesos(datos.dineroMes) : '$0'}</span>
      </button>
    );
  }

  return (
    <button
      ref={btnRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title="Arrástrame para moverme · toca para ver Tus metas"
      style={{ left: pos.x, top: pos.y, touchAction: 'none', cursor: arrastrando ? 'grabbing' : 'grab' }}
      className={`fixed z-[60] flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full select-none
        bg-gradient-to-r from-[#00847A] to-[#00A89D] text-white shadow-lg shadow-black/20 border border-white/25
        text-[13px] font-semibold whitespace-nowrap ${brinca && !arrastrando ? 'monedero-brinca' : ''}`}
    >
      <span className="text-base leading-none">💰</span>
      <span className="tabular-nums">{pesos(datos.dineroMes)}</span>
      <span className="opacity-60">·</span>
      <span className="tabular-nums">{datos.prendasMes}</span>
      <span className="opacity-80 font-normal">prendas</span>
      <style>{`
        @keyframes monederoBrinca{
          0%{transform:translateY(0) scale(1)}
          30%{transform:translateY(-6px) scale(1.12)}
          100%{transform:translateY(0) scale(1)}}
        .monedero-brinca{animation:monederoBrinca .7s ease-out}
      `}</style>
    </button>
  );
}

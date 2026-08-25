'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * "Ventas en vivo": aviso flotante que aparece cada cierto tiempo mostrando una
 * de varias frases (rotan), como prueba social. Flotante: se saca del flujo y va
 * fijo en una esquina. Todo configurable en `props`.
 */
export default function NotifVentas({ props = {} }: { props?: any }) {
  const p = props || {};
  const items: string[] = (Array.isArray(p.items) ? p.items.filter(Boolean) : []).length
    ? p.items.filter(Boolean)
    : ['Alguien acaba de comprar 🎉', 'Nuevo pedido confirmado ✅', 'Una persona compró hace un momento'];
  const emoji = p.emoji ?? '🛒';
  const color = p.color || '#0D0D0D';
  const colorTexto = p.colorTexto || '#FFFFFF';
  const titulo = p.titulo || 'Venta reciente';
  const delayInicial = Math.max(1, Number(p.delayInicial ?? 10));
  const intervalo = Math.max(4, Number(p.intervalo ?? 15));
  const duracion = Math.max(2, Number(p.duracion ?? 3));
  const posicion = p.posicion || 'bottom-right';
  const tamLetra = Math.max(10, Number(p.tamLetra) || 12);

  const [visible, setVisible] = useState(false);
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);

  useEffect(() => {
    let dead = false;
    let hideT: ReturnType<typeof setTimeout> | undefined;
    let cycleT: ReturnType<typeof setInterval> | undefined;
    const mostrar = () => {
      if (dead) return;
      setIdx(idxRef.current % items.length);
      idxRef.current += 1;
      setVisible(true);
      hideT = setTimeout(() => setVisible(false), duracion * 1000);
    };
    const first = setTimeout(() => { mostrar(); cycleT = setInterval(mostrar, intervalo * 1000); }, delayInicial * 1000);
    return () => { dead = true; clearTimeout(first); if (hideT) clearTimeout(hideT); if (cycleT) clearInterval(cycleT); };
  }, [items.length, delayInicial, intervalo, duracion]);

  const pos: Record<string, string> = {
    'bottom-right': 'bottom-3 right-3', 'bottom-left': 'bottom-3 left-3',
    'top-right': 'top-3 right-3', 'top-left': 'top-3 left-3',
    'bottom-center': 'bottom-3 left-1/2 -translate-x-1/2',
  };

  return (
    <div className={`fixed ${pos[posicion] ?? pos['bottom-right']} z-30 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
      <div className="flex items-center gap-2 rounded-2xl shadow-lg px-3.5 py-2.5 max-w-[80vw]" style={{ background: color, color: colorTexto }}>
        <span className="shrink-0" style={{ fontSize: tamLetra + 6 }}>{emoji}</span>
        <div className="min-w-0">
          <div className="uppercase tracking-wide opacity-80 font-bold" style={{ fontSize: Math.max(9, tamLetra - 2) }}>{titulo}</div>
          <div className="font-semibold truncate" style={{ fontSize: tamLetra + 0.5 }}>{items[idx] ?? items[0]}</div>
        </div>
      </div>
    </div>
  );
}

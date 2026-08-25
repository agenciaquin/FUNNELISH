'use client';

import { useEffect, useState } from 'react';
import { VENTAS_DEFAULT } from '@/lib/bloques';

/**
 * Aviso flotante "NUEVA VENTA REALIZADA": aparece solo cada cierto tiempo, dura
 * unos segundos y desaparece, rotando por los mensajes que puso el admin.
 * Primera aparición a los `delayInicial` seg; luego cada `intervalo` seg.
 */
export default function NotifVentas({ props }: { props?: Record<string, any> }) {
  const p = props ?? {};
  const titulo = (p.titulo ?? VENTAS_DEFAULT.titulo) as string;
  const emoji = (p.emoji ?? VENTAS_DEFAULT.emoji) as string;
  const items: string[] = Array.isArray(p.items) && p.items.length ? p.items.filter(Boolean) : VENTAS_DEFAULT.items;
  const color = (p.color || VENTAS_DEFAULT.color) as string;
  const colorTexto = (p.colorTexto || VENTAS_DEFAULT.colorTexto) as string;
  const size = Number(p.size) || VENTAS_DEFAULT.size;
  const posicion = (p.posicion || VENTAS_DEFAULT.posicion) as string;
  const delayInicial = Number(p.delayInicial) > 0 ? Number(p.delayInicial) : VENTAS_DEFAULT.delayInicial;
  const intervalo = Number(p.intervalo) > 0 ? Number(p.intervalo) : VENTAS_DEFAULT.intervalo;
  const duracion = Number(p.duracion) > 0 ? Number(p.duracion) : VENTAS_DEFAULT.duracion;

  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!items.length) return;
    let i = 0;
    let hideTimer: ReturnType<typeof setTimeout>;
    let cycle: ReturnType<typeof setInterval>;
    const mostrar = () => {
      setIdx(i % items.length);
      setVisible(true);
      i++;
      hideTimer = setTimeout(() => setVisible(false), duracion * 1000);
    };
    const first = setTimeout(() => {
      mostrar();
      cycle = setInterval(mostrar, intervalo * 1000);
    }, delayInicial * 1000);
    return () => { clearTimeout(first); clearTimeout(hideTimer); clearInterval(cycle); };
  }, [items.length, delayInicial, intervalo, duracion]);

  const pos =
    posicion === 'inf-der' ? 'bottom-3 right-2' :
    posicion === 'sup-izq' ? 'top-3 left-2' :
    posicion === 'sup-der' ? 'top-3 right-2' :
    posicion === 'centro' ? 'bottom-3 left-1/2 -translate-x-1/2' :
    'bottom-3 left-2'; // inf-izq (por defecto)

  if (!items.length) return null;

  return (
    <div
      className={`fixed z-40 ${pos} rounded-xl shadow-2xl border-2 border-white/70 px-3 py-1.5 max-w-[80%] transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none translate-y-2'}`}
      style={{ background: color }}
    >
      <div className="text-[9px] font-extrabold tracking-wide" style={{ color: colorTexto }}>{titulo.toUpperCase()}</div>
      <div className="flex items-center gap-1.5" style={{ color: colorTexto }}>
        <span className="font-bold leading-tight" style={{ fontSize: size }}>{items[idx]}</span>
        <span className="leading-none" style={{ fontSize: size + 2 }}>{emoji}</span>
      </div>
    </div>
  );
}

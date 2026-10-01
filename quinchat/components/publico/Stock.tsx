'use client';

import { useEffect, useState } from 'react';
import { STOCK_DEFAULT, STOCK_ROJO, colorDeStock } from '@/lib/bloques';

/**
 * Bloque "Stock / escasez": barra de disponibilidad + mensaje de urgencia.
 * Se usa en la página y en la vista previa. Puede ir flotante.
 * Si tiene barra inicial y final, la barra baja sola muy lento (sin vaciarse).
 *
 * El color NO es fijo: lo decide `colorDeStock` según lo que queda —el del
 * embudo por encima del 50%, ámbar hasta el 25%, rojo por debajo—. Barra y
 * alerta van siempre del mismo color, así que cuando la barra baja sola la
 * alerta cambia con ella y se pone a parpadear al llegar al rojo.
 */
export default function Stock({ props, flotante }: { props?: Record<string, any>; flotante?: boolean }) {
  const p = props ?? {};
  const titulo = (p.titulo ?? STOCK_DEFAULT.titulo) as string;
  const pct = Math.max(3, Math.min(100, Number(p.porcentaje) || STOCK_DEFAULT.porcentaje));
  const mensaje = (p.mensaje ?? STOCK_DEFAULT.mensaje) as string;
  const alerta = (p.alerta ?? STOCK_DEFAULT.alerta) as string;
  const colorBase = (p.color || STOCK_DEFAULT.color) as string;

  // Animación: solo si el admin activó "barra que baja sola" con inicial > final.
  const anim = p.animar === true && Number(p.barraInicial) > Number(p.barraFinal);
  const ini = Math.max(3, Math.min(100, Number(p.barraInicial) || pct));
  const fin = Math.max(1, Math.min(ini, Number(p.barraFinal) || Math.max(1, Math.round(pct / 3))));
  const cadaSeg = Number(p.cadaSeg) > 0 ? Number(p.cadaSeg) : 15;
  const paso = Number(p.paso) > 0 ? Number(p.paso) : 1;

  // Lo que queda ahora mismo. Sin animación es fijo; con ella arranca en `ini`,
  // baja `paso` puntos cada `cadaSeg` segundos y se para en `fin`.
  const [queda, setQueda] = useState(anim ? ini : pct);

  useEffect(() => {
    if (!anim) { setQueda(pct); return; }
    setQueda(ini);
    if (fin >= ini) return; // nada que bajar
    const id = setInterval(() => {
      setQueda(v => {
        const siguiente = Math.round((v - paso) * 100) / 100;
        return siguiente <= fin ? fin : siguiente;
      });
    }, Math.max(2, cadaSeg) * 1000);
    return () => clearInterval(id);
  }, [anim, pct, ini, fin, cadaSeg, paso]);

  const color = colorDeStock(queda, colorBase);
  const enRojo = color === STOCK_ROJO;

  return (
    <div className={flotante ? '' : 'px-3 py-1.5'}>
      <div className="rounded-2xl border border-[#E8E8E8] bg-white p-3 text-center">
        <h3 className="font-extrabold text-sm tracking-wide" style={{ color: (p.tituloColor as string) || '#0D0D0D', fontFamily: (p.tituloFont as string) || undefined, fontSize: Number(p.tituloSize) || undefined }}>{titulo}</h3>
        <div className="h-3 rounded-full bg-[#E8E8E8] overflow-hidden mt-2">
          <div
            className={`h-full rounded-full ${anim ? 'transition-all duration-1000 ease-linear' : 'transition-all'}`}
            style={{ width: `${queda}%`, background: color }}
          />
        </div>
        {mensaje && <p className="text-[12px] text-[#6B6B6B] mt-2 leading-snug">{mensaje}</p>}
        {alerta && (
          <p className={`text-sm font-extrabold mt-1.5 ${enRojo ? 'animate-pulse' : ''}`} style={{ color }}>
            ⚠️ {alerta}
          </p>
        )}
      </div>
    </div>
  );
}

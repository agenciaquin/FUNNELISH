'use client';

import { useEffect, useState } from 'react';

/**
 * Barra de stock que baja SOLA muy lento: arranca en `inicial` y cada `cadaSeg`
 * segundos baja `paso` puntos, pero nunca pasa de `final` (nunca queda vacía).
 */
export default function BarraStockAnimada({
  inicial, final, color, cadaSeg = 15, paso = 1,
}: {
  inicial: number; final: number; color: string; cadaSeg?: number; paso?: number;
}) {
  const ini = Math.max(3, Math.min(100, inicial));
  const fin = Math.max(1, Math.min(ini, final));
  const [w, setW] = useState(ini);

  useEffect(() => {
    setW(ini);
    if (fin >= ini) return; // nada que bajar
    const id = setInterval(() => {
      setW(v => {
        const siguiente = Math.round((v - paso) * 100) / 100;
        return siguiente <= fin ? fin : siguiente;
      });
    }, Math.max(2, cadaSeg) * 1000);
    return () => clearInterval(id);
  }, [ini, fin, cadaSeg, paso]);

  return (
    <div className="h-3 rounded-full bg-[#E8E8E8] overflow-hidden mt-2">
      <div className="h-full rounded-full transition-all duration-1000 ease-linear"
        style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

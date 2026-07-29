'use client';

import { useState, useEffect } from 'react';

/**
 * Cuenta regresiva. Arranca en las horas indicadas y se guarda en el navegador,
 * así el mismo visitante no ve el contador reiniciado si recarga la página.
 */
export default function Contador({ horas = 10 }: { horas?: number }) {
  const [restante, setRestante] = useState<number | null>(null);

  useEffect(() => {
    const clave = 'quin_contador_fin';
    let fin = Number(sessionStorage.getItem(clave) ?? 0);
    if (!fin || fin < Date.now()) {
      fin = Date.now() + horas * 3_600_000;
      sessionStorage.setItem(clave, String(fin));
    }
    const tick = () => setRestante(Math.max(0, fin - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [horas]);

  if (restante === null) return <div className="h-[68px]" />; // evita el salto al cargar

  const hh = Math.floor(restante / 3_600_000);
  const mm = Math.floor((restante % 3_600_000) / 60_000);
  const ss = Math.floor((restante % 60_000) / 1000);

  const Bloque = ({ n, t }: { n: number; t: string }) => (
    <div className="text-center">
      <div className="text-3xl font-bold text-[#C1121F] leading-none">{String(n).padStart(2, '0')}</div>
      <div className="text-[11px] text-[#6B6B6B] tracking-wide mt-0.5">{t}</div>
    </div>
  );

  return (
    <div className="flex items-start justify-center gap-8 py-4">
      <Bloque n={hh} t="HORAS" />
      <Bloque n={mm} t="MINUTOS" />
      <Bloque n={ss} t="SEGUNDOS" />
    </div>
  );
}

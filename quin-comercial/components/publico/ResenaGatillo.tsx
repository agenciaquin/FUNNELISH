'use client';

import { useState, useEffect } from 'react';

/**
 * Aviso flotante "Nueva reseña agregada". Aparece a los `aparece` segundos,
 * dura `dura` segundos y luego se borra (aparece una sola vez). Al tocarlo hace
 * scroll a la reseña gatillo. Muestra su foto + primer nombre.
 */
export default function ResenaGatillo({
  foto, nombre, texto, color = '#C1121F', colorTexto = '#FFFFFF',
  posicion = 'bottom-left', aparece = 8, dura = 6, targetId,
}: {
  foto?: string; nombre?: string; texto?: string; color?: string; colorTexto?: string;
  posicion?: string; aparece?: number; dura?: number; targetId?: string;
}) {
  const [fase, setFase] = useState<'espera' | 'visible' | 'fin'>('espera');

  useEffect(() => {
    const ap = Math.max(1, aparece) * 1000;
    const du = Math.max(2, dura) * 1000;
    const t1 = setTimeout(() => setFase('visible'), ap);
    const t2 = setTimeout(() => setFase('fin'), ap + du);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [aparece, dura]);

  if (fase === 'fin') return null;

  const pos: Record<string, string> = {
    'bottom-left': 'bottom-3 left-3', 'bottom-right': 'bottom-3 right-3',
    'top-left': 'top-3 left-3', 'top-right': 'top-3 right-3',
    'bottom-center': 'bottom-3 left-1/2 -translate-x-1/2',
  };

  function ir() {
    const el = targetId ? document.getElementById(targetId) : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <button
      type="button"
      onClick={ir}
      className={`fixed ${pos[posicion] ?? pos['bottom-left']} z-30 transition-all duration-500 ${fase === 'visible' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    >
      <div className="flex items-center gap-2 rounded-2xl shadow-lg px-3 py-2 max-w-[80vw]" style={{ background: color, color: colorTexto }}>
        {foto
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={foto} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          : <span className="text-lg shrink-0">🆕</span>}
        <div className="min-w-0 text-left">
          <div className="text-[10px] uppercase tracking-wide opacity-80 font-bold">{texto || 'Nueva reseña'}</div>
          <div className="text-[12px] font-semibold truncate">{nombre ? `${nombre} acaba de opinar ⭐` : 'Mira lo que opinan ⭐'}</div>
        </div>
      </div>
    </button>
  );
}

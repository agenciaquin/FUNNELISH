'use client';

import { useState, useEffect } from 'react';
import { estiloTexto, claseAnim } from '@/lib/bloque-estilo';

/**
 * Bloque "Stock / escasez": título + barra (fija o que baja sola, sin vaciarse)
 * + mensaje + línea de alerta. Todo configurable en `props`.
 */
export default function BarraStockAnimada({ props = {} }: { props?: any }) {
  const p = props || {};
  const animada = p.animada !== false;
  const inicial = Math.max(0, Math.min(100, Number(p.barraInicial ?? p.porcentaje ?? 31)));
  const final = Math.max(0, Math.min(inicial, Number(p.barraFinal ?? 8)));
  const cadaSeg = Math.max(3, Number(p.cadaSeg ?? 10));
  const paso = Math.max(1, Number(p.paso ?? 1));
  const color = p.color || '#F59E0B';
  const anchoB = Number(p.ancho) > 0 ? Number(p.ancho) : 100;
  // Compatibilidad: bloques viejos guardaban solo `texto`.
  const titulo = p.titulo ?? p.texto ?? 'EL STOCK SE ESTÁ AGOTANDO';
  const mensaje = p.mensaje ?? '';
  const alerta = p.alerta ?? '';

  const [pct, setPct] = useState(animada ? inicial : Number(p.porcentaje ?? inicial));

  useEffect(() => {
    if (!animada) return;
    const t = setInterval(() => setPct(prev => Math.max(final, prev - paso)), cadaSeg * 1000);
    return () => clearInterval(t);
  }, [animada, final, paso, cadaSeg]);

  return (
    <div className={claseAnim(p.anim)} style={{ maxWidth: anchoB < 100 ? `${anchoB}%` : undefined, margin: anchoB < 100 ? '0 auto' : undefined }}>
      <div className="px-4 py-3 text-center">
        {titulo && <div className="font-extrabold" style={estiloTexto({ font: p.tituloFont, color: p.tituloColor, size: p.tituloSize }, { color: '#0D0D0D', size: 16 })}>{titulo}</div>}
        <div className="w-full h-3 rounded-full bg-[#EEEEEE] overflow-hidden mt-2">
          <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%`, background: color }} />
        </div>
        {mensaje && <p className="text-[13px] text-[#6B6B6B] mt-2 leading-snug">{mensaje}</p>}
        {alerta && <p className="text-[14px] font-extrabold mt-1" style={{ color: p.alertaColor || '#B45309' }}>{alerta}</p>}
      </div>
    </div>
  );
}

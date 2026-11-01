'use client';

import type { EventoCatalogo, ProductoLive } from '@/lib/live/tipos';
import { precioCOP } from '@/lib/live/formato';

/**
 * Catálogo flotante de la línea de tiempo: aparece solo en su tramo del video, en la
 * posición que se eligió en el editor (x/y en %). Cada tarjeta tiene su botón COMPRAR.
 * Es aparte del checkout principal (barra de abajo), que sigue en todo el video.
 *
 * Posición: left = x% y translateX(-x%) → con x=0 queda pegado a la izquierda y con x=100
 * a la derecha, sin salirse nunca de la pantalla (igual en el eje y).
 */
export default function CatalogoFlotante({ evento, productos, onComprar, onVer }: {
  evento: EventoCatalogo;
  productos: ProductoLive[];
  onComprar: (p: ProductoLive) => void;
  onVer: (p: ProductoLive) => void;
}) {
  if (!productos.length) return null;
  const x = Math.max(0, Math.min(100, Number(evento.contenido.x) || 0));
  const y = Math.max(0, Math.min(100, Number(evento.contenido.y) || 0));
  return (
    <div
      className="live-pop absolute z-[15] pointer-events-auto max-w-[92%]"
      style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-${x}%, -${y}%)` }}
    >
      <div className="rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 p-2 shadow-[0_8px_28px_rgba(0,0,0,.45)]">
        {evento.contenido.titulo && (
          <p className="px-1 pb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#ffd33d] [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
            🛍️ {evento.contenido.titulo}
          </p>
        )}
        <div className="flex gap-2 overflow-x-auto snap-x [scrollbar-width:none]">
          {productos.map(p => {
            const foto = p.colores[0]?.foto;
            return (
              <div key={p.id} className="snap-start shrink-0 w-[118px] rounded-xl bg-white/95 text-black overflow-hidden">
                <button onClick={() => onVer(p)} className="block w-full" aria-label={`Ver ${p.nombre}`}>
                  <span className="block w-full h-[92px] bg-white">
                    {foto && /* eslint-disable-next-line @next/next/no-img-element */ <img src={foto} alt="" className="w-full h-full object-contain" />}
                  </span>
                  <span className="block px-1.5 pt-1 text-[11px] font-bold leading-tight line-clamp-2 text-left">{p.nombre}</span>
                  <span className="block px-1.5 text-[13px] font-extrabold text-left text-[#e11d48]">{precioCOP(p.precio)}</span>
                </button>
                <button
                  onClick={() => onComprar(p)}
                  className="live-cta m-1.5 mt-1 w-[calc(100%-12px)] rounded-lg bg-[#111] text-white text-[11px] font-extrabold uppercase tracking-wide py-1.5 active:scale-95 transition-transform"
                >
                  Comprar
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

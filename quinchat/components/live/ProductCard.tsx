'use client';

import type { ProductoLive } from '@/lib/live/tipos';
import { precioCOP } from '@/lib/live/formato';

interface Props {
  producto: ProductoLive;
  /** Posición del producto en el live (01, 02, 03…). */
  indice: number;
  onClick: () => void;
  /** Se conserva por compatibilidad: la compra principal es el botón ¡COMPRAR! de la barra. */
  onComprar?: () => void;
}

/**
 * Tarjeta COMPACTA del producto destacado (cambia sola según el minuto del video).
 * Horizontal, ~90 px de alto, máx. 240 px / 65 % del ancho. Toda la tarjeta es tocable
 * y abre la compra. Sin botón propio: el principal es ¡COMPRAR! abajo.
 */
export default function ProductCard({ producto, onClick, onComprar }: Props) {
  const foto = producto.colores[0]?.foto;
  const descuento = producto.precioAntes && producto.precioAntes > producto.precio
    ? Math.round((1 - producto.precio / producto.precioAntes) * 100) : 0;
  return (
    <button
      onClick={onClick}
      aria-label={`Ver ${producto.nombre}`}
      className="live-pop pointer-events-auto relative flex items-center gap-2 w-fit max-w-[min(240px,65%)] rounded-xl bg-black/55 backdrop-blur-sm p-2 pr-3 text-left text-white active:scale-[.98] transition-transform"
    >
      <span className="relative shrink-0 w-[65px] h-[65px] rounded-lg bg-white overflow-hidden">
        {foto && /* eslint-disable-next-line @next/next/no-img-element */ <img src={foto} alt="" width={65} height={65} className="w-full h-full object-contain" />}
        {descuento > 0 && <span className="absolute top-0 right-0 bg-[#ff3366] text-white text-[9px] font-extrabold px-1 rounded-bl-md">-{descuento}%</span>}
      </span>
      <span className="min-w-0 flex flex-col">
        <span className="text-[12.5px] font-bold leading-tight line-clamp-2 [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">{producto.nombre}</span>
        <span className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-[16px] font-extrabold leading-none text-[#ffd33d]">{precioCOP(producto.precio)}</span>
          {producto.precioAntes ? <s className="text-[10px] text-white/55">{precioCOP(producto.precioAntes)}</s> : null}
        </span>
        <span className="text-[10.5px] text-white/80 truncate mt-0.5">
          {producto.promo ? `🔥 ${producto.promo.etiqueta} disponible` : 'Pago contraentrega'}
        </span>
        {/* Botón pequeño y alargado: abre directo la compra */}
        <span
          role="button"
          tabIndex={0}
          onClick={e => { e.stopPropagation(); (onComprar ?? onClick)(); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); (onComprar ?? onClick)(); } }}
          className="live-cta mt-1.5 block w-full min-w-[120px] rounded-md bg-white text-black text-center text-[11px] font-extrabold uppercase tracking-wide leading-none py-1.5 [text-shadow:none] active:scale-95 transition-transform"
        >
          Compra aquí
        </span>
      </span>
    </button>
  );
}

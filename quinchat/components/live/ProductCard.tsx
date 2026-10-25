'use client';

import type { ProductoLive } from '@/lib/live/tipos';
import { precioCOP } from '@/lib/live/formato';

interface Props {
  producto: ProductoLive;
  /** Posición del producto en el live (01, 02, 03…). */
  indice: number;
  onClick: () => void;
  onComprar: () => void;
}

const sombra = '[text-shadow:0_1px_3px_rgba(0,0,0,.7)]';

/** Tarjeta flotante del producto destacado (cambia sola según el minuto del video). */
export default function ProductCard({ producto, indice, onClick, onComprar }: Props) {
  const foto = producto.colores[0]?.foto;
  return (
    <div className="live-pop pointer-events-auto relative flex gap-2.5 w-[80%] max-w-[330px] rounded-2xl border border-white/70 bg-black/70 backdrop-blur-sm p-2 text-white">
      <span className="absolute -top-px -left-px rounded-tl-2xl rounded-br-xl bg-[#ff3366] px-2 py-0.5 text-[12px] font-extrabold z-10">
        {String(indice).padStart(2, '0')}
      </span>
      <button onClick={onClick} aria-label={`Ver ${producto.nombre}`} className="shrink-0 self-start">
        {foto && /* eslint-disable-next-line @next/next/no-img-element */ <img src={foto} alt={producto.nombre} width={84} height={84} className="w-[84px] h-[84px] rounded-xl object-cover bg-white" />}
      </button>
      <div className="min-w-0 flex-1 flex flex-col">
        <button onClick={onClick} className="text-left">
          <span className={`block text-[14px] font-bold leading-tight truncate ${sombra}`}>{producto.nombre}</span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[20px] font-extrabold leading-tight text-[#ffd33d]">{precioCOP(producto.precio)}</span>
            {producto.precioAntes && <s className="text-[11px] text-white/60">{precioCOP(producto.precioAntes)}</s>}
          </span>
          <span className="block text-[12px] text-white/90 truncate">
            {producto.promo ? `🔥 ${producto.promo.etiqueta} disponible` : 'Pago contraentrega'}
          </span>
        </button>
        <button onClick={onComprar} className="mt-1.5 h-9 w-full rounded-lg bg-[#ff3366] text-[14px] font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
          <IconoCarrito /> Comprar
        </button>
      </div>
    </div>
  );
}

function IconoCarrito() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h3l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L21 7H6" />
    </svg>
  );
}

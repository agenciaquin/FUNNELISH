'use client';

import type { ProductoLive } from '@/lib/live/tipos';
import { precioCOP } from '@/lib/live/formato';

/** Tarjeta del producto destacado (cambia sola según el minuto del video). */
export default function ProductCard({ producto, onClick }: { producto: ProductoLive; onClick: () => void }) {
  const foto = producto.colores[0]?.foto;
  return (
    <button
      key={producto.id}
      onClick={onClick}
      className="live-pop pointer-events-auto w-full flex items-center gap-3 text-left rounded-2xl bg-white/95 text-black p-2 pr-3 shadow-xl active:scale-[.98] transition-transform"
    >
      {foto && /* eslint-disable-next-line @next/next/no-img-element */ <img src={foto} alt={producto.nombre} width={56} height={56} className="w-14 h-14 rounded-xl object-cover bg-neutral-100 shrink-0" />}
      <span className="min-w-0 flex-1">
        {producto.promo && (
          <span className="inline-block text-[9px] font-bold uppercase bg-black text-amber-300 rounded-full px-2 py-0.5 mb-0.5">🔥 {producto.promo.etiqueta}</span>
        )}
        <span className="block text-[13px] font-bold leading-tight truncate">{producto.nombre}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-[15px] font-extrabold">{precioCOP(producto.precio)}</span>
          {producto.precioAntes && <span className="text-[11px] text-neutral-500 line-through">{precioCOP(producto.precioAntes)}</span>}
        </span>
      </span>
      <span className="text-[11px] font-semibold text-[#007A72] shrink-0">Ver →</span>
    </button>
  );
}

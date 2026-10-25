'use client';

import type { EventoComentario, EventoPregunta, LiveConfig, ProductoLive, Seleccion } from '@/lib/live/tipos';
import CommentsFeed from './CommentsFeed';
import ProductCard from './ProductCard';
import Reactions from './Reactions';
import WhatsAppButton from './WhatsAppButton';

/**
 * CAPA 2 — MARCO DE PANTALLA (overlay).
 * Marco fijo e independiente encima del video. No conoce el <video>: recibe datos ya resueltos
 * (producto y mensajes del momento) y avisa lo que el usuario toca.
 */
interface Props {
  live: LiveConfig;
  producto: ProductoLive | null;
  mensajes: Array<EventoPregunta | EventoComentario>;
  seleccion: Seleccion;
  silenciado: boolean;
  bloqueado: boolean;
  onSonido: () => void;
  onReproducir: () => void;
  onCerrar: () => void;
  onProductoClick: (p: ProductoLive) => void;
  onComprarAqui: (p: ProductoLive) => void;
}

export default function LiveOverlay({ live, producto, mensajes, seleccion, silenciado, bloqueado, onSonido, onReproducir, onCerrar, onProductoClick, onComprarAqui }: Props) {
  const destacado = producto ?? live.productos[0] ?? null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-between pointer-events-none">
      {/* Encabezado */}
      <header className="pt-[max(env(safe-area-inset-top),10px)] px-3 pb-8 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2 pointer-events-auto">
          {live.tienda.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={live.tienda.logo} alt="" width={32} height={32} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" />}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[14px] font-extrabold truncate">{live.tienda.nombre}</p>
            {/* Etiqueta obligatoria: no se puede ocultar */}
            <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-white/90 text-black rounded-full px-2 py-0.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" /> Presentación grabada
            </p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="w-9 h-9 rounded-full bg-black/40 backdrop-blur text-xl leading-none">×</button>
        </div>
        <button onClick={onSonido} className="pointer-events-auto mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur px-3 py-1.5 text-[12px] font-semibold active:scale-95 transition-transform">
          {silenciado ? '🔊 Activar sonido' : '🔇 Silenciar'}
        </button>
      </header>

      {/* Autoplay bloqueado por el navegador */}
      {bloqueado && (
        <button onClick={onReproducir} className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 backdrop-blur w-20 h-20 text-3xl" aria-label="Reproducir">▶</button>
      )}

      {/* Zona inferior */}
      <div className="px-3 pb-[max(env(safe-area-inset-bottom),12px)] bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-10 space-y-2">
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0"><CommentsFeed mensajes={mensajes} /></div>
          <Reactions />
        </div>
        {destacado && <ProductCard key={destacado.id} producto={destacado} onClick={() => onProductoClick(destacado)} />}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => destacado && onComprarAqui(destacado)}
            className="pointer-events-auto h-11 rounded-xl bg-white text-black font-extrabold text-[13px] active:scale-95 transition-transform"
          >🛍️ Comprar aquí</button>
          <WhatsAppButton numero={live.whatsapp} producto={destacado} seleccion={seleccion} />
        </div>
      </div>
    </div>
  );
}

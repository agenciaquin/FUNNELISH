'use client';

import type { EventoComentario, EventoPregunta, LiveConfig, ProductoLive, Seleccion } from '@/lib/live/tipos';
import BarraInferior from './BarraInferior';
import CommentsFeed, { type ComentarioPropio } from './CommentsFeed';
import ProductCard from './ProductCard';
import Reactions from './Reactions';
import WhatsAppButton from './WhatsAppButton';

/**
 * CAPA 2 — MARCO DE PANTALLA (overlay), estilo live shopping vertical.
 * Marco fijo e independiente encima del video. No conoce el <video>: recibe datos ya resueltos
 * (producto y mensajes del momento) y avisa lo que el usuario toca.
 * Sin cifras inventadas: no hay contador de espectadores, seguidores ni "me gusta".
 */
interface Props {
  live: LiveConfig;
  etiqueta: string;
  producto: ProductoLive | null;
  mensajes: Array<EventoPregunta | EventoComentario>;
  propios: ComentarioPropio[];
  seleccion: Seleccion;
  silenciado: boolean;
  bloqueado: boolean;
  onSonido: () => void;
  onReproducir: () => void;
  onCerrar: () => void;
  onProductoClick: (p: ProductoLive) => void;
  onComprarAqui: (p: ProductoLive) => void;
  onComentar: (texto: string) => void;
  onCompartir: () => void;
}

export default function LiveOverlay({
  live, etiqueta, producto, mensajes, propios, seleccion, silenciado, bloqueado,
  onSonido, onReproducir, onCerrar, onProductoClick, onComprarAqui, onComentar, onCompartir,
}: Props) {
  const destacado = producto ?? live.productos[0] ?? null;
  const indice = destacado ? live.productos.findIndex(p => p.id === destacado.id) + 1 : 1;

  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-between pointer-events-none">
      {/* Encabezado */}
      <header className="pt-[max(env(safe-area-inset-top),10px)] px-3 pb-10 bg-gradient-to-b from-black/65 to-transparent">
        <div className="flex items-center gap-2.5 pointer-events-auto">
          {live.tienda.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={live.tienda.logo} alt="" width={44} height={44} className="w-11 h-11 rounded-full bg-white object-contain p-0.5" />}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[17px] font-extrabold truncate [text-shadow:0_1px_3px_rgba(0,0,0,.7)]">{live.tienda.nombre}</p>
            {/* Etiqueta obligatoria: no se puede ocultar */}
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-black/55 text-white rounded-full px-2.5 py-0.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/70" /> {etiqueta}
            </p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="w-10 h-10 rounded-full bg-black/40 text-[28px] leading-none">×</button>
        </div>
        <button onClick={onSonido} className="pointer-events-auto mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-1.5 text-[12px] font-semibold active:scale-95 transition-transform">
          {silenciado ? '🔊 Activar sonido' : '🔇 Silenciar'}
        </button>
      </header>

      {/* Autoplay bloqueado por el navegador */}
      {bloqueado && (
        <button onClick={onReproducir} className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 w-20 h-20 text-3xl" aria-label="Reproducir">▶</button>
      )}

      {/* Zona inferior */}
      <div>
        <div className="px-3 pb-2 pt-16 bg-gradient-to-t from-black/70 via-black/35 to-transparent flex flex-col gap-2.5">
          {destacado && (
            <ProductCard
              key={destacado.id}
              producto={destacado}
              indice={indice}
              onClick={() => onProductoClick(destacado)}
              onComprar={() => onComprarAqui(destacado)}
            />
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0 h-[26vh] flex flex-col justify-end"><CommentsFeed mensajes={mensajes} propios={propios} logo={live.tienda.logo} /></div>
            <div className="flex flex-col items-center gap-3 shrink-0">
              <Reactions />
              <WhatsAppButton numero={live.whatsapp} producto={destacado} seleccion={seleccion} />
            </div>
          </div>
        </div>
        <BarraInferior
          onComprar={() => destacado && onComprarAqui(destacado)}
          onComentar={onComentar}
          onCompartir={onCompartir}
        />
      </div>
    </div>
  );
}

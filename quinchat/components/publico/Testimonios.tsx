import { Fragment } from 'react';
import Link from 'next/link';
import { TESTIMONIOS_DEFAULT, botonVariante } from '@/lib/bloques';

interface Item { nombre?: string; estrellas?: number; texto?: string; foto?: string; gatillo?: boolean; boton?: boolean }

/**
 * Bloque "Clientes felices": título + tarjetas de reseña (foto, nombre, estrellas,
 * comentario) + fila de sellos de confianza. Se pueden intercalar botones de
 * compra entre reseñas (marca `boton` en una reseña) para hacerlo más agresivo.
 * Componente presentacional (sin estado) para usarlo en la página y en la vista previa.
 */
export default function Testimonios({ props, acento, href }: { props?: Record<string, any>; acento?: string; href?: string }) {
  const p = props ?? {};
  const titulo = (p.titulo ?? TESTIMONIOS_DEFAULT.titulo) as string;
  const items: Item[] = Array.isArray(p.items) && p.items.length ? p.items : TESTIMONIOS_DEFAULT.items;
  const badges: string[] = Array.isArray(p.badges) ? p.badges : TESTIMONIOS_DEFAULT.badges;
  const color = (p.tituloColor || acento || '#0D0D0D') as string;
  const tituloFont = (p.tituloFont || undefined) as string | undefined;
  const tituloSize = Number(p.tituloSize) || undefined;
  const botonTexto = (p.botonTexto ?? 'COMPRA FÁCIL AQUÍ') as string;
  const botonColor = (p.botonColor || '#3DC12A') as string;
  const botonColorTexto = (p.botonColorTexto || '#FFFFFF') as string;
  const botonSize = Number(p.botonSize) || 18;
  const botonEscala = Number(p.botonEscala) || 1;
  const vBtn = botonVariante(p.botonVariante || 'pill', botonColor);
  const botonAncho = Number(p.botonAncho) || 100;
  const botonAlign = (p.botonAlign || 'center') as 'left' | 'center' | 'right';
  const alignClase = botonAlign === 'left' ? 'mr-auto' : botonAlign === 'right' ? 'ml-auto' : 'mx-auto';

  const cta = (key: string) => (
    <Link key={key} href={href || '#checkout'}
      className={`block text-center font-extrabold shadow-lg active:scale-95 transition-transform ${vBtn.clase} ${alignClase}`}
      style={{
        ...vBtn.estilo,
        width: botonAncho < 100 ? `${botonAncho}%` : '100%',
        color: (p.botonVariante === 'borde') ? botonColor : botonColorTexto,
        fontSize: Math.round(botonSize * botonEscala),
        paddingTop: Math.round(14 * botonEscala),
        paddingBottom: Math.round(14 * botonEscala),
      }}>
      {botonTexto} →
    </Link>
  );

  return (
    <div id="clientes-felices" className="px-3 py-2">
      <h2 className="text-center font-extrabold text-lg md:text-xl mb-2" style={{ color, fontFamily: tituloFont, fontSize: tituloSize }}>{titulo}</h2>

      <div className="space-y-2">
        {items.map((it, i) => (
          <Fragment key={i}>
            <div className="flex gap-2.5 items-stretch">
              {/* Foto grande a la izquierda */}
              {it.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.foto} alt="" className="w-[34%] rounded-xl object-cover shrink-0 self-stretch min-h-[108px]" />
              ) : (
                <div className="w-[34%] rounded-xl bg-[#00A89D]/10 text-[#00847A] font-extrabold text-3xl flex items-center justify-center shrink-0 min-h-[108px]">
                  {(it.nombre || '?').trim().slice(0, 1).toUpperCase()}
                </div>
              )}
              {/* Tarjeta con borde a la derecha */}
              <div className={`flex-1 min-w-0 rounded-2xl border-2 p-3 flex flex-col justify-center bg-white ${it.gatillo ? 'border-[#DC2626]' : 'border-[#1E3A8A]/40'}`}>
                {it.gatillo && <span className="text-[10px] font-bold text-[#DC2626] mb-0.5">🆕 NUEVA RESEÑA</span>}
                <div className="font-extrabold text-[#0D0D0D] uppercase text-base leading-tight">{it.nombre || 'CLIENTE'}</div>
                <p className="text-[13px] text-[#4B4B4B] leading-snug mt-1">{it.texto || ''}</p>
                <div className="text-[#F59E0B] text-lg mt-1 leading-none">{'⭐'.repeat(Math.max(1, Math.min(5, Number(it.estrellas) || 5)))}</div>
              </div>
            </div>
            {/* Botón de compra intercalado tras esta reseña */}
            {it.boton && cta(`cta-${i}`)}
          </Fragment>
        ))}
      </div>

      {badges.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {badges.map((b, i) => (
            <div key={i} className="text-[11px] font-semibold text-center text-[#4B4B4B] leading-tight">{b}</div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import ResenaGatillo from './ResenaGatillo';
import { estiloTexto } from '@/lib/bloque-estilo';

/**
 * Bloque "Clientes felices" (reseñas) — versión PREMIUM y dinámica:
 * cada reseña es una tarjeta con sombra, foto redonda con aro, nombre en negrita,
 * estrellas doradas grandes, comentario resaltado y un botón de compra vistoso.
 * Compatible con reseñas viejas ({nombre, texto}). Cada reseña puede:
 *  · ser "gatillo" (acento rojo + 🆕 y dispara el aviso flotante),
 *  · llevar un botón de compra debajo (ancho/color/tamaño/alineación).
 * El título usa la mini-barra (tituloFont/tituloColor/tituloSize).
 */
export default function Resenas({ b, acento, irAPedido }: {
  b: any; acento: { boton: string; texto: string }; irAPedido: string;
}) {
  const p = b?.props ?? {};
  const items: any[] = Array.isArray(b?.items) ? b.items : [];
  const titulo = p.titulo ?? b?.titulo ?? 'LO QUE DICEN NUESTROS CLIENTES';
  const idBase = String(b?.id ?? 'res');
  const gatIdx = items.findIndex(it => it?.gatillo);
  const gatId = gatIdx >= 0 ? `resena-${idBase}-${gatIdx}` : undefined;
  const avisoOn = gatIdx >= 0 && p.avisoActivo !== false;

  return (
    <div className="px-3 py-4">
      {titulo && (
        <div className="text-center mb-3.5">
          <h2 className="font-extrabold leading-tight" style={estiloTexto({ font: p.tituloFont, color: p.tituloColor, size: p.tituloSize }, { color: acento.texto, size: 19 })}>
            {titulo}
          </h2>
          <div className="mx-auto mt-1.5 h-[3px] w-14 rounded-full" style={{ background: acento.texto, opacity: 0.85 }} />
        </div>
      )}
      <div className="space-y-3.5">
        {items.map((t, k) => <Resena key={k} t={t} id={`resena-${idBase}-${k}`} acento={acento} irAPedido={irAPedido} />)}
      </div>
      {avisoOn && (
        <ResenaGatillo
          foto={items[gatIdx]?.foto}
          nombre={String(items[gatIdx]?.nombre ?? '').split(' ')[0]}
          texto={p.avisoTexto}
          color={p.avisoColor || '#C1121F'}
          colorTexto={p.avisoColorTexto || '#FFFFFF'}
          posicion={p.avisoPosicion || 'bottom-left'}
          aparece={Number(p.avisoAparece ?? 8)}
          dura={Number(p.avisoDura ?? 6)}
          targetId={gatId}
        />
      )}
    </div>
  );
}

function Resena({ t, id, acento, irAPedido }: { t: any; id: string; acento: { boton: string; texto: string }; irAPedido: string }) {
  const foto = t?.foto;
  const estrellas = Math.max(1, Math.min(5, Number(t?.estrellas ?? 5) || 5));
  const gatillo = !!t?.gatillo;
  const inicial = String(t?.nombre ?? '?').trim().charAt(0).toUpperCase() || '★';

  return (
    <div id={id}>
      <div
        className="rounded-2xl bg-white overflow-hidden"
        style={{
          boxShadow: gatillo ? '0 8px 24px -8px rgba(193,18,31,0.28)' : '0 6px 20px -10px rgba(0,0,0,0.22)',
          border: `1px solid ${gatillo ? 'rgba(193,18,31,0.35)' : 'rgba(0,0,0,0.06)'}`,
          borderLeft: `4px solid ${gatillo ? '#C1121F' : acento.texto}`,
        }}
      >
        <div className="flex gap-3 p-3">
          {/* Foto (o inicial en un círculo con el color de marca) */}
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" className="w-[68px] h-[68px] rounded-xl object-cover shrink-0 shadow-sm" style={{ boxShadow: '0 0 0 3px #fff, 0 4px 10px -3px rgba(0,0,0,0.25)' }} />
          ) : (
            <div className="w-[68px] h-[68px] rounded-xl shrink-0 grid place-items-center text-white text-2xl font-extrabold" style={{ background: acento.texto }}>
              {inicial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {gatillo && (
              <div className="inline-flex items-center gap-1 text-[10px] font-extrabold text-white rounded-full px-2 py-0.5 mb-1 shadow-sm" style={{ background: '#C1121F' }}>
                🆕 NUEVA RESEÑA
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              {t?.nombre && <span className="text-[14px] font-extrabold text-[#1A1A1A] leading-tight">{t.nombre}</span>}
              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-[#0B7A3B] bg-[#E7F6EC] rounded-full px-1.5 py-[1px]">✓ Verificada</span>
            </div>
            <div className="text-[15px] leading-none mt-0.5" style={{ color: '#FFB300', letterSpacing: '1px' }}>
              {'★'.repeat(estrellas)}<span style={{ color: '#E3E0D8' }}>{'★'.repeat(5 - estrellas)}</span>
            </div>
            {t?.texto && (
              <p className="text-[13.5px] text-[#42423E] mt-1.5 leading-snug">
                <span className="font-serif text-[#C9C6BE]">&ldquo;</span>{t.texto}<span className="font-serif text-[#C9C6BE]">&rdquo;</span>
              </p>
            )}
          </div>
        </div>
        {t?.boton && <BotonResena t={t} acento={acento} irAPedido={irAPedido} />}
      </div>
    </div>
  );
}

function BotonResena({ t, acento, irAPedido }: { t: any; acento: { boton: string }; irAPedido: string }) {
  const ancho = Math.max(40, Math.min(100, Number(t?.botonAncho ?? 100)));
  const align = t?.botonAlign === 'izq' ? 'flex-start' : t?.botonAlign === 'der' ? 'flex-end' : 'center';
  const size = Number(t?.botonSize);
  const bg = t?.botonColor || acento.boton;
  return (
    <div className="px-3 pb-3 -mt-0.5 flex" style={{ justifyContent: align }}>
      <a
        href={irAPedido}
        style={{ width: `${ancho}%`, background: bg, color: t?.botonColorTexto || '#FFFFFF', fontSize: size > 0 ? `${size}px` : undefined, boxShadow: `0 10px 22px -8px ${bg}` }}
        className="block text-center font-extrabold rounded-full py-3 hover:opacity-90 hover:-translate-y-0.5 transition-all"
      >
        {t?.botonTexto || '🛒 LO QUIERO'}
      </a>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';

interface Pedido {
  producto: string; seleccion: string; valor: number;
  foto: string | null; imagenes?: string[]; nombre: string; referencia: string;
}

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

/** Resumen de lo que acabó de comprar, más el botón para confirmar por WhatsApp. */
export default function ResumenGracias({ whatsapp }: { whatsapp: string }) {
  const [p, setP] = useState<Pedido | null>(null);

  useEffect(() => {
    try {
      const guardado = sessionStorage.getItem('quin_ultimo_pedido');
      if (guardado) setP(JSON.parse(guardado));
    } catch { /* si no hay nada guardado, se muestra la página sin resumen */ }
  }, []);

  const tel = (whatsapp || '').replace(/\D/g, '');
  const bonito = tel.replace(/^57/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');

  const mensaje = p
    ? `Hola, acabo de hacer un pedido de ${p.producto} (${p.seleccion}). ¿Me confirmas si quedó todo bien?`
    : 'Hola, acabo de hacer un pedido en la página. ¿Me confirmas si quedó todo bien?';

  return (
    <>
      {p && (
        <div className="rounded-2xl border border-[#E0E0E0] overflow-hidden mb-5 text-left">
          <p className="bg-[#FAFAFA] px-4 py-2 text-[11px] font-bold text-[#6B6B6B] uppercase">
            Tu pedido
          </p>

          <div className="flex items-center gap-3 px-4 py-3">
            {(() => {
              // 1 prenda → 1 foto; pack x2 → 2 fotos; pack x3 → 3 fotos.
              const fotos = (p.imagenes && p.imagenes.length > 0)
                ? p.imagenes
                : (p.foto ? [p.foto] : []);
              if (fotos.length === 0) return null;
              return (
                <div className="flex flex-col gap-1 shrink-0">
                  {fotos.slice(0, 3).map((f, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={f} alt="" className={`${fotos.length > 1 ? 'w-14 h-14' : 'w-16 h-16'} rounded-lg object-cover border border-[#E8E8E8]`} />
                  ))}
                </div>
              );
            })()}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#0D0D0D] leading-tight">{p.producto}</p>
              {p.seleccion && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.seleccion.split('/').map((t, i) => (
                    <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#0D8A3E]/10 text-[#0D8A3E]">
                      {t.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className="text-sm font-bold shrink-0">{pesos(p.valor)}</span>
          </div>

          <div className="flex justify-between px-4 py-2.5 border-t border-[#EEE] bg-[#FAFAFA]">
            <span className="text-[12px] font-bold">Pagas al recibir</span>
            <span className="text-[15px] font-bold text-[#0D8A3E]">{pesos(p.valor)}</span>
          </div>
        </div>
      )}

      {tel && (
        <a
          href={`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`}
          className="boton-compra relative overflow-hidden block rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-lg py-4 mb-3 transition-colors"
        >
          💬 CONFIRMAR POR WHATSAPP
          <span className="block text-sm font-semibold mt-0.5">{bonito}</span>
        </a>
      )}
    </>
  );
}

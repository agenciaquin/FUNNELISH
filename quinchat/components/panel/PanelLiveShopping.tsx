'use client';

import { useState } from 'react';
import { LIVES_DEMO } from '@/lib/live/datos-demo';

/** Apartado "QUIN LIVE SHOPPING" del panel — MAQUETA: lista de lives de demo y enlace público. */
export default function PanelLiveShopping() {
  const [copiado, setCopiado] = useState<string | null>(null);

  const urlPublica = (slug: string) =>
    (typeof window !== 'undefined' ? window.location.origin : '') + `/live/${slug}`;

  const copiar = async (slug: string) => {
    try { await navigator.clipboard.writeText(urlPublica(slug)); setCopiado(slug); setTimeout(() => setCopiado(null), 1800); } catch { /* ignorar */ }
  };

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto bg-brand-ivory p-5 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🎬</span>
          <h1 className="text-xl font-bold text-brand-black">QUIN LIVE SHOPPING</h1>
          <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Maqueta</span>
        </div>
        <p className="text-sm text-brand-gray-mid mb-6">
          Experiencia de compra con video vertical pregrabado. Esta es una maqueta con datos de prueba: no guarda pedidos ni toca la base de datos.
        </p>

        {LIVES_DEMO.map(live => (
          <div key={live.slug} className="bg-white border border-brand-border rounded-2xl p-4 mb-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div>
                <p className="font-semibold text-brand-black">{live.titulo}</p>
                <p className="text-xs text-brand-gray-mid">{live.productos.length} productos · modo {live.modo === 'desde_inicio' ? 'desde el inicio' : 'sincronizado'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => copiar(live.slug)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-brand-border hover:bg-brand-gray-light">
                  {copiado === live.slug ? '¡Copiado!' : 'Copiar enlace'}
                </button>
                <a href={`/live/${live.slug}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00A89D] text-white hover:bg-[#007A72]">
                  Abrir maqueta
                </a>
              </div>
            </div>
            <p className="mt-3 text-xs font-mono bg-brand-gray-light rounded-lg px-3 py-2 break-all">/live/{live.slug}</p>
          </div>
        ))}

        <div className="text-xs text-brand-gray-mid space-y-1 mt-6">
          <p>• El video se referencia por URL externa (Cloudflare R2): <code>NEXT_PUBLIC_LIVE_VIDEO_URL</code>.</p>
          <p>• Número de WhatsApp: <code>NEXT_PUBLIC_LIVE_WHATSAPP</code> (ahora hay un número de prueba).</p>
        </div>
      </div>
    </div>
  );
}

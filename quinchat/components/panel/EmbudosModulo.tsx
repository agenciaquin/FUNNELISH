'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

/**
 * Módulo Embudos con dos pestañas (08-nov-2026):
 *  · 🚀 Mis Embudos → EmbudosPanel TAL CUAL (misma lógica; solo se rediseñó su lista).
 *  · 🖥️ Mi Página   → MiPaginaPanel (independiente, tabla mi_pagina).
 * Mis Embudos queda montado aunque se cambie de pestaña, para no perder un embudo a medio editar.
 */
const EmbudosPanel = dynamic(() => import('./EmbudosPanel'), { ssr: false });
const MiPaginaPanel = dynamic(() => import('./MiPaginaPanel'), { ssr: false });

export default function EmbudosModulo({ abrirSlug, onAbierto }: { abrirSlug?: string | null; onAbierto?: () => void }) {
  const [tab, setTab] = useState<'embudos' | 'pagina'>('embudos');
  const [paginaVista, setPaginaVista] = useState(false);
  const boton = (activo: boolean) =>
    `flex items-center gap-2 px-5 md:px-7 py-2.5 rounded-2xl text-sm md:text-base font-bold transition-all ${
      activo ? 'bg-[#0B7F78] text-white shadow-md shadow-[#0B7F78]/25' : 'bg-white text-[#0D1F1C] border border-[#DCE4E2] hover:bg-[#F4F8F7]'
    }`;
  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#F4F6F5]">
      <div className="shrink-0 flex items-center gap-3 px-4 md:px-6 pt-4 pb-3 pl-14 md:pl-6">
        <button onClick={() => setTab('embudos')} className={boton(tab === 'embudos')}>🚀 Mis Embudos</button>
        <button onClick={() => { setTab('pagina'); setPaginaVista(true); }} className={boton(tab === 'pagina')}>🖥️ Mi Página</button>
      </div>
      <div className={`flex-1 min-h-0 flex ${tab === 'embudos' ? '' : 'hidden'}`}>
        <EmbudosPanel abrirSlug={abrirSlug} onAbierto={onAbierto} />
      </div>
      {paginaVista && (
        <div className={`flex-1 min-h-0 overflow-y-auto ${tab === 'pagina' ? '' : 'hidden'}`}>
          <MiPaginaPanel />
        </div>
      )}
    </div>
  );
}

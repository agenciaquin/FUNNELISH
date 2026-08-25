'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const EstadisticasPanel = dynamic(() => import('./EstadisticasPanel'), { ssr: false });
const CampanasPanel     = dynamic(() => import('./CampanasPanel'),     { ssr: false });
const MunicipiosPanel   = dynamic(() => import('./MunicipiosPanel'),   { ssr: false });

type Pestana = 'conversaciones' | 'campanas' | 'municipios';

export default function EstadisticasSeccion() {
  const [pestana, setPestana] = useState<Pestana>('conversaciones');

  const tab = (activa: boolean) =>
    `px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
      activa ? 'bg-[#00A89D] text-white shadow-sm' : 'text-[#6B6B6B] hover:text-[#0D0D0D] hover:bg-[#F0F0F0]'
    }`;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAF9F6] overflow-hidden">
      <div className="flex items-center gap-2 px-4 md:px-8 py-3 border-b border-[#E8E8E8] bg-white shrink-0 pl-14 md:pl-8">
        <button onClick={() => setPestana('conversaciones')} className={tab(pestana === 'conversaciones')}>
          💬 Conversaciones
        </button>
        <button onClick={() => setPestana('campanas')} className={tab(pestana === 'campanas')}>
          📈 Campañas
        </button>
        <button onClick={() => setPestana('municipios')} className={tab(pestana === 'municipios')}>
          📍 Municipios
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex min-h-0">
        {pestana === 'conversaciones' && <EstadisticasPanel />}
        {pestana === 'campanas'       && <CampanasPanel />}
        {pestana === 'municipios'     && <MunicipiosPanel />}
      </div>
    </div>
  );
}

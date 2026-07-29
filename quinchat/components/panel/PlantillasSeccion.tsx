'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const PlantillasPanel    = dynamic(() => import('./PlantillasPanel'),    { ssr: false });
const PlantillasWhatsApp = dynamic(() => import('./PlantillasWhatsApp'), { ssr: false });

type Pestana = 'general' | 'whatsapp';

/**
 * Agrupa los dos tipos de plantilla:
 *  - Generales: respuestas rápidas para usar dentro de la ventana de 24 h.
 *  - WhatsApp:  plantillas aprobadas por Meta, las únicas válidas pasadas las 24 h.
 */
export default function PlantillasSeccion() {
  const [pestana, setPestana] = useState<Pestana>('general');

  const tab = (activa: boolean) =>
    `px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
      activa ? 'bg-[#C9A84C] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A] overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[#1C1C1C] bg-[#080808] shrink-0 pl-14 md:pl-6">
        <button onClick={() => setPestana('general')}  className={tab(pestana === 'general')}>
          📋 Generales
        </button>
        <button onClick={() => setPestana('whatsapp')} className={tab(pestana === 'whatsapp')}>
          💬 WhatsApp (24 h)
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {pestana === 'general' ? <PlantillasPanel /> : <PlantillasWhatsApp />}
      </div>
    </div>
  );
}

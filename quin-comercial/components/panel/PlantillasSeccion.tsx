'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const PlantillasPanel    = dynamic(() => import('./PlantillasPanel'),    { ssr: false });
const PlantillasWhatsApp = dynamic(() => import('./PlantillasWhatsApp'), { ssr: false });

type Pestana = 'general' | 'whatsapp';

/**
 * Agrupa los dos tipos de plantilla y explica MUY claro la diferencia:
 *  - Plantilla general: respuestas rápidas tuyas. Se envían al instante, sin
 *    aprobación de Meta, pero SOLO si el cliente te escribió en las últimas 24 h.
 *  - Plantilla de WhatsApp: las aprobadas por Meta. Las ÚNICAS que sirven para
 *    escribirle primero al cliente o cuando ya pasaron las 24 h.
 */
export default function PlantillasSeccion() {
  const [pestana, setPestana] = useState<Pestana>('general');

  const tab = (activa: boolean) =>
    `px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
      activa ? 'bg-[#00A89D] text-white' : 'text-[#6B6B6B] hover:text-[#0D0D0D] hover:bg-[#F5F5F5]'
    }`;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAF9F6] overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[#E8E8E8] bg-white shrink-0 pl-14 md:pl-6">
        <button onClick={() => setPestana('general')}  className={tab(pestana === 'general')}>
          📋 Plantilla general
        </button>
        <button onClick={() => setPestana('whatsapp')} className={tab(pestana === 'whatsapp')}>
          💬 Plantilla de WhatsApp
        </button>
      </div>

      {/* Explicación de qué es cada tipo (cambia según la pestaña activa) */}
      {pestana === 'general' ? (
        <div className="px-6 py-2.5 bg-[#F0FAF9] border-b border-[#DCEFED] shrink-0">
          <p className="text-[11px] leading-snug text-[#0D6B63]">
            <b>Respuestas rápidas tuyas.</b> Texto guardado que insertas para contestar más rápido.
            Se envían al instante y sin aprobación de Meta — pero <b>solo si el cliente te escribió en las últimas 24 h</b>.
            No sirven para escribirle tú primero.
          </p>
        </div>
      ) : (
        <div className="px-6 py-2.5 bg-[#FFF7ED] border-b border-[#F5E4CC] shrink-0">
          <p className="text-[11px] leading-snug text-[#9A5B00]">
            <b>Plantillas oficiales aprobadas por Meta.</b> Son las <b>únicas</b> que puedes enviar para
            escribirle <b>primero</b> al cliente o cuando <b>ya pasaron las 24 h</b> (ej. confirmación del pedido, guía de envío).
            Llevan variables y botones, Meta debe aprobarlas y a veces cobra el envío.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {pestana === 'general' ? <PlantillasPanel /> : <PlantillasWhatsApp />}
      </div>
    </div>
  );
}

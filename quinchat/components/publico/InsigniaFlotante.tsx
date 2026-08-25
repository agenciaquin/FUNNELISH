'use client';

import type { Insignia } from '@/lib/funnels';

/**
 * Insignia flotante "MÁS VENDIDO 🔥". La posición (x, y en %) la define el admin
 * arrastrándola en el panel; aquí solo se muestra fija para todos los clientes.
 * Palpita para llamar la atención (usa la animación .boton-compra si existe, o CSS propio).
 */
export default function InsigniaFlotante({ insignia }: { insignia: Insignia }) {
  const x = Math.min(100, Math.max(0, Number(insignia.x ?? 50)));
  const y = Math.min(100, Math.max(0, Number(insignia.y ?? 12)));
  const texto = (insignia.texto || 'MÁS VENDIDO').toUpperCase();

  return (
    <div
      className="pointer-events-none fixed z-40"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <div
        className="insignia-palpita flex items-center gap-1 rounded-full bg-[#C1121F] text-white font-extrabold text-sm px-4 py-2 shadow-xl border-2 border-white whitespace-nowrap"
      >
        🔥 {texto}
      </div>
      <style>{`
        @keyframes insigniaPalpita {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        .insignia-palpita { animation: insigniaPalpita 1s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

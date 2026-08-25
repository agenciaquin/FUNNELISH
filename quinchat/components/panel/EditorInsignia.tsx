'use client';

import { useRef } from 'react';
import type { Insignia } from '@/lib/funnels';

/**
 * Editor de la insignia flotante "MÁS VENDIDO 🔥".
 * El admin la ARRASTRA dentro del marco (que representa la pantalla del cliente);
 * la posición queda guardada en % y así la ven fija todos los clientes.
 */
export default function EditorInsignia({
  value, onChange,
}: {
  value: Insignia | null;
  onChange: (i: Insignia) => void;
}) {
  const marco = useRef<HTMLDivElement>(null);
  const ins: Insignia = value ?? {};
  const activo = ins.activo === true;
  const x = Number(ins.x ?? 50);
  const y = Number(ins.y ?? 12);
  const texto = ins.texto ?? 'MÁS VENDIDO';

  const mover = (clientX: number, clientY: number) => {
    const r = marco.current?.getBoundingClientRect();
    if (!r) return;
    const nx = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
    const ny = Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100));
    onChange({ ...ins, activo: true, texto, x: Math.round(nx), y: Math.round(ny) });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    mover(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons !== 1) return; // solo mientras se mantiene presionado
    mover(e.clientX, e.clientY);
  };

  return (
    <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h3 className="text-sm font-bold text-[#0D0D0D]">🔥 Insignia “MÁS VENDIDO”</h3>
          <p className="text-[11px] text-[#6B6B6B]">Un botón flotante que llama la atención. Arrástralo donde quieras.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold shrink-0">
          <input
            type="checkbox" checked={activo}
            onChange={e => onChange({ ...ins, activo: e.target.checked, texto, x, y })}
            className="w-4 h-4 accent-[#00A89D]"
          />
          {activo ? 'Activa' : 'Apagada'}
        </label>
      </div>

      {activo && (
        <>
          <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Texto</label>
          <input
            value={texto}
            onChange={e => onChange({ ...ins, activo: true, texto: e.target.value, x, y })}
            className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm mb-3"
            placeholder="MÁS VENDIDO"
          />

          <p className="text-[11px] text-[#6B6B6B] mb-1">Arrastra la insignia dentro de la pantalla:</p>
          <div
            ref={marco}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            className="relative mx-auto rounded-xl border-2 border-[#111] bg-[#F5F5F5] overflow-hidden touch-none select-none cursor-grab"
            style={{ width: 180, height: 320 }}
          >
            <div className="absolute inset-x-0 top-0 h-6 bg-white/70 flex items-center justify-center text-[9px] text-[#9A9A9A]">pantalla del cliente</div>
            <div
              className="absolute flex items-center gap-1 rounded-full bg-[#C1121F] text-white font-extrabold text-[11px] px-2.5 py-1 shadow-lg border-2 border-white whitespace-nowrap cursor-grab"
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
            >
              🔥 {(texto || 'MÁS VENDIDO').toUpperCase()}
            </div>
          </div>
          <p className="text-center text-[10px] text-[#9A9A9A] mt-1">Posición: {Math.round(x)}% · {Math.round(y)}%</p>
        </>
      )}
    </div>
  );
}

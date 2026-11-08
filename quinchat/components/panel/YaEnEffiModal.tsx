'use client';

import { useState } from 'react';

/**
 * «Ya está en Effi» (08-nov-2026): para ventas que se subieron a Effi con OTRO número (el cliente dio dos).
 * El asesor pega el ID de la remisión y el teléfono con el que quedó en Effi; QuinChat lo verifica contra
 * las remisiones de Effi y, si coinciden, marca el chat como subido (azul). Si no, muestra el error.
 */
export default function YaEnEffiModal({ conv, telefonoChat, vinculo, onCerrar, onListo }: {
  conv: string; telefonoChat?: string; vinculo?: { remision: string; telefono_effi: string } | null;
  onCerrar: () => void; onListo: () => void;
}) {
  const [remision, setRemision] = useState('');
  const [telefono, setTelefono] = useState(String(telefonoChat ?? '').replace(/\D/g, '').slice(-10));
  const [enviando, setEnviando] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; t: string } | null>(null);

  const enviar = async (accion: 'vincular' | 'desvincular') => {
    setEnviando(true); setRes(null);
    try {
      const r = await fetch('/api/ventas-vendedores/desde-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, conv, remision, telefono }),
      });
      const j = await r.json().catch(() => ({}));
      setRes({ ok: !!j.ok, t: j.mensaje || (r.ok ? 'Listo' : 'No se pudo') });
      if (j.ok) { onListo(); setTimeout(onCerrar, 1800); }
    } finally { setEnviando(false); }
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/40 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-3">
          <span className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center text-lg">🔗</span>
          <div className="flex-1">
            <h3 className="font-extrabold text-[17px]">Ya está en Effi</h3>
            <p className="text-[12.5px] text-[#6B7280]">Pega el ID de la remisión y el teléfono con el que quedó esta venta en Effi. Si coinciden, se marca como subida.</p>
          </div>
          <button onClick={onCerrar} className="w-8 h-8 rounded-lg hover:bg-[#F3F4F6]">✕</button>
        </div>

        {vinculo && (
          <div className="mb-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] px-3 py-2 text-[12.5px] text-[#1E40AF] flex items-center gap-2">
            <span className="flex-1">Marcada con la remisión <b>{vinculo.remision}</b> (tel. {vinculo.telefono_effi}).</span>
            <button disabled={enviando} onClick={() => enviar('desvincular')} className="text-[#DC2626] font-semibold">Quitar</button>
          </div>
        )}

        <label className="block text-[12px] font-bold mb-1">ID de la remisión en Effi</label>
        <input autoFocus value={remision} onChange={e => setRemision(e.target.value)} placeholder="Ej. 78352"
          className="w-full px-3 py-2.5 rounded-xl border border-[#D1D5DB] text-sm mb-3 focus:outline-none focus:border-[#2563EB]" />
        <label className="block text-[12px] font-bold mb-1">Teléfono con el que quedó en Effi</label>
        <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="3001234567" inputMode="numeric"
          className="w-full px-3 py-2.5 rounded-xl border border-[#D1D5DB] text-sm focus:outline-none focus:border-[#2563EB]" />
        <p className="text-[11px] text-[#9CA3AF] mt-1">Si el cliente dio otro número para el envío, pon ese.</p>

        {res && <p className={`mt-3 text-[13px] ${res.ok ? 'text-[#15803D] font-semibold' : 'text-[#B91C1C]'}`}>{res.t}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCerrar} className="h-10 px-4 rounded-xl border border-[#D1D5DB] text-sm font-semibold">Cancelar</button>
          <button disabled={enviando || !remision.trim()} onClick={() => enviar('vincular')}
            className="h-10 px-4 rounded-xl bg-[#2563EB] text-white text-sm font-bold disabled:opacity-50">
            {enviando ? 'Buscando en Effi…' : 'Verificar y marcar'}
          </button>
        </div>
      </div>
    </div>
  );
}

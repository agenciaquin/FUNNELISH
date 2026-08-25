'use client';

import { useEffect, useState, useCallback } from 'react';
import ConfirmacionModal from './ConfirmacionModal';

interface EmbudoLite { slug: string; producto: string; imagenes?: string[]; precio?: number }

/**
 * Papelera de embudos: aquí quedan los embudos eliminados. Con selección masiva
 * y dos acciones: RESTAURAR (vuelven a la lista) o ELIMINAR DEFINITIVAMENTE (se
 * borran de verdad de la base de datos). Ambas piden confirmación en ventana flotante.
 */
export default function PapeleraEmbudos({ onCerrar, onCambio }: { onCerrar: () => void; onCambio: () => void }) {
  const [lista, setLista]         = useState<EmbudoLite[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [sel, setSel]             = useState<Set<string>>(new Set());
  const [modal, setModal]         = useState<null | 'restaurar' | 'definitivo'>(null);
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch('/api/funnels?papelera=1', { cache: 'no-store' });
      const d = await r.json();
      setLista(d.embudos ?? []);
    } catch { setLista([]); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const toggle = (slug: string) => setSel(prev => {
    const n = new Set(prev); n.has(slug) ? n.delete(slug) : n.add(slug); return n;
  });
  const todos = lista.length > 0 && sel.size === lista.length;
  const toggleTodos = () => setSel(todos ? new Set() : new Set(lista.map(e => e.slug)));

  async function restaurar() {
    setProcesando(true);
    try {
      await fetch('/api/funnels', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'restaurar', slugs: [...sel] }),
      });
      setSel(new Set()); setModal(null); await cargar(); onCambio();
    } finally { setProcesando(false); }
  }

  async function definitivo() {
    setProcesando(true);
    try {
      // Borrado REAL: DELETE con la lista de slugs. No queda en caché ni papelera.
      await fetch(`/api/funnels?slugs=${encodeURIComponent([...sel].join(','))}`, { method: 'DELETE' });
      setSel(new Set()); setModal(null); await cargar(); onCambio();
    } finally { setProcesando(false); }
  }

  const n = sel.size;

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onCerrar}>
      <div className="bg-[#FAF9F6] rounded-2xl shadow-2xl w-full max-w-2xl my-6 overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-[#E8E8E8] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0D0D0D]">🗑️ Papelera de embudos</h2>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">Aquí quedan los embudos eliminados. Restáuralos o bórralos para siempre.</p>
          </div>
          <button onClick={onCerrar} className="text-[#6B6B6B] hover:text-[#0D0D0D] text-2xl leading-none">×</button>
        </div>

        {/* Toolbar masivo */}
        <div className="px-5 py-3 bg-white border-b border-[#E8E8E8] flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-[#6B6B6B] cursor-pointer mr-auto">
            <input type="checkbox" checked={todos} onChange={toggleTodos} className="w-4 h-4 accent-[#00A89D]" disabled={!lista.length} />
            Seleccionar todos
          </label>
          <button onClick={() => n && setModal('restaurar')} disabled={!n}
            className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-[#00A89D] hover:bg-[#00847A] disabled:opacity-40 transition-colors">
            ♻ Restaurar{n > 0 ? ` (${n})` : ''}
          </button>
          <button onClick={() => n && setModal('definitivo')} disabled={!n}
            className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-colors">
            🗑 Eliminar definitivamente{n > 0 ? ` (${n})` : ''}
          </button>
        </div>

        {/* Lista */}
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
          {cargando ? (
            <p className="text-sm text-center text-[#9A9A9A] py-10">Cargando…</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-center text-[#9A9A9A] py-10">La papelera está vacía. 🎉</p>
          ) : lista.map(e => (
            <label key={e.slug} className={`flex items-center gap-3 bg-white rounded-xl border p-3 cursor-pointer transition-colors ${sel.has(e.slug) ? 'border-[#00A89D] ring-1 ring-[#00A89D]/30' : 'border-[#E8E8E8] hover:bg-[#F8F8F8]'}`}>
              <input type="checkbox" checked={sel.has(e.slug)} onChange={() => toggle(e.slug)} className="w-4 h-4 accent-[#00A89D] shrink-0" />
              {e.imagenes?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.imagenes[0]} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[#F5F5F5] flex items-center justify-center shrink-0">🛍️</div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0D0D0D] truncate">{e.producto}</p>
                <p className="text-[11px] text-[#9A9A9A] truncate">/{e.slug}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <ConfirmacionModal
        abierto={modal === 'restaurar'}
        titulo={`¿Restaurar ${n} embudo${n === 1 ? '' : 's'}?`}
        mensaje="Volverán a tu lista de embudos y sus páginas quedarán disponibles de nuevo."
        textoAceptar={procesando ? 'Restaurando…' : 'Sí, restaurar'}
        onAceptar={restaurar}
        onCancelar={() => setModal(null)}
      />
      <ConfirmacionModal
        abierto={modal === 'definitivo'}
        peligro
        titulo={`¿Eliminar definitivamente ${n} embudo${n === 1 ? '' : 's'}?`}
        mensaje="Esta acción NO se puede deshacer: se borran de verdad de la base de datos (no quedan en papelera ni en caché)."
        textoAceptar={procesando ? 'Eliminando…' : 'Sí, borrar para siempre'}
        onAceptar={definitivo}
        onCancelar={() => setModal(null)}
      />
    </div>
  );
}

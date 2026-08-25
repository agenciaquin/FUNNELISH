'use client';

import { useState, useEffect, useCallback } from 'react';
import ModalConfirm from './ModalConfirm';

interface EmbudoPap {
  slug: string;
  producto?: string;
  precio?: number;
  imagenes?: string[];
  eliminado_at?: string | null;
}

const pesos = (n?: number) => (n ? `$${Math.round(n).toLocaleString('es-CO')}` : '—');

/**
 * Papelera de embudos (overlay aislado). Muestra los embudos con borrado suave.
 * Permite restaurarlos o eliminarlos definitivamente (borrado real en la base).
 * `onCambio` avisa a la lista principal para que se refresque.
 */
export default function EmbudosPapelera({ onClose, onCambio }: { onClose: () => void; onCambio: () => void }) {
  const [items, setItems]     = useState<EmbudoPap[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel]         = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const [modal, setModal]     = useState<null | 'restaurar' | 'eliminar'>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch('/api/funnels?papelera=1', { cache: 'no-store' });
      const d = await r.json();
      setItems(d.embudos ?? []);
      setSel(new Set());
    } catch { setItems([]); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const alternar = (slug: string) => setSel(s => {
    const n = new Set(s);
    n.has(slug) ? n.delete(slug) : n.add(slug);
    return n;
  });
  const todos = () => setSel(s => (s.size === items.length ? new Set() : new Set(items.map(i => i.slug))));

  const seleccionados = [...sel];

  async function restaurar() {
    setOcupado(true);
    try {
      await fetch('/api/funnels', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'restaurar', ids: seleccionados }),
      });
      await cargar(); onCambio();
    } finally { setOcupado(false); setModal(null); }
  }

  async function eliminarDefinitivo() {
    setOcupado(true);
    try {
      await fetch(`/api/funnels?ids=${seleccionados.map(encodeURIComponent).join(',')}`, { method: 'DELETE' });
      await cargar(); onCambio();
    } finally { setOcupado(false); setModal(null); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8E8E8] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#0D0D0D]">🗑️ Papelera</h3>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">Embudos eliminados. Puedes restaurarlos o borrarlos para siempre.</p>
          </div>
          <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#0D0D0D] text-xl leading-none">×</button>
        </div>

        {/* Barra de acciones */}
        <div className="px-6 py-3 border-b border-[#EFEFEF] flex items-center gap-2 flex-wrap">
          <button
            onClick={todos}
            disabled={items.length === 0}
            className="text-xs font-medium text-[#00847A] hover:underline disabled:text-[#C9C9C9] disabled:no-underline"
          >{sel.size === items.length && items.length > 0 ? 'Quitar selección' : 'Seleccionar todos'}</button>
          <div className="flex-1" />
          <button
            onClick={() => setModal('restaurar')}
            disabled={sel.size === 0 || ocupado}
            className="px-3 py-1.5 rounded-lg border border-[#00A89D]/40 text-[#00847A] text-xs font-semibold hover:bg-[#00A89D]/10 disabled:opacity-40"
          >♻ Restaurar{sel.size ? ` (${sel.size})` : ''}</button>
          <button
            onClick={() => setModal('eliminar')}
            disabled={sel.size === 0 || ocupado}
            className="px-3 py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-semibold hover:bg-[#B91C1C] disabled:opacity-40"
          >🗑 Eliminar definitivamente{sel.size ? ` (${sel.size})` : ''}</button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cargando ? (
            <p className="text-sm text-[#9A9A9A] text-center py-10">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[#9A9A9A] text-center py-10">La papelera está vacía.</p>
          ) : (
            <div className="space-y-2">
              {items.map(e => (
                <label key={e.slug} className="flex items-center gap-3 rounded-xl border border-[#EFEFEF] p-3 cursor-pointer hover:bg-[#FAFAFA]">
                  <input type="checkbox" checked={sel.has(e.slug)} onChange={() => alternar(e.slug)} className="w-4 h-4 accent-[#00A89D]" />
                  {e.imagenes?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.imagenes[0]} alt="" className="w-10 h-10 rounded-lg object-contain bg-[#F5F5F5] shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#F5F5F5] flex items-center justify-center shrink-0">🛍️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#0D0D0D] truncate">{e.producto || e.slug}</div>
                    <div className="text-[11px] text-[#6B6B6B] truncate">{e.slug} · {pesos(e.precio)}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmaciones */}
      <ModalConfirm
        abierto={modal === 'restaurar'}
        titulo="Restaurar embudos"
        mensaje={`¿Restaurar ${sel.size} elemento(s)? Volverán a tu lista de embudos.`}
        textoConfirmar="Restaurar"
        onConfirmar={restaurar}
        onCancelar={() => setModal(null)}
      />
      <ModalConfirm
        abierto={modal === 'eliminar'}
        titulo="Eliminar definitivamente"
        mensaje={`¿Eliminar definitivamente ${sel.size} elemento(s)? Esta acción NO se puede deshacer.`}
        textoConfirmar="Eliminar para siempre"
        peligro
        onConfirmar={eliminarDefinitivo}
        onCancelar={() => setModal(null)}
      />
    </div>
  );
}

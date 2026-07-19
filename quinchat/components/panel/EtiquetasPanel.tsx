'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Etiqueta {
  id: string;
  nombre: string;
  color: string;
  descripcion?: string;
  created_at: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const COLOR_PRESETS = [
  '#10B981', // verde esmeralda
  '#00A89D', // teal Agencia Quin
  '#3B82F6', // azul
  '#8B5CF6', // violeta
  '#06B6D4', // cyan
  '#F59E0B', // ámbar
  '#EF4444', // rojo
  '#EC4899', // rosa
  '#6B7280', // gris
  '#0D0D0D', // negro
];

const ETIQUETAS_INICIALES = [
  { nombre: 'PENDIENTE POR CONFIRMACIÓN', color: '#8B5CF6', descripcion: 'Pedido recibido, esperando que el cliente confirme sus datos' },
  { nombre: 'VENTA REALIZADA',            color: '#10B981', descripcion: 'Cliente confirmó datos — pedido listo para despacho' },
  { nombre: 'PEDIDO PROCESADO',           color: '#3B82F6', descripcion: 'Pedido ya fue enviado o está en preparación' },
  { nombre: 'PENDIENTE DE ABONO',         color: '#06B6D4', descripcion: 'El cliente tiene un saldo pendiente de pago' },
  { nombre: 'PEDIDO PROGRAMADO',          color: '#14B8A6', descripcion: 'El cliente lo agendó para después / avisará cuando quiera confirmar' },
  { nombre: 'PEDIDO CANCELADO',           color: '#EF4444', descripcion: 'El cliente canceló o no quiere el pedido' },
  { nombre: 'HUMANO',                     color: '#8B5CF6', descripcion: 'El bot transfirió la conversación a un agente humano' },
  { nombre: 'ATENDIDO POR WHATSAPP',      color: '#F59E0B', descripcion: 'Conversación ya fue atendida por un agente' },
];

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

/* ─── Modal ─────────────────────────────────────────────────────────────── */
interface ModalProps {
  etiqueta?: Etiqueta | null;
  onClose: () => void;
  onSaved: () => void;
}

function EtiquetaModal({ etiqueta, onClose, onSaved }: ModalProps) {
  const [nombre,      setNombre]      = useState(etiqueta?.nombre      ?? '');
  const [color,       setColor]       = useState(etiqueta?.color       ?? '#10B981');
  const [descripcion, setDescripcion] = useState(etiqueta?.descripcion ?? '');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  async function handleSave() {
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true);
    try {
      const url    = etiqueta ? `/api/etiquetas/${etiqueta.id}` : '/api/etiquetas';
      const method = etiqueta ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim().toUpperCase(), color, descripcion: descripcion.trim() }),
      });
      if (!res.ok) { const e = await res.json(); setError(e.error ?? 'Error al guardar'); return; }
      onSaved();
      onClose();
    } catch { setError('Error de red'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-[#0D0D0D] font-semibold text-base">
            {etiqueta ? 'Editar etiqueta' : 'Nueva etiqueta'}
          </h3>
          <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#0D0D0D] text-xl leading-none">×</button>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-sm"
            style={{ background: color }}
          >
            🏷 {nombre || 'NOMBRE ETIQUETA'}
          </span>
        </div>

        {/* Nombre */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#6B6B6B] font-medium uppercase tracking-wide">Nombre</label>
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej: VENTA REALIZADA"
            className="bg-[#FAF9F6] border border-[#E8E8E8] rounded-xl px-4 py-2.5 text-sm text-[#0D0D0D] placeholder-[#6B6B6B]/40 focus:outline-none focus:border-[#00A89D] transition-colors uppercase"
          />
        </div>

        {/* Color */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[#6B6B6B] font-medium uppercase tracking-wide">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-[#00A89D] scale-110' : 'hover:scale-105'}`}
                style={{ background: c }}
                title={c}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-7 h-7 rounded-full cursor-pointer border-0 p-0 bg-transparent"
              title="Color personalizado"
            />
          </div>
        </div>

        {/* Descripción */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#6B6B6B] font-medium uppercase tracking-wide">Descripción <span className="normal-case opacity-60">(opcional)</span></label>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="¿Cuándo se usa esta etiqueta?"
            rows={2}
            className="bg-[#FAF9F6] border border-[#E8E8E8] rounded-xl px-4 py-2.5 text-sm text-[#0D0D0D] placeholder-[#6B6B6B]/40 focus:outline-none focus:border-[#00A89D] resize-none transition-colors"
          />
        </div>

        {error && (
          <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-[#6B6B6B] text-sm font-medium hover:bg-[#F5F5F5] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !nombre.trim()}
            className="flex-1 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-bold hover:bg-[#007A72] disabled:opacity-40 transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Panel ─────────────────────────────────────────────────────────── */
export default function EtiquetasPanel() {
  const [etiquetas,    setEtiquetas]    = useState<Etiqueta[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editTarget,   setEditTarget]   = useState<Etiqueta | null>(null);
  const [confirmDel,   setConfirmDel]   = useState<string | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [search,       setSearch]       = useState('');
  const [convCounts,   setConvCounts]   = useState<Record<string, number>>({});
  const [seeding,      setSeeding]      = useState(false);

  const supabase = createBrowserSupabaseClient();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/etiquetas');
    if (res.ok) {
      const data: Etiqueta[] = await res.json();
      setEtiquetas(data);

      // Count conversations per label
      const { data: convs } = await supabase
        .from('conversations')
        .select('label');
      const counts: Record<string, number> = {};
      (convs ?? []).forEach((c: any) => {
        if (c.label) counts[c.label] = (counts[c.label] ?? 0) + 1;
      });
      setConvCounts(counts);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    setDeleting(true);
    await fetch(`/api/etiquetas/${id}`, { method: 'DELETE' });
    setDeleting(false);
    setConfirmDel(null);
    load();
  }

  async function seedDefaults() {
    setSeeding(true);
    for (const e of ETIQUETAS_INICIALES) {
      await fetch('/api/etiquetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e),
      });
    }
    setSeeding(false);
    load();
  }

  const filtered = etiquetas.filter(e =>
    e.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col bg-[#FAF9F6] overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-[#E8E8E8] bg-white flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-[#0D0D0D] font-semibold text-base">Etiquetas</h2>
          <p className="text-[#6B6B6B] text-xs mt-0.5">Organiza y segmenta tus conversaciones por etapa del pedido</p>
        </div>
        <div className="flex items-center gap-2">
          {etiquetas.length === 0 && !loading && (
            <button
              onClick={seedDefaults}
              disabled={seeding}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8E8E8] text-[#6B6B6B] text-xs font-medium hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
            >
              {seeding ? '⏳' : '✨'} {seeding ? 'Cargando...' : 'Cargar predeterminadas'}
            </button>
          )}
          <button
            onClick={() => { setEditTarget(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#007A72] transition-colors"
          >
            <span className="text-base leading-none">+</span> Nueva etiqueta
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-6 py-3 border-b border-[#E8E8E8] bg-white shrink-0">
        <div className="relative max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] text-xs">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar etiqueta..."
            className="w-full bg-[#FAF9F6] border border-[#E8E8E8] rounded-lg pl-8 pr-3 py-2 text-xs text-[#0D0D0D] placeholder-[#6B6B6B]/50 focus:outline-none focus:border-[#00A89D] transition-colors"
          />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-32 text-[#6B6B6B] text-sm">Cargando...</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-[#6B6B6B] gap-3">
            <span className="text-4xl">🏷️</span>
            <p className="text-sm">
              {etiquetas.length === 0
                ? 'No hay etiquetas. Crea la primera o carga las predeterminadas.'
                : 'Sin resultados para la búsqueda.'}
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(etq => {
              const count = convCounts[etq.nombre] ?? 0;
              return (
                <div
                  key={etq.id}
                  className="bg-white border border-[#E8E8E8] rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-all group"
                >
                  {/* Top: badge + actions */}
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-sm max-w-[75%] truncate"
                      style={{ background: etq.color }}
                    >
                      🏷 <span className="truncate">{etq.nombre}</span>
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => { setEditTarget(etq); setModalOpen(true); }}
                        title="Editar"
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#F5F5F5] border border-[#E8E8E8] text-[#6B6B6B] hover:text-[#00A89D] hover:border-[#00A89D]/30 transition-all text-sm"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setConfirmDel(etq.id)}
                        title="Eliminar"
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#F5F5F5] border border-[#E8E8E8] text-[#6B6B6B] hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all text-sm"
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  {/* Descripción */}
                  {etq.descripcion && (
                    <p className="text-xs text-[#6B6B6B] leading-relaxed">{etq.descripcion}</p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#F5F5F5] mt-auto">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-bold text-[#0D0D0D]">{count}</span>
                      <span className="text-xs text-[#6B6B6B]">conversación{count !== 1 ? 'es' : ''}</span>
                    </div>
                    <span className="text-[10px] text-[#6B6B6B]">{fmtDate(etq.created_at)}</span>
                  </div>

                  {/* Color bar */}
                  <div className="h-1 rounded-full w-full mt-0" style={{ background: etq.color, opacity: 0.35 }} />

                  {/* Delete confirm */}
                  {confirmDel === etq.id && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between gap-2">
                      <span className="text-xs text-red-600 font-medium">¿Eliminar esta etiqueta?</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleDelete(etq.id)}
                          disabled={deleting}
                          className="px-2.5 py-1 bg-red-500 text-white text-[10px] font-bold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {deleting ? '...' : 'Sí'}
                        </button>
                        <button
                          onClick={() => setConfirmDel(null)}
                          className="px-2.5 py-1 bg-white border border-[#E8E8E8] text-[#6B6B6B] text-[10px] rounded-lg hover:bg-[#F5F5F5] transition-colors"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Auto-asignación info */}
        {!loading && (
          <div className="mt-8 bg-[#00A89D]/5 border border-[#00A89D]/20 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-[#00A89D] mb-2">🤖 Auto-asignación de etiquetas</h3>
            <div className="flex flex-col gap-2 text-xs text-[#6B6B6B]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#8B5CF6] shrink-0" />
                <span><strong>Nuevo pedido Funnelish</strong> → se asigna automáticamente <strong>PENDIENTE POR CONFIRMACIÓN</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10B981] shrink-0" />
                <span><strong>Cliente responde CONFIRMO</strong> → se asigna automáticamente <strong>VENTA REALIZADA</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <EtiquetaModal
          etiqueta={editTarget}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          onSaved={load}
        />
      )}
    </div>
  );
}

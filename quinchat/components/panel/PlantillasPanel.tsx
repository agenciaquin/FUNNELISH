'use client';

import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface Plantilla {
  id: string;
  nombre: string;
  contenido: string;
  created_at: string;
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function PlantillasPanel() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [editing, setEditing]       = useState<Plantilla | null>(null);
  const [isNew, setIsNew]           = useState(false);
  const [saving, setSaving]         = useState(false);

  const supabase = createBrowserSupabaseClient();

  async function load() {
    const { data } = await supabase
      .from('plantillas')
      .select('*')
      .order('created_at', { ascending: false });
    setPlantillas(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = plantillas.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.contenido.toLowerCase().includes(search.toLowerCase())
  );

  function openNew() {
    setEditing({ id: '', nombre: '', contenido: '', created_at: '' });
    setIsNew(true);
  }

  function openEdit(p: Plantilla) {
    setEditing({ ...p });
    setIsNew(false);
  }

  async function save() {
    if (!editing || saving) return;
    if (!editing.nombre.trim() || !editing.contenido.trim()) {
      alert('Nombre y contenido son requeridos.');
      return;
    }
    setSaving(true);
    if (isNew) {
      await supabase.from('plantillas').insert({
        nombre: editing.nombre.trim(),
        contenido: editing.contenido.trim(),
      });
    } else {
      await supabase.from('plantillas').update({
        nombre: editing.nombre.trim(),
        contenido: editing.contenido.trim(),
      }).eq('id', editing.id);
    }
    setSaving(false);
    setEditing(null);
    await load();
  }

  async function deleteP(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    await supabase.from('plantillas').delete().eq('id', id);
    setPlantillas(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A] overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1C1C1C] bg-[#080808] shrink-0">
        <div>
          <h1 className="text-white font-bold text-lg">Plantillas</h1>
          <p className="text-xs text-gray-600 mt-0.5">Mensajes predefinidos reutilizables</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs pointer-events-none">🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="bg-[#1A1A1A] border border-[#252525] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40 w-48"
            />
          </div>
          <button
            onClick={openNew}
            className="w-8 h-8 rounded-lg bg-[#C9A84C] text-black font-bold text-lg flex items-center justify-center hover:bg-[#d4b05c] active:scale-95 transition-all"
          >
            +
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-gray-600 text-sm">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-700 gap-2">
            <span className="text-2xl">📋</span>
            <span className="text-xs">{plantillas.length === 0 ? 'Sin plantillas aún — crea la primera con +' : 'Sin resultados'}</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0A0A0A] border-b border-[#1C1C1C]">
              <tr>
                <th className="w-10 px-4 py-3" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Mensajes</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-44">Creado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-[#111] hover:bg-white/[0.02] group">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-gray-600 hover:text-[#C9A84C] transition-colors"
                      title="Editar"
                    >
                      ✏️
                    </button>
                  </td>
                  <td className="px-4 py-3 text-white font-medium">{p.nombre}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-gray-500 text-xs">
                      <span>💬</span>
                      <span>1</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{formatFecha(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal / edit drawer */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-[#252525] rounded-2xl w-full max-w-lg flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-base">{isNew ? 'Nueva plantilla' : 'Editar plantilla'}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-600 hover:text-white text-lg">✕</button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
                <input
                  value={editing.nombre}
                  onChange={e => setEditing(prev => prev ? { ...prev, nombre: e.target.value } : null)}
                  placeholder="ej. bienvenida_catalogo_"
                  className="w-full bg-[#1A1A1A] border border-[#252525] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Contenido del mensaje</label>
                <textarea
                  value={editing.contenido}
                  onChange={e => setEditing(prev => prev ? { ...prev, contenido: e.target.value } : null)}
                  placeholder="Hola! Bienvenido a KLIXMANT…"
                  rows={6}
                  className="w-full bg-[#1A1A1A] border border-[#252525] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40 resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              {!isNew && (
                <button
                  onClick={() => { deleteP(editing.id); setEditing(null); }}
                  className="px-4 py-2 rounded-lg text-xs text-red-500 border border-red-500/20 hover:bg-red-500/10 transition-all"
                >
                  Eliminar
                </button>
              )}
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg text-xs text-gray-400 border border-[#252525] hover:border-[#333] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-[#C9A84C] text-black hover:bg-[#d4b05c] disabled:opacity-50 transition-all"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

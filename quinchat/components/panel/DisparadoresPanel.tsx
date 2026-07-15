'use client';

import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface Disparador {
  id: string;
  nombre: string;
  tipo: string;
  condiciones: number;
  acciones: number;
  activo: boolean;
  created_at: string;
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const TIPOS = ['Lógica', 'Keyword', 'Evento', 'Tiempo'];

export default function DisparadoresPanel() {
  const [disparadores, setDisparadores] = useState<Disparador[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [editing, setEditing]           = useState<Disparador | null>(null);
  const [isNew, setIsNew]               = useState(false);
  const [saving, setSaving]             = useState(false);

  const supabase = createBrowserSupabaseClient();

  async function load() {
    const { data } = await supabase
      .from('disparadores')
      .select('*')
      .order('created_at', { ascending: false });
    setDisparadores(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = disparadores.filter(d =>
    d.nombre.toLowerCase().includes(search.toLowerCase()) ||
    d.tipo.toLowerCase().includes(search.toLowerCase())
  );

  function openNew() {
    setEditing({ id: '', nombre: '', tipo: 'Lógica', condiciones: 0, acciones: 1, activo: true, created_at: '' });
    setIsNew(true);
  }

  function openEdit(d: Disparador) {
    setEditing({ ...d });
    setIsNew(false);
  }

  async function toggleActivo(d: Disparador) {
    const newVal = !d.activo;
    setDisparadores(prev => prev.map(x => x.id === d.id ? { ...x, activo: newVal } : x));
    await supabase.from('disparadores').update({ activo: newVal }).eq('id', d.id);
  }

  async function save() {
    if (!editing || saving) return;
    if (!editing.nombre.trim()) { alert('El nombre es requerido.'); return; }
    setSaving(true);
    if (isNew) {
      await supabase.from('disparadores').insert({
        nombre: editing.nombre.trim(),
        tipo: editing.tipo,
        condiciones: editing.condiciones,
        acciones: editing.acciones,
        activo: editing.activo,
      });
    } else {
      await supabase.from('disparadores').update({
        nombre: editing.nombre.trim(),
        tipo: editing.tipo,
        condiciones: editing.condiciones,
        acciones: editing.acciones,
      }).eq('id', editing.id);
    }
    setSaving(false);
    setEditing(null);
    await load();
  }

  async function deleteD(id: string) {
    if (!confirm('¿Eliminar este disparador?')) return;
    await supabase.from('disparadores').delete().eq('id', id);
    setDisparadores(prev => prev.filter(d => d.id !== id));
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A] overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1C1C1C] bg-[#080808] shrink-0">
        <div>
          <h1 className="text-white font-bold text-lg">Disparadores</h1>
          <p className="text-xs text-gray-600 mt-0.5">Automatizaciones que activan acciones</p>
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
            <span className="text-2xl">⚡</span>
            <span className="text-xs">{disparadores.length === 0 ? 'Sin disparadores aún — crea el primero con +' : 'Sin resultados'}</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0A0A0A] border-b border-[#1C1C1C]">
              <tr>
                <th className="w-10 px-4 py-3" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Condiciones</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Acciones</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-44">Creado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Activo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-[#111] hover:bg-white/[0.02] group">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(d)}
                      className="text-gray-600 hover:text-[#C9A84C] transition-colors"
                      title="Editar"
                    >
                      ✏️
                    </button>
                  </td>
                  <td className="px-4 py-3 text-white font-medium">{d.nombre}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-[#1A1A1A] border border-[#252525] text-xs text-gray-400">
                      {d.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">{d.condiciones}</td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">{d.acciones}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{formatFecha(d.created_at)}</td>
                  <td className="px-4 py-3 text-center">
                    {/* Toggle switch */}
                    <button
                      onClick={() => toggleActivo(d)}
                      className={`relative w-9 h-5 rounded-full transition-all ${d.activo ? 'bg-[#3B82F6]' : 'bg-[#252525]'}`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow ${d.activo ? 'left-4' : 'left-0.5'}`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-[#252525] rounded-2xl w-full max-w-md flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-base">{isNew ? 'Nuevo disparador' : 'Editar disparador'}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-600 hover:text-white text-lg">✕</button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
                <input
                  value={editing.nombre}
                  onChange={e => setEditing(prev => prev ? { ...prev, nombre: e.target.value } : null)}
                  placeholder="ej. catalogo_bmw"
                  className="w-full bg-[#1A1A1A] border border-[#252525] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
                <select
                  value={editing.tipo}
                  onChange={e => setEditing(prev => prev ? { ...prev, tipo: e.target.value } : null)}
                  className="w-full bg-[#1A1A1A] border border-[#252525] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A84C]/40"
                >
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Condiciones</label>
                  <input
                    type="number" min={0}
                    value={editing.condiciones}
                    onChange={e => setEditing(prev => prev ? { ...prev, condiciones: Number(e.target.value) } : null)}
                    className="w-full bg-[#1A1A1A] border border-[#252525] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A84C]/40"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Acciones</label>
                  <input
                    type="number" min={0}
                    value={editing.acciones}
                    onChange={e => setEditing(prev => prev ? { ...prev, acciones: Number(e.target.value) } : null)}
                    className="w-full bg-[#1A1A1A] border border-[#252525] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A84C]/40"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              {!isNew && (
                <button
                  onClick={() => { deleteD(editing.id); setEditing(null); }}
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

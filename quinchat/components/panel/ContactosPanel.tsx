'use client';

import { useState, useEffect, useCallback } from 'react';

/* ─── Types ─────────────────────────────────────────────────────────────── */
type OtroDato = { _id: string; parametro: string; valor: string };

interface Contacto {
  id: string;
  telefono_prefijo: string;
  telefono_numero: string;
  pais: string;
  nombre: string;
  etiqueta: string;
  estado: string;
  otros_datos: OtroDato[];
  created_at: string;
}

interface EtiquetaObj {
  id: string;
  nombre: string;
  color: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const PREFIJO_PAIS: Record<string, string> = {
  '+57': 'Colombia',
  '+1':  'Estados Unidos',
  '+52': 'México',
  '+34': 'España',
  '+54': 'Argentina',
  '+51': 'Perú',
  '+56': 'Chile',
  '+58': 'Venezuela',
  '+593': 'Ecuador',
  '+591': 'Bolivia',
};

const ESTADO_OPS = ['Sin agregar', 'Agregado', 'Bloqueado'];

const DEFAULT_COLORS: Record<string, string> = {
  'VENTA REALIZADA':            '#10b981',
  'PEDIDO PROCESADO':           '#3b82f6',
  'PENDIENTE POR CONFIRMACIÓN': '#8b5cf6',
  'PENDIENTE DE ABONO':         '#06b6d4',
  'PEDIDO PROGRAMADO':          '#14b8a6',
  'PEDIDO CANCELADO':           '#ef4444',
  'HUMANO':                     '#8b5cf6',
  'atendido por Whatsap':       '#f59e0b',
};

function labelColor(name: string, etiquetasMap: Record<string, string>): string {
  return etiquetasMap[name] ?? DEFAULT_COLORS[name] ?? '#C9A84C';
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleString('es-CO', {
      day: 'numeric', month: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}

const EMPTY_FORM = {
  telefono_prefijo: '+57',
  telefono_numero: '',
  pais: 'Colombia',
  nombre: '',
  etiqueta: '',
  estado: 'Sin agregar',
  otros_datos: [] as OtroDato[],
};

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function ContactosPanel() {
  const [contactos, setContactos]   = useState<Contacto[]>([]);
  const [etiquetas, setEtiquetas]   = useState<EtiquetaObj[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  /* Modal */
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Contacto | null>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, eRes] = await Promise.all([
        fetch('/api/contactos'),
        fetch('/api/etiquetas').catch(() => null),
      ]);
      const cData = await cRes.json();
      setContactos(Array.isArray(cData) ? cData : []);
      if (eRes?.ok) {
        const eData = await eRes.json();
        setEtiquetas(Array.isArray(eData) ? eData : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Modal helpers ── */
  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, otros_datos: [] });
    setModalOpen(true);
  }

  function openEdit(c: Contacto) {
    setEditing(c);
    setForm({
      telefono_prefijo: c.telefono_prefijo,
      telefono_numero:  c.telefono_numero,
      pais:             c.pais,
      nombre:           c.nombre,
      etiqueta:         c.etiqueta,
      estado:           c.estado,
      otros_datos:      (c.otros_datos ?? []).map(o => ({ ...o, _id: o._id ?? crypto.randomUUID() })),
    });
    setModalOpen(true);
  }

  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(p => {
      const next = { ...p, [k]: v };
      if (k === 'telefono_prefijo') next.pais = PREFIJO_PAIS[v as string] ?? '';
      return next;
    });
  }

  function addOtroDato() {
    setForm(p => ({
      ...p,
      otros_datos: [...p.otros_datos, { _id: crypto.randomUUID(), parametro: '', valor: '' }],
    }));
  }

  function updateOtroDato(_id: string, key: 'parametro' | 'valor', val: string) {
    setForm(p => ({
      ...p,
      otros_datos: p.otros_datos.map(o => o._id === _id ? { ...o, [key]: val } : o),
    }));
  }

  function removeOtroDato(_id: string) {
    setForm(p => ({ ...p, otros_datos: p.otros_datos.filter(o => o._id !== _id) }));
  }

  async function save() {
    setSaving(true);
    const payload = {
      ...form,
      otros_datos: form.otros_datos.map(({ parametro, valor }) => ({ parametro, valor })),
    };
    const res = editing
      ? await fetch(`/api/contactos/${editing.id}`, { method: 'PUT',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/contactos',                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      alert('Error: ' + (err.error ?? res.statusText));
      return;
    }
    setModalOpen(false);
    load();
  }

  async function deleteContact(id: string) {
    if (!confirm('¿Eliminar este contacto?')) return;
    await fetch(`/api/contactos/${id}`, { method: 'DELETE' });
    setModalOpen(false);
    load();
  }

  /* ── Derived ── */
  const etiquetasMap = Object.fromEntries(etiquetas.map(e => [e.nombre, e.color]));
  const allLabelNames = Array.from(new Set([
    ...etiquetas.map(e => e.nombre),
    ...contactos.map(c => c.etiqueta).filter(Boolean),
  ]));

  const filtered = contactos.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.nombre.toLowerCase().includes(q) || c.telefono_numero.includes(q);
    const matchLabel  = !filterLabel || c.etiqueta === filterLabel;
    return matchSearch && matchLabel;
  });

  /* ── Render ── */
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0C0C0C]">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-[#1C1C1C]">
        <h1 className="text-xl font-bold text-white tracking-tight">Contactos</h1>
        <div className="flex items-center gap-3">

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar contacto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-60 bg-[#111] border border-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2 pl-9 focus:outline-none focus:border-[#C9A84C]/50"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          </div>

          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilter(p => !p)}
              className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                filterLabel
                  ? 'bg-[#C9A84C]/10 border-[#C9A84C]/40 text-[#C9A84C]'
                  : 'bg-[#111] border-[#2A2A2A] text-gray-400 hover:text-white'
              }`}
            >
              ▾
            </button>
            {showFilter && (
              <div className="absolute right-0 top-10 z-30 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-2xl py-1 min-w-[220px]">
                <button
                  onClick={() => { setFilterLabel(''); setShowFilter(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium ${
                    !filterLabel ? 'bg-[#C9A84C] text-black' : 'text-gray-300 hover:bg-[#2A2A2A]'
                  }`}
                >
                  Todos
                </button>
                {allLabelNames.map(l => (
                  <button
                    key={l}
                    onClick={() => { setFilterLabel(l); setShowFilter(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 ${
                      filterLabel === l ? 'bg-[#C9A84C]/10 text-[#C9A84C]' : 'text-gray-300 hover:bg-[#2A2A2A]'
                    }`}
                  >
                    <span style={{ color: labelColor(l, etiquetasMap) }}>◆</span>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add */}
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#C9A84C] hover:bg-[#D4B86A] text-black font-bold text-sm rounded-lg transition-all"
          >
            + Agregar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" onClick={() => showFilter && setShowFilter(false)}>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-gray-600 text-sm">Cargando contactos…</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1C1C1C]">
                <th className="px-6 py-3 w-8" />
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Teléfono</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">País</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Etiqueta</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Creado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-600">
                    {search || filterLabel
                      ? 'Sin resultados para esta búsqueda'
                      : 'No hay contactos. Haz clic en "+ Agregar".'}
                  </td>
                </tr>
              ) : filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => openEdit(c)}
                  className="border-b border-[#1C1C1C] hover:bg-[#1A1A1A] transition-colors cursor-pointer"
                >
                  <td className="px-6 py-3 text-gray-600 text-base">−</td>
                  <td className="px-6 py-3 text-gray-300">{c.telefono_numero}</td>
                  <td className="px-6 py-3 text-gray-400">{c.pais}</td>
                  <td className="px-6 py-3">
                    <span className={c.nombre ? 'text-[#C9A84C]' : 'text-gray-600'}>
                      {c.nombre || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {c.etiqueta && (
                      <span className="flex items-center gap-1.5">
                        <span style={{ color: labelColor(c.etiqueta, etiquetasMap) }}>◆</span>
                        <span className="text-gray-300">{c.etiqueta}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-500 text-xs">{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── MODAL ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
          onClick={e => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-green-600">Información del contacto</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 flex flex-col gap-5">

              {/* Teléfono + País */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <div className="flex gap-2">
                    <select
                      value={form.telefono_prefijo}
                      onChange={e => setF('telefono_prefijo', e.target.value)}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-green-500"
                    >
                      {Object.keys(PREFIJO_PAIS).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={form.telefono_numero}
                      onChange={e => setF('telefono_numero', e.target.value)}
                      placeholder="3004362800"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                  <input
                    type="text"
                    value={form.pais}
                    readOnly
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-default"
                  />
                </div>
              </div>

              {/* Nombre + Etiqueta */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setF('nombre', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta</label>
                  <select
                    value={form.etiqueta}
                    onChange={e => setF('etiqueta', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  >
                    <option value="">Sin etiquetado</option>
                    {allLabelNames.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Otros datos */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-medium text-gray-700">Otros datos:</span>
                  <button
                    onClick={addOtroDato}
                    className="w-7 h-7 bg-green-500 hover:bg-green-600 text-white rounded-md flex items-center justify-center text-xl font-bold leading-none transition-all"
                  >
                    +
                  </button>
                </div>

                {form.otros_datos.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-2 bg-gray-50 border-b border-gray-200 px-3 py-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Parámetro</span>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Valor</span>
                    </div>
                    {form.otros_datos.map(o => (
                      <div key={o._id} className="grid grid-cols-2 border-b border-gray-100 last:border-0">
                        <input
                          type="text"
                          value={o.parametro}
                          onChange={e => updateOtroDato(o._id, 'parametro', e.target.value)}
                          placeholder="parámetro"
                          className="px-3 py-2 text-sm border-r border-gray-100 focus:outline-none focus:bg-green-50"
                        />
                        <div className="flex">
                          <input
                            type="text"
                            value={o.valor}
                            onChange={e => updateOtroDato(o._id, 'valor', e.target.value)}
                            placeholder="valor"
                            className="flex-1 px-3 py-2 text-sm focus:outline-none focus:bg-green-50"
                          />
                          <button
                            onClick={() => removeOtroDato(o._id)}
                            className="px-2 text-red-400 hover:text-red-600 text-lg"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Estado + Guardar */}
              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Estado:</label>
                  <select
                    value={form.estado}
                    onChange={e => setF('estado', e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
                  >
                    {ESTADO_OPS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  {editing && (
                    <button
                      onClick={() => deleteContact(editing.id)}
                      className="px-3 py-2 text-sm text-red-500 hover:text-red-700 transition-all"
                    >
                      🗑 Eliminar
                    </button>
                  )}
                  <button
                    onClick={save}
                    disabled={saving || !form.telefono_numero.trim()}
                    className="flex items-center gap-2 px-5 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold text-sm rounded-lg transition-all"
                  >
                    💾 {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

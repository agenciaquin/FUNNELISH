'use client';

import { useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type TipoDisparador = 'Ninguna' | 'Lógica' | 'Etiqueta cambiada' | 'Flujo de mensajes' | 'Tiempo';

interface Plantilla { id: string; nombre: string; tipo: string; imagen_url: string; }

interface Condicion {
  _id: string;
  tipo: 'ultimo_mensaje' | 'cantidad_mensajes' | 'palabras' | 'plantilla_enviada' | 'etiqueta' | 'horario' | 'pais';
  si_se_ha?: 'Enviado' | 'No enviado';
  plantilla_id?: string;
  plantilla_nombre?: string;
  valor?: string;
}

interface Accion {
  _id: string;
  tipo: 'enviar_plantilla' | 'cambiar_etiqueta' | 'configurar_conversacion' | 'cambiar_estado' | 'notificar_admin' | 'extraer_info' | 'programar_mensaje';
  plantilla_id?: string;
  plantilla_nombre?: string;
  valor?: string;
}

interface Disparador {
  id: string;
  nombre: string;
  tipo: string;
  logica: string;
  tipo_mensajes: string;
  enviar_asistente: boolean;
  condiciones: Condicion[];
  acciones: Accion[];
  activo: boolean;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TIPOS: TipoDisparador[] = ['Ninguna', 'Lógica', 'Etiqueta cambiada', 'Flujo de mensajes', 'Tiempo'];

const TIPOS_CONDICION = [
  { key: 'ultimo_mensaje',    label: 'Ultimo mensaje enviado' },
  { key: 'cantidad_mensajes', label: 'Cantidad de mensajes enviado' },
  { key: 'palabras',          label: 'Comprobar palabras' },
  { key: 'plantilla_enviada', label: 'Comprobar plantilla si/no enviada' },
  { key: 'etiqueta',          label: 'Etiqueta actual' },
  { key: 'horario',           label: 'Comprobar horario' },
  { key: 'pais',              label: 'Comprobar país' },
] as const;

const TIPOS_ACCION = [
  { key: 'enviar_plantilla',        label: 'Enviar plantilla de mensaje' },
  { key: 'cambiar_etiqueta',        label: 'Cambiar etiqueta' },
  { key: 'configurar_conversacion', label: 'Configurar conversación' },
  { key: 'cambiar_estado',          label: 'Cambiar estado contacto' },
  { key: 'notificar_admin',         label: 'Enviar notificación Administradores' },
  { key: 'extraer_info',            label: 'Extraer información conversación' },
  { key: 'programar_mensaje',       label: 'Programar mensaje' },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2); }

function emptyDisparador(): Disparador {
  return {
    id: '', nombre: '', tipo: 'Lógica', logica: '',
    tipo_mensajes: 'Auto', enviar_asistente: true,
    condiciones: [], acciones: [], activo: true, created_at: '',
  };
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DisparadoresPanel() {
  const [disparadores, setDisparadores] = useState<Disparador[]>([]);
  const [plantillas, setPlantillas]     = useState<Plantilla[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [view, setView]                 = useState<'list' | 'edit'>('list');
  const [current, setCurrent]           = useState<Disparador>(emptyDisparador());
  const [isNew, setIsNew]               = useState(false);
  const [saving, setSaving]             = useState(false);
  const [tabRight, setTabRight]         = useState<'condiciones' | 'acciones'>('condiciones');
  const [showCondDD, setShowCondDD]     = useState(false);
  const [showAccDD, setShowAccDD]       = useState(false);

  const [modal, setModal] = useState<{ open: boolean; target: 'cond' | 'acc'; targetId: string; search: string }>({
    open: false, target: 'cond', targetId: '', search: '',
  });

  async function load() {
    const [dr, pr] = await Promise.all([
      fetch('/api/disparadores'),
      fetch('/api/plantillas'),
    ]);
    const dd = await dr.json();
    const pd = await pr.json();
    setDisparadores(Array.isArray(dd) ? dd : []);
    setPlantillas(Array.isArray(pd) ? pd : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = disparadores.filter(d =>
    d.nombre.toLowerCase().includes(search.toLowerCase())
  );

  function openNew() {
    setCurrent(emptyDisparador());
    setIsNew(true);
    setTabRight('condiciones');
    setShowCondDD(false);
    setShowAccDD(false);
    setView('edit');
  }

  function openEdit(d: Disparador) {
    setCurrent({
      ...d,
      logica: d.logica ?? '',
      tipo_mensajes: d.tipo_mensajes ?? 'Auto',
      enviar_asistente: d.enviar_asistente ?? true,
      condiciones: (Array.isArray(d.condiciones) ? d.condiciones : []).map(c => ({ ...c, _id: uid() })),
      acciones:    (Array.isArray(d.acciones)    ? d.acciones    : []).map(a => ({ ...a, _id: uid() })),
    });
    setIsNew(false);
    setTabRight('condiciones');
    setShowCondDD(false);
    setShowAccDD(false);
    setView('edit');
  }

  function backToList() { setView('list'); setCurrent(emptyDisparador()); }

  async function toggleActivo(d: Disparador, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/disparadores/${d.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !d.activo }),
    });
    setDisparadores(prev => prev.map(x => x.id === d.id ? { ...x, activo: !x.activo } : x));
  }

  async function save() {
    if (saving) return;
    if (!current.nombre.trim()) { alert('El nombre es requerido.'); return; }
    setSaving(true);
    const payload = {
      nombre:           current.nombre.trim(),
      tipo:             current.tipo,
      logica:           current.logica,
      tipo_mensajes:    current.tipo_mensajes,
      enviar_asistente: current.enviar_asistente,
      condiciones:      current.condiciones.map(({ _id, ...rest }) => rest),
      acciones:         current.acciones.map(({ _id, ...rest }) => rest),
      activo:           current.activo,
    };
    let res: Response;
    if (isNew) {
      res = await fetch('/api/disparadores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      res = await fetch(`/api/disparadores/${current.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      alert('Error: ' + (err.error ?? res.statusText));
      return;
    }
    await load();
    backToList();
  }

  async function deleteD() {
    if (!confirm('¿Eliminar este disparador?')) return;
    await fetch(`/api/disparadores/${current.id}`, { method: 'DELETE' });
    await load();
    backToList();
  }

  function addCondicion(tipo: Condicion['tipo']) {
    setCurrent(p => ({ ...p, condiciones: [...p.condiciones, { _id: uid(), tipo, si_se_ha: 'No enviado' }] }));
    setShowCondDD(false);
  }
  function updateCond(id: string, patch: Partial<Condicion>) {
    setCurrent(p => ({ ...p, condiciones: p.condiciones.map(c => c._id === id ? { ...c, ...patch } : c) }));
  }
  function removeCond(id: string) {
    setCurrent(p => ({ ...p, condiciones: p.condiciones.filter(c => c._id !== id) }));
  }

  function addAccion(tipo: Accion['tipo']) {
    setCurrent(p => ({ ...p, acciones: [...p.acciones, { _id: uid(), tipo }] }));
    setShowAccDD(false);
  }
  function updateAcc(id: string, patch: Partial<Accion>) {
    setCurrent(p => ({ ...p, acciones: p.acciones.map(a => a._id === id ? { ...a, ...patch } : a) }));
  }
  function removeAcc(id: string) {
    setCurrent(p => ({ ...p, acciones: p.acciones.filter(a => a._id !== id) }));
  }

  function openModal(target: 'cond' | 'acc', targetId: string) {
    setModal({ open: true, target, targetId, search: '' });
  }
  function selectPlantilla(p: Plantilla) {
    const { target, targetId } = modal;
    if (target === 'cond') updateCond(targetId, { plantilla_id: p.id, plantilla_nombre: p.nombre });
    else                   updateAcc(targetId,  { plantilla_id: p.id, plantilla_nombre: p.nombre });
    setModal(m => ({ ...m, open: false }));
  }

  const filteredModal = plantillas.filter(p =>
    p.nombre.toLowerCase().includes(modal.search.toLowerCase())
  );

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1C1C1C] bg-[#080808] shrink-0">
        <div>
          <h1 className="text-white font-bold text-lg">Disparadores</h1>
          <p className="text-xs text-gray-600 mt-0.5">Automatizaciones basadas en condiciones</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs pointer-events-none">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="bg-[#1A1A1A] border border-[#252525] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40 w-48" />
          </div>
          <button onClick={openNew} className="w-8 h-8 rounded-lg bg-[#C9A84C] text-black font-bold text-lg flex items-center justify-center hover:bg-[#d4b05c] active:scale-95 transition-all">+</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-gray-600 text-sm">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-700 gap-2">
            <span className="text-2xl">⚡</span>
            <span className="text-xs">{disparadores.length === 0 ? 'Sin disparadores — crea el primero con +' : 'Sin resultados'}</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0A0A0A] border-b border-[#1C1C1C]">
              <tr>
                <th className="w-8 px-4 py-3" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Condiciones</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Acciones</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-44">Creado</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-[#111] hover:bg-white/[0.02] cursor-pointer" onClick={() => openEdit(d)}>
                  <td className="px-4 py-3 text-gray-600">✏️</td>
                  <td className="px-4 py-3 text-white font-medium">{d.nombre}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">{d.tipo}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{(Array.isArray(d.condiciones) ? d.condiciones : []).length}</td>
                  <td className="px-4 py-3 text-[#C9A84C] text-xs font-medium">{(Array.isArray(d.acciones) ? d.acciones : []).length}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{formatFecha(d.created_at)}</td>
                  <td className="px-4 py-3" onClick={e => toggleActivo(d, e)}>
                    <div className={`w-9 h-5 rounded-full relative transition-all ${d.activo ? 'bg-[#C9A84C]' : 'bg-[#333]'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${d.activo ? 'left-4' : 'left-0.5'}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ── EDIT VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex min-w-0 overflow-hidden bg-[#0A0A0A] relative">

      {/* Plantilla selector modal */}
      {modal.open && (
        <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-[#111] border border-[#252525] rounded-2xl w-96 max-h-[500px] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1C1C1C]">
              <h3 className="text-white font-semibold text-sm">Seleccionar plantilla</h3>
              <div className="flex items-center gap-3">
                <select className="bg-[#1A1A1A] border border-[#252525] rounded-lg px-2 py-1 text-xs text-white focus:outline-none">
                  <option>Todos</option>
                </select>
                <button onClick={() => setModal(m => ({ ...m, open: false }))} className="text-gray-600 hover:text-white text-xl leading-none">×</button>
              </div>
            </div>
            <div className="px-4 py-3 border-b border-[#1C1C1C]">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs">🔍</span>
                <input value={modal.search} onChange={e => setModal(m => ({ ...m, search: e.target.value }))}
                  placeholder="Buscar..." autoFocus
                  className="w-full bg-[#1A1A1A] border border-[#252525] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredModal.length === 0 ? (
                <div className="text-center py-8 text-gray-600 text-xs">Sin plantillas</div>
              ) : filteredModal.map(p => (
                <button key={p.id} onClick={() => selectPlantilla(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-all text-left">
                  {p.imagen_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imagen_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[#252525] flex items-center justify-center shrink-0">
                      <span className="text-gray-600 text-xs">💬</span>
                    </div>
                  )}
                  <span className="text-white text-xs font-medium flex-1">{p.nombre}</span>
                  <span className="text-[10px] text-gray-600">1 💬</span>
                </button>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-[#1C1C1C]">
              <button onClick={() => setModal(m => ({ ...m, open: false }))}
                className="w-full py-2 rounded-lg bg-[#C9A84C] text-black text-xs font-semibold hover:bg-[#d4b05c] transition-all">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left: form */}
      <div className="flex-1 flex flex-col border-r border-[#1C1C1C] min-w-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1C1C1C] bg-[#080808] shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={backToList} className="text-gray-600 hover:text-white transition-colors text-sm">← Volver</button>
            <h2 className="text-[#C9A84C] font-semibold text-sm">Disparador</h2>
          </div>
          <div className="flex gap-2">
            {!isNew && (
              <button onClick={deleteD} className="px-3 py-1.5 rounded-lg text-xs text-red-500 border border-red-500/20 hover:bg-red-500/10 transition-all">Eliminar</button>
            )}
            <button onClick={save} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#C9A84C] text-black hover:bg-[#d4b05c] disabled:opacity-50 transition-all">
              {saving ? 'Guardando…' : '💾 Guardar'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Nombre</label>
            <input value={current.nombre} onChange={e => setCurrent(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Identificador del disparador"
              className="w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40" />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Seleccione el tipo de disparador</label>
            <select value={current.tipo} onChange={e => setCurrent(p => ({ ...p, tipo: e.target.value }))}
              className="w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/40">
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {current.tipo === 'Lógica' && (
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">🔧 Lógica</label>
                <textarea value={current.logica} onChange={e => setCurrent(p => ({ ...p, logica: e.target.value }))}
                  placeholder="Escribir la lógica..." maxLength={400} rows={5}
                  className="w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40 resize-none" />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-gray-600">Lógica que usa el asistente para validar los mensajes nuevos</p>
                  <span className="text-[10px] text-gray-700">{current.logica.length}/400</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#111] border border-[#252525] rounded-xl px-4 py-3">
                <span className="text-sm text-white">Enviar mensajes generado por el asistente</span>
                <div className="flex items-center gap-3">
                  {current.enviar_asistente && (
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Tipo de mensajes</label>
                      <select value={current.tipo_mensajes} onChange={e => setCurrent(p => ({ ...p, tipo_mensajes: e.target.value }))}
                        className="bg-[#1A1A1A] border border-[#252525] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                        <option>Auto</option>
                        <option>Texto</option>
                        <option>Audio</option>
                      </select>
                    </div>
                  )}
                  <button onClick={() => setCurrent(p => ({ ...p, enviar_asistente: !p.enviar_asistente }))}
                    className={`w-10 h-6 rounded-full relative transition-all shrink-0 ${current.enviar_asistente ? 'bg-[#C9A84C]' : 'bg-[#333]'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${current.enviar_asistente ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: condiciones/acciones */}
      <div className="w-[420px] shrink-0 flex flex-col bg-[#080808]">
        <div className="flex border-b border-[#1C1C1C] shrink-0">
          <button onClick={() => setTabRight('condiciones')}
            className={`flex-1 py-3.5 text-xs font-semibold transition-all ${tabRight === 'condiciones' ? 'text-red-400 border-b-2 border-red-400' : 'text-gray-600 hover:text-gray-400'}`}>
            Condiciones
          </button>
          <button onClick={() => setTabRight('acciones')}
            className={`flex-1 py-3.5 text-xs font-semibold transition-all ${tabRight === 'acciones' ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-gray-600 hover:text-gray-400'}`}>
            Acciones
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

          {/* CONDICIONES */}
          {tabRight === 'condiciones' && (
            <>
              {current.condiciones.map(c => (
                <div key={c._id} className="bg-[#111] border border-[#252525] rounded-xl p-3.5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                      ⓘ {TIPOS_CONDICION.find(t => t.key === c.tipo)?.label ?? c.tipo}
                    </span>
                    <button onClick={() => removeCond(c._id)} className="text-red-500/50 hover:text-red-400 text-xl leading-none transition-colors">−</button>
                  </div>

                  {c.tipo === 'plantilla_enviada' && (
                    <div className="flex items-end gap-2">
                      <div className="shrink-0">
                        <label className="text-[10px] text-gray-500 block mb-1">Sí se ha:</label>
                        <select value={c.si_se_ha ?? 'No enviado'}
                          onChange={e => updateCond(c._id, { si_se_ha: e.target.value as 'Enviado' | 'No enviado' })}
                          className="bg-[#1A1A1A] border border-[#252525] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                          <option>Enviado</option>
                          <option>No enviado</option>
                        </select>
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-gray-500 block mb-1">La plantilla:</label>
                        <button onClick={() => openModal('cond', c._id)}
                          className="w-full flex items-center justify-between bg-[#1A1A1A] border border-[#252525] rounded-lg px-3 py-1.5 text-xs hover:border-[#C9A84C]/30 transition-all">
                          <span className={c.plantilla_nombre ? 'text-white' : 'text-gray-600'}>{c.plantilla_nombre ?? 'No seleccionado aún'}</span>
                          <span className="text-gray-500">⬆</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {c.tipo === 'palabras' && (
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Palabras clave (separadas por coma):</label>
                      <input value={c.valor ?? ''} onChange={e => updateCond(c._id, { valor: e.target.value })}
                        placeholder="precio, catálogo, quiero..."
                        className="w-full bg-[#1A1A1A] border border-[#252525] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40" />
                    </div>
                  )}

                  {(c.tipo === 'ultimo_mensaje' || c.tipo === 'cantidad_mensajes' || c.tipo === 'etiqueta' || c.tipo === 'horario' || c.tipo === 'pais') && (
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Valor:</label>
                      <input value={c.valor ?? ''} onChange={e => updateCond(c._id, { valor: e.target.value })}
                        placeholder="Ingresa el valor..."
                        className="w-full bg-[#1A1A1A] border border-[#252525] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40" />
                    </div>
                  )}
                </div>
              ))}

              <div className="relative">
                <button onClick={() => { setShowCondDD(v => !v); setShowAccDD(false); }}
                  className={`w-full py-2.5 rounded-lg border text-xs font-semibold transition-all ${showCondDD ? 'bg-red-500/10 border-red-500/40 text-red-400' : 'border-red-500/25 text-red-400 hover:bg-red-500/10'}`}>
                  Agregar condición
                </button>
                {showCondDD && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#141414] border border-[#252525] rounded-xl shadow-2xl z-10 overflow-hidden">
                    {TIPOS_CONDICION.map(t => (
                      <button key={t.key} onClick={() => addCondicion(t.key)}
                        className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-white/5 transition-all">
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ACCIONES */}
          {tabRight === 'acciones' && (
            <>
              {current.acciones.map(a => (
                <div key={a._id} className="bg-[#111] border border-[#252525] rounded-xl p-3.5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                      ⓘ {TIPOS_ACCION.find(t => t.key === a.tipo)?.label ?? a.tipo}
                    </span>
                    <button onClick={() => removeAcc(a._id)} className="text-red-500/50 hover:text-red-400 text-xl leading-none transition-colors">−</button>
                  </div>

                  {a.tipo === 'enviar_plantilla' && (
                    <button onClick={() => openModal('acc', a._id)}
                      className="w-full flex items-center justify-between bg-[#1A1A1A] border border-[#252525] rounded-lg px-3 py-2 text-xs hover:border-[#C9A84C]/30 transition-all">
                      <span className={a.plantilla_nombre ? 'text-white' : 'text-gray-600'}>{a.plantilla_nombre ?? 'No seleccionado aún'}</span>
                      <span className="text-gray-500">⬆</span>
                    </button>
                  )}

                  {(a.tipo === 'cambiar_etiqueta' || a.tipo === 'cambiar_estado' || a.tipo === 'configurar_conversacion' || a.tipo === 'programar_mensaje') && (
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Valor:</label>
                      <input value={a.valor ?? ''} onChange={e => updateAcc(a._id, { valor: e.target.value })}
                        placeholder="Ingresa el valor..."
                        className="w-full bg-[#1A1A1A] border border-[#252525] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40" />
                    </div>
                  )}
                </div>
              ))}

              <div className="relative">
                <button onClick={() => { setShowAccDD(v => !v); setShowCondDD(false); }}
                  className={`w-full py-2.5 rounded-lg border text-xs font-semibold transition-all ${showAccDD ? 'bg-[#C9A84C]/10 border-[#C9A84C]/40 text-[#C9A84C]' : 'border-[#C9A84C]/25 text-[#C9A84C] hover:bg-[#C9A84C]/10'}`}>
                  Agregar acción
                </button>
                {showAccDD && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#141414] border border-[#252525] rounded-xl shadow-2xl z-10 overflow-hidden">
                    {TIPOS_ACCION.map(t => (
                      <button key={t.key} onClick={() => addAccion(t.key)}
                        className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-white/5 transition-all">
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

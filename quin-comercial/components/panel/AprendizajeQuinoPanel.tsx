'use client';

import { useState, useEffect } from 'react';

/**
 * Aprendizaje de Quino (solo super-admin).
 * Revisa, edita, aprueba/descarta y agrega soluciones que Quino usa para
 * ayudar a los clientes a conectar WhatsApp con Meta. Cerebro compartido.
 */

interface Item {
  id: string;
  problema: string;
  solucion: string;
  estado: 'aprobada' | 'descartada';
  veces_util: number;
  origen_slug: string | null;
  revisada: boolean;
  creada_at: string;
  actualizada_at: string;
}

export default function AprendizajeQuinoPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [falta, setFalta] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, { problema: string; solucion: string }>>({});
  const [nuevo, setNuevo] = useState({ problema: '', solucion: '' });
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const r = await fetch('/api/quino-aprendizaje');
      const d = await r.json();
      if (r.ok) { setItems(d.items ?? []); setFalta(!!d.faltaMigracion); }
      else setMsg(d.error ?? 'No se pudo cargar');
    } finally { setLoading(false); }
  }
  useEffect(() => { cargar(); }, []);

  async function patch(id: string, cambios: Record<string, unknown>) {
    setItems(prev => prev.map(x => x.id === id ? { ...x, ...cambios } as Item : x));
    await fetch('/api/quino-aprendizaje', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...cambios }),
    });
  }

  async function borrar(id: string) {
    setItems(prev => prev.filter(x => x.id !== id));
    await fetch('/api/quino-aprendizaje', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  async function agregar() {
    if (!nuevo.problema.trim() || !nuevo.solucion.trim() || guardandoNuevo) return;
    setGuardandoNuevo(true);
    try {
      const r = await fetch('/api/quino-aprendizaje', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevo),
      });
      if (r.ok) { setNuevo({ problema: '', solucion: '' }); setMsg('Solución agregada ✓'); cargar(); }
      else { const d = await r.json(); setMsg(d.error ?? 'Error'); }
    } finally { setGuardandoNuevo(false); }
  }

  const sinRevisar = items.filter(i => !i.revisada && i.estado === 'aprobada').length;
  const inputCls = 'w-full bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm text-[#0D0D0D] placeholder:text-[#B5B5B5] focus:outline-none focus:border-[#00A89D]';

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-[#0D0D0D] font-bold text-lg">Aprendizaje de Quino</h1>
        <p className="text-xs text-[#6B6B6B] mt-0.5 mb-4">
          Lo que Quino aprende ayudando a los clientes a conectar WhatsApp. Se usa de inmediato; aquí lo revisas, mejoras o borras.
          {sinRevisar > 0 && <span className="ml-1 text-[#00847A] font-semibold">· {sinRevisar} sin revisar</span>}
        </p>

        {msg && <div className="mb-3 text-sm rounded-lg px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200">{msg}</div>}
        {falta && (
          <div className="mb-3 text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200">
            Falta correr la migración de la tabla <code>quino_aprendizaje</code> en Supabase.
          </div>
        )}

        {/* Agregar a mano */}
        <div className="mb-5 rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-sm">
          <div className="text-sm font-bold text-[#0D0D0D] mb-2">Agregar solución a mano</div>
          <input
            value={nuevo.problema}
            onChange={e => setNuevo(n => ({ ...n, problema: e.target.value }))}
            placeholder="Problema o duda típica (ej. 'El webhook no verifica')"
            className={inputCls + ' mb-2'}
          />
          <textarea
            value={nuevo.solucion}
            onChange={e => setNuevo(n => ({ ...n, solucion: e.target.value }))}
            placeholder="Solución (los pasos que lo resuelven)"
            rows={3}
            className={inputCls + ' resize-y'}
          />
          <button
            onClick={agregar}
            disabled={guardandoNuevo || !nuevo.problema.trim() || !nuevo.solucion.trim()}
            className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#00847A] disabled:opacity-40"
          >
            {guardandoNuevo ? 'Agregando…' : 'Agregar'}
          </button>
        </div>

        {loading ? (
          <div className="text-[#9A9A9A] text-sm">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="text-[#9A9A9A] text-sm">Todavía no hay nada aprendido. Se irá llenando solo cuando los clientes usen a Quino, o agrega tú una arriba.</div>
        ) : (
          <div className="space-y-3">
            {items.map(it => {
              const ed = edit[it.id];
              return (
                <div key={it.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${it.estado === 'descartada' ? 'opacity-60 border-[#E8E8E8]' : !it.revisada ? 'border-[#00A89D]/40' : 'border-[#E8E8E8]'}`}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {!it.revisada && it.estado === 'aprobada' && <span className="text-[10px] font-bold text-[#00847A] bg-[#00A89D]/12 rounded-full px-2 py-0.5">NUEVO</span>}
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${it.estado === 'aprobada' ? 'text-emerald-700 bg-emerald-50' : 'text-[#9A9A9A] bg-[#F5F5F5]'}`}>{it.estado === 'aprobada' ? 'ACTIVA' : 'DESCARTADA'}</span>
                    <span className="text-[11px] text-[#9A9A9A]">👍 {it.veces_util} · {it.origen_slug ? `de: ${it.origen_slug}` : ''}</span>
                  </div>

                  {ed ? (
                    <>
                      <input value={ed.problema} onChange={e => setEdit(s => ({ ...s, [it.id]: { ...ed, problema: e.target.value } }))} className={inputCls + ' mb-2 font-semibold'} />
                      <textarea value={ed.solucion} onChange={e => setEdit(s => ({ ...s, [it.id]: { ...ed, solucion: e.target.value } }))} rows={3} className={inputCls + ' resize-y'} />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => { patch(it.id, { problema: ed.problema, solucion: ed.solucion, revisada: true }); setEdit(s => { const c = { ...s }; delete c[it.id]; return c; }); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00A89D] text-white hover:bg-[#00847A]"
                        >Guardar</button>
                        <button onClick={() => setEdit(s => { const c = { ...s }; delete c[it.id]; return c; })} className="px-3 py-1.5 rounded-lg text-xs border border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5]">Cancelar</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-[#0D0D0D]">{it.problema}</div>
                      <div className="text-[13px] text-[#3A3A3A] mt-1 whitespace-pre-wrap">{it.solucion}</div>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <button onClick={() => setEdit(s => ({ ...s, [it.id]: { problema: it.problema, solucion: it.solucion } }))} className="px-3 py-1.5 rounded-lg text-xs border border-[#E8E8E8] text-[#3A3A3A] hover:border-[#00A89D]/40">Editar</button>
                        {!it.revisada && <button onClick={() => patch(it.id, { revisada: true })} className="px-3 py-1.5 rounded-lg text-xs border border-[#E8E8E8] text-[#3A3A3A] hover:border-[#00A89D]/40">Marcar revisada</button>}
                        {it.estado === 'aprobada'
                          ? <button onClick={() => patch(it.id, { estado: 'descartada' })} className="px-3 py-1.5 rounded-lg text-xs border border-[#E8E8E8] text-[#9A6a00] hover:bg-amber-50">Descartar</button>
                          : <button onClick={() => patch(it.id, { estado: 'aprobada' })} className="px-3 py-1.5 rounded-lg text-xs border border-[#E8E8E8] text-emerald-700 hover:bg-emerald-50">Reactivar</button>}
                        <button onClick={() => borrar(it.id)} className="px-3 py-1.5 rounded-lg text-xs text-red-600 border border-red-200 hover:bg-red-50">Borrar</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

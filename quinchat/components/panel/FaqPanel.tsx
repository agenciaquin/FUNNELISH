'use client';

import { useState, useEffect, useCallback } from 'react';

interface Faq {
  id: string;
  pregunta: string;
  respuesta: string;
  categoria: string | null;
  estado: string;
  veces: number;
  conversacion_id: string | null;
  creada_at: string;
  aprobada_at: string | null;
}

const CATEGORIAS = [
  'Envíos y entregas', 'Pagos y abonos', 'Producto y tallas',
  'Garantías y cambios', 'Precios y promociones', 'Otros',
];

const COLOR_CAT: Record<string, string> = {
  'Envíos y entregas':     '#0EA5E9',
  'Pagos y abonos':        '#EAB308',
  'Producto y tallas':     '#8B5CF6',
  'Garantías y cambios':   '#EC4899',
  'Precios y promociones': '#15803D',
  'Otros':                 '#6B7280',
};

function fecha(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export default function FaqPanel() {
  const [vista, setVista]       = useState<'propuesta' | 'aprobada' | 'descartada'>('propuesta');
  const [faqs, setFaqs]         = useState<Faq[]>([]);
  const [pendientes, setPend]   = useState(0);
  const [aprobadas, setAprob]   = useState(0);
  const [cargando, setCargando] = useState(true);
  const [editId, setEditId]     = useState<string | null>(null);
  const [ePreg, setEPreg]       = useState('');
  const [eResp, setEResp]       = useState('');
  const [eCat, setECat]         = useState('Otros');
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [nPreg, setNPreg]       = useState('');
  const [nResp, setNResp]       = useState('');
  const [nCat, setNCat]         = useState('Otros');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res  = await fetch(`/api/faq?estado=${vista}`, { cache: 'no-store' });
      const data = await res.json();
      setFaqs(data.faqs ?? []);
      setPend(data.pendientes ?? 0);
      setAprob(data.aprobadas ?? 0);
    } finally { setCargando(false); }
  }, [vista]);

  useEffect(() => { cargar(); }, [cargar]);

  async function accion(payload: Record<string, unknown>) {
    await fetch('/api/faq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setEditId(null);
    await cargar();
  }

  function abrirEdicion(f: Faq) {
    setEditId(f.id);
    setEPreg(f.pregunta);
    setEResp(f.respuesta);
    setECat(f.categoria ?? 'Otros');
  }

  const tab = (activa: boolean) =>
    `px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
      activa ? 'bg-[#00A89D] text-white shadow-sm' : 'text-[#6B6B6B] hover:text-[#0D0D0D] hover:bg-[#F0F0F0]'
    }`;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">

        <header className="mb-5 pl-10 md:pl-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">Preguntas frecuentes</h1>
          <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
            El bot guarda aquí lo que preguntan los clientes con la respuesta que dio.
            Aprueba las que sirvan para ir armando tu base. Las más preguntadas aparecen primero.
          </p>
        </header>

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button onClick={() => setVista('propuesta')} className={tab(vista === 'propuesta')}>
            📥 Por revisar {pendientes > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/25 text-[10px]">{pendientes}</span>}
          </button>
          <button onClick={() => setVista('aprobada')} className={tab(vista === 'aprobada')}>
            ✅ Aprobadas {aprobadas > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/25 text-[10px]">{aprobadas}</span>}
          </button>
          <button onClick={() => setVista('descartada')} className={tab(vista === 'descartada')}>
            🚫 Descartadas
          </button>

          <div className="flex-1" />

          <button
            onClick={() => setNuevaOpen(true)}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#00A89D] text-white hover:bg-[#00847A]"
          >+ Agregar pregunta</button>
        </div>

        {vista === 'propuesta' && faqs.length > 1 && (
          <div className="mb-4 flex items-center justify-between bg-[#00A89D]/8 border border-[#00A89D]/25 rounded-xl px-4 py-2.5">
            <span className="text-xs text-[#00847A]">¿Todo lo de abajo está bien?</span>
            <button
              onClick={() => { if (confirm('¿Aprobar todas estas preguntas?')) accion({ accion: 'aprobar-todas' }); }}
              className="text-xs font-bold text-[#00847A] hover:underline"
            >Aprobar todas</button>
          </div>
        )}

        {cargando ? (
          <p className="text-sm text-[#6B6B6B] py-12 text-center">Cargando…</p>
        ) : faqs.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="text-4xl mb-3 opacity-30">
              {vista === 'propuesta' ? '📥' : vista === 'aprobada' ? '✅' : '🚫'}
            </div>
            <p className="text-sm text-[#6B6B6B]">
              {vista === 'propuesta'
                ? 'Aún no hay preguntas por revisar. A medida que los clientes escriban, el bot irá guardando aquí lo que preguntan.'
                : vista === 'aprobada'
                ? 'Todavía no has aprobado ninguna pregunta. Aprueba las de "Por revisar" o agrega una tú mismo.'
                : 'No has descartado ninguna.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {faqs.map(f => {
              const color = COLOR_CAT[f.categoria ?? 'Otros'] ?? '#6B7280';
              const enEdicion = editId === f.id;
              return (
                <div key={f.id} className="bg-white rounded-2xl border border-[#E8E8E8] p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color, background: `${color}18` }}
                    >{f.categoria ?? 'Otros'}</span>
                    {f.veces > 1 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309]">
                        🔥 preguntada {f.veces} veces
                      </span>
                    )}
                    <span className="text-[10px] text-[#9A9A9A]">
                      {vista === 'aprobada' ? `aprobada el ${fecha(f.aprobada_at)}` : fecha(f.creada_at)}
                    </span>
                  </div>

                  {enEdicion ? (
                    <div className="space-y-2 mb-2">
                      <div>
                        <label className="text-[10px] font-bold text-[#6B6B6B] uppercase">Pregunta</label>
                        <input
                          value={ePreg}
                          onChange={e => setEPreg(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[#00A89D] text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[#6B6B6B] uppercase">Respuesta</label>
                        <textarea
                          value={eResp}
                          onChange={e => setEResp(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-[#00A89D] text-sm resize-y focus:outline-none"
                        />
                      </div>
                      <select
                        value={eCat}
                        onChange={e => setECat(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#E8E8E8] text-sm bg-white"
                      >
                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-[#0D0D0D] leading-snug mb-1">
                        <span className="text-[#00847A]">P:</span> {f.pregunta}
                      </p>
                      <p className="text-sm text-[#3A3A3A] leading-snug mb-3 whitespace-pre-wrap">
                        <span className="text-[#00847A] font-semibold">R:</span> {f.respuesta}
                      </p>
                    </>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {enEdicion ? (
                      <>
                        <button
                          onClick={() => accion(
                            vista === 'aprobada'
                              ? { accion: 'guardar', id: f.id, pregunta: ePreg, respuesta: eResp, categoria: eCat }
                              : { accion: 'aprobar', id: f.id, pregunta: ePreg, respuesta: eResp, categoria: eCat }
                          )}
                          className="px-3 py-1.5 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A]"
                        >{vista === 'aprobada' ? 'Guardar' : '✓ Aprobar'}</button>
                        <button
                          onClick={() => setEditId(null)}
                          className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs text-[#6B6B6B] hover:bg-[#F5F5F5]"
                        >Cancelar</button>
                      </>
                    ) : vista === 'propuesta' ? (
                      <>
                        <button
                          onClick={() => accion({ accion: 'aprobar', id: f.id })}
                          className="px-3 py-1.5 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A]"
                        >✓ Aprobar</button>
                        <button
                          onClick={() => abrirEdicion(f)}
                          className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs text-[#0D0D0D] hover:bg-[#F5F5F5]"
                        >✏️ Corregir y aprobar</button>
                        <button
                          onClick={() => accion({ accion: 'descartar', id: f.id })}
                          className="px-3 py-1.5 rounded-lg text-xs text-[#DC2626] hover:bg-[#FEE2E2] ml-auto"
                        >🗑 Descartar</button>
                      </>
                    ) : vista === 'aprobada' ? (
                      <>
                        <button
                          onClick={() => abrirEdicion(f)}
                          className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs text-[#0D0D0D] hover:bg-[#F5F5F5]"
                        >✏️ Corregir</button>
                        <button
                          onClick={() => { if (confirm('¿Quitar esta pregunta de la base?')) accion({ accion: 'descartar', id: f.id }); }}
                          className="px-3 py-1.5 rounded-lg text-xs text-[#DC2626] hover:bg-[#FEE2E2] ml-auto"
                        >🗑 Quitar</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => accion({ accion: 'restaurar', id: f.id })}
                          className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs text-[#0D0D0D] hover:bg-[#F5F5F5]"
                        >↩ Volver a revisar</button>
                        <button
                          onClick={() => { if (confirm('¿Borrarla del todo?')) accion({ accion: 'borrar-definitivo', id: f.id }); }}
                          className="px-3 py-1.5 rounded-lg text-xs text-[#DC2626] hover:bg-[#FEE2E2] ml-auto"
                        >🗑 Borrar del todo</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Agregar pregunta a mano */}
      {nuevaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setNuevaOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#0D0D0D] mb-1">Agregar pregunta frecuente</h3>
            <p className="text-xs text-[#6B6B6B] mb-4">Queda aprobada de una vez.</p>

            <label className="text-[10px] font-bold text-[#6B6B6B] uppercase">Pregunta</label>
            <input
              value={nPreg}
              onChange={e => setNPreg(e.target.value)}
              placeholder="Ej: ¿Hacen envíos a toda Colombia?"
              className="w-full px-3 py-2 rounded-lg border border-[#E8E8E8] text-sm focus:outline-none focus:border-[#00A89D] mb-3"
              autoFocus
            />
            <label className="text-[10px] font-bold text-[#6B6B6B] uppercase">Respuesta</label>
            <textarea
              value={nResp}
              onChange={e => setNResp(e.target.value)}
              rows={3}
              placeholder="Ej: ¡Sí! Enviamos a todo el país con pago contra entrega 🚚"
              className="w-full px-3 py-2 rounded-lg border border-[#E8E8E8] text-sm resize-y focus:outline-none focus:border-[#00A89D] mb-3"
            />
            <select
              value={nCat}
              onChange={e => setNCat(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E8E8E8] text-sm bg-white mb-4"
            >
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setNuevaOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-sm text-[#6B6B6B] hover:bg-[#F5F5F5]"
              >Cancelar</button>
              <button
                onClick={async () => {
                  if (!nPreg.trim() || !nResp.trim()) return;
                  await accion({ accion: 'crear', pregunta: nPreg, respuesta: nResp, categoria: nCat });
                  setNPreg(''); setNResp(''); setNCat('Otros'); setNuevaOpen(false); setVista('aprobada');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A]"
              >Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

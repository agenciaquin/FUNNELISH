'use client';

import { useState, useEffect, useCallback } from 'react';

interface Regla {
  id: string;
  regla: string;
  categoria: string | null;
  estado: string;
  ejemplo: string | null;
  conversacion_id: string | null;
  creada_at: string;
  aprobada_at: string | null;
}

const CATEGORIAS = [
  'Envíos y entregas', 'Pagos y abonos', 'Producto y tallas',
  'Garantías y cambios', 'Precios y promociones', 'Objeciones frecuentes', 'Otros',
];

const COLOR_CAT: Record<string, string> = {
  'Envíos y entregas':     '#0EA5E9',
  'Pagos y abonos':        '#EAB308',
  'Producto y tallas':     '#8B5CF6',
  'Garantías y cambios':   '#EC4899',
  'Precios y promociones': '#15803D',
  'Objeciones frecuentes': '#EA580C',
  'Otros':                 '#6B7280',
};

function fecha(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export default function MemoriaPanel() {
  const [vista, setVista]       = useState<'propuesta' | 'aprobada' | 'descartada'>('propuesta');
  const [reglas, setReglas]     = useState<Regla[]>([]);
  const [pendientes, setPend]   = useState(0);
  const [aprendidas, setAprend] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [textoEdit, setTextoEdit] = useState('');
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [nuevaRegla, setNuevaRegla] = useState('');
  const [nuevaCat, setNuevaCat]     = useState('Otros');
  const [analizando, setAnalizando] = useState(false);
  const [aviso, setAviso]           = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res  = await fetch(`/api/memoria?estado=${vista}`, { cache: 'no-store' });
      const data = await res.json();
      setReglas(data.reglas ?? []);
      setPend(data.pendientes ?? 0);
      setAprend(data.aprendidas ?? 0);
    } finally { setCargando(false); }
  }, [vista]);

  useEffect(() => { cargar(); }, [cargar]);

  async function accion(accion: string, id?: string, regla?: string, categoria?: string) {
    await fetch('/api/memoria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, id, regla, categoria }),
    });
    setEditando(null);
    await cargar();
  }

  async function analizarAhora() {
    setAnalizando(true);
    setAviso(null);
    try {
      const res  = await fetch('/api/cron/aprendizaje?horas=48', { cache: 'no-store' });
      const data = await res.json();
      if (data.status === 'ok')            setAviso(`✅ Encontré ${data.propuestas} cosas nuevas de ${data.chats} conversaciones.`);
      else if (data.status === 'sin-novedades') setAviso('Revisé los chats y no encontré nada nuevo que valga la pena aprender.');
      else if (data.status === 'sin-material')  setAviso('Todavía no hay suficientes conversaciones para analizar.');
      else if (data.error)                 setAviso(`❌ ${data.error}`);
      await cargar();
    } catch (e: any) {
      setAviso(`❌ ${e?.message ?? 'Error inesperado.'}`);
    } finally { setAnalizando(false); }
  }

  const tab = (activa: boolean) =>
    `px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
      activa ? 'bg-[#00A89D] text-white shadow-sm' : 'text-[#6B6B6B] hover:text-[#0D0D0D] hover:bg-[#F0F0F0]'
    }`;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">

        <header className="mb-5 pl-10 md:pl-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">Memoria del bot</h1>
          <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
            Cada día el bot propone lo que aprendió de los chats. Tú decides qué guarda.
            Nada entra a su memoria sin que lo apruebes.
          </p>
        </header>

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button onClick={() => setVista('propuesta')} className={tab(vista === 'propuesta')}>
            📥 Por revisar {pendientes > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/25 text-[10px]">{pendientes}</span>}
          </button>
          <button onClick={() => setVista('aprobada')} className={tab(vista === 'aprobada')}>
            🧠 Aprendido {aprendidas > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/25 text-[10px]">{aprendidas}</span>}
          </button>
          <button onClick={() => setVista('descartada')} className={tab(vista === 'descartada')}>
            🚫 Rechazado
          </button>

          <div className="flex-1" />

          <button
            onClick={analizarAhora}
            disabled={analizando}
            className="px-3 py-2 rounded-lg text-xs font-semibold border border-[#00A89D]/40 text-[#00847A] hover:bg-[#00A89D]/10 disabled:opacity-50"
          >
            {analizando ? 'Revisando chats…' : '🔍 Revisar ahora'}
          </button>
          <button
            onClick={() => setNuevaOpen(true)}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#00A89D] text-white hover:bg-[#00847A]"
          >+ Enseñarle algo</button>
        </div>

        {aviso && <div className="mb-4 text-xs p-3 rounded-xl bg-white border border-[#E8E8E8] text-[#0D0D0D]">{aviso}</div>}

        {vista === 'propuesta' && reglas.length > 1 && (
          <div className="mb-4 flex items-center justify-between bg-[#00A89D]/8 border border-[#00A89D]/25 rounded-xl px-4 py-2.5">
            <span className="text-xs text-[#00847A]">¿Todo lo de abajo está bien?</span>
            <button
              onClick={() => { if (confirm('¿Enviar todas estas reglas a la memoria del bot?')) accion('aprobar-todas'); }}
              className="text-xs font-bold text-[#00847A] hover:underline"
            >Enviar todas a la memoria</button>
          </div>
        )}

        {cargando ? (
          <p className="text-sm text-[#6B6B6B] py-12 text-center">Cargando…</p>
        ) : reglas.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="text-4xl mb-3 opacity-30">
              {vista === 'propuesta' ? '📥' : vista === 'aprobada' ? '🧠' : '🚫'}
            </div>
            <p className="text-sm text-[#6B6B6B]">
              {vista === 'propuesta'
                ? 'No hay nada por revisar. El bot analiza los chats cada noche y deja aquí lo que aprendió.'
                : vista === 'aprobada'
                ? 'El bot todavía no ha aprendido nada. Aprueba propuestas o enséñale algo tú mismo.'
                : 'No has rechazado nada. Lo que elimines aparecerá aquí y el bot no volverá a proponerlo.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reglas.map(r => {
              const color = COLOR_CAT[r.categoria ?? 'Otros'] ?? '#6B7280';
              const enEdicion = editando === r.id;
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-[#E8E8E8] p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color, background: `${color}18` }}
                    >{r.categoria ?? 'Otros'}</span>
                    <span className="text-[10px] text-[#9A9A9A]">
                      {vista === 'aprobada' ? `aprendido el ${fecha(r.aprobada_at)}` : fecha(r.creada_at)}
                    </span>
                  </div>

                  {enEdicion ? (
                    <textarea
                      value={textoEdit}
                      onChange={e => setTextoEdit(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-[#00A89D] text-sm resize-y focus:outline-none mb-2"
                      autoFocus
                    />
                  ) : (
                    <p className="text-sm text-[#0D0D0D] leading-snug mb-2">{r.regla}</p>
                  )}

                  {r.ejemplo && !enEdicion && (
                    <p className="text-[11px] text-[#6B6B6B] italic border-l-2 border-[#E8E8E8] pl-2 mb-3 line-clamp-2">
                      “{r.ejemplo}”
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {enEdicion ? (
                      <>
                        <button
                          onClick={() => accion(vista === 'propuesta' ? 'aprobar' : 'aprobar', r.id, textoEdit, r.categoria ?? 'Otros')}
                          className="px-3 py-1.5 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A]"
                        >Guardar</button>
                        <button
                          onClick={() => setEditando(null)}
                          className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs text-[#6B6B6B] hover:bg-[#F5F5F5]"
                        >Cancelar</button>
                      </>
                    ) : vista === 'propuesta' ? (
                      <>
                        <button
                          onClick={() => accion('aprobar', r.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A]"
                        >✓ Enviar a memoria</button>
                        <button
                          onClick={() => { setEditando(r.id); setTextoEdit(r.regla); }}
                          className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs text-[#0D0D0D] hover:bg-[#F5F5F5]"
                        >✏️ Corregir</button>
                        <button
                          onClick={() => accion('descartar', r.id)}
                          className="px-3 py-1.5 rounded-lg text-xs text-[#DC2626] hover:bg-[#FEE2E2] ml-auto"
                        >🗑 Eliminar</button>
                      </>
                    ) : vista === 'aprobada' ? (
                      <>
                        <button
                          onClick={() => { setEditando(r.id); setTextoEdit(r.regla); }}
                          className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs text-[#0D0D0D] hover:bg-[#F5F5F5]"
                        >✏️ Corregir</button>
                        <button
                          onClick={() => { if (confirm('¿Que el bot olvide esto?\n\nDejará de usarlo y tampoco lo volverá a proponer.')) accion('descartar', r.id); }}
                          className="px-3 py-1.5 rounded-lg text-xs text-[#DC2626] hover:bg-[#FEE2E2] ml-auto"
                        >🗑 Olvidar</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => accion('restaurar', r.id)}
                          className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs text-[#0D0D0D] hover:bg-[#F5F5F5]"
                        >↩ Volver a considerarla</button>
                        <button
                          onClick={() => { if (confirm('¿Borrarla del todo?\n\nOjo: si la borras, el bot podría volver a proponerla más adelante.')) accion('borrar-definitivo', r.id); }}
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

        {vista === 'aprobada' && aprendidas > 0 && (
          <p className="text-[10px] text-[#9A9A9A] text-center mt-6 leading-relaxed">
            Todo esto se le entrega al bot en cada conversación y tiene prioridad sobre lo que él suponga.
          </p>
        )}
      </div>

      {/* Enseñarle algo a mano */}
      {nuevaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setNuevaOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#0D0D0D] mb-1">Enseñarle algo al bot</h3>
            <p className="text-xs text-[#6B6B6B] mb-4">
              Escríbelo como una instrucción clara. Por ejemplo: <em>“El envío a zonas rurales tarda de 5 a 8 días hábiles.”</em>
            </p>

            <textarea
              value={nuevaRegla}
              onChange={e => setNuevaRegla(e.target.value)}
              rows={3}
              placeholder="Escribe lo que debe recordar…"
              className="w-full px-3 py-2 rounded-lg border border-[#E8E8E8] text-sm resize-y focus:outline-none focus:border-[#00A89D] mb-3"
              autoFocus
            />

            <select
              value={nuevaCat}
              onChange={e => setNuevaCat(e.target.value)}
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
                  if (!nuevaRegla.trim()) return;
                  await accion('crear', undefined, nuevaRegla, nuevaCat);
                  setNuevaRegla(''); setNuevaCat('Otros'); setNuevaOpen(false); setVista('aprobada');
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

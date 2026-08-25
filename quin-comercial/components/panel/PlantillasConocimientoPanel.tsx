'use client';

import { useState, useEffect } from 'react';
import { detectarCampos, aplicarValores, estimarTokens, semaforoTokens, type CampoPlantilla } from '@/lib/plantillas-conocimiento';

function BadgeTokens({ texto }: { texto: string }) {
  const t = estimarTokens(texto);
  const s = semaforoTokens(t);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: s.color, backgroundColor: s.color + '18' }}>
      ~{t.toLocaleString('es-CO')} tokens · {s.texto}
    </span>
  );
}

interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string | null;
  contenido: string;
  campos: CampoPlantilla[];
  origen: string;
  es_base?: boolean;    // plantilla de la agencia (compartida)
  editable?: boolean;   // ¿este usuario la puede editar/eliminar?
}

export default function PlantillasConocimientoPanel() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [esSuperadmin, setEsSuperadmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Modal "Usar plantilla"
  const [usar, setUsar] = useState<Plantilla | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [aplicando, setAplicando] = useState(false);

  // Modal "Crear / Editar plantilla"
  const [editor, setEditor] = useState<null | { id?: string; nombre: string; descripcion: string; contenido: string }>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const r = await fetch('/api/plantillas-conocimiento');
      const d = await r.json();
      if (r.ok) { setPlantillas(d.plantillas ?? []); setEsSuperadmin(!!d.esSuperadmin); }
    } finally { setLoading(false); }
  }

  // ── Duplicar: crea una copia editable a nombre de mi empresa ──
  async function duplicar(p: Plantilla) {
    setMsg(null);
    try {
      const r = await fetch('/api/plantillas-conocimiento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duplicar: p.id }),
      });
      const d = await r.json();
      if (r.ok) { setMsg({ ok: true, text: `Se creó tu copia editable de "${p.nombre}". Búscala abajo como "${p.nombre} (mi copia)" y edítala a tu gusto.` }); cargar(); }
      else setMsg({ ok: false, text: d.error ?? 'No se pudo duplicar' });
    } catch { setMsg({ ok: false, text: 'Error de conexión' }); }
  }
  useEffect(() => { cargar(); }, []);

  // ── Abrir "usar": pre-llena los campos con los ejemplos ──
  function abrirUsar(p: Plantilla) {
    const claves = detectarCampos(p.contenido);
    const meta = new Map((p.campos ?? []).map(c => [c.clave, c]));
    const init: Record<string, string> = {};
    for (const clave of claves) init[clave] = meta.get(clave)?.ejemplo ?? '';
    setValores(init);
    setUsar(p);
    setMsg(null);
  }

  const previa = usar ? aplicarValores(usar.contenido, valores) : '';

  // ── Aplicar al bot: escribe el prompt en bot_config del tenant actual ──
  async function aplicarAlBot() {
    if (!usar || aplicando) return;
    setAplicando(true);
    let ok = false, errText = 'no se pudo aplicar';
    try {
      const r = await fetch('/api/entrenamiento/guardar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: previa }),
      });
      const d = await r.json();
      ok = r.ok && d.ok; errText = d.error ?? errText;
    } catch { errText = 'error de conexión'; }
    setAplicando(false);
    if (!ok) { setMsg({ ok: false, text: 'No se pudo aplicar: ' + errText }); return; }
    setUsar(null);
    setMsg({ ok: true, text: '¡Plantilla aplicada! Ya quedó como el entrenamiento del bot. Revísala en la pestaña Entrenamiento.' });
  }

  // ── Crear / Editar ──
  async function guardarEditor() {
    if (!editor || guardando) return;
    if (!editor.nombre.trim() || !editor.contenido.trim()) { setMsg({ ok: false, text: 'Ponle nombre y contenido.' }); return; }
    setGuardando(true);
    try {
      const metodo = editor.id ? 'PUT' : 'POST';
      const r = await fetch('/api/plantillas-conocimiento', {
        method: metodo, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editor.id, nombre: editor.nombre, descripcion: editor.descripcion, contenido: editor.contenido }),
      });
      const d = await r.json();
      if (r.ok) { setEditor(null); setMsg({ ok: true, text: 'Plantilla guardada ✓' }); cargar(); }
      else setMsg({ ok: false, text: d.error ?? 'No se pudo guardar' });
    } catch { setMsg({ ok: false, text: 'Error de conexión' }); } finally { setGuardando(false); }
  }

  async function eliminar(p: Plantilla) {
    if (!confirm(`¿Eliminar la plantilla "${p.nombre}"?`)) return;
    await fetch('/api/plantillas-conocimiento?id=' + p.id, { method: 'DELETE' });
    cargar();
  }

  const inputCls = 'w-full bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm text-[#0D0D0D] placeholder:text-[#B5B5B5] focus:outline-none focus:border-[#00A89D]';

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="text-[#0D0D0D] font-bold text-lg">Plantillas de Conocimiento</h1>
          <button onClick={() => setEditor({ nombre: '', descripcion: '', contenido: '' })}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#00847A] active:scale-95 transition-all shrink-0">
            {esSuperadmin ? '+ Crear plantilla base' : '+ Crear mi plantilla'}
          </button>
        </div>
        <p className="text-xs text-[#6B6B6B] mb-5">
          Cerebros de venta ya armados. Elige uno, llena los datos de tu producto y aplícalo al bot de un clic. Lo genérico (flujo de venta, cierre, objeciones, abonos) ya viene listo; tú solo pones lo tuyo.
          {!esSuperadmin && <> Las plantillas <b>BASE</b> no se editan aquí: úsalas tal cual o <b>Duplícalas</b> para tener tu propia copia editable.</>}
        </p>

        {msg && <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>{msg.text}</div>}

        {loading ? <div className="text-[#9A9A9A] text-sm">Cargando…</div> : plantillas.length === 0 ? (
          <div className="text-[#9A9A9A] text-sm">Aún no hay plantillas. Crea la primera con “+ Crear plantilla”.</div>
        ) : (
          <div className="space-y-3">
            {plantillas.map(p => {
              const nCampos = detectarCampos(p.contenido).length;
              return (
                <div key={p.id} className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#0D0D0D]">{p.nombre}</span>
                        {(p.es_base ?? p.origen === 'sistema')
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00A89D]/10 text-[#00847A]" title="Plantilla de la agencia (no editable aquí)">BASE</span>
                          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" title="Tu plantilla">MÍA</span>}
                      </div>
                      {p.descripcion && <p className="text-[12px] text-[#6B6B6B] mt-1">{p.descripcion}</p>}
                      <p className="text-[11px] text-[#9A9A9A] mt-1.5">{nCampos} campos para llenar</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button onClick={() => abrirUsar(p)} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#00A89D] text-white hover:bg-[#00847A]">Usar en este bot</button>
                    <button onClick={() => duplicar(p)} className="px-3 py-1.5 rounded-lg border border-[#00A89D]/40 text-[#00847A] text-xs font-medium hover:bg-[#00A89D]/10" title="Crea una copia editable a tu nombre">⧉ Duplicar</button>
                    {p.editable && (
                      <button onClick={() => setEditor({ id: p.id, nombre: p.nombre, descripcion: p.descripcion ?? '', contenido: p.contenido })} className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs hover:bg-[#F5F5F5]">Editar</button>
                    )}
                    {p.editable && (
                      <button onClick={() => eliminar(p)} className="px-3 py-1.5 rounded-lg text-xs text-[#DC2626] hover:bg-[#FEE2E2] ml-auto">Eliminar</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal USAR ── */}
      {usar && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setUsar(null)}>
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#E8E8E8] flex items-center justify-between">
              <h2 className="font-bold text-[#0D0D0D]">Usar: {usar.nombre}</h2>
              <button onClick={() => setUsar(null)} className="text-[#9A9A9A] hover:text-[#0D0D0D] text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-hidden grid md:grid-cols-2">
              {/* Campos */}
              <div className="overflow-y-auto p-5 border-r border-[#E8E8E8] space-y-3">
                <p className="text-[11px] text-[#6B6B6B]">Llena los datos de tu producto. Lo que dejes vacío quedará marcado con [CORCHETES] para que lo notes.</p>
                {detectarCampos(usar.contenido).map(clave => {
                  const meta = (usar.campos ?? []).find(c => c.clave === clave);
                  const etiqueta = meta?.etiqueta ?? clave.replace(/_/g, ' ').toLowerCase();
                  return (
                    <div key={clave}>
                      <label className="block text-xs text-[#6B6B6B] mb-1">{etiqueta}</label>
                      {meta?.multilinea ? (
                        <textarea value={valores[clave] ?? ''} onChange={e => setValores(v => ({ ...v, [clave]: e.target.value }))} rows={3} className={inputCls + ' resize-y'} />
                      ) : (
                        <input value={valores[clave] ?? ''} onChange={e => setValores(v => ({ ...v, [clave]: e.target.value }))} className={inputCls} />
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Vista previa */}
              <div className="overflow-y-auto p-5 bg-[#FAF9F6]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-[#6B6B6B] font-semibold">Vista previa del entrenamiento</p>
                  <BadgeTokens texto={previa} />
                </div>
                <pre className="text-[11px] text-[#3A3A3A] whitespace-pre-wrap leading-relaxed font-mono">{previa}</pre>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-[#E8E8E8] flex items-center justify-end gap-2">
              <button onClick={() => setUsar(null)} className="px-4 py-2 rounded-lg border border-[#E8E8E8] text-sm hover:bg-[#F5F5F5]">Cancelar</button>
              <button onClick={aplicarAlBot} disabled={aplicando} className="px-5 py-2 rounded-lg text-sm font-bold bg-[#00A89D] text-white hover:bg-[#00847A] disabled:opacity-50">
                {aplicando ? 'Aplicando…' : 'Agregar al bot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal CREAR / EDITAR ── */}
      {editor && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setEditor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#E8E8E8] flex items-center justify-between">
              <h2 className="font-bold text-[#0D0D0D]">{editor.id ? 'Editar plantilla' : 'Crear plantilla'}</h2>
              <button onClick={() => setEditor(null)} className="text-[#9A9A9A] hover:text-[#0D0D0D] text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <label className="block text-xs text-[#6B6B6B] mb-1">Nombre</label>
                <input value={editor.nombre} onChange={e => setEditor({ ...editor, nombre: e.target.value })} placeholder="Ej: Zapatos — contra entrega" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-[#6B6B6B] mb-1">Descripción</label>
                <input value={editor.descripcion} onChange={e => setEditor({ ...editor, descripcion: e.target.value })} placeholder="Para qué sirve esta plantilla" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-[#6B6B6B] mb-1">Contenido del cerebro</label>
                <p className="text-[10px] text-[#9A9A9A] mb-1">Escribe el entrenamiento. Lo que sea específico del producto (nombre, tela, precios…) ponlo entre dobles llaves en MAYÚSCULAS, ej: <code className="bg-[#F0F0F0] px-1 rounded">{'{{PRODUCTO}}'}</code>, <code className="bg-[#F0F0F0] px-1 rounded">{'{{PRECIOS}}'}</code>. Eso se convierte en un campo para llenar.</p>
                <textarea value={editor.contenido} onChange={e => setEditor({ ...editor, contenido: e.target.value })} rows={14} className={inputCls + ' font-mono text-xs resize-y leading-relaxed'} />
                <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
                  <p className="text-[10px] text-[#9A9A9A]">Campos detectados: {detectarCampos(editor.contenido).join(', ') || '—'}</p>
                  <BadgeTokens texto={editor.contenido} />
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-[#E8E8E8] flex items-center justify-end gap-2">
              <button onClick={() => setEditor(null)} className="px-4 py-2 rounded-lg border border-[#E8E8E8] text-sm hover:bg-[#F5F5F5]">Cancelar</button>
              <button onClick={guardarEditor} disabled={guardando} className="px-5 py-2 rounded-lg text-sm font-bold bg-[#00A89D] text-white hover:bg-[#00847A] disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar plantilla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { PLANTILLA_DEFAULT } from '@/lib/quinchat/prompt-tenant';
import { COMPORTAMIENTO_DEFAULT } from '@/lib/quinchat/comportamiento';
import { estimarTokens, semaforoTokens } from '@/lib/plantillas-conocimiento';

const MAX_CHARS = 100_000;

interface SimMsg {
  role: 'user' | 'bot';
  content: string;
}

export default function EntrenamientoPanel() {
  // Dos capas del cerebro del bot:
  //  - 'principal'      → el negocio (precios, productos, pagos). key=system_prompt
  //  - 'comportamiento' → cómo se comporta y de dónde toma cada cosa. key=comportamiento
  const [tab, setTab]             = useState<'principal' | 'comportamiento'>('principal');
  const [valPrincipal, setValPrincipal] = useState('');
  const [valComport, setValComport]     = useState('');
  // La memoria de comportamiento queda BLOQUEADA hasta que el dueño confirme editar.
  const [editandoComport, setEditandoComport] = useState(false);
  const [confirmarEditar, setConfirmarEditar] = useState(false);
  const [savedP, setSavedP]       = useState(true);
  const [savedC, setSavedC]       = useState(true);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);

  // Valor y estado según la pestaña activa (para no duplicar el editor).
  const prompt = tab === 'principal' ? valPrincipal : valComport;
  // En la pestaña de comportamiento, el texto está bloqueado hasta confirmar.
  const bloqueado = tab === 'comportamiento' && !editandoComport;
  const saved  = tab === 'principal' ? savedP : savedC;
  const setPrompt = (v: string) => {
    if (tab === 'principal') { setValPrincipal(v); setSavedP(false); }
    else { setValComport(v); setSavedC(false); }
  };

  // Simulator
  const [simInput, setSimInput]   = useState('');
  const [simMsgs, setSimMsgs]     = useState<SimMsg[]>([]);
  const [simLoading, setSimLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Carga el prompt POR SERVIDOR (filtrado por empresa). Antes se leía por el
  // navegador con .single() y se rompía si había 2+ empresas con prompt.
  useEffect(() => {
    async function load() {
      try {
        const [rp, rc] = await Promise.all([
          fetch('/api/entrenamiento/guardar'),
          fetch('/api/entrenamiento/guardar?key=comportamiento'),
        ]);
        const dp = await rp.json();
        const dc = await rc.json();
        setValPrincipal(dp?.value || PLANTILLA_DEFAULT);
        setValComport(dc?.value || COMPORTAMIENTO_DEFAULT);
      } catch {
        setValPrincipal(PLANTILLA_DEFAULT);
        setValComport(COMPORTAMIENTO_DEFAULT);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simMsgs]);

  async function savePrompt() {
    if (saving) return;
    setSaving(true);
    const key = tab === 'principal' ? 'system_prompt' : 'comportamiento';
    let ok = false, errText = 'no se pudo guardar';
    try {
      const r = await fetch('/api/entrenamiento/guardar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: prompt, key }),
      });
      const d = await r.json();
      ok = r.ok && d.ok; errText = d.error ?? errText;
    } catch { errText = 'error de conexión'; }
    setSaving(false);
    if (ok) { if (tab === 'principal') setSavedP(true); else setSavedC(true); }
    else alert('Error al guardar: ' + errText);
  }

  function restaurarComportamiento() {
    setValComport(COMPORTAMIENTO_DEFAULT);
    setSavedC(false);
  }

  async function sendSimMessage() {
    if (!simInput.trim() || simLoading) return;
    const userMsg = simInput.trim();
    setSimInput('');
    const newMsgs: SimMsg[] = [...simMsgs, { role: 'user', content: userMsg }];
    setSimMsgs(newMsgs);
    setSimLoading(true);

    try {
      const res = await fetch('/api/quinchat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: simMsgs.map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content })),
          // El simulador prueba las dos capas juntas, como en el bot real.
          systemPrompt: `${valPrincipal}\n\n${valComport}`,
        }),
      });
      const data = await res.json();
      setSimMsgs([...newMsgs, { role: 'bot', content: data.reply ?? '(sin respuesta)' }]);
    } catch {
      setSimMsgs([...newMsgs, { role: 'bot', content: '⚠ Error al conectar con el bot.' }]);
    } finally {
      setSimLoading(false);
    }
  }

  return (
    <div className="flex-1 flex min-w-0 overflow-hidden bg-[#FAF9F6]">
      {/* ── Left: editor ── */}
      <div className="flex-1 flex flex-col border-r border-[#E8E8E8] min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8E8E8] bg-white shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[#0D0D0D] font-bold text-lg">Entrenamiento</h1>
              <p className="text-xs text-[#9A9A9A] mt-0.5">El cerebro del bot en dos capas · versión avanzada (texto a mano). Para armarlo por preguntas usa 🪄 Arma tu bot; para corregir suelto, 🎓 Entrenar con Quino.</p>
            </div>
            <button
              onClick={savePrompt}
              disabled={saved || saving || loading}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                saved
                  ? 'bg-[#00A89D]/10 text-[#00A89D]/50 border border-[#00A89D]/15 cursor-default'
                  : 'bg-[#00A89D] text-white hover:bg-[#00847A] active:scale-95 shadow-lg'
              }`}
            >
              {saving ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar'}
            </button>
          </div>

          {/* Dos pestañas: negocio (principal) vs comportamiento (genérico) */}
          <div className="flex gap-1 bg-[#EFEFEF] rounded-xl p-1">
            <button
              onClick={() => { setTab('principal'); setEditandoComport(false); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'principal' ? 'bg-white text-[#00847A] shadow-sm' : 'text-[#6B6B6B] hover:text-[#0D0D0D]'}`}
            >📝 Entrenamiento principal{!savedP && <span className="ml-1 text-[#DC2626]">•</span>}</button>
            <button
              onClick={() => { setTab('comportamiento'); setEditandoComport(false); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'comportamiento' ? 'bg-white text-[#00847A] shadow-sm' : 'text-[#6B6B6B] hover:text-[#0D0D0D]'}`}
            >⚙️ Memoria interna de comportamiento{!savedC && <span className="ml-1 text-[#DC2626]">•</span>}</button>
          </div>

          {/* Explicación de la pestaña activa */}
          {tab === 'principal' ? (
            <p className="text-[11px] text-[#6B6B6B] bg-[#FAF9F6] rounded-lg px-3 py-2">
              Aquí va <b>solo lo del negocio</b>: identidad, productos, precios, promociones, pagos, envíos y garantía. El bot toma estos datos de aquí.
            </p>
          ) : (
            <div className="flex items-start justify-between gap-2 bg-[#00A89D]/[0.06] border border-[#00A89D]/20 rounded-lg px-3 py-2">
              <p className="text-[11px] text-[#6B6B6B]">
                <b>Avanzado — normalmente no necesitas tocarlo.</b> Define <b>cómo se comporta</b> el bot y <b>de dónde toma cada cosa</b> (precios → del entrenamiento principal; catálogo/fotos → del panel de Catálogos; etiquetas → reglas). Viene listo de fábrica.
              </p>
              <button
                onClick={restaurarComportamiento}
                className="shrink-0 text-[11px] px-2.5 py-1.5 rounded-lg border border-[#00A89D]/40 text-[#00847A] font-semibold hover:bg-[#00A89D]/10 whitespace-nowrap"
                title="Volver al comportamiento recomendado de fábrica"
              >↺ Restaurar recomendado</button>
            </div>
          )}
        </div>

        {/* Textarea */}
        <div className="flex-1 p-6 flex flex-col gap-3 overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-[#9A9A9A] text-sm">
              Cargando prompt…
            </div>
          ) : (
            <div className="relative flex-1 flex">
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value.slice(0, MAX_CHARS))}
                readOnly={bloqueado}
                className={`flex-1 border rounded-xl p-4 text-sm placeholder:text-[#B5B5B5] focus:outline-none resize-none leading-relaxed font-mono transition-colors ${bloqueado ? 'bg-[#F5F5F5] text-[#6B6B6B] border-[#E8E8E8] cursor-default' : 'bg-white text-[#0D0D0D] border-[#E8E8E8] focus:border-[#00A89D]'}`}
                placeholder="Escribe aquí el prompt del agente…"
                spellCheck={false}
              />
              {bloqueado && (
                <button
                  onClick={() => setConfirmarEditar(true)}
                  className="absolute top-3 right-3 inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-white border border-[#E8E8E8] shadow-sm hover:bg-[#F5F5F5] text-[#0D0D0D]"
                >✏️ Editar</button>
              )}
            </div>
          )}
          <div className="flex items-center justify-between shrink-0">
            {(() => {
              const t = estimarTokens(prompt); const s = semaforoTokens(t);
              return (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: s.color, backgroundColor: s.color + '18' }}>
                  ~{t.toLocaleString('es-CO')} tokens · {s.texto}
                </span>
              );
            })()}
            <span className="text-[10px] text-[#9A9A9A]">{prompt.length.toLocaleString()}/{MAX_CHARS.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ── Right: simulator ── */}
      <div className="w-[340px] shrink-0 flex flex-col bg-white">
        <div className="px-4 py-4 border-b border-[#E8E8E8] shrink-0">
          <h2 className="text-[#0D0D0D] text-sm font-semibold">Simulador de chat</h2>
          <p className="text-[11px] text-[#9A9A9A] mt-0.5">Prueba el prompt antes de guardar</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {simMsgs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-24 text-[#9A9A9A] gap-2">
              <span className="text-2xl">🤖</span>
              <span className="text-xs">Escribe un mensaje para probar</span>
            </div>
          )}
          {simMsgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-snug ${
                  m.role === 'user'
                    ? 'bg-[#00A89D] text-white rounded-br-sm'
                    : 'bg-[#F5F5F5] text-[#0D0D0D] border border-[#E8E8E8] rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {simLoading && (
            <div className="flex justify-start">
              <div className="bg-[#F5F5F5] border border-[#E8E8E8] px-3 py-2 rounded-xl rounded-bl-sm">
                <span className="text-[#9A9A9A] text-xs">Escribiendo…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-[#E8E8E8] flex gap-2 shrink-0">
          <input
            value={simInput}
            onChange={e => setSimInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendSimMessage()}
            placeholder="Escribe mensaje aquí"
            className="flex-1 bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-xs text-[#0D0D0D] placeholder:text-[#B5B5B5] focus:outline-none focus:border-[#00A89D]"
          />
          <button
            onClick={sendSimMessage}
            disabled={!simInput.trim() || simLoading}
            className="w-9 h-9 bg-[#00A89D] text-white rounded-lg flex items-center justify-center text-sm font-bold disabled:opacity-30 hover:bg-[#00847A] transition-all"
          >
            ➤
          </button>
        </div>

        {/* Generar button */}
        <div className="p-3 border-t border-[#E8E8E8] shrink-0">
          <button
            onClick={() => setSimMsgs([])}
            className="w-full py-2 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs hover:text-[#0D0D0D] hover:border-[#D5D5D5] transition-all"
          >
            🔄 Limpiar simulador
          </button>
        </div>
      </div>

      {/* Alerta de confirmación antes de editar la memoria base */}
      {confirmarEditar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmarEditar(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="text-3xl mb-2">⚠️</div>
            <h3 className="text-base font-bold text-[#0D0D0D] mb-1.5">¿Estás seguro que deseas editar la memoria base del bot?</h3>
            <p className="text-sm text-[#6B6B6B] leading-snug">
              Esta es la <b>memoria base de comportamiento</b> (cómo vende y cierra el bot). Si solo deseas editar <b>precios y datos de tu negocio</b>, usa <b>Entrenamiento principal</b>.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmarEditar(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-sm text-[#6B6B6B] hover:bg-[#F5F5F5] font-medium"
              >Cancelar</button>
              <button
                onClick={() => { setEditandoComport(true); setConfirmarEditar(false); }}
                className="flex-1 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A]"
              >Aceptar y editar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

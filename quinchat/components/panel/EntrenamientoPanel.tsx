'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

const MAX_CHARS = 100_000;

interface SimMsg {
  role: 'user' | 'bot';
  content: string;
}

export default function EntrenamientoPanel() {
  const [prompt, setPrompt]       = useState('');
  const [saved, setSaved]         = useState(true);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);

  // Simulator
  const [simInput, setSimInput]   = useState('');
  const [simMsgs, setSimMsgs]     = useState<SimMsg[]>([]);
  const [simLoading, setSimLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase  = createBrowserSupabaseClient();

  // Load prompt from Supabase bot_config table
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'system_prompt')
        .single();
      if (data?.value) {
        setPrompt(data.value);
      } else {
        // fallback — fetch from API (returns default hardcoded)
        try {
          const res = await fetch('/api/quinchat?action=getPrompt');
          if (res.ok) {
            const json = await res.json();
            setPrompt(json.prompt ?? '');
          }
        } catch { /* ignore */ }
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
    const { error } = await supabase
      .from('bot_config')
      .upsert({ key: 'system_prompt', value: prompt }, { onConflict: 'key' });
    setSaving(false);
    if (!error) {
      setSaved(true);
    } else {
      alert('Error al guardar: ' + error.message);
    }
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
          systemPrompt: prompt,
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
    <div className="flex-1 flex min-w-0 overflow-hidden bg-[#0A0A0A]">
      {/* ── Left: editor ── */}
      <div className="flex-1 flex flex-col border-r border-[#1C1C1C] min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1C1C1C] bg-[#080808] shrink-0">
          <div>
            <h1 className="text-white font-bold text-lg">Entrenamiento</h1>
            <p className="text-xs text-gray-600 mt-0.5">Personaliza el comportamiento del bot</p>
          </div>
          <button
            onClick={savePrompt}
            disabled={saved || saving || loading}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              saved
                ? 'bg-[#C9A84C]/10 text-[#C9A84C]/50 border border-[#C9A84C]/15 cursor-default'
                : 'bg-[#C9A84C] text-black hover:bg-[#d4b05c] active:scale-95 shadow-lg'
            }`}
          >
            {saving ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar'}
          </button>
        </div>

        {/* Textarea */}
        <div className="flex-1 p-6 flex flex-col gap-3 overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
              Cargando prompt…
            </div>
          ) : (
            <textarea
              value={prompt}
              onChange={e => { setPrompt(e.target.value.slice(0, MAX_CHARS)); setSaved(false); }}
              className="flex-1 bg-[#111] border border-[#252525] rounded-xl p-4 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/30 resize-none leading-relaxed font-mono transition-colors"
              placeholder="Escribe aquí el prompt del agente…"
              spellCheck={false}
            />
          )}
          <div className="text-[10px] text-gray-700 text-right shrink-0">
            {prompt.length.toLocaleString()}/{MAX_CHARS.toLocaleString()}
          </div>
        </div>
      </div>

      {/* ── Right: simulator ── */}
      <div className="w-[340px] shrink-0 flex flex-col bg-[#080808]">
        <div className="px-4 py-4 border-b border-[#1C1C1C] shrink-0">
          <h2 className="text-white text-sm font-semibold">Simulador de chat</h2>
          <p className="text-[11px] text-gray-600 mt-0.5">Prueba el prompt antes de guardar</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {simMsgs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-24 text-gray-700 gap-2">
              <span className="text-2xl">🤖</span>
              <span className="text-xs">Escribe un mensaje para probar</span>
            </div>
          )}
          {simMsgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-snug ${
                  m.role === 'user'
                    ? 'bg-[#C9A84C] text-black rounded-br-sm'
                    : 'bg-[#1A1A1A] text-white border border-[#252525] rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {simLoading && (
            <div className="flex justify-start">
              <div className="bg-[#1A1A1A] border border-[#252525] px-3 py-2 rounded-xl rounded-bl-sm">
                <span className="text-gray-500 text-xs">Escribiendo…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-[#1C1C1C] flex gap-2 shrink-0">
          <input
            value={simInput}
            onChange={e => setSimInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendSimMessage()}
            placeholder="Escribe mensaje aquí"
            className="flex-1 bg-[#141414] border border-[#252525] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40"
          />
          <button
            onClick={sendSimMessage}
            disabled={!simInput.trim() || simLoading}
            className="w-9 h-9 bg-[#C9A84C] text-black rounded-lg flex items-center justify-center text-sm font-bold disabled:opacity-30 hover:bg-[#d4b05c] transition-all"
          >
            ➤
          </button>
        </div>

        {/* Generar button */}
        <div className="p-3 border-t border-[#1C1C1C] shrink-0">
          <button
            onClick={() => setSimMsgs([])}
            className="w-full py-2 rounded-lg border border-[#252525] text-gray-500 text-xs hover:text-gray-300 hover:border-[#333] transition-all"
          >
            🔄 Limpiar simulador
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';

/* ─── Types ─────────────────────────────────────────────────────────────── */
type TopTab = 'general' | 'ia' | 'chat';
type GeneralSubTab = 'general' | 'texto' | 'audio';
type ChatSubTab = 'whatsapp';

interface Ajustes {
  nombre: string;
  estado: 'activo' | 'dormido';
  tiempo_respuesta: number;
  respuesta_texto_pct: number; // 0-100 (100 = todo texto)
  phone_number_id: string;
  waba_id: string;
  meta_app_id: string;
  access_token: string;
  webhook_verify_token: string;
}

const WEBHOOK_URL = 'https://quinchat-agencia-quin.vercel.app/api/whatsapp/webhook';

const DEFAULT: Ajustes = {
  nombre: 'KLIXMANT',
  estado: 'activo',
  tiempo_respuesta: 15,
  respuesta_texto_pct: 80,
  phone_number_id: '',
  waba_id: '',
  meta_app_id: '',
  access_token: '',
  webhook_verify_token: '',
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={copy}
      title="Copiar"
      className="shrink-0 px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-xs text-gray-400 hover:text-[#C9A84C] hover:border-[#C9A84C]/40 transition-all"
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}

function FieldRow({
  label, description, children,
}: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-6 py-5 border-b border-[#1C1C1C]">
      <div className="w-56 shrink-0">
        <p className="text-sm font-semibold text-white">{label}</p>
      </div>
      <div className="flex-1">{children}</div>
      <div className="w-72 shrink-0">
        <p className="text-xs text-orange-400/80 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function AjustesPanel() {
  const [ajustes, setAjustes] = useState<Ajustes>(DEFAULT);
  const [topTab, setTopTab] = useState<TopTab>('general');
  const [genSub, setGenSub] = useState<GeneralSubTab>('general');
  const [chatSub] = useState<ChatSubTab>('whatsapp');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);

  /* load */
  useEffect(() => {
    fetch('/api/ajustes')
      .then(r => r.json())
      .then(d => { if (d && !d.error) setAjustes({ ...DEFAULT, ...d }); })
      .finally(() => setLoading(false));
  }, []);

  /* save */
  async function save() {
    setSaving(true);
    const res = await fetch('/api/ajustes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ajustes),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      alert('Error al guardar: ' + (err.error ?? res.statusText));
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function set<K extends keyof Ajustes>(k: K, v: Ajustes[K]) {
    setAjustes(prev => ({ ...prev, [k]: v }));
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-600 text-sm">Cargando ajustes…</p>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0C0C0C]">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-[#1C1C1C]">
        <h1 className="text-xl font-bold text-white tracking-tight">Ajustes</h1>
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2 bg-[#C9A84C] hover:bg-[#D4B86A] disabled:opacity-60 text-black font-bold text-sm rounded-lg transition-all"
        >
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>

      {/* Top Tabs */}
      <div className="flex border-b border-[#1C1C1C] px-8">
        {(['general', 'ia', 'chat'] as TopTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTopTab(t)}
            className={`px-8 py-3 text-sm font-medium capitalize border-b-2 transition-all -mb-[1px] ${
              topTab === t
                ? 'border-[#C9A84C] text-[#C9A84C]'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'ia' ? 'IA' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── GENERAL TAB ── */}
        {topTab === 'general' && (
          <>
            {/* Left sub-nav */}
            <div className="w-44 shrink-0 border-r border-[#1C1C1C] pt-4 px-2 flex flex-col gap-1">
              {(['general', 'texto', 'audio'] as GeneralSubTab[]).map(s => (
                <button
                  key={s}
                  onClick={() => setGenSub(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    genSub === s
                      ? 'bg-[#C9A84C] text-black'
                      : 'text-gray-400 hover:bg-[#1A1A1A] hover:text-white'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {/* Right content */}
            <div className="flex-1 overflow-y-auto px-8">
              {genSub === 'general' && (
                <>
                  <FieldRow
                    label="Estado"
                    description="Si está activo el asistente responderá automáticamente. En dormido, no responderá mensajes nuevos."
                  >
                    <select
                      value={ajustes.estado}
                      onChange={e => set('estado', e.target.value as 'activo' | 'dormido')}
                      className="w-72 bg-[#111] border border-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C9A84C]/50"
                    >
                      <option value="activo">Activo</option>
                      <option value="dormido">Dormido</option>
                    </select>
                  </FieldRow>

                  <FieldRow
                    label="Tiempo de respuesta"
                    description="Intervalo en segundos que el asistente espera antes de responder cuando llegan mensajes nuevos."
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => set('tiempo_respuesta', Math.max(1, ajustes.tiempo_respuesta - 1))}
                        className="w-9 h-9 bg-[#C9A84C] text-black font-bold rounded-lg text-lg hover:bg-[#D4B86A] transition-all"
                      >
                        −
                      </button>
                      <span className="text-white font-semibold w-24 text-center">
                        {ajustes.tiempo_respuesta} segundos
                      </span>
                      <button
                        onClick={() => set('tiempo_respuesta', Math.min(300, ajustes.tiempo_respuesta + 1))}
                        className="w-9 h-9 bg-[#C9A84C] text-black font-bold rounded-lg text-lg hover:bg-[#D4B86A] transition-all"
                      >
                        +
                      </button>
                    </div>
                  </FieldRow>

                  <FieldRow
                    label="Respuesta del asistente"
                    description="Porcentaje de respuestas en texto vs audio. El resto será en audio de voz."
                  >
                    <div className="flex flex-col gap-2 w-72">
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Texto</span>
                        <span>Audio</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={ajustes.respuesta_texto_pct}
                        onChange={e => set('respuesta_texto_pct', Number(e.target.value))}
                        className="w-full accent-[#C9A84C]"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{ajustes.respuesta_texto_pct}%</span>
                        <span>{100 - ajustes.respuesta_texto_pct}%</span>
                      </div>
                    </div>
                  </FieldRow>

                  <FieldRow
                    label="Nombre del asistente"
                    description="Nombre que identifica al asistente dentro del panel."
                  >
                    <input
                      type="text"
                      value={ajustes.nombre}
                      onChange={e => set('nombre', e.target.value)}
                      className="w-72 bg-[#111] border border-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C9A84C]/50"
                    />
                  </FieldRow>
                </>
              )}

              {genSub === 'texto' && (
                <div className="py-10 text-center text-gray-600 text-sm">
                  Opciones de texto próximamente
                </div>
              )}

              {genSub === 'audio' && (
                <div className="py-10 text-center text-gray-600 text-sm">
                  Opciones de audio próximamente
                </div>
              )}
            </div>
          </>
        )}

        {/* ── IA TAB ── */}
        {topTab === 'ia' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl mb-3">🤖</p>
              <p className="text-gray-500 text-sm">Configuración de IA próximamente</p>
              <p className="text-gray-700 text-xs mt-1">Modelo, temperatura, límites de tokens…</p>
            </div>
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {topTab === 'chat' && (
          <>
            {/* Left sub-nav */}
            <div className="w-44 shrink-0 border-r border-[#1C1C1C] pt-4 px-2 flex flex-col gap-1">
              <button
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-[#C9A84C] text-black"
              >
                WhatsApp
              </button>
            </div>

            {/* Right content */}
            <div className="flex-1 overflow-y-auto px-8">

              {chatSub === 'whatsapp' && (
                <>
                  <FieldRow
                    label="Id. Número de teléfono"
                    description="Valor único asignado por WhatsApp Business API Cloud para identificar tu número de teléfono al enviar y recibir mensajes."
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ajustes.phone_number_id}
                        onChange={e => set('phone_number_id', e.target.value)}
                        placeholder="Ej: 123456789012345"
                        className="flex-1 max-w-xs bg-[#111] border border-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C9A84C]/50 font-mono"
                      />
                      <CopyBtn value={ajustes.phone_number_id} />
                    </div>
                  </FieldRow>

                  <FieldRow
                    label="Id. cuenta de WhatsApp Business (Opcional)"
                    description="Permite gestionar plantillas de WhatsApp desde el panel y operar tu cuenta Business de forma eficiente."
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ajustes.waba_id}
                        onChange={e => set('waba_id', e.target.value)}
                        placeholder="Ej: 952346933913193"
                        className="flex-1 max-w-xs bg-[#111] border border-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C9A84C]/50 font-mono"
                      />
                      <CopyBtn value={ajustes.waba_id} />
                    </div>
                  </FieldRow>

                  <FieldRow
                    label="Id. de la aplicación de Meta (Opcional)"
                    description="Identificador de la app Meta donde está alojado el número. Permite crear y editar plantillas de imagen, video y documento."
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ajustes.meta_app_id}
                        onChange={e => set('meta_app_id', e.target.value)}
                        placeholder="Ej: 1392339379328297"
                        className="flex-1 max-w-xs bg-[#111] border border-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C9A84C]/50 font-mono"
                      />
                      <CopyBtn value={ajustes.meta_app_id} />
                    </div>
                  </FieldRow>

                  <FieldRow
                    label="Token permanente"
                    description="Token de acceso permanente de Meta para autenticar las llamadas a la API de WhatsApp. Debe ser el token permanente, no el temporal."
                  >
                    <div className="flex gap-2">
                      <div className="relative flex-1 max-w-xs">
                        <input
                          type={showToken ? 'text' : 'password'}
                          value={ajustes.access_token}
                          onChange={e => set('access_token', e.target.value)}
                          placeholder="EAAxxxxxxxxxxxxxxx"
                          className="w-full bg-[#111] border border-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2 pr-10 focus:outline-none focus:border-[#C9A84C]/50 font-mono"
                        />
                        <button
                          onClick={() => setShowToken(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-sm"
                        >
                          {showToken ? '🙈' : '👁'}
                        </button>
                      </div>
                      <CopyBtn value={ajustes.access_token} />
                    </div>
                  </FieldRow>

                  {/* Webhook config */}
                  <div className="py-5">
                    <p className="text-sm font-semibold text-white mb-4">Configuración de Webhook</p>
                    <p className="text-xs text-gray-500 mb-5 leading-relaxed max-w-2xl">
                      Copia la URL y el Token de verificación y pégalos en{' '}
                      <span className="text-[#C9A84C]">Facebook Developer → WhatsApp → Configuración → Webhook</span>.
                      Esta URL es donde Meta enviará los mensajes entrantes y salientes en tiempo real.
                    </p>

                    <div className="flex flex-col gap-3">
                      {/* URL */}
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 bg-[#111] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-gray-400 font-mono truncate">
                          {WEBHOOK_URL}
                        </div>
                        <CopyBtn value={WEBHOOK_URL} />
                        <span className="text-xs text-gray-600 shrink-0">URL del webhook</span>
                      </div>

                      {/* Verify token */}
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={ajustes.webhook_verify_token}
                          onChange={e => set('webhook_verify_token', e.target.value)}
                          placeholder="Token de verificación (ej: mi_token_secreto)"
                          className="flex-1 bg-[#111] border border-[#2A2A2A] text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C9A84C]/50 font-mono"
                        />
                        <CopyBtn value={ajustes.webhook_verify_token} />
                        <span className="text-xs text-gray-600 shrink-0">Token de verificación</span>
                      </div>
                    </div>

                    {/* Status indicator */}
                    <div className={`mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                      ajustes.phone_number_id && ajustes.access_token
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        ajustes.phone_number_id && ajustes.access_token ? 'bg-green-400' : 'bg-yellow-400'
                      }`} />
                      {ajustes.phone_number_id && ajustes.access_token
                        ? 'WhatsApp configurado'
                        : 'Pendiente configurar WhatsApp'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

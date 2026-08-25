'use client';

import { useState, useEffect } from 'react';

/* ─── Types ─────────────────────────────────────────────────────────────── */
type TopTab = 'general' | 'ia' | 'chat';
type IASubTab = 'general' | 'texto' | 'audio';

interface Ajustes {
  nombre: string;
  telefono_prefijo: string;
  telefono_numero: string;
  mensaje_bienvenida: string;
  referencia: string;
  estado: 'activo' | 'dormido';
  tiempo_respuesta: number;
  respuesta_texto_pct: number;
  phone_number_id: string;
  waba_id: string;
  meta_app_id: string;
  access_token: string;
  webhook_verify_token: string;
}

const WEBHOOK_URL = 'https://quinchat-agencia-quin.vercel.app/api/whatsapp/webhook';

const DEFAULT: Ajustes = {
  nombre: 'KLIXMANT',
  telefono_prefijo: '+57',
  telefono_numero: '',
  mensaje_bienvenida: '',
  referencia: '',
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
      className="shrink-0 px-3 py-2 bg-[#F5F5F5] border border-[#E8E8E8] rounded-lg text-xs text-[#6B6B6B] hover:text-[#00A89D] hover:border-[#00A89D]/40 transition-all"
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}

function FieldRow({
  label, description, children,
}: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-6 py-5 border-b border-[#E8E8E8]">
      <div className="w-52 shrink-0">
        <p className="text-sm font-semibold text-[#0D0D0D]">{label}</p>
      </div>
      <div className="flex-1">{children}</div>
      <div className="w-72 shrink-0">
        <p className="text-xs text-[#6B6B6B] leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function AjustesPanel() {
  const [ajustes, setAjustes] = useState<Ajustes>(DEFAULT);
  const [topTab, setTopTab] = useState<TopTab>('general');
  const [iaSub, setIaSub] = useState<IASubTab>('general');
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
        <p className="text-[#9A9A9A] text-sm">Cargando ajustes…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#FAF9F6]">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-[#E8E8E8]">
        <h1 className="text-xl font-bold text-[#0D0D0D] tracking-tight">Ajustes</h1>
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2 bg-[#00A89D] hover:bg-[#00847A] disabled:opacity-60 text-white font-bold text-sm rounded-lg transition-all"
        >
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>

      {/* Top Tabs */}
      <div className="flex border-b border-[#E8E8E8] px-8">
        {(['general', 'ia', 'chat'] as TopTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTopTab(t)}
            className={`px-8 py-3 text-sm font-medium border-b-2 transition-all -mb-[1px] ${
              topTab === t
                ? 'border-[#00A89D] text-[#00A89D]'
                : 'border-transparent text-[#9A9A9A] hover:text-[#6B6B6B]'
            }`}
          >
            {t === 'ia' ? 'IA' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ══════════════════ GENERAL TAB ══════════════════ */}
        {topTab === 'general' && (
          <div className="flex-1 overflow-y-auto px-8">

            <FieldRow
              label="Nombre"
              description="Este parámetro permite personalizar el nombre al asistente y brindarle una identificación única."
            >
              <input
                type="text"
                value={ajustes.nombre}
                onChange={e => set('nombre', e.target.value)}
                className="w-full max-w-md bg-white border border-[#E8E8E8] text-[#0D0D0D] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00A89D]"
              />
            </FieldRow>

            <FieldRow
              label="Teléfono"
              description="Permite ingresar información de contacto o identificación telefónica al asistente."
            >
              <div className="flex gap-2 max-w-md">
                <select
                  value={ajustes.telefono_prefijo}
                  onChange={e => set('telefono_prefijo', e.target.value)}
                  className="w-28 bg-white border border-[#E8E8E8] text-[#0D0D0D] text-sm rounded-lg px-2 py-2 focus:outline-none focus:border-[#00A89D]"
                >
                  <option value="+57">CO +57</option>
                  <option value="+1">US +1</option>
                  <option value="+52">MX +52</option>
                  <option value="+34">ES +34</option>
                  <option value="+54">AR +54</option>
                  <option value="+51">PE +51</option>
                  <option value="+56">CL +56</option>
                </select>
                <input
                  type="text"
                  value={ajustes.telefono_numero}
                  onChange={e => set('telefono_numero', e.target.value)}
                  placeholder="3004362800"
                  className="flex-1 bg-white border border-[#E8E8E8] text-[#0D0D0D] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00A89D]"
                />
              </div>
            </FieldRow>

            <FieldRow
              label="Mensaje de bienvenida"
              description="Permite personalizar el mensaje inicial que se muestra a los usuarios al iniciar una conversación con el asistente."
            >
              <input
                type="text"
                value={ajustes.mensaje_bienvenida}
                onChange={e => set('mensaje_bienvenida', e.target.value)}
                placeholder="Nombre de la plantilla de bienvenida"
                className="w-full max-w-md bg-white border border-[#E8E8E8] text-[#0D0D0D] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00A89D]"
              />
            </FieldRow>

            <FieldRow
              label="Usar referencia (Opcional)"
              description="Aquí puedes usar el Id de otro asistente creado para que todas sus configuraciones (Plantillas, Disparadores, Entrenamiento, etc.) se puedan replicar en este asistente."
            >
              <div className="flex gap-2 max-w-md">
                <input
                  type="text"
                  value={ajustes.referencia}
                  onChange={e => set('referencia', e.target.value)}
                  placeholder=""
                  className="flex-1 bg-white border border-[#E8E8E8] text-[#0D0D0D] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00A89D]"
                />
                <CopyBtn value={ajustes.referencia} />
              </div>
            </FieldRow>

          </div>
        )}

        {/* ══════════════════ IA TAB ══════════════════ */}
        {topTab === 'ia' && (
          <>
            {/* Left sub-nav */}
            <div className="w-44 shrink-0 border-r border-[#E8E8E8] pt-4 px-2 flex flex-col gap-1">
              {(['general', 'texto', 'audio'] as IASubTab[]).map(s => (
                <button
                  key={s}
                  onClick={() => setIaSub(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    iaSub === s
                      ? 'bg-[#00A89D] text-white'
                      : 'text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#0D0D0D]'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {/* Right content */}
            <div className="flex-1 overflow-y-auto px-8">
              {iaSub === 'general' && (
                <>
                  <FieldRow
                    label="Estado"
                    description="Establece el estado del asistente. Si está activo responderá todos los mensajes automáticamente, en cambio si está dormido no responderá ningún mensaje nuevo que llegue."
                  >
                    <select
                      value={ajustes.estado}
                      onChange={e => set('estado', e.target.value as 'activo' | 'dormido')}
                      className="w-72 bg-white border border-[#E8E8E8] text-[#0D0D0D] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00A89D]"
                    >
                      <option value="activo">Activo</option>
                      <option value="dormido">Dormido</option>
                    </select>
                  </FieldRow>

                  <FieldRow
                    label="Tiempo de respuesta"
                    description="Establece el intervalo de tiempo en el que el asistente debe responder las conversaciones cuando llegan mensajes nuevos."
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => set('tiempo_respuesta', Math.max(1, ajustes.tiempo_respuesta - 1))}
                        className="w-9 h-9 bg-[#00A89D] text-white font-bold rounded-lg text-lg hover:bg-[#00847A] transition-all"
                      >
                        −
                      </button>
                      <span className="text-[#0D0D0D] font-semibold w-24 text-center">
                        {ajustes.tiempo_respuesta} segundos
                      </span>
                      <button
                        onClick={() => set('tiempo_respuesta', Math.min(300, ajustes.tiempo_respuesta + 1))}
                        className="w-9 h-9 bg-[#00A89D] text-white font-bold rounded-lg text-lg hover:bg-[#00847A] transition-all"
                      >
                        +
                      </button>
                    </div>
                  </FieldRow>

                  <FieldRow
                    label="Respuesta del asistente"
                    description="Establece la probabilidad de que las respuestas del asistente sean en texto o en audio. El valor del deslizante indica el porcentaje de respuestas en texto, mientras que el resto serán en audio."
                  >
                    <div className="flex flex-col gap-2 w-72">
                      <div className="flex justify-between text-xs text-[#6B6B6B]">
                        <span>Texto</span>
                        <span>Audio</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={ajustes.respuesta_texto_pct}
                        onChange={e => set('respuesta_texto_pct', Number(e.target.value))}
                        className="w-full accent-[#00A89D]"
                      />
                      <div className="flex justify-between text-xs text-[#9A9A9A]">
                        <span>{ajustes.respuesta_texto_pct}%</span>
                        <span>{100 - ajustes.respuesta_texto_pct}%</span>
                      </div>
                    </div>
                  </FieldRow>
                </>
              )}

              {iaSub === 'texto' && (
                <div className="py-10 text-center text-[#9A9A9A] text-sm">
                  Opciones de texto próximamente
                </div>
              )}

              {iaSub === 'audio' && (
                <div className="py-10 text-center text-[#9A9A9A] text-sm">
                  Opciones de audio próximamente
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════ CHAT TAB ══════════════════ */}
        {topTab === 'chat' && (
          <>
            {/* Left sub-nav */}
            <div className="w-44 shrink-0 border-r border-[#E8E8E8] pt-4 px-2 flex flex-col gap-1">
              <button className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-[#00A89D] text-white">
                WhatsApp
              </button>
            </div>

            {/* Right content */}
            <div className="flex-1 overflow-y-auto px-8">

              <FieldRow
                label="Id. Número de teléfono"
                description="Valor único asignado por WhatsApp Business API Cloud para identificar tu número de teléfono al enviar y recibir mensajes."
              >
                <div className="flex gap-2 max-w-md">
                  <input
                    type="text"
                    value={ajustes.phone_number_id}
                    onChange={e => set('phone_number_id', e.target.value)}
                    placeholder="Ej: 1046498425221624"
                    className="flex-1 bg-white border border-[#E8E8E8] text-[#0D0D0D] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00A89D] font-mono"
                  />
                  <CopyBtn value={ajustes.phone_number_id} />
                </div>
              </FieldRow>

              <FieldRow
                label="Id. cuenta de WhatsApp Business (Opcional)"
                description="Identificador de la cuenta de WhatsApp Business. Permite que las plantillas de WhatsApp se puedan ver, crear, editar y eliminar desde el panel."
              >
                <div className="flex gap-2 max-w-md">
                  <input
                    type="text"
                    value={ajustes.waba_id}
                    onChange={e => set('waba_id', e.target.value)}
                    placeholder="Ej: 952346933913193"
                    className="flex-1 bg-white border border-[#E8E8E8] text-[#0D0D0D] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00A89D] font-mono"
                  />
                  <CopyBtn value={ajustes.waba_id} />
                </div>
              </FieldRow>

              <FieldRow
                label="Id. de la aplicación de Meta (Opcional)"
                description="Identificador de la aplicación de Meta donde se encuentra alojado el número. Permite crear, editar y eliminar plantillas de imagen, video y documento."
              >
                <div className="flex gap-2 max-w-md">
                  <input
                    type="text"
                    value={ajustes.meta_app_id}
                    onChange={e => set('meta_app_id', e.target.value)}
                    placeholder="Ej: 1392339379328297"
                    className="flex-1 bg-white border border-[#E8E8E8] text-[#0D0D0D] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00A89D] font-mono"
                  />
                  <CopyBtn value={ajustes.meta_app_id} />
                </div>
              </FieldRow>

              <FieldRow
                label="Token permanente"
                description="Cadena de caracteres utilizado para autenticar el acceso a la API de Meta. Debe ser el permanente ya que Meta utiliza otros tokens que tienen caducidad."
              >
                <div className="flex gap-2 max-w-md">
                  <div className="relative flex-1">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={ajustes.access_token}
                      onChange={e => set('access_token', e.target.value)}
                      placeholder="EAATyU0YclSkBRO2j9Q8aTdl…"
                      className="w-full bg-white border border-[#E8E8E8] text-[#0D0D0D] text-sm rounded-lg px-3 py-2 pr-10 focus:outline-none focus:border-[#00A89D] font-mono"
                    />
                    <button
                      onClick={() => setShowToken(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] hover:text-[#0D0D0D] text-sm"
                    >
                      {showToken ? '🙈' : '👁'}
                    </button>
                  </div>
                  <CopyBtn value={ajustes.access_token} />
                </div>
              </FieldRow>

              {/* Webhook */}
              <div className="py-5">
                <p className="text-sm font-semibold text-[#0D0D0D] mb-2">Configuración de Webhook</p>
                <p className="text-xs text-[#9A9A9A] mb-5 leading-relaxed max-w-2xl">
                  Los parámetros Url Webhook y Token son esenciales para establecer una conexión bidireccional entre QuinChat y WhatsApp a través de la API. Copia estos valores y pégalos en{' '}
                  <span className="text-[#00A89D]">Facebook Developer → WhatsApp → Configuración → Webhook</span>.
                </p>

                <div className="flex flex-col gap-3 max-w-2xl">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 bg-[#F5F5F5] border border-[#E8E8E8] rounded-lg px-3 py-2 text-xs text-[#6B6B6B] font-mono truncate">
                      {WEBHOOK_URL}
                    </div>
                    <CopyBtn value={WEBHOOK_URL} />
                    <span className="text-xs text-[#9A9A9A] shrink-0 w-28">URL del webhook</span>
                  </div>

                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={ajustes.webhook_verify_token}
                      onChange={e => set('webhook_verify_token', e.target.value)}
                      placeholder="Token de verificación"
                      className="flex-1 bg-white border border-[#E8E8E8] text-[#0D0D0D] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#00A89D] font-mono"
                    />
                    <CopyBtn value={ajustes.webhook_verify_token} />
                    <span className="text-xs text-[#9A9A9A] shrink-0 w-28">Token verificación</span>
                  </div>
                </div>

                <div className={`mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                  ajustes.phone_number_id && ajustes.access_token
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    ajustes.phone_number_id && ajustes.access_token ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                  {ajustes.phone_number_id && ajustes.access_token
                    ? 'WhatsApp configurado'
                    : 'Pendiente configurar WhatsApp'}
                </div>
              </div>

            </div>
          </>
        )}

      </div>
    </div>
  );
}

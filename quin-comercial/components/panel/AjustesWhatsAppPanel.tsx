'use client';

import { useState, useEffect } from 'react';

interface WaConfig {
  nombre: string;
  slug: string;
  activo: boolean;
  wa_phone_number_id: string;
  wa_phone_number_id_ventas: string;
  wa_verify_token: string;
  wa_waba_id: string;
  wa_app_id: string;
  wa_access_token_set: boolean;
  wa_access_token_masked: string;
  webhook_url: string;
}

const CAMPOS: { key: keyof WaConfig; label: string; help: string }[] = [
  { key: 'wa_phone_number_id',        label: 'Phone Number ID (línea principal)', help: 'El ID del número de WhatsApp desde el que responde el bot.' },
  { key: 'wa_phone_number_id_ventas', label: 'Phone Number ID (ventas, opcional)', help: 'Si usas un segundo número para ventas. Déjalo vacío si no aplica.' },
  { key: 'wa_verify_token',           label: 'Verify Token', help: 'El texto que pones también en Meta al configurar el webhook (tú lo inventas).' },
  { key: 'wa_waba_id',                label: 'WABA ID (opcional)', help: 'ID de la cuenta de WhatsApp Business.' },
  { key: 'wa_app_id',                 label: 'App ID (opcional)', help: 'ID de la app de Meta.' },
];

const inputCls = 'w-full bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm text-[#0D0D0D] focus:outline-none focus:border-[#00A89D]';

/** Fila del formulario: título a la izquierda, campo al centro, descripción a la derecha. */
function Fila({ titulo, help, children }: { titulo: any; help?: any; children: any }) {
  return (
    <div className="grid md:grid-cols-[190px_minmax(0,1fr)_230px] gap-2 md:gap-6 py-4 border-b border-[#F0F0F0] last:border-b-0 items-start">
      <div className="text-sm font-bold text-[#0D0D0D] md:pt-2">{titulo}</div>
      <div className="min-w-0">{children}</div>
      {help ? <p className="text-[12px] text-[#9A9A9A] leading-snug md:pt-2">{help}</p> : <span className="hidden md:block" />}
    </div>
  );
}

export default function AjustesWhatsAppPanel() {
  const [cfg, setCfg]       = useState<WaConfig | null>(null);
  const [loading, setLoad]  = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [tokenNuevo, setTokenNuevo] = useState('');
  const [pin, setPin] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [regMsg, setRegMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/tenant/whatsapp')
      .then(r => r.json())
      .then(d => { if (!d.error) setCfg(d); })
      .finally(() => setLoad(false));
  }, []);

  function set<K extends keyof WaConfig>(key: K, val: WaConfig[K]) {
    setCfg(c => (c ? { ...c, [key]: val } : c));
    setMsg(null);
  }

  async function guardar() {
    if (!cfg || saving) return;
    setSaving(true);
    setMsg(null);
    const payload: Record<string, string> = {
      nombre: cfg.nombre,
      wa_phone_number_id: cfg.wa_phone_number_id,
      wa_phone_number_id_ventas: cfg.wa_phone_number_id_ventas,
      wa_verify_token: cfg.wa_verify_token,
      wa_waba_id: cfg.wa_waba_id,
      wa_app_id: cfg.wa_app_id,
    };
    if (tokenNuevo.trim()) payload.wa_access_token = tokenNuevo.trim();

    try {
      const r = await fetch('/api/tenant/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok) {
        setMsg({ ok: true, text: 'Guardado ✓' });
        setTokenNuevo('');
        if (payload.wa_access_token) {
          setCfg(c => (c ? { ...c, wa_access_token_set: true, wa_access_token_masked: '••••••••' + payload.wa_access_token.slice(-4) } : c));
        }
      } else {
        setMsg({ ok: false, text: d.error ?? 'Error al guardar' });
      }
    } catch {
      setMsg({ ok: false, text: 'Error de conexión' });
    } finally {
      setSaving(false);
    }
  }

  async function registrarNumero() {
    if (registrando) return;
    if (!/^\d{6}$/.test(pin)) { setRegMsg({ ok: false, text: 'El PIN debe ser de 6 dígitos.' }); return; }
    setRegistrando(true); setRegMsg(null);
    try {
      const r = await fetch('/api/tenant/whatsapp/registrar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const d = await r.json();
      if (d.ok) setRegMsg({ ok: true, text: d.yaEstaba ? 'El número ya estaba registrado ✓' : '¡Número registrado! Ya puede recibir y enviar mensajes ✓' });
      else setRegMsg({ ok: false, text: d.error ?? 'No se pudo registrar.' });
    } catch { setRegMsg({ ok: false, text: 'Error de conexión.' }); }
    finally { setRegistrando(false); }
  }

  const webhookFull = cfg?.webhook_url
    ? (typeof window !== 'undefined' ? window.location.origin : '') + cfg.webhook_url
    : '';

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-[#0D0D0D] font-bold text-lg">Conexión de WhatsApp</h1>
        <p className="text-xs text-[#9A9A9A] mt-0.5 mb-5">
          Conecta el WhatsApp Business de tu empresa. Estos datos salen de tu cuenta de Meta (WhatsApp Cloud API).
        </p>

        {loading ? (
          <div className="text-[#9A9A9A] text-sm">Cargando…</div>
        ) : !cfg ? (
          <div className="text-red-600 text-sm">No se pudo cargar la configuración.</div>
        ) : (
          <>
            {/* Bloque de datos con filas: título · campo · descripción */}
            <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#EFEFEF] bg-[#FAFAF8]">
                <h2 className="text-sm font-bold text-[#0D0D0D]">📱 Datos de la conexión</h2>
                <p className="text-[11px] text-[#9A9A9A] mt-0.5">A la derecha de cada campo tienes su explicación.</p>
              </div>

              <div className="px-5">
                <Fila titulo="Nombre de la empresa" help="El nombre de tu empresa; identifica esta conexión.">
                  <input value={cfg.nombre} onChange={e => set('nombre', e.target.value)} className={inputCls} />
                </Fila>

                <Fila titulo="URL del Webhook" help="Pégala en Meta al configurar el webhook, junto con el Verify Token de abajo.">
                  <div className="flex gap-2">
                    <input readOnly value={webhookFull} className={inputCls + ' bg-[#F5F5F5] text-[#6B6B6B] font-mono'} />
                    <button
                      onClick={async () => {
                        if (!webhookFull) return;
                        try {
                          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(webhookFull);
                          else { const t = document.createElement('textarea'); t.value = webhookFull; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); }
                          setCopiado(true);
                          setMsg({ ok: true, text: 'URL copiada ✓' });
                          setTimeout(() => setCopiado(false), 2000);
                        } catch { setMsg({ ok: false, text: 'No se pudo copiar; selecciónala y copia manual.' }); }
                      }}
                      className={`px-3 rounded-lg text-xs shrink-0 border transition-colors ${copiado ? 'bg-[#00A89D] border-[#00A89D] text-white' : 'bg-white border-[#E8E8E8] text-[#3A3A3A] hover:border-[#00A89D]/40'}`}
                    >{copiado ? '¡Copiado! ✓' : 'Copiar'}</button>
                  </div>
                </Fila>

                {CAMPOS.map(({ key, label, help }) => (
                  <Fila key={key as string} titulo={label} help={help}>
                    <input value={String(cfg[key] ?? '')} onChange={e => set(key, e.target.value as any)} autoComplete="off" className={inputCls} />
                  </Fila>
                ))}

                <Fila titulo="Access Token (permanente)" help="Por seguridad no se muestra completo. Solo se guarda; no se vuelve a mostrar.">
                  {cfg.wa_access_token_set && (
                    <p className="text-[11px] text-emerald-700 mb-1">Ya hay un token guardado ({cfg.wa_access_token_masked}). Déjalo vacío para no cambiarlo.</p>
                  )}
                  <input
                    type="password"
                    value={tokenNuevo}
                    onChange={e => { setTokenNuevo(e.target.value); setMsg(null); }}
                    placeholder={cfg.wa_access_token_set ? 'Escribe uno nuevo solo si quieres reemplazarlo' : 'Pega aquí tu access token de WhatsApp'}
                    className={inputCls + ' font-mono'}
                    autoComplete="off"
                  />
                </Fila>
              </div>

              {/* Guardar (pie del bloque) */}
              <div className="px-5 py-4 border-t border-[#EFEFEF] bg-[#FAFAF8] flex items-center gap-3">
                <button
                  onClick={guardar}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#00847A] active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                {msg && <span className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</span>}
              </div>
            </div>

            {/* Finalizar registro del número (llama directo a la API de Meta) */}
            <div className="mt-5 rounded-2xl border border-[#E8E8E8] bg-white p-4">
              <div className="text-sm font-bold text-[#0D0D0D] mb-1">Finalizar registro del número</div>
              <p className="text-[12px] text-[#6B6B6B] mb-3">Si en Meta el número quedó en "pendiente / sin registrar" o el botón "Registrarte" te da error, termínalo aquí. Usa el Access Token y el Phone Number ID que guardaste arriba, más tu PIN de 6 dígitos.</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={pin}
                  onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setRegMsg(null); }}
                  placeholder="PIN de 6 dígitos"
                  inputMode="numeric"
                  className="w-44 bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm text-[#0D0D0D] focus:outline-none focus:border-[#00A89D] font-mono tracking-widest"
                />
                <button
                  onClick={registrarNumero}
                  disabled={registrando || pin.length !== 6}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#00847A] disabled:opacity-40"
                >
                  {registrando ? 'Registrando…' : 'Finalizar registro'}
                </button>
                {regMsg && <span className={`text-sm ${regMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{regMsg.text}</span>}
              </div>
              <p className="text-[11px] text-[#9A9A9A] mt-2">Ojo: primero guarda arriba el <b>Access Token</b> y el <b>Phone Number ID</b> del número real; luego dale aquí.</p>
            </div>

            {/* Manual paso a paso (PDF con hipervínculos a Meta) */}
            <div className="mt-2 rounded-2xl border border-[#00A89D]/25 bg-[#00A89D]/[0.06] p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#00A89D] text-white flex items-center justify-center text-xl shrink-0">📘</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[#0D0D0D]">¿Primera vez conectando WhatsApp?</div>
                <p className="text-[12px] text-[#6B6B6B] mt-0.5">Sigue el manual paso a paso: desde crear tu portafolio en Meta hasta sacar cada uno de los datos de arriba, con enlaces directos a cada pantalla.</p>
              </div>
              <a
                href="/manual-whatsapp-meta.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#00847A] active:scale-95"
              >
                Ver manual
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

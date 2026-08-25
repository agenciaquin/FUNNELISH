'use client';

import { useState, useEffect, useCallback } from 'react';

/* "Mi dominio": el cliente conecta su dominio propio (ej. de Hostinger) para que
 * sus embudos se vean en su marca. Si no tiene, sus embudos ya funcionan en el
 * dominio genérico de la plataforma. Un dominio por tienda. */

interface Instr { tipo: string; nombre: string; valor: string }
interface Estado {
  dominio: string;
  estado: string;         // 'activo' | 'pendiente' | ''
  verificado: boolean;
  instruccion: Instr | null;
  motivo?: string;        // 'activo' | 'dns_pendiente' | 'no_agregado' | 'sin_credenciales' | 'error'
  aviso?: string | null;
  detalle?: string;       // detalle técnico del error de Vercel (ej. "Vercel 403: ...")
}

export default function DominioPanel() {
  const [data, setData]       = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [entrada, setEntrada] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; t: string } | null>(null);

  const cargar = useCallback(async (): Promise<Estado | null> => {
    setCargando(true);
    let d: Estado | null = null;
    try {
      const r = await fetch('/api/tenant/dominio');
      if (r.ok) { d = await r.json(); setData(d); }
    } catch { /* red */ }
    setCargando(false);
    return d;
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function conectar() {
    if (!entrada.trim() || guardando) return;
    setGuardando(true); setMsg(null);
    try {
      const r = await fetch('/api/tenant/dominio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dominio: entrada.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, t: d.error ?? 'No se pudo conectar' }); }
      else {
        setEntrada('');
        setMsg({ ok: true, t: d.aviso || (d.verificado ? '¡Dominio activo! 🎉' : 'Dominio guardado. Ahora configura el DNS en tu proveedor y verifica.') });
        await cargar();
      }
    } catch { setMsg({ ok: false, t: 'Error de conexión' }); }
    setGuardando(false);
  }

  async function verificar() {
    setVerificando(true); setMsg(null);
    const d = await cargar();   // el GET reintenta agregar el dominio si hiciera falta
    if (d) {
      if (d.verificado) setMsg({ ok: true, t: '¡Dominio activo! 🎉 Si aún no abre, espera unos minutos por el candado HTTPS.' });
      else if (d.aviso) setMsg({ ok: false, t: d.aviso });
    }
    setVerificando(false);
  }

  async function quitar() {
    if (!confirm('¿Quitar el dominio? Tus embudos seguirán funcionando en el dominio de la plataforma.')) return;
    setGuardando(true);
    try { await fetch('/api/tenant/dominio', { method: 'DELETE' }); } catch {}
    setGuardando(false);
    setMsg(null);
    await cargar();
  }

  const dom = data?.dominio ?? '';
  const activo = data?.verificado === true;

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-[#0D0D0D] font-bold text-lg flex items-center gap-2">🌐 Mi dominio</h1>
          <p className="text-xs text-[#6B6B6B] mt-1">Conecta tu propio dominio para que tus embudos se vean con tu marca. Si no tienes uno, no pasa nada: tus embudos ya funcionan en el dominio de la plataforma.</p>
        </div>

        {msg && <div className={`text-sm rounded-lg px-3 py-2 border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>{msg.t}</div>}

        {cargando ? <div className="text-sm text-[#9A9A9A]">Cargando…</div> : (
          <>
            {/* Estado actual */}
            {dom ? (
              <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-sm font-bold text-[#0D0D0D]">{dom}</div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${activo ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {activo ? '✅ Activo'
                        : data?.motivo === 'dns_pendiente' ? '⏳ Pendiente — falta configurar el DNS'
                        : data?.motivo === 'no_agregado' ? '⏳ Conectando tu dominio…'
                        : data?.motivo === 'sin_credenciales' ? '⏳ Guardado — activando (soporte)'
                        : '⏳ Pendiente'}
                    </span>
                    {data?.aviso && <p className="text-[11px] text-[#6B6B6B] mt-1 max-w-md">{data.aviso}</p>}
                    {data?.motivo === 'error' && data?.detalle && (
                      <details className="mt-1.5 max-w-md">
                        <summary className="text-[10px] text-[#9A9A9A] cursor-pointer hover:text-[#6B6B6B]">Ver detalle técnico</summary>
                        <pre className="mt-1 text-[10px] font-mono text-[#B45309] bg-[#FFF7ED] border border-[#F5E4CC] rounded-lg p-2 whitespace-pre-wrap break-all">{data.detalle}</pre>
                      </details>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={verificar} disabled={verificando} className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs hover:bg-[#F5F5F5] disabled:opacity-50">{verificando ? 'Verificando…' : '🔄 Verificar'}</button>
                    <button onClick={quitar} className="px-3 py-1.5 rounded-lg text-xs text-[#DC2626] hover:bg-[#FEE2E2]">Quitar</button>
                  </div>
                </div>

                {!activo && data?.instruccion && (
                  <div className="mt-3 pt-3 border-t border-[#F0F0F0]">
                    <p className="text-xs text-[#6B6B6B] mb-2">En tu proveedor de dominio (Hostinger, etc.) agrega este registro DNS y luego toca <b>Verificar</b>:</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {(['Tipo', 'Nombre', 'Valor'] as const).map((h, i) => (
                        <div key={h} className="bg-[#FAF9F6] rounded-lg p-2 border border-[#EFEFEF]">
                          <div className="text-[9px] uppercase tracking-wide text-[#9A9A9A]">{h}</div>
                          <div className="text-xs font-mono font-bold text-[#0D0D0D] break-all">
                            {i === 0 ? data.instruccion!.tipo : i === 1 ? data.instruccion!.nombre : data.instruccion!.valor}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#9A9A9A] mt-2">El DNS puede tardar unos minutos (a veces hasta 1 hora) en propagarse.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-sm">
                <label className="text-xs font-semibold text-[#0D0D0D]">Conectar mi dominio</label>
                <p className="text-[11px] text-[#6B6B6B] mt-0.5 mb-2">Escribe el dominio que compraste (ej. <span className="font-mono">www.mitienda.com</span> o <span className="font-mono">mitienda.com</span>).</p>
                <div className="flex gap-2">
                  <input
                    value={entrada}
                    onChange={e => setEntrada(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') conectar(); }}
                    placeholder="www.mitienda.com"
                    className="flex-1 bg-[#FAF9F6] border border-[#E8E8E8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00A89D]"
                  />
                  <button onClick={conectar} disabled={guardando || !entrada.trim()} className="px-4 py-2 rounded-xl bg-[#00A89D] text-white text-sm font-bold hover:bg-[#007A72] disabled:opacity-40 shrink-0">{guardando ? '…' : 'Conectar'}</button>
                </div>
              </div>
            )}

            {/* Cómo funciona */}
            <div className="rounded-2xl border border-[#00A89D]/20 bg-[#00A89D]/[0.05] p-4">
              <h3 className="text-sm font-semibold text-[#00847A] mb-1">¿Cómo funciona?</h3>
              <ul className="text-xs text-[#6B6B6B] space-y-1 list-disc pl-4">
                <li><b>Sin dominio propio:</b> tus embudos ya funcionan en el dominio de la plataforma — no tienes que hacer nada.</li>
                <li><b>Con dominio propio:</b> escríbelo aquí, agrega el registro DNS en tu proveedor, y en minutos tus embudos se verán en tu marca (ej. <span className="font-mono">tudominio.com/tu-producto</span>).</li>
                <li>Es <b>un dominio por tienda</b>: todos tus embudos viven en él.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

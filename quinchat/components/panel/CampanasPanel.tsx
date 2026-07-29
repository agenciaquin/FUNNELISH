'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { leerExcelCampanas } from '@/lib/leer-excel-campanas';
import { calificar, CALIFICACIONES } from '@/lib/campanas';

interface Fila {
  campana: string; plataforma: string; estado: 'activa' | 'apagada' | ''; gasto: number;
  pedidos: number; confirmados: number; cancelados: number; pendientes: number;
  ingresos: number; tasaCierre: number; costoPorPedido: number;
  costoPorVenta: number; ganancia: number;
}
interface Resumen {
  gasto: number; pedidos: number; confirmados: number;
  ingresos: number; costoPorVenta: number; tasaCierre: number;
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

/** Logos de las plataformas — dibujados, así no dependen de ningún archivo. */
function LogoTikTok({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.5 2h-3v13.2a2.7 2.7 0 1 1-2.2-2.65V9.4a6 6 0 1 0 5.2 5.94V8.9a7.3 7.3 0 0 0 4.2 1.33V7.2a4.4 4.4 0 0 1-4.2-4.4V2z" fill="#010101" />
      <path d="M15.4 1h-3v13.2a2.7 2.7 0 1 1-2.2-2.65V8.4a6 6 0 1 0 5.2 5.94V7.9a7.3 7.3 0 0 0 4.2 1.33V6.2a4.4 4.4 0 0 1-4.2-4.4V1z" fill="#25F4EE" opacity=".85" transform="translate(-.9 .9)" />
      <path d="M16.5 2h-3v13.2a2.7 2.7 0 1 1-2.2-2.65V9.4a6 6 0 1 0 5.2 5.94V8.9a7.3 7.3 0 0 0 4.2 1.33V7.2a4.4 4.4 0 0 1-4.2-4.4V2z" fill="#FE2C55" opacity=".85" transform="translate(.9 -.4)" />
      <path d="M16.5 2h-3v13.2a2.7 2.7 0 1 1-2.2-2.65V9.4a6 6 0 1 0 5.2 5.94V8.9a7.3 7.3 0 0 0 4.2 1.33V7.2a4.4 4.4 0 0 1-4.2-4.4V2z" fill="#010101" />
    </svg>
  );
}

function LogoMeta({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.6 6.2C5.6 4.9 6.9 4.2 8.3 4.2c1.7 0 3 1 4.1 2.6.5.8 1 1.7 1.6 2.8.6-1.1 1.1-2 1.6-2.8 1.1-1.6 2.4-2.6 4.1-2.6 2.4 0 4.3 2.4 4.3 6.2 0 3.6-1.7 6-4.2 6-1.6 0-2.9-.9-4-2.5-.5-.8-1-1.6-1.5-2.5-.5.9-1 1.7-1.5 2.5-1.1 1.6-2.4 2.5-4 2.5C2.3 16.4.6 14 .6 10.4c0-3.8 1.9-6.2 4-4.2z"
        fill="none" stroke="#0866FF" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"
        transform="translate(0.5 1.5) scale(0.92)"
      />
    </svg>
  );
}

const PLATAFORMAS: Record<string, { nombre: string; Logo: (p: { size?: number }) => React.ReactElement; color: string }> = {
  tiktok: { nombre: 'TikTok', Logo: LogoTikTok, color: '#010101' },
  meta:   { nombre: 'Meta',   Logo: LogoMeta,   color: '#0866FF' },
  otro:   { nombre: 'Otro',   Logo: () => <span>🌐</span>, color: '#6B6B6B' },
};

function hoyISO() { return new Date().toISOString().slice(0, 10); }
function haceDiasISO(d: number) {
  const f = new Date(); f.setDate(f.getDate() - d);
  return f.toISOString().slice(0, 10);
}

export default function CampanasPanel() {
  const [desde, setDesde] = useState(haceDiasISO(6));
  const [hasta, setHasta] = useState(hoyISO());
  const [filas, setFilas]     = useState<Fila[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [sinOrigen, setSinOrigen] = useState(0);
  const [cargando, setCargando]   = useState(true);
  const [subiendo, setSubiendo]   = useState(false);
  const [aviso, setAviso]         = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Días de gasto cargados, para revisarlos y corregir cargas mal hechas
  const [dias, setDias]       = useState<{ plataforma: string; fecha: string; total: number; campanas: number }[]>([]);
  const [verDias, setVerDias] = useState(false);

  const cargarDias = useCallback(async () => {
    try {
      const res  = await fetch('/api/campanas/dias', { cache: 'no-store' });
      const data = await res.json();
      setDias(data.dias ?? []);
    } catch { /* ignorar */ }
  }, []);

  useEffect(() => { cargarDias(); }, [cargarDias]);

  // Costo por venta que consideras aceptable. Es la vara con la que se mide todo.
  const [objetivo, setObjetivo]       = useState<number>(0);
  const [objetivoOpen, setObjetivoOpen] = useState(false);
  const [objetivoTmp, setObjetivoTmp]   = useState('');

  useEffect(() => {
    fetch('/api/configuracion?clave=costo_objetivo_venta')
      .then(r => r.json())
      .then(d => { const n = Number(d?.valor ?? 0); if (n > 0) setObjetivo(n); })
      .catch(() => {});
  }, []);

  async function guardarObjetivo() {
    const n = Number(String(objetivoTmp).replace(/[^\d]/g, ''));
    if (!n || n <= 0) { alert('Escribe un valor mayor que cero.'); return; }
    setObjetivo(n);
    setObjetivoOpen(false);
    await fetch('/api/configuracion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave: 'costo_objetivo_venta', valor: String(n) }),
    }).catch(() => {});
  }

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res  = await fetch(`/api/campanas?desde=${desde}&hasta=${hasta}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setFilas(data.filas ?? []);
        setResumen(data.resumen ?? null);
        setSinOrigen(data.sinOrigen ?? 0);
      }
    } finally { setCargando(false); }
  }, [desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  async function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true); setAviso(null);
    try {
      const buffer = await file.arrayBuffer();
      const lectura = leerExcelCampanas(buffer, file.name);

      if (lectura.error) { setAviso(`❌ ${lectura.error}`); return; }
      if (lectura.filas.length === 0) { setAviso('❌ No encontré filas con datos en el archivo.'); return; }

      const res = await fetch('/api/campanas/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plataforma: lectura.plataforma, filas: lectura.filas }),
      });
      const data = await res.json();
      if (!res.ok) { setAviso(`❌ ${data.error}`); return; }

      const nombre = lectura.plataforma === 'meta' ? 'Meta' : 'TikTok';
      const partes = [
        `✅ ${nombre}: ${data.guardadas} campañas · ${pesos(data.total)} · ${data.fechas.join(', ')}`,
        data.conEstado > 0
          ? `${data.conEstado} con estado (activa/apagada)`
          : '⚠️ el archivo no traía la columna de estado — revisa que el export incluya "Entrega de la campaña" (Meta) o "Primary status" (TikTok)',
      ];
      if (data.aviso) partes.push(`⚠️ ${data.aviso}`);
      if (lectura.esRango) {
        partes.push(
          `⚠️ El archivo cubre varios días pero no los separa, así que todo el gasto quedó cargado en el ${lectura.fecha}. ` +
          `Para que cuadre día a día, exporta un solo día a la vez.`
        );
      }
      setAviso(partes.join(' · '));
      await cargar();
      await cargarDias();
    } catch (err: any) {
      setAviso(`❌ No pude leer el archivo: ${err?.message ?? 'error'}`);
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const rango = (dias: number) => { setDesde(haceDiasISO(dias)); setHasta(hoyISO()); };

  async function borrarDia(plataforma: string, fecha: string) {
    if (!confirm(`¿Borrar el gasto de ${plataforma.toUpperCase()} del ${fecha}?\n\nDespués puedes volver a subir ese día con el archivo correcto.`)) return;
    await fetch(`/api/campanas/dias?plataforma=${plataforma}&fecha=${fecha}`, { method: 'DELETE' });
    await cargarDias();
    await cargar();
  }

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">

        {/* Subir archivos */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 shadow-sm mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-bold text-[#0D0D0D]">Subir gasto de publicidad</h2>
              <p className="text-xs text-[#6B6B6B] mt-0.5">
                Exporta el reporte de campañas de TikTok o Meta y súbelo aquí. Detecto solo de cuál es.
              </p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={subirArchivo} className="hidden" />
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setObjetivoTmp(objetivo ? String(objetivo) : ''); setObjetivoOpen(true); }}
                title="Define cuánto puedes pagar por cada venta confirmada"
                className="px-4 py-2.5 rounded-xl border border-[#00A89D]/40 text-[#00847A] text-sm font-semibold hover:bg-[#00A89D]/10 transition-colors"
              >
                🎯 {objetivo ? `Meta: ${pesos(objetivo)}` : 'Definir costo objetivo'}
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={subiendo}
                className="px-4 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A] disabled:opacity-50 transition-colors"
              >
                {subiendo ? 'Leyendo…' : '📁 Subir Excel'}
              </button>
            </div>
          </div>
          {aviso && <div className="mt-3 text-xs p-3 rounded-lg bg-[#F5F5F5] text-[#0D0D0D] leading-snug">{aviso}</div>}

          {/* Días cargados — para revisar y corregir */}
          {dias.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setVerDias(v => !v)}
                className="text-[11px] text-[#00847A] font-semibold hover:underline"
              >
                {verDias ? '▾' : '▸'} Días de gasto cargados ({dias.length})
              </button>

              {verDias && (
                <>
                  <p className="text-[10px] text-[#6B6B6B] mt-2 mb-1.5 leading-snug">
                    Si un día tiene un valor que no corresponde (por haber subido un archivo de varios días),
                    bórralo y vuelve a subir ese día solo.
                  </p>
                  <div className="max-h-44 overflow-y-auto border border-[#E8E8E8] rounded-lg divide-y divide-[#F5F5F5]">
                    {dias.map(d => (
                      <div key={`${d.plataforma}-${d.fecha}`} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
                        <span className="font-semibold uppercase w-14 shrink-0" style={{ color: d.plataforma === 'meta' ? '#0866FF' : '#0D0D0D' }}>
                          {d.plataforma}
                        </span>
                        <span className="text-[#6B6B6B] w-24 shrink-0">{d.fecha}</span>
                        <span className="text-[#0D0D0D] font-medium">{pesos(d.total)}</span>
                        <span className="text-[#9A9A9A]">· {d.campanas} camp.</span>
                        <button
                          onClick={() => borrarDia(d.plataforma, d.fecha)}
                          className="ml-auto text-[#DC2626] hover:bg-[#FEE2E2] w-6 h-6 rounded shrink-0"
                          title="Borrar este día"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Rango de fechas */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white" />
          <span className="text-xs text-[#6B6B6B]">a</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white" />
          {[
            { dias: 0,  txt: 'Hoy' },
            { dias: 6,  txt: '7 días' },
            { dias: 29, txt: '30 días' },
          ].map(r => {
            const activo = desde === haceDiasISO(r.dias) && hasta === hoyISO();
            return (
              <button
                key={r.txt}
                onClick={() => rango(r.dias)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  activo
                    ? 'bg-[#00A89D] text-white border-[#00A89D] font-semibold'
                    : 'bg-white border-[#E8E8E8] hover:border-[#00A89D]'
                }`}
              >{r.txt}</button>
            );
          })}
          <span className="text-[10px] text-[#9A9A9A] ml-1">
            gasto por día de pauta · pedidos por día en que entraron
          </span>
        </div>

        {/* Resumen */}
        {resumen && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            {[
              { t: 'Invertido',          v: pesos(resumen.gasto),        c: '#DC2626', i: '💸' },
              { t: 'Pedidos',            v: String(resumen.pedidos),     c: '#8B5CF6', i: '🛒' },
              { t: 'Ventas confirmadas', v: String(resumen.confirmados), c: '#15803D', i: '✅' },
              { t: 'Costo real / venta', v: resumen.confirmados ? pesos(resumen.costoPorVenta) : '—', c: '#EA580C', i: '🎯' },
              { t: 'Vendido',            v: pesos(resumen.ingresos),     c: '#00847A', i: '💰' },
            ].map(k => {
              // La tarjeta del costo real se pinta según el objetivo
              const esCosto = k.t.startsWith('Costo');
              const bien = esCosto && objetivo > 0 && resumen.confirmados > 0 && resumen.costoPorVenta <= objetivo;
              const mal  = esCosto && objetivo > 0 && resumen.confirmados > 0 && resumen.costoPorVenta > objetivo;
              return (
                <div
                  key={k.t}
                  className="bg-white rounded-2xl border p-4 shadow-sm transition-colors"
                  style={{ borderColor: bien ? '#15803D40' : mal ? '#DC262640' : '#E8E8E8' }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{k.i}</span>
                    <span className="text-[11px] text-[#6B6B6B] truncate">{k.t}</span>
                  </div>
                  <div className="text-lg font-bold" style={{ color: bien ? '#15803D' : mal ? '#DC2626' : k.c }}>
                    {k.v}
                  </div>
                  {esCosto && objetivo > 0 && (
                    <div className="text-[10px] mt-0.5" style={{ color: bien ? '#15803D' : mal ? '#DC2626' : '#9A9A9A' }}>
                      meta {pesos(objetivo)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {sinOrigen > 0 && (
          <div className="text-xs p-3 rounded-xl bg-[#FEF3C7] text-[#92400E] mb-5 leading-snug">
            ⚠️ {sinOrigen} pedido{sinOrigen > 1 ? 's' : ''} sin campaña de origen — no se pueden atribuir.
            Suele pasar con pedidos anteriores a esta función o con tráfico que no viene de anuncios.
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E8E8E8]">
            <h2 className="text-sm font-bold text-[#0D0D0D]">Rentabilidad por campaña</h2>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">
              El costo real cuenta solo las ventas confirmadas por WhatsApp, no los pedidos de la página.
            </p>
          </div>

          {cargando ? (
            <p className="text-sm text-[#6B6B6B] py-10 text-center">Cargando…</p>
          ) : filas.length === 0 ? (
            <p className="text-sm text-[#6B6B6B] py-10 text-center px-6">
              Todavía no hay datos en este rango. Sube un Excel de campañas para empezar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
                  <tr className="text-[#6B6B6B]">
                    <th className="text-left  px-4 py-2.5 font-semibold">Campaña</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Gasto</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Pedidos</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Conf.</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Cierre</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Costo/venta</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Ganancia</th>
                    <th className="text-left  px-4 py-2.5 font-semibold w-[190px]">Rendimiento</th>
                    <th className="text-center px-4 py-2.5 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => {
                    const buena = f.ganancia > 0;
                    const plat  = PLATAFORMAS[f.plataforma] ?? PLATAFORMAS.otro;
                    // Encabezado al empezar cada plataforma, con su subtotal
                    const nuevaPlataforma = i === 0 || filas[i - 1].plataforma !== f.plataforma;
                    const delGrupo = filas.filter(x => x.plataforma === f.plataforma);
                    const subGasto = delGrupo.reduce((s, x) => s + x.gasto, 0);
                    const subVentas = delGrupo.reduce((s, x) => s + x.confirmados, 0);

                    return (
                      <React.Fragment key={`${f.plataforma}-${f.campana}`}>
                      {nuevaPlataforma && (
                        <tr key={`h-${f.plataforma}`} className="bg-[#F7F7F7] border-y border-[#E8E8E8]">
                          <td colSpan={9} className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <plat.Logo size={15} />
                              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: plat.color }}>
                                {plat.nombre}
                              </span>
                              <span className="text-[10px] text-[#6B6B6B] ml-1">
                                {delGrupo.length} campaña{delGrupo.length > 1 ? 's' : ''} · {pesos(subGasto)} · {subVentas} venta{subVentas === 1 ? '' : 's'}
                                {delGrupo.some(x => x.estado === 'activa') && (
                                  <> · <span className="text-[#15803D] font-semibold">
                                    {delGrupo.filter(x => x.estado === 'activa').length} activa{delGrupo.filter(x => x.estado === 'activa').length > 1 ? 's' : ''}
                                  </span></>
                                )}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr key={f.campana + f.plataforma} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 mt-0.5"><plat.Logo size={13} /></span>
                            <div className="font-medium text-[#0D0D0D] truncate max-w-[240px]" title={f.campana}>{f.campana}</div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-[#0D0D0D]">{pesos(f.gasto)}</td>
                        <td className="px-3 py-2.5 text-right text-[#0D0D0D]">{f.pedidos}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-[#15803D]">{f.confirmados}</td>
                        <td className="px-3 py-2.5 text-right text-[#6B6B6B]">{f.tasaCierre ? `${f.tasaCierre}%` : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-semibold" style={{ color: f.confirmados ? '#EA580C' : '#9A9A9A' }}>
                          {f.confirmados ? pesos(f.costoPorVenta) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold" style={{ color: buena ? '#15803D' : '#DC2626' }}>
                          {pesos(f.ganancia)}
                        </td>
                        <td className="px-4 py-2.5">
                          {(() => {
                            const { nivel, barra } = calificar(f.costoPorVenta, f.confirmados, f.gasto, objetivo);
                            const cal = CALIFICACIONES[nivel];
                            return (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-[#F0F0F0] overflow-hidden min-w-[60px]">
                                  <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `${barra}%`, background: cal.color }}
                                  />
                                </div>
                                <span
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                                  style={{ color: cal.color, background: cal.fondo }}
                                >
                                  {cal.texto}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {f.estado === 'activa' ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full text-[#15803D] bg-[#15803D]/10 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse" />
                              Activa
                            </span>
                          ) : f.estado === 'apagada' ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full text-[#DC2626] bg-[#DC2626]/10 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
                              Apagada
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#C9C9C9]">—</span>
                          )}
                        </td>
                      </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[10px] text-[#9A9A9A] mt-4 leading-relaxed">
          La ganancia es lo vendido menos lo invertido en pauta. No descuenta el costo del producto ni el envío,
          así que tómala como referencia para comparar campañas entre sí, no como utilidad neta.
          {objetivo > 0 && ' El rendimiento compara el costo por venta confirmada contra tu meta.'}
        </p>
      </div>

      {/* Definir el costo objetivo por venta */}
      {objetivoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setObjetivoOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#0D0D0D] mb-1">Costo objetivo por venta</h3>
            <p className="text-xs text-[#6B6B6B] mb-4 leading-snug">
              ¿Cuánto puedes pagar en pauta por cada venta <strong>confirmada</strong> y seguir ganando?
              Con esa vara se califica cada campaña.
            </p>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-bold text-[#6B6B6B]">$</span>
              <input
                autoFocus
                inputMode="numeric"
                value={objetivoTmp}
                onChange={e => setObjetivoTmp(e.target.value.replace(/[^\d]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') guardarObjetivo(); }}
                placeholder="35000"
                className="flex-1 px-3 py-2 rounded-lg border border-[#E8E8E8] text-lg font-semibold focus:outline-none focus:border-[#00A89D]"
              />
            </div>
            {objetivoTmp && (
              <p className="text-[11px] text-[#6B6B6B] mb-3">
                {pesos(Number(objetivoTmp))} por venta confirmada
              </p>
            )}

            <div className="text-[10px] text-[#6B6B6B] bg-[#F7F7F7] rounded-lg p-2.5 mb-4 leading-relaxed">
              Cómo se califica: <strong className="text-[#15803D]">Excelente</strong> si cuesta menos de dos tercios
              de tu meta · <strong className="text-[#65A30D]">Buena</strong> si está por debajo ·
              <strong className="text-[#EA580C]"> Regular</strong> si ronda la meta ·
              <strong className="text-[#DC2626]"> Mala</strong> si la supera claramente.
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setObjetivoOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-sm text-[#6B6B6B] hover:bg-[#F5F5F5]"
              >Cancelar</button>
              <button
                onClick={guardarObjetivo}
                className="flex-1 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A]"
              >Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

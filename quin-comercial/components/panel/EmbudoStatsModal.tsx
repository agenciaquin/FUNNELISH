'use client';

import { useState, useEffect } from 'react';

interface Paso { clave: string; nombre: string; desc: string; total: number; pctDeInicio: number; emoji: string }
interface Caida { de: string; perdidos: number; pct: number }
interface Stats { slug: string; dias: number; pasos: Paso[]; caidas: Caida[]; conversion_total: number; ventas: number }

const miles = (n: number) => Math.round(n).toLocaleString('es-CO');

export default function EmbudoStatsModal({ slug, producto, onClose }: { slug: string; producto?: string; onClose: () => void }) {
  const [dias, setDias] = useState(7);
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    fetch(`/api/funnels/stats?slug=${encodeURIComponent(slug)}&dias=${dias}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (vivo) setData(d); })
      .catch(() => { if (vivo) setData(null); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [slug, dias]);

  const maxTotal = data ? Math.max(1, ...data.pasos.map(p => p.total)) : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8E8E8] flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-base font-bold text-[#0D0D0D]">📊 Estadísticas del embudo</h3>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">{producto || slug} · <span className="font-mono">{slug}</span></p>
          </div>
          <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#0D0D0D] text-xl leading-none">×</button>
        </div>

        {/* Rango de fechas */}
        <div className="px-6 pt-4 flex gap-2">
          {[{ d: 1, t: 'Hoy' }, { d: 7, t: '7 días' }, { d: 30, t: '30 días' }].map(o => (
            <button key={o.d} onClick={() => setDias(o.d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                dias === o.d ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A] font-semibold' : 'border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5]'
              }`}>{o.t}</button>
          ))}
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="text-center text-[#9A9A9A] text-sm py-10">Cargando…</div>
          ) : !data ? (
            <div className="text-center text-[#9A9A9A] text-sm py-10">No se pudieron cargar las estadísticas.</div>
          ) : (
            <>
              {/* Resumen arriba */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-xl border border-[#EFEFEF] bg-[#FAFAF8] p-3 text-center">
                  <div className="text-2xl font-extrabold text-[#00847A]">{data.conversion_total}%</div>
                  <div className="text-[11px] text-[#6B6B6B] mt-0.5">Conversión total</div>
                </div>
                <div className="rounded-xl border border-[#EFEFEF] bg-[#FAFAF8] p-3 text-center">
                  <div className="text-2xl font-extrabold text-[#0D0D0D]">{miles(data.ventas)}</div>
                  <div className="text-[11px] text-[#6B6B6B] mt-0.5">Compras completadas</div>
                </div>
              </div>

              {/* Embudo por pasos */}
              <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide mb-2">Recorrido del cliente</p>
              <div className="space-y-2">
                {data.pasos.map((p, i) => (
                  <div key={p.clave}>
                    <div className="rounded-xl border border-[#EFEFEF] p-3 relative overflow-hidden">
                      {/* barra proporcional de fondo */}
                      <div className="absolute inset-y-0 left-0 bg-[#00A89D]/10" style={{ width: `${Math.max(4, (p.total / maxTotal) * 100)}%` }} />
                      <div className="relative flex items-center gap-3">
                        <span className="text-xl">{p.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-[#0D0D0D]">{p.nombre}</div>
                          <div className="text-[11px] text-[#6B6B6B]">{p.desc}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-extrabold text-[#0D0D0D]">{miles(p.total)}</div>
                          <div className="text-[11px] font-semibold text-[#00847A]">{p.pctDeInicio}%</div>
                        </div>
                      </div>
                    </div>
                    {/* Caída hacia el siguiente paso */}
                    {i < data.caidas.length && data.caidas[i].perdidos > 0 && (
                      <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-[#DC2626]">
                        <span>↓</span>
                        <span>Se cayeron <b>{miles(data.caidas[i].perdidos)}</b> ({data.caidas[i].pct}%) en {data.caidas[i].de.toLowerCase()}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Diagnóstico simple */}
              <DiagnosticoCaida caidas={data.caidas} landing={data.pasos[0]?.total ?? 0} />

              <p className="text-[10px] text-[#9A9A9A] mt-4 text-center">
                Se cuentan visitas únicas por sesión. La página de venta es el 100% de referencia.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DiagnosticoCaida({ caidas, landing }: { caidas: Caida[]; landing: number }) {
  if (landing === 0) {
    return <div className="mt-5 rounded-xl bg-[#FFF8E6] border border-[#F5D98B] px-4 py-3 text-[12px] text-[#8A6D1A]">
      Todavía no hay visitas registradas en este periodo. En cuanto entren clientes por el embudo, aquí verás dónde llegan y dónde se caen.
    </div>;
  }
  // La caída más grande marca dónde enfocar.
  const peor = [...caidas].sort((a, b) => b.pct - a.pct)[0];
  if (!peor || peor.perdidos === 0) {
    return <div className="mt-5 rounded-xl bg-[#EAFBF6] border border-[#A7E8D6] px-4 py-3 text-[12px] text-[#0B6B5A]">
      ¡Buen flujo! Casi no se está cayendo gente entre pasos.
    </div>;
  }
  return <div className="mt-5 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] px-4 py-3 text-[12px] text-[#B91C1C]">
    📍 <b>Dónde enfocarte:</b> la mayor caída está en <b>{peor.de.toLowerCase()}</b> — se pierde el <b>{peor.pct}%</b> ahí. Revisa esa parte de la página para recuperar esas ventas.
  </div>;
}

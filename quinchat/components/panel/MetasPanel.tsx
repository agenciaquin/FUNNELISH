'use client';

import { useEffect, useRef, useState } from 'react';
import { fanfarria, confeti } from '@/lib/celebracion';

interface Metas {
  prendasMes: number;
  dineroMes: number;
  prendasHoy: number;
  valorPrenda: number;
  metas: number[];
  metaActiva: number;
  metaIndice: number;
  todasLogradas: boolean;
  faltan: number;
  progresoPct: number;
  diaActual: number;
  diasDelMes: number;
  diasRestantes: number;
  metaDiaria: number;
  ritmo: 'adelantado' | 'atrasado';
  diferenciaRitmo: number;
}

interface Rango { desde: string; hasta: string; prendas: number; dinero: number; }

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const MES = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' });

/** 'YYYY-MM-DD' en hora de Colombia, corrido `offset` días (0 hoy, -1 ayer). */
function diaBogota(offset = 0): string {
  const base = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  base.setDate(base.getDate() + offset);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Muestra 'YYYY-MM-DD' como '1 ago' legible. */
function bonito(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
}

export default function MetasPanel() {
  const [d, setD] = useState<Metas | null>(null);
  const [error, setError] = useState(false);
  const anterior = useRef<number | null>(null);

  // Filtro por fecha
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [rango, setRango] = useState<Rango | null>(null);
  const [cargandoRango, setCargandoRango] = useState(false);

  async function consultarRango(dDesde: string, dHasta: string) {
    if (!dDesde) return;
    setDesde(dDesde); setHasta(dHasta || dDesde);
    setCargandoRango(true);
    try {
      const q = new URLSearchParams({ desde: dDesde, hasta: dHasta || dDesde });
      const r = await fetch(`/api/metas?${q}`, { cache: 'no-store' });
      const j = await r.json();
      setRango(j.rango ?? null);
    } catch { setRango(null); }
    finally { setCargandoRango(false); }
  }

  function limpiarRango() { setDesde(''); setHasta(''); setRango(null); }

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const r = await fetch('/api/metas', { cache: 'no-store' });
        if (!r.ok) { setError(true); return; }
        const j: Metas = await r.json();
        if (!vivo) return;
        if (anterior.current != null && j.metaIndice > anterior.current) {
          fanfarria(); confeti();
        }
        anterior.current = j.metaIndice;
        setD(j); setError(false);
      } catch { setError(true); }
    };
    cargar();
    const t = setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, 12000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  return (
    <div className="flex-1 h-full min-h-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-3xl mx-auto px-4 py-5 pt-12 md:pt-5">

        <header className="mb-4">
          <h1 className="text-2xl font-extrabold text-[#0F3D3A] flex items-center gap-2">🎯 Tus metas</h1>
          <p className="text-sm text-gray-500 capitalize">{MES.format(new Date())}</p>
        </header>

        {/* Filtro por fecha */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3.5 mb-4">
          <p className="text-xs font-semibold text-gray-600 mb-2">📅 Sumar por fecha</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-gray-500">
              Desde
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="block mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700" />
            </label>
            <label className="text-xs text-gray-500">
              Hasta
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="block mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700" />
            </label>
            <button onClick={() => consultarRango(desde, hasta)} disabled={!desde || cargandoRango}
              className="px-3 py-1.5 rounded-lg bg-[#00847A] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#00A89D]">
              {cargandoRango ? '…' : 'Ver'}
            </button>
            <div className="flex gap-1.5 ml-auto">
              <button onClick={() => consultarRango(diaBogota(0), diaBogota(0))}
                className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200">Hoy</button>
              <button onClick={() => consultarRango(diaBogota(-1), diaBogota(-1))}
                className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200">Ayer</button>
              {rango && (
                <button onClick={limpiarRango}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200">Ver el mes</button>
              )}
            </div>
          </div>

          {rango && (
            <div className="mt-3 rounded-xl bg-[#E6F5F3] border border-[#00A89D] px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#00847A] font-semibold">
                  {rango.desde === rango.hasta ? bonito(rango.desde) : `${bonito(rango.desde)} – ${bonito(rango.hasta)}`}
                </p>
                <p className="text-2xl font-extrabold text-[#0F3D3A] tabular-nums">{rango.prendas} <span className="text-sm font-semibold text-gray-500">prendas</span></p>
              </div>
              <p className="text-2xl font-extrabold text-[#00847A] tabular-nums">{pesos(rango.dinero)}</p>
            </div>
          )}
        </div>

        {error && !d && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            No se pudo cargar. Reintentando…
          </div>
        )}

        {!d && !error && (
          <div className="animate-pulse space-y-3">
            <div className="h-28 rounded-2xl bg-gray-200" />
            <div className="h-16 rounded-2xl bg-gray-200" />
          </div>
        )}

        {d && (
          <div className="space-y-4">

            {/* Monedero del mes */}
            <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-[#00847A] to-[#00B5A6] shadow-lg shadow-[#00847A]/20">
              <p className="text-white/80 text-xs uppercase tracking-wide">Ganancia del mes ($600 por prenda)</p>
              <p className="text-4xl font-extrabold mt-1 tabular-nums">{pesos(d.dineroMes)}</p>
              <p className="text-white/90 mt-1 text-sm">
                <span className="font-bold tabular-nums">{d.prendasMes}</span> prendas vendidas
              </p>
            </div>

            {/* Barra hacia la meta activa */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Meta {d.metaIndice} de 3</p>
                  <p className="text-lg font-bold text-[#0F3D3A]">
                    {d.todasLogradas ? '¡Todas las metas logradas! 🏆' : `Llegar a ${d.metaActiva} prendas`}
                  </p>
                </div>
                <p className="text-2xl font-extrabold text-[#00847A] tabular-nums">{d.progresoPct}%</p>
              </div>

              <div className="h-5 rounded-full bg-gray-100 overflow-hidden relative">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00A89D] to-[#00847A] transition-all duration-700 ease-out flex items-center justify-end pr-2"
                  style={{ width: `${Math.max(4, d.progresoPct)}%` }}
                >
                  <span className="text-[10px] font-bold text-white tabular-nums">{d.prendasMes}</span>
                </div>
              </div>

              <div className="flex justify-between text-xs text-gray-500 mt-1.5 tabular-nums">
                <span>0</span>
                <span>{d.todasLogradas ? '¡Completo!' : `Faltan ${d.faltan} prendas`}</span>
                <span>{d.metaActiva}</span>
              </div>

              {/* Escalera de metas */}
              <div className="flex items-center gap-2 mt-4">
                {d.metas.map((m, i) => {
                  const lograda = d.prendasMes >= m;
                  const activa = m === d.metaActiva && !d.todasLogradas;
                  return (
                    <div
                      key={m}
                      className={`flex-1 rounded-xl px-2 py-2 text-center border ${
                        lograda ? 'bg-[#E6F5F3] border-[#00A89D] text-[#00847A]'
                        : activa ? 'bg-white border-[#F59E0B] text-[#B45309] ring-1 ring-[#F59E0B]'
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                      }`}
                    >
                      <p className="text-[10px] uppercase tracking-wide">Meta {i + 1}</p>
                      <p className="text-base font-extrabold tabular-nums">{m}</p>
                      <p className="text-[11px]">{lograda ? '✅ Lograda' : activa ? '🔥 En curso' : 'Bloqueada'}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Metas del día */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
                <p className="text-xs text-gray-500">Hoy llevas</p>
                <p className="text-3xl font-extrabold text-[#0F3D3A] tabular-nums">{d.prendasHoy}</p>
                <p className="text-xs text-gray-500">prendas</p>
              </div>
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
                <p className="text-xs text-gray-500">Meta de hoy</p>
                <p className="text-3xl font-extrabold text-[#00847A] tabular-nums">{d.metaDiaria}</p>
                <p className="text-xs text-gray-500">
                  {d.metaDiaria === 0 ? '¡meta del mes cumplida!'
                    : d.prendasHoy >= d.metaDiaria ? '✅ ya la cumpliste hoy'
                    : `faltan ${d.metaDiaria - d.prendasHoy} hoy`}
                </p>
              </div>
            </div>

            {/* Ritmo del mes */}
            <div className={`rounded-2xl p-4 border shadow-sm ${
              d.ritmo === 'adelantado' ? 'bg-[#E6F5F3] border-[#00A89D]' : 'bg-[#FEF3C7] border-[#F59E0B]'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-[#0F3D3A]">
                    {d.todasLogradas ? '🏆 ¡Mes redondo!' : d.ritmo === 'adelantado' ? '🚀 Vas adelantado' : '⏳ Vas atrasado'}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {d.todasLogradas
                      ? 'Superaste las tres metas del mes.'
                      : d.ritmo === 'adelantado'
                        ? `Llevas ${d.diferenciaRitmo} prendas más de lo esperado para el día ${d.diaActual}.`
                        : `Te faltan ${d.diferenciaRitmo} prendas para ir al día. ¡Tú puedes!`}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-xs text-gray-500">Quedan</p>
                  <p className="text-xl font-extrabold text-[#0F3D3A] tabular-nums">{d.diasRestantes}</p>
                  <p className="text-xs text-gray-500">días</p>
                </div>
              </div>
            </div>

            <p className="text-center text-[11px] text-gray-400 pt-1">
              Se actualiza solo cuando marcas una venta como “VENTA REALIZADA”. Si quitas una, se descuenta.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

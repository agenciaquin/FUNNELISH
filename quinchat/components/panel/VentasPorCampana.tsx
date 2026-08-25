'use client';

import { useState, useEffect, useCallback } from 'react';

interface Campana { campana: string; fuente: string; pedidos: number; prendas: number; vendido: number }
interface Totales { pedidos: number; prendas: number; vendido: number }

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
function hoyISO() { return new Date().toISOString().slice(0, 10); }
function haceDiasISO(d: number) { const f = new Date(); f.setDate(f.getDate() - d); return f.toISOString().slice(0, 10); }

/** Reporte de prendas vendidas por campaña, con filtro de fechas. */
export default function VentasPorCampana({ onClose }: { onClose: () => void }) {
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [totales, setTotales]   = useState<Totales>({ pedidos: 0, prendas: 0, vendido: 0 });
  const [cargando, setCargando] = useState(true);
  const [origen, setOrigen]     = useState<'web' | 'todos'>('web');
  const [orden, setOrden]       = useState<'prendas' | 'vendido' | 'pedidos'>('prendas');

  const [desde, setDesde] = useState(haceDiasISO(6));
  const [hasta, setHasta] = useState(hoyISO());
  const [todo, setTodo]   = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const qs = new URLSearchParams({ origen });
      if (!todo) { qs.set('desde', desde); qs.set('hasta', hasta); }
      const r = await fetch(`/api/campanas/ventas?${qs}`, { cache: 'no-store' });
      const d = await r.json();
      setCampanas(d.campanas ?? []);
      setTotales(d.totales ?? { pedidos: 0, prendas: 0, vendido: 0 });
    } finally { setCargando(false); }
  }, [origen, desde, hasta, todo]);

  useEffect(() => { cargar(); }, [cargar]);

  const rango = (d: number) => { setTodo(false); setDesde(haceDiasISO(d)); setHasta(hoyISO()); };
  const ordenadas = [...campanas].sort((a, b) => b[orden] - a[orden]);
  const maxPrendas = Math.max(1, ...ordenadas.map(c => c.prendas));

  const chip = (activo: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs border transition-colors ${
      activo ? 'bg-[#00A89D] text-white border-[#00A89D] font-semibold' : 'bg-white border-[#E8E8E8] hover:border-[#00A89D]'
    }`;

  const hoy = hasta === hoyISO() && desde === hoyISO() && !todo;
  const es7 = desde === haceDiasISO(6) && hasta === hoyISO() && !todo;
  const es30 = desde === haceDiasISO(29) && hasta === hoyISO() && !todo;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
        <header className="mb-4">
          <button onClick={onClose} className="text-xs text-[#00A89D] font-semibold hover:underline mb-1">← Volver a embudos</button>
          <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">Ventas por campaña</h1>
          <p className="text-xs text-[#6B6B6B] mt-1">Cuántas prendas y cuánto vendiste por cada campaña.</p>
        </header>

        {/* Filtros de fecha */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button onClick={() => { setTodo(false); setDesde(hoyISO()); setHasta(hoyISO()); }} className={chip(hoy)}>Hoy</button>
          <button onClick={() => rango(6)}  className={chip(es7)}>7 días</button>
          <button onClick={() => rango(29)} className={chip(es30)}>30 días</button>
          <button onClick={() => setTodo(true)} className={chip(todo)}>Todo</button>
          <span className="w-px h-5 bg-[#E8E8E8] mx-1" />
          <input type="date" value={desde} max={hasta} onChange={e => { setTodo(false); setDesde(e.target.value); }}
            className="px-2 py-1.5 rounded-lg border border-[#E8E8E8] text-xs" />
          <span className="text-xs text-[#9A9A9A]">a</span>
          <input type="date" value={hasta} min={desde} max={hoyISO()} onChange={e => { setTodo(false); setHasta(e.target.value); }}
            className="px-2 py-1.5 rounded-lg border border-[#E8E8E8] text-xs" />
          <span className="w-px h-5 bg-[#E8E8E8] mx-1" />
          <button onClick={() => setOrigen('web')}   className={chip(origen === 'web')}>🚀 Mis páginas</button>
          <button onClick={() => setOrigen('todos')} className={chip(origen === 'todos')}>Todos</button>
        </div>

        {/* Totales */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { t: 'Campañas', v: String(ordenadas.length), c: '#8B5CF6', i: '🎯' },
            { t: 'Prendas',  v: String(totales.prendas),  c: '#00847A', i: '👕' },
            { t: 'Vendido',  v: pesos(totales.vendido),    c: '#15803D', i: '💰' },
          ].map(k => (
            <div key={k.t} className="bg-white rounded-2xl border border-[#E8E8E8] p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1"><span className="text-sm">{k.i}</span><span className="text-[11px] text-[#6B6B6B]">{k.t}</span></div>
              <div className="text-lg font-bold" style={{ color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Orden */}
        <div className="flex items-center gap-2 mb-2 text-[11px] text-[#6B6B6B]">
          <span>Ordenar por:</span>
          {(['prendas', 'vendido', 'pedidos'] as const).map(o => (
            <button key={o} onClick={() => setOrden(o)}
              className={`px-2 py-1 rounded-md ${orden === o ? 'bg-[#00A89D]/10 text-[#00847A] font-semibold' : 'hover:bg-[#F0F0F0]'}`}>
              {o === 'prendas' ? 'Prendas' : o === 'vendido' ? 'Vendido' : 'Pedidos'}
            </button>
          ))}
        </div>

        {/* Lista de campañas */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-4">
          {cargando ? (
            <p className="text-sm text-[#6B6B6B] py-8 text-center">Cargando…</p>
          ) : ordenadas.length === 0 ? (
            <p className="text-sm text-[#6B6B6B] py-8 text-center">No hay ventas confirmadas en este período.</p>
          ) : (
            <div className="space-y-3">
              {ordenadas.map((c, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-sm">🎯</span>
                      <span className="text-sm font-semibold text-[#0D0D0D] truncate">{c.campana}</span>
                      {c.fuente && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#6D28D9] shrink-0">{c.fuente}</span>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <span className="text-[11px] text-[#9A9A9A]">{c.pedidos} ped.</span>
                      <span className="text-sm font-extrabold text-[#00847A]">{c.prendas} <span className="text-[10px] font-semibold text-[#6B6B6B]">prendas</span></span>
                      <span className="text-sm font-bold text-[#15803D] w-24">{pesos(c.vendido)}</span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#F0F0F0] overflow-hidden">
                    <div className="h-full rounded-full bg-[#00A89D]" style={{ width: `${(c.prendas / maxPrendas) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

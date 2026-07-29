'use client';

import { useCallback, useEffect, useState } from 'react';

interface Fila {
  telefono: string; nombre: string; ventas: number | null;
  promedioSeg: number | null; tasa: number | null;
  respondidas: number; preguntas: number;
  estado: 'activo' | 'lento' | 'sin-responder';
  ultimaActualizacion: string | null;
  promedioNominaSeg: number | null; nominaRespondidas: number; ganaDescuento: boolean;
}
interface Resumen { totalVentas: number; reportaron: number; activos: number; equipo: number; ganadores: number; }

const ESTILO_ESTADO: Record<Fila['estado'], { texto: string; color: string; fondo: string; punto: string }> = {
  'activo':        { texto: 'Activo',        color: '#15803D', fondo: 'rgba(21,128,61,0.10)',  punto: '#22C55E' },
  'lento':         { texto: 'Lento',         color: '#C2410C', fondo: 'rgba(234,88,12,0.10)',  punto: '#F59E0B' },
  'sin-responder': { texto: 'Sin responder', color: '#B91C1C', fondo: 'rgba(185,28,28,0.10)',  punto: '#EF4444' },
};

function tiempoLegible(seg: number | null): string {
  if (seg == null) return '—';
  if (seg < 60) return `${seg}s`;
  const min = Math.round(seg / 60);
  if (min < 60) return `${min} min`;
  return `${(min / 60).toFixed(1)} h`;
}

export default function VendedoresPanel() {
  const nowCol = new Date(Date.now() - 5 * 3_600_000);
  const hoy = nowCol.toISOString().slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  const ym  = `${nowCol.getUTCFullYear()}-${pad(nowCol.getUTCMonth() + 1)}`;
  const finMes = new Date(Date.UTC(nowCol.getUTCFullYear(), nowCol.getUTCMonth() + 1, 0)).getUTCDate();

  // Nóminas del mes: 1–10, 11–20, 21–fin. Más el día actual.
  const RANGOS: Record<string, { label: string; desde: string; hasta: string }> = {
    hoy: { label: 'Hoy',                 desde: hoy,           hasta: hoy },
    n1:  { label: `Nómina 1 (1–10)`,     desde: `${ym}-01`,    hasta: `${ym}-10` },
    n2:  { label: `Nómina 2 (11–20)`,    desde: `${ym}-11`,    hasta: `${ym}-20` },
    n3:  { label: `Nómina 3 (21–fin)`,   desde: `${ym}-21`,    hasta: `${ym}-${pad(finMes)}` },
  };

  const [periodo, setPeriodo]   = useState<'hoy' | 'n1' | 'n2' | 'n3'>('hoy');
  const [ranking, setRanking]   = useState<Fila[]>([]);
  const [resumen, setResumen]   = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = RANGOS[periodo];
      const res  = await fetch(`/api/vendedores/ranking?desde=${r.desde}&hasta=${r.hasta}`, { cache: 'no-store' });
      const data = await res.json();
      setRanking(data.ranking ?? []);
      setResumen(data.resumen ?? null);
    } finally { setCargando(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  useEffect(() => { cargar(); }, [cargar]);
  // Auto-refresca cada 60s para ver los reportes entrando en vivo
  useEffect(() => {
    const t = setInterval(cargar, 60_000);
    return () => clearInterval(t);
  }, [cargar]);

  return (
    <div className="panel-scroll flex-1 h-full overflow-y-auto bg-[#F8F8F8]">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
        <h1 className="text-2xl font-extrabold text-[#0D0D0D]">Vendedores</h1>
        <p className="text-sm text-[#6B6B6B] mb-5">
          Ranking del equipo en vivo. El bot les pregunta las ventas cada 2h (8am–7pm) y guarda el último número reportado.
        </p>

        {/* Filtros: día actual + las 3 nóminas del mes */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(['hoy', 'n1', 'n2', 'n3'] as const).map(k => (
            <button
              key={k}
              onClick={() => setPeriodo(k)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                periodo === k
                  ? 'bg-[#00A89D] text-white border-[#00A89D] shadow'
                  : 'bg-white text-[#6B6B6B] border-[#E8E8E8] hover:border-[#00A89D]'
              }`}
            >{RANGOS[k].label}</button>
          ))}
          <span className="text-[11px] text-[#9A9A9A] ml-1">
            {RANGOS[periodo].desde === RANGOS[periodo].hasta
              ? RANGOS[periodo].desde
              : `${RANGOS[periodo].desde} → ${RANGOS[periodo].hasta}`}
          </span>
          <button onClick={cargar} className="w-8 h-8 rounded-lg text-[#00A89D] hover:bg-[#00A89D]/10">⟳</button>
        </div>

        {resumen && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-4">
              <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">Total ventas</p>
              <p className="text-2xl font-extrabold text-[#15803D]">{resumen.totalVentas}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-4">
              <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">Reportaron</p>
              <p className="text-2xl font-extrabold text-[#0D0D0D]">{resumen.reportaron}/{resumen.equipo}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-4">
              <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">Activos</p>
              <p className="text-2xl font-extrabold text-[#22C55E]">{resumen.activos}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-4">
              <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">🏅 Ganan 5% dcto</p>
              <p className="text-2xl font-extrabold text-[#D97706]">{resumen.ganadores}</p>
            </div>
          </div>
        )}

        <div className="mb-4 rounded-xl bg-[#FFF9E8] border border-[#F0C674] px-4 py-2.5 text-[12px] text-[#8A6D00]">
          🎁 <b>Incentivo:</b> promedio de respuesta menor a <b>1h 30m</b> en el periodo de nómina (cada 10 días) = <b>5% de descuento en el costo de sus campañas</b>. El tiempo cuenta desde que se envía el mensaje hasta que responden.
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-hidden">
          <div className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-[#FAFAFA] border-b border-[#EEE] text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wide">
            <span className="w-8 text-center">#</span>
            <span className="flex-1">Vendedor</span>
            <span className="w-20 text-center">Ventas</span>
            <span className="w-24 text-center">Resp. prom.</span>
            <span className="w-24 text-center">Nómina 10d</span>
            <span className="w-28 text-center">Incentivo</span>
            <span className="w-28 text-center">Estado</span>
          </div>

          {cargando && ranking.length === 0 ? (
            <p className="text-sm text-[#6B6B6B] py-12 text-center">Cargando…</p>
          ) : (
            <div className="divide-y divide-[#F4F4F4]">
              {ranking.map((r, i) => {
                const est = ESTILO_ESTADO[r.estado];
                return (
                  <div key={r.telefono} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-8 text-center text-sm font-extrabold text-[#9A9A9A]">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{r.nombre}</p>
                      <p className="text-[10px] text-[#9A9A9A] md:hidden">
                        {r.ventas ?? '—'} ventas · {tiempoLegible(r.promedioSeg)} · {r.respondidas}/{r.preguntas}
                      </p>
                    </div>
                    <span className="hidden md:block w-20 text-center text-lg font-extrabold text-[#15803D]">
                      {r.ventas ?? '—'}
                    </span>
                    <span className="hidden md:block w-24 text-center text-xs font-semibold text-[#6B6B6B]">
                      {tiempoLegible(r.promedioSeg)}
                    </span>
                    <span className="hidden md:block w-24 text-center text-xs font-semibold" style={{ color: r.ganaDescuento ? '#15803D' : '#6B6B6B' }}>
                      {tiempoLegible(r.promedioNominaSeg)}
                    </span>
                    <span className="hidden md:flex w-28 justify-center">
                      {r.ganaDescuento ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-[#D97706] bg-[rgba(217,119,6,0.12)]">🏅 5% dcto</span>
                      ) : (
                        <span className="text-[10px] text-[#B0B0B0]">—</span>
                      )}
                    </span>
                    <span className="w-28 flex justify-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ color: est.color, background: est.fondo }}>
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: est.punto, display: 'inline-block' }} />
                        {est.texto}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <p className="text-[11px] text-[#9A9A9A] mt-3">
          <b>Ventas</b> = último número que reportó ese día (no se suma) · <b>Resp. prom.</b> = qué tan rápido contesta ·
          <b> Respondió</b> = de cuántos cortes contestó. El estado mide si está activo en las ventas.
        </p>
      </div>
    </div>
  );
}

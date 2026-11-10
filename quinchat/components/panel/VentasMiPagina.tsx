'use client';

import { useEffect, useState } from 'react';

/**
 * Contador de ventas de «Mi Página» (10-nov-2026, dueño): arriba del editor.
 * Hoy (ventas y prendas), total del período, barras por día y RANKING de embudos (el que más vende, primero).
 * Solo lee /api/mi-pagina/ventas. Se actualiza solo cada 2 min.
 */
interface Cifras { ventas: number; pedidos: number; prendas: number }
interface Datos { dias: number; origen: string; hoy: Cifras; total: Cifras; por_dia: (Cifras & { dia: string })[]; ranking: (Cifras & { slug: string; nombre: string; foto: string | null })[] }

const VERDE = '#00A895';
const fechaCorta = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });

export default function VentasMiPagina() {
  const [dias, setDias] = useState(7);
  const [origen, setOrigen] = useState<'pagina' | 'todos'>('pagina');
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState(false);

  useEffect(() => {
    let vivo = true;
    const traer = () => fetch(`/api/mi-pagina/ventas?dias=${dias}&origen=${origen}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (!vivo) return; if (j.error) setError(j.error); else { setD(j); setError(null); } })
      .catch(() => vivo && setError('No se pudieron leer las ventas'));
    traer();
    const t = setInterval(() => { if (document.visibilityState === 'visible') traer(); }, 120_000);
    return () => { vivo = false; clearInterval(t); };
  }, [dias, origen]);

  const maxDia = Math.max(1, ...(d?.por_dia ?? []).map(x => x.prendas));
  const maxRank = Math.max(1, ...(d?.ranking ?? []).map(x => x.ventas));
  const lista = (d?.ranking ?? []).filter(r => r.pedidos > 0);
  const visibles = verTodos ? lista : lista.slice(0, 6);
  const Boton = ({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${activo ? 'text-white' : 'text-[#1F2A28] hover:bg-[#F4F7F6]'}`} style={activo ? { background: VERDE } : {}}>{children}</button>
  );

  return (
    <div className="bg-white rounded-2xl border border-[#E8ECEB] shadow-sm p-5 mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-lg font-extrabold text-[#0D1F1C] flex-1">📈 Ventas {origen === 'pagina' ? 'por Mi Página' : 'de todos los embudos'}</p>
        <div className="flex items-center gap-1 rounded-xl border border-[#E1E5E4] p-1">
          <Boton activo={origen === 'pagina'} onClick={() => setOrigen('pagina')}>🖥️ Solo Mi Página</Boton>
          <Boton activo={origen === 'todos'} onClick={() => setOrigen('todos')}>🚀 Todos los embudos</Boton>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[#E1E5E4] p-1">
          {[1, 7, 30].map(n => <Boton key={n} activo={dias === n} onClick={() => setDias(n)}>{n === 1 ? 'Hoy' : `${n} días`}</Boton>)}
        </div>
      </div>

      {error && <p className="mt-3 text-[12px] text-[#B42318]">{error}</p>}
      {!d ? <p className="mt-4 text-sm text-[#6B6B6B]">Contando ventas…</p> : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-3">
            {/* Hoy */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl p-3 text-white" style={{ background: VERDE }}>
                <p className="text-[11px] font-bold opacity-90">VENTAS HOY</p>
                <p className="text-3xl font-extrabold leading-tight">{d.hoy.ventas}</p>
              </div>
              <div className="rounded-xl p-3 bg-[#0D1F1C] text-white">
                <p className="text-[11px] font-bold opacity-80">PRENDAS HOY</p>
                <p className="text-3xl font-extrabold leading-tight">{d.hoy.prendas}</p>
              </div>
              <div className="rounded-xl p-3 bg-[#F4F7F6]">
                <p className="text-[11px] font-bold text-[#5B6B68]">PEDIDOS HOY</p>
                <p className="text-3xl font-extrabold leading-tight text-[#0D1F1C]">{d.hoy.pedidos}</p>
                <p className="text-[10px] text-[#7A8A87]">con y sin confirmar</p>
              </div>
            </div>
            {dias > 1 && (
              <div className="rounded-xl border border-[#E8ECEB] p-3">
                <p className="text-[12px] font-bold text-[#1F2A28]">Últimos {dias} días: <span style={{ color: VERDE }}>{d.total.ventas} ventas</span> · {d.total.prendas} prendas · {d.total.pedidos} pedidos</p>
                {/* Barras por día (prendas) */}
                <div className="mt-2 flex items-end gap-1 h-24">
                  {d.por_dia.map(x => (
                    <div key={x.dia} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${fechaCorta(x.dia)}: ${x.ventas} ventas · ${x.prendas} prendas · ${x.pedidos} pedidos`}>
                      <span className="text-[9px] font-bold text-[#1F2A28]">{x.prendas || ''}</span>
                      <div className="w-full rounded-t" style={{ height: `${Math.max(3, (x.prendas / maxDia) * 100)}%`, background: x.prendas ? VERDE : '#E8ECEB' }} />
                      {dias <= 7 && <span className="text-[9px] text-[#7A8A87] mt-0.5 truncate">{fechaCorta(x.dia)}</span>}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[#7A8A87] mt-1">Barras = prendas vendidas por día (ventas confirmadas).</p>
              </div>
            )}
            {origen === 'pagina' && d.total.pedidos === 0 && (
              <p className="text-[11px] text-[#7A8A87]">Aún no hay pedidos que hayan entrado desde Mi Página en este período. Se cuentan los que llegan por el botón «Ver producto» de la tienda.</p>
            )}
          </div>

          {/* Ranking de embudos */}
          <div className="rounded-xl border border-[#E8ECEB] p-3">
            <p className="text-[12px] font-bold text-[#1F2A28] mb-2">🏆 Embudos que más venden {dias === 1 ? 'hoy' : `(${dias} días)`}</p>
            {!lista.length ? <p className="text-[12px] text-[#7A8A87]">Sin ventas todavía.</p> : (
              <div className="space-y-1.5">
                {visibles.map((r, k) => (
                  <div key={r.slug} className="flex items-center gap-2">
                    <span className="w-6 text-center text-sm font-extrabold">{k === 0 ? '🥇' : k === 1 ? '🥈' : k === 2 ? '🥉' : k + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.foto ? <img src={r.foto} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" /> : <span className="w-8 h-8 rounded-lg bg-[#F4F7F6] shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate text-[#0D1F1C]" title={r.slug}>{r.nombre}</p>
                      <div className="h-1.5 rounded-full bg-[#F1F5F4] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(r.ventas / maxRank) * 100}%`, background: k === 0 ? '#D4A017' : VERDE }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-extrabold text-[#0D1F1C]">{r.ventas} <span className="text-[10px] font-semibold text-[#5B6B68]">ventas</span></p>
                      <p className="text-[10px] text-[#5B6B68]">{r.prendas} prendas · {r.pedidos} pedidos</p>
                    </div>
                  </div>
                ))}
                {lista.length > 6 && (
                  <button onClick={() => setVerTodos(v => !v)} className="text-[11px] font-bold mt-1" style={{ color: VERDE }}>
                    {verTodos ? 'Ver menos' : `Ver los ${lista.length} embudos`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ───────────── tipos ─────────────
type Estado = 'pendiente' | 'confirmado' | 'cancelado';
interface Pedido {
  id: number; numero: string; fecha: string; live_slug: string; live_titulo: string;
  foto: string | null; producto: string; talla: string; color: string; cantidad: number;
  cliente: string; celular: string; ciudad: string; departamento: string; direccion: string;
  valor: number; pago: string; estado: Estado;
}
interface Kpis { hoy: number; mes: number; valor: number; prendas: number; pendientes: number; confirmados: number }

const peso = (n: number) => `$${(Number(n) || 0).toLocaleString('es-CO')}`;
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });

export const ESTADO_UI: Record<Estado, { txt: string; cls: string }> = {
  pendiente:  { txt: 'Pendiente',  cls: 'bg-amber-100 text-amber-800' },
  confirmado: { txt: 'Confirmado', cls: 'bg-emerald-100 text-emerald-700' },
  cancelado:  { txt: 'Cancelado',  cls: 'bg-red-100 text-red-700' },
};

export default function VentasLive({ onVolver }: { onVolver: () => void }) {
  const [lives, setLives] = useState<{ slug: string; titulo: string }[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(0);
  const [page, setPage] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Pedido | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // filtros
  const [desde, setDesde] = useState(''); const [hasta, setHasta] = useState('');
  const [live, setLive] = useState(''); const [estado, setEstado] = useState('');
  const [ciudad, setCiudad] = useState(''); const [producto, setProducto] = useState('');
  const [pago, setPago] = useState(''); const [q, setQ] = useState('');

  const params = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    const add = (k: string, v: string) => { if (v.trim()) p.set(k, v.trim()); };
    add('desde', desde); add('hasta', hasta); add('live', live); add('estado', estado);
    add('ciudad', ciudad); add('producto', producto); add('pago', pago); add('q', q);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  }, [desde, hasta, live, estado, ciudad, producto, pago, q]);

  const cargar = useCallback(async (pg: number) => {
    setCargando(true); setError(null);
    try {
      const r = await fetch(`/api/live-admin/ventas?${params({ page: String(pg) })}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'error');
      setLives(j.lives ?? []); setKpis(j.kpis); setPedidos(j.pedidos ?? []);
      setTotal(j.total ?? 0); setPaginas(j.paginas ?? 0);
    } catch (e: any) { setError(e.message); }
    setCargando(false);
  }, [params]);

  // Recarga con pequeña espera al escribir (debounce) y vuelve a la página 1 al cambiar filtros
  const primera = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); cargar(1); }, primera.current ? 0 : 350);
    primera.current = false;
    return () => clearTimeout(t);
  }, [cargar]);

  const irPagina = (pg: number) => { setPage(pg); cargar(pg); };
  const limpiar = () => { setDesde(''); setHasta(''); setLive(''); setEstado(''); setCiudad(''); setProducto(''); setPago(''); setQ(''); };

  const cambiarEstado = async (p: Pedido, accion: 'cancelar' | 'restaurar') => {
    if (accion === 'cancelar' && !confirm(`¿Cancelar el pedido de ${p.cliente}?`)) return;
    try {
      const r = await fetch('/api/pedidos/accion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, ids: [p.id] }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'error');
      setAviso(accion === 'cancelar' ? 'Pedido cancelado' : 'Pedido reactivado (queda por confirmar)');
      setTimeout(() => setAviso(null), 2500);
      setDetalle(null); cargar(page);
    } catch (e: any) { setAviso('Error: ' + e.message); setTimeout(() => setAviso(null), 3000); }
  };

  const exportar = async () => {
    try {
      const r = await fetch(`/api/live-admin/ventas?${params({ todo: '1' })}`, { cache: 'no-store' });
      const j = await r.json();
      const filas: Pedido[] = j.pedidos ?? [];
      const cab = ['Fecha', 'Pedido', 'Live', 'Producto', 'Talla', 'Color', 'Cantidad', 'Cliente', 'Celular', 'Ciudad', 'Departamento', 'Dirección', 'Valor', 'Pago', 'Estado'];
      const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [cab.join(';'), ...filas.map(p => [fechaHora(p.fecha), p.numero, p.live_titulo, p.producto, p.talla, p.color, p.cantidad, p.cliente, p.celular, p.ciudad, p.departamento, p.direccion, p.valor, p.pago, ESTADO_UI[p.estado].txt].map(esc).join(';'))].join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ventas-live-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch { setAviso('No se pudo exportar'); setTimeout(() => setAviso(null), 2500); }
  };

  const wa = (cel: string) => `https://wa.me/57${cel.replace(/\D/g, '').slice(-10)}`;
  const campo = 'w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm';

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto bg-brand-ivory p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <button onClick={onVolver} className="text-sm text-[#00A89D] font-semibold mb-3">← Volver a Live Shopping</button>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-[#00A89D] text-white flex items-center justify-center text-xl shadow">🛍️</span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-brand-black">Ventas Live Shopping</h1>
              <p className="text-sm text-brand-gray-mid">Consulta, filtra y administra los pedidos generados desde tus lives.</p>
            </div>
          </div>
          <button onClick={exportar} className="px-4 py-2 rounded-xl text-sm font-semibold border border-brand-border bg-white hover:bg-brand-gray-light">⬇️ Exportar reporte</button>
        </div>

        {aviso && <div className="mb-3 text-sm bg-[#00A89D] text-white rounded-lg px-3 py-2">{aviso}</div>}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          {[
            { t: 'Pedidos de hoy', v: kpis?.hoy ?? '—', c: 'text-brand-black' },
            { t: 'Pedidos del mes', v: kpis?.mes ?? '—', c: 'text-brand-black' },
            { t: 'Valor vendido', v: kpis ? peso(kpis.valor) : '—', c: 'text-[#00847A]' },
            { t: 'Prendas vendidas', v: kpis?.prendas ?? '—', c: 'text-brand-black' },
            { t: 'Pendientes', v: kpis?.pendientes ?? '—', c: 'text-amber-600' },
            { t: 'Confirmados', v: kpis?.confirmados ?? '—', c: 'text-emerald-600' },
          ].map(k => (
            <div key={k.t} className="bg-white border border-brand-border rounded-2xl p-3.5 shadow-sm">
              <p className="text-[11px] font-semibold text-brand-gray-mid uppercase tracking-wide">{k.t}</p>
              <p className={`text-xl font-extrabold mt-1 ${k.c}`}>{k.v}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-brand-gray-mid -mt-3 mb-4">Hoy y mes: todos tus lives. Valor, prendas y estados: según los filtros. Los cancelados no suman al valor.</p>

        {/* Filtros */}
        <div className="bg-white border border-brand-border rounded-2xl p-4 mb-4 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="text-xs font-semibold text-brand-black col-span-2 md:col-span-2">Buscar
              <input className={campo} placeholder="Pedido, cliente o celular" value={q} onChange={e => setQ(e.target.value)} /></label>
            <label className="text-xs font-semibold text-brand-black">Desde<input type="date" className={campo} value={desde} onChange={e => setDesde(e.target.value)} /></label>
            <label className="text-xs font-semibold text-brand-black">Hasta<input type="date" className={campo} value={hasta} onChange={e => setHasta(e.target.value)} /></label>
            <label className="text-xs font-semibold text-brand-black">Live
              <select className={campo} value={live} onChange={e => setLive(e.target.value)}>
                <option value="">Todos</option>
                {lives.map(l => <option key={l.slug} value={l.slug}>{l.titulo}</option>)}
              </select></label>
            <label className="text-xs font-semibold text-brand-black">Estado
              <select className={campo} value={estado} onChange={e => setEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="confirmado">Confirmado</option>
                <option value="cancelado">Cancelado</option>
              </select></label>
            <label className="text-xs font-semibold text-brand-black">Producto<input className={campo} placeholder="ej. Yamaha" value={producto} onChange={e => setProducto(e.target.value)} /></label>
            <label className="text-xs font-semibold text-brand-black">Ciudad<input className={campo} placeholder="ej. Cali" value={ciudad} onChange={e => setCiudad(e.target.value)} /></label>
            <label className="text-xs font-semibold text-brand-black">Método de pago
              <select className={campo} value={pago} onChange={e => setPago(e.target.value)}>
                <option value="">Todos</option>
                <option value="Contraentrega">Contraentrega</option>
                <option value="Abono + contraentrega">Abono + contraentrega</option>
              </select></label>
            <div className="flex items-end">
              <button onClick={limpiar} className="w-full px-3 py-2 rounded-lg text-sm font-semibold border border-brand-border hover:bg-brand-gray-light">Limpiar filtros</button>
            </div>
          </div>
        </div>

        {error && <div className="mb-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">No se pudieron cargar las ventas: {error}</div>}

        {/* Tabla (escritorio) */}
        <div className="hidden md:block bg-white border border-brand-border rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-gray-light text-[11px] uppercase tracking-wide text-brand-gray-mid">
                <tr>
                  {['Fecha', 'Pedido', 'Live', 'Producto', 'Talla / Color', 'Cant.', 'Cliente', 'Ciudad', 'Total', 'Pago', 'Estado', ''].map(h => <th key={h} className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {pedidos.map(p => (
                  <tr key={p.id} className="border-t border-brand-border hover:bg-[#F7FBFA]">
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-brand-gray-mid">{fechaHora(p.fecha)}</td>
                    <td className="px-3 py-2.5 text-xs font-mono max-w-[120px] truncate" title={p.numero}>{p.numero}</td>
                    <td className="px-3 py-2.5 text-xs max-w-[120px] truncate">{p.live_titulo}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 max-w-[240px]">
                        {p.foto ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.foto} alt="" className="w-10 h-10 rounded-lg object-cover bg-neutral-100 shrink-0" /> : <span className="w-10 h-10 rounded-lg bg-neutral-100 shrink-0" />}
                        <span className="text-xs font-semibold leading-tight line-clamp-2">{p.producto}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs max-w-[140px]">{p.talla}{p.color ? <span className="text-brand-gray-mid"> · {p.color}</span> : null}</td>
                    <td className="px-3 py-2.5 text-xs text-center">{p.cantidad}</td>
                    <td className="px-3 py-2.5 text-xs"><p className="font-semibold">{p.cliente}</p><p className="text-brand-gray-mid">{p.celular}</p></td>
                    <td className="px-3 py-2.5 text-xs">{p.ciudad}</td>
                    <td className="px-3 py-2.5 text-xs font-bold whitespace-nowrap">{peso(p.valor)}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{p.pago}</td>
                    <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ESTADO_UI[p.estado].cls}`}>{ESTADO_UI[p.estado].txt}</span></td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex gap-1">
                        <button onClick={() => setDetalle(p)} title="Ver detalles" className="w-8 h-8 rounded-lg border border-brand-border hover:bg-brand-gray-light">👁️</button>
                        <a href={wa(p.celular)} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-8 h-8 rounded-lg border border-brand-border hover:bg-brand-gray-light flex items-center justify-center">💬</a>
                        {p.live_slug && <a href={`/live/${p.live_slug}`} target="_blank" rel="noopener noreferrer" title="Ver live de origen" className="w-8 h-8 rounded-lg border border-brand-border hover:bg-brand-gray-light flex items-center justify-center">🎬</a>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!cargando && pedidos.length === 0 && <p className="p-6 text-center text-sm text-brand-gray-mid">No hay ventas con estos filtros.</p>}
        </div>

        {/* Tarjetas (celular) */}
        <div className="md:hidden space-y-2">
          {pedidos.map(p => (
            <button key={p.id} onClick={() => setDetalle(p)} className="w-full text-left bg-white border border-brand-border rounded-2xl p-3 flex gap-3 shadow-sm">
              {p.foto ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.foto} alt="" className="w-14 h-14 rounded-xl object-cover bg-neutral-100 shrink-0" /> : <span className="w-14 h-14 rounded-xl bg-neutral-100 shrink-0" />}
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{peso(p.valor)}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ESTADO_UI[p.estado].cls}`}>{ESTADO_UI[p.estado].txt}</span>
                </span>
                <span className="block text-xs font-semibold truncate">{p.producto}</span>
                <span className="block text-[11px] text-brand-gray-mid truncate">{p.cliente} · {p.ciudad} · {fechaHora(p.fecha)}</span>
              </span>
            </button>
          ))}
          {!cargando && pedidos.length === 0 && <p className="p-6 text-center text-sm text-brand-gray-mid">No hay ventas con estos filtros.</p>}
        </div>

        {cargando && <p className="text-sm text-brand-gray-mid mt-3">Cargando ventas…</p>}

        {/* Paginación */}
        {paginas > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 mb-8">
            <button disabled={page <= 1} onClick={() => irPagina(page - 1)} className="px-3 py-1.5 rounded-lg border border-brand-border bg-white text-sm disabled:opacity-40">← Anterior</button>
            <span className="text-sm text-brand-gray-mid">Página {page} de {paginas} · {total} pedidos</span>
            <button disabled={page >= paginas} onClick={() => irPagina(page + 1)} className="px-3 py-1.5 rounded-lg border border-brand-border bg-white text-sm disabled:opacity-40">Siguiente →</button>
          </div>
        )}
      </div>

      {/* Detalle del pedido */}
      {detalle && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDetalle(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-brand-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-brand-black">Pedido {detalle.numero}</h3>
                <p className="text-xs text-brand-gray-mid">{fechaHora(detalle.fecha)} · {detalle.live_titulo}</p>
              </div>
              <button onClick={() => setDetalle(null)} className="w-8 h-8 rounded-full hover:bg-brand-gray-light text-lg">×</button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex gap-3">
                {detalle.foto ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={detalle.foto} alt="" className="w-20 h-20 rounded-xl object-cover bg-neutral-100" /> : null}
                <div>
                  <p className="font-semibold">{detalle.producto}</p>
                  <p className="text-xs text-brand-gray-mid">Talla: {detalle.talla || '—'}{detalle.color ? ` · Color: ${detalle.color}` : ''}</p>
                  <p className="text-xs text-brand-gray-mid">Cantidad: {detalle.cantidad}</p>
                  <p className="font-bold mt-1">{peso(detalle.valor)} <span className="text-xs font-normal text-brand-gray-mid">· {detalle.pago}</span></p>
                </div>
              </div>
              <div className="bg-brand-gray-light rounded-xl p-3 text-xs space-y-0.5">
                <p><b>Cliente:</b> {detalle.cliente}</p>
                <p><b>Celular:</b> {detalle.celular}</p>
                <p><b>Dirección:</b> {detalle.direccion}</p>
                <p><b>Ciudad:</b> {detalle.ciudad}{detalle.departamento ? `, ${detalle.departamento}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">Estado:</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${ESTADO_UI[detalle.estado].cls}`}>{ESTADO_UI[detalle.estado].txt}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <a href={wa(detalle.celular)} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#25D366] text-white">💬 WhatsApp</a>
                {detalle.live_slug && <a href={`/live/${detalle.live_slug}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg text-xs font-semibold border border-brand-border">🎬 Ver live</a>}
                {detalle.estado === 'cancelado'
                  ? <button onClick={() => cambiarEstado(detalle, 'restaurar')} className="px-3 py-2 rounded-lg text-xs font-semibold border border-brand-border">↩️ Reactivar</button>
                  : <button onClick={() => cambiarEstado(detalle, 'cancelar')} className="px-3 py-2 rounded-lg text-xs font-semibold text-red-600 border border-red-200">✖️ Cancelar pedido</button>}
              </div>
              <p className="text-[11px] text-brand-gray-mid">La confirmación la sigue haciendo el flujo de siempre (bot / Pedidos). Aquí solo puedes cancelar o reactivar.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

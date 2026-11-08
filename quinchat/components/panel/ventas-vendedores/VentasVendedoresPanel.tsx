'use client';

/**
 * MÓDULO "VENTAS VENDEDORES" (prueba) — Cola de Preventas estilo Klixmsoft.
 * Todo el módulo vive en esta carpeta + lib/ventas-vendedores + app/api/ventas-vendedores.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PESTANAS, type Pestana } from '@/lib/ventas-vendedores/estados';
import AjustesVV from './AjustesVV';
import DetalleVenta from './DetalleVenta';

import { PildoraEstado, pesos, fechaCorta, telBonito, type VentaVV } from './comun';

const IcoWA = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z" />
  </svg>
);

export default function VentasVendedoresPanel({ onAbrirChat }: { onAbrirChat?: (id: string) => void }) {
  const [pestana, setPestana] = useState<Pestana>('todas');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [verFiltros, setVerFiltros] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [orden, setOrden] = useState<'desc' | 'asc'>('desc');
  const [vendedor, setVendedor] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [tipo, setTipo] = useState('');
  const [qa, setQa] = useState(true);
  const [datos, setDatos] = useState<{ ventas: VentaVV[]; contadores: Record<string, number>; indicadores: any; opciones: any } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [verAjustes, setVerAjustes] = useState(false);
  const [moduloActivo, setModuloActivo] = useState<boolean | null>(null);

  const cargar = useCallback(async () => {
    const qs = new URLSearchParams({ pestana, orden, qa: qa ? '1' : '0' });
    if (buscaAplicada) qs.set('q', buscaAplicada);
    if (desde) qs.set('desde', desde);
    if (hasta) qs.set('hasta', hasta);
    if (vendedor) qs.set('vendedor', vendedor);
    if (ciudad) qs.set('ciudad', ciudad);
    if (tipo) qs.set('tipo', tipo);
    try {
      const r = await fetch(`/api/ventas-vendedores?${qs}`, { cache: 'no-store' });
      if (r.ok) setDatos(await r.json());
    } finally { setCargando(false); }
  }, [pestana, orden, qa, buscaAplicada, desde, hasta, vendedor, ciudad, tipo]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const t = setInterval(() => { if (!abierta) cargar(); }, 30_000);
    return () => clearInterval(t);
  }, [cargar, abierta]);
  useEffect(() => {
    fetch('/api/ventas-vendedores/ajustes', { cache: 'no-store' }).then(r => r.json()).then(j => setModuloActivo(!!j?.ajustes?.activo)).catch(() => {});
  }, [verAjustes]);

  const nFiltros = [desde, hasta, vendedor, ciudad, tipo].filter(Boolean).length + (orden === 'asc' ? 1 : 0);
  const ind = datos?.indicadores ?? { preventas: 0, totalNeto: 0, unidades: 0, pendientes: 0, errores: 0 };
  const ventas = useMemo(() => datos?.ventas ?? [], [datos]);

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#F6F6F4] text-[#141414]">
      <div className="w-full max-w-[1280px] mx-auto px-3 sm:px-5 py-5">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3 mb-4 pl-10 md:pl-0 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Ventas Vendedores</h1>
            <p className="text-[12px] text-[#5E5E5A]">Cola de preventas que llegan por WhatsApp de los vendedores · <b>módulo de prueba</b></p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${moduloActivo ? 'bg-[#E0F3E8] text-[#14804A]' : 'bg-[#ECECE8] text-[#6A6A66]'}`}>
              {moduloActivo == null ? '…' : moduloActivo ? '● Módulo encendido' : '○ Módulo apagado'}
            </span>
            <button onClick={() => setVerAjustes(true)} className="h-9 px-3 rounded-xl border border-[#E7E6E1] bg-white text-[13px] font-semibold hover:bg-[#F1F1EF]">⚙️ Ajustes</button>
            <button onClick={() => cargar()} className="h-9 w-9 rounded-xl border border-[#E7E6E1] bg-white hover:bg-[#F1F1EF]" title="Recargar">⟳</button>
          </div>
        </div>

        {/* Indicadores */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { t: 'Preventas', v: String(ind.preventas), ico: '☰', c: '#A5791F', f: '#F7EEDA' },
            { t: 'Total neto', v: pesos(ind.totalNeto), ico: '$', c: '#A5791F', f: '#F7EEDA' },
            { t: 'Unidades', v: String(ind.unidades), ico: '🏷', c: '#A5791F', f: '#F7EEDA' },
            { t: 'Pendientes / incidencias', v: `${ind.pendientes} / ${ind.errores}`, ico: '!', c: '#B42318', f: '#FCE4E1' },
          ].map(k => (
            <div key={k.t} className="bg-white rounded-2xl border border-[#E7E6E1] px-4 py-3 flex items-center gap-3 shadow-[0_1px_2px_rgba(20,20,20,.04)]">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] font-bold shrink-0" style={{ background: k.f, color: k.c }}>{k.ico}</span>
              <div className="min-w-0">
                <p className="text-[11px] text-[#5E5E5A] leading-tight">{k.t}</p>
                <p className="text-[18px] font-extrabold leading-tight truncate">{k.v}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-[#E7E6E1] shadow-[0_1px_2px_rgba(20,20,20,.04),0_4px_14px_rgba(20,20,20,.05)]">
          <div className="p-4 sm:p-5 border-b border-[#EFEEEA]">
            {/* Pestañas */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {PESTANAS.map(p => {
                const activa = pestana === p.key;
                const n = datos?.contadores?.[p.key] ?? 0;
                return (
                  <button key={p.key} onClick={() => setPestana(p.key)}
                    className={`shrink-0 h-9 pl-3.5 pr-1.5 rounded-full text-[13px] font-semibold flex items-center gap-2 border transition-colors ${activa ? 'border-transparent' : 'border-[#E7E6E1]'}`}
                    style={activa ? { background: p.key === 'todas' || p.key === 'atender' ? '#141414' : p.color, color: '#fff' } : { background: p.key === 'todas' || p.key === 'atender' ? '#fff' : p.fondo, color: p.key === 'todas' || p.key === 'atender' ? '#141414' : p.color }}>
                    {p.label}
                    <span className={`min-w-[24px] h-6 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${activa ? 'bg-white text-[#141414]' : 'bg-white/90 text-[#141414]'}`}>{n}</span>
                  </button>
                );
              })}
            </div>

            {/* Buscador */}
            <form onSubmit={e => { e.preventDefault(); setBuscaAplicada(busca.trim()); }}
              className="mt-3 flex items-center gap-2 h-12 pl-4 pr-1.5 rounded-2xl border border-[#E7E6E1] bg-[#FBFBFA] focus-within:border-[#C79A3B]">
              <span className="text-[#8B8B86]">⌕</span>
              <input value={busca} onChange={e => { setBusca(e.target.value); if (!e.target.value) setBuscaAplicada(''); }}
                placeholder="Buscar cliente, celular, código, catálogo, SKU, vendedor, remisión…"
                className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[#8B8B86]" />
              <button type="submit" className="w-10 h-10 rounded-xl bg-[#A5791F] hover:bg-[#8E6819] text-white text-lg" aria-label="Buscar">⌕</button>
            </form>

            {/* Filtros y orden */}
            <button onClick={() => setVerFiltros(v => !v)} className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[#5E5E5A]">
              ☰ Filtros y orden
              {nFiltros > 0 && <span className="w-5 h-5 rounded-full bg-[#141414] text-white text-[11px] flex items-center justify-center">{nFiltros}</span>}
              <span className="text-[10px]">{verFiltros ? '▲' : '▼'}</span>
            </button>
            {verFiltros && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[13px] text-[#5E5E5A] w-32">📅 Fecha de la venta</span>
                  <div className="inline-flex p-1 rounded-xl border border-[#E7E6E1] bg-[#F1F1EF]">
                    {(['asc', 'desc'] as const).map(o => (
                      <button key={o} onClick={() => setOrden(o)}
                        className={`px-3 h-8 rounded-lg text-[12.5px] font-semibold ${orden === o ? 'bg-[#141414] text-white' : 'text-[#5E5E5A]'}`}>
                        {o === 'asc' ? '↑ Más antiguas primero' : '↓ Más recientes primero'}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { setOrden('desc'); setDesde(''); setHasta(''); setVendedor(''); setCiudad(''); setTipo(''); }} className="text-[12px] text-[#8B8B86] hover:underline">Orden por defecto</button>
                </div>
                <div className="flex gap-3 flex-wrap">
                  {[
                    { l: 'Desde', v: desde, s: setDesde },
                    { l: 'Hasta', v: hasta, s: setHasta },
                  ].map(f => (
                    <label key={f.l} className="text-[12px] text-[#5E5E5A]">
                      <span className="block mb-1">{f.l}</span>
                      <input type="date" value={f.v} onChange={e => f.s(e.target.value)} className="h-10 px-3 rounded-xl border border-[#E7E6E1] text-[13px] bg-white" />
                    </label>
                  ))}
                  {[
                    { l: 'Vendedor', v: vendedor, s: setVendedor, ops: (datos?.opciones?.vendedores ?? []).map((x: any) => [x.tel, x.nombre]) },
                    { l: 'Ciudad', v: ciudad, s: setCiudad, ops: (datos?.opciones?.ciudades ?? []).map((x: string) => [x, x]) },
                    { l: 'Tipo de prenda', v: tipo, s: setTipo, ops: (datos?.opciones?.tipos ?? []).map((x: string) => [x, x]) },
                  ].map(f => (
                    <label key={f.l} className="text-[12px] text-[#5E5E5A]">
                      <span className="block mb-1">{f.l}</span>
                      <select value={f.v} onChange={e => f.s(e.target.value)} className="h-10 px-3 rounded-xl border border-[#E7E6E1] text-[13px] bg-white min-w-[150px]">
                        <option value="">Todos</option>
                        {f.ops.map(([val, txt]: string[]) => <option key={val} value={val}>{txt}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[13px] text-[#5E5E5A] cursor-pointer w-fit">
                  🧪 Mostrar ventas de QA (números de prueba)
                  <button type="button" onClick={() => setQa(v => !v)} className={`w-10 h-6 rounded-full relative transition-colors ${qa ? 'bg-[#14804A]' : 'bg-[#D9D8D3]'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${qa ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </label>
              </div>
            )}
          </div>

          {/* Tarjetas */}
          <div className="p-3 sm:p-4">
            {cargando ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl bg-[#F1F1EF] animate-pulse" />)}</div>
            ) : ventas.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[15px] font-semibold">No hay preventas en esta vista.</p>
                <p className="text-[12.5px] text-[#8B8B86] mt-1">
                  {moduloActivo ? 'Cuando un vendedor habilitado mande una venta por WhatsApp, aparecerá aquí.' : 'El módulo está apagado. Enciéndelo en ⚙️ Ajustes y agrega un número de prueba.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {ventas.map(v => <Tarjeta key={v.id} v={v} onVer={() => setAbierta(v.id)} onChat={() => onAbrirChat?.(v.vendedor_tel.startsWith('panel') && v.conversacion_id ? v.conversacion_id : v.vendedor_tel)} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {abierta && (
        <DetalleVenta id={abierta} onCerrar={() => setAbierta(null)} onCambio={cargar} onChat={tel => { setAbierta(null); onAbrirChat?.(tel); }} />
      )}
      {verAjustes && <AjustesVV onCerrar={() => { setVerAjustes(false); cargar(); }} />}
    </div>
  );
}

function Tarjeta({ v, onVer, onChat }: { v: VentaVV; onVer: () => void; onChat: () => void }) {
  const it = v.items[0];
  const foto = it?.foto_oficial || it?.foto_vendedor || v.fotos_vendedor?.[0];
  const unidades = v.items.reduce((s, i) => s + (i.cantidad || 0), 0);
  const extra = unidades - (it?.cantidad ?? 0);
  return (
    <article className="rounded-2xl border border-[#E7E6E1] bg-white shadow-[0_1px_2px_rgba(20,20,20,.04)] overflow-hidden">
      <div className="p-3 sm:p-4 flex gap-3">
        <div className="w-[92px] h-[104px] rounded-xl bg-[#F1F1EF] overflow-hidden shrink-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {foto ? <img src={foto} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="text-[11px] text-[#8B8B86] px-2 text-center">Sin foto</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <PildoraEstado estado={v.estado} />
              {v.es_prueba && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#ECECE8] text-[#6A6A66]">QA</span>}
              <h3 className="mt-1 text-[15px] font-extrabold leading-tight truncate">{v.cliente_nombre || 'Cliente sin nombre'}</h3>
              <p className="text-[12.5px] text-[#5E5E5A] truncate">📞 {telBonito(v.cliente_celular) || '—'}{v.municipio ? ` · ${v.municipio}` : ''}</p>
            </div>
            <button onClick={onChat} className="flex flex-col items-center shrink-0 text-[#14804A]" title="Abrir el chat del vendedor">
              <span className="w-10 h-10 rounded-full border-2 border-[#14804A] flex items-center justify-center hover:bg-[#E0F3E8]"><IcoWA /></span>
              <span className="text-[10px] font-semibold mt-0.5">Novedades</span>
            </button>
          </div>
          {it ? (
            <div className="mt-1.5">
              <p className="text-[13px] font-extrabold uppercase truncate">{it.catalogo || it.descripcion || 'Prenda sin identificar'}</p>
              <p className="text-[11px] text-[#8B8B86] font-mono truncate">Ref. {it.referencia || '—'}</p>
              <p className="text-[12px] text-[#5E5E5A]">Talla <b className="text-[#141414]">{it.talla || '—'}</b> · Color <b className="text-[#141414]">{it.color || '—'}</b></p>
              <p className="text-[11px] text-[#8B8B86] font-mono">{it.cantidad} × {pesos(it.precio)}{extra > 0 ? ` · +${extra} prenda${extra > 1 ? 's' : ''}` : ''}</p>
            </div>
          ) : <p className="mt-1.5 text-[12px] text-[#8B8B86]">Sin prendas todavía</p>}
        </div>
      </div>
      {v.effi_remision ? (
        <div className="px-4 pb-3 flex items-center justify-between gap-2">
          <span className="text-[12.5px] text-[#14804A]">🧾 Remisión en Effi <b>{v.effi_remision}</b></span>
          <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#E0F3E8] text-[#14804A]">Ver en Effi ↗</span>
        </div>
      ) : v.faltantes?.length > 0 && v.estado !== 'cancelada' ? (
        <p className="px-4 pb-3 text-[12px] text-[#B25E00] truncate">⚠️ Falta: {v.faltantes.join(' · ')}</p>
      ) : v.effi_estado === 'simulado' ? (
        <p className="px-4 pb-3 text-[12px] text-[#1F5FBF]">🧪 Solicitud a Effi armada (simulación, no enviada)</p>
      ) : null}
      <div className="border-t border-[#EFEEEA] px-4 py-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] text-[#8B8B86]">{fechaCorta(v.creado_at)} · {v.vendedor_nombre || v.vendedor_tel}</p>
          <p className="text-[18px] font-bold font-mono">{pesos(v.total)}</p>
        </div>
        <button onClick={onVer} className="h-10 px-4 rounded-xl border border-[#E7E6E1] text-[13px] font-bold hover:bg-[#F1F1EF]">Ver detalle ›</button>
      </div>
    </article>
  );
}

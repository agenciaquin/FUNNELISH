'use client';

/**
 * CENTRO MAESTRO EFFI (antes «Ventas Vendedores», rediseño 08-nov-2026).
 * Cola de preventas (de los vendedores por WhatsApp y de «Enviar al panel de Effi» del chat)
 * lista para revisar y subir a Effi. Toda la lógica sigue igual: lib/ventas-vendedores +
 * app/api/ventas-vendedores; aquí solo cambia la presentación y se agregan filtros.
 * Datos reales; se refresca solo cada 15 s.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PESTANAS, type Pestana } from '@/lib/ventas-vendedores/estados';
import AjustesVV from './AjustesVV';
import DetalleVenta from './DetalleVenta';
import { PildoraEstado, pesos, fechaCorta, telBonito, type VentaVV } from './comun';

const VERDE = '#0E8A7E';
const DORADO = '#A5791F';

const IcoWA = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z" />
  </svg>
);

type Datos = {
  ventas: VentaVV[]; contadores: Record<string, number>; indicadores: any; opciones: any;
  resumenHoy?: { fecha: string; enviadasHoy: number; enProceso: number; pendientes: number; errores: number; creadasHoy: number };
  alertas?: { id: string; codigo: string; cliente: string | null; estado: string; motivo: string }[];
  actividad?: { tipo: string; creado_at: string; codigo: string | null; cliente: string | null; remision: string | null; venta_id: string }[];
};

const TXT_ACTIVIDAD: Record<string, string> = {
  effi_enviada: 'Remisión creada en Effi', effi_error: 'Error al subir a Effi', effi_simulado: 'Vista previa armada',
  desde_chat: 'Pasada al panel desde el chat', confirmada: 'Confirmada por el vendedor', creada: 'Preventa recibida',
};
const ICO_ACTIVIDAD: Record<string, string> = { effi_enviada: '✅', effi_error: '⛔', effi_simulado: '🧾', desde_chat: '💬', confirmada: '✔️', creada: '📥' };

export default function VentasVendedoresPanel({ onAbrirChat }: { onAbrirChat?: (id: string) => void }) {
  const [pestana, setPestana] = useState<Pestana>('todas');
  const [effi, setEffi] = useState<'' | 'subidas' | 'sin_subir'>('');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [verFiltros, setVerFiltros] = useState(false);
  const [verOrden, setVerOrden] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [orden, setOrden] = useState<'desc' | 'asc'>('desc');
  const [ordenarPor, setOrdenarPor] = useState<'fecha' | 'valor' | 'cliente'>('fecha');
  const [vendedor, setVendedor] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [tipo, setTipo] = useState('');
  const [qa, setQa] = useState(true);
  const [vista, setVista] = useState<'tarjetas' | 'lista'>('tarjetas');
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [verAjustes, setVerAjustes] = useState(false);
  const [moduloActivo, setModuloActivo] = useState<boolean | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; t: string } | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const qs = new URLSearchParams({ pestana, orden, qa: qa ? '1' : '0', ordenar: ordenarPor });
    if (effi) qs.set('effi', effi);
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
  }, [pestana, effi, orden, ordenarPor, qa, buscaAplicada, desde, hasta, vendedor, ciudad, tipo]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const t = setInterval(() => { if (!abierta && document.visibilityState === 'visible') cargar(); }, 15_000);
    return () => clearInterval(t);
  }, [cargar, abierta]);
  useEffect(() => {
    fetch('/api/ventas-vendedores/ajustes', { cache: 'no-store' }).then(r => r.json()).then(j => setModuloActivo(!!j?.ajustes?.activo)).catch(() => {});
  }, [verAjustes]);
  useEffect(() => { if (aviso) { const t = setTimeout(() => setAviso(null), 6000); return () => clearTimeout(t); } }, [aviso]);

  const nFiltros = [desde, hasta, vendedor, ciudad, tipo].filter(Boolean).length + (qa ? 0 : 1);
  const ind = datos?.indicadores ?? { preventas: 0, totalNeto: 0, unidades: 0, pendientes: 0, errores: 0 };
  const ventas = useMemo(() => datos?.ventas ?? [], [datos]);
  const sel = ventas.find(v => v.id === seleccion) ?? null;
  const chatDe = (v: VentaVV) => (v.vendedor_tel.startsWith('panel') && v.conversacion_id ? v.conversacion_id : v.vendedor_tel);

  /** Sincronizar = actualizar la copia del catálogo KlixmSoft + recargar la cola. */
  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const r = await fetch('/api/ventas-vendedores/catalogo', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      setAviso(r.ok ? { ok: true, t: `Catálogo KlixmSoft actualizado: ${j.productos ?? 0} productos (${j.nuevos ?? 0} nuevos).` } : { ok: false, t: j.error || 'No se pudo sincronizar' });
      await cargar();
    } finally { setSincronizando(false); }
  };

  /**
   * Enviar a EFFI desde la tarjeta: arma la vista previa REAL (consulta Effi, no envía) y abre el
   * detalle, donde se revisa y se confirma con «✅ Enviar a Effi». Nunca sube a ciegas.
   */
  const prepararEnvio = async (v: VentaVV) => {
    if (v.effi_remision) { setAbierta(v.id); return; }
    setTrabajando(v.id);
    try {
      const r = await fetch(`/api/ventas-vendedores/${v.id}/effi`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setAviso({ ok: false, t: [j.mensaje, ...(j.errores ?? [])].filter(Boolean).join(' · ') || 'Revisa los datos de la venta.' });
      await cargar();
      setAbierta(v.id);
    } finally { setTrabajando(null); }
  };
  /** Botón superior «Subir a EFFI»: trabaja sobre la orden seleccionada; si no hay, muestra las sin subir. */
  const subirSeleccionada = () => {
    if (sel) { prepararEnvio(sel); return; }
    setEffi('sin_subir'); setPestana('todas');
    setAviso({ ok: true, t: 'Elige una venta de «Sin subir a EFFI» y oprime «Enviar a EFFI».' });
  };

  const KPIS = [
    { t: 'Preventas', v: String(ind.preventas), ico: '🧾', f: '#E6F5F2', c: VERDE },
    { t: 'Valor total', v: pesos(ind.totalNeto), ico: '$', f: '#F7EEDA', c: DORADO },
    { t: 'Unidades', v: String(ind.unidades), ico: '📦', f: '#E6F5F2', c: VERDE },
    { t: 'Pendientes / Incidencias', v: `${ind.pendientes} / ${ind.errores}`, ico: '⚠️', f: '#FCE4E1', c: '#B42318' },
  ];

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#F4F7F6] text-[#141414]">
      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 py-5">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3 mb-4 pl-10 md:pl-0 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-[30px] leading-none">👑</span>
            <div>
              <h1 className="text-[24px] md:text-[28px] font-extrabold tracking-tight leading-tight">Centro Maestro EFFI</h1>
              <p className="text-[13px] text-[#5E5E5A]">Gestión y envío inteligente de ventas a EFFI</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[12px] font-bold px-3 py-1.5 rounded-full ${moduloActivo ? 'bg-[#E0F3E8] text-[#14804A]' : 'bg-[#ECECE8] text-[#6A6A66]'}`}>
              {moduloActivo == null ? '…' : moduloActivo ? '● Módulo encendido' : '○ Módulo apagado'}
            </span>
            <button onClick={() => setVerAjustes(true)} className="h-10 px-3.5 rounded-xl border border-[#E1E5E3] bg-white text-[13px] font-semibold hover:bg-[#F1F4F3]">⚙️ Ajustes</button>
            <button onClick={sincronizar} disabled={sincronizando} title="Actualiza la copia del catálogo KlixmSoft y recarga la cola"
              className="h-10 px-3.5 rounded-xl border border-[#E1E5E3] bg-white text-[13px] font-semibold hover:bg-[#F1F4F3] disabled:opacity-60">
              <span className={sincronizando ? 'inline-block animate-spin' : ''}>⟳</span> {sincronizando ? 'Sincronizando…' : 'Sincronizar'}
            </button>
            <button onClick={subirSeleccionada} className="h-10 px-4 rounded-xl text-white text-[13.5px] font-bold shadow-[0_4px_14px_rgba(165,121,31,.35)] hover:brightness-95"
              style={{ background: `linear-gradient(135deg, #C79A3B, ${DORADO})` }}>☁️⬆ Subir a EFFI</button>
          </div>
        </div>

        {aviso && (
          <div className={`mb-3 rounded-xl px-4 py-2.5 text-[13px] font-medium ${aviso.ok ? 'bg-[#E6F5F2] text-[#0B5E56]' : 'bg-[#FDECEA] text-[#B42318]'}`}>{aviso.ok ? '✅ ' : '✖ '}{aviso.t}</div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_330px] gap-4 items-start">
          {/* ── Columna principal ── */}
          <div className="min-w-0 space-y-4">
            {/* Indicadores */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {KPIS.map(k => (
                <div key={k.t} className="bg-white rounded-2xl border border-[#E6EAE8] px-4 py-3.5 flex items-center gap-3 shadow-[0_1px_2px_rgba(20,20,20,.04)]">
                  <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-[18px] font-bold shrink-0" style={{ background: k.f, color: k.c }}>{k.ico}</span>
                  <div className="min-w-0">
                    <p className="text-[12px] text-[#5E5E5A] leading-tight">{k.t}</p>
                    <p className="text-[21px] font-extrabold leading-tight truncate">{k.v}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-3xl border border-[#E6EAE8] shadow-[0_1px_2px_rgba(20,20,20,.04),0_4px_14px_rgba(20,20,20,.05)]">
              <div className="p-4 sm:p-5 border-b border-[#EEF1F0]">
                {/* Pestañas por estado */}
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {PESTANAS.map(p => {
                    const activa = pestana === p.key;
                    const n = datos?.contadores?.[p.key] ?? 0;
                    const neutro = p.key === 'todas' || p.key === 'atender';
                    return (
                      <button key={p.key} onClick={() => setPestana(p.key)}
                        className={`shrink-0 h-9 pl-3.5 pr-1.5 rounded-full text-[13px] font-semibold flex items-center gap-2 border transition-colors ${activa ? 'border-transparent shadow-sm' : 'border-[#E6EAE8]'}`}
                        style={activa ? { background: neutro ? VERDE : p.color, color: '#fff' } : { background: neutro ? '#fff' : p.fondo, color: neutro ? '#141414' : p.color }}>
                        {p.label}
                        <span className="min-w-[24px] h-6 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center bg-white text-[#141414]">{n}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Buscador + filtros + orden + subidas/sin subir + vista */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <form onSubmit={e => { e.preventDefault(); setBuscaAplicada(busca.trim()); }}
                    className="flex-1 min-w-[240px] flex items-center gap-2 h-11 pl-4 pr-1.5 rounded-2xl border border-[#E6EAE8] bg-[#FAFBFB] focus-within:border-[#0E8A7E]">
                    <span className="text-[#8B8B86]">🔍</span>
                    <input value={busca} onChange={e => { setBusca(e.target.value); if (!e.target.value) setBuscaAplicada(''); }}
                      placeholder="Buscar cliente, celular, código, producto, SKU, ciudad, remisión…"
                      className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[#8B8B86]" />
                    <button type="submit" className="w-9 h-9 rounded-xl text-white" style={{ background: VERDE }} aria-label="Buscar">⌕</button>
                  </form>
                  <button onClick={() => { setVerFiltros(v => !v); setVerOrden(false); }} className={`h-11 px-3.5 rounded-xl border text-[13px] font-semibold flex items-center gap-1.5 ${verFiltros ? 'border-[#0E8A7E] text-[#0E8A7E]' : 'border-[#E6EAE8] bg-white'}`}>
                    ⛉ Filtros {nFiltros > 0 && <span className="w-5 h-5 rounded-full text-white text-[11px] flex items-center justify-center" style={{ background: VERDE }}>{nFiltros}</span>} ▾
                  </button>
                  <div className="relative">
                    <button onClick={() => { setVerOrden(v => !v); setVerFiltros(false); }} className="h-11 px-3.5 rounded-xl border border-[#E6EAE8] bg-white text-[13px] font-semibold">
                      ⇅ Ordenar por: {ordenarPor === 'fecha' ? 'Fecha' : ordenarPor === 'valor' ? 'Valor' : 'Cliente'} {orden === 'desc' ? '↓' : '↑'} ▾
                    </button>
                    {verOrden && (
                      <div className="absolute right-0 top-full mt-1 z-20 w-[230px] rounded-xl border border-[#E6EAE8] bg-white shadow-xl p-1.5">
                        {([['fecha', 'desc', 'Más recientes primero'], ['fecha', 'asc', 'Más antiguas primero'], ['valor', 'desc', 'Mayor valor primero'], ['valor', 'asc', 'Menor valor primero'], ['cliente', 'asc', 'Cliente A → Z'], ['cliente', 'desc', 'Cliente Z → A']] as const).map(([c, o, l]) => (
                          <button key={l} onClick={() => { setOrdenarPor(c); setOrden(o); setVerOrden(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-[13px] hover:bg-[#F1F4F3] ${ordenarPor === c && orden === o ? 'font-bold text-[#0E8A7E]' : ''}`}>{l}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setEffi(e => e === 'subidas' ? '' : 'subidas')}
                    className={`h-11 px-3.5 rounded-xl text-[13px] font-bold flex items-center gap-1.5 border ${effi === 'subidas' ? 'text-white border-transparent' : 'bg-white border-[#E6EAE8] text-[#14804A]'}`}
                    style={effi === 'subidas' ? { background: VERDE } : undefined}>
                    ✓ Subidas a EFFI <span className={`min-w-[22px] h-5 px-1.5 rounded-full text-[11px] flex items-center justify-center ${effi === 'subidas' ? 'bg-white text-[#141414]' : 'bg-[#E0F3E8]'}`}>{datos?.contadores?.subidas ?? 0}</span>
                  </button>
                  <button onClick={() => setEffi(e => e === 'sin_subir' ? '' : 'sin_subir')}
                    className={`h-11 px-3.5 rounded-xl text-[13px] font-bold flex items-center gap-1.5 border ${effi === 'sin_subir' ? 'text-white border-transparent' : 'bg-white border-[#E6EAE8] text-[#A5791F]'}`}
                    style={effi === 'sin_subir' ? { background: DORADO } : undefined}>
                    ☁ Sin subir a EFFI <span className={`min-w-[22px] h-5 px-1.5 rounded-full text-[11px] flex items-center justify-center ${effi === 'sin_subir' ? 'bg-white text-[#141414]' : 'bg-[#F7EEDA]'}`}>{datos?.contadores?.sin_subir ?? 0}</span>
                  </button>
                  <div className="inline-flex p-1 rounded-xl border border-[#E6EAE8] bg-[#F1F4F3]">
                    {(['tarjetas', 'lista'] as const).map(m => (
                      <button key={m} onClick={() => setVista(m)} title={m === 'tarjetas' ? 'Tarjetas' : 'Lista'}
                        className={`w-9 h-9 rounded-lg text-[15px] ${vista === m ? 'bg-white shadow text-[#0E8A7E]' : 'text-[#6A6A66]'}`}>{m === 'tarjetas' ? '▦' : '☰'}</button>
                    ))}
                  </div>
                </div>

                {verFiltros && (
                  <div className="mt-3 rounded-2xl border border-[#E6EAE8] bg-[#FAFBFB] p-3 space-y-3">
                    <div className="flex gap-3 flex-wrap">
                      {[{ l: 'Desde', v: desde, s: setDesde }, { l: 'Hasta', v: hasta, s: setHasta }].map(f => (
                        <label key={f.l} className="text-[12px] text-[#5E5E5A]">
                          <span className="block mb-1">{f.l}</span>
                          <input type="date" value={f.v} onChange={e => f.s(e.target.value)} className="h-10 px-3 rounded-xl border border-[#E6EAE8] text-[13px] bg-white" />
                        </label>
                      ))}
                      {[
                        { l: 'Vendedor', v: vendedor, s: setVendedor, ops: (datos?.opciones?.vendedores ?? []).map((x: any) => [x.tel, x.nombre]) },
                        { l: 'Ciudad', v: ciudad, s: setCiudad, ops: (datos?.opciones?.ciudades ?? []).map((x: string) => [x, x]) },
                        { l: 'Tipo de prenda', v: tipo, s: setTipo, ops: (datos?.opciones?.tipos ?? []).map((x: string) => [x, x]) },
                      ].map(f => (
                        <label key={f.l} className="text-[12px] text-[#5E5E5A]">
                          <span className="block mb-1">{f.l}</span>
                          <select value={f.v} onChange={e => f.s(e.target.value)} className="h-10 px-3 rounded-xl border border-[#E6EAE8] text-[13px] bg-white min-w-[150px]">
                            <option value="">Todos</option>
                            {f.ops.map(([val, txt]: string[]) => <option key={val} value={val}>{txt}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <label className="flex items-center gap-2 text-[13px] text-[#5E5E5A] cursor-pointer w-fit">
                        🧪 Mostrar ventas de QA (números de prueba)
                        <button type="button" onClick={() => setQa(v => !v)} className={`w-10 h-6 rounded-full relative transition-colors ${qa ? 'bg-[#14804A]' : 'bg-[#D9D8D3]'}`}>
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${qa ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                      </label>
                      <button onClick={() => { setDesde(''); setHasta(''); setVendedor(''); setCiudad(''); setTipo(''); setQa(true); }} className="text-[12.5px] text-[#0E8A7E] font-semibold hover:underline">Limpiar filtros</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Pedidos */}
              <div className="p-3 sm:p-4">
                {cargando ? (
                  <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl bg-[#EEF1F0] animate-pulse" />)}</div>
                ) : ventas.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-[15px] font-semibold">No hay preventas en esta vista.</p>
                    <p className="text-[12.5px] text-[#8B8B86] mt-1">
                      {effi ? 'Quita el filtro de EFFI o cambia de pestaña.' : moduloActivo ? 'Cuando entre una venta (vendedor o «Enviar al panel de Effi» del chat), aparecerá aquí.' : 'El módulo está apagado. Enciéndelo en ⚙️ Ajustes.'}
                    </p>
                  </div>
                ) : vista === 'tarjetas' ? (
                  <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
                    {ventas.map(v => (
                      <Tarjeta key={v.id} v={v} seleccionada={v.id === seleccion} trabajando={trabajando === v.id}
                        onSeleccionar={() => setSeleccion(v.id)} onVer={() => setAbierta(v.id)}
                        onEnviar={() => prepararEnvio(v)} onChat={() => onAbrirChat?.(chatDe(v))} />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead><tr className="text-left text-[11.5px] text-[#6A6A66] border-b border-[#EEF1F0]">
                        <th className="py-2 pr-2">Cliente</th><th className="py-2 pr-2">Producto</th><th className="py-2 pr-2">Talla · Color</th>
                        <th className="py-2 pr-2">Ciudad</th><th className="py-2 pr-2">Estado</th><th className="py-2 pr-2 text-right">Valor</th><th className="py-2" />
                      </tr></thead>
                      <tbody>
                        {ventas.map(v => {
                          const it = v.items[0];
                          return (
                            <tr key={v.id} onClick={() => setSeleccion(v.id)} className={`border-b border-[#F3F5F4] cursor-pointer ${v.id === seleccion ? 'bg-[#F0FAF8]' : 'hover:bg-[#FAFBFB]'}`}>
                              <td className="py-2 pr-2"><b>{v.cliente_nombre || '—'}</b><br /><span className="text-[11.5px] text-[#8B8B86]">{telBonito(v.cliente_celular)}</span></td>
                              <td className="py-2 pr-2 uppercase font-semibold text-[12px]">{it?.catalogo || '—'}{v.items.length > 1 ? ` +${v.items.length - 1}` : ''}</td>
                              <td className="py-2 pr-2">{it ? `${it.talla || '—'} · ${it.color || '—'}` : '—'}</td>
                              <td className="py-2 pr-2">{v.municipio || '—'}</td>
                              <td className="py-2 pr-2"><PildoraEstado estado={v.estado} /></td>
                              <td className="py-2 pr-2 text-right font-mono font-bold">{pesos(v.total)}</td>
                              <td className="py-2 text-right whitespace-nowrap">
                                <button onClick={e => { e.stopPropagation(); setAbierta(v.id); }} className="px-2.5 h-8 rounded-lg border border-[#E6EAE8] text-[12px] font-semibold mr-1">Ver</button>
                                <button onClick={e => { e.stopPropagation(); prepararEnvio(v); }} disabled={trabajando === v.id || v.estado === 'cancelada'}
                                  className="px-2.5 h-8 rounded-lg text-white text-[12px] font-bold disabled:opacity-50" style={{ background: v.effi_remision ? '#2563EB' : VERDE }}>
                                  {v.effi_remision ? `Effi ${v.effi_remision}` : 'Enviar'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Lateral ── */}
          <aside className="space-y-4 xl:sticky xl:top-3">
            <section className="bg-white rounded-2xl border border-[#E6EAE8] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[15px] font-extrabold">📅 Resumen hoy</h3>
                <span className="text-[11.5px] text-[#8B8B86]">{datos?.resumenHoy?.fecha ? new Date(`${datos.resumenHoy.fecha}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
              </div>
              {[
                { t: 'Enviadas a EFFI', n: datos?.resumenHoy?.enviadasHoy ?? 0, ico: '✅', f: '#F0FAF4', act: () => { setEffi('subidas'); setPestana('todas'); } },
                { t: 'Nuevas hoy', n: datos?.resumenHoy?.creadasHoy ?? 0, ico: '📥', f: '#F3F6FF', act: () => { setEffi(''); setPestana('todas'); setOrdenarPor('fecha'); setOrden('desc'); } },
                { t: 'En proceso', n: datos?.resumenHoy?.enProceso ?? 0, ico: '🔄', f: '#F4F6F8', act: () => { setEffi(''); setPestana('proceso'); } },
                { t: 'Pendientes', n: datos?.resumenHoy?.pendientes ?? 0, ico: '⚠️', f: '#FFF8E8', act: () => { setEffi(''); setPestana('pendientes'); } },
              ].map(r => (
                <button key={r.t} onClick={r.act} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5 text-left hover:brightness-95" style={{ background: r.f }}>
                  <span>{r.ico}</span><span className="flex-1 text-[13px] font-medium">{r.t}</span><b className="text-[14px]">{r.n}</b>
                </button>
              ))}
            </section>

            <section className="bg-white rounded-2xl border border-[#E6EAE8] p-4" style={sel ? { background: 'linear-gradient(180deg,#FFF9EC,#fff 45%)' } : undefined}>
              <h3 className="text-[15px] font-extrabold mb-3">📦 Orden seleccionada</h3>
              {sel ? (
                <>
                  <div className="flex gap-3">
                    <Foto v={sel} clase="w-[84px] h-[92px]" />
                    <div className="min-w-0">
                      <p className="text-[14px] font-extrabold leading-tight">{sel.cliente_nombre || 'Sin nombre'}</p>
                      <p className="text-[12px] text-[#5E5E5A]">📞 {telBonito(sel.cliente_celular) || '—'}</p>
                      <p className="text-[12px] text-[#5E5E5A]">📍 {sel.municipio || '—'}</p>
                      <p className="mt-1 text-[11.5px] font-bold uppercase leading-tight">{sel.items[0]?.catalogo || '—'}{sel.items.length > 1 ? ` +${sel.items.length - 1}` : ''}</p>
                      <p className="text-[11.5px] text-[#5E5E5A]">Talla <b>{sel.items[0]?.talla || '—'}</b> · Color <b>{sel.items[0]?.color || '—'}</b></p>
                      <span className="mt-1 inline-block px-2.5 py-0.5 rounded-lg bg-[#F7EEDA] text-[#7A5A12] font-extrabold text-[14px]">{pesos(sel.total)}</span>
                    </div>
                  </div>
                  <div className="mt-2"><PildoraEstado estado={sel.estado} />{sel.effi_remision && <span className="ml-2 text-[12px] text-[#14804A] font-semibold">Remisión {sel.effi_remision}</span>}</div>
                  <button onClick={() => setAbierta(sel.id)} className="mt-3 w-full h-10 rounded-xl border border-[#E6EAE8] text-[13px] font-bold hover:bg-[#F1F4F3]">Ver detalle completo ›</button>
                </>
              ) : <p className="text-[12.5px] text-[#8B8B86]">Toca una venta para verla aquí.</p>}
            </section>

            <section className="bg-white rounded-2xl border border-[#E6EAE8] p-4">
              <h3 className="text-[15px] font-extrabold mb-3">🔄 Actividad de sincronización</h3>
              {(datos?.actividad ?? []).length === 0 ? <p className="text-[12.5px] text-[#8B8B86]">Sin actividad todavía.</p> : (
                <div className="space-y-1.5">
                  {(datos?.actividad ?? []).slice(0, 6).map((a, i) => (
                    <button key={i} onClick={() => { setSeleccion(a.venta_id); setAbierta(a.venta_id); }} className="w-full flex items-start gap-2 px-2.5 py-2 rounded-xl bg-[#F7F9F8] hover:bg-[#EEF3F1] text-left">
                      <span className="text-[13px]">{ICO_ACTIVIDAD[a.tipo] ?? '•'}</span>
                      <span className="flex-1 min-w-0 text-[12px] leading-snug">
                        <b>{TXT_ACTIVIDAD[a.tipo] ?? a.tipo}</b>{a.remision && a.tipo === 'effi_enviada' ? ` · #${a.remision}` : ''}
                        <br /><span className="text-[#6A6A66]">{a.cliente || a.codigo || ''}</span>
                      </span>
                      <span className="text-[10.5px] text-[#8B8B86] whitespace-nowrap">{fechaCorta(a.creado_at)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-[#E6EAE8] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[15px] font-extrabold">🔔 Alertas y novedades</h3>
                <span className="min-w-[24px] h-6 px-1.5 rounded-full bg-[#F7EEDA] text-[#7A5A12] text-[12px] font-bold flex items-center justify-center">{datos?.alertas?.length ?? 0}</span>
              </div>
              {(datos?.alertas ?? []).length === 0 ? <p className="text-[12.5px] text-[#14804A]">✅ Sin incidencias.</p> : (
                <div className="space-y-1.5">
                  {(datos?.alertas ?? []).map(a => (
                    <button key={a.id} onClick={() => { setSeleccion(a.id); setAbierta(a.id); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#FDF1EF] hover:bg-[#FBE5E1] text-left">
                      <span className="w-6 h-6 rounded-full bg-[#DC2626] text-white text-[12px] font-bold flex items-center justify-center shrink-0">!</span>
                      <span className="flex-1 min-w-0 text-[12px] leading-snug"><b>{a.cliente || a.codigo}</b><br /><span className="text-[#6A6A66]">{a.motivo}</span></span>
                      <span className="text-[#8B8B86]">›</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      {abierta && (
        <DetalleVenta id={abierta} onCerrar={() => { setAbierta(null); cargar(); }} onCambio={cargar} onChat={tel => { setAbierta(null); onAbrirChat?.(tel); }} />
      )}
      {verAjustes && <AjustesVV onCerrar={() => { setVerAjustes(false); cargar(); }} />}
    </div>
  );
}

function Foto({ v, clase }: { v: VentaVV; clase: string }) {
  const it = v.items[0];
  const foto = it?.foto_vendedor || it?.foto_oficial || v.fotos_vendedor?.[0];
  return (
    <div className={`${clase} rounded-xl bg-[#EEF1F0] overflow-hidden shrink-0 flex items-center justify-center`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {foto ? <img src={foto} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="text-[11px] text-[#8B8B86] px-2 text-center">Sin foto</span>}
    </div>
  );
}

function Tarjeta({ v, seleccionada, trabajando, onSeleccionar, onVer, onEnviar, onChat }: {
  v: VentaVV; seleccionada: boolean; trabajando: boolean;
  onSeleccionar: () => void; onVer: () => void; onEnviar: () => void; onChat: () => void;
}) {
  const it = v.items[0];
  const unidades = v.items.reduce((s, i) => s + (i.cantidad || 0), 0);
  const extra = v.items.length - 1;
  const enEffi = !!v.effi_remision;
  const bloqueada = v.estado === 'cancelada' || v.estado === 'enviando_effi';
  return (
    <article onClick={onSeleccionar}
      className={`rounded-2xl border bg-white shadow-[0_1px_2px_rgba(20,20,20,.04)] overflow-hidden cursor-pointer transition-all ${seleccionada ? 'border-[#C79A3B] ring-2 ring-[#C79A3B]/30' : 'border-[#E6EAE8] hover:shadow-md'}`}>
      <div className="p-3.5 flex gap-3">
        <Foto v={v} clase="w-[104px] h-[112px]" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <PildoraEstado estado={v.estado} />
                {v.es_prueba && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#ECECE8] text-[#6A6A66]">QA</span>}
              </div>
              <h3 className="mt-1 text-[15.5px] font-extrabold leading-tight truncate">👤 {v.cliente_nombre || 'Cliente sin nombre'}</h3>
              <p className="text-[12.5px] text-[#5E5E5A] truncate">📞 {telBonito(v.cliente_celular) || '—'}{v.municipio ? `   📍 ${v.municipio}` : ''}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); onChat(); }} className="shrink-0 w-10 h-10 rounded-full border-2 border-[#14804A] text-[#14804A] flex items-center justify-center hover:bg-[#E0F3E8]" title="Abrir el chat (novedades)"><IcoWA /></button>
          </div>
          {it ? (
            <div className="mt-1.5">
              <p className="text-[13px] font-extrabold uppercase truncate">{it.catalogo || it.descripcion || 'Prenda sin identificar'}</p>
              <p className="text-[11px] text-[#8B8B86] font-mono truncate">Ref. {it.referencia || '—'}{it.id_variante ? ` · ID ${it.id_variante}` : ''}</p>
              <p className="text-[12px] text-[#5E5E5A]">Talla <b className="text-[#141414]">{it.talla || '—'}</b> · Color <b className="text-[#141414]">{it.color || '—'}</b>
                {extra > 0 ? <span className="ml-1 text-[#0E8A7E] font-semibold">+{extra} prenda{extra > 1 ? 's' : ''}</span> : null}
                <span className="ml-1 text-[#8B8B86]">· {unidades} und.</span></p>
            </div>
          ) : <p className="mt-1.5 text-[12px] text-[#8B8B86]">Sin prendas todavía</p>}
        </div>
      </div>
      {enEffi ? (
        <p className="px-4 -mt-1 pb-2 text-[12px] text-[#14804A] font-semibold">🧾 Remisión en Effi #{v.effi_remision}</p>
      ) : v.faltantes?.length > 0 && v.estado !== 'cancelada' ? (
        <p className="px-4 -mt-1 pb-2 text-[12px] text-[#B25E00] truncate">⚠️ Falta: {v.faltantes.join(' · ')}</p>
      ) : v.effi_estado === 'simulado' ? (
        <p className="px-4 -mt-1 pb-2 text-[12px] text-[#1F5FBF]">🧾 Vista previa lista para enviar</p>
      ) : null}
      <div className="border-t border-[#EEF1F0] px-3.5 py-2.5 flex items-center gap-2 flex-wrap">
        <span className="px-3 py-1 rounded-xl bg-[#F7EEDA] text-[#7A5A12] font-extrabold text-[16px] font-mono">{pesos(v.total)}</span>
        <span className="text-[10.5px] text-[#8B8B86] leading-tight">{fechaCorta(v.creado_at)}<br />{v.vendedor_nombre || v.vendedor_tel}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={e => { e.stopPropagation(); onVer(); }} className="h-9 px-3 rounded-xl border border-[#E6EAE8] text-[12.5px] font-bold hover:bg-[#F1F4F3]">Ver detalle ›</button>
          <button onClick={e => { e.stopPropagation(); onVer(); }} disabled={enEffi} title={enEffi ? 'Ya está en Effi: los cambios van por Novedades' : 'Editar datos y prendas'}
            className="h-9 px-3 rounded-xl border border-[#E6EAE8] text-[12.5px] font-bold hover:bg-[#F1F4F3] disabled:opacity-40">✎ Editar</button>
          <button onClick={e => { e.stopPropagation(); onEnviar(); }} disabled={trabajando || bloqueada}
            className="h-9 px-3 rounded-xl text-white text-[12.5px] font-bold disabled:opacity-50" style={{ background: enEffi ? '#2563EB' : VERDE }}>
            {trabajando ? 'Armando…' : enEffi ? '✓ En EFFI' : '➤ Enviar a EFFI'}
          </button>
        </div>
      </div>
    </article>
  );
}

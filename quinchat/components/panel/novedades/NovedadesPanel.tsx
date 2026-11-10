'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import { AVISO_INTENTO, AVISO_DIRECCION, AVISO_INCOMPLETA, AVISO_CANCELADO } from './AvisoOficina';

const AvisoOficina = dynamic(() => import('./AvisoOficina'), { ssr: false });

/**
 * PANEL DE NOVEDADES (09-nov-2026) — módulo independiente.
 * Novedades REALES de Effi (guías con problema de entrega) de FUNNELISTH LANDING y QUINO AGENCIA.
 * API propia: /api/novedades (lista + sincronizar), /api/novedades/[id] (detalle, estado, notas), /api/novedades/chat (buscar chat).
 */

type Estado = 'nueva' | 'pendiente' | 'en_gestion' | 'solucionada';
interface AvisoEstado { estado: string; enviado_at: string | null; respuesta: string | null; respuesta_at?: string | null; motivo?: string | null; detalle?: string | null }
interface Novedad {
  aplica_oficina?: boolean; aplica_intento?: boolean; aplica_direccion?: boolean; aplica_incompleta?: boolean; aplica_cancelado?: boolean;
  aviso_cancelado?: (AvisoEstado & { fotos?: number }) | null; cancelacion_definitiva?: boolean; reentrega_solicitada?: boolean;
  aviso_incompleta?: (AvisoEstado & { fotos?: number }) | null;
  direccion_corregida?: string | null; direccion_corregida_at?: string | null; direccion_corregida_por?: string | null; direccion_confirmada?: boolean;
  aviso_oficina?: AvisoEstado | null; aviso_intento?: AvisoEstado | null; aviso_direccion?: (AvisoEstado & { fotos?: number }) | null;
  id: number; id_guia_effi: string; guia: string | null; transportadora: string | null; id_remision: string | null; vendedor: string | null;
  cliente: string | null; telefono: string | null; telefono_original: string | null; ciudad: string | null; departamento: string | null;
  producto: string | null; talla: string | null; foto: string | null; valor_recaudo: number | null;
  estado_effi: string | null; estado_effi_comercio: string | null; motivo: string | null;
  estado: Estado; resultado: string | null; activa_en_effi: boolean;
  fecha_guia: string | null; detectada_at: string; visto_at: string | null; estado_cambio_at: string; solucionada_at: string | null;
  direccion?: string | null; contenido_effi?: string | null; observacion_effi?: string | null; url_guia?: string | null;
  id_novedad_effi?: string | null; novedad_texto?: string | null; aclaracion?: string | null; estado_novedad_effi?: string | null; soluciones?: number | null; fecha_novedad?: string | null;
}
interface Hist { id: number; at: string; tipo: string; detalle: string | null; por: string | null }
type Filtro = 'todas' | Estado | 'oficina';
/**
 * EN OFICINA (10-nov-2026, dueño): pestaña APARTE para las guías que esperan en oficina de la transportadora
 * («Reclame en oficina» / «Disponible para retiro en oficina»). Mientras no estén solucionadas NO salen en
 * Nuevas, Pendientes ni En gestión. En «Todas» y «Solucionadas» siguen como siempre.
 */
const esOficina = (n: { estado: string; estado_effi?: string | null; estado_effi_comercio?: string | null; motivo?: string | null; aplica_oficina?: boolean }) =>
  n.estado !== 'solucionada' && (!!n.aplica_oficina
    || /reclame en oficina|retiro en oficina|disponible para retiro|en oficina/i.test(`${n.estado_effi ?? ''} ${n.estado_effi_comercio ?? ''} ${n.motivo ?? ''}`));

// Se conserva al ir al chat y volver (el módulo queda cargado mientras el panel esté abierto)
const memoria: { filtroAviso: 'todos' | 'enviado' | 'sin'; filtro: Filtro; q: string; abierta: number | null; scroll: number; conocidas: Set<number> | null } = {
  filtroAviso: 'todos', filtro: 'todas', q: '', abierta: null, scroll: 0, conocidas: null,
};

const VERDE = '#00A89D';
const tarjeta = 'bg-white rounded-2xl border border-[#E8ECEB] shadow-sm';
const ESTADOS: { k: Filtro; t: string; c: string; bg: string }[] = [
  { k: 'todas', t: 'Todas', c: '#0D1F1C', bg: '#F1F5F4' },
  { k: 'nueva', t: 'Nuevas', c: '#B42318', bg: '#FEE4E2' },
  { k: 'pendiente', t: 'Pendientes', c: '#B54708', bg: '#FEF0C7' },
  { k: 'en_gestion', t: 'En gestión', c: '#175CD3', bg: '#D1E9FF' },
  { k: 'oficina', t: '🏤 En oficina', c: '#C2410C', bg: '#FFEDD5' },
  { k: 'solucionada', t: 'Solucionadas', c: '#067647', bg: '#DCFAE6' },
];
const estiloDe = (e: string) => ESTADOS.find(x => x.k === e) ?? ESTADOS[0];
const fecha = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }) : '—');
const hace = (iso: string | null) => {
  if (!iso) return 'nunca';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  return m < 1 ? 'hace un momento' : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`;
};
const pesos = (n: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-CO')}`);
const RESULTADO: Record<string, string> = { entregada: '✅ Entregada en Effi', devuelta: '↩️ En devolución en Effi', anulada: '⛔ Guía anulada', equipo: '👍 Marcada por el equipo', en_ruta: '🚚 Effi: volvió a ruta' };

export default function NovedadesPanel({ onAbrirChat }: { onAbrirChat?: (id: string) => void }) {
  const [lista, setLista] = useState<Novedad[]>([]);
  const [cont, setCont] = useState<Record<string, number>>({});
  const [ultEffi, setUltEffi] = useState<string | null>(null);
  const [ultSync, setUltSync] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>(memoria.filtro);
  const [q, setQ] = useState(memoria.q);
  const [filtroAviso, setFiltroAviso] = useState(memoria.filtroAviso);
  useEffect(() => { memoria.filtroAviso = filtroAviso; }, [filtroAviso]);
  const [abierta, setAbierta] = useState<number | null>(memoria.abierta);
  const [alerta, setAlerta] = useState<Novedad[]>([]);
  const [recien, setRecien] = useState<Set<number>>(new Set());
  const [sinChat, setSinChat] = useState<{ tel: string; cliente: string | null } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [verAvisoOficina, setVerAvisoOficina] = useState(false);
  const [verAvisoIntento, setVerAvisoIntento] = useState(false);
  const [verAvisoDireccion, setVerAvisoDireccion] = useState(false);
  const [verAvisoIncompleta, setVerAvisoIncompleta] = useState(false);
  const [verAvisoCancelado, setVerAvisoCancelado] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => { memoria.filtro = filtro; }, [filtro]);
  useEffect(() => { memoria.q = q; }, [q]);
  useEffect(() => { memoria.abierta = abierta; }, [abierta]);

  const cargar = useCallback(async () => {
    const r = await fetch('/api/novedades', { cache: 'no-store' }); const j = await r.json().catch(() => ({}));
    if (!r.ok) { setAviso(j.error ?? 'No se pudieron cargar las novedades'); setCargando(false); return; }
    const nov: Novedad[] = j.novedades ?? [];
    // Alerta: novedades que no estaban la vez anterior (la primera carga no alerta)
    if (memoria.conocidas) {
      const nuevas = nov.filter(n => !memoria.conocidas!.has(n.id));
      if (nuevas.length) {
        setAlerta(nuevas);
        setRecien(prev => new Set([...prev, ...nuevas.map(n => n.id)]));
        try { if (document.hidden) document.title = `(${nuevas.length}) 🔔 Novedad nueva`; } catch { /* nada */ }
      }
    }
    memoria.conocidas = new Set(nov.map(n => n.id));
    setLista(nov); setCont(j.contadores ?? {}); setUltEffi(j.ultima_effi ?? null); setUltSync(j.ultima_sync ?? null); setCargando(false);
  }, []);

  const sincronizar = useCallback(async (forzar = false) => {
    setSincronizando(true);
    try {
      const r = await fetch('/api/novedades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ forzar }) });
      const j = await r.json().catch(() => ({}));
      if (forzar) setAviso(j.omitida ? j.omitida : j.ok ? `✅ Effi revisado: ${j.guias ?? 0} guías · ${j.nuevas ?? 0} nuevas · ${j.cambios ?? 0} cambios` : `⚠️ ${j.error ?? 'Effi no respondió'}`);
    } finally { setSincronizando(false); await cargar(); }
  }, [cargar]);

  useEffect(() => {
    cargar().then(() => sincronizar(false));
    const t = setInterval(() => sincronizar(false), 60_000);           // el servidor decide si toca ir a Effi
    const vis = () => { if (!document.hidden) document.title = document.title.replace(/^\(\d+\) 🔔 Novedad nueva$/, 'QuinChat'); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [cargar, sincronizar]);

  // Volver al mismo punto de la lista
  useEffect(() => { if (!cargando && caja.current) caja.current.scrollTop = memoria.scroll; }, [cargando]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase(); const d = t.replace(/\D/g, '');
    const enviado = (n: Novedad) => [n.aviso_oficina, n.aviso_intento, n.aviso_direccion, n.aviso_incompleta, n.aviso_cancelado].some(a => a?.estado === 'enviado');
    const pendiente = (n: Novedad) => (n.aplica_oficina && n.aviso_oficina?.estado !== 'enviado') || (n.aplica_intento && n.aviso_intento?.estado !== 'enviado')
      || (n.aplica_direccion && n.aviso_direccion?.estado !== 'enviado') || (n.aplica_incompleta && n.aviso_incompleta?.estado !== 'enviado')
      || (n.aplica_cancelado && !n.cancelacion_definitiva && n.aviso_cancelado?.estado !== 'enviado');
    return lista.filter(n => (filtro === 'todas' || (filtro === 'oficina' ? esOficina(n) : n.estado === filtro && !esOficina(n)))
      && (filtroAviso === 'todos' || (filtroAviso === 'enviado' ? enviado(n) : pendiente(n))) && (!t
      || (n.cliente ?? '').toLowerCase().includes(t)
      || (d.length >= 3 && ((n.telefono ?? '').includes(d) || (n.telefono_original ?? '').replace(/\D/g, '').includes(d)
        || (n.guia ?? '').includes(d) || (n.id_remision ?? '').includes(d) || n.id_guia_effi.includes(d)))));
  }, [lista, filtro, q, filtroAviso]);

  /** Abrir chat: busca la conversación por teléfono (con o sin +57) en Chat Funnel y Chat WhatsApp. */
  const abrirChat = async (n: Novedad) => {
    const tel = n.telefono;
    if (!tel || !/^\d{10}$/.test(tel)) { setAviso(`⚠️ El teléfono de ${n.cliente ?? 'este cliente'} no es válido en Effi («${n.telefono_original || 'vacío'}»). Verifícalo en Effi.`); return; }
    const r = await fetch(`/api/novedades/chat?tel=${tel}`); const j = await r.json().catch(() => ({}));
    if (!j.valido) { setAviso(`⚠️ El teléfono «${n.telefono_original || tel}» no es válido. Verifícalo en Effi.`); return; }
    if (j.encontrado && onAbrirChat) {
      memoria.scroll = caja.current?.scrollTop ?? 0;
      onAbrirChat(j.id);
      return;
    }
    setSinChat({ tel: j.telefono, cliente: n.cliente });
  };

  const sel = lista.find(n => n.id === abierta) ?? null;
  // Nuevas / Pendientes / En gestión / En oficina se cuentan con la lista (las de oficina van aparte)
  const contador = (k: Filtro) => (k === 'todas' || k === 'solucionada' || !lista.length
    ? (k === 'todas' ? cont.todas : (cont as any)[k])
    : k === 'oficina' ? lista.filter(esOficina).length : lista.filter(n => n.estado === k && !esOficina(n)).length) ?? 0;

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#F4F6F5] min-h-0">
      <div ref={caja} onScroll={e => { memoria.scroll = (e.target as HTMLDivElement).scrollTop; }} className="flex-1 overflow-y-auto">
        <div className="max-w-[1500px] w-full mx-auto px-4 md:px-6 py-5 flex flex-col gap-4">
          {/* Encabezado */}
          <div className={`${tarjeta} p-5 flex items-center gap-4 flex-wrap`}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-[#FEF0C7]">📮</div>
            <div className="flex-1 min-w-[240px]">
              <h1 className="text-2xl font-extrabold text-[#0D1F1C]">Panel de Novedades</h1>
              <p className="text-[13px] text-[#5B6B68]">Guías con novedad en Effi de <b>FUNNELISTH LANDING</b> y <b>QUINO AGENCIA</b>. Se revisa Effi cada 10 min mientras el panel esté abierto.</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-[#5B6B68]">Effi revisado {hace(ultEffi)}</p>
              {ultSync?.error_novedades && <p className="text-[11px] text-[#B54708] max-w-[260px] truncate" title={ultSync.error_novedades}>«Novedades de guías» de Effi no respondió</p>}
              {ultSync && ultSync.ok === false && <p className="text-[11px] text-[#B42318] max-w-[260px] truncate" title={ultSync.error}>Último intento falló: {ultSync.error}</p>}
              <button onClick={() => setVerAvisoCancelado(true)} className="mt-1 mr-2 px-4 py-2 rounded-xl border border-[#D92D20] text-[#B42318] text-sm font-bold bg-white hover:bg-[#FEF3F2]">🛑 Aviso «Pedido cancelado»</button>
              <button onClick={() => setVerAvisoIncompleta(true)} className="mt-1 mr-2 px-4 py-2 rounded-xl border border-[#0E9384] text-[#0E7466] text-sm font-bold bg-white hover:bg-[#F0FDF9]">🏠 Aviso «Dirección incompleta»</button>
              <button onClick={() => setVerAvisoDireccion(true)} className="mt-1 mr-2 px-4 py-2 rounded-xl border border-[#7C3AED] text-[#6D28D9] text-sm font-bold bg-white hover:bg-[#F5F3FF]">📍 Aviso «Dirección no localizada»</button>
              <button onClick={() => setVerAvisoIntento(true)} className="mt-1 mr-2 px-4 py-2 rounded-xl border border-[#2563EB] text-[#1D4ED8] text-sm font-bold bg-white hover:bg-[#EFF6FF]">🚗 Aviso «Intento de entrega»</button>
              <button onClick={() => setVerAvisoOficina(true)} className="mt-1 mr-2 px-4 py-2 rounded-xl border border-[#F97316] text-[#C2410C] text-sm font-bold bg-white hover:bg-[#FFF7ED]">📲 Aviso «Listo para reclamar»</button>
              <button onClick={() => sincronizar(true)} disabled={sincronizando} className="mt-1 px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50" style={{ background: VERDE }}>
                {sincronizando ? 'Revisando Effi…' : '🔄 Traer de Effi ahora'}
              </button>
            </div>
          </div>

          {/* Alerta de novedad nueva */}
          {alerta.length > 0 && (
            <div className="rounded-2xl border-2 border-[#F04438] bg-[#FEF3F2] p-4 flex items-center gap-3 animate-pulse">
              <span className="text-2xl">🔔</span>
              <div className="flex-1 text-sm">
                <b className="text-[#B42318]">{alerta.length === 1 ? 'Llegó una novedad nueva' : `Llegaron ${alerta.length} novedades nuevas`}</b>
                <p className="text-[#7A271A] text-[13px]">{alerta.slice(0, 3).map(n => `${n.cliente ?? 'Cliente'} — ${n.motivo ?? ''}`).join(' · ')}</p>
              </div>
              <button onClick={() => { setFiltro('nueva'); setAlerta([]); }} className="px-3 py-1.5 rounded-lg bg-[#F04438] text-white text-xs font-bold">Ver</button>
              <button onClick={() => setAlerta([])} className="text-[#B42318] text-lg px-1">✕</button>
            </div>
          )}

          {aviso && (
            <div className="rounded-xl bg-white border border-[#E8ECEB] px-4 py-2.5 text-sm flex items-center gap-2">
              <span className="flex-1">{aviso}</span><button onClick={() => setAviso(null)} className="text-[#5B6B68]">✕</button>
            </div>
          )}

          {/* Filtros + buscador */}
          <div className="flex items-center gap-2 flex-wrap">
            {ESTADOS.map(e => (
              <button key={e.k} onClick={() => setFiltro(e.k)}
                className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition ${filtro === e.k ? 'shadow-sm' : 'opacity-80 hover:opacity-100'}`}
                style={{ background: filtro === e.k ? e.bg : '#fff', color: e.c, borderColor: filtro === e.k ? e.c : '#E8ECEB' }}>
                {e.t} <span className="ml-1 inline-flex min-w-[22px] justify-center px-1.5 rounded-full text-[11px] text-white" style={{ background: e.c }}>{contador(e.k)}</span>
              </button>
            ))}
            <select value={filtroAviso} onChange={e => setFiltroAviso(e.target.value as any)} className="ml-auto px-3 py-2 rounded-xl border border-[#E1E5E4] bg-white text-sm font-semibold">
              <option value="todos">📲 Avisos: todos</option>
              <option value="enviado">✅ Con aviso enviado</option>
              <option value="sin">⏳ Aviso sin enviar</option>
            </select>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔎 Cliente, teléfono, guía o remisión"
              className="w-full sm:w-80 px-3.5 py-2 rounded-xl border border-[#E1E5E4] bg-white text-sm" />
          </div>

          {/* Tarjetas */}
          {cargando ? <p className="text-sm text-[#5B6B68] py-10 text-center">Cargando novedades…</p>
            : !visibles.length ? (
              <div className={`${tarjeta} p-10 text-center text-sm text-[#5B6B68]`}>
                {lista.length ? 'Ninguna novedad con ese filtro o búsqueda.' : 'Aún no hay novedades de Funnelish ni Quino Agencia en Effi. Cuando la transportadora reporte una, aparece aquí.'}
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 2xl:grid-cols-3">
                {visibles.map(n => {
                  const est = estiloDe(n.estado);
                  return (
                    <div key={n.id} className={`${tarjeta} p-3.5 flex gap-3 ${recien.has(n.id) || n.estado === 'nueva' ? 'ring-2 ring-[#F04438]/40' : ''}`}>
                      <button onClick={() => setAbierta(n.id)} className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-[#F1F5F4] flex items-center justify-center text-3xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {n.foto ? <img src={n.foto} alt="" loading="lazy" className="w-full h-full object-cover" /> : '📦'}
                      </button>
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex items-start gap-2">
                          <button onClick={() => setAbierta(n.id)} className="flex-1 min-w-0 text-left">
                            <p className="font-extrabold text-[15px] text-[#0D1F1C] truncate">{n.cliente ?? 'Sin nombre'}</p>
                            <p className="text-[12px] text-[#5B6B68]">📱 {n.telefono ?? <span className="text-[#B42318]">{n.telefono_original || 'sin teléfono'} (revisar)</span>} · {n.ciudad ?? ''}</p>
                          </button>
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: est.bg, color: est.c }}>{est.t.replace(/s$/, '')}</span>
                        </div>
                        <p className="text-[12.5px] text-[#0D1F1C] line-clamp-1" title={n.producto ?? ''}>👕 {n.producto ?? 'Producto no identificado'}{n.talla ? ` · ${n.talla}` : ''}</p>
                        <p className="text-[12px] text-[#5B6B68] flex items-center gap-1">🧾 Remisión {n.id_remision ?? '—'} · Guía {n.guia ?? '—'}
                          {n.guia && <button onClick={() => copiar(n.guia!, setAviso, `Guía ${n.guia}`)} title="Copiar guía" className="px-1 rounded hover:bg-[#F1F5F4]">📋</button>}</p>
                        <p className="text-[12.5px] font-bold text-[#B54708] line-clamp-1" title={n.motivo ?? ''}>⚠️ {n.motivo ?? 'Novedad'}</p>
                        {n.resultado && <p className="text-[11.5px] text-[#067647]">{RESULTADO[n.resultado] ?? n.resultado}</p>}
                        <ZonaAvisos n={n} onListo={cargar} onAviso={setAviso} />
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-[#5B6B68]">🕒 {fecha(n.detectada_at)}</span>
                          <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[#F1F5F4] text-[#5B6B68] font-semibold">{/QUINO/i.test(n.vendedor ?? '') ? 'Quino Agencia' : 'Funnelish'}</span>
                          <button onClick={() => setAbierta(n.id)} className="ml-auto px-2.5 py-1 rounded-lg border border-[#E1E5E4] text-[#0D1F1C] text-[12px] font-bold hover:bg-[#F7FAF9]">📋 Ver detalle</button>
                          <button onClick={() => abrirChat(n)} className="px-2.5 py-1 rounded-lg border border-[#25D366] text-[#128C4B] text-[12px] font-bold hover:bg-[#25D366]/10">💬 Abrir chat</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {verAvisoOficina && <AvisoOficina onCerrar={() => setVerAvisoOficina(false)} />}
      {verAvisoIntento && <AvisoOficina config={AVISO_INTENTO} onCerrar={() => setVerAvisoIntento(false)} />}
      {verAvisoDireccion && <AvisoOficina config={AVISO_DIRECCION} onCerrar={() => setVerAvisoDireccion(false)} />}
      {verAvisoIncompleta && <AvisoOficina config={AVISO_INCOMPLETA} onCerrar={() => setVerAvisoIncompleta(false)} />}
      {verAvisoCancelado && <AvisoOficina config={AVISO_CANCELADO} onCerrar={() => setVerAvisoCancelado(false)} />}
      {sel && <Detalle n={sel} onCerrar={() => setAbierta(null)} onCambio={cargar} onChat={() => abrirChat(sel)} />}

      {sinChat && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4" onClick={() => setSinChat(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-2">💬</div>
            <p className="font-extrabold text-[#0D1F1C]">No se encontró una conversación de este cliente en Quinchat</p>
            <p className="text-sm text-[#5B6B68] mt-1">{sinChat.cliente ?? ''} · {sinChat.tel}</p>
            <div className="flex flex-col gap-2 mt-5">
              <a href={`https://wa.me/57${sinChat.tel}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 rounded-xl bg-[#25D366] text-white font-bold text-sm">Abrir en WhatsApp</a>
              <button onClick={async () => { try { await navigator.clipboard.writeText(sinChat.tel); setAviso(`📋 Número ${sinChat.tel} copiado`); } catch { setAviso(`Número: ${sinChat.tel}`); } setSinChat(null); }}
                className="px-4 py-2.5 rounded-xl border border-[#E1E5E4] font-bold text-sm">📋 Copiar número</button>
              <button onClick={() => setSinChat(null)} className="text-sm text-[#5B6B68] mt-1">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Copia al portapapeles y avisa. */
async function copiar(texto: string, aviso: (m: string) => void, que: string) {
  try { await navigator.clipboard.writeText(texto); aviso(`📋 ${que} copiado`); }
  catch { aviso(`${que}: ${texto}`); }
}
/** Página de rastreo de la transportadora (la guía se copia antes, por si la página no la recibe sola). */
function urlRastreo(transportadora: string | null | undefined, guia: string): string | null {
  const t = String(transportadora ?? '').toUpperCase();
  if (/COORDINADORA/.test(t)) return `https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia=${encodeURIComponent(guia)}`;
  if (/INTER/.test(t)) return 'https://www.interrapidisimo.com/sigue-tu-envio/';
  if (/ENV[IÍ]A/.test(t)) return 'https://envia.co/';
  return null;
}
const diasDesde = (iso: string | null | undefined) => {
  const t = Date.parse(String(iso ?? '').replace(' ', 'T')); if (!t) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400_000));
};

function Detalle({ n, onCerrar, onCambio, onChat }: { n: Novedad; onCerrar: () => void; onCambio: () => Promise<void>; onChat: () => void }) {
  const [full, setFull] = useState<Novedad | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);
  const [nEffi, setNEffi] = useState<any[]>([]);
  const [avisosR, setAvisosR] = useState<any[]>([]);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const avisar = (m: string) => { setToast(m); setTimeout(() => setToast(t => (t === m ? null : t)), 2200); };

  const traer = useCallback(async () => {
    const r = await fetch(`/api/novedades/${n.id}`, { cache: 'no-store' }); const j = await r.json().catch(() => ({}));
    if (j.novedad) { setFull(j.novedad); setHist(j.historial ?? []); setNEffi(j.novedades_effi ?? []); setAvisosR(j.avisos ?? []); }
  }, [n.id]);

  // Al abrirla: queda vista (Nueva → Pendiente)
  useEffect(() => {
    (async () => {
      if (!n.visto_at) { await fetch(`/api/novedades/${n.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visto: true }) }); await onCambio(); }
      await traer();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.id]);

  const enviar = async (cuerpo: Record<string, any>) => {
    setGuardando(true);
    await fetch(`/api/novedades/${n.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    setGuardando(false); setNota(''); await traer(); await onCambio();
  };

  const d = full ?? n;
  const est = estiloDe(d.estado);
  const ult = nEffi[0] ?? null;
  const direccion = [d.direccion, d.ciudad, d.departamento].filter(Boolean).join(', ');
  const ficha = [
    `Cliente: ${d.cliente ?? ''}`, `Teléfono: ${d.telefono ?? d.telefono_original ?? ''}`, `Dirección: ${direccion}`,
    `Producto: ${d.producto ?? ''}${d.talla ? ` · ${d.talla}` : ''}`, `Valor a cobrar: ${pesos(d.valor_recaudo)}`,
    `Remisión: ${d.id_remision ?? ''} · Guía: ${d.guia ?? ''} (${d.transportadora ?? ''})`,
    `Novedad: ${d.novedad_texto ?? d.motivo ?? ''}`, ult?.estado ? `Estado novedad: ${ult.estado}` : '',
  ].filter(Boolean).join('\n');
  const rastreo = d.guia ? urlRastreo(d.transportadora, d.guia) : null;
  const antig = diasDesde(ult?.fecha_effi ?? d.fecha_novedad ?? d.detectada_at);

  const fila = (k: string, v: React.ReactNode, copia?: string | null) => (
    <div className="flex gap-3 py-1.5 border-b border-[#F1F5F4] text-[13px] items-start">
      <span className="w-36 shrink-0 text-[#5B6B68]">{k}</span>
      <span className="flex-1 min-w-0 text-[#0D1F1C] break-words">{v ?? '—'}</span>
      {copia && <button onClick={() => copiar(copia, avisar, k)} title={`Copiar ${k.toLowerCase()}`} className="shrink-0 px-1.5 rounded text-[12px] text-[#5B6B68] hover:bg-[#F1F5F4]">📋</button>}
    </div>
  );
  const boton = 'px-3 py-2 rounded-xl border border-[#E1E5E4] text-[12.5px] font-bold hover:bg-[#F7FAF9] text-center';

  return (
    <div className="fixed inset-0 z-[85] bg-black/50 flex items-center justify-center p-3" onClick={onCerrar}>
      <div className="relative w-full max-w-5xl max-h-full overflow-auto bg-white rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#E8ECEB] flex items-center gap-3 sticky top-0 bg-white z-10">
          <div className="flex-1 min-w-0">
            <p className="text-lg font-extrabold text-[#0D1F1C] truncate">{d.cliente ?? 'Sin nombre'}</p>
            <p className="text-[13px] font-bold text-[#B54708] line-clamp-2">⚠️ {d.motivo ?? 'Novedad'}</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: est.bg, color: est.c }}>{est.t.replace(/s$/, '')}</span>
          <button onClick={onCerrar} className="text-xl text-[#5B6B68] px-2">✕</button>
        </div>

        {/* Acciones rápidas */}
        <div className="px-5 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={() => d.guia && copiar(d.guia, avisar, 'Guía')} disabled={!d.guia} className={boton}>📋 Copiar guía</button>
          <button onClick={() => copiar(d.telefono ?? d.telefono_original ?? '', avisar, 'Teléfono')} className={boton}>📱 Copiar teléfono</button>
          <button onClick={() => copiar(direccion, avisar, 'Dirección')} className={boton}>📍 Copiar dirección</button>
          <button onClick={() => copiar(ficha, avisar, 'Ficha completa')} className={boton}>🗂 Copiar ficha</button>
          {rastreo && <button onClick={async () => { if (d.guia) await copiar(d.guia, avisar, 'Guía'); window.open(rastreo, '_blank', 'noopener'); }} className={boton}>🔍 Rastrear en {String(d.transportadora ?? '').split(' ')[0].toLowerCase().replace(/^./, c => c.toUpperCase())}</button>}
          {d.url_guia && <a href={d.url_guia} target="_blank" rel="noopener noreferrer" className={boton}>📄 Guía en PDF</a>}
          {ult?.foto && <a href={ult.foto} target="_blank" rel="noopener noreferrer" className={boton}>📷 Foto de la novedad</a>}
          <button onClick={onChat} className="px-3 py-2 rounded-xl bg-[#25D366] text-white text-[12.5px] font-bold">💬 Abrir chat</button>
        </div>

        <div className="grid md:grid-cols-[240px_1fr] gap-5 p-5">
          <div className="flex flex-col gap-3">
            <div className="aspect-square rounded-xl overflow-hidden bg-[#F1F5F4] flex items-center justify-center text-5xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {d.foto ? <img src={d.foto} alt="" className="w-full h-full object-cover" /> : '📦'}
            </div>
            <div>
              <p className="text-[12px] font-bold text-[#5B6B68] mb-1.5">Estado de gestión</p>
              <div className="grid grid-cols-2 gap-1.5">
                {ESTADOS.filter(e => e.k !== 'todas').map(e => (
                  <button key={e.k} disabled={guardando || d.estado === e.k} onClick={() => enviar({ estado: e.k })}
                    className="px-2 py-1.5 rounded-lg text-[12px] font-bold border disabled:cursor-default"
                    style={{ background: d.estado === e.k ? e.bg : '#fff', color: e.c, borderColor: d.estado === e.k ? e.c : '#E8ECEB' }}>
                    {e.t.replace(/s$/, '')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 flex flex-col gap-4">
            {/* La novedad según Effi */}
            <div className="rounded-xl border border-[#FEDF89] bg-[#FFFAEB] p-3.5">
              <p className="text-[12px] font-bold text-[#B54708] mb-1">NOVEDAD EN EFFI {ult?.id ? `· ID ${ult.id}` : ''}</p>
              {ult ? (
                <>
                  <p className="text-[15px] font-extrabold text-[#0D1F1C]">{[ult.codigo, ult.nombre].filter(Boolean).join(' - ')}</p>
                  {ult.aclaracion && <p className="text-[13px] text-[#0D1F1C] mt-1 whitespace-pre-wrap">💬 <b>Aclaración:</b> {ult.aclaracion}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-[#5B6B68]">
                    {ult.estado && <span>Estado: <b className="text-[#B54708]">{ult.estado}</b></span>}
                    {ult.tipo && <span>Tipo: <b>{ult.tipo}</b></span>}
                    {ult.gestiones != null && <span>Gestiones: <b>{ult.gestiones}</b></span>}
                    {antig != null && <span>Antigüedad: <b className={antig >= 3 ? 'text-[#B42318]' : ''}>{antig} día(s)</b></span>}
                    {ult.fecha_transportadora && <span>F. transportadora: <b>{ult.fecha_transportadora}</b></span>}
                    {ult.fecha_effi && <span>F. creación Effi: <b>{ult.fecha_effi}</b></span>}
                    {ult.fecha_solucion && <span>Solucionada: <b>{ult.fecha_solucion}</b></span>}
                  </div>
                </>
              ) : <p className="text-[13px] text-[#5B6B68]">Effi no tiene registro en «Novedades de guías» para esta guía. Estado de la transportadora: <b>{d.estado_effi ?? '—'}</b></p>}
            </div>

            <div>
              {fila('Teléfono', d.telefono ? `${d.telefono}${d.telefono_original && d.telefono_original.replace(/\D/g, '') !== d.telefono ? ` (Effi: ${d.telefono_original})` : ''}` : <span className="text-[#B42318]">{d.telefono_original || 'vacío'} — verifícalo en Effi</span>, d.telefono ?? d.telefono_original)}
              {fila('Dirección', direccion, direccion)}
              {fila('Producto', `${d.producto ?? 'No identificado'}${d.talla ? ` · ${d.talla}` : ''}`)}
              {fila('Contenido en Effi', d.contenido_effi)}
              {fila('Valor a cobrar', pesos(d.valor_recaudo))}
              {fila('Guía', d.guia ? `${d.guia} (${d.transportadora ?? '—'})` : null, d.guia)}
              {fila('Remisión', d.id_remision, d.id_remision)}
              {fila('Vendedor Effi', d.vendedor)}
              {fila('Estado transportadora', d.estado_effi)}
              {fila('Estado Effi', d.estado_effi_comercio)}
              {ult?.servicio && fila('Servicio', ult.servicio)}
              {ult?.flete && fila('Flete', pesos(Number(ult.flete)))}
              {fila('Observación Effi', d.observacion_effi)}
              {fila('Guía creada', fecha(d.fecha_guia))}
              {fila('En QuinChat desde', fecha(d.detectada_at))}
              {d.resultado && fila('Resultado', RESULTADO[d.resultado] ?? d.resultado)}
            </div>

            {(n.aplica_cancelado || n.reentrega_solicitada || n.cancelacion_definitiva) && (
              <div className="rounded-xl border border-[#FECDCA] bg-[#FFFBFA] p-3.5">
                <p className="text-[12px] font-bold text-[#B42318] mb-2">🛑 PEDIDO CANCELADO · ¿qué hacemos?</p>
                <div className="flex gap-2 flex-wrap">
                  <button disabled={guardando} onClick={() => { enviar({ reentrega_solicitada: !n.reentrega_solicitada }); avisar(n.reentrega_solicitada ? 'Se quitó la nueva entrega' : '🚚 Marcada para nueva entrega'); }}
                    className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold border ${n.reentrega_solicitada ? 'bg-[#067647] text-white border-transparent' : 'border-[#ABEFC6] text-[#067647] bg-white'}`}>
                    🚚 {n.reentrega_solicitada ? 'Nueva entrega marcada ✓' : 'Acepta recibir: nueva entrega'}
                  </button>
                  <button disabled={guardando} onClick={() => { if (n.cancelacion_definitiva || confirm('¿Marcar cancelación DEFINITIVA? No se le enviarán más mensajes automáticos.')) { enviar({ cancelacion_definitiva: !n.cancelacion_definitiva }); } }}
                    className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold border ${n.cancelacion_definitiva ? 'bg-[#B42318] text-white border-transparent' : 'border-[#FECDCA] text-[#B42318] bg-white'}`}>
                    🛑 {n.cancelacion_definitiva ? 'Cancelación definitiva ✓' : 'Cancelación definitiva'}
                  </button>
                </div>
                <p className="text-[11px] text-[#5B6B68] mt-1.5">Si el cliente responde «Sí, quiero recibirlo» se marca solo la nueva entrega; si dice que no lo quiere, se marca la cancelación y no se le escribe más.</p>
              </div>
            )}
            {(n.aplica_incompleta || n.aplica_direccion || d.direccion_corregida) && (
              <DireccionCorregida d={d} direccion={direccion} respuestas={avisosR.flatMap(a => (Array.isArray(a.respuestas) ? a.respuestas : []).filter((r: any) => r.tipo === 'text').map((r: any) => r.contenido))}
                onGuardar={async (dir, confirmar) => { await enviar({ direccion_corregida: dir, confirmar_direccion: confirmar }); avisar(confirmar ? '✅ Dirección confirmada' : '💾 Borrador guardado'); }}
                onCopiar={t => copiar(t, avisar, 'Dirección corregida')} />
            )}
            {avisosR.filter(a => a.estado === 'enviado').map(a => {
              const rs: any[] = Array.isArray(a.respuestas) ? a.respuestas : [];
              const fotos = rs.filter(r => r.tipo === 'image');
              const textos = rs.filter(r => r.tipo !== 'image');
              const paraTransportadora = [
                `Guía: ${d.guia ?? ''} (${d.transportadora ?? ''})`, `Destinatario: ${d.cliente ?? ''} · Tel: ${d.telefono ?? ''}`,
                `Dirección en la guía: ${direccion}`, ...textos.map(r => `Cliente: ${r.contenido}`), ...fotos.map(r => `Foto: ${r.contenido}`),
              ].join('\n');
              return (
                <div key={a.clave} className="rounded-xl border border-[#D9D6FE] bg-[#F9F8FF] p-3.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[12px] font-bold text-[#5925DC] flex-1">📲 AVISO «{String(a.tipo).toUpperCase()}» · enviado {fecha(a.enviado_at)}</p>
                    {rs.length > 0 && <button onClick={() => copiar(paraTransportadora, avisar, 'Datos para la transportadora')} className="px-2.5 py-1 rounded-lg bg-[#6D28D9] text-white text-[11.5px] font-bold">📋 Copiar para la transportadora</button>}
                  </div>
                  {!rs.length ? <p className="text-[12.5px] text-[#5B6B68] mt-1">El cliente aún no responde.</p> : (
                    <div className="mt-2 flex flex-col gap-2">
                      {textos.map(r => (
                        <div key={r.id} className="text-[13px] text-[#0D1F1C] bg-white rounded-lg border border-[#ECE9FE] px-2.5 py-1.5 flex gap-2">
                          <span className="flex-1 whitespace-pre-wrap break-words">{r.tipo === 'location' ? '📍 ' : r.tipo === 'audio' ? '🎙️ ' : '💬 '}{r.tipo === 'text' ? r.contenido : <a href={r.contenido} target="_blank" rel="noopener noreferrer" className="underline">{r.tipo}</a>}</span>
                          <span className="text-[11px] text-[#5B6B68] shrink-0">{fecha(r.at)}</span>
                        </div>
                      ))}
                      {fotos.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {fotos.map(r => (
                            <a key={r.id} href={r.contenido} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-[#ECE9FE] bg-white" title={r.caption ?? 'Foto del cliente'}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={r.contenido} alt="" className="w-full aspect-square object-cover" />
                              <p className="text-[10.5px] text-[#5B6B68] px-1.5 py-0.5 truncate">{r.caption || fecha(r.at)}</p>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {nEffi.length > 1 && (
              <div>
                <p className="text-[12px] font-bold text-[#5B6B68] mb-1.5">Todas las novedades de esta guía en Effi ({nEffi.length})</p>
                <div className="flex flex-col gap-1.5">
                  {nEffi.map(x => (
                    <div key={x.id} className="rounded-lg border border-[#E8ECEB] px-3 py-2 text-[12.5px]">
                      <p className="font-bold">{[x.codigo, x.nombre].filter(Boolean).join(' - ')} <span className="font-normal text-[#5B6B68]">· {x.estado ?? ''} · {x.fecha_effi ?? ''}</span></p>
                      {x.aclaracion && <p className="text-[#5B6B68]">{x.aclaracion}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[12px] font-bold text-[#5B6B68] mb-1">Agregar observación</p>
              <div className="flex gap-2">
                <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Ej: cliente dice que recoge mañana en la oficina"
                  className="flex-1 px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm resize-none" />
                <button disabled={!nota.trim() || guardando} onClick={() => enviar({ nota })} className="px-4 rounded-xl text-white text-sm font-bold disabled:opacity-40" style={{ background: VERDE }}>Guardar</button>
              </div>
            </div>

            <div>
              <p className="text-[12px] font-bold text-[#5B6B68] mb-2">Historial</p>
              <div className="flex flex-col gap-2">
                {!hist.length && <p className="text-[12px] text-[#5B6B68]">Cargando…</p>}
                {hist.map(h => (
                  <div key={h.id} className="flex gap-2.5 text-[12.5px]">
                    <span className="mt-0.5">{h.tipo === 'nota' ? '📝' : h.tipo === 'effi' ? '🚚' : '🔁'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#0D1F1C] whitespace-pre-wrap break-words">{h.detalle}</p>
                      <p className="text-[11px] text-[#5B6B68]">{fecha(h.at)} · {h.por ?? ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] px-4 py-2 rounded-full bg-[#0D1F1C] text-white text-sm font-bold shadow-lg">{toast}</div>}
      </div>
    </div>
  );
}


/** Avisos automáticos de la tarjeta: si ya se le mandó (y qué respondió) o el botón para mandarlo. */
function ZonaAvisos({ n, onListo, onAviso }: { n: Novedad; onListo: () => void; onAviso: (m: string) => void }) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const tipos = [
    { k: 'oficina' as const, aplica: n.aplica_oficina, a: n.aviso_oficina, icono: '📲', nombre: 'aviso de oficina' },
    { k: 'intento' as const, aplica: n.aplica_intento, a: n.aviso_intento, icono: '🚗', nombre: 'aviso de intento de entrega' },
    { k: 'direccion' as const, aplica: n.aplica_direccion, a: n.aviso_direccion, icono: '📍', nombre: 'aviso de dirección no localizada' },
    { k: 'incompleta' as const, aplica: n.aplica_incompleta, a: n.aviso_incompleta, icono: '🏠', nombre: 'aviso de dirección incompleta' },
    { k: 'cancelado' as const, aplica: n.aplica_cancelado && !n.cancelacion_definitiva, a: n.aviso_cancelado, icono: '🛑', nombre: 'aviso de pedido cancelado' },
  ].filter(t => t.aplica || (t.a && t.a.estado !== 'previo'));
  const marcas = (n.reentrega_solicitada || n.cancelacion_definitiva) ? (
    <div className="flex gap-1 flex-wrap">
      {n.reentrega_solicitada && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#ECFDF3] text-[#067647]">🚚 Acepta recibir · gestionar nueva entrega</span>}
      {n.cancelacion_definitiva && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3F2] text-[#B42318]">🛑 Cancelación definitiva</span>}
    </div>
  ) : null;
  if (!tipos.length) return marcas;
  const mandar = async (k: 'oficina' | 'intento' | 'direccion' | 'incompleta' | 'cancelado', nombre: string) => {
    if (!confirm(`¿Mandarle ahora el ${nombre} a ${n.cliente ?? 'este cliente'} por WhatsApp?`)) return;
    setEnviando(k);
    const r = await fetch(`/api/novedades/${n.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: k }) });
    const j = await r.json().catch(() => ({}));
    setEnviando(null);
    onAviso(r.ok ? j.mensaje : `⚠️ ${j.error ?? 'No se pudo enviar'}`);
    onListo();
  };
  return (
    <div className="flex flex-col gap-1 mt-0.5">
      {marcas}
      {tipos.map(t => {
        const e = t.a?.estado;
        if (e === 'enviado') return (
          <div key={t.k} className="rounded-lg bg-[#ECFDF3] border border-[#ABEFC6] px-2 py-1 text-[11.5px] text-[#067647]">
            <b>{t.icono} {({ oficina: 'Aviso de oficina', intento: 'Aviso de intento', direccion: 'Aviso de dirección', incompleta: 'Aviso de dirección incompleta', cancelado: 'Aviso de pedido cancelado' } as const)[t.k]} enviado</b> · {fecha(t.a!.enviado_at)} <span className="text-[#5B6B68]">(automático)</span>
            {t.a!.respuesta ? <p className="text-[#175CD3] truncate" title={t.a!.respuesta}>💬 Respondió: {t.a!.respuesta}{(t.a as any).fotos ? ` · 📷 ${(t.a as any).fotos} foto(s)` : ''}</p> : <p className="text-[#5B6B68]">Sin respuesta aún</p>}
          </div>
        );
        if (e === 'reservado') return <p key={t.k} className="text-[11.5px] text-[#175CD3]">{t.icono} Enviando {t.nombre}…</p>;
        return (
          <div key={t.k} className="rounded-lg bg-[#FFFAEB] border border-[#FEDF89] px-2 py-1 text-[11.5px] flex items-center gap-2">
            <span className="flex-1 min-w-0 text-[#B54708] truncate" title={t.a?.motivo ?? t.a?.detalle ?? ''}>
              {t.icono} {e === 'error' ? `Falló el ${t.nombre}: ${t.a?.motivo ?? t.a?.detalle ?? ''}` : e === 'omitido' ? `No se envió: ${t.a?.motivo ?? t.a?.detalle ?? ''}` : `Sin ${t.nombre}`}
            </span>
            {t.aplica && <button disabled={!!enviando} onClick={() => mandar(t.k, t.nombre)} className="shrink-0 px-2 py-0.5 rounded-md bg-[#F79009] text-white font-bold disabled:opacity-50">
              {enviando === t.k ? 'Enviando…' : e === 'error' || e === 'omitido' ? 'Reintentar' : 'Enviar'}
            </button>}
          </div>
        );
      })}
    </div>
  );
}


/**
 * Dirección corregida de la novedad (dirección incompleta / no localizada). Se guarda en QuinChat como borrador o
 * CONFIRMADA; Effi NO se modifica solo: con la dirección confirmada se copia para Effi y la transportadora.
 */
function DireccionCorregida({ d, direccion, respuestas, onGuardar, onCopiar }: {
  d: Novedad; direccion: string; respuestas: string[];
  onGuardar: (dir: string, confirmar: boolean) => Promise<void>; onCopiar: (t: string) => void;
}) {
  const [dir, setDir] = useState(d.direccion_corregida ?? d.direccion ?? '');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setDir(d.direccion_corregida ?? d.direccion ?? ''); }, [d.direccion_corregida, d.direccion]);
  const guardar = async (confirmar: boolean) => {
    if (confirmar && !confirm(`¿Confirmar esta dirección?\n\n${dir}\n\nQuedará lista para pasarla a Effi y a la transportadora (QuinChat no modifica Effi solo).`)) return;
    setGuardando(true); await onGuardar(dir, confirmar); setGuardando(false);
  };
  const paraCopiar = [`Guía: ${d.guia ?? ''} (${d.transportadora ?? ''})`, `Destinatario: ${d.cliente ?? ''} · Tel: ${d.telefono ?? ''}`,
    `Dirección corregida: ${dir}`, `${d.ciudad ?? ''}${d.departamento ? `, ${d.departamento}` : ''}`].join('\n');
  return (
    <div className={`rounded-xl border p-3.5 ${d.direccion_confirmada ? 'border-[#ABEFC6] bg-[#F6FEF9]' : 'border-[#B2DDFF] bg-[#F5FAFF]'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[12px] font-bold text-[#175CD3] flex-1">🏠 DIRECCIÓN CORREGIDA {d.direccion_confirmada ? <span className="text-[#067647]">· ✅ CONFIRMADA</span> : d.direccion_corregida ? '· borrador' : ''}</p>
        {d.direccion_corregida_at && <span className="text-[11px] text-[#5B6B68]">{fecha(d.direccion_corregida_at)} · {d.direccion_corregida_por ?? ''}</span>}
      </div>
      <p className="text-[12px] text-[#5B6B68] mt-1">En Effi: <b>{direccion || '—'}</b></p>
      {respuestas.length > 0 && <p className="text-[12px] text-[#175CD3] mt-1">💬 El cliente dijo: {respuestas.slice(-3).join(' · ')}</p>}
      <textarea value={dir} onChange={e => setDir(e.target.value)} rows={2} placeholder="Dirección completa con torre, apartamento, barrio y referencia"
        className="mt-2 w-full px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm resize-none bg-white" />
      <div className="flex gap-2 mt-2 flex-wrap">
        <button disabled={guardando || !dir.trim()} onClick={() => guardar(false)} className="px-3 py-1.5 rounded-lg border border-[#E1E5E4] bg-white text-[12.5px] font-bold disabled:opacity-40">💾 Guardar borrador</button>
        <button disabled={guardando || !dir.trim()} onClick={() => guardar(true)} className="px-3 py-1.5 rounded-lg bg-[#067647] text-white text-[12.5px] font-bold disabled:opacity-40">✅ Confirmar dirección</button>
        {d.direccion_confirmada && <button onClick={() => onCopiar(paraCopiar)} className="px-3 py-1.5 rounded-lg bg-[#175CD3] text-white text-[12.5px] font-bold">📋 Copiar para Effi / transportadora</button>}
      </div>
      <p className="text-[11px] text-[#5B6B68] mt-1.5">QuinChat no cambia la dirección en Effi automáticamente: confírmala aquí y pásala a Effi o a la transportadora.</p>
    </div>
  );
}

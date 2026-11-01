'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * LÍNEA DE TIEMPO VISUAL (estilo editor de video).
 * Video arriba + regla + 3 pistas (Productos · Preguntas · Preguntas frecuentes) + cabezal.
 * Pausas en el segundo que quieres → "+ Pregunta aquí" → queda puesta en ese momento.
 * Los bloques se arrastran para moverlos y se estiran desde sus bordes.
 * Trabaja sobre el MISMO estado `timeline` del editor (se guarda con "Guardar todo").
 */

type Tipo = 'producto' | 'pregunta_frecuente' | 'comentario' | 'catalogo';
export interface EventoVis {
  tipo: Tipo; inicio_seg: number; fin_seg: number; producto_id?: string | null;
  pregunta?: string; respuesta?: string; autor?: string; texto?: string;
  /** Catálogo flotante: productos, posición (% de pantalla) y título. */
  productos_ids?: string[]; pos_x?: number; pos_y?: number; titulo?: string;
}
interface Prod { id: string; nombre: string; colores?: { foto_url: string }[] }

const fmt = (s: number) => {
  const x = Math.max(0, s); const m = Math.floor(x / 60); const r = Math.floor(x % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};
const fmtFino = (s: number) => `${fmt(s)}.${Math.floor((Math.max(0, s) % 1) * 10)}`;
const snap = (s: number) => Math.round(s * 2) / 2; // pasos de medio segundo

const PISTAS: { tipo: Tipo; nombre: string; color: string; borde: string }[] = [
  { tipo: 'producto', nombre: '🛍️ Productos', color: 'bg-[#00A89D]', borde: 'border-[#007A72]' },
  { tipo: 'comentario', nombre: '💬 Preguntas', color: 'bg-[#ff3366]', borde: 'border-[#c81e4b]' },
  { tipo: 'pregunta_frecuente', nombre: '✓ Frecuentes', color: 'bg-violet-500', borde: 'border-violet-700' },
  { tipo: 'catalogo', nombre: '🗂️ Catálogos', color: 'bg-amber-500', borde: 'border-amber-700' },
];

export default function LineaTiempoVisual({ videoUrl, duracionInicial, timeline, setTimeline, productos }: {
  videoUrl: string | null; duracionInicial: number | null;
  timeline: EventoVis[]; setTimeline: (t: EventoVis[]) => void; productos: Prod[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contenidoRef = useRef<HTMLDivElement>(null);
  const monitorRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [durVideo, setDurVideo] = useState<number>(duracionInicial || 0);
  const [play, setPlay] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [ancho, setAncho] = useState(700);
  const [sel, setSel] = useState<number | null>(null);
  const [nueva, setNueva] = useState<{ seg: number; nombre: string; texto: string } | null>(null);

  // Ancho visible de la zona de pistas (para calcular píxeles por segundo)
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setAncho(el.clientWidth));
    ro.observe(el); setAncho(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const durTotal = Math.max(durVideo || 0, ...timeline.map(e => e.fin_seg), 30);
  const pps = Math.max(2, ((ancho - 16) / durTotal) * zoom); // píxeles por segundo
  const anchoTotal = Math.ceil(durTotal * pps) + 16;
  const pasos = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const paso = pasos.find(p => p * pps >= 70) ?? 600;

  const seek = useCallback((s: number) => {
    const x = Math.max(0, Math.min(durTotal, s));
    if (videoRef.current) videoRef.current.currentTime = x;
    setT(x);
  }, [durTotal]);

  const segDeX = (clientX: number) => {
    const r = contenidoRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.max(0, Math.min(durTotal, (clientX - r.left - 8) / pps));
  };

  // Clic o arrastre sobre la regla → mover el cabezal
  const arrastrarCabezal = (e: React.PointerEvent) => {
    e.preventDefault();
    seek(segDeX(e.clientX));
    const mover = (ev: PointerEvent) => seek(segDeX(ev.clientX));
    const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); };
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
  };

  // Arrastrar un bloque (mover) o sus bordes (estirar)
  const arrastrarBloque = (e: React.PointerEvent, idx: number, modo: 'mover' | 'ini' | 'fin') => {
    e.preventDefault(); e.stopPropagation();
    setSel(idx);
    const base = timeline.map(x => ({ ...x }));
    const x0 = e.clientX;
    const ev0 = base[idx];
    const largo = ev0.fin_seg - ev0.inicio_seg;
    const mover = (ev: PointerEvent) => {
      const d = (ev.clientX - x0) / pps;
      const n = { ...ev0 };
      if (modo === 'mover') {
        n.inicio_seg = snap(Math.max(0, Math.min(durTotal - largo, ev0.inicio_seg + d)));
        n.fin_seg = n.inicio_seg + largo;
      } else if (modo === 'ini') {
        n.inicio_seg = snap(Math.max(0, Math.min(ev0.fin_seg - 1, ev0.inicio_seg + d)));
      } else {
        n.fin_seg = snap(Math.max(ev0.inicio_seg + 1, Math.min(durTotal, ev0.fin_seg + d)));
      }
      setTimeline(base.map((x, i) => (i === idx ? n : x)));
    };
    const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); };
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
  };

  // Seguir el cabezal mientras se reproduce
  useEffect(() => {
    const sc = scrollRef.current; if (!sc || !play) return;
    const x = t * pps;
    if (x < sc.scrollLeft + 20 || x > sc.scrollLeft + sc.clientWidth - 40) sc.scrollLeft = Math.max(0, x - 60);
  }, [t, pps, play]);

  const alternarPlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { v.play().catch(() => {}); } else { v.pause(); }
  };
  const pausar = () => { videoRef.current?.pause(); };

  const abrirPregunta = () => { pausar(); setNueva({ seg: snap(t), nombre: '', texto: '' }); };
  const guardarPregunta = () => {
    if (!nueva || !nueva.texto.trim()) return;
    const ev: EventoVis = { tipo: 'comentario', inicio_seg: nueva.seg, fin_seg: Math.min(durTotal, nueva.seg + 10) || nueva.seg + 10, autor: nueva.nombre.trim(), texto: nueva.texto.trim().slice(0, 140) };
    const lista = [...timeline, ev];
    setTimeline(lista);
    setSel(lista.length - 1);
    setNueva(null);
  };
  const agregar = (tipo: Tipo) => {
    pausar();
    const ini = snap(t);
    const ev: EventoVis = tipo === 'producto'
      ? { tipo, inicio_seg: ini, fin_seg: Math.min(durTotal, ini + 30), producto_id: productos[0]?.id ?? null }
      : tipo === 'catalogo'
      ? { tipo, inicio_seg: ini, fin_seg: Math.min(durTotal, ini + 20), productos_ids: productos.slice(0, 3).map(p => p.id), pos_x: 4, pos_y: 40, titulo: '' }
      : { tipo, inicio_seg: ini, fin_seg: Math.min(durTotal, ini + 15), pregunta: '', respuesta: '' };
    if (ev.fin_seg <= ev.inicio_seg) ev.fin_seg = ev.inicio_seg + 5;
    const lista = [...timeline, ev];
    setTimeline(lista); setSel(lista.length - 1);
  };
  const editarSel = (patch: Partial<EventoVis>) => {
    if (sel === null) return;
    setTimeline(timeline.map((e, i) => (i === sel ? { ...e, ...patch } : e)));
  };
  const borrarSel = () => {
    if (sel === null) return;
    setTimeline(timeline.filter((_, i) => i !== sel)); setSel(null);
  };

  const etiqueta = (e: EventoVis) => e.tipo === 'producto'
    ? (productos.find(p => p.id === e.producto_id)?.nombre ?? 'Elige producto')
    : e.tipo === 'catalogo' ? (e.titulo || `Catálogo (${(e.productos_ids ?? []).length})`)
    : e.tipo === 'comentario' ? `${e.autor ? e.autor + ': ' : ''}${e.texto || 'Pregunta sin texto'}`
    : (e.pregunta || 'Pregunta frecuente');

  // Lo que se ve en el live en el segundo actual (mini vista previa)
  const prodAhora = timeline.find(e => e.tipo === 'producto' && e.inicio_seg <= t && t < e.fin_seg);
  const pregAhora = timeline.filter(e => (e.tipo === 'comentario' || e.tipo === 'pregunta_frecuente') && e.inicio_seg <= t && t < e.inicio_seg + 6).slice(-2);
  const catAhora = timeline.map((e, idx) => ({ e, idx })).filter(({ e }) => e.tipo === 'catalogo' && e.inicio_seg <= t && t < e.fin_seg);

  // Arrastrar el catálogo dentro del monitor → guarda la posición en % (misma regla que el live)
  const arrastrarCatalogo = (ev: React.PointerEvent<HTMLDivElement>, idx: number) => {
    ev.preventDefault(); ev.stopPropagation();
    setSel(idx);
    const mon = monitorRef.current?.getBoundingClientRect();
    const caja = ev.currentTarget.getBoundingClientRect();
    if (!mon) return;
    const offX = ev.clientX - caja.left, offY = ev.clientY - caja.top;
    const libreX = Math.max(1, mon.width - caja.width), libreY = Math.max(1, mon.height - caja.height);
    const base = timeline.map(x => ({ ...x }));
    const mover = (pe: PointerEvent) => {
      const izq = Math.max(0, Math.min(libreX, pe.clientX - mon.left - offX));
      const arr = Math.max(0, Math.min(libreY, pe.clientY - mon.top - offY));
      const pos_x = Math.round((izq / libreX) * 100), pos_y = Math.round((arr / libreY) * 100);
      setTimeline(base.map((x, i) => (i === idx ? { ...x, pos_x, pos_y } : x)));
    };
    const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); };
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
  };
  const evSel = sel !== null ? timeline[sel] : null;

  return (
    <div className="rounded-2xl bg-[#1e1e1e] text-neutral-200 p-3 select-none">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Monitor de programa */}
        <div ref={monitorRef} className="relative mx-auto md:mx-0 w-[180px] h-[320px] shrink-0 rounded-xl overflow-hidden bg-black border border-neutral-700">
          {videoUrl
            ? <video ref={videoRef} src={videoUrl} className="w-full h-full object-cover" playsInline preload="metadata"
                onLoadedMetadata={e => { const d = e.currentTarget.duration; if (isFinite(d) && d > 0) setDurVideo(d); }}
                onTimeUpdate={e => setT(e.currentTarget.currentTime)}
                onPlay={() => setPlay(true)} onPause={() => setPlay(false)} />
            : <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500 p-3 text-center">Agrega la URL del video en “Datos del live” para verlo aquí.</div>}
          <div className="absolute inset-x-1.5 bottom-1.5 space-y-1 pointer-events-none">
            {pregAhora.map((e, i) => (
              <div key={i} className={`text-[9px] leading-tight rounded-lg px-1.5 py-1 ${e.tipo === 'comentario' ? 'bg-black/60 text-white' : 'bg-[#00A89D]/90 text-white'}`}>
                {e.tipo === 'comentario' ? <><b>{e.autor || 'Cliente'}</b> {e.texto}</> : <><b>✓</b> {e.pregunta}</>}
              </div>
            ))}
            {prodAhora && <div className="text-[9px] font-bold rounded-lg px-1.5 py-1 bg-white text-black truncate">🛍️ {etiqueta(prodAhora)}</div>}
          </div>
          {/* Catálogos flotantes del momento: se arrastran para ubicarlos */}
          {catAhora.map(({ e, idx }) => {
            const x = Math.max(0, Math.min(100, e.pos_x ?? 4)), y = Math.max(0, Math.min(100, e.pos_y ?? 40));
            const prods = (e.productos_ids ?? []).map(id => productos.find(p => p.id === id)).filter(Boolean) as Prod[];
            return (
              <div key={idx} onPointerDown={ev => arrastrarCatalogo(ev, idx)} title="Arrástralo para ubicarlo"
                className={`absolute z-10 cursor-move touch-none rounded-lg bg-black/65 border p-[3px] max-w-[94%] ${sel === idx ? 'border-amber-400 ring-1 ring-amber-400' : 'border-white/30'}`}
                style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-${x}%, -${y}%)` }}>
                {e.titulo && <p className="text-[7px] font-extrabold uppercase text-[#ffd33d] px-0.5 pb-0.5 truncate">🛍️ {e.titulo}</p>}
                <div className="flex gap-[3px]">
                  {(prods.length ? prods : [{ id: 'x', nombre: 'Sin productos' } as Prod]).slice(0, 4).map(p => (
                    <div key={p.id} className="w-[38px] rounded bg-white overflow-hidden">
                      <div className="h-[30px] bg-white">{p.colores?.[0]?.foto_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.colores[0].foto_url} alt="" className="w-full h-full object-contain" draggable={false} />}</div>
                      <div className="text-[5.5px] leading-tight text-black font-bold px-0.5 truncate">{p.nombre}</div>
                      <div className="m-[2px] rounded-sm bg-black text-white text-[5px] font-extrabold text-center py-[1px]">COMPRAR</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Controles + acciones */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => seek(t - 5)} className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs" title="Atrás 5 s">⏪ 5s</button>
            <button onClick={alternarPlay} disabled={!videoUrl} className="w-10 h-9 rounded-lg bg-neutral-100 text-black font-bold disabled:opacity-40">{play ? '❚❚' : '▶'}</button>
            <button onClick={() => seek(t + 5)} className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs" title="Adelante 5 s">5s ⏩</button>
            <span className="font-mono text-[#4da3ff] text-sm">{fmtFino(t)}</span>
            <span className="font-mono text-neutral-500 text-xs">/ {fmt(durTotal)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={abrirPregunta} className="px-3 py-2 rounded-xl bg-[#ff3366] hover:opacity-90 text-white text-sm font-bold">💬 + Pregunta aquí ({fmt(t)})</button>
            <button onClick={() => agregar('producto')} className="px-3 py-2 rounded-xl bg-[#00A89D] hover:opacity-90 text-white text-xs font-semibold">🛍️ + Producto aquí</button>
            <button onClick={() => agregar('pregunta_frecuente')} className="px-3 py-2 rounded-xl bg-violet-600 hover:opacity-90 text-white text-xs font-semibold">✓ + Pregunta frecuente aquí</button>
            <button onClick={() => agregar('catalogo')} disabled={!productos.length} className="px-3 py-2 rounded-xl bg-amber-500 hover:opacity-90 text-black text-xs font-bold disabled:opacity-40">🗂️ + Catálogo aquí</button>
          </div>

          {nueva && (
            <div className="rounded-xl bg-neutral-800 border border-[#ff3366]/60 p-2.5 space-y-2">
              <p className="text-xs text-neutral-300">Nueva pregunta en el segundo <b className="text-white">{fmt(nueva.seg)}</b> — sale en el chat y la respondes en el video.</p>
              <div className="flex gap-2">
                <input autoFocus className="w-32 rounded-lg bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-sm text-white" placeholder="Nombre" value={nueva.nombre} onChange={e => setNueva({ ...nueva, nombre: e.target.value })} />
                <input className="flex-1 min-w-0 rounded-lg bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-sm text-white" placeholder="¿Lo tienen en talla XL?" maxLength={140}
                  value={nueva.texto} onChange={e => setNueva({ ...nueva, texto: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') guardarPregunta(); }} />
              </div>
              <div className="flex gap-2">
                <button onClick={guardarPregunta} className="px-3 py-1.5 rounded-lg bg-[#ff3366] text-white text-xs font-bold">Agregar (Enter)</button>
                <button onClick={() => setNueva(null)} className="px-3 py-1.5 rounded-lg bg-neutral-700 text-xs">Cancelar</button>
              </div>
            </div>
          )}

          {evSel && !nueva && (
            <div className="rounded-xl bg-neutral-800 border border-neutral-600 p-2.5 space-y-2 text-sm">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <b className="text-white">{evSel.tipo === 'producto' ? 'Producto' : evSel.tipo === 'comentario' ? 'Pregunta' : evSel.tipo === 'catalogo' ? 'Catálogo flotante' : 'Pregunta frecuente'}</b>
                <span className="text-neutral-400">del</span>
                <input type="number" step="0.5" className="w-16 rounded bg-neutral-900 border border-neutral-700 px-1 py-0.5 text-white" value={evSel.inicio_seg} onChange={e => editarSel({ inicio_seg: Math.max(0, Number(e.target.value)) })} />
                <span className="text-neutral-400">al</span>
                <input type="number" step="0.5" className="w-16 rounded bg-neutral-900 border border-neutral-700 px-1 py-0.5 text-white" value={evSel.fin_seg} onChange={e => editarSel({ fin_seg: Number(e.target.value) })} />
                <span className="text-neutral-400">seg</span>
                <button onClick={() => seek(evSel.inicio_seg)} className="ml-auto px-2 py-1 rounded bg-neutral-700">Ir ▶</button>
                <button onClick={borrarSel} className="px-2 py-1 rounded bg-red-600 text-white">Eliminar</button>
              </div>
              {evSel.tipo === 'producto' && (
                <select className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-white" value={evSel.producto_id ?? ''} onChange={e => editarSel({ producto_id: e.target.value })}>
                  <option value="">— elige producto —</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              )}
              {evSel.tipo === 'catalogo' && (
                <div className="space-y-2">
                  <input className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-white" placeholder="Título (opcional), ej. Más vendidos" maxLength={40}
                    value={evSel.titulo ?? ''} onChange={e => editarSel({ titulo: e.target.value })} />
                  <div>
                    <p className="text-[11px] text-neutral-400 mb-1">Productos del catálogo (toca para agregar o quitar, máx. 8):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {productos.map(p => {
                        const on = (evSel.productos_ids ?? []).includes(p.id);
                        return (
                          <button key={p.id} type="button"
                            onClick={() => {
                              const act = evSel.productos_ids ?? [];
                              editarSel({ productos_ids: on ? act.filter(x => x !== p.id) : [...act, p.id].slice(0, 8) });
                            }}
                            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] border ${on ? 'bg-amber-500 border-amber-400 text-black font-bold' : 'bg-neutral-900 border-neutral-700 text-neutral-300'}`}>
                            {p.colores?.[0]?.foto_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.colores[0].foto_url} alt="" className="w-5 h-5 rounded object-cover" />}
                            {on ? '✓ ' : ''}{p.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                    <span className="text-neutral-400">Posición:</span>
                    {([['↖', 2, 12], ['↗', 98, 12], ['⬅ Centro', 2, 50], ['Centro ➡', 98, 50], ['↙', 2, 72], ['↘', 98, 72]] as [string, number, number][]).map(([l, x, y]) => (
                      <button key={l} type="button" onClick={() => editarSel({ pos_x: x, pos_y: y })} className="px-2 py-1 rounded bg-neutral-700 hover:bg-neutral-600">{l}</button>
                    ))}
                    <span className="text-neutral-500">· x {Math.round(evSel.pos_x ?? 4)}% · y {Math.round(evSel.pos_y ?? 40)}%</span>
                  </div>
                  <p className="text-[11px] text-amber-300/90">Tip: con el video en este tramo, arrastra el catálogo en la pantallita de la izquierda para ponerlo donde quieras.</p>
                </div>
              )}
              {evSel.tipo === 'comentario' && (
                <div className="flex gap-2">
                  <input className="w-32 rounded-lg bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-white" placeholder="Nombre" value={evSel.autor ?? ''} onChange={e => editarSel({ autor: e.target.value })} />
                  <input className="flex-1 min-w-0 rounded-lg bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-white" placeholder="Pregunta" maxLength={140} value={evSel.texto ?? ''} onChange={e => editarSel({ texto: e.target.value })} />
                </div>
              )}
              {evSel.tipo === 'pregunta_frecuente' && (
                <div className="space-y-1.5">
                  <input className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-white" placeholder="Pregunta" value={evSel.pregunta ?? ''} onChange={e => editarSel({ pregunta: e.target.value })} />
                  <input className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-white" placeholder="Respuesta del equipo" value={evSel.respuesta ?? ''} onChange={e => editarSel({ respuesta: e.target.value })} />
                </div>
              )}
            </div>
          )}
          {!evSel && !nueva && <p className="text-[11px] text-neutral-400">Reproduce el video, pausa donde quieras y toca <b className="text-white">+ Pregunta aquí</b>. Toca un bloque para editarlo, arrástralo para moverlo o estíralo desde sus bordes.</p>}
        </div>
      </div>

      {/* Zoom */}
      <div className="flex items-center justify-end gap-2 mt-3 mb-1 text-xs">
        <span className="text-neutral-400">Zoom</span>
        <button onClick={() => setZoom(z => Math.max(1, z / 1.5))} className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700">−</button>
        <button onClick={() => setZoom(z => Math.min(20, z * 1.5))} className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700">+</button>
      </div>

      {/* Pistas */}
      <div className="flex rounded-xl overflow-hidden border border-neutral-700 bg-[#232323]">
        <div className="w-24 md:w-28 shrink-0 border-r border-neutral-700 bg-[#2a2a2a]">
          <div className="h-7 border-b border-neutral-700" />
          {PISTAS.map(p => <div key={p.tipo} className="h-12 flex items-center px-2 text-[11px] font-semibold border-b border-neutral-700 last:border-b-0">{p.nombre}</div>)}
        </div>
        <div ref={scrollRef} className="flex-1 min-w-0 overflow-x-auto">
          <div ref={contenidoRef} className="relative" style={{ width: anchoTotal }}>
            {/* Regla */}
            <div className="h-7 border-b border-neutral-700 relative cursor-pointer bg-[#262626]" onPointerDown={arrastrarCabezal}>
              {Array.from({ length: Math.floor(durTotal / paso) + 1 }, (_, i) => i * paso).map(s => (
                <div key={s} className="absolute top-0 h-full border-l border-neutral-600" style={{ left: 8 + s * pps }}>
                  <span className="absolute top-0.5 left-1 text-[10px] text-neutral-400 font-mono whitespace-nowrap">{fmt(s)}</span>
                </div>
              ))}
            </div>
            {/* Filas de pistas */}
            {PISTAS.map(p => (
              <div key={p.tipo} className="h-12 border-b border-neutral-700 last:border-b-0 relative" onPointerDown={e => { if (e.target === e.currentTarget) { setSel(null); arrastrarCabezal(e); } }}>
                {timeline.map((e, idx) => e.tipo !== p.tipo ? null : (
                  <div key={idx}
                    onPointerDown={ev => arrastrarBloque(ev, idx, 'mover')}
                    className={`absolute top-1.5 h-9 rounded-md border ${p.color} ${p.borde} ${sel === idx ? 'ring-2 ring-white' : ''} cursor-grab active:cursor-grabbing overflow-hidden`}
                    style={{ left: 8 + e.inicio_seg * pps, width: Math.max(14, (e.fin_seg - e.inicio_seg) * pps) }}
                    title={etiqueta(e)}>
                    <span className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/25" onPointerDown={ev => arrastrarBloque(ev, idx, 'ini')} />
                    <span className="block px-2 pt-1 text-[10px] leading-tight text-white font-semibold truncate">{etiqueta(e)}</span>
                    <span className="block px-2 text-[9px] text-white/75 font-mono">{fmt(e.inicio_seg)}</span>
                    <span className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/25" onPointerDown={ev => arrastrarBloque(ev, idx, 'fin')} />
                  </div>
                ))}
              </div>
            ))}
            {/* Cabezal */}
            <div className="absolute top-0 bottom-0 w-px bg-[#4da3ff] pointer-events-none" style={{ left: 8 + t * pps }}>
              <span className="absolute -top-0 -left-[5px] w-[11px] h-[11px] bg-[#4da3ff] rotate-45 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

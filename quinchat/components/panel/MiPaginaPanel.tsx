'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConfigPagina, Seccion, TipoSeccion, Opinion, EmbudoWeb } from '@/lib/mi-pagina';
import { configInicial, normalizarConfig, NOMBRE_SECCION, ICONO_SECCION, nuevoId, BASE_TIENDA, nombreBonito, pesosCOP } from '@/lib/mi-pagina';
import { comprimirImagen } from '@/lib/imagen-comprimir';

/**
 * Embudos → «Mi Página»: una tienda web hecha con los embudos que ya existen.
 * Viene armada sola (portada + todos los embudos). El dueño solo cambia fotos, oculta/quita/agrega
 * embudos y los ordena arrastrando. Guarda en la tabla mi_pagina y solo LEE los embudos.
 * Vista previa = la página real (/p/web/<slug>?borrador=1) en computador y celular, al instante (postMessage).
 */
interface CatInfo { id: string; familia: string; fotos: number; portada: string | null; grupo: string; embudo_sugerido: string | null }

const VERDE = '#00A895';
const tarjeta = 'bg-white rounded-2xl border border-[#E8ECEB] shadow-sm';
const inputCls = 'w-full px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm focus:outline-none focus:border-[#00A895] bg-white';
const labelCls = 'block text-[12px] font-semibold text-[#1F2A28] mb-1';
const ANCHO_PC = 1280;

export default function MiPaginaPanel() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState('klixmant');
  const [slugGuardado, setSlugGuardado] = useState<string | null>(null);
  const [cfg, setCfg] = useState<ConfigPagina>(configInicial());
  const [publicada, setPublicada] = useState(false);
  const [publicadoAt, setPublicadoAt] = useState<string | null>(null);
  const [embudos, setEmbudos] = useState<EmbudoWeb[]>([]);
  const [catalogos, setCatalogos] = useState<CatInfo[]>([]);
  const [estado, setEstado] = useState<'' | 'guardando' | 'guardado' | 'error'>('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [abiertoPortada, setAbiertoPortada] = useState(true);
  const [abiertoProductos, setAbiertoProductos] = useState(true);
  const [abiertoDiseno, setAbiertoDiseno] = useState(false);
  const [textosPortada, setTextosPortada] = useState(false);
  // Tokens (secretos): solo se sabe si hay uno guardado (••••1234); se escriben aparte con PATCH
  const [tokensGuardados, setTokensGuardados] = useState<{ meta: string | null; tiktok: string | null }>({ meta: null, tiktok: null });
  const [tokenMeta, setTokenMeta] = useState('');
  const [tokenTiktok, setTokenTiktok] = useState('');
  const [guardandoTokens, setGuardandoTokens] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [fotoDe, setFotoDe] = useState<string | null>(null);
  const [arrastra, setArrastra] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const [vistaMovil, setVistaMovil] = useState(false); // en pantallas angostas: una vista a la vez
  const [iframeKey, setIframeKey] = useState(0);
  const iframes = useRef<(HTMLIFrameElement | null)[]>([]);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listo = useRef(false);
  const cajaPc = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.5);

  // ── Cargar (la página se crea sola la primera vez, con todos los embudos) ──
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/mi-pagina', { cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
        setEmbudos(j.embudos ?? []);
        setCatalogos(j.catalogos ?? []);
        if (j.pagina) {
          setSlug(j.pagina.slug); setSlugGuardado(j.pagina.slug);
          setCfg(normalizarConfig(j.pagina.borrador));
          setPublicada(!!j.pagina.publicada); setPublicadoAt(j.pagina.publicado_at ?? null);
          setTokensGuardados(j.pagina.tokens ?? { meta: null, tiktok: null });
        }
      } catch (e: any) { setError(e?.message ?? String(e)); }
      finally { setCargando(false); }
    })();
  }, []);

  // Escala de la vista de computador (la página se dibuja a 1280 px y se reduce)
  useEffect(() => {
    const el = cajaPc.current; if (!el) return;
    const ro = new ResizeObserver(() => setEscala(Math.min(1, el.clientWidth / ANCHO_PC)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [cargando]);

  const enviarVista = (c: ConfigPagina) => iframes.current.forEach(f => f?.contentWindow?.postMessage({ tipo: 'mi-pagina-config', config: c }, window.location.origin));

  const guardar = async (c: ConfigPagina, s: string) => {
    setEstado('guardando');
    const r = await fetch('/api/mi-pagina', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: s, slug_anterior: slugGuardado, nombre: c.marca.nombre, borrador: c }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setEstado('error'); setAviso(`❌ ${j.error ?? 'No se pudo guardar'}`); return false; }
    if (slugGuardado !== s) { setSlugGuardado(s); setIframeKey(k => k + 1); }
    setEstado('guardado');
    return true;
  };

  // Cada cambio: vista previa al instante + guardado automático del borrador a los 1,2 s
  useEffect(() => {
    if (cargando) return;
    enviarVista(cfg);
    if (!listo.current) { listo.current = true; return; } // la carga inicial no se guarda
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => { if (/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) guardar(cfg, slug); }, 1200);
    return () => { if (temporizador.current) clearTimeout(temporizador.current); };
  }, [cfg, cargando]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cada vista previa avisa cuando está lista → se le manda la config actual
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.tipo === 'mi-pagina-lista') enviarVista(cfg);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [cfg]);

  const cambiar = (f: (c: ConfigPagina) => ConfigPagina | void) => setCfg(c => { const x = structuredClone(c); return f(x) ?? x; });

  const accion = async (a: 'publicar' | 'ocultar' | 'mostrar') => {
    if (temporizador.current) clearTimeout(temporizador.current);
    if (!(await guardar(cfg, slug))) return;
    const r = await fetch('/api/mi-pagina', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, accion: a }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setAviso(`❌ ${j.error ?? 'No se pudo'}`); return; }
    if (a === 'publicar') { setPublicada(true); setPublicadoAt(j.publicado_at ?? new Date().toISOString()); setAviso('✅ Página publicada. Los clientes ya ven esta versión.'); }
    if (a === 'ocultar') { setPublicada(false); setAviso('Página oculta: el enlace muestra «no disponible».'); }
    if (a === 'mostrar') { setPublicada(true); setAviso('✅ Página activa otra vez.'); }
  };
  const enlace = `${BASE_TIENDA}/web/${slug}`;
  const copiar = async () => { try { await navigator.clipboard.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sin portapapeles */ } };

  const subir = async (f: File): Promise<string | null> => {
    const liviana = await comprimirImagen(f).catch(() => f);
    const fd = new FormData(); fd.append('file', liviana);
    const r = await fetch('/api/catalogos/upload-imagen', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (!j.url) { setAviso(`❌ No se pudo subir la imagen${j.error ? `: ${j.error}` : ''}`); return null; }
    return j.url;
  };

  // ── Productos (embudos) ───────────────────────────────────────────────────
  const porSlug = useMemo(() => new Map(embudos.map(e => [e.slug, e])), [embudos]);
  const enTienda = cfg.productos.map((p, i) => ({ p, i, e: porSlug.get(p.slug) })).filter(x => x.e && !x.p.quitado);
  const fueraDeTienda = embudos.filter(e => { const p = cfg.productos.find(x => x.slug === e.slug); return !p || p.quitado; });
  const visiblesN = enTienda.filter(x => x.p.visible).length;
  const moverProducto = (de: number, a: number) => cambiar(c => {
    if (de === a) return;
    const [x] = c.productos.splice(de, 1);
    c.productos.splice(a, 0, x);
  });
  const agregarEmbudo = (slugE: string) => cambiar(c => {
    const i = c.productos.findIndex(p => p.slug === slugE);
    if (i >= 0) { const [x] = c.productos.splice(i, 1); x.quitado = false; x.visible = true; c.productos.push(x); }
    else c.productos.push({ slug: slugE, visible: true });
  });

  // ── Secciones ─────────────────────────────────────────────────────────────
  const moverSeccion = (i: number, d: -1 | 1) => cambiar(c => {
    const j = i + d; if (j < 0 || j >= c.secciones.length) return;
    [c.secciones[i], c.secciones[j]] = [c.secciones[j], c.secciones[i]];
  });
  const tiposFaltantes = (Object.keys(NOMBRE_SECCION) as TipoSeccion[]).filter(t => t === 'texto' || !cfg.secciones.some(s => s.tipo === t));
  const [menuAgregar, setMenuAgregar] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  if (cargando) return <div className="p-10 text-center text-sm text-[#6B6B6B]">Armando tu tienda con tus embudos…</div>;
  if (error) return <div className="p-10 text-center text-sm text-[#DC2626]">No se pudo cargar Mi Página: {error}</div>;

  const urlVista = slugGuardado ? `/p/web/${slugGuardado}?borrador=1` : null;
  const portadaFoto = cfg.banner.imagen;
  // Productos que arman la portada automática (los elige el dueño; si no eligió, los 3 primeros visibles)
  const visiblesTienda = enTienda.filter(x => x.p.visible);
  const elegidosPortada = (cfg.banner.productos ?? []).filter(sl => visiblesTienda.some(x => x.p.slug === sl));
  const fotoPortadaDe = (x: (typeof enTienda)[number]) => x.p.foto || x.e!.foto;
  const fotosDefecto = (elegidosPortada.length
    ? elegidosPortada.map(sl => visiblesTienda.find(x => x.p.slug === sl)!)
    : visiblesTienda).map(fotoPortadaDe).filter(Boolean).slice(0, 3) as string[];
  const abanicoMini = fotosDefecto.length === 3 ? [fotosDefecto[1], fotosDefecto[0], fotosDefecto[2]] : fotosDefecto.length === 2 ? [fotosDefecto[1], fotosDefecto[0]] : fotosDefecto;
  const centroMini = fotosDefecto.length >= 2 ? 1 : 0;
  const alternarPortada = (slug: string) => cambiar(c => {
    const act = (c.banner.productos ?? []).filter(sl => visiblesTienda.some(x => x.p.slug === sl));
    c.banner.productos = act.includes(slug) ? act.filter(s => s !== slug) : act.length >= 3 ? act : [...act, slug];
  });

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 pb-8">
      {/* ── Encabezado ── */}
      <div className={`${tarjeta} p-5 mb-4`}>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: '#E6F7F4' }}>🖥️</div>
          <div className="flex-1 min-w-[220px]">
            <h1 className="text-2xl font-extrabold text-[#0D1F1C]">Mi Página</h1>
            <p className="text-[13px] text-[#5B6B68]">Tu tienda online con tus embudos. Personaliza tu portada y elige qué productos mostrar.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {urlVista && <a href={urlVista} target="_blank" rel="noreferrer" className="px-4 py-2.5 rounded-xl border border-[#D7DEDC] text-sm font-semibold hover:bg-[#F4F7F6]">👁 Vista previa</a>}
            <button onClick={copiar} className="px-4 py-2.5 rounded-xl border border-[#D7DEDC] text-sm font-semibold hover:bg-[#F4F7F6]">{copiado ? '✓ Enlace copiado' : '🔗 Compartir enlace'}</button>
            <button onClick={() => accion('publicar')} className="px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm hover:opacity-90" style={{ background: VERDE }}>☁ Publicar página</button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 flex-wrap rounded-xl px-4 py-2.5" style={{ background: '#EEF8F6' }}>
          <span>🔗</span>
          <span className="text-sm font-semibold text-[#0D1F1C] underline decoration-[#0D1F1C]/30">pedido.klixmant.shop/web/</span>
          <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            onBlur={() => { if (slug !== slugGuardado) guardar(cfg, slug); }}
            className="w-32 -ml-2 px-2 py-1 rounded-lg border border-[#CFE3DF] text-sm font-semibold bg-white" title="Puedes cambiar el final de la dirección" />
          {publicada && <a href={enlace} target="_blank" rel="noreferrer" className="text-[#00847A]" title="Abrir la página publicada">↗</a>}
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${publicada ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#F1F1F1] text-[#6B6B6B]'}`}>
            {publicada ? '✓ Publicado' : publicadoAt ? 'Oculta' : 'Sin publicar'}
          </span>
          <span className="text-[11px] text-[#6B7B78]">
            {estado === 'guardando' ? 'Guardando borrador…' : estado === 'guardado' ? 'Borrador guardado' : estado === 'error' ? 'Error al guardar' : ''}
          </span>
          <label className="ml-auto flex items-center gap-2 text-sm font-bold text-[#1F2A28]">
            Página activa
            <Interruptor activo={publicada} onClick={() => accion(publicada ? 'ocultar' : (publicadoAt ? 'mostrar' : 'publicar'))} />
          </label>
        </div>
        {aviso && <p className="mt-3 text-xs px-3 py-2 rounded-lg bg-[#F7F9F8] border border-[#E8ECEB]">{aviso} <button className="ml-2 text-[#9AA]" onClick={() => setAviso(null)}>✕</button></p>}
        <p className="mt-2 text-[11px] text-[#7A8A87]">Todo se guarda solo y se ve al instante en la vista previa. Los clientes ven los cambios cuando oprimes «Publicar página».</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* ═════════ Columna izquierda ═════════ */}
        <div className="space-y-4 self-start">
          {/* Portada */}
          <div className={tarjeta}>
            <Cabecera icono="🖼️" titulo="Portada de mi página" abierto={abiertoPortada} onClick={() => setAbiertoPortada(a => !a)} />
            {abiertoPortada && (
              <div className="px-4 pb-4">
                <div className="relative rounded-xl overflow-hidden aspect-[16/7] text-white" style={{ background: 'radial-gradient(circle at 75% 40%, #0B5E58 0%, #062523 65%)' }}>
                  {portadaFoto
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={portadaFoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    : (
                      <div className={`absolute inset-y-0 flex items-center justify-center ${cfg.banner.mostrar_textos === true ? 'right-2 w-[52%]' : 'inset-x-0 px-[22%]'}`}>
                        {abanicoMini.map((f, i) => {
                          const lado = i < centroMini ? -1 : i > centroMini ? 1 : 0;
                          return (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={`${f}-${i}`} src={f} alt="" className={`aspect-square object-cover rounded-lg shadow-lg border-2 border-white/10 relative ${i === centroMini ? 'w-[46%] z-20' : 'w-[34%] z-10'}`}
                              style={{ marginLeft: i === 0 ? 0 : '-9%', transform: `rotate(${lado * 7}deg) ${i === centroMini ? 'scale(1.04)' : 'translateY(6%)'}` }} />
                          );
                        })}
                      </div>
                    )}
                  <div className="absolute inset-0 p-3 flex flex-col justify-center" style={portadaFoto ? { background: 'linear-gradient(90deg,#062523cc,transparent 70%)' } : undefined}>
                    <p className={`text-lg font-black italic uppercase leading-[0.95] max-w-[55%] ${cfg.banner.mostrar_textos === true ? '' : 'hidden'}`}>{cfg.banner.titulo}<br /><span className="text-[#5EEAD4]">{cfg.banner.titulo2}</span></p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <label className="px-3 py-2.5 rounded-xl text-white text-sm font-bold text-center cursor-pointer hover:opacity-90" style={{ background: VERDE }}>
                    ⬆ {portadaFoto ? 'Cambiar portada' : 'Subir foto'}
                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const f = e.target.files?.[0]; if (!f) return; setAviso('Subiendo portada…');
                      const u = await subir(f); if (u) { cambiar(c => { c.banner.imagen = u; }); setAviso('✅ Portada cambiada.'); } e.target.value = '';
                    }} />
                  </label>
                  {urlVista
                    ? <a href={urlVista} target="_blank" rel="noreferrer" className="px-3 py-2.5 rounded-xl border border-[#D7DEDC] text-sm font-semibold text-center hover:bg-[#F4F7F6]">👁 Ver en grande</a>
                    : <span />}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-[#1F2A28] cursor-pointer">
                    <input type="checkbox" checked={cfg.banner.mostrar_textos === true} onChange={e => cambiar(c => { c.banner.mostrar_textos = e.target.checked; })} />
                    Mostrar título y beneficios
                  </label>
                  {cfg.banner.mostrar_textos === true && <button onClick={() => setTextosPortada(t => !t)} className="text-xs font-bold text-[#00847A]">✏️ {textosPortada ? 'Ocultar' : 'Editar textos'}</button>}
                  {portadaFoto && <button onClick={() => cambiar(c => { c.banner.imagen = null; })} className="text-xs text-[#9AA7A5] hover:text-[#DC2626]">Usar portada automática</button>}
                </div>
                {!portadaFoto && visiblesTienda.length > 0 && (
                  <div className="mt-3 rounded-xl border border-[#E3EAE8] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-[#1F2A28]">Productos de la portada <span className="font-normal text-[#7A8A87]">({elegidosPortada.length}/3)</span></p>
                      {elegidosPortada.length > 0 && <button onClick={() => cambiar(c => { c.banner.productos = []; })} className="text-[11px] text-[#9AA7A5] hover:text-[#DC2626]">Automático</button>}
                    </div>
                    <p className="text-[11px] text-[#7A8A87] mb-2">Toca hasta 3. El primero queda en el centro, adelante.{elegidosPortada.length === 0 ? ' Sin elegir se usan los 3 primeros.' : ''}</p>
                    <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                      {visiblesTienda.map(x => {
                        const pos = elegidosPortada.indexOf(x.p.slug);
                        const f = fotoPortadaDe(x);
                        const lleno = pos < 0 && elegidosPortada.length >= 3;
                        return (
                          <button key={x.p.slug} onClick={() => alternarPortada(x.p.slug)} disabled={lleno} title={nombreBonito(x.e!.producto)}
                            className={`relative rounded-lg overflow-hidden aspect-square border-2 transition ${pos >= 0 ? 'border-[#00A895] ring-2 ring-[#00A895]/30' : 'border-transparent'} ${lleno ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {f ? <img src={f} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#F1F4F3]" />}
                            {pos >= 0 && <span className="absolute top-1 left-1 w-5 h-5 rounded-full text-[11px] font-black text-white flex items-center justify-center" style={{ background: VERDE }}>{pos + 1}</span>}
                            <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[9px] font-semibold px-1 py-0.5 truncate">{nombreBonito(x.e!.producto)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {textosPortada && cfg.banner.mostrar_textos === true && (
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={cfg.banner.titulo} onChange={e => cambiar(c => { c.banner.titulo = e.target.value; })} placeholder="Título" className={inputCls} />
                      <input value={cfg.banner.titulo2} onChange={e => cambiar(c => { c.banner.titulo2 = e.target.value; })} placeholder="Título (color)" className={inputCls} />
                    </div>
                    <input value={cfg.banner.subtitulo} onChange={e => cambiar(c => { c.banner.subtitulo = e.target.value; })} placeholder="Subtítulo (opcional)" className={inputCls} />
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map(i => (
                        <input key={i} value={cfg.banner.beneficios[i] ?? ''} placeholder={`Beneficio ${i + 1}`}
                          onChange={e => cambiar(c => { const b = [...c.banner.beneficios]; b[i] = e.target.value; c.banner.beneficios = b; })} className={`${inputCls} text-xs`} />
                      ))}
                    </div>
                    <input value={cfg.banner.boton} onChange={e => cambiar(c => { c.banner.boton = e.target.value; })} placeholder="Texto del botón" className={inputCls} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Productos (embudos) */}
          <div className={tarjeta}>
            <Cabecera icono="🛍️" titulo={`Productos de mi tienda (${visiblesN})`} abierto={abiertoProductos} onClick={() => setAbiertoProductos(a => !a)} />
            {abiertoProductos && (
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[11px] text-[#7A8A87]">Arrastra ⠿ para ordenar. El interruptor oculta; 🗑 lo quita de la tienda (el embudo no se borra).</p>
                  <button onClick={() => setAgregando(true)} className="shrink-0 px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ background: VERDE }}>+ Agregar embudo</button>
                </div>
                {enTienda.length === 0 && <p className="text-xs text-[#7A8A87] py-6 text-center">No hay embudos en la tienda. Oprime «+ Agregar embudo».</p>}
                <ul className="max-h-[560px] overflow-y-auto -mx-1 px-1">
                  {enTienda.map(({ p, i, e }) => (
                    <li key={p.slug}
                      draggable onDragStart={() => setArrastra(i)} onDragEnd={() => { setArrastra(null); setSobre(null); }}
                      onDragOver={ev => { ev.preventDefault(); setSobre(i); }}
                      onDrop={() => { if (arrastra != null) moverProducto(arrastra, i); setArrastra(null); setSobre(null); }}
                      className={`flex items-center gap-2 py-2 border-b border-[#F0F3F2] ${arrastra === i ? 'opacity-40' : ''} ${sobre === i && arrastra !== i ? 'border-t-2 border-t-[#00A895]' : ''}`}>
                      <span className="cursor-grab text-[#B5C0BE] select-none text-lg" title="Arrastra para ordenar">⠿</span>
                      <button onClick={() => setFotoDe(fotoDe === p.slug ? null : p.slug)} title="Cambiar foto" className="relative shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {(p.foto || e!.foto) ? <img src={(p.foto || e!.foto)!} alt="" className={`w-11 h-11 rounded-lg object-cover bg-[#F1F5F4] ${p.visible ? '' : 'grayscale opacity-50'}`} />
                          : <div className="w-11 h-11 rounded-lg bg-[#F1F5F4] flex items-center justify-center">🛍️</div>}
                        <span className="absolute -bottom-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-white shadow text-[10px] font-bold flex items-center justify-center">{(p.fotos ?? []).length > 1 ? (p.fotos ?? []).length : '📷'}</span>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${p.visible ? 'text-[#1F2A28]' : 'text-[#A0ACAA]'}`}>{nombreBonito(e!.producto)}</p>
                        <p className="text-[11px] text-[#7A8A87]">{pesosCOP(e!.precio)}{p.visible ? '' : ' · oculto'}
                          <button onClick={() => setFotoDe(fotoDe === p.slug ? null : p.slug)} className="ml-2 font-bold text-[#00847A] hover:underline">
                            🖼 {(p.fotos ?? []).length > 1 ? `Carrusel (${(p.fotos ?? []).length})` : '+ Fotos'}
                          </button>
                        </p>
                      </div>
                      <Interruptor activo={p.visible} onClick={() => cambiar(c => { c.productos[i].visible = !c.productos[i].visible; })} />
                      <button onClick={() => cambiar(c => { c.productos[i].quitado = true; })} title="Quitar de la tienda (no borra el embudo)"
                        className="w-8 h-8 rounded-lg hover:bg-[#FEE2E2] text-[#DC2626]">🗑</button>
                      {fotoDe === p.slug && (
                        <div className="basis-full mt-2 p-2 rounded-xl bg-[#F7FAF9] border border-[#E8ECEB]">
                          <p className="text-[11px] font-bold">Fotos del producto en la tienda</p>
                          <p className="text-[10.5px] text-[#7A8A87] mb-1.5">Toca para escoger. Con 2 o más, la tarjeta pasa las fotos sola cada segundo (carrusel). El n.º 1 es la principal.</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {[...new Set([...(p.fotos ?? []), ...e!.fotos])].map(f => {
                              const lista = p.fotos ?? [];
                              const pos = lista.indexOf(f);
                              const principal = !lista.length && (p.foto || e!.foto) === f;
                              return (
                                <button key={f} onClick={() => cambiar(c => {
                                  const act = c.productos[i].fotos ?? [];
                                  const nueva = act.includes(f) ? act.filter(x => x !== f) : [...act, f];
                                  c.productos[i].fotos = nueva;
                                  c.productos[i].foto = nueva[0] ?? null;
                                })}
                                  className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 ${pos >= 0 || principal ? 'border-[#00A895]' : 'border-transparent'}`}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={f} alt="" loading="lazy" className="w-full h-full object-cover" />
                                  {pos >= 0 && <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full text-[9px] font-black text-white flex items-center justify-center" style={{ background: VERDE }}>{pos + 1}</span>}
                                </button>
                              );
                            })}
                            <label className="w-12 h-12 rounded-lg border-2 border-dashed border-[#CBD5D3] flex items-center justify-center text-lg cursor-pointer hover:bg-white" title="Subir más fotos">
                              ⬆<input type="file" accept="image/*" multiple className="hidden" onChange={async ev => {
                                const archivos = Array.from(ev.target.files ?? []); ev.target.value = '';
                                for (const f of archivos) {
                                  const u = await subir(f);
                                  if (u) cambiar(c => { const act = c.productos[i].fotos ?? []; c.productos[i].fotos = [...act, u]; c.productos[i].foto = (c.productos[i].fotos ?? [])[0] ?? u; });
                                }
                              }} />
                            </label>
                          </div>
                          {((p.fotos ?? []).length > 0 || p.foto) && <button onClick={() => cambiar(c => { c.productos[i].fotos = []; c.productos[i].foto = null; })} className="mt-1.5 text-[11px] text-[#7A8A87]">Volver a la foto del embudo</button>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Diseño y más secciones */}
          <div className={tarjeta}>
            <Cabecera icono="🎨" titulo="Diseño y más secciones" abierto={abiertoDiseno} onClick={() => setAbiertoDiseno(a => !a)} />
            {abiertoDiseno && (
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelCls}>Nombre</label><input value={cfg.marca.nombre} onChange={e => cambiar(c => { c.marca.nombre = e.target.value; })} className={inputCls} /></div>
                  <div><label className={labelCls}>Texto junto al logo</label><input value={cfg.marca.eslogan} onChange={e => cambiar(c => { c.marca.eslogan = e.target.value; })} className={inputCls} /></div>
                </div>
                <div>
                  <label className={labelCls}>Color principal</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={cfg.marca.color} onChange={e => cambiar(c => { c.marca.color = e.target.value; })} className="w-10 h-10 rounded-lg border border-[#E1E5E4] cursor-pointer" />
                    <input value={cfg.marca.color} onChange={e => cambiar(c => { c.marca.color = e.target.value; })} className={inputCls} />
                    {['#00A895', '#0D1F1C', '#D4AF37', '#2563EB', '#DC2626'].map(col => (
                      <button key={col} onClick={() => cambiar(c => { c.marca.color = col; })} className="w-6 h-6 rounded-full border-2 border-white shadow shrink-0" style={{ background: col }} title={col} />
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-[#E3EAE8] p-3 space-y-2">
                  <p className="text-xs font-extrabold text-[#1877F2]">📘 Meta (Facebook e Instagram)</p>
                  <div><label className={labelCls}>Identificador del píxel</label>
                    <input value={cfg.marca.pixel_meta ?? ''} onChange={e => cambiar(c => { c.marca.pixel_meta = e.target.value.replace(/\D/g, ''); })} placeholder="1005280598535259" className={inputCls} /></div>
                  <div><label className={labelCls}>Token de la API de conversiones</label>
                    <input type="password" autoComplete="off" value={tokenMeta} onChange={e => setTokenMeta(e.target.value)}
                      placeholder={tokensGuardados.meta ? `Guardado ${tokensGuardados.meta} — escribe para cambiarlo` : 'Pega aquí el token'} className={inputCls} />
                    <p className="text-[10px] text-[#7A8A87] mt-1">Con el token, las visitas también se le informan a Meta desde el servidor (llegan aunque el cliente bloquee cookies).</p></div>
                  <p className="text-xs font-extrabold text-[#111] pt-1">🎵 TikTok</p>
                  <div><label className={labelCls}>Identificador del píxel</label>
                    <input value={cfg.marca.pixel_tiktok ?? ''} onChange={e => cambiar(c => { c.marca.pixel_tiktok = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase(); })} placeholder="D7VNBURC77UDOFSGG36G" className={inputCls} /></div>
                  <div><label className={labelCls}>Token de eventos (opcional)</label>
                    <input type="password" autoComplete="off" value={tokenTiktok} onChange={e => setTokenTiktok(e.target.value)}
                      placeholder={tokensGuardados.tiktok ? `Guardado ${tokensGuardados.tiktok} — escribe para cambiarlo` : '(opcional)'} className={inputCls} /></div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button disabled={guardandoTokens || (!tokenMeta.trim() && !tokenTiktok.trim()) || !slugGuardado}
                      onClick={async () => {
                        setGuardandoTokens(true);
                        const cuerpo: Record<string, string> = { slug: slugGuardado ?? '' };
                        if (tokenMeta.trim()) cuerpo.meta_token = tokenMeta.trim();
                        if (tokenTiktok.trim()) cuerpo.tiktok_token = tokenTiktok.trim();
                        const r = await fetch('/api/mi-pagina', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
                        setGuardandoTokens(false);
                        if (r.ok) {
                          setTokensGuardados(t => ({ meta: cuerpo.meta_token ? `••••${cuerpo.meta_token.slice(-4)}` : t.meta, tiktok: cuerpo.tiktok_token ? `••••${cuerpo.tiktok_token.slice(-4)}` : t.tiktok }));
                          setTokenMeta(''); setTokenTiktok(''); setAviso('✅ Tokens guardados.');
                        } else setAviso('No se pudieron guardar los tokens.');
                      }}
                      className="px-3 py-2 rounded-lg text-white text-xs font-bold disabled:opacity-40" style={{ background: VERDE }}>{guardandoTokens ? 'Guardando…' : 'Guardar tokens'}</button>
                    {tokensGuardados.meta && <button onClick={async () => { await fetch('/api/mi-pagina', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: slugGuardado, meta_token: '' }) }); setTokensGuardados(t => ({ ...t, meta: null })); }} className="text-[11px] text-[#9AA7A5] hover:text-[#DC2626]">Quitar token Meta</button>}
                    {tokensGuardados.tiktok && <button onClick={async () => { await fetch('/api/mi-pagina', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: slugGuardado, tiktok_token: '' }) }); setTokensGuardados(t => ({ ...t, tiktok: null })); }} className="text-[11px] text-[#9AA7A5] hover:text-[#DC2626]">Quitar token TikTok</button>}
                  </div>
                  <p className="text-[10px] text-[#7A8A87]">Los píxeles miden las visitas a la página. Las ventas las mide cada embudo y quedan marcadas «mi-pagina». Los píxeles se ven en la página al oprimir «Publicar página»; los tokens se guardan con su botón.</p>
                </div>
                <SubirImagen titulo="Logo" ayuda="PNG con fondo transparente ideal" url={cfg.marca.logo} onUrl={u => cambiar(c => { c.marca.logo = u; })} subir={subir} />
                <div><label className={labelCls}>WhatsApp de la tienda</label>
                  <input value={cfg.contacto.whatsapp} onChange={e => cambiar(c => { c.contacto.whatsapp = e.target.value; })} placeholder="3001234567" className={inputCls} />
                  <p className="text-[10px] text-[#7A8A87] mt-1">Botón flotante de WhatsApp en la tienda.</p></div>

                <div className="pt-2 border-t border-[#EEF2F1]">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-bold">Secciones</h4>
                    <div className="relative">
                      <button onClick={() => setMenuAgregar(m => !m)} className="px-2.5 py-1 rounded-lg text-white text-xs font-bold" style={{ background: VERDE }}>+ Sección</button>
                      {menuAgregar && (
                        <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl border border-[#E8ECEB] shadow-lg z-20 p-1">
                          {tiposFaltantes.map(t => (
                            <button key={t} onClick={() => { cambiar(c => { c.secciones.push({ id: nuevoId(), tipo: t, visible: true, titulo: t === 'banner' ? '' : NOMBRE_SECCION[t] }); }); setMenuAgregar(false); }}
                              className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-[#F4F7F6]">{ICONO_SECCION[t]} {NOMBRE_SECCION[t]}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <ul className="divide-y divide-[#EEF2F1]">
                    {cfg.secciones.map((s, i) => (
                      <li key={s.id} className="py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-center">{ICONO_SECCION[s.tipo]}</span>
                          <span className={`flex-1 text-sm truncate ${s.visible ? '' : 'text-[#A0ACAA] line-through'}`}>{s.titulo || NOMBRE_SECCION[s.tipo]}</span>
                          <div className="flex flex-col">
                            <button onClick={() => moverSeccion(i, -1)} className="text-[10px] text-[#9AA7A5] leading-none">▲</button>
                            <button onClick={() => moverSeccion(i, 1)} className="text-[10px] text-[#9AA7A5] leading-none">▼</button>
                          </div>
                          <Interruptor activo={s.visible} onClick={() => cambiar(c => { c.secciones[i].visible = !c.secciones[i].visible; })} />
                          {!['banner', 'productos'].includes(s.tipo) && <>
                            <button onClick={() => setEditando(editando === s.id ? null : s.id)} className="w-7 h-7 rounded-lg hover:bg-[#F1F5F4]" title="Editar">✏️</button>
                            <button onClick={() => cambiar(c => { c.secciones.splice(i, 1); })} className="w-7 h-7 rounded-lg hover:bg-[#FEE2E2] text-[#DC2626]" title="Quitar sección">🗑</button>
                          </>}
                        </div>
                        {editando === s.id && (
                          <div className="mt-2 p-3 rounded-xl bg-[#F7FAF9] border border-[#E8ECEB] space-y-2">
                            <EditorSeccion s={s} cfg={cfg} cambiar={cambiar} indice={i} subir={subir} catalogos={catalogos} embudos={embudos} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═════════ Vista previa: computador + celular ═════════ */}
        <div className="self-start lg:sticky lg:top-2">
          <div className="flex items-center gap-6 mb-2 px-1 2xl:hidden">
            <button onClick={() => setVistaMovil(false)} className={`pb-1.5 text-sm font-bold border-b-2 ${!vistaMovil ? 'border-[#00A895] text-[#0D1F1C]' : 'border-transparent text-[#7A8A87]'}`}>🖥 Vista de mi página (Computador)</button>
            <button onClick={() => setVistaMovil(true)} className={`pb-1.5 text-sm font-bold border-b-2 ${vistaMovil ? 'border-[#00A895] text-[#0D1F1C]' : 'border-transparent text-[#7A8A87]'}`}>📱 Vista móvil</button>
            <button onClick={() => setIframeKey(k => k + 1)} className="ml-auto text-xs px-2 py-1 rounded hover:bg-white" title="Recargar vista previa">⟳</button>
          </div>
          <div className="flex gap-4 items-start">
            {/* Computador */}
            <div className={`flex-1 min-w-0 ${vistaMovil ? 'hidden 2xl:block' : ''}`}>
              <p className="hidden 2xl:block text-sm font-bold text-[#0D1F1C] mb-2 text-center">🖥 Vista de mi página (Computador)</p>
              <div className={`${tarjeta} p-2`}>
                <div className="flex items-center gap-2 px-2 pb-2">
                  <span className="flex gap-1"><i className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" /><i className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" /><i className="w-2.5 h-2.5 rounded-full bg-[#28C840]" /></span>
                  <span className="flex-1 text-[11px] text-[#6B7B78] truncate bg-[#F4F7F6] rounded-lg px-3 py-1">🔍 pedido.klixmant.shop/web/{slug}</span>
                </div>
                <div ref={cajaPc} className="relative overflow-hidden rounded-lg bg-[#EEF2F1]" style={{ height: 820 * escala }}>
                  {urlVista && (
                    <iframe key={`pc-${iframeKey}`} ref={el => { iframes.current[0] = el; }} src={urlVista} title="Vista computador"
                      style={{ width: ANCHO_PC, height: 820, border: 0, transform: `scale(${escala})`, transformOrigin: '0 0', position: 'absolute', top: 0, left: 0, background: 'white' }} />
                  )}
                </div>
              </div>
            </div>
            {/* Celular */}
            <div className={`shrink-0 ${vistaMovil ? 'mx-auto' : 'hidden 2xl:block'}`}>
              <p className="hidden 2xl:block text-sm font-bold text-[#0D1F1C] mb-2 text-center">📱 Vista móvil</p>
              <div className="rounded-[40px] bg-[#111] p-2.5 shadow-xl" style={{ width: 300 }}>
                <div className="relative rounded-[32px] overflow-hidden bg-white" style={{ height: 600 }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#111] rounded-b-2xl z-10" />
                  {urlVista && (
                    <iframe key={`cel-${iframeKey}`} ref={el => { iframes.current[1] = el; }} src={urlVista} title="Vista celular"
                      style={{ width: 375, height: 750, border: 0, transform: 'scale(0.749)', transformOrigin: '0 0' }} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Agregar embudo ── */}
      {agregando && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setAgregando(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[#EEF2F1] flex items-center justify-between">
              <div><h3 className="font-extrabold">Agregar embudos a la tienda</h3><p className="text-xs text-[#7A8A87]">Tus embudos activos que no están en la página.</p></div>
              <button onClick={() => setAgregando(false)} className="w-9 h-9 rounded-full bg-[#F1F5F4]">✕</button>
            </div>
            <div className="p-4 overflow-y-auto">
              {fueraDeTienda.length === 0
                ? <p className="text-sm text-[#7A8A87] text-center py-8">Todos tus embudos activos ya están en la tienda.</p>
                : <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {fueraDeTienda.map(e => (
                    <button key={e.slug} onClick={() => agregarEmbudo(e.slug)} className="text-left rounded-xl border border-[#E8ECEB] p-2 hover:border-[#00A895] hover:bg-[#F4FBF9]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {e.foto ? <img src={e.foto} alt="" loading="lazy" className="w-full aspect-square rounded-lg object-cover bg-[#F1F5F4]" /> : <div className="w-full aspect-square rounded-lg bg-[#F1F5F4]" />}
                      <p className="text-xs font-bold mt-1.5 leading-tight">{nombreBonito(e.producto)}</p>
                      <p className="text-[11px] text-[#7A8A87]">{pesosCOP(e.precio)} · <span className="text-[#00847A] font-bold">+ Agregar</span></p>
                    </button>
                  ))}
                </div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Cabecera({ icono, titulo, abierto, onClick }: { icono: string; titulo: string; abierto: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-4 py-3.5 text-left">
      <span className="text-lg">{icono}</span>
      <span className="flex-1 text-[15px] font-extrabold text-[#0D1F1C]">{titulo}</span>
      <span className={`text-[#7A8A87] transition ${abierto ? 'rotate-180' : ''}`}>⌄</span>
    </button>
  );
}

function Interruptor({ activo, onClick }: { activo: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`relative w-11 h-6 rounded-full transition shrink-0 ${activo ? 'bg-[#00A895]' : 'bg-[#CBD5D3]'}`} aria-pressed={activo}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${activo ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function SubirImagen({ titulo, ayuda, url, onUrl, subir }: {
  titulo: string; ayuda: string; url: string | null; onUrl: (u: string | null) => void; subir: (f: File) => Promise<string | null>;
}) {
  const [subiendo, setSubiendo] = useState(false);
  return (
    <div>
      <label className={labelCls}>{titulo}</label>
      <div className="flex items-center gap-2 rounded-xl border border-[#E1E5E4] p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="" className="w-12 h-12 rounded-lg object-contain bg-[#F1F5F4]" /> : <div className="w-12 h-12 rounded-lg bg-[#F1F5F4] flex items-center justify-center text-[#B5C0BE]">🖼</div>}
        <div className="flex-1 min-w-0"><p className="text-[10px] text-[#7A8A87]">{ayuda}</p>{url && <button onClick={() => onUrl(null)} className="text-[10px] text-[#DC2626]">Quitar</button>}</div>
        <label className="px-2.5 py-1.5 rounded-lg border border-[#E1E5E4] text-xs font-semibold cursor-pointer hover:bg-[#F4F7F6]">
          {subiendo ? '…' : '⬆ Subir'}
          <input type="file" accept="image/*" className="hidden" onChange={async e => {
            const f = e.target.files?.[0]; if (!f) return;
            setSubiendo(true); try { const u = await subir(f); if (u) onUrl(u); } finally { setSubiendo(false); e.target.value = ''; }
          }} />
        </label>
      </div>
    </div>
  );
}

function EditorSeccion({ s, cfg, cambiar, indice, subir, catalogos, embudos }: {
  s: Seccion; cfg: ConfigPagina; cambiar: (f: (c: ConfigPagina) => ConfigPagina | void) => void; indice: number;
  subir: (f: File) => Promise<string | null>; catalogos: CatInfo[]; embudos: EmbudoWeb[];
}) {
  const set = (f: (x: Seccion) => void) => cambiar(c => { f(c.secciones[indice]); });
  return (
    <>
      <div><label className={labelCls}>Título de la sección</label>
        <input value={s.titulo} onChange={e => set(x => { x.titulo = e.target.value; })} className={inputCls} /></div>
      {s.tipo === 'texto' && <textarea value={s.texto ?? ''} onChange={e => set(x => { x.texto = e.target.value; })} rows={4} placeholder="Escribe el texto…" className={inputCls} />}
      {s.tipo === 'promociones' && <p className="text-[11px] text-[#5B6B68]">Muestra las promociones ACTIVAS del módulo Promociones.</p>}
      {s.tipo === 'contacto' && (
        <>
          <input value={cfg.contacto.instagram} onChange={e => cambiar(c => { c.contacto.instagram = e.target.value; })} placeholder="Instagram (@klixmant)" className={inputCls} />
          <textarea value={cfg.contacto.texto} onChange={e => cambiar(c => { c.contacto.texto = e.target.value; })} rows={2} placeholder="Texto" className={inputCls} />
        </>
      )}
      {s.tipo === 'nuevos' && (
        <div><label className={labelCls}>¿Cuántas fotos? (de los catálogos elegidos)</label>
          <input type="number" min={2} max={24} value={cfg.nuevos_cantidad} onChange={e => cambiar(c => { c.nuevos_cantidad = Math.max(2, Math.min(24, Number(e.target.value) || 8)); })} className={inputCls} /></div>
      )}
      {(s.tipo === 'catalogos' || s.tipo === 'nuevos') && (
        <div className="max-h-64 overflow-y-auto space-y-1">
          <p className="text-[11px] text-[#5B6B68]">Elige catálogos (fotos por color). «Comprar» abre el embudo elegido; sin embudo, WhatsApp.</p>
          {catalogos.map(k => {
            const sel = cfg.catalogos.find(x => x.id === k.id);
            return (
              <div key={k.id} className="flex items-center gap-2 bg-white rounded-lg border border-[#EEF2F1] p-1.5">
                <input type="checkbox" checked={!!sel?.visible} className="accent-[#00A895]" onChange={() => cambiar(c => {
                  const x = c.catalogos.find(y => y.id === k.id);
                  if (x) x.visible = !x.visible; else c.catalogos.push({ id: k.id, visible: true, embudo: k.embudo_sugerido, grupo: k.grupo });
                })} />
                <span className="flex-1 text-xs truncate">{k.familia}</span>
                {sel?.visible && (
                  <select value={sel.embudo ?? ''} onChange={e => cambiar(c => { const x = c.catalogos.find(y => y.id === k.id); if (x) x.embudo = e.target.value || null; })}
                    className="text-[10px] rounded border border-[#E1E5E4] max-w-[120px]">
                    <option value="">WhatsApp</option>
                    {embudos.map(f => <option key={f.slug} value={f.slug}>{nombreBonito(f.producto)}</option>)}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}
      {s.tipo === 'opiniones' && (
        <>
          <p className="text-[11px] text-[#5B6B68]">Opiniones REALES de tus clientes. Si no hay ninguna, la sección no se muestra.</p>
          {cfg.opiniones.map((o: Opinion, i: number) => (
            <div key={i} className="rounded-lg border border-[#E1E5E4] p-2 space-y-1 bg-white">
              <div className="flex gap-1">
                <input value={o.nombre} onChange={e => cambiar(c => { c.opiniones[i].nombre = e.target.value; })} placeholder="Nombre" className={`${inputCls} py-1.5`} />
                <select value={o.estrellas} onChange={e => cambiar(c => { c.opiniones[i].estrellas = Number(e.target.value); })} className="rounded-lg border border-[#E1E5E4] text-xs px-1">
                  {[5, 4, 3].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
                </select>
                <button onClick={() => cambiar(c => { c.opiniones.splice(i, 1); })} className="px-2 text-[#DC2626]">✕</button>
              </div>
              <textarea value={o.texto} onChange={e => cambiar(c => { c.opiniones[i].texto = e.target.value; })} rows={2} placeholder="Lo que dijo" className={`${inputCls} py-1.5`} />
              <label className="text-[11px] text-[#00847A] font-semibold cursor-pointer">
                📷 {o.foto ? 'Cambiar foto' : 'Foto (opcional)'}
                <input type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) { const u = await subir(f); if (u) cambiar(c => { c.opiniones[i].foto = u; }); } }} />
              </label>
            </div>
          ))}
          <button onClick={() => cambiar(c => { c.opiniones.push({ nombre: '', texto: '', estrellas: 5, foto: null }); })} className="text-xs font-bold text-[#00847A]">+ Agregar opinión</button>
        </>
      )}
    </>
  );
}

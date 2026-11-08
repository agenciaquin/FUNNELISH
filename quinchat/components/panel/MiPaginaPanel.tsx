'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConfigPagina, Seccion, TipoSeccion, CatSel, Opinion } from '@/lib/mi-pagina';
import { configInicial, normalizarConfig, NOMBRE_SECCION, ICONO_SECCION, nuevoId, BASE_TIENDA } from '@/lib/mi-pagina';
import { comprimirImagen } from '@/lib/imagen-comprimir';

/**
 * Embudos → «Mi Página». Editor independiente: guarda en la tabla mi_pagina y solo LEE
 * catálogos y embudos. La vista previa es la página real (/p/web/<slug>?borrador=1) en un
 * iframe que recibe los cambios al instante por postMessage.
 */
interface CatInfo { id: string; familia: string; fotos: number; portada: string | null; grupo: string; embudo_sugerido: string | null }
interface EmbInfo { slug: string; producto: string; precio: number | null }

const VERDE = '#00A895';
const tarjeta = 'bg-white rounded-2xl border border-[#E8ECEB] shadow-sm';
const inputCls = 'w-full px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm focus:outline-none focus:border-[#00A895] bg-white';
const labelCls = 'block text-[12px] font-semibold text-[#1F2A28] mb-1';

export default function MiPaginaPanel() {
  const [cargando, setCargando] = useState(true);
  const [slug, setSlug] = useState('klixmant');
  const [slugGuardado, setSlugGuardado] = useState<string | null>(null);
  const [cfg, setCfg] = useState<ConfigPagina>(configInicial());
  const [publicada, setPublicada] = useState(false);
  const [publicadoAt, setPublicadoAt] = useState<string | null>(null);
  const [catalogos, setCatalogos] = useState<CatInfo[]>([]);
  const [embudos, setEmbudos] = useState<EmbInfo[]>([]);
  const [estado, setEstado] = useState<'' | 'guardando' | 'guardado' | 'error'>('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [tab, setTab] = useState<'secciones' | 'catalogos'>('secciones');
  const [editando, setEditando] = useState<string | null>(null);
  const [dispositivo, setDispositivo] = useState<'pc' | 'cel'>('pc');
  const [iframeKey, setIframeKey] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const [buscarCat, setBuscarCat] = useState('');
  const iframe = useRef<HTMLIFrameElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primeraCarga = useRef(true);

  // ── Cargar ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/mi-pagina', { cache: 'no-store' });
        const j = await r.json();
        setCatalogos(j.catalogos ?? []);
        setEmbudos(j.embudos ?? []);
        if (j.pagina) {
          setSlug(j.pagina.slug); setSlugGuardado(j.pagina.slug);
          setCfg(normalizarConfig(j.pagina.borrador));
          setPublicada(!!j.pagina.publicada); setPublicadoAt(j.pagina.publicado_at ?? null);
        }
      } finally { setCargando(false); }
    })();
  }, []);

  // ── Guardar (borrador) ───────────────────────────────────────────────────
  const guardar = useCallback(async (c: ConfigPagina, s: string) => {
    setEstado('guardando');
    const r = await fetch('/api/mi-pagina', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: s, slug_anterior: slugGuardado, nombre: c.marca.nombre, borrador: c }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setEstado('error'); setAviso(`❌ ${j.error ?? 'No se pudo guardar'}`); return false; }
    const nuevaPagina = !slugGuardado || slugGuardado !== s;
    setSlugGuardado(s); setEstado('guardado');
    if (nuevaPagina) setIframeKey(k => k + 1);
    return true;
  }, [slugGuardado]);

  // Cada cambio: vista previa al instante + guardado automático a los 1,2 s
  useEffect(() => {
    if (cargando) return;
    iframe.current?.contentWindow?.postMessage({ tipo: 'mi-pagina-config', config: cfg }, window.location.origin);
    if (primeraCarga.current) { primeraCarga.current = false; if (slugGuardado) return; }
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => { if (/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) guardar(cfg, slug); }, 1200);
    return () => { if (temporizador.current) clearTimeout(temporizador.current); };
  }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  // El iframe avisa cuando está listo → se le manda la config actual
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.tipo !== 'mi-pagina-lista') return;
      iframe.current?.contentWindow?.postMessage({ tipo: 'mi-pagina-config', config: cfg }, window.location.origin);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [cfg]);

  const cambiar = (f: (c: ConfigPagina) => ConfigPagina) => setCfg(c => f(structuredClone(c)));

  // ── Acciones ────────────────────────────────────────────────────────────
  const accion = async (a: 'publicar' | 'ocultar' | 'mostrar') => {
    if (temporizador.current) { clearTimeout(temporizador.current); }
    const ok = await guardar(cfg, slug);
    if (!ok) return;
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

  // ── Secciones ───────────────────────────────────────────────────────────
  const moverSeccion = (i: number, d: -1 | 1) => cambiar(c => {
    const j = i + d; if (j < 0 || j >= c.secciones.length) return c;
    [c.secciones[i], c.secciones[j]] = [c.secciones[j], c.secciones[i]]; return c;
  });
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const soltar = (destino: number) => {
    if (arrastrando == null || arrastrando === destino) return setArrastrando(null);
    cambiar(c => { const [x] = c.secciones.splice(arrastrando, 1); c.secciones.splice(destino, 0, x); return c; });
    setArrastrando(null);
  };
  const tiposFaltantes = (Object.keys(NOMBRE_SECCION) as TipoSeccion[])
    .filter(t => t === 'texto' || !cfg.secciones.some(s => s.tipo === t));
  const [menuAgregar, setMenuAgregar] = useState(false);

  // ── Catálogos ───────────────────────────────────────────────────────────
  const selPorId = useMemo(() => new Map(cfg.catalogos.map(c => [c.id, c])), [cfg.catalogos]);
  const alternarCatalogo = (c: CatInfo) => cambiar(x => {
    const i = x.catalogos.findIndex(s => s.id === c.id);
    if (i >= 0) x.catalogos[i].visible = !x.catalogos[i].visible;
    else x.catalogos.push({ id: c.id, visible: true, embudo: c.embudo_sugerido, grupo: c.grupo, portada: null });
    return x;
  });
  const editarCat = (id: string, f: (s: CatSel) => void) => cambiar(x => { const s = x.catalogos.find(k => k.id === id); if (s) f(s); return x; });
  const moverCat = (i: number, d: -1 | 1) => cambiar(x => {
    const j = i + d; if (j < 0 || j >= x.catalogos.length) return x;
    [x.catalogos[i], x.catalogos[j]] = [x.catalogos[j], x.catalogos[i]]; return x;
  });
  const elegidos = cfg.catalogos.filter(s => s.visible && catalogos.some(c => c.id === s.id));
  const disponibles = catalogos.filter(c => !selPorId.get(c.id)?.visible)
    .filter(c => !buscarCat.trim() || c.familia.toLowerCase().includes(buscarCat.trim().toLowerCase()));

  if (cargando) return <div className="flex-1 flex items-center justify-center text-sm text-[#6B6B6B]">Cargando Mi Página…</div>;

  return (
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 pb-8">
      {/* Encabezado */}
      <div className={`${tarjeta} p-5 mb-4`}>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: '#E6F7F4' }}>🖥️</div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-extrabold text-[#0D1F1C]">Mi Página</h1>
            <p className="text-[13px] text-[#5B6B68]">Organiza los catálogos y secciones que se mostrarán en tu página web.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`/p/web/${slug}?borrador=1`} target="_blank" rel="noreferrer" className="px-4 py-2.5 rounded-xl border border-[#D7DEDC] text-sm font-semibold hover:bg-[#F4F7F6]">👁 Vista previa</a>
            <button onClick={copiar} className="px-4 py-2.5 rounded-xl border border-[#D7DEDC] text-sm font-semibold hover:bg-[#F4F7F6]">{copiado ? '✓ Copiado' : '🔗 Compartir enlace'}</button>
            <button onClick={() => accion('publicar')} className="px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm hover:opacity-90" style={{ background: VERDE }}>☁ Publicar página</button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 flex-wrap rounded-xl px-4 py-2.5" style={{ background: '#EEF8F6' }}>
          <span className="text-sm">🔗</span>
          <span className="text-sm font-semibold text-[#0D1F1C]">pedido.klixmant.shop/web/</span>
          <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            onBlur={() => { if (slug !== slugGuardado) guardar(cfg, slug); }}
            className="w-36 px-2 py-1 rounded-lg border border-[#CFE3DF] text-sm font-semibold bg-white" title="Dirección de tu página" />
          {publicada && <a href={enlace} target="_blank" rel="noreferrer" className="text-[#00847A] text-sm" title="Abrir">↗</a>}
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${publicada ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#F1F1F1] text-[#6B6B6B]'}`}>
            {publicada ? '● Publicado' : publicadoAt ? '● Oculta' : '● Sin publicar'}
          </span>
          <span className="text-[11px] text-[#6B7B78]">
            {estado === 'guardando' ? 'Guardando borrador…' : estado === 'guardado' ? 'Borrador guardado' : estado === 'error' ? 'Error al guardar' : ''}
            {publicadoAt ? ` · Publicada ${new Date(publicadoAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
          </span>
          <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-[#1F2A28]">
            Página activa
            <Interruptor activo={publicada} onClick={() => accion(publicada ? 'ocultar' : (publicadoAt ? 'mostrar' : 'publicar'))} />
          </label>
        </div>
        {aviso && <p className="mt-3 text-xs px-3 py-2 rounded-lg bg-[#F7F9F8] border border-[#E8ECEB]">{aviso} <button className="ml-2 text-[#9AA]" onClick={() => setAviso(null)}>✕</button></p>}
        <p className="mt-2 text-[11px] text-[#7A8A87]">Los cambios se guardan solos como borrador y se ven en la vista previa. Los clientes ven la página solo cuando oprimes «Publicar página».</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_300px_1fr] lg:grid-cols-[340px_1fr]">
        {/* ── Columna 1: Secciones / Catálogos ── */}
        <div className={`${tarjeta} p-4 self-start`}>
          <div className="flex gap-1 p-1 rounded-xl bg-[#F1F5F4] mb-3">
            {(['secciones', 'catalogos'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${tab === t ? 'bg-white shadow-sm text-[#0D1F1C]' : 'text-[#6B7B78]'}`}>
                {t === 'secciones' ? '📚 Secciones' : `🗂️ Catálogos (${elegidos.length})`}
              </button>
            ))}
          </div>

          {tab === 'secciones' ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-[#0D1F1C]">Secciones de mi página</h3>
                <div className="relative">
                  <button onClick={() => setMenuAgregar(m => !m)} className="px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ background: VERDE }}>+ Agregar sección</button>
                  {menuAgregar && (
                    <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl border border-[#E8ECEB] shadow-lg z-20 p-1">
                      {tiposFaltantes.length === 0 && <p className="text-xs text-[#7A8A87] p-2">Ya están todas.</p>}
                      {tiposFaltantes.map(t => (
                        <button key={t} onClick={() => { cambiar(c => { c.secciones.push({ id: nuevoId(), tipo: t, visible: true, titulo: t === 'banner' ? '' : NOMBRE_SECCION[t] }); return c; }); setMenuAgregar(false); }}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-[#F4F7F6]">{ICONO_SECCION[t]} {NOMBRE_SECCION[t]}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <ul className="divide-y divide-[#EEF2F1]">
                {cfg.secciones.map((s, i) => (
                  <li key={s.id} draggable onDragStart={() => setArrastrando(i)} onDragOver={e => e.preventDefault()} onDrop={() => soltar(i)}
                    className={`py-2 ${arrastrando === i ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="cursor-grab text-[#B5C0BE] select-none" title="Arrastra para ordenar">⠿</span>
                      <span className="text-base w-5 text-center">{ICONO_SECCION[s.tipo]}</span>
                      <span className={`flex-1 text-sm truncate ${s.visible ? 'text-[#1F2A28]' : 'text-[#A0ACAA] line-through'}`}>{s.titulo || NOMBRE_SECCION[s.tipo]}</span>
                      <div className="flex flex-col">
                        <button onClick={() => moverSeccion(i, -1)} className="text-[10px] text-[#9AA7A5] leading-none hover:text-[#00847A]" title="Subir">▲</button>
                        <button onClick={() => moverSeccion(i, 1)} className="text-[10px] text-[#9AA7A5] leading-none hover:text-[#00847A]" title="Bajar">▼</button>
                      </div>
                      <Interruptor activo={s.visible} onClick={() => cambiar(c => { c.secciones[i].visible = !c.secciones[i].visible; return c; })} />
                      <button onClick={() => s.tipo === 'catalogos' ? setTab('catalogos') : setEditando(editando === s.id ? null : s.id)}
                        className="w-7 h-7 rounded-lg hover:bg-[#F1F5F4]" title="Editar">✏️</button>
                      <button onClick={() => { if (confirm(`¿Quitar la sección «${s.titulo || NOMBRE_SECCION[s.tipo]}»?`)) cambiar(c => { c.secciones.splice(i, 1); return c; }); }}
                        className="w-7 h-7 rounded-lg hover:bg-[#FEE2E2] text-[#DC2626]" title="Quitar">🗑</button>
                    </div>
                    {editando === s.id && (
                      <div className="mt-2 ml-7 p-3 rounded-xl bg-[#F7FAF9] border border-[#E8ECEB] space-y-2">
                        <EditorSeccion s={s} cfg={cfg} cambiar={cambiar} indice={i} subir={subir} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h3 className="text-sm font-bold text-[#0D1F1C]">En tu página</h3>
              <p className="text-[11px] text-[#7A8A87] mb-2">Ordénalos y elige el embudo donde se compra cada uno. Sin embudo, el botón abre WhatsApp.</p>
              {elegidos.length === 0 && <p className="text-xs text-[#7A8A87] py-3">Aún no elegiste catálogos. Agrégalos abajo.</p>}
              <ul className="space-y-2 mb-4">
                {cfg.catalogos.map((s, i) => {
                  const c = catalogos.find(k => k.id === s.id);
                  if (!c || !s.visible) return null;
                  return (
                    <li key={s.id} className="rounded-xl border border-[#E8ECEB] p-2">
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {(s.portada || c.portada) ? <img src={(s.portada || c.portada)!} alt="" className="w-10 h-10 rounded-lg object-cover bg-[#F1F5F4]" /> : <div className="w-10 h-10 rounded-lg bg-[#F1F5F4]" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{c.familia}</p>
                          <p className="text-[10px] text-[#7A8A87]">{c.fotos} fotos</p>
                        </div>
                        <div className="flex flex-col">
                          <button onClick={() => moverCat(i, -1)} className="text-[10px] text-[#9AA7A5] hover:text-[#00847A]">▲</button>
                          <button onClick={() => moverCat(i, 1)} className="text-[10px] text-[#9AA7A5] hover:text-[#00847A]">▼</button>
                        </div>
                        <button onClick={() => alternarCatalogo(c)} className="w-7 h-7 rounded-lg hover:bg-[#FEE2E2] text-[#DC2626]" title="Quitar de la página">✕</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <select value={s.embudo ?? ''} onChange={e => editarCat(s.id, x => { x.embudo = e.target.value || null; })} className="text-[11px] rounded-lg border border-[#E1E5E4] px-1.5 py-1.5 bg-white">
                          <option value="">Sin embudo (WhatsApp)</option>
                          {embudos.map(f => <option key={f.slug} value={f.slug}>{f.producto}{f.precio ? ` · $${f.precio.toLocaleString('es-CO')}` : ''}</option>)}
                        </select>
                        <input value={s.grupo} onChange={e => editarCat(s.id, x => { x.grupo = e.target.value; })} placeholder="Filtro (Buzos…)" className="text-[11px] rounded-lg border border-[#E1E5E4] px-2 py-1.5" />
                      </div>
                      <label className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[#00847A] cursor-pointer font-semibold">
                        🖼 {s.portada ? 'Cambiar portada' : 'Portada propia (opcional)'}
                        <input type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) { const u = await subir(f); if (u) editarCat(s.id, x => { x.portada = u; }); } }} />
                      </label>
                      {s.portada && <button onClick={() => editarCat(s.id, x => { x.portada = null; })} className="ml-2 text-[11px] text-[#9AA7A5]">quitar</button>}
                    </li>
                  );
                })}
              </ul>
              <h3 className="text-sm font-bold text-[#0D1F1C] mb-1">Agregar catálogos</h3>
              <input value={buscarCat} onChange={e => setBuscarCat(e.target.value)} placeholder="Buscar catálogo…" className={`${inputCls} mb-2`} />
              <div className="grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
                {disponibles.map(c => (
                  <button key={c.id} onClick={() => alternarCatalogo(c)} className="text-left rounded-xl border border-[#E8ECEB] p-1.5 hover:border-[#00A895] hover:bg-[#F4FBF9]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.portada ? <img src={c.portada} alt="" loading="lazy" className="w-full aspect-square rounded-lg object-contain bg-[#F1F5F4]" /> : <div className="w-full aspect-square rounded-lg bg-[#F1F5F4]" />}
                    <p className="text-[11px] font-bold mt-1 leading-tight line-clamp-2">{c.familia}</p>
                    <p className="text-[10px] text-[#7A8A87]">{c.fotos} fotos · + Agregar</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Columna 2: Personalización visual ── */}
        <div className={`${tarjeta} p-4 self-start space-y-4`}>
          <h3 className="text-sm font-bold text-[#0D1F1C]">🎨 Personalización visual</h3>
          <div>
            <label className={labelCls}>Nombre de la tienda</label>
            <input value={cfg.marca.nombre} onChange={e => cambiar(c => { c.marca.nombre = e.target.value; return c; })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Color principal</label>
            <div className="flex items-center gap-2">
              <input type="color" value={cfg.marca.color} onChange={e => cambiar(c => { c.marca.color = e.target.value; return c; })} className="w-10 h-10 rounded-lg border border-[#E1E5E4] cursor-pointer" />
              <input value={cfg.marca.color} onChange={e => cambiar(c => { c.marca.color = e.target.value; return c; })} className={inputCls} />
            </div>
            <div className="flex gap-1.5 mt-2">
              {['#00A895', '#0D1F1C', '#D4AF37', '#2563EB', '#DC2626', '#7C3AED'].map(col => (
                <button key={col} onClick={() => cambiar(c => { c.marca.color = col; return c; })} className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ background: col }} title={col} />
              ))}
            </div>
          </div>
          <SubirImagen titulo="Logo de mi página" ayuda="PNG o JPG (fondo transparente ideal)" url={cfg.marca.logo}
            onUrl={u => cambiar(c => { c.marca.logo = u; return c; })} subir={subir} />
          <div className="space-y-2">
            <SubirImagen titulo="Banner principal" ayuda="JPG o PNG (1920 × 600 recomendado)" url={cfg.banner.imagen}
              onUrl={u => cambiar(c => { c.banner.imagen = u; return c; })} subir={subir} ancho />
            <input value={cfg.banner.titulo} onChange={e => cambiar(c => { c.banner.titulo = e.target.value; return c; })} placeholder="Título del banner" className={inputCls} />
            <input value={cfg.banner.subtitulo} onChange={e => cambiar(c => { c.banner.subtitulo = e.target.value; return c; })} placeholder="Subtítulo" className={inputCls} />
            <input value={cfg.banner.boton} onChange={e => cambiar(c => { c.banner.boton = e.target.value; return c; })} placeholder="Texto del botón" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>WhatsApp de la tienda</label>
            <input value={cfg.contacto.whatsapp} onChange={e => cambiar(c => { c.contacto.whatsapp = e.target.value; return c; })} placeholder="3001234567" className={inputCls} />
            <p className="text-[10px] text-[#7A8A87] mt-1">Para el botón flotante y los catálogos sin embudo.</p>
          </div>
        </div>

        {/* ── Columna 3: Vista previa en vivo ── */}
        <div className={`${tarjeta} p-3 xl:col-span-1 lg:col-span-2 self-start xl:sticky xl:top-2`}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="flex gap-1"><i className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" /><i className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" /><i className="w-2.5 h-2.5 rounded-full bg-[#28C840]" /></span>
            <span className="flex-1 text-[11px] text-[#6B7B78] truncate bg-[#F4F7F6] rounded-lg px-3 py-1">🔍 pedido.klixmant.shop/web/{slug}</span>
            <div className="flex gap-1 p-0.5 rounded-lg bg-[#F1F5F4]">
              <button onClick={() => setDispositivo('pc')} className={`px-2.5 py-1 rounded-md text-xs font-bold ${dispositivo === 'pc' ? 'bg-white shadow-sm' : 'text-[#6B7B78]'}`}>🖥 PC</button>
              <button onClick={() => setDispositivo('cel')} className={`px-2.5 py-1 rounded-md text-xs font-bold ${dispositivo === 'cel' ? 'bg-white shadow-sm' : 'text-[#6B7B78]'}`}>📱 Celular</button>
            </div>
            <button onClick={() => setIframeKey(k => k + 1)} className="px-2 py-1 rounded-md text-xs hover:bg-[#F1F5F4]" title="Recargar vista previa">⟳</button>
          </div>
          {slugGuardado ? (
            <div className="flex justify-center bg-[#EEF2F1] rounded-xl p-2 overflow-hidden">
              <iframe key={`${iframeKey}-${slugGuardado}`} ref={iframe} src={`/p/web/${slugGuardado}?borrador=1`} title="Vista previa"
                className="bg-white rounded-lg shadow transition-all"
                style={dispositivo === 'cel' ? { width: 390, height: 760, border: '8px solid #111', borderRadius: 32 } : { width: '100%', height: 760, border: 0 }} />
            </div>
          ) : (
            <p className="text-sm text-[#7A8A87] p-10 text-center">Guardando tu página por primera vez…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Interruptor({ activo, onClick }: { activo: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`relative w-10 h-6 rounded-full transition shrink-0 ${activo ? 'bg-[#00A895]' : 'bg-[#CBD5D3]'}`} aria-pressed={activo}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${activo ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

function SubirImagen({ titulo, ayuda, url, onUrl, subir, ancho }: {
  titulo: string; ayuda: string; url: string | null; onUrl: (u: string | null) => void; subir: (f: File) => Promise<string | null>; ancho?: boolean;
}) {
  const [subiendo, setSubiendo] = useState(false);
  return (
    <div>
      <label className={labelCls}>{titulo}</label>
      <div className="flex items-center gap-2 rounded-xl border border-[#E1E5E4] p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="" className={`${ancho ? 'w-24 h-12' : 'w-12 h-12'} rounded-lg object-cover bg-[#F1F5F4]`} /> : <div className={`${ancho ? 'w-24 h-12' : 'w-12 h-12'} rounded-lg bg-[#F1F5F4] flex items-center justify-center text-[#B5C0BE]`}>🖼</div>}
        <div className="flex-1 min-w-0"><p className="text-[10px] text-[#7A8A87]">{ayuda}</p>{url && <button onClick={() => onUrl(null)} className="text-[10px] text-[#DC2626]">Quitar</button>}</div>
        <label className="px-2.5 py-1.5 rounded-lg border border-[#E1E5E4] text-xs font-semibold cursor-pointer hover:bg-[#F4F7F6]">
          {subiendo ? '…' : '⬆'}
          <input type="file" accept="image/*" className="hidden" onChange={async e => {
            const f = e.target.files?.[0]; if (!f) return;
            setSubiendo(true); try { const u = await subir(f); if (u) onUrl(u); } finally { setSubiendo(false); e.target.value = ''; }
          }} />
        </label>
      </div>
    </div>
  );
}

function EditorSeccion({ s, cfg, cambiar, indice, subir }: {
  s: Seccion; cfg: ConfigPagina; cambiar: (f: (c: ConfigPagina) => ConfigPagina) => void; indice: number; subir: (f: File) => Promise<string | null>;
}) {
  const set = (f: (x: Seccion, c: ConfigPagina) => void) => cambiar(c => { f(c.secciones[indice], c); return c; });
  return (
    <>
      {s.tipo !== 'banner' && (
        <div><label className={labelCls}>Título de la sección</label>
          <input value={s.titulo} onChange={e => set(x => { x.titulo = e.target.value; })} className={inputCls} /></div>
      )}
      {s.tipo === 'banner' && <p className="text-[11px] text-[#5B6B68]">El banner se edita en «Personalización visual» (imagen, título, subtítulo y botón).</p>}
      {s.tipo === 'texto' && (
        <textarea value={s.texto ?? ''} onChange={e => set(x => { x.texto = e.target.value; })} rows={4} placeholder="Escribe el texto…" className={inputCls} />
      )}
      {s.tipo === 'nuevos' && (
        <div><label className={labelCls}>¿Cuántos productos mostrar?</label>
          <input type="number" min={2} max={24} value={cfg.nuevos_cantidad} onChange={e => cambiar(c => { c.nuevos_cantidad = Math.max(2, Math.min(24, Number(e.target.value) || 8)); return c; })} className={inputCls} />
          <p className="text-[10px] text-[#7A8A87] mt-1">Las fotos más recientes de los catálogos que elegiste.</p></div>
      )}
      {s.tipo === 'promociones' && <p className="text-[11px] text-[#5B6B68]">Muestra las promociones ACTIVAS del módulo Promociones (con su precio y su página).</p>}
      {s.tipo === 'contacto' && (
        <>
          <input value={cfg.contacto.whatsapp} onChange={e => cambiar(c => { c.contacto.whatsapp = e.target.value; return c; })} placeholder="WhatsApp (3001234567)" className={inputCls} />
          <input value={cfg.contacto.instagram} onChange={e => cambiar(c => { c.contacto.instagram = e.target.value; return c; })} placeholder="Instagram (@klixmant)" className={inputCls} />
          <textarea value={cfg.contacto.texto} onChange={e => cambiar(c => { c.contacto.texto = e.target.value; return c; })} rows={2} placeholder="Texto" className={inputCls} />
        </>
      )}
      {s.tipo === 'opiniones' && (
        <>
          <p className="text-[11px] text-[#5B6B68]">Escribe opiniones REALES de tus clientes (con su permiso). Si no hay ninguna, la sección no se muestra.</p>
          {cfg.opiniones.map((o: Opinion, i: number) => (
            <div key={i} className="rounded-lg border border-[#E1E5E4] p-2 space-y-1 bg-white">
              <div className="flex gap-1">
                <input value={o.nombre} onChange={e => cambiar(c => { c.opiniones[i].nombre = e.target.value; return c; })} placeholder="Nombre" className={`${inputCls} py-1.5`} />
                <select value={o.estrellas} onChange={e => cambiar(c => { c.opiniones[i].estrellas = Number(e.target.value); return c; })} className="rounded-lg border border-[#E1E5E4] text-xs px-1">
                  {[5, 4, 3].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
                </select>
                <button onClick={() => cambiar(c => { c.opiniones.splice(i, 1); return c; })} className="px-2 text-[#DC2626]">✕</button>
              </div>
              <textarea value={o.texto} onChange={e => cambiar(c => { c.opiniones[i].texto = e.target.value; return c; })} rows={2} placeholder="Lo que dijo" className={`${inputCls} py-1.5`} />
              <label className="text-[11px] text-[#00847A] font-semibold cursor-pointer">
                📷 {o.foto ? 'Cambiar foto' : 'Foto (opcional)'}
                <input type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) { const u = await subir(f); if (u) cambiar(c => { c.opiniones[i].foto = u; return c; }); } }} />
              </label>
            </div>
          ))}
          <button onClick={() => cambiar(c => { c.opiniones.push({ nombre: '', texto: '', estrellas: 5, foto: null }); return c; })} className="text-xs font-bold text-[#00847A]">+ Agregar opinión</button>
        </>
      )}
    </>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { generarCollage, generarPortada, aJpg, partir, colorDe, soloDisponibles } from '@/lib/collage-canvas';

/**
 * PANEL DE CATÁLOGOS (collages) — 09-nov-2026. Módulo independiente: solo LEE el catálogo KLIXMANT.
 * Aquí caen los collages que el dueño va creando. Un catálogo puede ser de UNA familia (ej. «NACIONAL»)
 * con prendas de varios catálogos. El collage se arma en el navegador con el formato aprobado.
 */
interface Item { id_item: number | null; nombre: string; color: string; foto: string; referencia: string }
interface Collage {
  id: string; nombre: string; familia: string | null; items: Item[]; imagen_url: string | null; imagenes: string[];
  ancho: number | null; alto: number | null; generado_at: string | null; actualizado_at: string; desactualizado: boolean; cambios: number;
  tipo?: 'auto' | 'personal' | 'familia'; hijos?: string[];
  hijos_det?: { id: string; nombre: string; imagenes: string[]; prendas: number; fotos?: string[]; prendas_det?: { foto: string; nombre: string; color: string }[] }[];
  portada_url?: string | null; portada_foto?: string | null; portada_titulo?: string | null;
}
/** Todas las imágenes de un catálogo (familia = las de sus collages, en orden). */
const imagenesDe = (c: Collage) => [
  ...(c.portada_url ? [c.portada_url] : []),            // la PORTADA va primero
  ...(c.tipo === 'familia'
    ? (c.hijos_det ?? []).flatMap(h => h.imagenes)
    : (c.imagenes?.length ? c.imagenes : [c.imagen_url]).filter(Boolean) as string[]),
];
/** Fotos de prendas disponibles para elegir la portada. */
const fotosDe = (c: Collage) => {
  const todas = c.tipo === 'familia' ? (c.hijos_det ?? []).flatMap(h => h.prendas_det ?? (h.fotos ?? []).map(f => ({ foto: f, nombre: '', color: '' })))
    : c.items.map(i => ({ foto: i.foto, nombre: i.nombre, color: i.color }));
  const vistas = new Set<string>(); return todas.filter(p => p.foto && !vistas.has(p.foto) && vistas.add(p.foto));
};
interface Prenda { id_item: number; catalogo: string; referencia: string; tipo: string; genero: string; color: string; nombre: string; foto: string; miniatura: string }

const VERDE = '#00A89D';
const tarjeta = 'bg-white rounded-2xl border border-[#E8ECEB] shadow-sm';
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }) : '—');

async function descargar(url: string, nombre: string) {
  const r = await fetch(`/api/collages/foto?u=${encodeURIComponent(url)}`);
  const b = await r.blob(); const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = `${nombre.replace(/[^\w\- ]+/g, '').trim() || 'collage'}.jpg`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function MisCatalogos() {
  const [lista, setLista] = useState<Collage[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState<{ id?: string; nombre: string; familia: string; items: Item[]; auto?: boolean } | null>(null);
  const [editFam, setEditFam] = useState<Collage | null>(null);
  const [portada, setPortada] = useState<Collage | null>(null);
  const [ver, setVer] = useState<Collage | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch('/api/collages', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setLista(j.collages ?? []); setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async (c: Collage) => {
    if (!confirm(`¿Quitar «${c.nombre}» del panel?`)) return;
    await fetch(`/api/collages?id=${c.id}`, { method: 'DELETE' }); setVer(null); cargar();
  };
  const compartir = (c: Collage) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${c.nombre}\n${imagenesDe(c).join('\n')}`)}`, '_blank');
  };
  const descargarTodas = async (c: Collage) => {
    const us = imagenesDe(c);
    for (let i = 0; i < us.length; i++) await descargar(us[i], `${c.nombre}${us.length > 1 ? `-${i + 1}` : ''}`);
  };

  const visibles = lista.filter(c => !q.trim() || `${c.nombre} ${c.familia ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#F4F6F5]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 py-5">
        <div className={`${tarjeta} p-4 mb-4 flex items-center gap-3 flex-wrap`}>
          <p className="flex-1 min-w-[240px] text-[13px] text-[#5B6B68]">Tus catálogos: <b>familias</b> (varios collages unidos, ej. NACIONAL) y collages <b>personalizados</b> (prendas de varios catálogos en una sola imagen).</p>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Buscar…" className="px-3 py-2.5 rounded-xl border border-[#E1E5E4] text-sm w-48" />
          <button onClick={() => setEditor({ nombre: '', familia: '', items: [] })} className="px-4 py-2.5 rounded-xl border border-[#0B7F78] text-[#0B7F78] text-sm font-bold">+ Collage personalizado</button>
        </div>
        {aviso && <p className="mb-3 text-sm px-4 py-2 rounded-xl bg-white border border-[#E8ECEB]">{aviso} <button className="ml-2 text-[#9AA]" onClick={() => setAviso(null)}>✕</button></p>}

        {cargando ? <p className="text-sm text-[#7A8A87] py-10 text-center">Cargando…</p>
          : visibles.length === 0 ? (
            <div className={`${tarjeta} p-10 text-center`}>
              <p className="text-4xl mb-2">🗂️</p>
              <p className="font-bold">Aún no hay catálogos</p>
              <p className="text-sm text-[#7A8A87] mt-1">En «Por catálogo» busca una familia (ej. «nacional»), marca sus collages y oprime «Unir en un catálogo».</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibles.map(c => (
                <div key={c.id} className={`${tarjeta} overflow-hidden flex flex-col`}>
                  <button onClick={() => setVer(c)} className="relative aspect-[4/3] bg-[#0B1220] overflow-hidden">
                    {c.portada_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.portada_url} alt={c.nombre} className="w-full h-full object-contain" loading="lazy" />
                    ) : c.tipo === 'familia' ? (
                      <div className="grid grid-cols-2 gap-0.5 w-full h-full">
                        {imagenesDe(c).slice(0, 4).map((u, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={u} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ))}
                      </div>
                    ) /* eslint-disable-next-line @next/next/no-img-element */
                      : c.imagen_url ? <img src={c.imagen_url} alt={c.nombre} className="w-full h-full object-contain" loading="lazy" />
                      : <span className="text-white/60 text-sm">Sin collage todavía</span>}
                    {c.tipo === 'familia' && <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-[#00A89D] text-white text-[11px] font-bold">📚 Familia · {(c.hijos_det ?? []).length} collages</span>}
                    {c.desactualizado && <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#F59E0B] text-white text-[11px] font-bold">⚠ Pendiente de actualizar</span>}
                    {(c.imagenes?.length ?? 0) > 1 && <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-bold">{c.imagenes.length} imágenes</span>}
                  </button>
                  <div className="p-3 flex-1 flex flex-col">
                    <p className="font-extrabold uppercase text-[14px] leading-tight">{c.nombre}</p>
                    <p className="text-[12px] text-[#7A8A87]">{c.tipo === 'familia' ? `${(c.hijos_det ?? []).reduce((a, h) => a + h.prendas, 0)} prendas · ${imagenesDe(c).length} imágenes` : `${c.familia ? `${c.familia} · ` : ''}${c.items.length} prendas`} · {fecha(c.generado_at ?? c.actualizado_at)}</p>
                    <div className="mt-auto pt-3 flex gap-1.5 flex-wrap">
                      {imagenesDe(c).length > 0 && <button onClick={() => descargarTodas(c)} className="px-2.5 py-1.5 rounded-lg border border-[#E1E5E4] text-xs font-semibold">⬇ Descargar</button>}
                      {imagenesDe(c).length > 0 && <button onClick={() => compartir(c)} className="px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold">WhatsApp</button>}
                      <button onClick={() => setPortada(c)} className="px-2.5 py-1.5 rounded-lg border border-[#A6F000] text-[#4D7C0F] text-xs font-bold">🖼 {c.portada_url ? 'Portada' : '+ Portada'}</button>
                      {c.tipo === 'familia'
                        ? <button onClick={() => setEditFam(c)} className="px-2.5 py-1.5 rounded-lg border border-[#E1E5E4] text-xs font-semibold">✎ Editar</button>
                        : <button onClick={() => setEditor({ id: c.id, nombre: c.nombre, familia: c.familia ?? '', items: c.items, auto: c.desactualizado })}
                          className="px-2.5 py-1.5 rounded-lg border border-[#E1E5E4] text-xs font-semibold">{c.imagen_url ? '↻ Regenerar' : '✎ Generar'}</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {ver && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" onClick={() => setVer(null)}>
          <div className="max-w-[1100px] w-full max-h-full overflow-auto bg-[#0B1220] rounded-2xl p-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2 text-white">
              <p className="font-extrabold uppercase flex-1">{ver.nombre}</p>
              <button onClick={() => compartir(ver)} className="px-3 py-1.5 rounded-lg bg-[#25D366] text-xs font-bold">WhatsApp</button>
              <button onClick={() => { navigator.clipboard?.writeText(imagenesDe(ver).join('\n')); setAviso('🔗 Enlace copiado.'); }} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold">Copiar enlace</button>
              <button onClick={() => eliminar(ver)} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold text-[#FCA5A5]">Quitar</button>
              <button onClick={() => setVer(null)} className="w-8 h-8 rounded-full bg-white/10 text-lg">×</button>
            </div>
            {imagenesDe(ver).map((u, i) => (
              <div key={i} className="mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u!} alt="" className="w-full rounded-xl" />
                <button onClick={() => descargar(u!, `${ver.nombre}${i ? `-${i + 1}` : ''}`)} className="mt-1 text-[12px] text-white/70 underline">⬇ Descargar esta imagen</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {editor && <Editor inicial={editor} onCerrar={() => setEditor(null)} onGuardado={msg => { setEditor(null); setAviso(msg); cargar(); }} />}
      {portada && <EditorPortada cat={portada} onCerrar={() => setPortada(null)} onGuardado={msg => { setPortada(null); setAviso(msg); cargar(); }} />}
      {editFam && <EditorFamilia fam={editFam} onCerrar={() => setEditFam(null)} onGuardado={msg => { setEditFam(null); setAviso(msg); cargar(); }} />}
    </div>
  );
}

function Editor({ inicial, onCerrar, onGuardado }: {
  inicial: { id?: string; nombre: string; familia: string; items: Item[]; auto?: boolean };
  onCerrar: () => void; onGuardado: (msg: string) => void;
}) {
  const [nombre, setNombre] = useState(inicial.nombre);
  const [familia, setFamilia] = useState(inicial.familia);
  const [items, setItems] = useState<Item[]>(inicial.items);
  const [buscar, setBuscar] = useState(inicial.familia || '');
  const [res, setRes] = useState<Prenda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [previas, setPrevias] = useState<HTMLCanvasElement[]>([]);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hacerBusqueda = async (t = buscar) => {
    if (!t.trim()) return;
    setBuscando(true);
    const r = await fetch(`/api/collages?buscar=${encodeURIComponent(t)}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setRes(j.prendas ?? []); setBuscando(false);
  };
  useEffect(() => { if (inicial.familia) hacerBusqueda(inicial.familia); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const tiene = (id: number) => items.some(i => i.id_item === id);
  const alternar = (p: Prenda) => {
    setPrevias([]);
    setItems(a => tiene(p.id_item) ? a.filter(i => i.id_item !== p.id_item)
      : [...a, { id_item: p.id_item, nombre: p.nombre, color: p.color, foto: p.foto, referencia: p.referencia }]);
  };
  const mover = (i: number, d: -1 | 1) => setItems(a => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return a; [b[i], b[j]] = [b[j], b[i]]; return b; });

  const generar = async () => {
    setError(null); setTrabajando('Armando el collage con las fotos originales…');
    try {
      const grupos = partir(items);
      const cvs: HTMLCanvasElement[] = [];
      for (const g of grupos) cvs.push(await generarCollage(g.map(i => ({ nombre: i.nombre, color: i.color, foto: i.foto }))));
      setPrevias(cvs);
    } catch (e: any) { setError(e?.message ?? 'No se pudo generar'); }
    setTrabajando(null);
  };
  useEffect(() => { if (inicial.auto && items.length) generar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const guardar = async () => {
    if (!nombre.trim()) { setError('Ponle nombre al catálogo.'); return; }
    if (!items.length) { setError('Escoge al menos una prenda.'); return; }
    setError(null); setTrabajando('Guardando…');
    try {
      const r = await fetch('/api/collages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: inicial.id, nombre, familia, items }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'No se pudo guardar');
      const id = j.id as string;
      let cvs = previas;
      if (!cvs.length) { const grupos = partir(items); cvs = []; for (const g of grupos) cvs.push(await generarCollage(g.map(i => ({ nombre: i.nombre, color: i.color, foto: i.foto })))); }
      const urls: string[] = [];
      for (const cv of cvs) {
        const fd = new FormData(); fd.append('id', id); fd.append('file', await aJpg(cv), 'collage.jpg');
        const u = await fetch('/api/collages/imagen', { method: 'POST', body: fd }); const ju = await u.json();
        if (!u.ok) throw new Error(ju.error ?? 'No se pudo subir la imagen'); urls.push(ju.url);
      }
      const p = await fetch('/api/collages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, imagenes: urls, ancho: cvs[0].width, alto: cvs[0].height }) });
      if (!p.ok) throw new Error('No se pudo guardar el collage');
      onGuardado(`✅ Catálogo «${nombre}» guardado con su collage.`);
    } catch (e: any) { setError(e?.message ?? 'Error'); }
    setTrabajando(null);
  };

  // Agrupa resultados por catálogo para escoger rápido
  // Solo HOMBRE cuando el catálogo lo tiene (sin repetir H y D del mismo color)
  const porCatalogo = Object.fromEntries(Object.entries(res.reduce<Record<string, Prenda[]>>((a, p) => { (a[p.catalogo] ??= []).push(p); return a; }, {}))
    .map(([cat, ps]) => { const h = ps.filter(p => p.genero === 'HOMBRE'); return [cat, h.length ? h : ps]; }));

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-stretch justify-center p-2 md:p-6" onClick={onCerrar}>
      <div className="w-full max-w-[1400px] bg-[#F4F6F5] rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 bg-white border-b border-[#E8ECEB] flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-extrabold flex-1">{inicial.id ? 'Editar catálogo' : 'Nuevo catálogo'}</h2>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre (ej. CATÁLOGO NACIONAL)" className="px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm w-64" />
          <input value={familia} onChange={e => setFamilia(e.target.value)} placeholder="Familia (ej. NACIONAL)" className="px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm w-44" />
          <button onClick={onCerrar} className="w-9 h-9 rounded-full bg-[#F1F5F4] text-lg">×</button>
        </div>
        <div className="flex-1 min-h-0 grid lg:grid-cols-[420px_1fr]">
          {/* Prendas */}
          <div className="border-r border-[#E8ECEB] flex flex-col min-h-0">
            <div className="p-3 flex gap-2">
              <input value={buscar} onChange={e => setBuscar(e.target.value)} onKeyDown={e => e.key === 'Enter' && hacerBusqueda()} placeholder="Buscar prendas (ej. nacional, ferrari)…" className="flex-1 px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm" />
              <button onClick={() => hacerBusqueda()} className="px-3 rounded-xl text-white text-sm font-bold" style={{ background: VERDE }}>{buscando ? '…' : 'Buscar'}</button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
              {Object.entries(porCatalogo).map(([cat, ps]) => (
                <div key={cat}>
                  <p className="text-[11.5px] font-extrabold uppercase text-[#5B6B68] mb-1">{cat} <span className="font-normal">({ps.length})</span></p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ps.map(p => (
                      <button key={p.id_item} onClick={() => alternar(p)} title={`${p.nombre} · ${p.referencia} · ${p.genero}`}
                        className={`relative rounded-lg overflow-hidden border-2 aspect-square ${tiene(p.id_item) ? 'border-[#00A89D] ring-2 ring-[#00A89D]/30' : 'border-transparent'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.miniatura} alt="" loading="lazy" className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8.5px] font-semibold px-1 py-0.5 truncate">{p.color} · {p.genero[0] ?? ''}</span>
                        {tiene(p.id_item) && <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full text-[10px] text-white flex items-center justify-center" style={{ background: VERDE }}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!res.length && !buscando && <p className="text-[12px] text-[#7A8A87] text-center py-6">Busca por familia o diseño y toca las prendas para agregarlas.</p>}
            </div>
          </div>
          {/* Seleccionadas + vista previa */}
          <div className="flex flex-col min-h-0">
            <div className="p-3 border-b border-[#E8ECEB] bg-white">
              <p className="text-[12px] font-bold mb-1.5">Prendas del collage ({items.length}) — el orden es el del collage (las 2 primeras salen grandes cuando son 5, 7 u 8)</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {items.map((it, i) => (
                  <div key={`${it.id_item}-${i}`} className="shrink-0 w-[150px] rounded-xl border border-[#E8ECEB] p-1.5 bg-[#FAFBFB]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.foto} alt="" className="w-full aspect-square object-cover rounded-lg" />
                    <input value={it.nombre} onChange={e => { setPrevias([]); setItems(a => a.map((x, k) => k === i ? { ...x, nombre: e.target.value } : x)); }}
                      className="mt-1 w-full text-[10px] font-bold uppercase px-1 py-0.5 rounded border border-[#E1E5E4]" title="Nombre del letrero" />
                    <div className="flex items-center gap-1 mt-1">
                      <span className="w-3 h-3 rounded-full border" style={{ background: colorDe(it.color) }} />
                      <span className="text-[10px] flex-1 truncate">{it.color}</span>
                      <button onClick={() => { setPrevias([]); mover(i, -1); }} className="text-[11px] px-1">◀</button>
                      <button onClick={() => { setPrevias([]); mover(i, 1); }} className="text-[11px] px-1">▶</button>
                      <button onClick={() => { setPrevias([]); setItems(a => a.filter((_, k) => k !== i)); }} className="text-[11px] px-1 text-[#DC2626]">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 bg-[#0B1220]">
              {trabajando ? <p className="text-white/80 text-sm text-center py-16">{trabajando}</p>
                : previas.length ? previas.map((cv, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={cv.toDataURL('image/jpeg', 0.85)} alt="" className="w-full rounded-xl mb-3" />
                )) : <p className="text-white/60 text-sm text-center py-16">Oprime «Generar collage» para ver cómo queda.</p>}
            </div>
            <div className="p-3 bg-white border-t border-[#E8ECEB] flex items-center gap-2 flex-wrap">
              {error && <p className="text-[12px] text-[#DC2626] flex-1">{error}</p>}
              <span className="flex-1" />
              <button onClick={generar} disabled={!items.length || !!trabajando} className="px-4 py-2 rounded-xl border border-[#0B7F78] text-[#0B7F78] text-sm font-bold disabled:opacity-40">🖼 Generar collage</button>
              <button onClick={guardar} disabled={!items.length || !!trabajando} className="px-5 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40" style={{ background: VERDE }}>💾 Guardar en el panel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Pestañas del panel: «Por catálogo» (un collage automático por catálogo KLIXMANT) y «Mis catálogos».
// ═══════════════════════════════════════════════════════════════════════════════════════════════
export default function CollagesPanel() {
  const [tab, setTab] = useState<'catalogos' | 'mis'>('catalogos');
  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#F4F6F5]">
      <div className="max-w-[1500px] w-full mx-auto px-4 md:px-6 pt-5">
        <div className={`${tarjeta} p-5 flex items-center gap-4 flex-wrap`}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-[#E6F7F4]">🖼️</div>
          <div className="flex-1 min-w-[240px]">
            <h1 className="text-2xl font-extrabold text-[#0D1F1C]">Panel de Catálogos</h1>
            <p className="text-[13px] text-[#5B6B68]">Un collage por cada catálogo de KLIXMANT (solo hombre, sin repetir colores). Luego une los que quieras en un catálogo por familia (ej. NACIONAL) para mandarlo por WhatsApp.</p>
          </div>
          <div className="flex p-1 rounded-xl bg-[#F1F5F4]">
            {([['catalogos', '📚 Por catálogo'], ['mis', '⭐ Mis catálogos']] as const).map(([k, t]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === k ? 'bg-white shadow text-[#0D1F1C]' : 'text-[#5B6B68]'}`}>{t}</button>
            ))}
          </div>
        </div>
      </div>
      {tab === 'catalogos' ? <PorCatalogo onUnido={() => setTab('mis')} /> : <MisCatalogos />}
    </div>
  );
}

interface CatK { id_catalogo: number; catalogo: string; items: Item[]; firma_hoy: string; collage: (Collage & { id_catalogo: number }) | null }

/** Arma, sube y guarda el collage automático de un catálogo KLIXMANT. Devuelve false si no hay fotos disponibles. */
async function generarAuto(c: CatK): Promise<boolean> {
  const items = await soloDisponibles(c.items);           // fuera «COLOR NO DISPONIBLE»
  if (!items.length) return false;
  const r = await fetch('/api/collages', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo: 'auto', id_catalogo: c.id_catalogo, nombre: c.catalogo, items }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'No se pudo guardar');
  const urls: string[] = []; let primero: HTMLCanvasElement | null = null;
  for (const g of partir(items)) {
    const cv = await generarCollage(g.map(i => ({ nombre: i.nombre, color: i.color, foto: i.foto }))); primero ??= cv;
    const fd = new FormData(); fd.append('id', j.id); fd.append('file', await aJpg(cv), 'collage.jpg');
    const u = await fetch('/api/collages/imagen', { method: 'POST', body: fd }); const ju = await u.json();
    if (!u.ok) throw new Error(ju.error ?? 'No se pudo subir'); urls.push(ju.url);
  }
  const p = await fetch('/api/collages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: j.id, imagenes: urls, ancho: primero?.width, alto: primero?.height, firma: c.firma_hoy }) });
  if (!p.ok) throw new Error('No se pudo guardar el collage');
  return true;
}

function PorCatalogo({ onUnido }: { onUnido: () => void }) {
  const [buscar, setBuscar] = useState('');
  const [hecho, setHecho] = useState('');                 // búsqueda ya cargada
  const [cats, setCats] = useState<CatK[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cola, setCola] = useState<{ total: number; hechos: number; actual: string } | null>(null);
  const [sinFotos, setSinFotos] = useState<Set<number>>(new Set());
  const [sel, setSel] = useState<string[]>([]);           // ids de collages a unir (en orden)
  const [unir, setUnir] = useState(false);
  const [ver, setVer] = useState<CatK | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async (t: string) => {
    setCargando(true);
    const r = await fetch(`/api/collages?catalogos=${encodeURIComponent(t || '*')}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setCats(j.catalogos ?? []); setHecho(t); setCargando(false);
    return (j.catalogos ?? []) as CatK[];
  }, []);

  /** Genera en orden, uno por uno (no satura la base ni el navegador). */
  const procesar = useCallback(async (lista: CatK[]) => {
    if (!lista.length) return;
    let n = 0; const fallos: string[] = [];
    setCola({ total: lista.length, hechos: 0, actual: lista[0].catalogo });
    for (const c of lista) {
      setCola({ total: lista.length, hechos: n, actual: c.catalogo });
      try { const ok = await generarAuto(c); if (!ok) setSinFotos(s => new Set(s).add(c.id_catalogo)); }
      catch { fallos.push(c.catalogo); }
      n++;
    }
    setCola(null);
    if (fallos.length) setAviso(`⚠️ No se pudieron generar: ${fallos.join(', ')}`);
  }, []);

  // Al buscar una familia, se generan SOLOS los collages que faltan de esos catálogos
  const buscarYGenerar = async (t = buscar) => {
    const lista = await cargar(t.trim());
    if (t.trim()) { await procesar(lista.filter(c => !c.collage?.imagen_url)); await cargar(t.trim()); }
  };

  const faltan = cats.filter(c => !c.collage?.imagen_url && !sinFotos.has(c.id_catalogo));
  const generarFaltantes = async () => {
    if (!faltan.length) return;
    if (faltan.length > 20 && !confirm(`Se van a generar ${faltan.length} collages, uno por uno. Puede tardar varios minutos; mejor fuera de horas pico. ¿Seguir?`)) return;
    await procesar(faltan); await cargar(hecho);
  };
  const regenerar = async (c: CatK) => { await procesar([c]); await cargar(hecho); };
  const alternar = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  // «Seleccionar todos»: todos los que tienen collage, en el orden en que se ven
  const conCollage = cats.map(c => c.collage?.imagen_url ? c.collage.id : '').filter(Boolean);
  const todosMarcados = conCollage.length > 0 && conCollage.every(id => sel.includes(id));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 py-4">
        <div className={`${tarjeta} p-3 mb-3 flex items-center gap-2 flex-wrap`}>
          <input value={buscar} onChange={e => setBuscar(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarYGenerar()}
            placeholder="Busca una familia o diseño (ej. nacional, ferrari, honda)…" className="flex-1 min-w-[240px] px-3 py-2.5 rounded-xl border border-[#E1E5E4] text-sm" />
          <button onClick={() => buscarYGenerar()} disabled={!!cola} className="px-4 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50" style={{ background: VERDE }}>Buscar y generar</button>
          <button onClick={() => { setBuscar(''); cargar(''); }} disabled={!!cola} className="px-3 py-2.5 rounded-xl border border-[#E1E5E4] text-sm font-semibold">Ver todos</button>
          {conCollage.length > 0 && (
            <button onClick={() => setSel(todosMarcados ? [] : conCollage)} className="px-3 py-2.5 rounded-xl border border-[#E1E5E4] text-sm font-semibold">
              {todosMarcados ? '☐ Quitar todos' : `☑ Seleccionar todos (${conCollage.length})`}
            </button>
          )}
          {faltan.length > 0 && !cola && <button onClick={generarFaltantes} className="px-3 py-2.5 rounded-xl border border-[#0B7F78] text-[#0B7F78] text-sm font-bold">🖼 Generar los que faltan ({faltan.length})</button>}
        </div>
        {cola && (
          <div className="mb-3 rounded-xl bg-[#0B1220] text-white px-4 py-3 text-sm">
            Generando collages… {cola.hechos + 1} de {cola.total}: <b>{cola.actual}</b>
            <div className="mt-2 h-1.5 rounded-full bg-white/15 overflow-hidden"><div className="h-full bg-[#00A89D]" style={{ width: `${Math.round((cola.hechos / cola.total) * 100)}%` }} /></div>
          </div>
        )}
        {aviso && <p className="mb-3 text-sm px-4 py-2 rounded-xl bg-white border border-[#E8ECEB]">{aviso} <button className="ml-2 text-[#9AA]" onClick={() => setAviso(null)}>✕</button></p>}

        {cargando ? <p className="text-sm text-[#7A8A87] py-10 text-center">Cargando catálogos…</p>
          : !cats.length ? (
            <div className={`${tarjeta} p-10 text-center`}>
              <p className="text-4xl mb-2">📚</p>
              <p className="font-bold">Busca una familia para empezar</p>
              <p className="text-sm text-[#7A8A87] mt-1">Ej. «nacional»: se arma solo un collage por cada catálogo (Betsson, Garra, Línea…). Luego marcas los que quieras y los unes en un catálogo.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-20">
              {cats.map(c => {
                const col = c.collage; const id = col?.id ?? '';
                const marcado = !!id && sel.includes(id);
                return (
                  <div key={c.id_catalogo} className={`${tarjeta} overflow-hidden flex flex-col ${marcado ? 'ring-2 ring-[#00A89D]' : ''}`}>
                    <button onClick={() => col?.imagen_url && setVer(c)} className="relative aspect-[4/3] bg-[#0B1220] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {col?.imagen_url ? <img src={col.imagen_url} alt={c.catalogo} className="w-full h-full object-contain" loading="lazy" />
                        : <span className="text-white/60 text-sm">{sinFotos.has(c.id_catalogo) ? 'Sin fotos disponibles' : cola ? 'En cola…' : 'Sin collage todavía'}</span>}
                      {col?.desactualizado && <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#F59E0B] text-white text-[11px] font-bold">⚠ Pendiente de actualizar</span>}
                      {id && col?.imagen_url && (
                        <span onClick={e => { e.stopPropagation(); alternar(id); }}
                          className={`absolute top-2 right-2 w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-black ${marcado ? 'bg-[#00A89D] border-[#00A89D] text-white' : 'bg-black/40 border-white text-white'}`}>
                          {marcado ? sel.indexOf(id) + 1 : ''}
                        </span>
                      )}
                    </button>
                    <div className="p-3 flex-1 flex flex-col">
                      <p className="font-extrabold uppercase text-[13.5px] leading-tight">{c.catalogo}</p>
                      <p className="text-[12px] text-[#7A8A87]">{c.items.length} colores{col?.generado_at ? ` · ${fecha(col.generado_at)}` : ''}</p>
                      <div className="mt-auto pt-3 flex gap-1.5 flex-wrap">
                        {col?.imagen_url && <button onClick={() => descargar(col.imagen_url!, c.catalogo)} className="px-2.5 py-1.5 rounded-lg border border-[#E1E5E4] text-xs font-semibold">⬇</button>}
                        {col?.imagen_url && <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${c.catalogo}\n${(col.imagenes?.length ? col.imagenes : [col.imagen_url]).join('\n')}`)}`, '_blank')} className="px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold">WhatsApp</button>}
                        <button onClick={() => regenerar(c)} disabled={!!cola} className="px-2.5 py-1.5 rounded-lg border border-[#E1E5E4] text-xs font-semibold disabled:opacity-40">{col?.imagen_url ? '↻ Regenerar' : '🖼 Generar'}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {sel.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] bg-[#0D1F1C] text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-sm"><b>{sel.length}</b> collage{sel.length > 1 ? 's' : ''} marcado{sel.length > 1 ? 's' : ''}</span>
          <button onClick={() => setUnir(true)} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: VERDE }}>📚 Unir en un catálogo</button>
          <button onClick={() => setSel([])} className="text-sm text-white/70">Quitar marcas</button>
        </div>
      )}
      {unir && <UnirModal ids={sel} sugerido={(hecho || '').toUpperCase()} onCerrar={() => setUnir(false)} onListo={() => { setUnir(false); setSel([]); onUnido(); }} />}

      {ver?.collage && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" onClick={() => setVer(null)}>
          <div className="max-w-[1100px] w-full max-h-full overflow-auto bg-[#0B1220] rounded-2xl p-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2 text-white">
              <p className="font-extrabold uppercase flex-1">{ver.catalogo}</p>
              <button onClick={() => setVer(null)} className="w-8 h-8 rounded-full bg-white/10 text-lg">×</button>
            </div>
            {(ver.collage.imagenes?.length ? ver.collage.imagenes : [ver.collage.imagen_url]).filter(Boolean).map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u!} alt="" className="w-full rounded-xl mb-3" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UnirModal({ ids, sugerido, onCerrar, onListo }: { ids: string[]; sugerido: string; onCerrar: () => void; onListo: () => void }) {
  const [nombre, setNombre] = useState(sugerido ? `CATÁLOGO ${sugerido}` : '');
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    if (!nombre.trim()) { setError('Ponle nombre.'); return; }
    const r = await fetch('/api/collages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'familia', nombre, familia: sugerido || nombre, hijos: ids }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) { setError(j.error ?? 'No se pudo crear'); return; }
    onListo();
  };
  return (
    <div className="fixed inset-0 z-[85] bg-black/50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="w-full max-w-md bg-white rounded-2xl p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold">📚 Unir en un catálogo</h3>
        <p className="text-[13px] text-[#5B6B68] mt-1">{ids.length} collages, en el orden en que los marcaste. Quedará en «Mis catálogos».</p>
        <input value={nombre} onChange={e => { setNombre(e.target.value); setError(null); }} autoFocus placeholder="Nombre (ej. CATÁLOGO NACIONAL)" className="mt-3 w-full px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm" />
        {error && <p className="text-[12px] text-[#DC2626] mt-1">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCerrar} className="px-4 py-2 rounded-xl border border-[#E1E5E4] text-sm font-semibold">Cancelar</button>
          <button onClick={guardar} className="px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ background: VERDE }}>Crear catálogo</button>
        </div>
      </div>
    </div>
  );
}

function EditorFamilia({ fam, onCerrar, onGuardado }: { fam: Collage; onCerrar: () => void; onGuardado: (msg: string) => void }) {
  const [nombre, setNombre] = useState(fam.nombre);
  const [hijos, setHijos] = useState(fam.hijos_det ?? []);
  const mover = (i: number, d: -1 | 1) => setHijos(a => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return a; [b[i], b[j]] = [b[j], b[i]]; return b; });
  const guardar = async () => {
    const r = await fetch('/api/collages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'familia', id: fam.id, nombre, familia: fam.familia, hijos: hijos.map(h => h.id) }) });
    if (r.ok) onGuardado(`✅ Catálogo «${nombre}» actualizado.`);
  };
  return (
    <div className="fixed inset-0 z-[85] bg-black/50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="w-full max-w-2xl bg-white rounded-2xl p-5 max-h-full overflow-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold mb-2">✎ Editar catálogo</h3>
        <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm mb-3" />
        <p className="text-[12px] text-[#5B6B68] mb-2">Orden de los collages (así se mandan). Para agregar más, márcalos en «Por catálogo» y únelos de nuevo.</p>
        <div className="grid grid-cols-3 gap-2">
          {hijos.map((h, i) => (
            <div key={h.id} className="rounded-xl border border-[#E8ECEB] p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={h.imagenes[0]} alt="" className="w-full aspect-[4/3] object-contain bg-[#0B1220] rounded-lg" />
              <p className="text-[10.5px] font-bold uppercase truncate mt-1">{h.nombre}</p>
              <div className="flex justify-between mt-1">
                <button onClick={() => mover(i, -1)} className="text-xs px-1">◀</button>
                <button onClick={() => setHijos(a => a.filter(x => x.id !== h.id))} className="text-xs px-1 text-[#DC2626]">✕ Quitar</button>
                <button onClick={() => mover(i, 1)} className="text-xs px-1">▶</button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCerrar} className="px-4 py-2 rounded-xl border border-[#E1E5E4] text-sm font-semibold">Cancelar</button>
          <button onClick={guardar} disabled={!hijos.length} className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40" style={{ background: VERDE }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}


/** PORTADA: plantilla KLIXMANT + una foto que elige el dueño (de las prendas del catálogo o subida de su equipo). */
function EditorPortada({ cat, onCerrar, onGuardado }: { cat: Collage; onCerrar: () => void; onGuardado: (msg: string) => void }) {
  const opciones = fotosDe(cat);
  const inicial = opciones.find(o => o.foto === cat.portada_foto) ?? (cat.portada_foto ? null : opciones[0]);
  const [titulo, setTitulo] = useState(cat.portada_titulo || inicial?.nombre || cat.nombre.replace(/^CAT[ÁA]LOGO\s+/i, ''));
  const [foto, setFoto] = useState<string>(cat.portada_foto || opciones[0]?.foto || '');
  const [color, setColor] = useState<string>(inicial?.color ?? '');
  const [subida, setSubida] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Vista previa en vivo
  useEffect(() => {
    let vivo = true; if (!foto) { setVista(null); return; }
    setTrabajando('Armando la portada…');
    generarPortada({ titulo, foto, color }).then(cv => { if (vivo) { setVista(cv.toDataURL('image/jpeg', 0.85)); setTrabajando(null); } })
      .catch(e => { if (vivo) { setError(e?.message ?? 'No se pudo armar'); setTrabajando(null); } });
    return () => { vivo = false; };
  }, [foto, titulo, color]);

  const subirArchivo = (f: File | undefined) => { if (!f) return; setSubida(f); setFoto(URL.createObjectURL(f)); };

  const guardar = async () => {
    if (!foto) { setError('Elige una foto.'); return; }
    setError(null); setTrabajando('Guardando portada…');
    try {
      // Si la foto se subió del equipo, se guarda primero (queda como la foto de la portada)
      let fotoFinal = foto;
      if (subida) {
        const fd = new FormData(); fd.append('id', cat.id); fd.append('file', subida, subida.name);
        const u = await fetch('/api/collages/imagen', { method: 'POST', body: fd }); const ju = await u.json();
        if (!u.ok) throw new Error(ju.error ?? 'No se pudo subir la foto'); fotoFinal = ju.url;
      }
      const cv = await generarPortada({ titulo, foto, color });
      const fd = new FormData(); fd.append('id', cat.id); fd.append('file', await aJpg(cv), 'portada.jpg');
      const r = await fetch('/api/collages/imagen', { method: 'POST', body: fd }); const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'No se pudo subir la portada');
      const p = await fetch('/api/collages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cat.id, portada_url: j.url, portada_foto: fotoFinal, portada_titulo: titulo }) });
      if (!p.ok) throw new Error('No se pudo guardar');
      onGuardado(`✅ Portada de «${cat.nombre}» guardada. Sale de primera al mandar el catálogo.`);
    } catch (e: any) { setError(e?.message ?? 'Error'); setTrabajando(null); }
  };
  const quitar = async () => {
    await fetch('/api/collages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cat.id, portada_url: '', portada_foto: '', portada_titulo: '' }) });
    onGuardado('Portada quitada.');
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/60 flex items-center justify-center p-3" onClick={onCerrar}>
      <div className="w-full max-w-5xl max-h-full overflow-auto bg-white rounded-2xl grid md:grid-cols-[1fr_420px]" onClick={e => e.stopPropagation()}>
        <div className="bg-[#0B1220] p-3 flex items-center justify-center min-h-[320px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {vista ? <img src={vista} alt="" className={`w-full max-w-[560px] rounded-xl ${trabajando ? 'opacity-60' : ''}`} />
            : <p className="text-white/60 text-sm">{trabajando ?? 'Elige una foto para ver la portada'}</p>}
        </div>
        <div className="p-5 flex flex-col gap-3">
          <h3 className="text-lg font-extrabold">🖼 Portada del catálogo</h3>
          <div>
            <label className="text-[12px] font-bold">Nombre del producto (con color)</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm uppercase" />
          </div>
          <div>
            <p className="text-[12px] font-bold mb-1">Foto de la portada (toca una o sube la tuya)</p>
            <div className="grid grid-cols-5 gap-1.5 max-h-56 overflow-y-auto pr-1">
              <label className="aspect-square rounded-lg border-2 border-dashed border-[#CBD5D3] flex flex-col items-center justify-center text-[10px] font-bold text-[#5B6B68] cursor-pointer hover:bg-[#F7FAF9]">
                ⬆<span>Subir</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => subirArchivo(e.target.files?.[0])} />
              </label>
              {subida && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" className="aspect-square object-cover rounded-lg border-2 border-[#00A89D]" />
              )}
              {opciones.map(o => (
                <button key={o.foto} title={o.nombre} onClick={() => { setSubida(null); setFoto(o.foto); setColor(o.color); if (o.nombre) setTitulo(o.nombre); }}
                  className={`aspect-square rounded-lg overflow-hidden border-2 ${!subida && foto === o.foto ? 'border-[#00A89D] ring-2 ring-[#00A89D]/30' : 'border-transparent'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.foto} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-[12px] text-[#DC2626]">{error}</p>}
          <div className="mt-auto flex gap-2 justify-end flex-wrap">
            {cat.portada_url && <button onClick={quitar} className="px-3 py-2 rounded-xl text-sm text-[#DC2626] mr-auto">Quitar portada</button>}
            <button onClick={onCerrar} className="px-4 py-2 rounded-xl border border-[#E1E5E4] text-sm font-semibold">Cancelar</button>
            <button onClick={guardar} disabled={!foto || !!trabajando} className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40" style={{ background: VERDE }}>Guardar portada</button>
          </div>
        </div>
      </div>
    </div>
  );
}

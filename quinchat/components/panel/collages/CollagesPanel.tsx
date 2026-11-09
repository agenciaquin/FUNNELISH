'use client';

import { useCallback, useEffect, useState } from 'react';
import { generarCollage, aJpg, partir, colorDe } from '@/lib/collage-canvas';

/**
 * PANEL DE CATÁLOGOS (collages) — 09-nov-2026. Módulo independiente: solo LEE el catálogo KLIXMANT.
 * Aquí caen los collages que el dueño va creando. Un catálogo puede ser de UNA familia (ej. «NACIONAL»)
 * con prendas de varios catálogos. El collage se arma en el navegador con el formato aprobado.
 */
interface Item { id_item: number | null; nombre: string; color: string; foto: string; referencia: string }
interface Collage {
  id: string; nombre: string; familia: string | null; items: Item[]; imagen_url: string | null; imagenes: string[];
  ancho: number | null; alto: number | null; generado_at: string | null; actualizado_at: string; desactualizado: boolean; cambios: number;
}
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

export default function CollagesPanel() {
  const [lista, setLista] = useState<Collage[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState<{ id?: string; nombre: string; familia: string; items: Item[]; auto?: boolean } | null>(null);
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
    const urls = c.imagenes?.length ? c.imagenes : [c.imagen_url];
    window.open(`https://wa.me/?text=${encodeURIComponent(`${c.nombre}\n${urls.filter(Boolean).join('\n')}`)}`, '_blank');
  };

  const visibles = lista.filter(c => !q.trim() || `${c.nombre} ${c.familia ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#F4F6F5]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 py-5">
        <div className={`${tarjeta} p-5 mb-4 flex items-center gap-4 flex-wrap`}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-[#E6F7F4]">🖼️</div>
          <div className="flex-1 min-w-[240px]">
            <h1 className="text-2xl font-extrabold text-[#0D1F1C]">Panel de Catálogos</h1>
            <p className="text-[13px] text-[#5B6B68]">Collages listos para mandar por WhatsApp, con las fotos originales de KLIXMANT y el nombre de cada prenda. Arma catálogos por familia (ej. NACIONAL).</p>
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Buscar catálogo…" className="px-3 py-2.5 rounded-xl border border-[#E1E5E4] text-sm w-56" />
          <button onClick={() => setEditor({ nombre: '', familia: '', items: [] })} className="px-5 py-2.5 rounded-xl text-white text-sm font-bold" style={{ background: VERDE }}>+ Nuevo catálogo</button>
        </div>
        {aviso && <p className="mb-3 text-sm px-4 py-2 rounded-xl bg-white border border-[#E8ECEB]">{aviso} <button className="ml-2 text-[#9AA]" onClick={() => setAviso(null)}>✕</button></p>}

        {cargando ? <p className="text-sm text-[#7A8A87] py-10 text-center">Cargando…</p>
          : visibles.length === 0 ? (
            <div className={`${tarjeta} p-10 text-center`}>
              <p className="text-4xl mb-2">🗂️</p>
              <p className="font-bold">Aún no hay catálogos</p>
              <p className="text-sm text-[#7A8A87] mt-1">Oprime «+ Nuevo catálogo», busca las prendas (ej. «nacional») y genera el collage.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibles.map(c => (
                <div key={c.id} className={`${tarjeta} overflow-hidden flex flex-col`}>
                  <button onClick={() => setVer(c)} className="relative aspect-[4/3] bg-[#0B1220] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.imagen_url ? <img src={c.imagen_url} alt={c.nombre} className="w-full h-full object-contain" loading="lazy" />
                      : <span className="text-white/60 text-sm">Sin collage todavía</span>}
                    {c.desactualizado && <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#F59E0B] text-white text-[11px] font-bold">⚠ Pendiente de actualizar</span>}
                    {(c.imagenes?.length ?? 0) > 1 && <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-bold">{c.imagenes.length} imágenes</span>}
                  </button>
                  <div className="p-3 flex-1 flex flex-col">
                    <p className="font-extrabold uppercase text-[14px] leading-tight">{c.nombre}</p>
                    <p className="text-[12px] text-[#7A8A87]">{c.familia ? `${c.familia} · ` : ''}{c.items.length} prendas · {fecha(c.generado_at ?? c.actualizado_at)}</p>
                    <div className="mt-auto pt-3 flex gap-1.5 flex-wrap">
                      {c.imagen_url && <button onClick={() => descargar(c.imagen_url!, c.nombre)} className="px-2.5 py-1.5 rounded-lg border border-[#E1E5E4] text-xs font-semibold">⬇ Descargar</button>}
                      {c.imagen_url && <button onClick={() => compartir(c)} className="px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold">WhatsApp</button>}
                      <button onClick={() => setEditor({ id: c.id, nombre: c.nombre, familia: c.familia ?? '', items: c.items, auto: c.desactualizado })}
                        className="px-2.5 py-1.5 rounded-lg border border-[#E1E5E4] text-xs font-semibold">{c.imagen_url ? '↻ Regenerar' : '✎ Generar'}</button>
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
              <button onClick={() => { navigator.clipboard?.writeText((ver.imagenes?.length ? ver.imagenes : [ver.imagen_url]).filter(Boolean).join('\n')); setAviso('🔗 Enlace copiado.'); }} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold">Copiar enlace</button>
              <button onClick={() => eliminar(ver)} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold text-[#FCA5A5]">Quitar</button>
              <button onClick={() => setVer(null)} className="w-8 h-8 rounded-full bg-white/10 text-lg">×</button>
            </div>
            {(ver.imagenes?.length ? ver.imagenes : [ver.imagen_url]).filter(Boolean).map((u, i) => (
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
  const porCatalogo = res.reduce<Record<string, Prenda[]>>((a, p) => { (a[p.catalogo] ??= []).push(p); return a; }, {});

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

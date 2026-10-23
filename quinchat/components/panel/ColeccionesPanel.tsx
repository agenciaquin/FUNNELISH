'use client';

import { useEffect, useMemo, useState } from 'react';

interface Prod { id: string; nombre: string; categoria?: string | null; foto?: string | null; activo?: boolean }
interface Coleccion {
  id: string; nombre: string; slug: string; titulo?: string | null;
  palabra?: string | null; categoria?: string | null; producto_ids: string[]; activo: boolean;
}

const BASE = 'https://pedido.klixmant.shop/promos';
const norm = (s: any) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Colecciones: catálogos filtrados con su propio link (/promos?col=slug).
 * Los productos entran por: selección manual + palabra clave + categoría.
 * El link se puede combinar con un vendedor: ?col=slug&v=codigo.
 */
export default function ColeccionesPanel() {
  const [cols, setCols] = useState<Coleccion[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  // Formulario (crear / editar)
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [titulo, setTitulo] = useState('');
  const [palabra, setPalabra] = useState('');
  const [categoria, setCategoria] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [buscar, setBuscar] = useState('');
  const [guardando, setGuardando] = useState(false);

  function cargar() {
    setCargando(true);
    Promise.all([
      fetch('/api/colecciones-promo').then(r => r.json()).then(d => setCols(d.colecciones ?? [])).catch(() => {}),
      fetch('/api/promociones?admin=1').then(r => r.json()).then(d => setProds((d.promociones ?? []).map((p: any) => ({ id: p.id, nombre: p.nombre, categoria: p.categoria, foto: p.foto, activo: p.activo })))).catch(() => {}),
    ]).finally(() => setCargando(false));
  }
  useEffect(() => { cargar(); }, []);

  const categorias = useMemo(() => {
    const c = new Set<string>();
    for (const p of prods) { const k = (p.categoria || '').trim(); if (k) c.add(k); }
    return [...c].sort();
  }, [prods]);

  const prodsFiltrados = useMemo(() => {
    const q = norm(buscar).trim();
    if (!q) return prods;
    return prods.filter(p => norm(`${p.nombre} ${p.categoria ?? ''}`).includes(q));
  }, [prods, buscar]);

  // Cuántos productos mostraría una colección (manual ∪ palabra ∪ categoría)
  function contar(c: Coleccion): number {
    const ids = new Set((c.producto_ids ?? []).map(String));
    const pal = norm(c.palabra); const cat = norm(c.categoria);
    return prods.filter(p => {
      if (ids.has(String(p.id))) return true;
      if (pal && norm(`${p.nombre} ${p.categoria ?? ''}`).includes(pal)) return true;
      if (cat && norm(p.categoria) === cat) return true;
      return false;
    }).length;
  }

  function limpiar() {
    setEditId(null); setNombre(''); setTitulo(''); setPalabra(''); setCategoria(''); setSel(new Set()); setBuscar('');
  }
  function editar(c: Coleccion) {
    setEditId(c.id); setNombre(c.nombre); setTitulo(c.titulo ?? ''); setPalabra(c.palabra ?? '');
    setCategoria(c.categoria ?? ''); setSel(new Set((c.producto_ids ?? []).map(String))); setBuscar('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const toggleProd = (id: string) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function guardar() {
    setAviso(null);
    if (!nombre.trim()) { setAviso('Escribe el nombre de la colección.'); return; }
    if (!palabra.trim() && !categoria.trim() && sel.size === 0) {
      setAviso('Elige al menos productos, una palabra clave o una categoría.'); return;
    }
    setGuardando(true);
    try {
      const res = await fetch('/api/colecciones-promo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editId || undefined, nombre: nombre.trim(), titulo: titulo.trim() || undefined, palabra: palabra.trim() || undefined, categoria: categoria.trim() || undefined, producto_ids: [...sel] }),
      });
      const d = await res.json();
      if (!res.ok) { setAviso(d.error || 'No se pudo guardar.'); return; }
      limpiar(); cargar();
    } catch { setAviso('Error de conexión.'); }
    finally { setGuardando(false); }
  }

  async function eliminar(c: Coleccion) {
    if (!confirm(`¿Eliminar la colección "${c.nombre}"? Su link dejará de funcionar.`)) return;
    await fetch(`/api/colecciones-promo?id=${c.id}`, { method: 'DELETE' });
    if (editId === c.id) limpiar();
    cargar();
  }
  async function toggleActiva(c: Coleccion) {
    await fetch('/api/colecciones-promo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, nombre: c.nombre, titulo: c.titulo, palabra: c.palabra, categoria: c.categoria, producto_ids: c.producto_ids, activo: !c.activo }),
    });
    cargar();
  }
  function copiar(c: Coleccion) {
    const link = `${BASE}?col=${c.slug}`;
    navigator.clipboard?.writeText(link);
    setCopiado(c.id);
    setTimeout(() => setCopiado(x => (x === c.id ? null : x)), 1800);
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm focus:outline-none focus:border-[#00A89D]';

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto bg-[#FAF9F6]">
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-6 max-w-5xl mx-auto pb-24">
        <header className="mb-4 pl-10 md:pl-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">🗂️ Colecciones</h1>
          <p className="text-xs text-[#6B6B6B] mt-1">
            Catálogos filtrados con su propio link (ej. solo los del Nacional). Elige productos a mano,
            por <b>palabra clave</b> (los nuevos que coincidan entran solos) y/o por <b>categoría</b>.
            El link se puede combinar con un vendedor: <code>?col=slug&amp;v=codigo</code>.
          </p>
        </header>

        {/* Formulario */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-4 mb-5">
          <div className="text-[12px] font-bold text-[#0D0D0D] mb-2">{editId ? '✏️ Editar colección' : '➕ Nueva colección'}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre (ej. Nacional)" className={inputCls} />
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título en el catálogo (opcional, ej. ⚽ Colección Nacional)" className={inputCls} />
            <input value={palabra} onChange={e => setPalabra(e.target.value)} placeholder="Palabra clave automática (opcional, ej. nacional)" className={inputCls} />
            <select value={categoria} onChange={e => setCategoria(e.target.value)} className={inputCls}>
              <option value="">Categoría (opcional)</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="text-[11px] font-bold text-[#6B6B6B] mt-2 mb-1">Productos manuales {sel.size > 0 && <span className="text-[#00A89D]">· {sel.size} seleccionados</span>}</div>
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="🔎 Buscar producto para marcar…" className={`${inputCls} mb-2`} />
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <button
              onClick={() => setSel(prev => { const n = new Set(prev); prodsFiltrados.forEach(p => n.add(p.id)); return n; })}
              className="px-3 py-1.5 rounded-lg bg-[#E8F7F5] border border-[#00A89D]/40 text-[#00847A] text-[12px] font-semibold hover:bg-[#D5F0EC]"
            >✓ Seleccionar todos los filtrados ({prodsFiltrados.length})</button>
            {buscar.trim() && (
              <button
                onClick={() => setSel(prev => { const n = new Set(prev); prodsFiltrados.forEach(p => n.delete(p.id)); return n; })}
                className="px-3 py-1.5 rounded-lg border border-[#E0E0E0] text-[#6B6B6B] text-[12px] font-semibold hover:bg-[#F4F4F4]"
              >Quitar los filtrados</button>
            )}
            {sel.size > 0 && (
              <button onClick={() => setSel(new Set())} className="px-3 py-1.5 rounded-lg border border-[#E0E0E0] text-[#6B6B6B] text-[12px] font-semibold hover:bg-[#F4F4F4]">Limpiar selección</button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto border border-[#EFEFEF] rounded-xl p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
            {prodsFiltrados.map(p => {
              const on = sel.has(p.id);
              return (
                <button key={p.id} onClick={() => toggleProd(p.id)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left border ${on ? 'border-[#00A89D] bg-[#E8F7F5]' : 'border-transparent hover:bg-[#F4F4F4]'}`}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${on ? 'bg-[#00A89D] border-[#00A89D] text-white' : 'border-[#CCC]'}`}>{on ? '✓' : ''}</span>
                  {p.foto
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.foto} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                    : <span className="w-7 h-7 rounded bg-[#EEE] shrink-0" />}
                  <span className="text-[12px] text-[#0D0D0D] truncate">{p.nombre}</span>
                </button>
              );
            })}
            {prodsFiltrados.length === 0 && <p className="text-[12px] text-[#9A9A9A] p-2">Sin productos.</p>}
          </div>

          {aviso && <p className="text-[12px] text-[#C0392B] font-semibold mt-2">⚠️ {aviso}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={guardar} disabled={guardando} className="px-4 py-2 rounded-lg bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A] disabled:opacity-50">
              {guardando ? 'Guardando…' : (editId ? 'Guardar cambios' : 'Crear colección')}
            </button>
            {editId && <button onClick={limpiar} className="px-4 py-2 rounded-lg border border-[#E0E0E0] text-[#6B6B6B] text-sm font-semibold hover:bg-[#F4F4F4]">Cancelar</button>}
          </div>
        </div>

        {/* Lista */}
        {cargando ? (
          <p className="text-sm text-[#6B6B6B] py-6 text-center">Cargando…</p>
        ) : cols.length === 0 ? (
          <p className="text-sm text-[#6B6B6B] py-6 text-center">Aún no tienes colecciones. Crea la primera arriba 👆</p>
        ) : (
          <div className="flex flex-col gap-2">
            {cols.map(c => (
              <div key={c.id} className={`bg-white rounded-2xl border border-[#E8E8E8] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 ${c.activo ? '' : 'opacity-60'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold text-[#0D0D0D]">{c.titulo?.trim() || c.nombre}</span>
                    <span className="text-[11px] text-[#6B6B6B] bg-[#F0F0F0] px-2 py-0.5 rounded-full">{contar(c)} productos</span>
                    {!c.activo && <span className="text-[10px] font-bold text-[#C0392B] bg-[#FDECEA] px-2 py-0.5 rounded-full">Inactiva</span>}
                  </div>
                  <div className="text-[11px] text-[#9A9A9A]">
                    {c.producto_ids?.length ? `${c.producto_ids.length} manuales` : ''}{c.palabra ? ` · palabra: "${c.palabra}"` : ''}{c.categoria ? ` · categoría: ${c.categoria}` : ''}
                  </div>
                  <a href={`${BASE}?col=${c.slug}`} target="_blank" rel="noreferrer" className="text-[12px] text-[#00847A] font-semibold underline break-all">{`${BASE}?col=${c.slug}`}</a>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <button onClick={() => copiar(c)} className="px-3 py-2 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A] whitespace-nowrap">{copiado === c.id ? '✓ Copiado' : '📋 Copiar link'}</button>
                  <button onClick={() => editar(c)} className="px-3 py-2 rounded-lg border border-[#E0E0E0] text-[#0D0D0D] text-xs font-semibold hover:bg-[#F4F4F4]">Editar</button>
                  <button onClick={() => toggleActiva(c)} className="px-3 py-2 rounded-lg border border-[#E0E0E0] text-[#6B6B6B] text-xs font-semibold hover:bg-[#F4F4F4] whitespace-nowrap">{c.activo ? 'Desactivar' : 'Activar'}</button>
                  <button onClick={() => eliminar(c)} className="px-2.5 py-2 rounded-lg border border-[#F0D0D0] text-[#C0392B] text-xs font-semibold hover:bg-[#FDECEA]">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

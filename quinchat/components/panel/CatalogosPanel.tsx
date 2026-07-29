'use client';

import { useState, useEffect, useRef } from 'react';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface ColorVariant {
  id: string;
  catalogo_id: string;
  color: string;
  nombre_producto: string;
  url_imagen: string | null;
  orden: number;
}

interface Catalogo {
  id: string;
  familia: string;
  patron: string;
  anuncios?: string | null;
  catalogo_colores: ColorVariant[];
}

// ── Modal de catálogo ──────────────────────────────────────────────────────────
function ModalCatalogo({
  initial,
  onSave,
  onClose,
}: {
  initial?: Catalogo;
  onSave: (familia: string, patron: string, anuncios: string) => void;
  onClose: () => void;
}) {
  const [familia, setFamilia] = useState(initial?.familia ?? '');
  const [patron,  setPatron]  = useState(initial?.patron  ?? '');
  const [ids, setIds] = useState<string[]>(
    String(initial?.anuncios ?? '').split(/[,\n]+/).map(s => s.trim()).filter(Boolean),
  );

  // Auto-fill patron cuando cambia familia (solo si aún no fue editado)
  const patronEdited = useRef(!!initial?.patron);

  // Detectar IDs repetidos: cuántas veces aparece cada ID (ya recortado).
  const conteoIds = new Map<string, number>();
  for (const raw of ids) {
    const v = raw.trim();
    if (v) conteoIds.set(v, (conteoIds.get(v) ?? 0) + 1);
  }
  const esRepetido = (i: number) => {
    const v = ids[i].trim();
    return !!v && (conteoIds.get(v) ?? 0) > 1;
  };
  const hayRepetidos = [...conteoIds.values()].some(n => n > 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E8E8E8] flex items-center justify-between">
          <h3 className="text-base font-bold text-[#0D0D0D]">
            {initial ? 'Editar catálogo' : 'Nuevo catálogo'}
          </h3>
          <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#0D0D0D] text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide block mb-1">
              Nombre de la familia *
            </label>
            <input
              className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A89D]/40"
              placeholder="Ej: NEW YORK, COLOMBIA, PORTUGAL…"
              value={familia}
              onChange={e => {
                setFamilia(e.target.value);
                if (!patronEdited.current) setPatron(e.target.value);
              }}
            />
            <p className="text-[11px] text-[#6B6B6B] mt-1">Este nombre se muestra en el panel.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide block mb-1">
              Patrón de detección *
            </label>
            <input
              className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A89D]/40"
              placeholder="Texto que aparece en el nombre del producto Funnelish"
              value={patron}
              onChange={e => { setPatron(e.target.value); patronEdited.current = true; }}
            />
            <p className="text-[11px] text-[#6B6B6B] mt-1">
              El bot busca este texto en el nombre del pedido. Ej: si el pedido dice <strong>BEIGE NEW YORK</strong>, el patrón es <strong>NEW YORK</strong>.
            </p>
          </div>

          {/* IDs de anuncios (una lista: agregar / quitar) */}
          <div>
            <label className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide block mb-1">
              🎯 IDs de anuncios de este producto
            </label>
            <div className="space-y-2">
              {ids.map((id, i) => {
                const repetido = esRepetido(i);
                return (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1">
                    <input
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                        repetido
                          ? 'border-[#DC2626] bg-[#FEF2F2] focus:ring-[#DC2626]/40'
                          : 'border-[#E8E8E8] focus:ring-[#00A89D]/40'
                      }`}
                      placeholder="Ej: 120210000001"
                      value={id}
                      onChange={e => setIds(prev => prev.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    {repetido && (
                      <p className="text-[11px] text-[#DC2626] font-semibold mt-1">⚠️ ID repetido — este anuncio ya está en la lista</p>
                    )}
                  </div>
                  <button
                    onClick={() => setIds(prev => prev.filter((_, j) => j !== i))}
                    className="w-9 h-9 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] shrink-0 mt-0.5"
                    title="Eliminar este ID"
                  >✕</button>
                </div>
                );
              })}
            </div>
            {hayRepetidos && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] px-3 py-2">
                <span className="text-[11px] text-[#B91C1C] font-semibold">
                  ⚠️ Hay IDs repetidos marcados en rojo. Quítalos para que no cuenten doble.
                </span>
                <button
                  onClick={() => setIds(prev => {
                    const vistos = new Set<string>();
                    const limpio: string[] = [];
                    for (const raw of prev) {
                      const v = raw.trim();
                      if (!v) { limpio.push(raw); continue; }
                      if (vistos.has(v)) continue; // descarta el repetido
                      vistos.add(v); limpio.push(raw);
                    }
                    return limpio;
                  })}
                  className="text-[11px] font-bold text-[#00847A] hover:underline shrink-0"
                >Quitar repetidos</button>
              </div>
            )}
            <button
              onClick={() => setIds(prev => [...prev, ''])}
              className="mt-2 text-xs text-[#00A89D] font-semibold hover:underline"
            >+ Agregar ID de anuncio</button>
            <p className="text-[11px] text-[#6B6B6B] mt-2">
              Cuando alguien llegue por uno de estos anuncios, el bot de ventas sabrá que quiere
              <strong> {familia || 'este producto'}</strong> y le hablará de él directo.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#E8E8E8] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#6B6B6B] hover:text-[#0D0D0D] rounded-xl border border-[#E8E8E8] hover:bg-[#F5F5F5] transition-all">
            Cancelar
          </button>
          <button
            onClick={() => familia.trim() && patron.trim() && onSave(familia.trim().toUpperCase(), patron.trim().toUpperCase(), [...new Set(ids.map(s => s.trim()).filter(Boolean))].join(', '))}
            disabled={!familia.trim() || !patron.trim()}
            className="px-5 py-2 text-sm font-semibold bg-[#00A89D] text-white rounded-xl hover:bg-[#008F85] disabled:opacity-40 transition-all"
          >
            {initial ? 'Guardar cambios' : 'Crear catálogo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de color ─────────────────────────────────────────────────────────────
function ModalColor({
  catalogoId,
  initial,
  onSave,
  onClose,
}: {
  catalogoId: string;
  initial?: ColorVariant;
  onSave: (color: string, nombreProducto: string, urlImagen: string | null) => void;
  onClose: () => void;
}) {
  const [color,     setColor]     = useState(initial?.color           ?? '');
  const [nombre,    setNombre]    = useState(initial?.nombre_producto ?? '');
  const [url,       setUrl]       = useState(initial?.url_imagen      ?? '');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch('/api/catalogos/upload-imagen', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) setUrl(data.url);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E8E8E8] flex items-center justify-between">
          <h3 className="text-base font-bold text-[#0D0D0D]">
            {initial ? 'Editar color' : 'Agregar color'}
          </h3>
          <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#0D0D0D] text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">

          {/* Foto */}
          <div>
            <label className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide block mb-2">
              Foto del producto
            </label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

            {url ? (
              <div className="relative w-full h-48 rounded-xl overflow-hidden border border-[#E8E8E8] bg-[#F5F5F5]">
                <img src={url} alt={nombre || 'producto'} className="w-full h-full object-cover" />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-white/90 text-xs font-semibold px-3 py-1.5 rounded-lg shadow border border-[#E8E8E8] hover:bg-white transition-all"
                >
                  Cambiar foto
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full h-36 rounded-xl border-2 border-dashed border-[#E8E8E8] hover:border-[#00A89D] bg-[#F8F8F8] hover:bg-[#00A89D]/5 flex flex-col items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <span className="text-2xl">⏳</span>
                    <span className="text-sm text-[#6B6B6B]">Subiendo foto...</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl">📷</span>
                    <span className="text-sm font-semibold text-[#00A89D]">Subir foto</span>
                    <span className="text-xs text-[#6B6B6B]">Haz clic para seleccionar desde tu computador</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Nombre del color */}
          <div>
            <label className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide block mb-1">
              Nombre del color *
            </label>
            <input
              className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A89D]/40"
              placeholder="Ej: Negro, Beige, Azul Navy…"
              value={color}
              onChange={e => setColor(e.target.value)}
            />
          </div>

          {/* Nombre del producto */}
          <div>
            <label className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide block mb-1">
              Nombre del producto *
            </label>
            <input
              className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A89D]/40"
              placeholder="Ej: NEGRO NEW YORK"
              value={nombre}
              onChange={e => setNombre(e.target.value.toUpperCase())}
            />
            <p className="text-[11px] text-[#6B6B6B] mt-1">
              Nombre exacto del producto en Funnelish.
            </p>
          </div>

        </div>

        <div className="px-6 py-4 border-t border-[#E8E8E8] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#6B6B6B] hover:text-[#0D0D0D] rounded-xl border border-[#E8E8E8] hover:bg-[#F5F5F5] transition-all">
            Cancelar
          </button>
          <button
            onClick={() => color.trim() && nombre.trim() && onSave(color.trim(), nombre.trim(), url || null)}
            disabled={!color.trim() || !nombre.trim() || uploading}
            className="px-5 py-2 text-sm font-semibold bg-[#00A89D] text-white rounded-xl hover:bg-[#008F85] disabled:opacity-40 transition-all"
          >
            {initial ? 'Guardar cambios' : 'Agregar color'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel principal ────────────────────────────────────────────────────────────
export default function CatalogosPanel() {
  const [catalogos,  setCatalogos]  = useState<Catalogo[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [busqueda,   setBusqueda]   = useState('');
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Modales
  const [modalCat,   setModalCat]   = useState<null | 'new' | Catalogo>(null);
  const [modalColor, setModalColor] = useState<null | { catalogoId: string; item: ColorVariant }>(null);

  // Formulario inline para agregar color
  const [inlineAdd,      setInlineAdd]      = useState<string | null>(null); // catalogoId
  const [inlineColor,    setInlineColor]    = useState('');
  const [inlineNombre,   setInlineNombre]   = useState('');
  const [inlineUrl,      setInlineUrl]      = useState('');
  const [inlineUploading, setInlineUploading] = useState(false);
  const inlineFileRef = useRef<HTMLInputElement>(null);

  // Re-estampar marca de agua en todas las fotos que aún no la tienen
  const [marcando, setMarcando] = useState(false);
  const [marcaAviso, setMarcaAviso] = useState<string | null>(null);
  const reestamparTodas = async () => {
    if (marcando) return;
    setMarcando(true);
    setMarcaAviso('Marcando fotos…');
    try {
      let total = 0;
      let fallos = 0;
      let errMsg: string | null = null;
      for (let i = 0; i < 80; i++) { // hasta 80 lotes
        const res  = await fetch('/api/catalogos/re-estampar', { method: 'POST' });
        const data = await res.json();
        total += data.procesadas ?? 0;
        fallos = data.fallos ?? 0;
        if (data.error) errMsg = data.error;
        setMarcaAviso(`Marcando fotos… (${total} listas, faltan ${data.restantes ?? 0})`);
        if (!data.restantes) break;
        if (!(data.procesadas > 0)) break; // sin avance → parar
      }
      if (total === 0 && fallos > 0) {
        setMarcaAviso(`❌ No se pudieron marcar. Motivo: ${errMsg ?? 'desconocido'}`);
      } else {
        setMarcaAviso(`✅ Listo, marqué ${total} foto${total === 1 ? '' : 's'}.`);
      }
      await load();
    } catch {
      setMarcaAviso('❌ Hubo un problema. Intenta de nuevo.');
    } finally {
      setMarcando(false);
      setTimeout(() => setMarcaAviso(null), 6000);
    }
  };

  // ── Cargar datos ─────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/catalogos');
    if (res.ok) setCatalogos(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Filtro de búsqueda ───────────────────────────────────────────────────────
  const filtered = catalogos.filter(c =>
    c.familia.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.patron.toLowerCase().includes(busqueda.toLowerCase())
  );

  // ── Handlers de catálogo ─────────────────────────────────────────────────────
  const handleSaveCat = async (familia: string, patron: string, anuncios: string) => {
    if (modalCat && typeof modalCat === 'object' && 'id' in modalCat) {
      await fetch(`/api/catalogos/${modalCat.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familia, patron, anuncios }),
      });
    } else {
      const res = await fetch('/api/catalogos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familia, patron, anuncios }),
      });
      if (res.ok) {
        const nuevo: Catalogo = await res.json();
        setExpanded(prev => ({ ...prev, [nuevo.id]: true }));
        openInline(nuevo.id);
      }
    }
    setModalCat(null);
    load();
  };

  const handleDeleteCat = async (id: string) => {
    if (!confirm('¿Eliminar este catálogo y todos sus colores?')) return;
    await fetch(`/api/catalogos/${id}`, { method: 'DELETE' });
    load();
  };

  // ── Handlers de color (modal editar) ─────────────────────────────────────────
  const handleSaveColor = async (color: string, nombreProducto: string, urlImagen: string | null) => {
    if (!modalColor) return;
    await fetch(`/api/catalogos/colores/${modalColor.item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color, nombre_producto: nombreProducto, url_imagen: urlImagen }),
    });
    setModalColor(null);
    load();
  };

  const handleDeleteColor = async (id: string) => {
    if (!confirm('¿Eliminar este color?')) return;
    await fetch(`/api/catalogos/colores/${id}`, { method: 'DELETE' });
    load();
  };

  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragEnd   = () => { setDraggingId(null); setDragOverId(null); };
  const handleDragOver  = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };

  const handleDrop = async (catId: string, dropId: string) => {
    if (!draggingId || draggingId === dropId) { setDraggingId(null); setDragOverId(null); return; }
    const cat = catalogos.find(c => c.id === catId);
    if (!cat) return;

    const sorted   = [...cat.catalogo_colores].sort((a, b) => a.orden - b.orden);
    const dragIdx  = sorted.findIndex(c => c.id === draggingId);
    const dropIdx  = sorted.findIndex(c => c.id === dropId);
    const reordered = [...sorted];
    const [moved]   = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    const updated   = reordered.map((cv, i) => ({ ...cv, orden: i }));

    // Actualizar estado local inmediato
    setCatalogos(prev => prev.map(c => c.id === catId ? { ...c, catalogo_colores: updated } : c));
    setDraggingId(null);
    setDragOverId(null);

    // Persistir todos los órdenes
    await Promise.all(updated.map(cv =>
      fetch(`/api/catalogos/colores/${cv.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: cv.color, nombre_producto: cv.nombre_producto, url_imagen: cv.url_imagen, orden: cv.orden }),
      })
    ));
  };

  // ── Formulario inline ─────────────────────────────────────────────────────────
  const openInline = (catId: string) => {
    setInlineAdd(catId);
    setInlineColor('');
    setInlineNombre('');
    setInlineUrl('');
    setExpanded(prev => ({ ...prev, [catId]: true }));
  };

  const closeInline = () => {
    setInlineAdd(null);
    setInlineColor('');
    setInlineNombre('');
    setInlineUrl('');
  };

  const handleInlineFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInlineUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch('/api/catalogos/upload-imagen', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) setInlineUrl(data.url);
    } finally {
      setInlineUploading(false);
      e.target.value = '';
    }
  };

  const handleInlineSave = async () => {
    if (!inlineAdd || !inlineColor.trim() || !inlineNombre.trim()) return;
    await fetch(`/api/catalogos/${inlineAdd}/colores`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: inlineColor.trim(), nombre_producto: inlineNombre.trim(), url_imagen: inlineUrl || null }),
    });
    // Limpiar para agregar otro
    setInlineColor('');
    setInlineNombre('');
    setInlineUrl('');
    load();
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="panel-scroll flex-1 h-screen overflow-y-auto bg-[#F8F8F8]">

      {/* Header + Buscador fijos arriba */}
      <div className="sticky top-0 z-20">

      {/* Header */}
      <div className="bg-white border-b border-[#E8E8E8] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0D0D0D]">📦 Catálogos del Bot</h1>
          <p className="text-xs text-[#6B6B6B] mt-0.5">
            {catalogos.length} {catalogos.length === 1 ? 'catálogo' : 'catálogos'} ·{' '}
            {catalogos.reduce((s, c) => s + c.catalogo_colores.length, 0)} variaciones de color
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reestamparTodas}
            disabled={marcando}
            title="Estampa el nombre del producto en todas las fotos que aún no lo tienen"
            className="flex items-center gap-2 px-4 py-2.5 border border-[#00A89D]/40 text-[#00847A] text-sm font-semibold rounded-xl hover:bg-[#00A89D]/10 transition-all disabled:opacity-50"
          >
            🏷️ {marcando ? 'Marcando…' : 'Marcar fotos'}
          </button>
          <button
            onClick={() => setModalCat('new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00A89D] text-white text-sm font-semibold rounded-xl hover:bg-[#008F85] transition-all shadow-sm"
          >
            <span className="text-base">+</span> Nuevo Catálogo
          </button>
        </div>
      </div>
      {marcaAviso && (
        <div className="px-6 py-2 bg-[#00A89D]/8 border-b border-[#00A89D]/20 text-xs text-[#00847A] font-medium">
          {marcaAviso}
        </div>
      )}

      {/* Buscador */}
      <div className="px-6 py-3 bg-white border-b border-[#E8E8E8]">
        <input
          className="w-full max-w-sm border border-[#E8E8E8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A89D]/40 bg-[#F8F8F8]"
          placeholder="🔍 Buscar catálogo…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      </div>{/* fin header sticky */}

      {/* Lista */}
      <div className="px-6 py-5 flex flex-col gap-4">

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-4xl mb-3">⏳</div>
              <p className="text-sm text-[#6B6B6B]">Cargando catálogos…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-5xl mb-4">📦</div>
              <h2 className="text-base font-semibold text-[#0D0D0D] mb-2">
                {busqueda ? 'No hay resultados' : 'Aún no hay catálogos'}
              </h2>
              <p className="text-sm text-[#6B6B6B] mb-5">
                {busqueda
                  ? 'Intenta con otro término de búsqueda.'
                  : 'Crea tu primer catálogo para que el bot sepa qué colores ofrecer cuando el cliente pida cambios.'}
              </p>
              {!busqueda && (
                <button
                  onClick={() => setModalCat('new')}
                  className="px-5 py-2.5 bg-[#00A89D] text-white text-sm font-semibold rounded-xl hover:bg-[#008F85] transition-all"
                >
                  + Crear primer catálogo
                </button>
              )}
            </div>
          </div>
        ) : (
          filtered.map(cat => {
            const isOpen = expanded[cat.id] ?? false;
            return (
              <div key={cat.id} className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-sm">

                {/* Header del catálogo */}
                <div
                  className="px-5 py-4 flex items-center gap-3 cursor-pointer hover:bg-[#F8F8F8] transition-colors"
                  onClick={() => setExpanded(prev => ({ ...prev, [cat.id]: !isOpen }))}
                >
                  <div className="text-xl">{isOpen ? '▾' : '▸'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-[#0D0D0D]">{cat.familia}</span>
                      <span className="text-xs bg-[#00A89D]/10 text-[#00A89D] px-2 py-0.5 rounded-full font-medium">
                        {cat.catalogo_colores.length} {cat.catalogo_colores.length === 1 ? 'color' : 'colores'}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B6B6B] mt-0.5">
                      Patrón: <code className="bg-[#F5F5F5] px-1 rounded text-[11px]">{cat.patron}</code>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setModalCat(cat)}
                      className="p-2 text-[#6B6B6B] hover:text-[#0D0D0D] hover:bg-[#F5F5F5] rounded-lg transition-all text-sm"
                      title="Editar catálogo"
                    >✏️</button>
                    <button
                      onClick={() => handleDeleteCat(cat.id)}
                      className="p-2 text-[#6B6B6B] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all text-sm"
                      title="Eliminar catálogo"
                    >🗑️</button>
                  </div>
                </div>

                {/* Lista de colores + formulario inline */}
                {isOpen && (
                  <div className="border-t border-[#E8E8E8] px-5 py-4 flex flex-col gap-2">

                    {/* Colores existentes — drag & drop para reordenar */}
                    {[...cat.catalogo_colores].sort((a, b) => a.orden - b.orden).map((cv) => (
                      <div
                        key={cv.id}
                        draggable
                        onDragStart={() => handleDragStart(cv.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, cv.id)}
                        onDrop={() => handleDrop(cat.id, cv.id)}
                        className={`flex items-center gap-3 p-2 rounded-xl transition-all group
                          ${draggingId === cv.id ? 'opacity-30' : ''}
                          ${dragOverId === cv.id && draggingId !== cv.id
                            ? 'bg-[#00A89D]/10 border-2 border-dashed border-[#00A89D]'
                            : 'hover:bg-[#F8F8F8] border-2 border-transparent'}
                        `}
                      >
                        {/* Handle de arrastre */}
                        <div
                          className="cursor-grab active:cursor-grabbing shrink-0 flex flex-col gap-[3px] px-1 py-2 opacity-30 group-hover:opacity-80 transition-opacity"
                          title="Arrastra para reordenar"
                        >
                          <span className="block w-4 h-[2px] bg-[#6B6B6B] rounded-full" />
                          <span className="block w-4 h-[2px] bg-[#6B6B6B] rounded-full" />
                          <span className="block w-4 h-[2px] bg-[#6B6B6B] rounded-full" />
                        </div>

                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#F5F5F5] border border-[#E8E8E8] shrink-0">
                          {cv.url_imagen ? (
                            <img src={cv.url_imagen} alt={cv.color} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl text-[#CCC]">📦</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#0D0D0D]">{cv.color}</p>
                          <p className="text-xs text-[#6B6B6B] truncate">{cv.nombre_producto}</p>
                        </div>

                        {/* Editar / Eliminar (hover) */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setModalColor({ catalogoId: cat.id, item: cv })}
                            className="p-1.5 hover:bg-white rounded-lg text-sm border border-transparent hover:border-[#E8E8E8]"
                            title="Editar"
                          >✏️</button>
                          <button
                            onClick={() => handleDeleteColor(cv.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-sm border border-transparent hover:border-red-100"
                            title="Eliminar"
                          >🗑️</button>
                        </div>
                      </div>
                    ))}

                    {/* Formulario inline */}
                    {inlineAdd === cat.id ? (
                      <div className="mt-1 p-3 bg-[#F8FFFE] rounded-xl border border-[#00A89D]/20 flex items-start gap-3">
                        <input ref={inlineFileRef} type="file" accept="image/*" className="hidden" onChange={handleInlineFile} />

                        {/* Foto */}
                        <div
                          onClick={() => inlineFileRef.current?.click()}
                          className="w-20 h-20 rounded-xl border-2 border-dashed border-[#00A89D]/40 hover:border-[#00A89D] bg-white flex flex-col items-center justify-center cursor-pointer shrink-0 overflow-hidden transition-colors"
                        >
                          {inlineUrl ? (
                            <img src={inlineUrl} className="w-full h-full object-cover" alt="preview" />
                          ) : inlineUploading ? (
                            <span className="text-xl">⏳</span>
                          ) : (
                            <>
                              <span className="text-xl">📷</span>
                              <span className="text-[10px] text-[#00A89D] font-semibold mt-0.5">Subir foto</span>
                            </>
                          )}
                        </div>

                        {/* Inputs */}
                        <div className="flex-1 flex flex-col gap-2">
                          <input
                            autoFocus
                            placeholder="Nombre del color (ej: Negro)"
                            value={inlineColor}
                            onChange={e => setInlineColor(e.target.value)}
                            className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A89D]/40 bg-white"
                          />
                          <input
                            placeholder="Nombre del producto en Funnelish (ej: NEGRO NEW YORK)"
                            value={inlineNombre}
                            onChange={e => setInlineNombre(e.target.value.toUpperCase())}
                            className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A89D]/40 bg-white"
                          />
                        </div>

                        {/* Botones */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={handleInlineSave}
                            disabled={!inlineColor.trim() || !inlineNombre.trim() || inlineUploading}
                            className="px-4 py-2 bg-[#00A89D] text-white text-xs font-semibold rounded-xl hover:bg-[#008F85] disabled:opacity-40 transition-all"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={closeInline}
                            className="px-4 py-2 text-xs text-[#6B6B6B] rounded-xl border border-[#E8E8E8] hover:bg-[#F5F5F5] transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Botón agregar color */
                      <button
                        onClick={() => openInline(cat.id)}
                        className="mt-1 flex items-center gap-2 px-4 py-3 border-2 border-dashed border-[#E8E8E8] rounded-xl text-[#6B6B6B] hover:border-[#00A89D] hover:text-[#00A89D] hover:bg-[#00A89D]/5 transition-all w-full text-sm font-medium"
                      >
                        <span className="text-lg font-light">+</span> Agregar variación de color
                      </button>
                    )}

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Modales ── */}
      {modalCat && (
        <ModalCatalogo
          initial={typeof modalCat === 'object' && 'id' in modalCat ? modalCat : undefined}
          onSave={handleSaveCat}
          onClose={() => setModalCat(null)}
        />
      )}

      {modalColor && (
        <ModalColor
          catalogoId={modalColor.catalogoId}
          initial={modalColor.item}
          onSave={handleSaveColor}
          onClose={() => setModalColor(null)}
        />
      )}

      {/* Input de archivo para inline */}
      {/* (el ref inlineFileRef se renderiza dentro del mapa, aquí solo se declara) */}
    </div>
  );
}

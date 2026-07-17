'use client';

import { useState, useEffect, useRef } from 'react';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface ColorVariant {
  id: string;
  catalogo_id: string;
  color: string;
  nombre_producto: string;
  url_imagen: string | null;
}

interface Catalogo {
  id: string;
  familia: string;
  patron: string;
  catalogo_colores: ColorVariant[];
}

// ── Modal de catálogo ──────────────────────────────────────────────────────────
function ModalCatalogo({
  initial,
  onSave,
  onClose,
}: {
  initial?: Catalogo;
  onSave: (familia: string, patron: string) => void;
  onClose: () => void;
}) {
  const [familia, setFamilia] = useState(initial?.familia ?? '');
  const [patron,  setPatron]  = useState(initial?.patron  ?? '');

  // Auto-fill patron cuando cambia familia (solo si aún no fue editado)
  const patronEdited = useRef(!!initial?.patron);

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
        </div>
        <div className="px-6 py-4 border-t border-[#E8E8E8] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#6B6B6B] hover:text-[#0D0D0D] rounded-xl border border-[#E8E8E8] hover:bg-[#F5F5F5] transition-all">
            Cancelar
          </button>
          <button
            onClick={() => familia.trim() && patron.trim() && onSave(familia.trim().toUpperCase(), patron.trim().toUpperCase())}
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

  // Modales
  const [modalCat,   setModalCat]   = useState<null | 'new' | Catalogo>(null);
  const [modalColor, setModalColor] = useState<null | { catalogoId: string; item?: ColorVariant }>(null);

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
  const handleSaveCat = async (familia: string, patron: string) => {
    if (modalCat && typeof modalCat === 'object' && 'id' in modalCat) {
      // Editar
      await fetch(`/api/catalogos/${modalCat.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familia, patron }),
      });
    } else {
      // Crear
      const res = await fetch('/api/catalogos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familia, patron }),
      });
      if (res.ok) {
        const nuevo: Catalogo = await res.json();
        setExpanded(prev => ({ ...prev, [nuevo.id]: true }));
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

  // ── Handlers de color ────────────────────────────────────────────────────────
  const handleSaveColor = async (color: string, nombreProducto: string, urlImagen: string | null) => {
    if (!modalColor) return;
    if (modalColor.item) {
      // Editar
      await fetch(`/api/catalogos/colores/${modalColor.item.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color, nombre_producto: nombreProducto, url_imagen: urlImagen }),
      });
    } else {
      // Crear
      await fetch(`/api/catalogos/${modalColor.catalogoId}/colores`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color, nombre_producto: nombreProducto, url_imagen: urlImagen }),
      });
    }
    setModalColor(null);
    load();
  };

  const handleDeleteColor = async (id: string) => {
    if (!confirm('¿Eliminar este color?')) return;
    await fetch(`/api/catalogos/colores/${id}`, { method: 'DELETE' });
    load();
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col bg-[#F8F8F8] overflow-auto">

      {/* Header */}
      <div className="bg-white border-b border-[#E8E8E8] px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[#0D0D0D]">📦 Catálogos del Bot</h1>
          <p className="text-xs text-[#6B6B6B] mt-0.5">
            {catalogos.length} {catalogos.length === 1 ? 'catálogo' : 'catálogos'} ·{' '}
            {catalogos.reduce((s, c) => s + c.catalogo_colores.length, 0)} variaciones de color
          </p>
        </div>
        <button
          onClick={() => setModalCat('new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#00A89D] text-white text-sm font-semibold rounded-xl hover:bg-[#008F85] transition-all shadow-sm"
        >
          <span className="text-base">+</span> Nuevo Catálogo
        </button>
      </div>

      {/* Buscador */}
      <div className="px-6 py-3 bg-white border-b border-[#E8E8E8] shrink-0">
        <input
          className="w-full max-w-sm border border-[#E8E8E8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A89D]/40 bg-[#F8F8F8]"
          placeholder="🔍 Buscar catálogo…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto px-6 py-5 flex flex-col gap-4">

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

                {/* Grid de colores */}
                {isOpen && (
                  <div className="border-t border-[#E8E8E8] px-5 py-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">

                      {cat.catalogo_colores.map(color => (
                        <div
                          key={color.id}
                          className="border border-[#E8E8E8] rounded-xl overflow-hidden bg-[#F8F8F8] group hover:border-[#00A89D]/40 hover:shadow-sm transition-all"
                        >
                          {/* Foto */}
                          <div className="aspect-square overflow-hidden bg-white relative">
                            {color.url_imagen ? (
                              <img
                                src={color.url_imagen}
                                alt={color.color}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl text-[#CCCCCC]">📦</div>
                            )}
                            {/* Acciones hover */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                              <button
                                onClick={() => setModalColor({ catalogoId: cat.id, item: color })}
                                className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm shadow-md hover:scale-110 transition-transform"
                                title="Editar"
                              >✏️</button>
                              <button
                                onClick={() => handleDeleteColor(color.id)}
                                className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm shadow-md hover:scale-110 transition-transform"
                                title="Eliminar"
                              >🗑️</button>
                            </div>
                          </div>
                          {/* Info */}
                          <div className="px-2 py-2">
                            <p className="text-xs font-semibold text-[#0D0D0D] truncate">{color.color}</p>
                            <p className="text-[10px] text-[#6B6B6B] truncate mt-0.5" title={color.nombre_producto}>
                              {color.nombre_producto}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Botón agregar color */}
                      <button
                        onClick={() => { setExpanded(prev => ({ ...prev, [cat.id]: true })); setModalColor({ catalogoId: cat.id }); }}
                        className="border-2 border-dashed border-[#E8E8E8] rounded-xl aspect-square flex flex-col items-center justify-center gap-2 text-[#6B6B6B] hover:border-[#00A89D] hover:text-[#00A89D] hover:bg-[#00A89D]/5 transition-all"
                      >
                        <span className="text-2xl font-light">+</span>
                        <span className="text-[11px] font-medium text-center px-2">Agregar color</span>
                      </button>

                    </div>
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
    </div>
  );
}

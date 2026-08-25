'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface Plantilla {
  id: string;
  nombre: string;
  tipo: 'texto' | 'imagen' | 'texto_imagen';
  contenido: string;
  imagen_url: string;
  created_at: string;
}

const TIPO_LABELS: Record<string, string> = {
  texto:        '💬 Solo texto',
  imagen:       '🖼 Solo imagen',
  texto_imagen: '📎 Texto + imagen',
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function emptyPlantilla(): Plantilla {
  return { id: '', nombre: '', tipo: 'texto', contenido: '', imagen_url: '', created_at: '' };
}

export default function PlantillasPanel() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [view, setView]             = useState<'list' | 'edit'>('list');
  const [current, setCurrent]       = useState<Plantilla>(emptyPlantilla());
  const [isNew, setIsNew]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [imgError, setImgError]     = useState(false);
  const [vistaChat, setVistaChat]   = useState(true);

  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserSupabaseClient();

  async function load() {
    const res = await fetch('/api/plantillas');
    const data = await res.json();
    setPlantillas(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = plantillas.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  function openNew() {
    setCurrent(emptyPlantilla());
    setIsNew(true);
    setImgError(false);
    setView('edit');
  }

  function openEdit(p: Plantilla) {
    setCurrent({ ...p });
    setIsNew(false);
    setImgError(false);
    setView('edit');
  }

  function backToList() {
    setView('list');
    setCurrent(emptyPlantilla());
  }

  function update(field: keyof Plantilla, val: string) {
    setCurrent(prev => ({ ...prev, [field]: val }));
    if (field === 'imagen_url') setImgError(false);
  }

  // ── Upload image to Supabase Storage ──────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imágenes (JPG, PNG, WEBP, GIF).');
      return;
    }
    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar 5MB.');
      return;
    }

    setUploading(true);
    setImgError(false);

    const ext      = file.name.split('.').pop();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from('plantillas-images')
      .upload(filename, file, { upsert: false, contentType: file.type });

    if (error) {
      alert('Error al subir imagen: ' + error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('plantillas-images')
      .getPublicUrl(data.path);

    setCurrent(prev => ({ ...prev, imagen_url: urlData.publicUrl }));
    setUploading(false);

    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = '';
  }

  async function removeImage() {
    setCurrent(prev => ({ ...prev, imagen_url: '' }));
    setImgError(false);
  }

  async function save() {
    if (saving) return;
    if (!current.nombre.trim()) { alert('El nombre es requerido.'); return; }
    if (current.tipo !== 'imagen' && !current.contenido.trim()) { alert('El texto es requerido.'); return; }
    if (current.tipo !== 'texto' && !current.imagen_url.trim()) { alert('La imagen es requerida.'); return; }

    setSaving(true);
    const payload = {
      nombre:     current.nombre.trim(),
      tipo:       current.tipo,
      contenido:  current.contenido.trim(),
      imagen_url: current.imagen_url.trim(),
    };

    let res: Response;
    if (isNew) {
      res = await fetch('/api/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(`/api/plantillas/${current.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      alert('Error al guardar: ' + (err.error ?? res.statusText));
      return;
    }
    await load();
    backToList();
  }

  async function deleteP() {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    await fetch(`/api/plantillas/${current.id}`, { method: 'DELETE' });
    await load();
    backToList();
  }

  const showImg  = current.tipo === 'imagen' || current.tipo === 'texto_imagen';
  const showText = current.tipo === 'texto'  || current.tipo === 'texto_imagen';

  // ─────────────────────── LIST VIEW ───────────────────────
  if (view === 'list') {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-[#FAF9F6] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8] bg-white shrink-0">
          <div>
            <h1 className="text-[#0D0D0D] font-bold text-lg">Plantilla general</h1>
            <p className="text-xs text-[#9A9A9A] mt-0.5">Respuestas rápidas para contestar dentro de las 24 h (sin aprobación de Meta)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] text-xs pointer-events-none">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="bg-white border border-[#E8E8E8] rounded-lg pl-8 pr-3 py-2 text-xs text-[#0D0D0D] placeholder:text-[#B5B5B5] focus:outline-none focus:border-[#00A89D] w-48"
              />
            </div>
            <button
              onClick={openNew}
              className="w-8 h-8 rounded-lg bg-[#00A89D] text-white font-bold text-lg flex items-center justify-center hover:bg-[#00847A] active:scale-95 transition-all"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-[#9A9A9A] text-sm">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[#9A9A9A] gap-2">
              <span className="text-2xl">📋</span>
              <span className="text-xs">{plantillas.length === 0 ? 'Sin plantillas — crea la primera con +' : 'Sin resultados'}</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#F5F5F5] border-b border-[#E8E8E8]">
                <tr>
                  <th className="w-10 px-4 py-3" />
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-36">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-20">Mensajes</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-44">Creado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-[#F0F0F0] hover:bg-[#F5F5F5] cursor-pointer" onClick={() => openEdit(p)}>
                    <td className="px-4 py-3">
                      {p.imagen_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imagen_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        <span className="text-[#9A9A9A]">✏️</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#0D0D0D] font-medium">{p.nombre}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#6B6B6B]">{TIPO_LABELS[p.tipo] ?? p.tipo}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-[#6B6B6B] text-xs"><span>💬</span><span>1</span></span>
                    </td>
                    <td className="px-4 py-3 text-[#9A9A9A] text-xs">{formatFecha(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────── EDIT VIEW ───────────────────────
  return (
    <div className="flex-1 flex min-w-0 overflow-hidden bg-[#FAF9F6]">

      {/* ── Left: form ── */}
      <div className="flex-1 flex flex-col border-r border-[#E8E8E8] min-w-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8E8E8] bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={backToList} className="text-[#6B6B6B] hover:text-[#0D0D0D] transition-colors text-sm">
              ← Volver
            </button>
            <h2 className="text-[#0D0D0D] font-semibold text-sm">
              {isNew ? 'Nueva plantilla' : 'Editar plantilla'}
            </h2>
          </div>
          <div className="flex gap-2">
            {!isNew && (
              <button onClick={deleteP} className="px-3 py-1.5 rounded-lg text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-all">
                Eliminar
              </button>
            )}
            <button
              onClick={save}
              disabled={saving || uploading}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#00A89D] text-white hover:bg-[#00847A] disabled:opacity-50 transition-all"
            >
              {saving ? 'Guardando…' : '💾 Guardar'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

          {/* Información */}
          <section>
            <h3 className="text-xs text-[#9A9A9A] font-semibold uppercase tracking-wider mb-3">Información</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-[#6B6B6B] mb-1 block">Nombre</label>
                <input
                  value={current.nombre}
                  onChange={e => update('nombre', e.target.value)}
                  placeholder="Identificador de plantilla"
                  className="w-full bg-white border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-sm text-[#0D0D0D] placeholder:text-[#B5B5B5] focus:outline-none focus:border-[#00A89D]"
                />
              </div>
              <div>
                <label className="text-xs text-[#6B6B6B] mb-1 block">Tipo de mensaje</label>
                <div className="flex gap-2">
                  {(['texto', 'imagen', 'texto_imagen'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => update('tipo', t)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                        current.tipo === t
                          ? 'bg-[#00A89D]/10 text-[#00A89D] border-[#00A89D]/30'
                          : 'bg-white text-[#6B6B6B] border-[#E8E8E8] hover:border-[#D5D5D5]'
                      }`}
                    >
                      {TIPO_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Imagen */}
          {showImg && (
            <section>
              <h3 className="text-xs text-[#9A9A9A] font-semibold uppercase tracking-wider mb-3">Imagen</h3>

              {/* Hidden file input */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />

              {!current.imagen_url ? (
                /* Upload zone */
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-[#E8E8E8] rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-[#00A89D]/40 hover:bg-[#00A89D]/[0.03] transition-all"
                >
                  {uploading ? (
                    <>
                      <div className="w-8 h-8 border-2 border-[#00A89D]/30 border-t-[#00A89D] rounded-full animate-spin" />
                      <span className="text-xs text-[#6B6B6B]">Subiendo imagen…</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl">📁</span>
                      <div className="text-center">
                        <p className="text-sm text-[#0D0D0D] font-medium">Seleccionar desde archivos</p>
                        <p className="text-xs text-[#9A9A9A] mt-1">JPG, PNG, WEBP, GIF · Máx 5MB</p>
                      </div>
                      <button
                        type="button"
                        className="px-4 py-1.5 rounded-lg bg-[#00A89D]/10 text-[#00A89D] border border-[#00A89D]/25 text-xs font-medium hover:bg-[#00A89D]/20 transition-all"
                      >
                        Explorar archivos
                      </button>
                    </>
                  )}
                </div>
              ) : (
                /* Image preview */
                <div className="relative rounded-xl overflow-hidden border border-[#E8E8E8] bg-[#FAFAFA] group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.imagen_url}
                    alt="preview"
                    className="w-full max-h-52 object-cover"
                    onError={() => setImgError(true)}
                  />
                  {/* Overlay actions */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm text-white text-xs font-medium border border-white/20 hover:bg-white/20 transition-all"
                    >
                      📁 Cambiar
                    </button>
                    <button
                      onClick={removeImage}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 backdrop-blur-sm text-red-400 text-xs font-medium border border-red-500/30 hover:bg-red-500/30 transition-all"
                    >
                      🗑 Quitar
                    </button>
                  </div>
                  {/* Size badge */}
                  <div className="absolute bottom-2 left-2 bg-black/60 rounded-full px-2 py-0.5 text-[10px] text-white">
                    ✓ Imagen cargada
                  </div>
                </div>
              )}

              {imgError && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  ⚠ No se pudo cargar la imagen.
                </div>
              )}
            </section>
          )}

          {/* Texto */}
          {showText && (
            <section>
              <h3 className="text-xs text-[#9A9A9A] font-semibold uppercase tracking-wider mb-3">Mensaje</h3>
              <textarea
                value={current.contenido}
                onChange={e => update('contenido', e.target.value)}
                placeholder={"Hola! Bienvenido a KLIXMANT 🖤\n\nEscribe aquí tu mensaje..."}
                rows={6}
                className="w-full bg-white border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-sm text-[#0D0D0D] placeholder:text-[#B5B5B5] focus:outline-none focus:border-[#00A89D] resize-none leading-relaxed"
              />
              <div className="text-[10px] text-[#9A9A9A] text-right mt-1">
                {current.contenido.length} caracteres
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ── Right: WhatsApp preview ── */}
      <div className="w-[380px] shrink-0 flex flex-col bg-[#F5F5F5]">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#E8E8E8] shrink-0">
          <h2 className="text-[#0D0D0D] text-sm font-semibold">Mensajes</h2>
          <button
            onClick={() => setVistaChat(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-all ${
              vistaChat
                ? 'bg-[#00A89D]/10 text-[#00A89D] border-[#00A89D]/25'
                : 'text-[#6B6B6B] border-[#E8E8E8]'
            }`}
          >
            <span className={`w-6 h-3 rounded-full transition-all relative ${vistaChat ? 'bg-[#00A89D]' : 'bg-[#D5D5D5]'}`}>
              <span className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${vistaChat ? 'left-3.5' : 'left-0.5'}`} />
            </span>
            Vista chat
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto p-4 flex flex-col justify-end gap-2"
          style={{
            backgroundImage: vistaChat
              ? 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)'
              : 'none',
            backgroundSize: '20px 20px',
          }}
        >
          {(current.contenido || current.imagen_url) ? (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-white border border-[#E8E8E8] rounded-2xl rounded-bl-sm overflow-hidden shadow-lg">
                {showImg && current.imagen_url && !imgError && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.imagen_url}
                    alt="plantilla"
                    className="w-full max-h-48 object-cover"
                    onError={() => setImgError(true)}
                  />
                )}
                {showImg && (!current.imagen_url || imgError) && (
                  <div className="w-full h-32 bg-[#F0F0F0] flex items-center justify-center">
                    <span className="text-[#9A9A9A] text-xs">🖼 Imagen aquí</span>
                  </div>
                )}
                {showText && (
                  <div className="px-3 py-2.5">
                    <p className="text-[#0D0D0D] text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {current.contenido || <span className="text-[#9A9A9A] italic">Escribe el mensaje…</span>}
                    </p>
                    <div className="text-[10px] text-[#9A9A9A] text-right mt-1.5">
                      {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} ✓✓
                    </div>
                  </div>
                )}
                {!showText && current.imagen_url && !imgError && (
                  <div className="px-3 py-1.5 text-right">
                    <span className="text-[10px] text-[#9A9A9A]">
                      {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} ✓✓
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#9A9A9A] gap-2">
              <span className="text-3xl">👁</span>
              <span className="text-xs text-center">La previsualización aparece<br/>aquí mientras escribes</span>
            </div>
          )}
        </div>

        <div className="px-3 py-3 border-t border-[#E8E8E8] flex items-center gap-2 shrink-0 opacity-40 pointer-events-none">
          <span className="text-[#9A9A9A] text-lg">😊</span>
          <div className="flex-1 bg-white border border-[#E8E8E8] rounded-full px-4 py-2 text-xs text-[#9A9A9A]">
            Mensaje…
          </div>
          <span className="text-[#9A9A9A] text-lg">📎</span>
          <div className="w-8 h-8 rounded-full bg-[#00A89D]/30 flex items-center justify-center">
            <span className="text-[10px]">➤</span>
          </div>
        </div>
      </div>
    </div>
  );
}

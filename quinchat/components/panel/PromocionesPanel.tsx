'use client';

import { useEffect, useRef, useState } from 'react';
import { comprimirImagen } from '@/lib/imagen-comprimir';

interface Promo {
  id?: string;
  nombre: string;
  referencia?: string | null;
  categoria?: string | null;
  destacado?: boolean;
  anclado?: boolean;
  descripcion?: string | null;
  foto?: string | null;
  precio: number;
  precio_antes?: number | null;
  precio_dos?: number | null;
  precio_tres?: number | null;
  tallas: string[];
  stock?: Record<string, number>;
  colores?: string[];
  variantes?: Record<string, Record<string, number>>;
  fotos?: Record<string, string>;
  activo: boolean;
  orden: number;
}

const vacia = (): Promo => ({ nombre: '', referencia: '', categoria: '', destacado: false, descripcion: '', foto: null, precio: 0, precio_antes: null, precio_dos: null, precio_tres: null, tallas: [], stock: {}, colores: [], variantes: {}, fotos: {}, activo: true, orden: 0 });
const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

// Tallas estándar (igual que en Funnelish): un clic las agrega todas.
const TALLAS_ESTANDAR = [
  'CABALLERO - S', 'CABALLERO - M', 'CABALLERO - L', 'CABALLERO - XL', 'CABALLERO - XXL', 'CABALLERO - XXXL',
  'DAMA - S', 'DAMA - M', 'DAMA - L', 'DAMA - XL',
];

/** Administra los productos de la página pública de Promociones (/promos). */
export default function PromocionesPanel() {
  const [lista, setLista] = useState<Promo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [edit, setEdit] = useState<Promo | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [subColor, setSubColor] = useState<string | null>(null);
  const [tallaTmp, setTallaTmp] = useState('');
  const [colorTmp, setColorTmp] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const LINK = 'https://pedido.klixmant.shop/promos';

  function cargar() {
    setCargando(true);
    fetch('/api/promociones?admin=1')
      .then(r => r.json())
      .then(d => setLista(d.promociones ?? []))
      .catch(() => setAviso('No se pudieron cargar las promociones.'))
      .finally(() => setCargando(false));
  }
  useEffect(() => { cargar(); }, []);

  async function subirFoto(file: File) {
    setSubiendo(true); setAviso(null);
    try {
      const liviana = await comprimirImagen(file);
      const fd = new FormData(); fd.append('file', liviana); fd.append('slug', 'promociones');
      const res = await fetch('/api/funnels/imagen', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) { setAviso(d.error || 'No se pudo subir la foto.'); return; }
      setEdit(e => e ? { ...e, foto: d.url } : e);
      if (d.aviso) setAviso(d.aviso);   // LEY DE PESO nivel 4: la foto se subió; aviso visible, no bloqueante
    } catch { setAviso('No se pudo subir la foto.'); }
    finally { setSubiendo(false); }
  }

  // Sube la foto de un color específico → edit.fotos[color].
  async function subirFotoColor(color: string, file: File) {
    setSubColor(color); setAviso(null);
    try {
      const liviana = await comprimirImagen(file);
      const fd = new FormData(); fd.append('file', liviana); fd.append('slug', 'promociones');
      const res = await fetch('/api/funnels/imagen', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) { setAviso(d.error || 'No se pudo subir la foto.'); return; }
      setEdit(e => e ? { ...e, fotos: { ...(e.fotos || {}), [color]: d.url } } : e);
      if (d.aviso) setAviso(d.aviso);   // LEY DE PESO nivel 4: la foto se subió; aviso visible, no bloqueante
    } catch { setAviso('No se pudo subir la foto.'); }
    finally { setSubColor(null); }
  }

  async function guardar() {
    if (!edit) return;
    if (!edit.nombre.trim()) { setAviso('Ponle un nombre al producto.'); return; }
    setGuardando(true); setAviso(null);
    try {
      const res = await fetch('/api/promociones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edit),
      });
      const d = await res.json();
      if (!res.ok) { setAviso(d.error || 'No se pudo guardar.'); return; }
      setEdit(null); cargar();
    } catch { setAviso('Error de conexión.'); }
    finally { setGuardando(false); }
  }

  async function borrar(id?: string) {
    if (!id || !window.confirm('¿Borrar esta promoción?')) return;
    await fetch(`/api/promociones?id=${id}`, { method: 'DELETE' });
    cargar();
  }

  async function duplicar(p: Promo) {
    const copia = { ...p, id: undefined, nombre: `${p.nombre} (copia)`, orden: (p.orden || 0) + 1 };
    await fetch('/api/promociones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(copia),
    });
    cargar();
  }

  async function toggleActivo(p: Promo) {
    await fetch('/api/promociones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, activo: !p.activo }),
    });
    cargar();
  }

  async function toggleAnclado(p: Promo) {
    await fetch('/api/promociones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, anclado: !p.anclado }),
    });
    cargar();
  }

  const input = 'w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm';

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto bg-[#FAF9F6]">
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-6 max-w-7xl mx-auto pb-24">
        <header className="mb-4 pl-10 md:pl-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">🔥 Promociones</h1>
          <p className="text-xs text-[#6B6B6B] mt-1">Arma una página instantánea con tus productos y compártela por WhatsApp. El cliente entra, elige talla y compra (o se va directo a tu WhatsApp).</p>
        </header>

        {/* Link para compartir */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-4 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-[12px] font-bold text-[#0D0D0D]">🔗 Link para compartir:</span>
          <a href={LINK} target="_blank" rel="noreferrer" className="text-[13px] text-[#00847A] font-semibold underline break-all">{LINK}</a>
          <button
            onClick={() => { navigator.clipboard?.writeText(LINK); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }}
            className="ml-auto px-3 py-1.5 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A]"
          >{copiado ? '✓ Copiado' : '📋 Copiar link'}</button>
        </div>

        <button
          onClick={() => { setEdit(vacia()); setAviso(null); }}
          className="mb-4 px-4 py-2.5 rounded-xl bg-[#0D0D0D] text-white text-sm font-semibold hover:opacity-90"
        >➕ Agregar producto</button>

        {aviso && <p className="text-sm font-semibold text-[#DC2626] mb-3">⚠️ {aviso}</p>}

        {/* Lista */}
        {cargando ? (
          <p className="text-sm text-[#9A9A9A]">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-[#6B6B6B]">Aún no hay productos. Agrega el primero con el botón de arriba.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
            {lista.map(p => (
              <div key={p.id} className={`bg-white rounded-2xl border p-3 flex gap-3 ${p.activo ? 'border-[#E8E8E8]' : 'border-[#E8E8E8] opacity-60'}`}>
                {p.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.foto} alt="" className="w-16 h-16 rounded-lg object-cover bg-[#F5F5F5] shrink-0" />
                ) : <div className="w-16 h-16 rounded-lg bg-[#F5F5F5] flex items-center justify-center shrink-0">🛍️</div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.nombre}</p>
                  <p className="text-[12px] text-[#00847A] font-bold">{pesos(p.precio)}{p.precio_antes ? <span className="text-[#9A9A9A] font-normal line-through ml-1">{pesos(p.precio_antes)}</span> : null}</p>
                  <p className="text-[11px] text-[#6B6B6B] truncate mt-0.5">Tallas: {p.tallas.length ? p.tallas.join(', ') : '—'}</p>
                  {(() => {
                    const cols = p.colores || [];
                    const fts = p.fotos || {};
                    const conFoto = cols.filter(c => fts[c]).length;
                    if (cols.length === 0) return null;
                    // Un solo color = la portada ya es ese color → siempre completo.
                    const completo = cols.length <= 1 || conFoto === cols.length;
                    return completo ? (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#166534]">✓ Fotos completas</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">⚠ Faltan fotos ({conFoto}/{cols.length})</span>
                    );
                  })()}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <button onClick={() => { setEdit({ ...p }); setAviso(null); }} className="text-[11px] px-2 py-1 rounded-lg border border-[#E8E8E8] hover:bg-[#F5F5F5]">✏️ Editar</button>
                    <button onClick={() => toggleAnclado(p)} title="Fijar este producto de primero en la página" className={`text-[11px] px-2 py-1 rounded-lg border ${p.anclado ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A] font-bold' : 'border-[#E8E8E8] hover:bg-[#F5F5F5]'}`}>{p.anclado ? '📌 Anclado' : '📌 Anclar'}</button>
                    <button onClick={() => duplicar(p)} title="Crear una copia con todos los datos" className="text-[11px] px-2 py-1 rounded-lg border border-[#E8E8E8] hover:bg-[#F5F5F5]">⧉ Duplicar</button>
                    <button onClick={() => toggleActivo(p)} className="text-[11px] px-2 py-1 rounded-lg border border-[#E8E8E8] hover:bg-[#F5F5F5]">{p.activo ? '🟢 Activo' : '⚪ Oculto'}</button>
                    <button onClick={() => borrar(p.id)} className="text-[11px] px-2 py-1 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] ml-auto">🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold">{edit.id ? 'Editar producto' : 'Nuevo producto'}</h3>

            <div>
              <label className="block text-[11px] font-bold mb-1 uppercase">Nombre del producto</label>
              <input value={edit.nombre} onChange={e => setEdit({ ...edit, nombre: e.target.value })} className={input} placeholder="Ej: Chaqueta Nacional Verde" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold mb-1 uppercase">Referencia</label>
                <input value={edit.referencia ?? ''} onChange={e => setEdit({ ...edit, referencia: e.target.value })} className={input} placeholder="Ej: G17" />
              </div>
              <label className="flex items-center gap-2 mt-5 cursor-pointer">
                <input type="checkbox" checked={!!edit.destacado} onChange={e => setEdit({ ...edit, destacado: e.target.checked })} className="w-4 h-4 accent-[#00A89D]" />
                <span className="text-[12px] font-semibold text-[#0D0D0D]">⭐ Más vendido</span>
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1 uppercase">Foto</label>
              <div className="flex gap-2 items-center">
                {edit.foto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={edit.foto} alt="" className="w-14 h-14 rounded-lg object-cover border border-[#E8E8E8]" />
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ''; }} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={subiendo} className="px-3 py-2 rounded-lg bg-[#0D0D0D] text-white text-sm font-bold disabled:opacity-50">
                  {subiendo ? 'Subiendo…' : (edit.foto ? '📎 Cambiar' : '📎 Subir foto')}
                </button>
              </div>
            </div>

            {/* Fotos por color */}
            <div className="rounded-xl bg-[#F8FAFA] border border-[#E8E8E8] p-2.5">
              <p className="text-[11px] font-bold uppercase mb-1">🎨 Colores y su foto</p>
              <p className="text-[10px] text-[#9A9A9A] mb-2">Sube una foto por color. En la página pública, al elegir un color se muestra su foto en grande y arriba salen las miniaturas de todos los colores.</p>
              <div className="space-y-1.5">
                {(edit.colores || []).map(c => (
                  <div key={c} className="flex items-center gap-2 border border-[#EEE] rounded-lg px-2 py-1.5 bg-white">
                    {edit.fotos?.[c] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={edit.fotos[c]} alt="" className="w-10 h-10 rounded object-cover border border-[#E8E8E8]" />
                    ) : <div className="w-10 h-10 rounded bg-[#F0F0F0] flex items-center justify-center text-[9px] text-[#9A9A9A] text-center">sin<br />foto</div>}
                    <span className="text-[12px] font-semibold flex-1 truncate">{c}</span>
                    <label className="text-[11px] px-2 py-1 rounded-lg bg-[#0D0D0D] text-white font-bold cursor-pointer whitespace-nowrap">
                      {subColor === c ? 'Subiendo…' : (edit.fotos?.[c] ? '📎 Cambiar' : '📎 Subir')}
                      <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirFotoColor(c, f); e.target.value = ''; }} />
                    </label>
                    <button type="button" onClick={() => { const cols = (edit.colores || []).filter(x => x !== c); const fs = { ...(edit.fotos || {}) }; delete fs[c]; setEdit({ ...edit, colores: cols, fotos: fs }); }} className="text-[#DC2626] font-bold text-sm">✕</button>
                  </div>
                ))}
                {(edit.colores || []).length === 0 && <p className="text-[11px] text-[#9A9A9A]">Aún no hay colores. Agrega uno abajo.</p>}
              </div>
              <div className="flex gap-2 mt-2">
                <input value={colorTmp} onChange={e => setColorTmp(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = colorTmp.trim(); if (v && !(edit.colores || []).includes(v)) setEdit({ ...edit, colores: [...(edit.colores || []), v] }); setColorTmp(''); } }}
                  className={input} placeholder="Agregar color (Ej: Negro, Rojo…)" />
                <button type="button" onClick={() => { const v = colorTmp.trim(); if (v && !(edit.colores || []).includes(v)) setEdit({ ...edit, colores: [...(edit.colores || []), v] }); setColorTmp(''); }} className="px-3 rounded-lg bg-[#00A89D] text-white font-bold">+</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold mb-1 uppercase">Precio</label>
                <input type="number" value={edit.precio || ''} onChange={e => setEdit({ ...edit, precio: Number(e.target.value) })} className={input} placeholder="129900" />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1 uppercase">Precio tachado</label>
                <input type="number" value={edit.precio_antes ?? ''} onChange={e => setEdit({ ...edit, precio_antes: e.target.value ? Number(e.target.value) : null })} className={input} placeholder="195000" />
              </div>
            </div>

            <div className="rounded-xl bg-[#F8FAFA] border border-[#E8E8E8] p-2.5">
              <p className="text-[11px] font-bold uppercase mb-1">💰 Precios por cantidad (descuentos)</p>
              <p className="text-[10px] text-[#9A9A9A] mb-2">Opcional. Si pones el precio por 2 o por 3, el cliente podrá elegir esa cantidad y verá ese precio. Déjalos vacíos si solo vendes de a 1.</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold mb-1 uppercase text-[#6B6B6B]">Precio por 2</label>
                  <input type="number" value={edit.precio_dos ?? ''} onChange={e => setEdit({ ...edit, precio_dos: e.target.value ? Number(e.target.value) : null })} className={input} placeholder="Ej: 200000" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1 uppercase text-[#6B6B6B]">Precio por 3</label>
                  <input type="number" value={edit.precio_tres ?? ''} onChange={e => setEdit({ ...edit, precio_tres: e.target.value ? Number(e.target.value) : null })} className={input} placeholder="Ej: 285000" />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase">Tallas disponibles</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEdit({ ...edit, tallas: [...TALLAS_ESTANDAR] })} className="text-[11px] font-semibold text-[#00847A] hover:underline">Todas</button>
                  <button type="button" onClick={() => setEdit({ ...edit, tallas: [] })} className="text-[11px] font-semibold text-[#9A9A9A] hover:underline">Ninguna</button>
                </div>
              </div>
              <p className="text-[10px] text-[#9A9A9A] mb-2">Toca las tallas que tiene este producto (se ponen en verde).</p>

              {/* Cuadrícula de tallas estándar (toca para activar/desactivar) */}
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {TALLAS_ESTANDAR.map(t => {
                  const on = edit.tallas.includes(t);
                  return (
                    <button key={t} type="button"
                      onClick={() => setEdit({ ...edit, tallas: on ? edit.tallas.filter(x => x !== t) : [...edit.tallas, t] })}
                      className={`text-[12px] font-semibold px-2 py-1.5 rounded-lg border-2 text-left transition-colors ${on ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A]' : 'border-[#E0E0E0] text-[#6B6B6B] hover:border-[#00A89D]/40'}`}>
                      {on ? '✓ ' : ''}{t}
                    </button>
                  );
                })}
              </div>

              {/* Tallas personalizadas (fuera de la lista estándar) */}
              {edit.tallas.filter(t => !TALLAS_ESTANDAR.includes(t)).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {edit.tallas.filter(t => !TALLAS_ESTANDAR.includes(t)).map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-lg bg-[#00A89D]/10 text-[#00847A]">
                      {t}
                      <button onClick={() => setEdit({ ...edit, tallas: edit.tallas.filter(x => x !== t) })} className="text-[#DC2626] font-bold">✕</button>
                    </span>
                  ))}
                </div>
              )}

              <label className="block text-[10px] font-bold mb-1 uppercase text-[#9A9A9A]">Otra talla (opcional)</label>
              <div className="flex gap-2">
                <input value={tallaTmp} onChange={e => setTallaTmp(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = tallaTmp.trim().toUpperCase(); if (v && !edit.tallas.includes(v)) { setEdit({ ...edit, tallas: [...edit.tallas, v] }); } setTallaTmp(''); } }}
                  className={input} placeholder="Ej: ÚNICA, XS… (Enter para agregar)" />
                <button type="button" onClick={() => { const v = tallaTmp.trim().toUpperCase(); if (v && !edit.tallas.includes(v)) { setEdit({ ...edit, tallas: [...edit.tallas, v] }); } setTallaTmp(''); }} className="px-3 rounded-lg bg-[#00A89D] text-white font-bold">+</button>
              </div>
            </div>

            {edit.tallas.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold mb-1 uppercase">Cantidad disponible por talla</label>
                <p className="text-[10px] text-[#9A9A9A] mb-2">Cuántas prendas tienes de cada talla. Se descuenta con cada compra. Si la dejas vacía, esa talla no lleva control (siempre disponible).</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {edit.tallas.map(t => (
                    <div key={t} className="flex items-center gap-2 border border-[#EEE] rounded-lg px-2 py-1.5">
                      <span className="text-[11px] font-semibold text-[#0D0D0D] flex-1 truncate">{t}</span>
                      <input type="number" min={0} value={edit.stock?.[t] ?? ''}
                        onChange={e => { const v = e.target.value; const s: Record<string, number> = { ...(edit.stock || {}) }; if (v === '') delete s[t]; else s[t] = Math.max(0, parseInt(v, 10) || 0); setEdit({ ...edit, stock: s }); }}
                        className="w-16 px-2 py-1 rounded border border-[#E0E0E0] text-sm text-center" placeholder="—" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEdit(null)} className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-sm hover:bg-[#F5F5F5]">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="flex-1 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A] disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

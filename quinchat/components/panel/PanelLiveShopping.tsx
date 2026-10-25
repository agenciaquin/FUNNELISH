'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ───────────────────────── tipos del editor ─────────────────────────
type EstadoLive = 'borrador' | 'activo' | 'archivado';
interface LiveResumen { id: string; slug: string; titulo: string; estado: EstadoLive; video_url: string | null; whatsapp: string | null; etiqueta_grabada: string | null; productos: number; }
interface Color { id?: string; nombre: string; hex: string; foto_url: string; }
interface Producto { id: string; nombre: string; descripcion: string | null; ficha_tela: string | null; ficha_cuidados: string | null; precio: number; precio_antes: number | null; promo_etiqueta: string | null; promo_unidades: number | null; promo_precio: number | null; tallas: string[]; colores: Color[]; }
interface EventoTL { tipo: 'producto' | 'pregunta_frecuente' | 'comentario'; inicio_seg: number; fin_seg: number; producto_id?: string | null; pregunta?: string; respuesta?: string; autor?: string; texto?: string; }
interface LiveFull { id: string; slug: string; titulo: string; estado: EstadoLive; video_url: string | null; poster_url: string | null; whatsapp: string | null; etiqueta_grabada: string | null; duracion_seg: number | null; tienda_nombre: string | null; tienda_logo: string | null; modo: string; }

const TALLAS = ['S', 'M', 'L', 'XL'];
const peso = (n: number) => `$${(Number(n) || 0).toLocaleString('es-CO')}`;

async function api(url: string, opts?: RequestInit) {
  const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || 'error');
  return j;
}

export default function PanelLiveShopping() {
  const [lives, setLives] = useState<LiveResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel] = useState<string | null>(null);  // id del live en edición
  const [copiado, setCopiado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const flash = useCallback((t: string) => { setAviso(t); setTimeout(() => setAviso(null), 2200); }, []);

  const cargarLives = useCallback(async () => {
    setCargando(true);
    try { const j = await api('/api/live-admin/lives'); setLives(j.lives ?? []); }
    catch { setLives([]); }
    setCargando(false);
  }, []);
  useEffect(() => { cargarLives(); }, [cargarLives]);

  const urlPublica = (slug: string) => (typeof window !== 'undefined' ? window.location.origin : '') + `/live/${slug}`;
  const copiar = async (slug: string) => { try { await navigator.clipboard.writeText(urlPublica(slug)); setCopiado(slug); setTimeout(() => setCopiado(null), 1600); } catch { /* */ } };

  const crearLive = async () => {
    try { const j = await api('/api/live-admin/lives', { method: 'POST', body: JSON.stringify({ titulo: 'Nuevo live' }) }); await cargarLives(); setSel(j.live.id); }
    catch (e: any) { flash('No se pudo crear: ' + e.message); }
  };
  const borrarLive = async (id: string) => {
    if (!confirm('¿Borrar este live? No se puede deshacer.')) return;
    try { await api(`/api/live-admin/lives/${id}`, { method: 'DELETE' }); if (sel === id) setSel(null); await cargarLives(); }
    catch (e: any) { flash('No se pudo borrar: ' + e.message); }
  };

  if (sel) return <EditorLive id={sel} onVolver={() => { setSel(null); cargarLives(); }} onAviso={flash} />;

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto bg-brand-ivory p-5 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🎬</span>
          <h1 className="text-xl font-bold text-brand-black">QUIN LIVE SHOPPING</h1>
        </div>
        <p className="text-sm text-brand-gray-mid mb-5">Crea y edita tus lives: video, productos, colores y la línea de tiempo. Los activos quedan públicos en <code>/live/&lt;slug&gt;</code>.</p>

        <button onClick={crearLive} className="mb-5 px-4 py-2 rounded-lg text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#007A72]">+ Nuevo live</button>

        {aviso && <div className="mb-4 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">{aviso}</div>}
        {cargando ? <p className="text-sm text-brand-gray-mid">Cargando…</p> : lives.length === 0 ? (
          <p className="text-sm text-brand-gray-mid">Todavía no hay lives. Crea el primero con “+ Nuevo live”.</p>
        ) : lives.map(l => (
          <div key={l.id} className="bg-white border border-brand-border rounded-2xl p-4 mb-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-brand-black truncate">{l.titulo}</p>
                  <EstadoChip estado={l.estado} />
                </div>
                <p className="text-xs text-brand-gray-mid">/live/{l.slug} · {l.productos} producto{l.productos === 1 ? '' : 's'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSel(l.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00A89D] text-white hover:bg-[#007A72]">Editar</button>
                <button onClick={() => copiar(l.slug)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-brand-border hover:bg-brand-gray-light">{copiado === l.slug ? '¡Copiado!' : 'Copiar enlace'}</button>
                <a href={`/live/${l.slug}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-brand-border hover:bg-brand-gray-light">Abrir</a>
                <button onClick={() => borrarLive(l.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50">Borrar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EstadoChip({ estado }: { estado: EstadoLive }) {
  const m: Record<EstadoLive, string> = { activo: 'bg-emerald-100 text-emerald-700', borrador: 'bg-amber-100 text-amber-700', archivado: 'bg-neutral-200 text-neutral-600' };
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${m[estado]}`}>{estado}</span>;
}

// ───────────────────────── editor de un live ─────────────────────────
function EditorLive({ id, onVolver, onAviso }: { id: string; onVolver: () => void; onAviso: (t: string) => void }) {
  const [live, setLive] = useState<LiveFull | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [timeline, setTimeline] = useState<EventoTL[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const j = await api(`/api/live-admin/lives/${id}`);
      setLive(j.live);
      setProductos((j.productos ?? []).map((p: any) => ({ ...p, colores: p.colores ?? [], tallas: p.tallas ?? TALLAS })));
      setTimeline((j.timeline ?? []).map((e: any) => ({ tipo: e.tipo, inicio_seg: Number(e.inicio_seg), fin_seg: Number(e.fin_seg), producto_id: e.producto_id, pregunta: e.pregunta ?? '', respuesta: e.respuesta ?? '', autor: e.autor ?? 'Cliente DEMO', texto: e.texto ?? '' })));
    } catch (e: any) { onAviso('No se pudo cargar: ' + e.message); }
    setCargando(false);
    // onAviso es estable (useCallback en el padre); no lo ponemos como dependencia
    // para que el editor NO se recargue en bucle mientras editas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  const setCampo = (k: keyof LiveFull, v: any) => setLive(l => l ? { ...l, [k]: v } : l);

  const guardarLive = async () => {
    if (!live) return;
    setGuardando(true);
    try {
      await api(`/api/live-admin/lives/${id}`, { method: 'PATCH', body: JSON.stringify({
        titulo: live.titulo, slug: live.slug, estado: live.estado, video_url: live.video_url,
        whatsapp: live.whatsapp, etiqueta_grabada: live.etiqueta_grabada, duracion_seg: live.duracion_seg,
        tienda_nombre: live.tienda_nombre, tienda_logo: live.tienda_logo,
      }) });
      onAviso('Datos del live guardados ✅');
    } catch (e: any) { onAviso('Error: ' + e.message); }
    setGuardando(false);
  };

  const guardarContenido = async () => {
    setGuardando(true);
    try {
      await api(`/api/live-admin/lives/${id}/contenido`, { method: 'PUT', body: JSON.stringify({
        productos: productos.map((p, i) => ({ producto_id: p.id, orden: i })),
        timeline: timeline,
      }) });
      onAviso('Productos y línea de tiempo guardados ✅');
    } catch (e: any) { onAviso('Error: ' + e.message); }
    setGuardando(false);
  };

  const agregarProducto = async () => {
    try {
      const j = await api('/api/live-admin/productos', { method: 'POST', body: JSON.stringify({ nombre: 'Buzo nuevo', precio: 129900, tallas: TALLAS }) });
      // vincular: se guarda al pulsar "Guardar productos y línea de tiempo"; mientras, lo mostramos
      await cargar();
      const nuevo = { id: j.id, nombre: 'Buzo nuevo', descripcion: '', ficha_tela: '', ficha_cuidados: '', precio: 129900, precio_antes: null, promo_etiqueta: null, promo_unidades: null, promo_precio: null, tallas: TALLAS, colores: [] } as Producto;
      setProductos(p => p.some(x => x.id === j.id) ? p : [...p, nuevo]);
      onAviso('Producto creado. No olvides “Guardar productos…”.');
    } catch (e: any) { onAviso('Error: ' + e.message); }
  };

  const guardarProducto = async (p: Producto) => {
    try {
      await api(`/api/live-admin/productos/${p.id}`, { method: 'PATCH', body: JSON.stringify({
        nombre: p.nombre, descripcion: p.descripcion, ficha_tela: p.ficha_tela, ficha_cuidados: p.ficha_cuidados,
        precio: p.precio, precio_antes: p.precio_antes, promo_etiqueta: p.promo_etiqueta, promo_unidades: p.promo_unidades, promo_precio: p.promo_precio,
        tallas: p.tallas, colores: p.colores,
      }) });
      onAviso('Producto guardado ✅');
    } catch (e: any) { onAviso('Error: ' + e.message); }
  };

  const quitarProducto = (pid: string) => setProductos(ps => ps.filter(p => p.id !== pid));
  const setProd = (pid: string, patch: Partial<Producto>) => setProductos(ps => ps.map(p => p.id === pid ? { ...p, ...patch } : p));

  if (cargando || !live) return <div className="flex-1 p-8 text-sm text-brand-gray-mid">Cargando editor…</div>;

  const campo = 'w-full rounded-lg border border-brand-border px-3 py-2 text-sm';

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto bg-brand-ivory p-5 md:p-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={onVolver} className="text-sm text-[#00A89D] font-semibold mb-3">← Volver a la lista</button>

        {/* Datos del live */}
        <section className="bg-white border border-brand-border rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-brand-black">Datos del live</h2>
            <a href={`/live/${live.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#00A89D]">Abrir maqueta ↗</a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-brand-black">Título
              <input className={campo} value={live.titulo} onChange={e => setCampo('titulo', e.target.value)} /></label>
            <label className="text-xs font-semibold text-brand-black">Slug (dirección)
              <input className={campo} value={live.slug} onChange={e => setCampo('slug', e.target.value)} /></label>
            <label className="text-xs font-semibold text-brand-black">URL del video (Cloudflare R2)
              <input className={campo} placeholder="https://… .mp4 o .m3u8" value={live.video_url ?? ''} onChange={e => setCampo('video_url', e.target.value)} /></label>
            <label className="text-xs font-semibold text-brand-black">WhatsApp (57XXXXXXXXXX)
              <input className={campo} value={live.whatsapp ?? ''} onChange={e => setCampo('whatsapp', e.target.value.replace(/\D/g, ''))} /></label>
            <label className="text-xs font-semibold text-brand-black">Etiqueta del encabezado
              <input className={campo} value={live.etiqueta_grabada ?? ''} onChange={e => setCampo('etiqueta_grabada', e.target.value)} /></label>
            <label className="text-xs font-semibold text-brand-black">Duración del video (seg)
              <input type="number" className={campo} value={live.duracion_seg ?? 180} onChange={e => setCampo('duracion_seg', Number(e.target.value))} /></label>
            <label className="text-xs font-semibold text-brand-black">Estado
              <select className={campo} value={live.estado} onChange={e => setCampo('estado', e.target.value as EstadoLive)}>
                <option value="borrador">Borrador (solo tú)</option>
                <option value="activo">Activo (público)</option>
                <option value="archivado">Archivado</option>
              </select></label>
          </div>
          <button onClick={guardarLive} disabled={guardando} className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#007A72] disabled:opacity-50">Guardar datos del live</button>
        </section>

        {/* Productos */}
        <section className="bg-white border border-brand-border rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-brand-black">Productos ({productos.length})</h2>
            <button onClick={agregarProducto} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-brand-border hover:bg-brand-gray-light">+ Agregar producto</button>
          </div>
          {productos.length === 0 && <p className="text-sm text-brand-gray-mid">Sin productos. Agrega el primero.</p>}
          {productos.map((p, idx) => (
            <ProductoEditor key={p.id} p={p} indice={idx + 1} campo={campo}
              onChange={patch => setProd(p.id, patch)}
              onGuardar={() => guardarProducto(p)}
              onQuitar={() => quitarProducto(p.id)}
              onAviso={onAviso} />
          ))}
        </section>

        {/* Línea de tiempo */}
        <section className="bg-white border border-brand-border rounded-2xl p-4 mb-4">
          <h2 className="font-bold text-brand-black mb-1">Línea de tiempo</h2>
          <p className="text-xs text-brand-gray-mid mb-3">En qué segundo del video aparece cada producto, pregunta o comentario de ejemplo.</p>
          <TimelineEditor timeline={timeline} setTimeline={setTimeline} productos={productos} campo={campo} />
        </section>

        <button onClick={guardarContenido} disabled={guardando} className="mb-10 px-5 py-2.5 rounded-lg text-sm font-bold bg-[#00A89D] text-white hover:bg-[#007A72] disabled:opacity-50">
          {guardando ? 'Guardando…' : 'Guardar productos y línea de tiempo'}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── editor de un producto ─────────────────────────
function ProductoEditor({ p, indice, campo, onChange, onGuardar, onQuitar, onAviso }: {
  p: Producto; indice: number; campo: string;
  onChange: (patch: Partial<Producto>) => void; onGuardar: () => void; onQuitar: () => void; onAviso: (t: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState<number | null>(null);

  const subirFoto = async (i: number, file: File) => {
    setSubiendo(i);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/catalogos/upload-imagen', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j?.error || 'subida falló');
      const cols = [...p.colores]; cols[i] = { ...cols[i], foto_url: j.url }; onChange({ colores: cols });
    } catch (e: any) { onAviso('Foto: ' + e.message); }
    setSubiendo(null);
  };
  const setColor = (i: number, patch: Partial<Color>) => { const c = [...p.colores]; c[i] = { ...c[i], ...patch }; onChange({ colores: c }); };
  const addColor = () => onChange({ colores: [...p.colores, { nombre: 'Color', hex: '#888888', foto_url: '' }] });
  const delColor = (i: number) => onChange({ colores: p.colores.filter((_, j) => j !== i) });
  const toggleTalla = (t: string) => onChange({ tallas: p.tallas.includes(t) ? p.tallas.filter(x => x !== t) : [...p.tallas, t] });

  return (
    <div className="border border-brand-border rounded-xl p-3 mb-2">
      <div className="flex items-center gap-2 justify-between">
        <button onClick={() => setAbierto(a => !a)} className="flex items-center gap-2 min-w-0 text-left">
          <span className="text-[10px] font-bold bg-[#ff3366] text-white rounded px-1.5 py-0.5">{String(indice).padStart(2, '0')}</span>
          <span className="font-semibold text-brand-black truncate">{p.nombre || 'Sin nombre'}</span>
          <span className="text-xs text-brand-gray-mid">{peso(p.precio)}</span>
          <span className="text-xs text-[#00A89D]">{abierto ? '▲' : '▼'}</span>
        </button>
        <button onClick={onQuitar} className="text-xs text-red-600 shrink-0">Quitar</button>
      </div>

      {abierto && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="text-xs font-semibold">Nombre<input className={campo} value={p.nombre} onChange={e => onChange({ nombre: e.target.value })} /></label>
            <label className="text-xs font-semibold">Descripción<input className={campo} value={p.descripcion ?? ''} onChange={e => onChange({ descripcion: e.target.value })} /></label>
            <label className="text-xs font-semibold">Precio<input type="number" className={campo} value={p.precio} onChange={e => onChange({ precio: Number(e.target.value) })} /></label>
            <label className="text-xs font-semibold">Precio antes (opcional)<input type="number" className={campo} value={p.precio_antes ?? ''} onChange={e => onChange({ precio_antes: e.target.value ? Number(e.target.value) : null })} /></label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="text-xs font-semibold">Promo etiqueta<input className={campo} placeholder="Pack x2" value={p.promo_etiqueta ?? ''} onChange={e => onChange({ promo_etiqueta: e.target.value || null })} /></label>
            <label className="text-xs font-semibold">Unidades pack<input type="number" className={campo} value={p.promo_unidades ?? ''} onChange={e => onChange({ promo_unidades: e.target.value ? Number(e.target.value) : null })} /></label>
            <label className="text-xs font-semibold">Precio pack<input type="number" className={campo} value={p.promo_precio ?? ''} onChange={e => onChange({ promo_precio: e.target.value ? Number(e.target.value) : null })} /></label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="text-xs font-semibold">Ficha · tela<input className={campo} value={p.ficha_tela ?? ''} onChange={e => onChange({ ficha_tela: e.target.value })} /></label>
            <label className="text-xs font-semibold">Ficha · cuidados<input className={campo} value={p.ficha_cuidados ?? ''} onChange={e => onChange({ ficha_cuidados: e.target.value })} /></label>
          </div>
          <div>
            <p className="text-xs font-semibold mb-1">Tallas</p>
            <div className="flex gap-2">{TALLAS.map(t => (
              <button key={t} onClick={() => toggleTalla(t)} className={`h-8 w-10 rounded-lg border-2 text-sm font-bold ${p.tallas.includes(t) ? 'border-[#00A89D] bg-[#00A89D] text-white' : 'border-brand-border'}`}>{t}</button>
            ))}</div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold">Colores</p>
              <button onClick={addColor} className="text-xs text-[#00A89D] font-semibold">+ Color</button>
            </div>
            {p.colores.map((c, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                {c.foto_url
                  ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.foto_url} alt="" className="w-10 h-10 rounded object-cover bg-neutral-100 shrink-0" />
                  : <span className="w-10 h-10 rounded bg-neutral-100 shrink-0" />}
                <input className="flex-1 min-w-0 rounded-lg border border-brand-border px-2 py-1 text-sm" placeholder="Nombre del color" value={c.nombre} onChange={e => setColor(i, { nombre: e.target.value })} />
                <input type="color" className="w-8 h-8 rounded border border-brand-border shrink-0" value={c.hex || '#888888'} onChange={e => setColor(i, { hex: e.target.value })} />
                <label className="text-xs font-semibold text-[#00A89D] cursor-pointer shrink-0">
                  {subiendo === i ? '…' : 'Foto'}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(i, f); }} />
                </label>
                <button onClick={() => delColor(i)} className="text-xs text-red-600 shrink-0">✕</button>
              </div>
            ))}
          </div>
          <button onClick={onGuardar} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00A89D] text-white hover:bg-[#007A72]">Guardar producto</button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── editor de la línea de tiempo ─────────────────────────
function TimelineEditor({ timeline, setTimeline, productos, campo }: {
  timeline: EventoTL[]; setTimeline: (t: EventoTL[]) => void; productos: Producto[]; campo: string;
}) {
  const set = (i: number, patch: Partial<EventoTL>) => setTimeline(timeline.map((e, j) => j === i ? { ...e, ...patch } : e));
  const add = (tipo: EventoTL['tipo']) => setTimeline([...timeline, { tipo, inicio_seg: 0, fin_seg: 60, producto_id: productos[0]?.id ?? null, pregunta: '', respuesta: '', autor: 'Cliente DEMO', texto: '' }]);
  const del = (i: number) => setTimeline(timeline.filter((_, j) => j !== i));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => add('producto')} className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-brand-border hover:bg-brand-gray-light">+ Producto</button>
        <button onClick={() => add('pregunta_frecuente')} className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-brand-border hover:bg-brand-gray-light">+ Pregunta frecuente</button>
        <button onClick={() => add('comentario')} className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-brand-border hover:bg-brand-gray-light">+ Comentario DEMO</button>
      </div>
      {[...timeline].map((e, i) => (
        <div key={i} className="border border-brand-border rounded-xl p-2 mb-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{e.tipo === 'pregunta_frecuente' ? 'Pregunta' : e.tipo === 'comentario' ? 'Comentario' : 'Producto'}</span>
            <label className="text-xs">Del seg <input type="number" className="w-16 rounded border border-brand-border px-1.5 py-0.5 text-sm" value={e.inicio_seg} onChange={ev => set(i, { inicio_seg: Number(ev.target.value) })} /></label>
            <label className="text-xs">al <input type="number" className="w-16 rounded border border-brand-border px-1.5 py-0.5 text-sm" value={e.fin_seg} onChange={ev => set(i, { fin_seg: Number(ev.target.value) })} /></label>
            <button onClick={() => del(i)} className="ml-auto text-xs text-red-600">✕</button>
          </div>
          {e.tipo === 'producto' && (
            <select className={campo} value={e.producto_id ?? ''} onChange={ev => set(i, { producto_id: ev.target.value })}>
              <option value="">— elige producto —</option>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          )}
          {e.tipo === 'pregunta_frecuente' && (
            <div className="space-y-1">
              <input className={campo} placeholder="Pregunta" value={e.pregunta ?? ''} onChange={ev => set(i, { pregunta: ev.target.value })} />
              <input className={campo} placeholder="Respuesta" value={e.respuesta ?? ''} onChange={ev => set(i, { respuesta: ev.target.value })} />
            </div>
          )}
          {e.tipo === 'comentario' && (
            <div className="flex gap-2">
              <input className="w-40 rounded-lg border border-brand-border px-2 py-1 text-sm" placeholder="Autor" value={e.autor ?? ''} onChange={ev => set(i, { autor: ev.target.value })} />
              <input className="flex-1 min-w-0 rounded-lg border border-brand-border px-2 py-1 text-sm" placeholder="Comentario" value={e.texto ?? ''} onChange={ev => set(i, { texto: ev.target.value })} />
            </div>
          )}
        </div>
      ))}
      {timeline.length === 0 && <p className="text-sm text-brand-gray-mid">Sin eventos todavía.</p>}
    </div>
  );
}

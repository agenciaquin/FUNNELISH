'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { comprimirImagen } from '@/lib/imagen-comprimir';

/**
 * Ventana «Confirmar datos antes de pasar al panel» (botón «Enviar al panel de Effi» del chat).
 *
 * Diseño: cliente y dirección arriba · prendas (una tarjeta por prenda) al centro · resumen a la derecha.
 * Cada prenda es independiente: producto del catálogo KLIXMANT, color, talla-género, cantidad,
 * precio unitario, foto y notas; su ID de variante, SKU y referencia salen SOLO del catálogo.
 * El valor total del pedido se reparte entre las unidades mientras el precio no se edite a mano.
 * Nada se guarda hasta «Confirmar y pasar al panel»; el servidor vuelve a calcular ID y SKU.
 */

interface Variante { id: number; id_item: number; color: string | null; talla: string | null; sku: string | null; genero?: string; referencia?: string | null; nombre?: string | null; foto?: string | null }
interface Producto { id_item: number; id_catalogo?: number; catalogo: string; nombre: string | null; referencia: string | null; tipo: string | null; genero: string; foto: string | null; variantes?: Variante[]; colores?: string[]; tallas?: string[] }
interface PrendaInicial { texto: string; color: string; talla: string; genero: string; cantidad: number; precio: number; id_item: number | null; candidatos: Producto[] }
interface PrendaElegida { id_item: number; color: string; talla: string; genero: string; catalogo: string; tipo: string | null; foto: string | null; notas: string }
interface Fila extends PrendaInicial { key: number }

const TRANSPORTADORAS = ['', 'CIUDAD BONITA', 'INTER RAPIDISIMO', 'ENVIA', 'COORDINADORA', 'SERVIENTREGA', 'JOSE ENVIOS'];
const VERDE = '#0E8A7E';
const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const input = 'w-full h-10 px-3 rounded-xl border border-[#DADDE0] bg-white text-[13.5px] text-[#0D0D0D] focus:outline-none focus:border-[#0E8A7E] focus:ring-2 focus:ring-[#0E8A7E]/15';
const etq = 'block text-[12px] font-medium text-[#4B5563] mb-1';
/** «XXL» = «2XL», «XXXL» = «3XL» (así las nombra KlixmSoft). */
const tallaNorm = (t: string) => String(t ?? '').toLowerCase().replace(/^talla\s+/, '').replace(/\s+/g, '')
  .replace(/^xxxxl$/, '4xl').replace(/^xxxl$/, '3xl').replace(/^xxl$/, '2xl');
const sinT = (t: string) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function Tarjeta({ icono, titulo, children, accion, className = '' }: { icono: string; titulo: ReactNode; children: ReactNode; accion?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[#E5E7EB] bg-white p-4 ${className}`}>
      <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#0D0D0D] mb-3"><span className="text-[18px]">{icono}</span>{titulo}{accion && <span className="ml-auto flex gap-2">{accion}</span>}</h3>
      {children}
    </section>
  );
}
const Chip = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] text-[11px] text-[#374151] whitespace-nowrap">{children}</span>
);

/** Una prenda: foto, producto, color, talla-género, cantidad, precio y datos del catálogo. */
function TarjetaPrenda({ n, inicial, fotoChat, cantidad, precio, onCantidad, onPrecio, onCambio, onQuitar }: {
  n: number; inicial: PrendaInicial; fotoChat: string | null; cantidad: number; precio: number;
  onCantidad: (c: number) => void; onPrecio: (p: number) => void;
  onCambio: (p: PrendaElegida | null) => void; onQuitar?: () => void;
}) {
  const [producto, setProducto] = useState<Producto | null>(null);
  const [color, setColor] = useState('');
  const [varId, setVarId] = useState<number | null>(null);
  const [notas, setNotas] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(!inicial.id_item);
  const [q, setQ] = useState(inicial.texto ?? '');
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  const cargarProducto = async (idItem: number, colorPref = '', tallaPref = '', generoPref = '') => {
    const r = await fetch(`/api/ventas-vendedores/desde-chat?producto=${idItem}`, { cache: 'no-store' });
    if (!r.ok) return;
    const p: Producto = await r.json();
    setProducto(p);
    const vs = p.variantes ?? [];
    const colores = [...new Set(vs.map(v => v.color).filter(Boolean))] as string[];
    const cp = sinT(colorPref).replace(/\s+/g, '');
    const c = colores.find(x => sinT(x).replace(/\s+/g, '') === cp)
      ?? colores.find(x => cp && (sinT(x).replace(/\s+/g, '').includes(cp) || cp.includes(sinT(x).replace(/\s+/g, ''))))
      ?? vs.find(v => v.id_item === idItem)?.color ?? colores[0] ?? '';
    setColor(c);
    const t = tallaNorm(tallaPref);
    const g = sinT(generoPref);
    // Solo se preselecciona la talla si el chat la trae: nunca se inventa.
    const deTalla = t ? vs.filter(v => v.color === c && tallaNorm(v.talla ?? '') === t) : [];
    const v = deTalla.find(x => g && sinT(x.genero ?? '') === g) ?? deTalla.find(x => x.id_item === idItem) ?? deTalla[0] ?? null;
    setVarId(v?.id ?? null);
    setFoto(v?.foto ?? vs.find(x => x.color === c)?.foto ?? p.foto);
  };

  useEffect(() => {
    if (inicial.id_item) cargarProducto(inicial.id_item, inicial.color, inicial.talla, inicial.genero);
    // Sin producto reconocido: el buscador abre YA con resultados del nombre del chat (antes quedaba vacío)
    else if (inicial.texto && !inicial.candidatos.length) buscar(inicial.texto);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const colores = useMemo(() => [...new Set((producto?.variantes ?? []).map(v => v.color).filter(Boolean))] as string[], [producto]);
  const opcionesTalla = useMemo(() => (producto?.variantes ?? []).filter(v => !color || v.color === color), [producto, color]);
  const variante = useMemo(() => (producto?.variantes ?? []).find(v => v.id === varId) ?? null, [producto, varId]);
  const fotoCatalogo = variante?.foto ?? (producto?.variantes ?? []).find(v => v.color === color)?.foto ?? producto?.foto ?? null;

  useEffect(() => {
    onCambio(variante && producto ? {
      id_item: variante.id_item, color: variante.color ?? '', talla: variante.talla ?? '', genero: variante.genero ?? '',
      catalogo: producto.catalogo, tipo: producto.tipo, foto, notas,
    } : null);
  }, [variante, producto, foto, notas]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarColor = (c: string) => {
    const fotoAntes = fotoCatalogo;
    setColor(c);
    const nueva = (producto?.variantes ?? []).find(v => v.color === c && v.talla === variante?.talla && v.genero === variante?.genero) ?? null;
    setVarId(nueva?.id ?? null);
    if (!foto || foto === fotoAntes) setFoto(nueva?.foto ?? (producto?.variantes ?? []).find(v => v.color === c)?.foto ?? foto);
  };
  const cambiarTalla = (id: number | null) => {
    const fotoAntes = fotoCatalogo;
    setVarId(id);
    const v = (producto?.variantes ?? []).find(x => x.id === id);
    if (v?.foto && (!foto || foto === fotoAntes)) setFoto(v.foto); // la foto del género elegido
  };
  const buscar = async (texto: string) => {
    setQ(texto);
    if (texto.trim().length < 2) { setResultados([]); return; }
    const r = await fetch(`/api/ventas-vendedores/desde-chat?q=${encodeURIComponent(texto)}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setResultados(j.resultados ?? []);
  };
  const elegirProducto = async (p: Producto) => {
    setBuscando(false); setResultados([]);
    await cargarProducto(p.id_item, color || inicial.color, variante?.talla ?? inicial.talla, variante?.genero ?? inicial.genero);
  };
  const subirFoto = async (f: File) => {
    setSubiendo(true);
    try {
      const liviana = await comprimirImagen(f).catch(() => f);
      const fd = new FormData(); fd.append('file', liviana);
      const r = await fetch('/api/catalogos/upload-imagen', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (j.url) setFoto(j.url);
    } finally { setSubiendo(false); }
  };

  const lista = resultados.length ? resultados : inicial.candidatos;
  const lista_ok = !!variante;
  return (
    <div className={`rounded-2xl border bg-white p-3 ${lista_ok ? 'border-[#E5E7EB]' : 'border-[#F59E0B]'}`}>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <span className="w-7 h-7 rounded-full text-white text-[13px] font-bold flex items-center justify-center" style={{ background: VERDE }}>{n}</span>
        </div>
        <div className="w-[150px] shrink-0">
          <div className="relative w-[150px] h-[120px] rounded-xl overflow-hidden bg-[#F3F4F6] border border-[#E5E7EB]">
            {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#9CA3AF] text-[12px]">Sin foto</div>}
            {subiendo && <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-[12px] font-semibold">Subiendo…</div>}
          </div>
          <input ref={archivo} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ''; }} />
          <div className="mt-1.5 flex flex-wrap gap-1">
            <button onClick={() => archivo.current?.click()} className="px-2 h-7 rounded-lg border border-[#DADDE0] text-[11px] font-semibold hover:bg-[#F3F4F6]">📷 Otra foto</button>
            {fotoCatalogo && foto !== fotoCatalogo && <button onClick={() => setFoto(fotoCatalogo)} className="px-2 h-7 rounded-lg border border-[#DADDE0] text-[11px] font-semibold hover:bg-[#F3F4F6]">🗂️ Catálogo</button>}
            {fotoChat && foto !== fotoChat && <button onClick={() => setFoto(fotoChat)} className="px-2 h-7 rounded-lg border border-[#DADDE0] text-[11px] font-semibold hover:bg-[#F3F4F6]">💬 Chat</button>}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-extrabold leading-tight text-[#0D0D0D] uppercase">{producto ? `${producto.catalogo}${variante?.color ? ` ${variante.color}` : color ? ` ${color}` : ''}` : 'Elige el producto'}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <Chip>ID: <b className="ml-1">{variante ? `#${variante.id}` : '—'}</b></Chip>
                <Chip>SKU: <b className="ml-1">{variante?.sku ?? '—'}</b></Chip>
                <Chip>Ref: <b className="ml-1">{variante?.referencia ?? producto?.referencia ?? '—'}</b></Chip>
                {variante?.genero && <Chip>{variante.genero}</Chip>}
              </div>
              {inicial.texto && <p className="mt-1 text-[11px] text-[#6B7280]">Del chat: <i>{[inicial.texto, inicial.color, inicial.talla, inicial.genero].filter(Boolean).join(' · ')}</i></p>}
            </div>
            <button onClick={() => { const abrir = !buscando; setBuscando(abrir); if (abrir && !resultados.length && q.trim().length >= 2) buscar(q); }} className="h-8 px-2.5 rounded-lg border text-[12px] font-bold shrink-0" style={{ borderColor: VERDE, color: VERDE }}>⇄ Cambiar</button>
            {onQuitar && <button onClick={onQuitar} title="Quitar prenda" className="w-8 h-8 rounded-lg border border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEF2F2] shrink-0">🗑</button>}
          </div>

          {buscando && (
            <div className="mt-2 rounded-xl border border-[#E5E7EB] p-2">
              <input autoFocus className={input} value={q} placeholder="Buscar en el catálogo KLIXMANT…" onChange={e => buscar(e.target.value)} />
              <div className="mt-2 max-h-[280px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {lista.map(p => (
                  <button key={p.id_item} onClick={() => elegirProducto(p)} className={`flex items-center gap-2 p-1.5 rounded-lg border text-left hover:bg-[#F0FAF8] ${producto?.id_item === p.id_item ? 'border-[#0E8A7E]' : 'border-[#EEE]'}`}>
                    {p.foto ? <img src={p.foto} alt="" className="w-10 h-10 rounded object-cover shrink-0" /> : <div className="w-10 h-10 rounded bg-[#F3F4F6] shrink-0" />}
                    <span className="text-[11.5px] leading-tight"><b>{p.catalogo}</b><br /><span className="text-[#6B7280]">{p.genero} · {(p.colores ?? []).join(', ')}</span></span>
                  </button>
                ))}
                {!lista.length && <p className="col-span-2 text-[12px] text-[#9CA3AF] px-1">{q.trim().length >= 2 ? `No encontré «${q.trim()}». Prueba con otra palabra (ej. «bucaramanga», «camiseta america»).` : 'Escribe el nombre del diseño (ej. «camiseta america»).'}</p>}
              </div>
            </div>
          )}

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className={etq}>Color <span className="text-[#DC2626]">*</span></label>
              <select className={`${input} h-9`} value={color} onChange={e => cambiarColor(e.target.value)} disabled={!producto}>
                {colores.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={etq}>Talla · género <span className="text-[#DC2626]">*</span></label>
              <select className={`${input} h-9 ${producto && !variante ? 'border-[#F59E0B] bg-[#FFFBEB]' : ''}`} value={varId ?? ''} onChange={e => cambiarTalla(Number(e.target.value) || null)} disabled={!producto}>
                <option value="">— Elige —</option>
                {opcionesTalla.map(v => <option key={v.id} value={v.id}>{v.talla}{v.genero ? ` - ${v.genero}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className={etq}>Cantidad <span className="text-[#DC2626]">*</span></label>
              <div className="flex items-center h-9 rounded-xl border border-[#DADDE0]">
                <button onClick={() => onCantidad(Math.max(1, cantidad - 1))} className="w-8 h-full">−</button>
                <span className="flex-1 text-center font-bold">{cantidad}</span>
                <button onClick={() => onCantidad(Math.min(50, cantidad + 1))} className="w-8 h-full">+</button>
              </div>
            </div>
            <div>
              <label className={etq}>Precio unitario <span className="text-[#DC2626]">*</span></label>
              <div className="flex items-center h-9 rounded-xl border border-[#DADDE0] bg-[#F0FAF8] px-2">
                <span className="text-[#6B7280] text-[13px]">$</span>
                <input className="flex-1 min-w-0 bg-transparent px-1 text-[13.5px] font-semibold focus:outline-none" value={precio ? precio.toLocaleString('es-CO') : ''} placeholder="0"
                  onChange={e => onPrecio(Number(e.target.value.replace(/\D/g, '')) || 0)} />
              </div>
            </div>
          </div>
          <input className={`${input} h-9 mt-2`} value={notas} placeholder="Notas de esta prenda (opcional)" onChange={e => setNotas(e.target.value)} />
          {!producto && <p className="mt-1 text-[12px] text-[#B45309]">⚠️ Elige el producto con «⇄ Cambiar».</p>}
          {producto && !variante && <p className="mt-1 text-[12px] text-[#B45309]">⚠️ Elige la talla: así sale el ID, el SKU y la referencia exactos.</p>}
        </div>
      </div>
    </div>
  );
}

export default function EnviarPanelEffiModal({ conv, onCerrar, onListo }: { conv: string; onCerrar: () => void; onListo?: (codigo: string) => void }) {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [datos, setDatos] = useState<Record<string, any>>({});
  const [filas, setFilas] = useState<Fila[]>([]);
  const [elegidas, setElegidas] = useState<Record<number, PrendaElegida | null>>({});
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [precios, setPrecios] = useState<Record<number, { valor: number; manual: boolean }>>({});
  const [totalPedido, setTotalPedido] = useState(0);
  const [fotoChat, setFotoChat] = useState<string | null>(null);
  const [existente, setExistente] = useState<any>(null);
  const [vendedor, setVendedor] = useState('');
  const [forzar, setForzar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; t: string; lista?: string[] } | null>(null);
  const llave = useRef(0);

  // ── Ventana movible y de tamaño ajustable (08-nov-2026) ─────────────────────
  // Se arrastra desde el encabezado, se agranda/achica desde los bordes y la esquina,
  // y se puede minimizar (barra abajo) o maximizar. El tamaño se recuerda en este equipo.
  const MIN_W = 640, MIN_H = 380;
  const [caja, setCaja] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [modoVentana, setModoVentana] = useState<'normal' | 'max' | 'min'>('normal');
  const gesto = useRef<{ tipo: string; px: number; py: number; caja: { x: number; y: number; w: number; h: number } } | null>(null);
  useEffect(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    let w = Math.min(1180, vw - 24), h = Math.min(Math.round(vh * 0.95), 920);
    try {
      const g = JSON.parse(localStorage.getItem('qc-ventana-panel-effi') || 'null');
      if (g?.w && g?.h) { w = Math.min(Math.max(MIN_W, g.w), vw - 8); h = Math.min(Math.max(MIN_H, g.h), vh - 8); }
    } catch { /* sin almacenamiento */ }
    setCaja({ x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), w, h });
  }, []);
  const empezarGesto = (tipo: string) => (e: React.PointerEvent) => {
    if (!caja || modoVentana !== 'normal' || e.button !== 0) return;
    if (tipo === 'mover' && (e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    e.preventDefault();
    gesto.current = { tipo, px: e.clientX, py: e.clientY, caja: { ...caja } };
    const mover = (ev: PointerEvent) => {
      const g = gesto.current; if (!g) return;
      const dx = ev.clientX - g.px, dy = ev.clientY - g.py;
      const vw = window.innerWidth, vh = window.innerHeight;
      let { x, y, w, h } = g.caja;
      if (g.tipo === 'mover') {
        x = Math.min(Math.max(x + dx, 80 - w), vw - 80);   // siempre queda un pedazo visible
        y = Math.min(Math.max(y + dy, 0), vh - 60);        // el encabezado nunca se esconde arriba
      } else {
        if (g.tipo.includes('e')) w = Math.max(MIN_W, Math.min(w + dx, vw - x - 4));
        if (g.tipo.includes('s')) h = Math.max(MIN_H, Math.min(h + dy, vh - y - 4));
        if (g.tipo.includes('w')) { const nw = Math.max(MIN_W, w - dx); x = x + (w - nw); w = nw; }
        if (g.tipo.includes('n')) { const nh = Math.max(MIN_H, h - dy); y = Math.max(0, y + (h - nh)); h = nh; }
      }
      setCaja({ x, y, w, h });
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar);
      gesto.current = null;
      setCaja(c => { if (c) { try { localStorage.setItem('qc-ventana-panel-effi', JSON.stringify({ w: c.w, h: c.h })); } catch { /* */ } } return c; });
    };
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
  };
  const estiloVentana: React.CSSProperties = modoVentana === 'max'
    ? { left: 8, top: 8, width: 'calc(100vw - 16px)', height: 'calc(100vh - 16px)' }
    : caja ? { left: caja.x, top: caja.y, width: caja.w, height: caja.h } : { left: '50%', top: '50%', width: 1180, height: '90vh', transform: 'translate(-50%,-50%)' };
  const centrar = () => setCaja(c => c ? { ...c, x: Math.round((window.innerWidth - c.w) / 2), y: Math.round((window.innerHeight - c.h) / 2) } : c);

  const set = (k: string, v: any) => setDatos(d => ({ ...d, [k]: v }));

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/ventas-vendedores/desde-chat?conv=${encodeURIComponent(conv)}`, { cache: 'no-store' });
        const j = await r.json();
        if (!vivo) return;
        if (!r.ok) { setErrorCarga(j.error || 'No se pudieron leer los datos del chat'); return; }
        setDatos(j.datos ?? {});
        setExistente(j.existente ?? null);
        setVendedor(j.vendedor ?? '');
        setFotoChat(j.foto_chat ?? null);
        setTotalPedido(Number(j.total) || 0);
        const ps: PrendaInicial[] = Array.isArray(j.prendas) && j.prendas.length ? j.prendas : [{ texto: '', color: '', talla: '', genero: '', cantidad: 1, precio: 0, id_item: null, candidatos: [] }];
        const fs = ps.map(p => ({ ...p, key: ++llave.current }));
        setFilas(fs);
        setCantidades(Object.fromEntries(fs.map(f => [f.key, Math.max(1, f.cantidad || 1)])));
        setPrecios(Object.fromEntries(fs.map(f => [f.key, { valor: f.precio || 0, manual: false }])));
      } catch (e: any) {
        if (vivo) setErrorCarga(e?.message ?? 'Error');
      } finally { if (vivo) setCargando(false); }
    })();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', esc);
    return () => { vivo = false; window.removeEventListener('keydown', esc); };
  }, [conv]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reparto automático del total del pedido entre las unidades (solo precios no editados a mano).
  const unidades = filas.reduce((t, f) => t + (cantidades[f.key] ?? 1), 0);
  useEffect(() => {
    if (!totalPedido || !filas.length) return;
    const manualKeys = filas.filter(f => precios[f.key]?.manual);
    const fijo = manualKeys.reduce((t, f) => t + (precios[f.key]?.valor ?? 0) * (cantidades[f.key] ?? 1), 0);
    const unidadesAuto = filas.filter(f => !precios[f.key]?.manual).reduce((t, f) => t + (cantidades[f.key] ?? 1), 0);
    if (!unidadesAuto) return;
    const unit = Math.max(0, Math.round((totalPedido - fijo) / unidadesAuto));
    setPrecios(prev => {
      let cambio = false;
      const nx = { ...prev };
      for (const f of filas) if (!prev[f.key]?.manual && prev[f.key]?.valor !== unit) { nx[f.key] = { valor: unit, manual: false }; cambio = true; }
      return cambio ? nx : prev;
    });
  }, [unidades, filas.length, totalPedido]); // eslint-disable-line react-hooks/exhaustive-deps

  const agregarPrenda = () => {
    const base = filas[0];
    const key = ++llave.current;
    setFilas(l => [...l, { texto: base?.texto ?? '', color: '', talla: '', genero: '', cantidad: 1, precio: 0, id_item: null, candidatos: base?.candidatos ?? [], key }]);
    setCantidades(c => ({ ...c, [key]: 1 }));
    setPrecios(p => ({ ...p, [key]: { valor: p[filas[0]?.key]?.valor ?? 0, manual: false } }));
  };
  const quitarPrenda = (key: number) => {
    setFilas(l => l.filter(p => p.key !== key));
    setElegidas(f => { const c = { ...f }; delete c[key]; return c; });
  };

  const subtotal = filas.reduce((t, f) => t + (precios[f.key]?.valor ?? 0) * (cantidades[f.key] ?? 1), 0);
  const listas = filas.filter(f => elegidas[f.key]).length;
  const catalogos = [...new Set(filas.map(f => elegidas[f.key]?.catalogo).filter(Boolean))] as string[];
  const generos = [...new Set(filas.map(f => elegidas[f.key]?.genero).filter(Boolean))] as string[];
  const tipos = [...new Set(filas.map(f => elegidas[f.key]?.tipo).filter(Boolean))] as string[];

  const confirmar = async () => {
    setAviso(null);
    if (!filas.length || filas.some(f => !elegidas[f.key])) { setAviso({ ok: false, t: 'Cada prenda necesita producto, color y talla del catálogo.' }); return; }
    if (filas.some(f => !(precios[f.key]?.valor > 0))) { setAviso({ ok: false, t: 'Cada prenda necesita su precio unitario.' }); return; }
    const prendas = filas.map(f => {
      const e = elegidas[f.key]!;
      return { id_item: e.id_item, color: e.color, talla: e.talla, cantidad: cantidades[f.key] ?? 1, precio: precios[f.key].valor, foto: e.foto, notas: e.notas };
    });
    setGuardando(true);
    try {
      const r = await fetch('/api/ventas-vendedores/desde-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conv, forzar, datos, prendas }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) { setAviso({ ok: true, t: j.mensaje }); onListo?.(j.codigo); setTimeout(onCerrar, 1400); }
      else setAviso({ ok: false, t: j.mensaje || 'No se pudo', lista: j.errores });
    } finally { setGuardando(false); }
  };

  const Campo = ({ l, k, req, ph, full }: { l: string; k: string; req?: boolean; ph?: string; full?: boolean }) => (
    <div className={full ? 'col-span-2' : ''}>
      <label className={etq}>{l}{req && <span className="text-[#DC2626]"> *</span>}</label>
      <input className={input} value={datos[k] ?? ''} placeholder={ph ?? '—'} onChange={e => set(k, e.target.value)} />
    </div>
  );
  return (
    <div className="fixed inset-0 z-[80] pointer-events-none">
      {/* Minimizada: barra pequeña abajo a la derecha (los datos se conservan) */}
      {modoVentana === 'min' && (
        <div className="pointer-events-auto absolute bottom-4 right-4 flex items-center gap-2 bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,.25)] border border-[#E5E7EB] pl-3 pr-1.5 py-1.5">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: VERDE }}>📋</span>
          <button onClick={() => setModoVentana('normal')} className="text-[13px] font-bold text-[#0D0D0D] max-w-[260px] truncate" title="Abrir de nuevo">
            Confirmar datos{datos.cliente_nombre ? ` · ${datos.cliente_nombre}` : ''}
          </button>
          <button onClick={() => setModoVentana('normal')} className="w-8 h-8 rounded-lg hover:bg-[#F3F4F6]" title="Restaurar">▢</button>
          <button onClick={onCerrar} className="w-8 h-8 rounded-lg hover:bg-[#FEE2E2]" title="Cerrar">✕</button>
        </div>
      )}
      <div className={`pointer-events-auto absolute bg-white shadow-[0_24px_80px_rgba(0,0,0,.30)] border border-[#E5E7EB] flex flex-col overflow-hidden ${modoVentana === 'max' ? 'rounded-2xl' : 'rounded-3xl'} ${modoVentana === 'min' ? 'hidden' : ''}`}
        style={estiloVentana}>
        {/* Bordes para cambiar el tamaño */}
        {modoVentana === 'normal' && <>
          <div onPointerDown={empezarGesto('e')} className="absolute top-3 bottom-3 right-0 w-2 cursor-ew-resize z-20" />
          <div onPointerDown={empezarGesto('w')} className="absolute top-3 bottom-3 left-0 w-2 cursor-ew-resize z-20" />
          <div onPointerDown={empezarGesto('s')} className="absolute left-3 right-3 bottom-0 h-2 cursor-ns-resize z-20" />
          <div onPointerDown={empezarGesto('n')} className="absolute left-3 right-3 top-0 h-1.5 cursor-ns-resize z-20" />
          <div onPointerDown={empezarGesto('se')} className="absolute right-0 bottom-0 w-5 h-5 cursor-nwse-resize z-30 flex items-end justify-end p-1" title="Arrastra para cambiar el tamaño">
            <svg width="10" height="10" viewBox="0 0 10 10" className="text-[#9CA3AF]"><path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <div onPointerDown={empezarGesto('sw')} className="absolute left-0 bottom-0 w-4 h-4 cursor-nesw-resize z-30" />
          <div onPointerDown={empezarGesto('ne')} className="absolute right-0 top-0 w-4 h-4 cursor-nesw-resize z-30" />
          <div onPointerDown={empezarGesto('nw')} className="absolute left-0 top-0 w-4 h-4 cursor-nwse-resize z-30" />
        </>}
        <header onPointerDown={empezarGesto('mover')} onDoubleClick={() => setModoVentana(m => (m === 'max' ? 'normal' : 'max'))}
          className={`flex items-start gap-3 px-6 pt-5 pb-3 select-none ${modoVentana === 'normal' ? 'cursor-move' : ''}`}
          title="Arrastra para mover · doble clic para agrandar">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-[22px] shrink-0" style={{ background: VERDE }}>📋</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[22px] font-extrabold text-[#0D0D0D] leading-tight">Confirmar datos antes de pasar al panel</h2>
            <p className="text-[14px] text-[#6B7280]">Revisa, edita y valida la información del pedido antes de enviarlo al panel de Effi.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setModoVentana('min')} className="w-10 h-10 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[18px] leading-none" title="Minimizar (los datos se conservan)" aria-label="Minimizar">–</button>
            <button onClick={() => { if (modoVentana === 'max') setModoVentana('normal'); else setModoVentana('max'); }} className="w-10 h-10 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[15px]" title={modoVentana === 'max' ? 'Restaurar tamaño' : 'Pantalla completa'} aria-label="Maximizar">{modoVentana === 'max' ? '❐' : '▢'}</button>
            {modoVentana === 'normal' && <button onClick={centrar} className="w-10 h-10 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[15px]" title="Centrar ventana" aria-label="Centrar">⌖</button>}
            <button onClick={onCerrar} className="w-10 h-10 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[18px]" aria-label="Cerrar">✕</button>
          </div>
        </header>
        <div className="mx-6 mb-3 rounded-xl px-4 py-2.5 flex items-center gap-3 text-[13.5px] flex-wrap" style={{ background: '#E6F5F2' }}>
          <span className="font-bold" style={{ color: VERDE }}>⚡ Datos detectados en vivo desde el chat</span>
          <span className="text-[#9CA3AF]">|</span>
          <span className="italic text-[#4B5563]">Puedes corregir cualquier dato antes de continuar.</span>
          {vendedor && <span className="ml-auto text-[12.5px] text-[#374151]">Vendedor en Effi: <b>{vendedor}</b></span>}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {cargando ? (
            <div className="grid grid-cols-2 gap-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-[#F3F4F6] animate-pulse" />)}</div>
          ) : errorCarga ? (
            <div className="rounded-xl bg-[#FEE2E2] text-[#B91C1C] px-4 py-3 text-[14px]">{errorCarga}</div>
          ) : (
            <div className="space-y-4">
              {existente && (
                <div className="rounded-xl bg-[#FEF3C7] text-[#92400E] px-4 py-2.5 text-[13px] flex items-center gap-3 flex-wrap">
                  <span>⚠️ Este chat ya tiene la preventa <b>{existente.codigo}</b> ({existente.estado}{existente.effi_remision ? ` · remisión ${existente.effi_remision}` : ''}).</span>
                  <label className="flex items-center gap-1.5 font-semibold"><input type="checkbox" checked={forzar} onChange={e => setForzar(e.target.checked)} /> Es otra compra: crear otra</label>
                </div>
              )}

              {/* Arriba: cliente y dirección */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Tarjeta icono="👤" titulo="Datos del cliente">
                  <div className="grid grid-cols-2 gap-3">
                    {Campo({ l: 'Nombre', k: 'cliente_nombre', req: true })}
                    {Campo({ l: 'Celular', k: 'cliente_celular', req: true })}
                    {Campo({ l: 'Identificación', k: 'cliente_identificacion', ph: 'Ej. 1045678901 (vacío = celular)' })}
                    {Campo({ l: 'Correo', k: 'cliente_correo', ph: 'Gerenciaquin7@gmail.com' })}
                    <div>
                      <label className={etq}>Tipo de pago</label>
                      <select className={input} value={datos.tipo_pago ?? 'contraentrega'} onChange={e => set('tipo_pago', e.target.value)}>
                        <option value="contraentrega">Contraentrega</option>
                        <option value="contado">Pagado completo</option>
                      </select>
                    </div>
                    {Campo({ l: 'Abono recibido', k: 'abono', ph: '0' })}
                  </div>
                </Tarjeta>
                <Tarjeta icono="📍" titulo="Dirección de envío">
                  <div className="grid grid-cols-2 gap-3">
                    {Campo({ l: 'Departamento', k: 'departamento', req: true })}
                    {Campo({ l: 'Municipio', k: 'municipio', req: true })}
                    {Campo({ l: 'Dirección', k: 'direccion', req: true })}
                    {Campo({ l: 'Barrio', k: 'barrio' })}
                    {Campo({ l: 'Complemento', k: 'complemento', ph: 'Apto, torre, casa…' })}
                    {Campo({ l: 'Referencia', k: 'referencia_dir' })}
                    <div>
                      <label className={etq}>Transportadora</label>
                      <select className={input} value={datos.transportadora ?? ''} onChange={e => set('transportadora', e.target.value)}>
                        {TRANSPORTADORAS.map(t => <option key={t} value={t}>{t || '🚚 Automática por ciudad'}</option>)}
                      </select>
                    </div>
                  </div>
                </Tarjeta>
              </div>

              {/* Centro: prendas · Derecha: resumen */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-4 items-start">
                <div className="space-y-3">
                  <Tarjeta icono="👕" titulo={<>Prendas del pedido <span style={{ color: VERDE }}>({filas.length})</span></>}
                    accion={<button onClick={agregarPrenda} className="h-8 px-3 rounded-lg border text-[12px] font-bold" style={{ borderColor: VERDE, color: VERDE }}>+ Agregar prenda</button>}>
                    <div className="space-y-3">
                      {filas.map((f, i) => (
                        <TarjetaPrenda key={f.key} n={i + 1} inicial={f} fotoChat={fotoChat}
                          cantidad={cantidades[f.key] ?? 1} precio={precios[f.key]?.valor ?? 0}
                          onCantidad={c => setCantidades(prev => ({ ...prev, [f.key]: c }))}
                          onPrecio={p => setPrecios(prev => ({ ...prev, [f.key]: { valor: p, manual: true } }))}
                          onCambio={e => setElegidas(prev => ({ ...prev, [f.key]: e }))}
                          onQuitar={filas.length > 1 ? () => quitarPrenda(f.key) : undefined} />
                      ))}
                    </div>
                  </Tarjeta>
                  <div>
                    <label className="flex items-center gap-2 text-[14px] font-bold text-[#0D0D0D] mb-1.5">🧾 Observaciones del pedido</label>
                    <input className={input} value={datos.observaciones ?? ''} placeholder="Ej. Retirar en oficina Interrapidísimo." onChange={e => set('observaciones', e.target.value)} />
                  </div>
                </div>

                <div className="space-y-3 lg:sticky lg:top-0">
                  <section className="rounded-2xl border border-[#E5E7EB] bg-[#F7FBFA] p-4">
                    <h3 className="flex items-center gap-2 text-[15px] font-bold mb-3">🛒 Resumen del pedido</h3>
                    <dl className="space-y-1.5 text-[13.5px]">
                      <div className="flex justify-between"><dt className="text-[#4B5563]">Total prendas:</dt><dd className="font-bold">{unidades}</dd></div>
                      <div className="flex justify-between"><dt className="text-[#4B5563]">Subtotal:</dt><dd className="font-bold">{pesos(subtotal)}</dd></div>
                      <div className="flex justify-between"><dt className="text-[#4B5563]">Envío:</dt><dd className="font-bold">$0</dd></div>
                    </dl>
                    <div className="mt-3 rounded-xl px-3 py-2.5 flex justify-between items-center text-white" style={{ background: VERDE }}>
                      <span className="font-bold text-[14px]">Total a pagar:</span><span className="font-black text-[20px]">{pesos(subtotal)}</span>
                    </div>
                    {totalPedido > 0 && Math.round(subtotal) !== Math.round(totalPedido) && (
                      <p className="mt-2 text-[11.5px] text-[#B45309]">El pedido del chat era {pesos(totalPedido)}.</p>
                    )}
                  </section>
                  <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                    <h3 className="flex items-center gap-2 text-[14px] font-bold mb-2">🏷️ Datos del catálogo KLIXMANT</h3>
                    <dl className="divide-y divide-[#F1F1F1] text-[12.5px]">
                      <div className="flex justify-between gap-2 py-1.5"><dt className="text-[#4B5563]">Catálogo:</dt><dd className="font-semibold text-right">{catalogos.join(', ') || '—'}</dd></div>
                      <div className="flex justify-between gap-2 py-1.5"><dt className="text-[#4B5563]">Género:</dt><dd className="font-semibold text-right">{generos.join(', ') || '—'}</dd></div>
                      <div className="flex justify-between gap-2 py-1.5"><dt className="text-[#4B5563]">Tipo:</dt><dd className="font-semibold text-right">{tipos.join(', ') || '—'}</dd></div>
                      <div className="flex justify-between gap-2 py-1.5"><dt className="text-[#4B5563]">Variantes:</dt><dd className="font-semibold">{listas} de {filas.length} {listas === filas.length && filas.length ? '✅' : '⚠️'}</dd></div>
                    </dl>
                  </section>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-[#F1F1F1] flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] text-[13px]">
            {aviso && (
              <div className={aviso.ok ? 'text-[#15803D] font-semibold' : 'text-[#B91C1C]'}>
                {aviso.ok ? '✅ ' : '✖ '}{aviso.t}
                {aviso.lista?.length ? <ul className="list-disc ml-5">{aviso.lista.map((e, i) => <li key={i}>{e}</li>)}</ul> : null}
              </div>
            )}
          </div>
          <button onClick={onCerrar} className="h-11 px-5 rounded-xl border border-[#D1D5DB] text-[14px] font-semibold hover:bg-[#F9FAFB]">Cancelar</button>
          <button disabled={guardando || cargando || !!errorCarga || (!!existente && !forzar)} onClick={confirmar}
            className="h-11 px-5 rounded-xl text-white text-[14px] font-bold disabled:opacity-50 flex items-center gap-2" style={{ background: VERDE }}>
            {guardando ? 'Guardando…' : '→ Confirmar y pasar al panel'}
          </button>
        </footer>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import ConfirmacionModal from './ConfirmacionModal';

/* ══════════════════════════════════════════════════════════════════════════
   CATÁLOGOS CON VARIABLES
   4 pestañas: Productos · Categorías · Variables · Papelera.
   El bot sigue leyendo catalogos_bot + catalogo_colores igual que siempre;
   este panel solo agrega estructura encima (aditivo).
   ══════════════════════════════════════════════════════════════════════════ */

// ── Tipos ──
interface Opt { nm: string; hex?: string }
interface Variable { id: string; nombre: string; icono: string; con_color: boolean; no_repite: boolean; opciones: Opt[]; orden?: number }
interface Categoria { id: string; nombre: string; columnas: string[] }
interface Col { id: string; vid: string; uniq: boolean; vals: Opt[] }
// stockPol: qué pasa cuando esa variante llega a 0.
//   'bloquear' = no se puede elegir para la venta · 'seguir' = se sigue vendiendo.
type StockPol = 'bloquear' | 'seguir';
// Etiqueta de la política de stock: una sola fuente de verdad para tabla, popover y ajustes.
const POL_LABEL: Record<StockPol, string> = { bloquear: '🚫 No dejar vender', seguir: '✅ Seguir vendiendo' };
// stockTallas: unidades por cada valor de la variable "contar por" (ej. { S: 50, M: 25 }).
//   Si existe, el stock total (stock) es la suma. Si no, stock es un número único.
interface Row { id: string; img: string | null; v: Record<string, string[]>; stock?: number | null; stockPol?: StockPol; stockTallas?: Record<string, number> }
interface Ad { id: string; ts: number | null }
interface Producto {
  dbId: string | null; id: string;
  nm: string; pat: string; patAuto: boolean; catId: string;
  m1: string; m2: string; ads: Ad[]; fotos: string[];
  cols: Col[]; rows: Row[]; o1: boolean; o2: boolean; o3: boolean;
  // Control de stock (opcional). Si stockOn=false → ilimitado, se vende todo.
  //   stockVid = id de la columna por la que se cuentan las unidades (ej. Talla).
  //   null/undefined = stock total por variante (un solo número).
  stockOn?: boolean; stockAviso?: number | null; stockVid?: string | null;
}

/** ¿Es la variable especial "Stock"? (numérica por variante, no una lista de opciones) */
const esStockVar = (v?: { nombre?: string } | null): boolean => !!v && /^stock$/i.test((v.nombre ?? '').trim());
/** Lee el default de la variable Stock guardado en sus opciones: [{nm:pol},{nm:umbral}]. */
function defaultsDeStock(v?: Variable | null): { pol: StockPol; aviso: number } {
  const o = v?.opciones ?? [];
  const pol: StockPol = o[0]?.nm === 'seguir' ? 'seguir' : 'bloquear';
  const aviso = Math.max(0, Math.round(Number(o[1]?.nm) || 0));
  return { pol, aviso };
}

const PACKS: Record<string, string[]> = {
  'Ropa adulto (S–XXXL)': ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  'Ropa niño (2–16)': ['2', '4', '6', '8', '10', '12', '14', '16'],
  'Calzado Colombia (34–44)': ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
  'Numérica jean (28–42)': ['28', '30', '32', '34', '36', '38', '40', '42'],
  'Talla única': ['ÚNICA'],
};
const TPL_CATS = ['Ropa', 'Calzado', 'Alimentos y bebidas', 'Belleza', 'Tecnología', 'Hogar'];

// Las 11 variables por defecto (iguales a la maqueta). El servidor también las
// siembra; esto es respaldo del cliente para que la pestaña NUNCA se vea vacía.
const PAL_DEF: [string, string][] = [
  ['Blanco', '#FFFFFF'], ['Blanco marfil', '#F3EDE2'], ['Beige', '#D9C7A7'], ['Negro', '#111111'],
  ['Gris', '#9AA0A6'], ['Rojo', '#C8102E'], ['Amarillo', '#F5C518'], ['Azul', '#1B4FA0'], ['Azul oscuro', '#16233F'],
  ['Verde', '#1E9E5A'], ['Verde oscuro', '#14532D'], ['Marrón', '#6B4423'], ['Naranja', '#F26A21'],
  ['Rosa', '#F2A0BC'], ['Morado', '#6B3FA0'], ['Lila', '#B9A3E3'],
];
const opsDef = (a: string[]): Opt[] => a.map(n => ({ nm: n }));
const DEFAULT_VARS: Omit<Variable, 'id'>[] = [
  { nombre: 'Color',        icono: '🎨', con_color: true,  no_repite: true,  opciones: PAL_DEF.map(p => ({ nm: p[0], hex: p[1] })) },
  { nombre: 'Talla',        icono: '📏', con_color: false, no_repite: false, opciones: opsDef(['S', 'M', 'L', 'XL', 'XXL', 'XXXL']) },
  { nombre: 'Género',       icono: '👥', con_color: false, no_repite: false, opciones: opsDef(['Hombre', 'Mujer', 'Unisex', 'Niño', 'Niña']) },
  { nombre: 'Sabor',        icono: '🍬', con_color: false, no_repite: false, opciones: opsDef(['Fresa', 'Vainilla', 'Chocolate', 'Maracuyá']) },
  { nombre: 'Material',     icono: '🧵', con_color: false, no_repite: false, opciones: opsDef(['Algodón', 'Poliéster', 'Cuero', 'Lino']) },
  { nombre: 'Presentación', icono: '🧴', con_color: false, no_repite: false, opciones: opsDef(['250 ml', '500 ml', '1 L']) },
  { nombre: 'Peso',         icono: '⚖️', con_color: false, no_repite: false, opciones: opsDef(['250 g', '500 g', '1 kg']) },
  { nombre: 'Capacidad',    icono: '💾', con_color: false, no_repite: false, opciones: opsDef(['64 GB', '128 GB', '256 GB', '512 GB']) },
  { nombre: 'Aroma',        icono: '🌸', con_color: false, no_repite: false, opciones: opsDef(['Floral', 'Cítrico', 'Amaderado', 'Dulce']) },
  { nombre: 'Modelo',       icono: '🏷️', con_color: false, no_repite: false, opciones: opsDef(['2025', '2026']) },
  { nombre: 'Empaque',      icono: '📦', con_color: false, no_repite: false, opciones: opsDef(['Bolsa', 'Frasco', 'Caja']) },
  // Stock: variable ESPECIAL (casilla numérica por variante). Sus "opciones" guardan
  // el default: [{nm:'bloquear'|'seguir'} (al llegar a 0), {nm: umbral de aviso}].
  { nombre: 'Stock',        icono: '🧮', con_color: false, no_repite: false, opciones: [{ nm: 'bloquear' }, { nm: '0' }] },
];

let SEQ = 100;
const uid = () => 'i' + (++SEQ);

function fmtFecha(ts: number | string) {
  try {
    return new Date(ts).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

export default function CatalogosPanel() {
  const [tab, setTab] = useState<'prod' | 'cats' | 'vars' | 'pap'>('prod');
  const [vars, setVars] = useState<Variable[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [prods, setProds] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sqlPendiente, setSqlPendiente] = useState(false); // falta correr la migración
  const sembradoRef = useRef(false);
  const stockSeedRef = useRef(false);

  // Drafts (edición en curso)
  const [draft, setDraft] = useState<Producto | null>(null);
  const [dcat, setDcat] = useState<Categoria | null>(null);
  const [dvar, setDvar] = useState<Variable | null>(null);
  const [sel, setSel] = useState<Record<string, boolean>>({});

  // Filtros de productos
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [qid, setQid] = useState('');

  // Popover flotante (celda / encabezado de columna / nueva columna)
  const [drop, setDrop] = useState<string | null>(null);
  const [tmp, setTmp] = useState<any>(null);
  const [dropStyle, setDropStyle] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const V = useCallback((id: string): Variable => vars.find(v => v.id === id) || { id, nombre: '?', icono: '❓', con_color: false, no_repite: false, opciones: [] }, [vars]);
  const colorVar = vars.find(v => v.con_color) || vars.find(v => /color/i.test(v.nombre));

  // ── Carga inicial ──
  const mapVars = (rv: any): Variable[] => (Array.isArray(rv) ? rv : []).map((v: any) => ({
    id: String(v.id), nombre: v.nombre ?? '', icono: v.icono ?? '✨',
    con_color: !!v.con_color, no_repite: !!v.no_repite,
    opciones: Array.isArray(v.opciones) ? v.opciones : [], orden: v.orden ?? 0,
  }));
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [rv, rc, rp] = await Promise.all([
        fetch('/api/catalogos/variables', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
        fetch('/api/catalogos/categorias', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
        fetch('/api/catalogos', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
      ]);
      let vlist = mapVars(rv);

      // Si vienen vacías, intentar sembrar las 11 por defecto (una sola vez).
      if (!vlist.length && !sembradoRef.current) {
        sembradoRef.current = true;
        await Promise.all(DEFAULT_VARS.map(v =>
          fetch('/api/catalogos/variables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) }).catch(() => {})
        ));
        const rv2 = await fetch('/api/catalogos/variables', { cache: 'no-store' }).then(r => r.json()).catch(() => []);
        vlist = mapVars(rv2);
      }

      // Migración suave: si ya hay variables pero falta la de Stock (tenants viejos),
      // se siembra una sola vez para que aparezca en la biblioteca.
      if (vlist.length && !vlist.some(esStockVar) && !stockSeedRef.current) {
        stockSeedRef.current = true;
        const stockDef = DEFAULT_VARS.find(v => esStockVar(v));
        if (stockDef) {
          await fetch('/api/catalogos/variables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stockDef) }).catch(() => {});
          const rv3 = await fetch('/api/catalogos/variables', { cache: 'no-store' }).then(r => r.json()).catch(() => []);
          const vlist3 = mapVars(rv3);
          if (vlist3.some(esStockVar)) vlist = vlist3;
        }
      }

      // Si AÚN están vacías, es que falta la migración SQL: se muestran las 11
      // localmente (con id temporal) para que la pestaña no quede vacía, y se avisa.
      if (!vlist.length) {
        vlist = DEFAULT_VARS.map((v, i) => ({ id: 'def-' + i, ...v, orden: i }));
        setSqlPendiente(true);
      } else {
        setSqlPendiente(false);
      }

      const clist: Categoria[] = (Array.isArray(rc) ? rc : []).map((c: any) => ({
        id: String(c.id), nombre: c.nombre ?? '', columnas: Array.isArray(c.columnas) ? c.columnas.map(String) : [],
      }));
      setVars(vlist); setCats(clist);
      setProds(mapProductos(Array.isArray(rp) ? rp : [], vlist));
    } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  /** Convierte las filas de catalogos_bot (con sus colores) al modelo del editor. */
  function mapProductos(raw: any[], vlist: Variable[]): Producto[] {
    const cvar = vlist.find(v => v.con_color) || vlist.find(v => /color/i.test(v.nombre));
    return raw.map((c: any) => {
      const anunciosArr = String(c.anuncios ?? '').split(/[,\s]+/).map((s: string) => s.trim()).filter(Boolean);
      const fechas = (c.anuncios_fechas && typeof c.anuncios_fechas === 'object') ? c.anuncios_fechas : {};
      const ads: Ad[] = anunciosArr.map((id: string) => {
        const f = fechas[id]; const t = f ? Date.parse(f) : NaN;
        return { id, ts: isNaN(t) ? null : t };
      });

      // Columnas: guardadas, o sintetizadas (Color) para catálogos viejos.
      let cols: Col[] = [];
      const guardadas = Array.isArray(c.columnas) ? c.columnas : [];
      if (guardadas.length) {
        // La variable especial "Stock" nunca es una columna de datos: se dibuja
        // en su propia columna dedicada. Se descarta de las columnas guardadas
        // (catálogos viejos podían haberla dejado ahí y salía duplicada).
        cols = guardadas
          .map((cc: any) => ({ id: uid(), vid: String(cc.vid), uniq: !!cc.uniq, vals: Array.isArray(cc.vals) ? cc.vals : [] }))
          .filter((col: Col) => !esStockVar(vlist.find(v => v.id === col.vid)));
      } else if (cvar) {
        // Producto migrado: una columna Color con los colores que ya tienen las fotos.
        const usados = (c.catalogo_colores || []).map((x: any) => String(x.color ?? '').trim()).filter(Boolean);
        const opts: Opt[] = [];
        const push = (o: Opt) => { if (o.nm && !opts.some(x => x.nm === o.nm)) opts.push(o); };
        cvar.opciones.forEach(push);
        usados.forEach((nm: string) => push({ nm }));
        cols = [{ id: uid(), vid: cvar.id, uniq: true, vals: opts }];
      }

      const colores = [...(c.catalogo_colores || [])].sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0));
      const rows: Row[] = colores.map((cv: any) => {
        const v: Record<string, string[]> = {};
        const variante = (cv.variante && typeof cv.variante === 'object') ? cv.variante : null;
        cols.forEach(col => {
          if (variante && Array.isArray(variante[col.vid])) v[col.id] = variante[col.vid].slice();
          else if (cvar && col.vid === cvar.id) v[col.id] = cv.color ? [String(cv.color)] : [];
          else v[col.id] = [];
        });
        const stockPol: StockPol | undefined = cv.stock_politica === 'seguir' ? 'seguir' : (cv.stock_politica === 'bloquear' ? 'bloquear' : undefined);
        const stockTallas: Record<string, number> | undefined = (cv.stock_tallas && typeof cv.stock_tallas === 'object' && !Array.isArray(cv.stock_tallas))
          ? Object.fromEntries(Object.entries(cv.stock_tallas).map(([k, val]) => [k, Math.max(0, Math.round(Number(val) || 0))])) : undefined;
        return { id: uid(), img: cv.url_imagen ?? null, v, stock: typeof cv.stock === 'number' ? cv.stock : null, stockPol, stockTallas };
      });

      const nm = c.familia ?? '';
      const pat = c.patron ?? '';
      return {
        dbId: String(c.id), id: String(c.id),
        nm, pat, patAuto: pat === String(nm).toUpperCase(),
        catId: c.categoria_id ? String(c.categoria_id) : '',
        m1: c.mensaje_bienvenida ?? '', m2: c.llamado_accion ?? '',
        ads, fotos: Array.isArray(c.fotos_portada) ? c.fotos_portada : [],
        cols, rows, o1: true, o2: false, o3: false,
        stockOn: !!c.stock_activo, stockAviso: typeof c.stock_aviso === 'number' ? c.stock_aviso : null,
        stockVid: c.stock_vid ? String(c.stock_vid) : null,
      };
    });
  }

  // ── Popover: posicionar como fijo (para no cortarse dentro de la tabla) ──
  const reposicionar = useCallback(() => {
    const t = triggerRef.current, p = popRef.current;
    if (!t || !p) return;
    const r = t.getBoundingClientRect();
    const w = p.offsetWidth || 252, h = p.offsetHeight;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 12));
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    setDropStyle({ left, top });
  }, []);
  useLayoutEffect(() => { if (drop) reposicionar(); }, [drop, tmp, reposicionar]);
  useEffect(() => {
    if (!drop) return;
    const onMove = () => reposicionar();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    const onDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      cerrarDrop();
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('mousedown', onDown);
    };
  }, [drop, reposicionar]);

  function cerrarDrop() { setDrop(null); setTmp(null); triggerRef.current = null; setDropStyle(null); }

  // ── Helpers de columnas/celdas ──
  const findC = (id: string) => draft?.cols.find(c => c.id === id);
  const findR = (id: string) => draft?.rows.find(r => r.id === id);
  const mkCol = (vid: string): Col => { const v = V(vid); return { id: uid(), vid, uniq: !!v.no_repite, vals: v.con_color ? [] : v.opciones.map(o => ({ nm: o.nm, hex: o.hex })) }; };
  const mkRow = (img?: string | null): Row => ({ id: uid(), img: img || null, v: {} });

  function nuevoDraft(catId: string): Producto {
    const d: Producto = { dbId: null, id: uid(), nm: '', pat: '', patAuto: true, catId: catId || '', m1: '', m2: '', ads: [], fotos: [], cols: [], rows: [], o1: true, o2: true, o3: false };
    if (catId) { const c = cats.find(x => x.id === catId); if (c) c.columnas.forEach(k => d.cols.push(mkCol(k))); }
    return d;
  }
  function seedColsRopa(): Col[] {
    const nombres = ['Color', 'Talla', 'Género'];
    const ids = nombres.map(n => vars.find(v => v.nombre === n)?.id).filter(Boolean) as string[];
    return (ids.length ? ids : (colorVar ? [colorVar.id] : [])).map(mkCol);
  }

  // ── Subir fotos (a Storage, guardando la URL) ──
  async function subirFotos(files: FileList | File[]): Promise<string[]> {
    const arr = Array.from(files).slice(0, 20);
    if (!arr.length) return [];
    setSubiendo(true);
    const urls: string[] = [];
    try {
      for (const f of arr) {
        const fd = new FormData(); fd.append('file', f);
        try { const r = await fetch('/api/catalogos/upload-imagen', { method: 'POST', body: fd }); const d = await r.json(); if (d?.url) urls.push(d.url); } catch { /* ignora */ }
      }
    } finally { setSubiendo(false); }
    return urls;
  }

  // ── Guardar producto (POST /api/catalogos/producto) ──
  async function guardarProducto() {
    if (!draft) return;
    if (!draft.nm.trim()) { alert('Ponle un nombre al producto.'); return; }
    const colorCol = draft.cols.find(c => V(c.vid).con_color) || draft.cols.find(c => /color/i.test(V(c.vid).nombre));
    // Columna por la que se cuentan las unidades (ej. Talla), si está elegida.
    const scol = (draft.stockOn && draft.stockVid) ? draft.cols.find(c => c.vid === draft.stockVid) : null;
    const payload = {
      dbId: draft.dbId,
      nm: draft.nm.trim(), pat: (draft.pat || draft.nm).trim(), catId: draft.catId || null,
      m1: draft.m1, m2: draft.m2,
      ads: draft.ads.filter(a => a.id.trim()).map(a => ({ id: a.id.trim(), ts: a.ts })),
      fotos: draft.fotos,
      cols: draft.cols.map(c => ({ vid: c.vid, uniq: c.uniq, vals: c.vals })),
      // Control de stock del producto (si no está activo → ilimitado, se vende todo).
      stockOn: !!draft.stockOn,
      stockAviso: draft.stockOn ? (draft.stockAviso ?? null) : null,
      stockVid: (draft.stockOn && draft.stockVid) ? draft.stockVid : null,
      rows: draft.rows.map(r => {
        const color = colorCol ? (r.v[colorCol.id]?.[0] || '') : '';
        const nombre_producto = (color ? `${color} ${draft.nm}` : draft.nm).trim().toUpperCase();
        const variante: Record<string, string[]> = {};
        draft.cols.forEach(c => { variante[c.vid] = r.v[c.id] || []; });
        // Solo se guarda stock/política si el control está activo.
        let stock = draft.stockOn ? (r.stock ?? null) : null;
        let stock_tallas: Record<string, number> | null = null;
        if (scol) {
          // Stock por talla: se limpia a las tallas que la fila tiene elegidas.
          const vals = r.v[scol.id] || [];
          const st = r.stockTallas || {};
          const map: Record<string, number> = {};
          vals.forEach(v => { if (typeof st[v] === 'number') map[v] = Math.max(0, Math.round(st[v])); });
          if (Object.keys(map).length) { stock_tallas = map; stock = Object.values(map).reduce((a, b) => a + b, 0); }
        }
        const stock_politica = draft.stockOn ? (r.stockPol ?? 'bloquear') : null;
        return { img: r.img, color, nombre_producto, variante, stock, stock_politica, stock_tallas };
      }),
    };
    setGuardando(true);
    try {
      const res = await fetch('/api/catalogos/producto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setAviso(`❌ ${data.error ?? 'No se pudo guardar'}`); return; }
      setDraft(null); setSel({}); cerrarDrop();
      setAviso('✅ Producto guardado.');
      await cargar();
    } finally { setGuardando(false); }
  }

  // ── Eliminar / restaurar producto ──
  async function eliminarProducto(p: Producto, definitivo = false) {
    if (!p.dbId) { setProds(ps => ps.filter(x => x.id !== p.id)); return; }
    await fetch(`/api/catalogos/${p.dbId}${definitivo ? '?definitivo=1' : ''}`, { method: 'DELETE' });
    await cargar();
  }
  async function restaurarProducto(dbId: string) { await fetch(`/api/catalogos/${dbId}`, { method: 'PATCH' }); await cargar(); }

  function duplicarProducto(p: Producto, nombre: string) {
    // Clona todo menos el ID de campaña; el patrón sigue el nombre nuevo.
    const clon: Producto = JSON.parse(JSON.stringify(p));
    clon.dbId = null; clon.id = uid(); clon.nm = nombre; clon.ads = [];
    if (clon.patAuto !== false) clon.pat = (nombre || '').toUpperCase();
    const map: Record<string, string> = {};
    clon.cols.forEach(c => { const o = c.id; c.id = uid(); map[o] = c.id; });
    clon.rows.forEach(r => { r.id = uid(); const nv: Record<string, string[]> = {}; Object.keys(r.v).forEach(k => { if (map[k]) nv[map[k]] = r.v[k].slice(); }); r.v = nv; });
    setDraft(clon); setSel({}); setTab('prod');
  }

  // ── Variables ──
  async function guardarVariable() {
    if (!dvar) return;
    if (!dvar.nombre.trim()) { alert('Ponle un nombre a la variable.'); return; }
    const body = { nombre: dvar.nombre.trim(), icono: dvar.icono || '✨', con_color: dvar.con_color, no_repite: dvar.no_repite, opciones: dvar.opciones.filter(o => o.nm.trim()) };
    const nueva = !vars.some(v => v.id === dvar.id);
    setGuardando(true);
    try {
      const res = nueva
        ? await fetch('/api/catalogos/variables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch(`/api/catalogos/variables/${dvar.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setAviso(`❌ ${d.error ?? 'Error'}`); return; }
      setDvar(null); await cargar();
    } finally { setGuardando(false); }
  }
  async function duplicarVariable(v: Variable, nombre: string) {
    const body = { nombre, icono: v.icono, con_color: v.con_color, no_repite: v.no_repite, opciones: v.opciones };
    await fetch('/api/catalogos/variables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await cargar();
  }
  async function eliminarVariable(id: string, definitivo = false) { await fetch(`/api/catalogos/variables/${id}${definitivo ? '?definitivo=1' : ''}`, { method: 'DELETE' }); await cargar(); }
  async function restaurarVariable(id: string) { await fetch(`/api/catalogos/variables/${id}`, { method: 'PATCH' }); await cargar(); }

  // ── Categorías ──
  async function guardarCategoria() {
    if (!dcat) return;
    if (!dcat.nombre.trim()) { alert('Ponle un nombre a la categoría.'); return; }
    const body = { nombre: dcat.nombre.trim(), columnas: dcat.columnas };
    const nueva = !cats.some(c => c.id === dcat.id);
    setGuardando(true);
    try {
      const res = nueva
        ? await fetch('/api/catalogos/categorias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch(`/api/catalogos/categorias/${dcat.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setAviso(`❌ ${d.error ?? 'Error'}`); return; }
      setDcat(null); await cargar();
    } finally { setGuardando(false); }
  }
  async function duplicarCategoria(c: Categoria, nombre: string) {
    await fetch('/api/catalogos/categorias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, columnas: c.columnas }) });
    await cargar();
  }
  async function eliminarCategoria(id: string, definitivo = false) { await fetch(`/api/catalogos/categorias/${id}${definitivo ? '?definitivo=1' : ''}`, { method: 'DELETE' }); await cargar(); }
  async function restaurarCategoria(id: string) { await fetch(`/api/catalogos/categorias/${id}`, { method: 'PATCH' }); await cargar(); }

  // ── Modales ──
  const [modalNombre, setModalNombre] = useState<null | { titulo: string; sub?: string; valor: string; onOk: (v: string) => void }>(null);
  const [modalAds, setModalAds] = useState<null | { prod: Producto; ads: Ad[] }>(null);
  const [confirmar, setConfirmar] = useState<null | { titulo: string; mensaje?: string; onOk: () => void }>(null);

  const filtrados = prods.filter(p => {
    if (filter) { if (filter === '__none' ? p.catId : p.catId !== filter) return false; }
    if (q.trim() && !(p.nm || '').toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (qid.trim() && !p.ads.some(a => a.id.toLowerCase().includes(qid.trim().toLowerCase()))) return false;
    return true;
  });

  const teal = '#00A89D', tealDeep = '#00847A', wash = '#E9F7F5', line = '#E8E5DE', muted = '#8A9793', danger = '#C8102E';
  const btn = 'px-3.5 py-2 rounded-lg border text-[12.5px] font-semibold transition-colors';
  const chip = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F4F2EC] text-[11px] font-semibold text-[#42544F]';

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        {/* Encabezado */}
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-[#12211F]">📦 Catálogos</h1>
            <p className="text-xs text-[#8A9793] mt-1">{subtitulo(tab, prods.length)}</p>
          </div>
          <div className="ml-auto">
            {tab === 'prod' && !draft && <button onClick={() => setDraft(nuevoDraft(''))} className={`${btn} text-white`} style={{ background: teal, borderColor: teal }}>+ Nuevo producto</button>}
            {tab === 'cats' && !dcat && <button onClick={() => setDcat({ id: uid(), nombre: '', columnas: [] })} className={`${btn} text-white`} style={{ background: teal, borderColor: teal }}>+ Nueva categoría</button>}
            {tab === 'vars' && !dvar && <button onClick={() => setDvar({ id: uid(), nombre: '', icono: '✨', con_color: false, no_repite: false, opciones: [] })} className={`${btn} text-white`} style={{ background: teal, borderColor: teal }}>+ Nueva variable</button>}
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex gap-0.5 p-[3px] rounded-[10px] bg-[#F1EFE9] w-fit max-w-full overflow-x-auto mb-4">
          {([['prod', 'Productos'], ['cats', 'Categorías'], ['vars', 'Variables'], ['pap', '🗑 Papelera']] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setDraft(null); setDcat(null); setDvar(null); cerrarDrop(); }}
              className="px-4 py-2 rounded-lg text-[13px] font-bold whitespace-nowrap transition-colors"
              style={tab === k ? { background: teal, color: '#fff' } : { color: k === 'pap' ? '#B4BCB9' : muted, background: 'transparent' }}>
              {l}
            </button>
          ))}
        </div>

        {aviso && (
          <div className="mb-4 text-xs p-3 rounded-xl bg-white border flex items-center gap-2" style={{ borderColor: line }}>
            <span className="flex-1">{aviso}</span>
            <button onClick={() => setAviso(null)} className="text-[#8A9793] hover:text-[#12211F]">✕</button>
          </div>
        )}

        {sqlPendiente && (
          <div className="mb-4 text-xs p-3 rounded-xl border flex items-start gap-2" style={{ borderColor: '#F6D4A6', background: '#FFF6EA', color: '#8A5000' }}>
            <span>⚠️</span>
            <span className="flex-1">Estás viendo las <b>11 variables por defecto</b>, pero todavía <b>no se pueden guardar ni editar</b>. Para activarlas corre en Supabase la migración <b>sql/catalogos-modulo-variables.sql</b> y vuelve a entrar. (Crea las tablas de Variables y Categorías; es segura y no borra nada.)</span>
          </div>
        )}

        {cargando ? (
          <p className="text-sm text-[#8A9793] py-16 text-center">Cargando…</p>
        ) : (
          <>
            {/* Se llaman como FUNCIÓN (no como <Componente/>) para que el input NO
                pierda el foco en cada tecla (si no, React los re-monta en cada render). */}
            {tab === 'prod' && (draft ? EditorProducto() : ListaProductos())}
            {tab === 'cats' && (dcat ? EditorCategoria() : ListaCategorias())}
            {tab === 'vars' && (dvar ? EditorVariable() : ListaVariables())}
            {tab === 'pap' && <PapeleraContenido />}
          </>
        )}
      </div>

      {/* Popover flotante. Se dibuja apenas hay `drop` (aunque falte dropStyle):
          así el popover existe, se puede MEDIR y reposicionar. Mientras no tenga
          posición, va oculto (visibility) para que no parpadee mal ubicado. */}
      {drop && (
        <div ref={popRef} className="fixed z-[200] w-[252px] bg-white rounded-xl border p-1.5 shadow-2xl"
          style={{ left: dropStyle?.left ?? 8, top: dropStyle?.top ?? 8, visibility: dropStyle ? 'visible' : 'hidden', borderColor: line }}>
          {PopoverContenido()}
        </div>
      )}

      {/* Modal: nombre genérico (duplicar) */}
      {modalNombre && (
        <div className="fixed inset-0 z-[300] grid place-items-center bg-[rgba(11,27,26,.45)] p-5" onClick={() => setModalNombre(null)}>
          <div className="bg-white rounded-[15px] p-[22px] w-[min(420px,100%)] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h4 className="text-[15px] font-extrabold mb-1">{modalNombre.titulo}</h4>
            {modalNombre.sub && <p className="text-xs text-[#8A9793] mb-4">{modalNombre.sub}</p>}
            <input autoFocus defaultValue={modalNombre.valor} id="mn-inp"
              onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) { const f = modalNombre.onOk; setModalNombre(null); f(v); } } }}
              className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none" style={{ borderColor: line }} />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setModalNombre(null)} className={`${btn}`} style={{ borderColor: line }}>Cancelar</button>
              <button onClick={() => { const v = (document.getElementById('mn-inp') as HTMLInputElement)?.value.trim(); if (v) { const f = modalNombre.onOk; setModalNombre(null); f(v); } }}
                className={`${btn} text-white`} style={{ background: teal, borderColor: teal }}>Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ID de campaña */}
      {modalAds && ModalAds()}

      {/* Confirmación (eliminar) */}
      <ConfirmacionModal
        abierto={!!confirmar} peligro
        titulo={confirmar?.titulo ?? ''} mensaje={confirmar?.mensaje}
        textoAceptar="Sí, eliminar" textoCancelar="Cancelar"
        onAceptar={() => { const f = confirmar?.onOk; setConfirmar(null); f?.(); }}
        onCancelar={() => setConfirmar(null)}
      />
    </div>
  );

  // ══════════════════ SUB-RENDERS ══════════════════

  function subtitulo(t: string, n: number) {
    if (t === 'prod') return n ? `${n} producto${n > 1 ? 's' : ''} · las variantes bajan solas a los embudos.` : 'Tus productos y las variables que el cliente puede elegir.';
    if (t === 'cats') return 'Una categoría guarda las columnas típicas de un tipo de producto.';
    if (t === 'vars') return 'La lista maestra: cada variable con sus opciones. Se usa en todos los productos.';
    return 'Lo que borras queda aquí para restaurarlo o eliminarlo de verdad.';
  }

  function ListaProductos() {
    if (!prods.length) return (
      <div className="bg-white border border-dashed rounded-[14px] text-center" style={{ borderColor: line, padding: 52 }}>
        <div className="text-3xl opacity-50">📦</div>
        <h3 className="mt-3 mb-1 text-[15px] font-extrabold">Todavía no tienes productos</h3>
        <p className="text-[12.5px] text-[#8A9793] max-w-[46ch] mx-auto mb-4">Subes las fotos de tu producto y al frente de cada una eliges qué color, tallas y género tiene.</p>
        <button onClick={() => setDraft(nuevoDraft(''))} className={`${btn} text-white`} style={{ background: teal, borderColor: teal }}>+ Crear mi primer producto</button>
      </div>
    );
    const cnt = (id: string) => prods.filter(p => id === '__none' ? !p.catId : p.catId === id).length;
    const activo = filter || q || qid;
    return (
      <>
        <div className="flex gap-2 items-center flex-wrap mb-4">
          {cats.length > 0 && (
            <>
              <span>🗂</span>
              <select value={filter} onChange={e => setFilter(e.target.value)} className="min-w-[200px] px-3 py-2 rounded-lg border text-[12.5px] font-semibold" style={{ borderColor: line }}>
                <option value="">Categorías</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.nombre} · {cnt(c.id)}</option>)}
                {prods.some(p => !p.catId) && <option value="__none">Sin categoría · {cnt('__none')}</option>}
              </select>
            </>
          )}
          <span>🔎</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto por nombre" className="w-[212px] px-3 py-2 rounded-lg border text-[12.5px]" style={{ borderColor: line }} />
          <span>🎯</span>
          <input value={qid} onChange={e => setQid(e.target.value)} placeholder="Buscar por ID de campaña" className="w-[220px] px-3 py-2 rounded-lg border text-[11.5px] font-mono" style={{ borderColor: line }} />
          {activo ? <button onClick={() => { setFilter(''); setQ(''); setQid(''); }} className={`${btn} text-[11.5px] py-1.5`} style={{ borderColor: line }}>✕ Quitar filtros</button> : null}
          <span className="text-[11.5px] text-[#8A9793]">{filtrados.length} de {prods.length} producto{prods.length === 1 ? '' : 's'}</span>
        </div>

        {filtrados.length === 0 ? <p className="text-[12px] text-[#8A9793] px-1 py-5">Ningún producto coincide con lo que buscas.</p> : (
          <div className="space-y-2">
            {filtrados.map(p => {
              const c = cats.find(x => x.id === p.catId);
              // La PORTADA (fotos generales) manda; si no hay, cae a la foto de una variante.
              const img = p.fotos[0] || (p.rows.find(r => r.img)?.img);
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-white border rounded-xl flex-wrap" style={{ borderColor: line }}>
                  <span className="w-11 h-11 rounded-lg grid place-items-center text-lg overflow-hidden shrink-0" style={{ background: wash }}>
                    {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : '📦'}
                  </span>
                  <div className="min-w-0">
                    <b className="text-[13.5px] block truncate">{p.nm || 'Sin nombre'}</b>
                    <div className="text-[11.5px] text-[#8A9793]">{c ? `${c.nombre} · ` : ''}{p.rows.length} variante{p.rows.length === 1 ? '' : 's'} · patrón {p.pat || '—'}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => setModalAds({ prod: p, ads: p.ads.length ? p.ads.map(a => ({ ...a })) : [{ id: '', ts: null }] })}
                      className="rounded-full px-3 py-1.5 text-[11px] font-bold inline-flex items-center gap-1.5"
                      style={p.ads.length ? { background: teal, color: '#fff' } : { background: wash, color: tealDeep, border: '1px solid #BCE6E1' }}>
                      🎯 ID CAMPAÑA{p.ads.length ? <span className="rounded-full px-1.5 text-[10px]" style={{ background: '#04211F', color: '#8FE9E0' }}>{p.ads.length}</span> : null}
                    </button>
                    {p.cols.map(cl => <span key={cl.id} className={chip}>{V(cl.vid).icono} {V(cl.vid).nombre}</span>)}
                    <button onClick={() => { setDraft(JSON.parse(JSON.stringify(p))); setSel({}); }} className={`${btn} text-[11.5px] py-1.5`} style={{ borderColor: line }}>Editar</button>
                    <button onClick={() => setModalNombre({ titulo: 'Duplicar producto', sub: 'Se copia todo: categoría, columnas, colores, tallas, fotos y mensajes. El patrón se ajusta al nombre nuevo, y el ID de campaña no se copia.', valor: `${p.nm || 'Producto'} - Copia`, onOk: n => duplicarProducto(p, n) })} className={`${btn} text-[11.5px] py-1.5`} style={{ borderColor: line }}>⧉ Duplicar</button>
                    <button onClick={() => setConfirmar({ titulo: `¿Eliminar "${p.nm}"?`, mensaje: 'Se va a la papelera; puedes restaurarlo. El bot deja de ofrecerlo mientras esté eliminado.', onOk: () => eliminarProducto(p) })} className={`${btn} text-[11.5px] py-1.5`} style={{ color: danger, borderColor: 'transparent', background: 'transparent' }}>Eliminar</button>
                  </div>
                </div>
              );
            })}
            <button onClick={() => setDraft(nuevoDraft(''))} className="w-full border border-dashed rounded-[11px] p-3 font-bold text-[12.5px]" style={{ borderColor: line, color: teal }}>+ Añadir otro producto</button>
          </div>
        )}
      </>
    );
  }

  function EditorProducto() {
    const d = draft!;
    const setD = (patch: Partial<Producto>) => setDraft({ ...d, ...patch });
    const secH = (n: number, title: string, meta: string, open: boolean, onToggle: () => void, body: React.ReactNode) => (
      <div className="border-t first:border-t-0" style={{ borderColor: '#F2F0EA' }}>
        <div className="flex items-center gap-3 px-[18px] py-[15px] cursor-pointer select-none hover:bg-[#FCFBF8]" onClick={onToggle}>
          <span className="w-[22px] h-[22px] rounded-[7px] grid place-items-center text-[11px] font-mono" style={{ background: wash, color: tealDeep }}>{n}</span>
          <b className="text-[13.5px]">{title}</b><span className="text-[12px] text-[#8A9793]">· {meta}</span>
          <span className="ml-auto text-[#8A9793] text-[12px]" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
        </div>
        {open && <div className="px-[18px] pb-5 pt-0.5">{body}</div>}
      </div>
    );
    const lbl = 'block text-[10px] font-mono uppercase tracking-wider text-[#8A9793] mb-1.5';
    const inp = 'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none';
    return (
      <>
        <div className="bg-white border rounded-[14px]" style={{ borderColor: line }}>
          {secH(1, 'Producto', d.nm ? d.nm : 'sin nombre', d.o1, () => setD({ o1: !d.o1 }), (
            <>
              <div className="grid gap-3.5 mb-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                <div><label className={lbl}>Nombre del producto</label>
                  <input value={d.nm} onChange={e => { const nm = e.target.value; setD({ nm, ...(d.patAuto !== false ? { pat: nm.toUpperCase() } : {}) }); }} placeholder="Ej: Chaqueta Red Bull" className={inp} style={{ borderColor: line }} /></div>
                <div><label className={lbl}>Patrón de detección</label>
                  <input value={d.pat} onChange={e => setD({ pat: e.target.value, patAuto: false })} placeholder="Se llena solo con el nombre" className={inp} style={{ borderColor: line }} />
                  <span className="text-[11.5px] text-[#8A9793]">{d.patAuto !== false ? 'Se llena solo con el nombre. Si lo cambias a mano, deja de seguirlo.' : <>✎ Escrito a mano. <button onClick={() => setD({ patAuto: true, pat: (d.nm || '').toUpperCase() })} className="font-bold underline" style={{ color: tealDeep }}>Volver a seguir el nombre</button></>}</span></div>
              </div>
              <div className="mb-4 max-w-[320px]"><label className={lbl}>Categoría</label>
                <select value={d.catId} onChange={e => {
                  const catId = e.target.value; const nueva = nuevoDraft(catId);
                  setDraft({ ...nueva, dbId: d.dbId, id: d.id, nm: d.nm, pat: d.pat, patAuto: d.patAuto, m1: d.m1, m2: d.m2, ads: d.ads, fotos: d.fotos, rows: d.rows.map(r => mkRow(r.img)), o1: true, o2: true, o3: d.o3 });
                  cerrarDrop();
                }} className={inp} style={{ borderColor: line }}>
                  <option value="">Sin categoría</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <span className="text-[11.5px] text-[#8A9793]">{cats.length ? 'Al elegirla se cargan sus columnas.' : 'Crea una en la pestaña Categorías.'}</span>
              </div>
              <div><label className={lbl}>Fotos generales (portada)</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {d.fotos.map((f, i) => (
                    <span key={i} className="relative w-[60px] h-[60px] rounded-lg overflow-hidden border" style={{ borderColor: line }}>
                      <img src={f} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setD({ fotos: d.fotos.filter((_, j) => j !== i) })} className="absolute top-1 right-1 w-[17px] h-[17px] rounded-full grid place-items-center text-[10px] text-white" style={{ background: 'rgba(0,0,0,.6)' }}>✕</button>
                    </span>
                  ))}
                  <label className="w-[60px] h-[60px] rounded-lg border border-dashed grid place-items-center relative overflow-hidden text-[11px] font-bold cursor-pointer" style={{ borderColor: teal, background: wash, color: tealDeep }}>
                    + Subir<input type="file" accept="image/*" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => { const fs = e.target.files; if (fs) { const urls = await subirFotos(fs); setDraft(cur => cur ? { ...cur, fotos: [...cur.fotos, ...urls].slice(0, 8) } : cur); } (e.target as HTMLInputElement).value = ''; }} />
                  </label>
                </div>
                <span className="text-[11.5px] text-[#8A9793] block mt-1.5">Opcional. Las fotos de cada variante van en la tabla de abajo.</span>
              </div>
            </>
          ))}
          {secH(2, 'Variantes', d.rows.length ? `${d.rows.length} fila${d.rows.length === 1 ? '' : 's'}` : 'sin filas', d.o2, () => setD({ o2: !d.o2 }), TablaVariantes())}
          {secH(3, 'Mensajes del bot', '2 mensajes', d.o3, () => setD({ o3: !d.o3 }), (
            <>
              <div className="mb-3.5"><label className={lbl}>1 · Mensaje de bienvenida con precios</label>
                <textarea rows={3} value={d.m1} onChange={e => setD({ m1: e.target.value })} placeholder="¡Hola! 😊 Gracias por escribir por {producto}. Precios: 1 unidad → $139.900 · 2 → $250.000" className={inp} style={{ borderColor: line }} />
                <span className="text-[11.5px] text-[#8A9793]">Lo primero que envía el bot. Después van las fotos.</span></div>
              <div className="mb-3.5"><label className={lbl}>2 · Llamado a la acción</label>
                <textarea rows={2} value={d.m2} onChange={e => setD({ m2: e.target.value })} placeholder="¿Te lo aparto y pagas cuando lo recibes? Dime tu talla y color 😉" className={inp} style={{ borderColor: line }} />
                <span className="text-[11.5px] text-[#8A9793]">Mensaje corto que el bot envía justo después de las fotos.</span></div>
              <div><label className={lbl}>Etiquetas que el bot reemplaza solo</label>
                <div className="flex gap-1.5 flex-wrap mt-0.5">
                  {['{producto}', '{precio}', ...d.cols.map(c => '{' + V(c.vid).nombre.toLowerCase() + '}')].map((t, i) => <span key={i} className={`${chip} font-mono`}>{t}</span>)}
                </div>
              </div>
            </>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={guardarProducto} disabled={guardando || subiendo} className={`${btn} text-white disabled:opacity-50`} style={{ background: teal, borderColor: teal }}>{guardando ? 'Guardando…' : subiendo ? 'Subiendo fotos…' : 'Guardar producto'}</button>
          <button onClick={() => { setDraft(null); cerrarDrop(); }} className={`${btn}`} style={{ borderColor: line }}>Cancelar</button>
        </div>
      </>
    );
  }

  function TablaVariantes() {
    const d = draft!;
    const setRows = (rows: Row[]) => setDraft({ ...d, rows });
    const nsel = d.rows.filter(r => sel[r.id]).length;
    const vacias = d.rows.filter(r => !r.img).length;
    const usaStock = !!d.stockOn;
    const umbral = d.stockAviso ?? 0;
    // La variable especial "Stock" jamás se dibuja como columna normal (tiene su
    // propia columna dedicada). Se filtra aquí por si algún dato viejo la trae.
    const cols = d.cols.filter(c => !esStockVar(V(c.vid)));

    async function bulk(files: FileList) {
      const urls = await subirFotos(files);
      setDraft(cur => {
        if (!cur) return cur;
        let cols = cur.cols;
        if (!cols.length) cols = seedColsRopa();
        const rows = [...cur.rows];
        const libres = rows.filter(r => !r.img);
        urls.forEach(u => { const r = libres.shift(); if (r) r.img = u; else rows.push({ id: uid(), img: u, v: {} }); });
        return { ...cur, cols, rows, o2: true };
      });
    }

    if (!d.rows.length && !d.cols.length) {
      return (
        <>
          <label className="block border border-dashed rounded-xl p-6 text-center relative overflow-hidden cursor-pointer bg-white hover:bg-[#E9F7F5]" style={{ borderColor: line }}>
            <b className="block text-[13px]">📸 Sube las fotos de tu producto</b>
            <span className="text-xs text-[#8A9793]">Cada foto se convierte en una fila y al frente eliges qué es.</span>
            <input type="file" accept="image/*" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => { if (e.target.files) bulk(e.target.files); (e.target as HTMLInputElement).value = ''; }} />
          </label>
          <p className="text-[11.5px] text-[#8A9793] mt-2.5">También puedes empezar por las columnas: <button onClick={() => setDraft({ ...d, cols: [mkCol(colorVar?.id || vars[0]?.id || '')], rows: [mkRow()] })} className={`${btn} text-[11.5px] py-1.5 ml-1`} style={{ borderColor: line }}>+ Añadir columna</button></p>
        </>
      );
    }

    return (
      <>
        <div className="flex gap-2 items-center flex-wrap mb-3">
          <label className={`${btn} text-white text-[11.5px] py-1.5 relative overflow-hidden cursor-pointer`} style={{ background: teal, borderColor: teal }}>
            📸 Subir fotos<input type="file" accept="image/*" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => { if (e.target.files) bulk(e.target.files); (e.target as HTMLInputElement).value = ''; }} />
          </label>
          <button onClick={() => setRows([...d.rows, mkRow()])} className={`${btn} text-[11.5px] py-1.5`} style={{ borderColor: line }}>+ Fila vacía</button>
          <span className="text-[11.5px] text-[#8A9793] ml-1">{vacias ? `Hay ${vacias} fila${vacias === 1 ? '' : 's'} sin foto: lo que subas se acomoda ahí primero.` : 'Toca una celda para elegir varias opciones, o el título de la columna para editar la lista.'}</span>
        </div>

        {/* Control de stock: toggle "Sin control · ilimitado / Por variante" + aviso. */}
        <div className="rounded-[10px] px-3 py-2.5 mb-3 flex items-center gap-3 flex-wrap" style={{ background: wash, border: `1px solid ${line}` }}>
          <span className="text-[12.5px] font-bold flex items-center gap-1.5 text-[#0D0D0D]">🧮 Control de stock</span>
          <div className="inline-flex rounded-lg overflow-hidden border" style={{ borderColor: line }}>
            <button onClick={() => setDraft({ ...d, stockOn: false })}
              className="px-3 py-1.5 text-[12px] font-semibold transition-colors" style={!usaStock ? { background: '#E7E5DF', color: '#0D0D0D' } : { background: '#fff', color: '#8A9793' }}>Sin control · ilimitado</button>
            <button onClick={() => { const df = defaultsDeStock(vars.find(esStockVar)); const tallaVid = d.cols.find(c => /talla/i.test(V(c.vid).nombre) && !V(c.vid).con_color)?.vid ?? null; setDraft({ ...d, stockOn: true, stockVid: d.stockVid ?? tallaVid, stockAviso: d.stockAviso == null ? (df.aviso || null) : d.stockAviso, rows: d.rows.map(r => ({ ...r, stockPol: r.stockPol ?? df.pol })) }); }}
              className="px-3 py-1.5 text-[12px] font-semibold transition-colors border-l" style={{ ...(usaStock ? { background: teal, color: '#fff' } : { background: '#fff', color: '#8A9793' }), borderColor: line }}>Por variante</button>
          </div>
          {usaStock && (
            <>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A9793] ml-1">Contar unidades por</span>
              <select value={d.stockVid ?? ''} onChange={e => setDraft({ ...d, stockVid: e.target.value || null })}
                className="border rounded-lg px-2 py-[6px] text-[12.5px] bg-white font-semibold" style={{ borderColor: line }}>
                <option value="">Total (un número por variante)</option>
                {cols.filter(c => !V(c.vid).con_color).map(c => <option key={c.id} value={c.vid}>{V(c.vid).icono} {V(c.vid).nombre}</option>)}
              </select>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A9793] ml-1">Avisar desde</span>
              <input type="number" min={0} inputMode="numeric" value={d.stockAviso ?? ''} onChange={e => setDraft({ ...d, stockAviso: e.target.value.trim() === '' ? null : Math.max(0, Math.round(Number(e.target.value) || 0)) })} placeholder="0"
                className="w-[60px] border rounded-lg px-2 py-[6px] text-[12.5px] text-center bg-white" style={{ borderColor: line }} />
              <span className="text-[11px] text-[#8A9793]">o menos · Qué pasa al llegar a 0 se elige en la columna <b>Al llegar a 0</b>, fila por fila.</span>
            </>
          )}
          {!usaStock && <span className="text-[11.5px] text-[#8A9793]">Inventario ilimitado: se vende todo. Cambia a <b>Por variante</b> para poner unidades por color/talla.</span>}
        </div>

        {nsel > 0 && (
          <div className="flex items-center gap-2 flex-wrap rounded-[10px] px-3 py-2 mb-3 text-[12.5px] text-white" style={{ background: '#12211F' }}>
            <b>{nsel}</b> fila{nsel === 1 ? '' : 's'} seleccionada{nsel === 1 ? '' : 's'}
            <span className="ml-auto flex gap-1.5 flex-wrap">
              <button onClick={() => setSel({})} className="rounded-lg px-2.5 py-1 text-[11.5px] font-semibold" style={{ border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.08)' }}>Quitar selección</button>
              <button onClick={() => setRows(d.rows.map(r => sel[r.id] ? { ...r, img: null } : r))} className="rounded-lg px-2.5 py-1 text-[11.5px] font-semibold" style={{ border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.08)' }}>🗑 Quitar las fotos</button>
              <button onClick={() => { setRows(d.rows.filter(r => !sel[r.id])); setSel({}); cerrarDrop(); }} className="rounded-lg px-2.5 py-1 text-[11.5px] font-semibold" style={{ border: '1px solid #F0A0AE', color: '#FFD9DF', background: 'rgba(255,255,255,.08)' }}>Eliminar filas</button>
            </span>
          </div>
        )}

        <div className="border rounded-xl overflow-x-auto" style={{ borderColor: line }}>
          <table className="border-separate w-full text-[13px]" style={{ borderSpacing: 0, minWidth: 700 }}>
            <thead>
              <tr>
                <th className="text-center align-middle px-2 py-2.5" style={{ width: 96, background: '#FCFBF8', borderBottom: `1px solid ${line}` }}>
                  <div className="flex items-center gap-2 justify-center">
                    <button onClick={() => { const todos = d.rows.length > 0 && d.rows.every(r => sel[r.id]); if (todos) setSel({}); else { const s: Record<string, boolean> = {}; d.rows.forEach(r => s[r.id] = true); setSel(s); } }}
                      className="w-[18px] h-[18px] rounded-[5px] grid place-items-center text-[11px] text-white" style={nsel && nsel === d.rows.length ? { background: teal, border: `1px solid ${teal}` } : { background: '#fff', border: '1.5px solid #CFCBC2' }}>{nsel && nsel === d.rows.length ? '✓' : ''}</button>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A9793]">Foto</span>
                  </div>
                </th>
                {cols.map(c => (
                  <th key={c.id} className="text-left" style={{ background: '#FCFBF8', borderBottom: `1px solid ${line}` }}>
                    <button onClick={e => abrirColMenu(c.id, e.currentTarget)} className="flex items-center gap-1.5 w-full px-3 py-[11px] font-mono text-[10px] uppercase tracking-wider text-[#8A9793] hover:bg-[#F4F2EC]">{V(c.vid).icono} {V(c.vid).nombre} <span className="text-[9px]">▾</span></button>
                  </th>
                ))}
                {usaStock && <th className="text-center" style={{ width: 118, background: '#FCFBF8', borderBottom: `1px solid ${line}` }}>
                  <span className="block px-3 py-[11px] font-mono text-[10px] uppercase tracking-wider text-[#8A9793]">🧮 Stock</span>
                </th>}
                {usaStock && <th className="text-left" style={{ width: 170, background: '#FCFBF8', borderBottom: `1px solid ${line}` }}>
                  <span className="block px-3 py-[11px] font-mono text-[10px] uppercase tracking-wider text-[#8A9793]">⚠️ Al llegar a 0</span>
                </th>}
                <th className="text-left" style={{ background: '#FCFBF8', borderBottom: `1px solid ${line}` }}>
                  <button onClick={e => abrirNewCol(e.currentTarget)} className="flex items-center gap-1.5 px-3 py-[11px] font-mono text-[10px] uppercase tracking-wider text-[#8A9793] hover:bg-[#F4F2EC]">+ Columna <span className="text-[9px]">▾</span></button>
                </th>
                <th style={{ width: 44, background: '#FCFBF8', borderBottom: `1px solid ${line}` }}></th>
              </tr>
            </thead>
            <tbody>
              {d.rows.length ? d.rows.map(r => (
                <tr key={r.id} className="hover:bg-[#FCFBF8]">
                  <td className="px-2.5 py-2 align-middle" style={{ borderBottom: '1px solid #F2F0EA' }}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSel(s => { const n = { ...s }; if (n[r.id]) delete n[r.id]; else n[r.id] = true; return n; })} className="w-[18px] h-[18px] rounded-[5px] grid place-items-center text-[11px] text-white shrink-0" style={sel[r.id] ? { background: teal, border: `1px solid ${teal}` } : { background: '#fff', border: '1.5px solid #CFCBC2' }}>{sel[r.id] ? '✓' : ''}</button>
                      {r.img ? (
                        <span className="relative w-[52px] h-[52px] rounded-[9px] overflow-hidden border block group" style={{ borderColor: line }}>
                          <img src={r.img} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => setRows(d.rows.map(x => x.id === r.id ? { ...x, img: null } : x))} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full grid place-items-center text-[9px] text-white opacity-0 group-hover:opacity-100" style={{ background: 'rgba(0,0,0,.6)' }}>✕</button>
                        </span>
                      ) : (
                        <label className="w-[52px] h-[52px] rounded-[9px] border border-dashed grid place-items-center text-base relative overflow-hidden cursor-pointer" style={{ borderColor: teal, background: wash, color: tealDeep }}>+
                          <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => { const fs = e.target.files; if (fs && fs[0]) { const urls = await subirFotos([fs[0]]); if (urls[0]) setDraft(cur => cur ? { ...cur, rows: cur.rows.map(x => x.id === r.id ? { ...x, img: urls[0] } : x) } : cur); } (e.target as HTMLInputElement).value = ''; }} />
                        </label>
                      )}
                    </div>
                  </td>
                  {cols.map(c => {
                    const selv = r.v[c.id] || [];
                    const vd = V(c.vid);
                    const lb = etiquetaCelda(c, selv);
                    let hex: string | undefined;
                    if (vd.con_color && selv.length) hex = c.vals.find(x => x.nm === selv[0])?.hex;
                    return (
                      <td key={c.id} className="px-2.5 py-2 align-middle" style={{ borderBottom: '1px solid #F2F0EA' }}>
                        <button onClick={e => abrirCelda(r.id, c.id, e.currentTarget)} className="flex items-center gap-1.5 w-full min-w-[150px] border rounded-lg px-2.5 py-[7px] text-[12.5px] text-left font-semibold" style={{ borderColor: lb ? line : '#D5D1C8', borderStyle: lb ? 'solid' : 'dashed', color: lb ? undefined : muted }}>
                          {vd.con_color && <span className="w-4 h-4 rounded-[5px] shrink-0" style={{ background: hex || '#EFEDE7', border: '1px solid rgba(18,33,31,.2)' }} />}
                          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{lb || '— elegir —'}</span>
                          <span className="text-[9px]" style={{ color: muted }}>▾</span>
                        </button>
                      </td>
                    );
                  })}
                  {usaStock && (() => {
                    const scol = d.stockVid ? d.cols.find(x => x.vid === d.stockVid) : null;
                    const tallas = scol ? (r.v[scol.id] || []) : [];
                    // ── Modo POR TALLA: chips por talla + total (abre el popover) ──
                    if (scol && tallas.length) {
                      const st = r.stockTallas || {};
                      const algunoDef = tallas.some(t => typeof st[t] === 'number');
                      const total = tallas.reduce((a, t) => a + (typeof st[t] === 'number' ? st[t] : 0), 0);
                      return (
                        <td className="px-2.5 py-2 align-middle" style={{ borderBottom: '1px solid #F2F0EA' }}>
                          <button onClick={e => abrirStock(r.id, e.currentTarget)} className="flex items-center gap-1 flex-wrap w-full min-w-[150px] border rounded-lg px-2 py-[6px] text-left" style={{ borderColor: line }}>
                            {tallas.map(t => {
                              const n = typeof st[t] === 'number' ? st[t] : null;
                              const agot = n === 0;
                              const bajo = n != null && n > 0 && umbral > 0 && n <= umbral;
                              return <span key={t} className="text-[10.5px] font-bold rounded px-1.5 py-0.5" style={{ background: agot ? '#FDE0E4' : bajo ? '#FDE8D3' : '#EAF6F4', color: agot ? '#C8102E' : bajo ? '#B45309' : '#0B7A70' }}>{t} {n == null ? '–' : n}</span>;
                            })}
                            {algunoDef && <span className="text-[11px] font-extrabold ml-auto whitespace-nowrap">= {total}</span>}
                            <span className="text-[9px]" style={{ color: muted }}>▾</span>
                          </button>
                        </td>
                      );
                    }
                    // ── Fallback: un solo número por variante ──
                    const st = r.stock ?? null;
                    const agotado = st === 0;
                    const bajo = st != null && st > 0 && umbral > 0 && st <= umbral;
                    const bordeC = agotado ? '#C8102E' : bajo ? '#B45309' : line;
                    return (
                      <td className="px-2.5 py-2 align-middle text-center" style={{ borderBottom: '1px solid #F2F0EA' }}>
                        <div className="flex items-center gap-1.5 justify-center">
                          <input type="number" min={0} inputMode="numeric" value={st ?? ''} placeholder="∞"
                            onChange={e => { const raw = e.target.value; const n = raw.trim() === '' ? null : Math.max(0, Math.round(Number(raw) || 0)); setRows(d.rows.map(x => x.id === r.id ? { ...x, stock: n } : x)); }}
                            className="w-[64px] border rounded-lg px-2 py-[6px] text-[12.5px] text-center bg-white font-semibold" style={{ borderColor: bordeC, color: (agotado || bajo) ? bordeC : undefined }} />
                          {st == null ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#FBEFC9', color: '#8A6D00' }}>SIN DEFINIR</span>
                            : agotado ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: '#C8102E' }}>AGOTADO</span>
                            : bajo ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#FDE8D3', color: '#B45309' }}>¡BAJO!</span>
                            : null}
                        </div>
                      </td>
                    );
                  })()}
                  {usaStock && (() => {
                    const pol: StockPol = r.stockPol ?? 'bloquear';
                    return (
                      <td className="px-2.5 py-2 align-middle" style={{ borderBottom: '1px solid #F2F0EA' }}>
                        <button onClick={e => abrirPol(r.id, e.currentTarget)}
                          className="flex items-center gap-1.5 w-full border rounded-lg px-2 py-[6px] text-[12px] font-semibold bg-white text-left"
                          style={{ borderColor: line, color: pol === 'bloquear' ? '#C8102E' : '#1E9E5A' }}>
                          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{POL_LABEL[pol]}</span>
                          <span className="text-[9px]" style={{ color: muted }}>▾</span>
                        </button>
                      </td>
                    );
                  })()}
                  <td style={{ borderBottom: '1px solid #F2F0EA' }}></td>
                  <td className="px-2.5" style={{ borderBottom: '1px solid #F2F0EA' }}><button onClick={() => { setRows(d.rows.filter(x => x.id !== r.id)); cerrarDrop(); }} className="text-[#C3BFB6] hover:text-[#C8102E] font-bold px-1.5">✕</button></td>
                </tr>
              )) : (
                <tr><td colSpan={cols.length + 3 + (usaStock ? 2 : 0)} className="text-[12px] text-[#8A9793] p-4">Sube fotos o agrega una fila vacía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  function etiquetaCelda(c: Col, selv: string[]): string | null {
    if (!selv.length) return null;
    const uniq = c.uniq;
    if (!uniq && selv.length === c.vals.length && c.vals.length > 1) return `Todas (${selv.length})`;
    return selv.join(', ');
  }

  // ── Popovers: abrir ──
  function abrirColMenu(cid: string, el: HTMLElement) {
    const c = findC(cid); if (!c) return;
    if (drop === 'c' + cid) { cerrarDrop(); return; }
    triggerRef.current = el; setDrop('c' + cid); setTmp({ type: 'col', id: cid, vals: JSON.parse(JSON.stringify(c.vals)), uniq: c.uniq });
  }
  function abrirNewCol(el: HTMLElement) { if (drop === 'new') { cerrarDrop(); return; } triggerRef.current = el; setDrop('new'); setTmp(null); }
  function abrirCelda(rid: string, cid: string, el: HTMLElement) {
    const r = findR(rid), c = findC(cid); if (!r || !c) return;
    if (drop === 'p' + rid + '_' + cid) { cerrarDrop(); return; }
    triggerRef.current = el; setDrop('p' + rid + '_' + cid); setTmp({ type: 'cell', rid, cid, vals: (r.v[cid] || []).slice(), all: false });
  }
  function abrirStock(rid: string, el: HTMLElement) {
    const r = findR(rid); if (!r || !draft) return;
    if (drop === 's' + rid) { cerrarDrop(); return; }
    const scol = draft.stockVid ? draft.cols.find(c => c.vid === draft.stockVid) : null;
    const tallas = scol ? (r.v[scol.id] || []) : [];
    const st = r.stockTallas || {};
    const vals: Record<string, number> = {};
    tallas.forEach(t => { if (typeof st[t] === 'number') vals[t] = st[t]; });
    triggerRef.current = el; setDrop('s' + rid); setTmp({ type: 'stock', rid, vals, mismo: '', all: false });
  }
  function abrirPol(rid: string, el: HTMLElement) {
    const r = findR(rid); if (!r) return;
    if (drop === 'z' + rid) { cerrarDrop(); return; }
    triggerRef.current = el; setDrop('z' + rid); setTmp({ type: 'pol', rid, val: (r.stockPol ?? 'bloquear') as StockPol, all: false });
  }

  function PopoverContenido() {
    const d = draft;
    if (!d || !drop) return null;
    const opBtn = 'flex items-center gap-2 w-full px-2.5 py-[7px] rounded-lg text-[12.5px] text-left font-medium hover:bg-[#F6F4EF]';
    const cbox = (on: boolean) => <span className="w-4 h-4 rounded-[5px] grid place-items-center text-[10px] text-white shrink-0" style={on ? { background: '#00A89D', border: '1px solid #00A89D' } : { background: '#fff', border: '1.5px solid #D5D1C8' }}>{on ? '✓' : ''}</span>;
    const rdio = (on: boolean) => <span className="w-4 h-4 rounded-full shrink-0" style={on ? { border: '5px solid #00A89D' } : { border: '1.5px solid #D5D1C8', background: '#fff' }} />;

    // ── Popover: AL LLEGAR A 0 (política de una fila, o de todas) ──
    if (tmp?.type === 'pol') {
      const opciones: StockPol[] = ['bloquear', 'seguir'];
      return (
        <div>
          <div className="text-[9.5px] font-mono uppercase tracking-wider text-[#8A9793] px-2.5 pt-1.5 pb-1">Al llegar a 0</div>
          {opciones.map(o => (
            <button key={o} className={`${opBtn} ${tmp.val === o ? 'font-bold' : ''}`} onClick={() => setTmp({ ...tmp, val: o })}>
              {rdio(tmp.val === o)}<span style={{ color: o === 'bloquear' ? '#C8102E' : '#1E9E5A' }}>{POL_LABEL[o]}</span>
            </button>
          ))}
          <button className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg mt-1 text-[11.5px] font-semibold text-left" style={{ background: '#FFF6EA', color: '#8A5000' }} onClick={() => setTmp({ ...tmp, all: !tmp.all })}>{cbox(!!tmp.all)}Aplicar a todas las filas</button>
          <div className="flex gap-1.5 pt-2 mt-1.5 border-t" style={{ borderColor: '#F2F0EA' }}>
            <button className="flex-1 border rounded-lg py-1.5 text-[12px] font-bold" style={{ borderColor: line }} onClick={cerrarDrop}>Cancelar</button>
            <button className="flex-1 rounded-lg py-1.5 text-[12px] font-bold text-white" style={{ background: teal }} onClick={() => {
              const rows = d.rows.map(x => (tmp.all || x.id === tmp.rid) ? { ...x, stockPol: tmp.val as StockPol } : x);
              setDraft({ ...d, rows }); cerrarDrop();
            }}>Aplicar</button>
          </div>
        </div>
      );
    }

    // ── Popover: UNIDADES POR TALLA (stock por talla de una fila) ──
    if (tmp?.type === 'stock') {
      const r = findR(tmp.rid); if (!r) return null;
      const scol = d.stockVid ? d.cols.find(c => c.vid === d.stockVid) : null;
      const tallas = scol ? (r.v[scol.id] || []) : [];
      const nombreCol = scol ? V(scol.vid).nombre : 'Talla';
      const setVal = (t: string, raw: string) => { const nv = { ...tmp.vals }; if (raw.trim() === '') delete nv[t]; else nv[t] = Math.max(0, Math.round(Number(raw) || 0)); setTmp({ ...tmp, vals: nv }); };
      const suma = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + (Number(b) || 0), 0);
      return (
        <div>
          <div className="text-[9.5px] font-mono uppercase tracking-wider text-[#8A9793] px-2.5 pt-1.5 pb-1">Unidades por {nombreCol.toLowerCase()}</div>
          <div className="max-h-[200px] overflow-y-auto">
            {tallas.length ? tallas.map(t => (
              <div key={t} className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="flex-1 font-bold text-[13px]">{t}</span>
                <input type="number" min={0} inputMode="numeric" value={tmp.vals[t] ?? ''} onChange={e => setVal(t, e.target.value)} className="w-[74px] border rounded-lg px-2 py-1.5 text-[12.5px] text-center" style={{ borderColor: line }} />
              </div>
            )) : <div className="text-[11px] text-[#8A9793] px-2.5 py-1.5">Elige primero la {nombreCol.toLowerCase()} de esta fila.</div>}
          </div>
          {tallas.length > 0 && (
            <div className="flex items-center gap-2 px-2.5 py-2 border-t mt-1" style={{ borderColor: '#F2F0EA' }}>
              <span className="text-[11px] text-[#8A9793] flex-1 leading-tight">Mismo número en todas</span>
              <input type="number" min={0} inputMode="numeric" value={tmp.mismo ?? ''} onChange={e => setTmp({ ...tmp, mismo: e.target.value })} className="w-[54px] border rounded-lg px-2 py-1 text-[12px] text-center" style={{ borderColor: line }} />
              <button onClick={() => { const raw = String(tmp.mismo ?? '').trim(); if (raw === '') return; const val = Math.max(0, Math.round(Number(raw) || 0)); const nv: Record<string, number> = {}; tallas.forEach(t => nv[t] = val); setTmp({ ...tmp, vals: nv }); }} className={`${btn} text-[11px] py-1`} style={{ borderColor: line }}>Poner</button>
            </div>
          )}
          <button className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg mt-1 text-[11.5px] font-semibold text-left" style={{ background: '#FFF6EA', color: '#8A5000' }} onClick={() => setTmp({ ...tmp, all: !tmp.all })}>{cbox(!!tmp.all)}Aplicar a todas las filas</button>
          <div className="flex gap-1.5 pt-2 mt-1.5 border-t" style={{ borderColor: '#F2F0EA' }}>
            <button className="flex-1 border rounded-lg py-1.5 text-[12px] font-bold" style={{ borderColor: line }} onClick={cerrarDrop}>Cancelar</button>
            <button className="flex-1 rounded-lg py-1.5 text-[12px] font-bold text-white" style={{ background: teal }} onClick={() => {
              const map: Record<string, number> = { ...tmp.vals };
              let rows = d.rows;
              if (tmp.all && scol) {
                // Aplica el mismo patrón a cada fila, solo en las tallas que esa fila tenga.
                rows = d.rows.map(x => {
                  const xt = x.v[scol.id] || [];
                  const nm: Record<string, number> = {};
                  xt.forEach(t => { if (typeof map[t] === 'number') nm[t] = map[t]; });
                  return { ...x, stockTallas: nm, stock: suma(nm) };
                });
              } else {
                rows = d.rows.map(x => x.id === tmp.rid ? { ...x, stockTallas: map, stock: suma(map) } : x);
              }
              setDraft({ ...d, rows }); cerrarDrop();
            }}>Aplicar</button>
          </div>
        </div>
      );
    }

    if (drop === 'new') {
      const used = d.cols.map(c => c.vid);
      const stockVar = vars.find(esStockVar);
      const free = vars.filter(v => used.indexOf(v.id) < 0 && !esStockVar(v));
      return (
        <div className="max-h-[238px] overflow-y-auto">
          <div className="text-[9.5px] font-mono uppercase tracking-wider text-[#8A9793] px-2.5 pt-1.5 pb-1">Agregar columna</div>
          {free.length ? free.map(v => <button key={v.id} className={opBtn} onClick={() => { setDraft({ ...d, cols: [...d.cols, mkCol(v.id)] }); cerrarDrop(); }}>{v.icono} {v.nombre}</button>) : <div className="text-[11px] text-[#8A9793] px-2.5 py-1.5">Ya usaste todas las variables.</div>}
          {stockVar && (
            <button className={`${opBtn} ${d.stockOn ? 'font-bold' : ''}`} style={d.stockOn ? { color: '#00847A' } : {}}
              onClick={() => { const on = !d.stockOn; const df = defaultsDeStock(stockVar); setDraft({ ...d, stockOn: on, stockAviso: on && d.stockAviso == null ? (df.aviso || null) : d.stockAviso, rows: on ? d.rows.map(r => ({ ...r, stockPol: r.stockPol ?? df.pol })) : d.rows }); cerrarDrop(); }}>
              {cbox(!!d.stockOn)} {stockVar.icono} Stock <span className="text-[10px] text-[#8A9793]">· unidades por variante</span>
            </button>
          )}
          <div className="h-px bg-[#F2F0EA] my-1.5 mx-1" />
          <button className={`${opBtn} font-bold`} style={{ color: '#00847A' }} onClick={() => { cerrarDrop(); if (confirm('Vas a ir a la pestaña Variables. Se perderá lo que no hayas guardado de este producto. ¿Continuar?')) { setDraft(null); setTab('vars'); setDvar({ id: uid(), nombre: '', icono: '✨', con_color: false, no_repite: false, opciones: [] }); } }}>✎ Crear una variable nueva</button>
        </div>
      );
    }

    if (tmp?.type === 'col') {
      const c = findC(tmp.id); if (!c) return null;
      const vd = V(c.vid);
      return (
        <div>
          <div className="max-h-[238px] overflow-y-auto">
            <div className="text-[9.5px] font-mono uppercase tracking-wider text-[#8A9793] px-2.5 pt-1.5 pb-1">{vd.nombre} de este producto</div>
            {vd.opciones.length ? vd.opciones.map((o, j) => {
              const on = tmp.vals.some((x: Opt) => x.nm === o.nm);
              return (
                <button key={j} className={`${opBtn} ${on ? 'font-bold' : ''}`} style={on ? { color: '#00847A' } : {}}
                  onClick={() => { const at = tmp.vals.findIndex((x: Opt) => x.nm === o.nm); const nv = tmp.vals.slice(); if (at >= 0) nv.splice(at, 1); else nv.push({ nm: o.nm, hex: o.hex }); setTmp({ ...tmp, vals: nv }); }}>
                  {cbox(on)}
                  {o.hex && <span className="w-[15px] h-[15px] rounded-full" style={{ background: o.hex, border: '1px solid rgba(18,33,31,.22)' }} />}
                  {o.nm}
                </button>
              );
            }) : <div className="text-[11px] text-[#8A9793] px-2.5 py-1.5">Esta variable no tiene opciones.</div>}
            <div className="h-px bg-[#F2F0EA] my-1.5 mx-1" />
            <button className={`${opBtn} font-bold`} style={{ color: '#00847A' }} onClick={() => { cerrarDrop(); if (confirm('Vas a ir a Variables. Se perderá lo no guardado de este producto. ¿Continuar?')) { setDraft(null); setTab('vars'); const vv = vars.find(x => x.id === c.vid); if (vv) setDvar(JSON.parse(JSON.stringify(vv))); } }}>✎ Editar la lista en Variables</button>
            <button className={opBtn} onClick={() => setTmp({ ...tmp, uniq: !tmp.uniq })}>{cbox(tmp.uniq)}No repetir entre filas</button>
            <button className={opBtn} style={{ color: danger }} onClick={() => { setDraft({ ...d, cols: d.cols.filter(x => x.id !== c.id), rows: d.rows.map(r => { const nv = { ...r.v }; delete nv[c.id]; return { ...r, v: nv }; }) }); cerrarDrop(); }}>Quitar columna</button>
          </div>
          <div className="flex gap-1.5 pt-2 mt-1.5 border-t" style={{ borderColor: '#F2F0EA' }}>
            <button className="flex-1 border rounded-lg py-1.5 text-[12px] font-bold" style={{ borderColor: line }} onClick={cerrarDrop}>Cancelar</button>
            <button className="flex-1 rounded-lg py-1.5 text-[12px] font-bold text-white" style={{ background: teal }} onClick={() => {
              const ok = tmp.vals.map((v: Opt) => v.nm);
              const cols = d.cols.map(x => x.id === c.id ? { ...x, vals: tmp.vals, uniq: tmp.uniq } : x);
              const rows = d.rows.map(r => {
                let arr = r.v[c.id] ? r.v[c.id].filter(x => ok.includes(x)) : r.v[c.id];
                if (tmp.uniq && arr && arr.length > 1) arr = [arr[0]];
                return arr ? { ...r, v: { ...r.v, [c.id]: arr } } : r;
              });
              setDraft({ ...d, cols, rows }); cerrarDrop();
            }}>Aplicar</button>
          </div>
        </div>
      );
    }

    if (tmp?.type === 'cell') {
      const c = findC(tmp.cid), r = findR(tmp.rid); if (!c || !r) return null;
      const vd = V(c.vid), uniq = c.uniq;
      const taken = uniq ? d.rows.filter(x => x.id !== r.id).flatMap(x => x.v[c.id] || []) : [];
      const opts = c.vals;
      const todos = opts.length > 0 && tmp.vals.length === opts.length;
      return (
        <div>
          <div className="max-h-[238px] overflow-y-auto">
            <div className="text-[9.5px] font-mono uppercase tracking-wider text-[#8A9793] px-2.5 pt-1.5 pb-1">Elegir {vd.nombre.toLowerCase()}{uniq ? '' : ' (varias)'}</div>
            {!uniq && opts.length > 1 && (
              <>
                <button className={`${opBtn} ${todos ? 'font-bold' : ''}`} onClick={() => setTmp({ ...tmp, vals: todos ? [] : opts.map(v => v.nm) })}>{cbox(todos)}<b>Todas · {opts.length}</b></button>
                <div className="h-px bg-[#F2F0EA] my-1.5 mx-1" />
              </>
            )}
            {opts.length ? opts.map((v, j) => {
              const on = tmp.vals.indexOf(v.nm) >= 0;
              const dis = uniq && taken.indexOf(v.nm) >= 0;
              if (dis) return null;
              return (
                <button key={j} className={`${opBtn} ${on ? 'font-bold' : ''}`} style={on ? { color: '#00847A' } : {}}
                  onClick={() => { if (uniq) setTmp({ ...tmp, vals: tmp.vals[0] === v.nm ? [] : [v.nm] }); else { const at = tmp.vals.indexOf(v.nm); const nv = tmp.vals.slice(); if (at >= 0) nv.splice(at, 1); else nv.push(v.nm); setTmp({ ...tmp, vals: nv }); } }}>
                  {uniq ? rdio(on) : cbox(on)}
                  {v.hex && <span className="w-[15px] h-[15px] rounded-full" style={{ background: v.hex, border: '1px solid rgba(18,33,31,.22)' }} />}
                  {v.nm}
                </button>
              );
            }) : <div className="text-[11px] text-[#8A9793] px-2.5 py-1.5">Esta columna no tiene opciones activas. Tócala en el encabezado.</div>}
            {uniq && <div className="text-[11px] text-[#8A9793] px-2.5 py-1.5">Cada {vd.nombre.toLowerCase()} se usa una sola vez: los ya asignados no aparecen.</div>}
          </div>
          {!uniq && <button className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg mt-1.5 text-[11.5px] font-semibold text-left" style={{ background: '#FFF6EA', color: '#8A5000' }} onClick={() => setTmp({ ...tmp, all: !tmp.all })}>{cbox(tmp.all)}Aplicar a todas las filas</button>}
          <div className="flex gap-1.5 pt-2 mt-1.5 border-t" style={{ borderColor: '#F2F0EA' }}>
            <button className="flex-1 border rounded-lg py-1.5 text-[12px] font-bold" style={{ borderColor: line }} onClick={cerrarDrop}>Cancelar</button>
            <button className="flex-1 rounded-lg py-1.5 text-[12px] font-bold text-white" style={{ background: teal }} onClick={() => {
              const vals = tmp.vals.slice();
              let rows = d.rows;
              if (tmp.all && !uniq) rows = d.rows.map(x => ({ ...x, v: { ...x.v, [c.id]: vals.slice() } }));
              else {
                rows = d.rows.map(x => x.id === r.id ? { ...x, v: { ...x.v, [c.id]: vals } } : x);
                if (uniq) rows = rows.map(o => o.id !== r.id && o.v[c.id] ? { ...o, v: { ...o.v, [c.id]: o.v[c.id].filter(x => vals.indexOf(x) < 0) } } : o);
              }
              setDraft({ ...d, rows }); cerrarDrop();
            }}>Aplicar</button>
          </div>
        </div>
      );
    }
    return null;
  }

  // ── Categorías ──
  function ListaCategorias() {
    if (!cats.length) return (
      <div className="bg-white border border-dashed rounded-[14px] text-center" style={{ borderColor: line, padding: 52 }}>
        <div className="text-3xl opacity-50">🗂</div>
        <h3 className="mt-3 mb-1 text-[15px] font-extrabold">Todavía no tienes categorías</h3>
        <p className="text-[12.5px] text-[#8A9793] max-w-[46ch] mx-auto mb-4">La categoría precarga las columnas típicas para no armarlas de cero cada vez.</p>
        <button onClick={() => setDcat({ id: uid(), nombre: '', columnas: [] })} className={`${btn} text-white`} style={{ background: teal, borderColor: teal }}>+ Crear categoría</button>
        <div className="mt-4 text-xs text-[#8A9793]">O empieza con una lista: {TPL_CATS.map((k, i) => <span key={k}>{i > 0 && ' · '}<button onClick={() => setDcat({ id: uid(), nombre: k, columnas: colsDeTpl(k) })} className="font-bold" style={{ color: teal }}>{k}</button></span>)}</div>
      </div>
    );
    return (
      <div className="space-y-2">
        {cats.map(c => (
          <div key={c.id} className="flex items-center gap-3 p-3 bg-white border rounded-xl flex-wrap" style={{ borderColor: line }}>
            <span className="w-11 h-11 rounded-lg grid place-items-center text-lg shrink-0" style={{ background: wash }}>🗂</span>
            <div><b className="text-[13.5px]">{c.nombre}</b><div className="text-[11.5px] text-[#8A9793]">{c.columnas.length} columna{c.columnas.length === 1 ? '' : 's'}</div></div>
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              {c.columnas.map(k => <span key={k} className={chip}>{V(k).icono} {V(k).nombre}</span>)}
              <button onClick={() => setDcat(JSON.parse(JSON.stringify(c)))} className={`${btn} text-[11.5px] py-1.5`} style={{ borderColor: line }}>Editar</button>
              <button onClick={() => setModalNombre({ titulo: 'Duplicar categoría', sub: 'Se copian las mismas columnas.', valor: `${c.nombre} - Copia`, onOk: n => duplicarCategoria(c, n) })} className={`${btn} text-[11.5px] py-1.5`} style={{ borderColor: line }}>⧉ Duplicar</button>
              <button onClick={() => setConfirmar({ titulo: `¿Eliminar "${c.nombre}"?`, mensaje: 'Se va a la papelera; los productos que ya la usan no se tocan.', onOk: () => eliminarCategoria(c.id) })} className={`${btn} text-[11.5px] py-1.5`} style={{ color: danger, borderColor: 'transparent', background: 'transparent' }}>Eliminar</button>
            </div>
          </div>
        ))}
        <button onClick={() => setDcat({ id: uid(), nombre: '', columnas: [] })} className="w-full border border-dashed rounded-[11px] p-3 font-bold text-[12.5px]" style={{ borderColor: line, color: teal }}>+ Añadir otra categoría</button>
      </div>
    );
  }
  function colsDeTpl(k: string): string[] {
    const nombresPorTpl: Record<string, string[]> = { Ropa: ['Color', 'Talla', 'Género'], Calzado: ['Color', 'Talla', 'Género'], 'Alimentos y bebidas': ['Sabor', 'Presentación'], Belleza: ['Color', 'Aroma', 'Presentación'], Tecnología: ['Color', 'Capacidad'], Hogar: ['Color', 'Material'] };
    return (nombresPorTpl[k] || []).map(n => vars.find(v => v.nombre === n)?.id).filter(Boolean) as string[];
  }
  function EditorCategoria() {
    const c = dcat!;
    return (
      <>
        <div className="bg-white border rounded-[14px] p-[18px]" style={{ borderColor: line }}>
          <div className="max-w-[340px] mb-4"><label className="block text-[10px] font-mono uppercase tracking-wider text-[#8A9793] mb-1.5">Nombre</label>
            <input value={c.nombre} onChange={e => setDcat({ ...c, nombre: e.target.value })} placeholder="Ej: Ropa, Perfumería, Suplementos" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: line }} /></div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8A9793] mb-2">Columnas que trae por defecto</label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {vars.map(v => { const on = c.columnas.includes(v.id); return (
              <button key={v.id} onClick={() => setDcat({ ...c, columnas: on ? c.columnas.filter(k => k !== v.id) : [...c.columnas, v.id] })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11.5px] font-semibold" style={on ? { borderColor: teal, background: wash, color: tealDeep } : { borderColor: line }}>{v.icono} {v.nombre}</button>
            ); })}
          </div>
          <span className="text-[11.5px] text-[#8A9793]">Al crear un producto con esta categoría, la tabla ya viene con estas columnas.</span>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={guardarCategoria} disabled={guardando} className={`${btn} text-white disabled:opacity-50`} style={{ background: teal, borderColor: teal }}>{guardando ? 'Guardando…' : 'Guardar categoría'}</button>
          <button onClick={() => setDcat(null)} className={`${btn}`} style={{ borderColor: line }}>Cancelar</button>
        </div>
      </>
    );
  }

  // ── Variables ──
  function ListaVariables() {
    return (
      <div className="space-y-2">
        {vars.map(v => {
          const stockV = esStockVar(v);
          const uso = stockV ? prods.filter(p => p.stockOn).length : prods.filter(p => p.cols.some(c => c.vid === v.id)).length;
          return (
            <div key={v.id} className="flex items-center gap-3 p-3 bg-white border rounded-xl flex-wrap" style={{ borderColor: line }}>
              <span className="w-11 h-11 rounded-lg grid place-items-center text-lg shrink-0" style={{ background: wash }}>{v.icono}</span>
              <div><b className="text-[13.5px]">{v.nombre}</b><div className="text-[11.5px] text-[#8A9793]">{stockV ? `número · en 0 no se puede elegir · opcional: si no la agregas, es ilimitado${uso ? ` · activo en ${uso} producto${uso > 1 ? 's' : ''}` : ''}` : `${v.opciones.length} opciones${v.con_color ? ' · muestrario de color' : ''}${v.no_repite ? ' · no se repite' : ''}${uso ? ` · usada en ${uso} producto${uso > 1 ? 's' : ''}` : ''}`}</div></div>
              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                {stockV
                  ? <span className={chip}>🧮 casilla numérica por variante</span>
                  : <>{v.opciones.slice(0, 4).map((o, i) => <span key={i} className={chip}>{o.hex && <span className="w-[11px] h-[11px] rounded-full" style={{ background: o.hex, border: '1px solid rgba(18,33,31,.16)' }} />}{o.nm}</span>)}
                {v.opciones.length > 4 && <span className={chip}>+{v.opciones.length - 4}</span>}</>}
                <button onClick={() => setDvar(JSON.parse(JSON.stringify(v)))} className={`${btn} text-[11.5px] py-1.5`} style={{ borderColor: line }}>Editar</button>
                <button onClick={() => setModalNombre({ titulo: 'Duplicar variable', sub: 'Se copian todas sus opciones.', valor: `${v.nombre} - Copia`, onOk: n => duplicarVariable(v, n) })} className={`${btn} text-[11.5px] py-1.5`} style={{ borderColor: line }}>⧉ Duplicar</button>
                <button onClick={() => { const uso2 = prods.filter(p => p.cols.some(c => c.vid === v.id)).length; setConfirmar({ titulo: `¿Eliminar "${v.nombre}"?`, mensaje: uso2 ? `Se usa en ${uso2} producto(s). Se va a la papelera.` : 'Se va a la papelera; puedes restaurarla.', onOk: () => eliminarVariable(v.id) }); }} className={`${btn} text-[11.5px] py-1.5`} style={{ color: danger, borderColor: 'transparent', background: 'transparent' }}>Eliminar</button>
              </div>
            </div>
          );
        })}
        <button onClick={() => setDvar({ id: uid(), nombre: '', icono: '✨', con_color: false, no_repite: false, opciones: [] })} className="w-full border border-dashed rounded-[11px] p-3 font-bold text-[12.5px]" style={{ borderColor: line, color: teal }}>+ Añadir otra variable</button>
      </div>
    );
  }
  function EditorVariable() {
    const v = dvar!;
    // Editor ESPECIAL de la variable Stock: no tiene opciones, sino los valores por
    // defecto (política al llegar a 0 + umbral de aviso) que heredan los productos.
    if (esStockVar(v)) {
      const df = defaultsDeStock(v);
      const setDef = (pol: StockPol, aviso: number) => setDvar({ ...v, opciones: [{ nm: pol }, { nm: String(Math.max(0, Math.round(aviso || 0))) }] });
      return (
        <>
          <div className="bg-white border rounded-[14px] p-[18px]" style={{ borderColor: line }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🧮</span>
              <div>
                <div className="font-extrabold text-[15px]">Stock</div>
                <div className="text-[11.5px] text-[#8A9793]">Casilla numérica por variante. En 0 no se puede elegir · opcional: si no la agregas a un producto, es ilimitado.</div>
              </div>
            </div>
            <div className="rounded-xl p-3 mb-3" style={{ background: wash, border: `1px solid ${line}` }}>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8A9793] mb-1.5">Por defecto, al llegar a 0</label>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setDef('bloquear', df.aviso)} className={`${btn} text-[12px] py-1.5`} style={df.pol === 'bloquear' ? { background: '#C8102E', borderColor: '#C8102E', color: '#fff' } : { borderColor: line }}>{POL_LABEL.bloquear}</button>
                <button onClick={() => setDef('seguir', df.aviso)} className={`${btn} text-[12px] py-1.5`} style={df.pol === 'seguir' ? { background: '#1E9E5A', borderColor: '#1E9E5A', color: '#fff' } : { borderColor: line }}>{POL_LABEL.seguir}</button>
              </div>
              <p className="text-[11px] text-[#8A9793] mt-2">Es el valor que traerán las variantes nuevas al activar el stock. Cada producto lo puede cambiar.</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: wash, border: `1px solid ${line}` }}>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8A9793] mb-1.5">Avisar en rojo cuando queden ≤ (por defecto)</label>
              <div className="flex items-center gap-2">
                <input type="number" min={0} inputMode="numeric" value={df.aviso || ''} onChange={e => setDef(df.pol, Number(e.target.value) || 0)} placeholder="Ej. 5" className="w-[90px] px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: line }} />
                <span className="text-[11.5px] text-[#8A9793]">unidades. (0 = sin aviso)</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={guardarVariable} disabled={guardando} className={`${btn} text-white disabled:opacity-50`} style={{ background: teal, borderColor: teal }}>{guardando ? 'Guardando…' : 'Guardar variable'}</button>
            <button onClick={() => setDvar(null)} className={`${btn}`} style={{ borderColor: line }}>Cancelar</button>
          </div>
        </>
      );
    }
    return (
      <>
        <div className="bg-white border rounded-[14px] p-[18px]" style={{ borderColor: line }}>
          <div className="grid gap-3.5 mb-4 max-w-[640px]" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            <div><label className="block text-[10px] font-mono uppercase tracking-wider text-[#8A9793] mb-1.5">Nombre</label>
              <input value={v.nombre} onChange={e => setDvar({ ...v, nombre: e.target.value })} placeholder="Ej: Talla, Sabor, Concentración" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: line }} /></div>
            <div className="max-w-[110px]"><label className="block text-[10px] font-mono uppercase tracking-wider text-[#8A9793] mb-1.5">Icono</label>
              <input value={v.icono} onChange={e => setDvar({ ...v, icono: e.target.value || '✨' })} maxLength={2} className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: line }} /></div>
          </div>
          <div className="flex gap-4 flex-wrap mb-4">
            <label className="flex items-center gap-2 text-[11.5px] cursor-pointer"><input type="checkbox" checked={v.con_color} onChange={e => setDvar({ ...v, con_color: e.target.checked, opciones: e.target.checked ? v.opciones.map(o => ({ ...o, hex: o.hex || '#cccccc' })) : v.opciones })} className="w-4 h-4 accent-[#00A89D]" />Las opciones tienen color (muestrario)</label>
            <label className="flex items-center gap-2 text-[11.5px] cursor-pointer"><input type="checkbox" checked={v.no_repite} onChange={e => setDvar({ ...v, no_repite: e.target.checked })} className="w-4 h-4 accent-[#00A89D]" />No se repite entre filas</label>
          </div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8A9793] mb-2">Opciones</label>
          <div className="flex flex-col gap-1.5 mb-3">
            {v.opciones.length ? v.opciones.map((o, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border" style={{ borderColor: '#F2F0EA' }}>
                {v.con_color && <input type="color" value={o.hex || '#cccccc'} onChange={e => { const ops = v.opciones.slice(); ops[i] = { ...ops[i], hex: e.target.value }; setDvar({ ...v, opciones: ops }); }} className="w-9 h-7 rounded" />}
                <input value={o.nm} onChange={e => { const ops = v.opciones.slice(); ops[i] = { ...ops[i], nm: e.target.value }; setDvar({ ...v, opciones: ops }); }} className="flex-1 px-2 py-1 rounded border-transparent text-sm font-semibold focus:outline-none max-w-[280px]" />
                <button onClick={() => setDvar({ ...v, opciones: v.opciones.filter((_, j) => j !== i) })} className="ml-auto text-[#C3BFB6] hover:text-[#C8102E] font-bold px-1.5">✕</button>
              </div>
            )) : <p className="text-[11.5px] text-[#8A9793]">Sin opciones todavía.</p>}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={() => setDvar({ ...v, opciones: [...v.opciones, v.con_color ? { nm: 'Nuevo color', hex: '#cccccc' } : { nm: 'Nueva opción' }] })} className={`${btn} text-[11.5px] py-1.5`} style={{ borderColor: line }}>+ Añadir opción</button>
            <select onChange={e => { if (e.target.value) { setDvar({ ...v, opciones: PACKS[e.target.value].map(n => ({ nm: n })) }); e.target.value = ''; } }} className="px-2.5 py-1.5 rounded-lg border text-xs" style={{ borderColor: line }}>
              <option value="">Cargar lista lista…</option>
              {Object.keys(PACKS).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <span className="text-[11.5px] text-[#8A9793]">Se reemplazan las opciones actuales.</span>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={guardarVariable} disabled={guardando} className={`${btn} text-white disabled:opacity-50`} style={{ background: teal, borderColor: teal }}>{guardando ? 'Guardando…' : 'Guardar variable'}</button>
          <button onClick={() => setDvar(null)} className={`${btn}`} style={{ borderColor: line }}>Cancelar</button>
        </div>
      </>
    );
  }

  // ── Modal ID de campaña ──
  function ModalAds() {
    const c = modalAds!;
    const cat = cats.find(x => x.id === c.prod.catId);
    const setAds = (ads: Ad[]) => setModalAds({ ...c, ads });
    const dup = (i: number): string | null => {
      const val = (c.ads[i].id || '').trim(); if (!val) return null;
      for (let j = 0; j < i; j++) if ((c.ads[j].id || '').trim() === val) return 'mismo';
      const otro = prods.find(p => p.id !== c.prod.id && p.ads.some(a => a.id === val));
      return otro ? (otro.nm || 'otro producto') : null;
    };
    async function aplicar() {
      if (c.ads.some((_, i) => dup(i) === 'mismo')) { alert('Hay un ID repetido en este producto. Quítalo antes de aplicar.'); return; }
      const ads = c.ads.filter(a => a.id.trim()).map(a => ({ id: a.id.trim(), ts: a.ts || Date.now() }));
      const p = c.prod;
      if (p.dbId) {
        const anuncios = ads.map(a => a.id).join(' ');
        const anuncios_fechas: Record<string, string> = {};
        ads.forEach(a => { anuncios_fechas[a.id] = new Date(a.ts as number).toISOString(); });
        await fetch(`/api/catalogos/${p.dbId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ familia: p.nm, patron: p.pat, anuncios, anuncios_fechas }) });
        await cargar();
      } else {
        setProds(ps => ps.map(x => x.id === p.id ? { ...x, ads } : x));
      }
      setModalAds(null);
    }
    return (
      <div className="fixed inset-0 z-[300] grid place-items-center bg-[rgba(11,27,26,.45)] p-5" onClick={() => setModalAds(null)}>
        <div className="bg-white rounded-[15px] overflow-hidden w-[min(520px,100%)] shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 px-5 py-4 text-white" style={{ background: teal }}>
            <span className="text-[17px]">🎯</span>
            <span className="flex-1 min-w-0"><b className="block text-[15.5px] font-extrabold truncate">{c.prod.nm || 'Producto'}{cat ? ` · ${cat.nombre}` : ''}</b><small className="block text-[11px] opacity-85 font-mono uppercase tracking-wide">ID de campaña</small></span>
            <button onClick={() => setModalAds(null)} className="w-[30px] h-[30px] rounded-full grid place-items-center text-sm" style={{ background: 'rgba(255,255,255,.24)' }}>✕</button>
          </div>
          <div className="p-5">
            <div className="rounded-[10px] p-3 text-xs text-[#42544F] mb-4" style={{ background: '#F6F4EF' }}>Pega aquí el <b>ID del anuncio o de la campaña</b> que apunta a este producto. Cuando un cliente llegue por ese anuncio, el bot ya sabe qué quiere.</div>
            {c.ads.map((a, i) => { const dd = dup(i); return (
              <div key={i} className="mb-3">
                <div className="flex items-center gap-2">
                  <input value={a.id} onChange={e => { const ads = c.ads.slice(); ads[i] = { ...ads[i], id: e.target.value }; setAds(ads); }} placeholder="Ej: 120212345678901234" className="w-full px-3 py-2 rounded-lg border font-mono text-[12.5px] focus:outline-none" style={dd ? { borderColor: danger, boxShadow: '0 0 0 3px #FCE9EC' } : { borderColor: line }} />
                  <button onClick={() => setAds(c.ads.filter((_, j) => j !== i))} className="text-[#C3BFB6] hover:text-[#C8102E] font-bold px-1.5">✕</button>
                </div>
                {a.id.trim() && <div className="text-[11px] text-[#8A9793] px-1 pt-1">{a.ts ? <>🕒 Agregado el <b style={{ color: '#42544F', fontWeight: 600 }}>{fmtFecha(a.ts)}</b></> : <span style={{ color: tealDeep, fontWeight: 700 }}>● Nuevo · se guardará con la fecha y hora de ahora</span>}</div>}
                {dd === 'mismo' && <div className="flex gap-1.5 text-[11.5px] mt-1.5 rounded-lg px-2.5 py-1.5" style={{ color: '#A50D26', background: '#FCE9EC', border: '1px solid #F3C3CB' }}>⚠️<span>Este ID <b>ya está en este producto</b>. Quítalo de una de las dos líneas.</span></div>}
                {dd && dd !== 'mismo' && <div className="flex gap-1.5 text-[11.5px] mt-1.5 rounded-lg px-2.5 py-1.5" style={{ color: '#A50D26', background: '#FCE9EC', border: '1px solid #F3C3CB' }}>⚠️<span>Este ID ya está en <b>{dd}</b>. Si lo dejas en los dos, el bot no sabrá cuál ofrecer.</span></div>}
              </div>
            ); })}
            <button onClick={() => setAds([...c.ads, { id: '', ts: null }])} className={`${btn} text-[11.5px] py-1.5`} style={{ borderColor: line }}>+ Agregar otro ID</button>
          </div>
          <div className="flex gap-2 justify-end px-5 py-3.5 border-t" style={{ borderColor: '#F2F0EA', background: '#FCFBF8' }}>
            <button onClick={() => setModalAds(null)} className={`${btn}`} style={{ borderColor: line }}>Cancelar</button>
            <button onClick={aplicar} className={`${btn} text-white`} style={{ background: teal, borderColor: teal }}>Aplicar</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Papelera ──
  function PapeleraContenido() {
    const [pProds, setPProds] = useState<any[]>([]);
    const [pCats, setPCats] = useState<any[]>([]);
    const [pVars, setPVars] = useState<any[]>([]);
    const [load, setLoad] = useState(true);
    const recargar = useCallback(async () => {
      setLoad(true);
      const [a, b2, cc] = await Promise.all([
        fetch('/api/catalogos?papelera=1', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
        fetch('/api/catalogos/categorias?papelera=1', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
        fetch('/api/catalogos/variables?papelera=1', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
      ]);
      setPProds(Array.isArray(a) ? a : []); setPCats(Array.isArray(b2) ? b2 : []); setPVars(Array.isArray(cc) ? cc : []);
      setLoad(false);
    }, []);
    useEffect(() => { recargar(); }, [recargar]);

    const esVacio = !pProds.length && !pCats.length && !pVars.length;
    if (load) return <p className="text-sm text-[#8A9793] py-10 text-center">Cargando…</p>;
    if (esVacio) return (
      <div className="bg-white border border-dashed rounded-[14px] text-center" style={{ borderColor: line, padding: 52 }}>
        <div className="text-3xl opacity-50">🗑</div><h3 className="mt-3 mb-1 text-[15px] font-extrabold">La papelera está vacía</h3>
        <p className="text-[12.5px] text-[#8A9793]">Nada eliminado por ahora.</p>
      </div>
    );
    const filaP = (icono: string, nombre: string, sub: string, onRest: () => Promise<void>, onDel: () => Promise<void>) => (
      <div className="flex items-center gap-3 p-3 bg-white border rounded-xl flex-wrap" style={{ borderColor: line }}>
        <span className="w-11 h-11 rounded-lg grid place-items-center text-lg shrink-0" style={{ background: wash }}>{icono}</span>
        <div><b className="text-[13.5px]">{nombre}</b><div className="text-[11.5px] text-[#8A9793]">{sub}</div></div>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={async () => { await onRest(); recargar(); }} className={`${btn} text-[11.5px] py-1.5`} style={{ borderColor: teal, color: tealDeep }}>↩ Restaurar</button>
          <button onClick={() => setConfirmar({ titulo: `¿Eliminar "${nombre}" para siempre?`, mensaje: 'Esta acción no se puede deshacer.', onOk: async () => { await onDel(); recargar(); } })} className={`${btn} text-[11.5px] py-1.5`} style={{ color: danger, borderColor: 'transparent' }}>🗑 Eliminar definitivo</button>
        </div>
      </div>
    );
    return (
      <div className="space-y-4">
        {pProds.length > 0 && <div><p className="text-[10px] font-mono uppercase tracking-wider text-[#8A9793] mb-2">Productos</p><div className="space-y-2">{pProds.map(p => <div key={p.id}>{filaP('📦', p.familia || 'Producto', `${(p.catalogo_colores || []).length} variantes`, () => restaurarProducto(p.id), () => eliminarProducto({ ...emptyProd, dbId: p.id, id: p.id }, true))}</div>)}</div></div>}
        {pCats.length > 0 && <div><p className="text-[10px] font-mono uppercase tracking-wider text-[#8A9793] mb-2">Categorías</p><div className="space-y-2">{pCats.map(c => <div key={c.id}>{filaP('🗂', c.nombre, `${(c.columnas || []).length} columnas`, () => restaurarCategoria(c.id), () => eliminarCategoria(c.id, true))}</div>)}</div></div>}
        {pVars.length > 0 && <div><p className="text-[10px] font-mono uppercase tracking-wider text-[#8A9793] mb-2">Variables</p><div className="space-y-2">{pVars.map(v => <div key={v.id}>{filaP(v.icono || '✨', v.nombre, `${(v.opciones || []).length} opciones`, () => restaurarVariable(v.id), () => eliminarVariable(v.id, true))}</div>)}</div></div>}
      </div>
    );
  }
}

const emptyProd: Producto = { dbId: null, id: '', nm: '', pat: '', patAuto: true, catId: '', m1: '', m2: '', ads: [], fotos: [], cols: [], rows: [], o1: true, o2: false, o3: false };

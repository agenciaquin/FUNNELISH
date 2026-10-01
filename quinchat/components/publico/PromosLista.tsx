'use client';

import { useState, useEffect } from 'react';

export interface Promo {
  id: string;
  nombre: string;
  referencia?: string | null;
  categoria?: string | null;
  destacado?: boolean | null;
  anclado?: boolean | null;
  descripcion?: string | null;
  foto?: string | null;
  precio: number;
  precio_antes?: number | null;
  precio_dos?: number | null;
  precio_tres?: number | null;
  tallas: string[];
  stock?: Record<string, number> | null;
  colores?: string[] | null;
  variantes?: Record<string, Record<string, number>> | null;
  fotos?: Record<string, string> | null;
}

const WA = '573167648391';
export const SITE = 'https://pedido.klixmant.shop';
export const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
// Normaliza texto para buscar: sin tildes, minúsculas.
const norm = (s: string) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Descuento combo: al llevar 2 o más productos, 12% menos en cada uno (redondeado a $100).
const COMBO_OFF = 0.12;
const conCombo = (n: number) => Math.round((n * (1 - COMBO_OFF)) / 100) * 100;

// ¿El producto maneja variantes por color?
export const hayVar = (p: Promo) => !!p.variantes && Object.keys(p.variantes).length > 0;
export const coloresDe = (p: Promo) => (p.colores && p.colores.length ? p.colores : (hayVar(p) ? Object.keys(p.variantes!) : []));

// Tallas disponibles en un color (o todas si no hay variantes).
export function tallasEnColor(p: Promo, color: string): string[] {
  if (hayVar(p)) {
    const v = p.variantes![color] || {};
    return Object.keys(v).filter(t => (v[t] || 0) > 0);
  }
  return p.tallas || [];
}
// Disponibilidad de una talla (en un color si aplica). Sin control → ∞.
export function dispoTC(p: Promo, color: string, t: string): number {
  if (hayVar(p)) return p.variantes![color]?.[t] ?? 0;
  const s = p.stock?.[t];
  return (s === undefined || s === null) ? Infinity : s;
}
export const controla = (p: Promo) => hayVar(p) || (!!p.stock && Object.keys(p.stock).length > 0);
// Producto disponible = no controla stock, o controla y aún tiene unidades.
export const disponible = (p: Promo) => !(hayVar(p) || (!!p.stock && Object.keys(p.stock).length > 0)) || stockTotal(p) > 0;
export const stockTotal = (p: Promo) => {
  if (hayVar(p)) return Object.values(p.variantes!).reduce((s, m) => s + Object.values(m).reduce((a, n) => a + (Number(n) || 0), 0), 0);
  if (p.stock && Object.keys(p.stock).length) return Object.values(p.stock).reduce((s, n) => s + (Number(n) || 0), 0);
  return Infinity;
};

// Color -> swatch hex
const COLOR_HEX: Record<string, string> = {
  negro: '#111', blanco: '#f5f5f5', 'blanco marfil': '#f0ead6', rojo: '#d11', cocoa: '#6b4a2b', marfil: '#efe6cf',
  lila: '#b98bd6', 'verde oscuro': '#1f5136', verde: '#2e8b57', 'azul navy': '#1b2a5b',
  'azul rey': '#1e50c8', 'rosado claro': '#f4b6c8', 'gris jaspe': '#9aa0a6', celeste: '#7ec8e3',
  amarillo: '#f2c200', gris: '#888', beige: '#e3d5b8', vino: '#6e1420', naranja: '#e8722a',
};
export const hexColor = (c: string) => COLOR_HEX[c.toLowerCase().trim()] ?? '#8a8f98';

// Foto de un color: usa la específica si existe, si no la foto principal.
export const fotoDeColor = (p: Promo, color: string) => (color && p.fotos && p.fotos[color]) || p.foto || '';
// Colores que tienen foto propia (para el collage/miniaturas).
export const coloresConFoto = (p: Promo) => coloresDe(p).filter(c => p.fotos && p.fotos[c]);

// Parte "CABALLERO - M" en { genero, size }.
function parseTalla(t: string): { genero: string; size: string } {
  const m = t.toUpperCase().match(/^(CABALLERO|HOMBRE|DAMA|MUJER|UNISEX|NI[NÑ]O|NI[NÑ]A)\s*[-·:]?\s*(.*)$/);
  if (m && m[2]) return { genero: m[1].replace('NINO', 'NIÑO').replace('NINA', 'NIÑA'), size: m[2].trim() };
  return { genero: 'TALLA', size: t };
}
export const ICONO_GEN: Record<string, string> = { CABALLERO: '👤', HOMBRE: '👤', DAMA: '👩', MUJER: '👩', UNISEX: '🧥', TALLA: '📏' };

export function agrupar(tallas: string[]): { genero: string; items: { full: string; size: string }[] }[] {
  const orden = ['CABALLERO', 'HOMBRE', 'DAMA', 'MUJER', 'UNISEX', 'TALLA'];
  const map = new Map<string, { full: string; size: string }[]>();
  for (const t of tallas) {
    const { genero, size } = parseTalla(t);
    if (!map.has(genero)) map.set(genero, []);
    map.get(genero)!.push({ full: t, size });
  }
  return [...map.entries()]
    .sort((a, b) => orden.indexOf(a[0]) - orden.indexOf(b[0]))
    .map(([genero, items]) => ({ genero, items }));
}

// Mezcla los productos de forma variada: intercala categorías (un fútbol, uno
// de parejas, uno de carro…) y cambia el orden en cada carga.
function mezclarVariado(items: Promo[]): Promo[] {
  const shuffle = <T,>(a: T[]) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  const grupos = new Map<string, Promo[]>();
  for (const p of items) { const k = (p.categoria || '—').trim() || '—'; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k)!.push(p); }
  const arrs = [...grupos.values()].map(a => shuffle(a));
  const out: Promo[] = [];
  let quedan = true;
  while (quedan) {
    quedan = false;
    for (const a of shuffle(arrs)) { const p = a.shift(); if (p) { out.push(p); quedan = true; } }
  }
  return out;
}

export default function PromosLista({ promos, sellerWa, sellerNombre, sellerCodigo, sellerToken }: { promos: Promo[]; sellerWa?: string | null; sellerNombre?: string | null; sellerCodigo?: string | null; sellerToken?: string | null }) {
  // Modo vendedor: si viene un número de vendedor, se oculta "COMPRAR AQUÍ" y
  // el combo; el botón de WhatsApp de cada producto va al número del vendedor.
  const sellerMode = !!sellerWa;
  const waNumber = sellerWa || WA;
  const [compra, setCompra] = useState<{ promo: Promo; talla: string; color: string } | null>(null);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [orderPrecio, setOrderPrecio] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [comboOpen, setComboOpen] = useState(false);
  const toggleSel = (id: string) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const seleccionados = promos.filter(p => sel.has(p.id));
  // Orden mezclado (se calcula tras montar para no romper la hidratación).
  // Estos productos van SIEMPRE de primeros, en este orden; el resto aleatorio.
  const [orden, setOrden] = useState<Promo[]>(promos);
  useEffect(() => {
    // Solo productos CON stock (los agotados se ocultan hasta que se reponga).
    const conStock = promos.filter(disponible);
    // Productos anclados (fijados desde el panel) van SIEMPRE de primeros; el resto aleatorio.
    const fijos = conStock.filter(p => p.anclado);
    const resto = conStock.filter(p => !p.anclado);
    setOrden([...fijos, ...mezclarVariado(resto)]);
  }, [promos]);

  // Categorías presentes (ordenadas por cantidad de productos), solo con stock.
  const cats = (() => {
    const c: Record<string, number> = {};
    for (const p of promos) { if (!disponible(p)) continue; const k = (p.categoria || '').trim(); if (k) c[k] = (c[k] || 0) + 1; }
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n }));
  })();
  let visibles = cat ? orden.filter(p => (p.categoria || '').trim() === cat) : orden;
  // Buscador por palabras clave: nombre, categoría, referencia y colores.
  const nq = norm(q).trim();
  if (nq) {
    const words = nq.split(/\s+/);
    visibles = visibles.filter(p => {
      const heno = norm([p.nombre, p.categoria, p.referencia, ...coloresDe(p)].filter(Boolean).join(' '));
      return words.every(w => heno.includes(w));
    });
  }
  if (orderPrecio) visibles = [...visibles].sort((a, b) => (a.precio || 0) - (b.precio || 0));

  return (
    <>
      <style>{CSS}</style>
      <div className="pr-searchbar">
        <span className="pr-searchico">🔎</span>
        <input
          className="pr-searchinput"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar producto… (ej: nacional, ferrari, negro)"
          inputMode="search"
        />
        {q && <button className="pr-searchclear" onClick={() => setQ('')} aria-label="Limpiar">✕</button>}
      </div>
      <div className="pr-catbar">
        {cats.length > 1 && (
          <>
            <label className="pr-catlbl">📂 Categoría</label>
            <div className="pr-catselwrap">
              <select className="pr-catsel" value={cat} onChange={e => setCat(e.target.value)}>
                <option value="">Todas ({promos.length})</option>
                {cats.map(c => <option key={c.k} value={c.k}>{c.k} ({c.n})</option>)}
              </select>
              <span className="pr-catchevron">▾</span>
            </div>
            {cat && <button className="pr-catclear" onClick={() => setCat('')}>✕ Quitar filtro</button>}
          </>
        )}
        <button className={`pr-sortbtn ${orderPrecio ? 'on' : ''}`} onClick={() => setOrderPrecio(v => !v)}>
          {orderPrecio ? '✓ ' : ''}💲 Menor precio
        </button>
      </div>
      {sellerMode && sellerNombre && (
        <div className="pr-sellerbar">🛍️ Estás comprando con <b>{sellerNombre}</b> · pago contra entrega</div>
      )}
      <div className="pr-wrap">
        {visibles.map((p, i) => <Card key={p.id} p={p} idx={i} sellerMode={sellerMode} waNumber={waNumber} sellerCodigo={sellerCodigo} sellerToken={sellerToken} selected={sel.has(p.id)} onToggle={() => toggleSel(p.id)} onComprar={(talla, color) => setCompra({ promo: p, talla, color })} />)}
      </div>
      {visibles.length === 0 && <p style={{ textAlign: 'center', color: '#7f938f', padding: '30px 16px' }}>{nq ? `No encontramos productos para "${q}".` : 'No hay productos en esta categoría.'}</p>}
      {compra && <ModalCompra promo={compra.promo} initialTalla={compra.talla} initialColor={compra.color} onClose={() => setCompra(null)} />}

      {!sellerMode && seleccionados.length >= 2 && !comboOpen && (
        <button className="pr-cartbar" onClick={() => setComboOpen(true)}>
          <span className="pr-cartcount">{seleccionados.length}</span>
          <span>COMPRAR {seleccionados.length} PRENDAS · <b>{pesos(seleccionados.reduce((s, p) => s + conCombo(p.precio), 0))}</b></span>
          <span className="pr-cartgo">›</span>
        </button>
      )}
      {!sellerMode && comboOpen && <ComboModal promos={seleccionados} onClose={() => setComboOpen(false)} onDone={() => { setSel(new Set()); setComboOpen(false); }} />}
    </>
  );
}

function ColorPills({ colores, sel, onPick }: { colores: string[]; sel: string; onPick: (c: string) => void }) {
  if (colores.length === 0) return null;
  return (
    <div className="pr-colores">
      <div className="pr-genlabel">🎨 Color{colores.length > 1 ? `: elige uno (${colores.length})` : ''}</div>
      <div className="pr-pills">
        {colores.map(c => (
          <button key={c} onClick={() => onPick(c)} className={`pr-colorpill ${sel === c ? 'on' : ''}`}>
            <span className="pr-swatch" style={{ background: hexColor(c) }} />{c}
          </button>
        ))}
      </div>
    </div>
  );
}

function Card({ p, idx, onComprar, selected, onToggle, sellerMode, waNumber, sellerCodigo, sellerToken }: { p: Promo; idx: number; onComprar: (talla: string, color: string) => void; selected: boolean; onToggle: () => void; sellerMode?: boolean; waNumber: string; sellerCodigo?: string | null; sellerToken?: string | null }) {
  const colores = coloresDe(p);
  const [color, setColor] = useState(colores[0] || '');
  const [talla, setTalla] = useState('');
  const cambiarColor = (c: string) => { setColor(c); setTalla(''); };

  const conFoto = coloresConFoto(p);
  const grupos = agrupar(tallasEnColor(p, color));
  const total = stockTotal(p);
  const desc = (p.precio_antes && p.precio_antes > p.precio) ? Math.round((1 - p.precio / p.precio_antes) * 100) : 0;
  const ultimas = controla(p) && total <= 3 && total > 0;
  const pocas = controla(p) && total > 3 && total <= 7;
  const agotado = controla(p) && total <= 0;

  // Tanto el enlace principal como el de vendedor mandan el LINK de la página del
  // producto, para que WhatsApp muestre la TARJETA con la foto y se pueda abrir el
  // producto con sus tallas. En modo vendedor se agrega ?v= (número del vendedor)
  // y ?k= (token para "marcar vendido"); en el principal no van.
  const qs = new URLSearchParams();
  if (sellerCodigo) qs.set('v', sellerCodigo);
  if (color) qs.set('color', color);
  // Token para "marcar vendido": solo el del vendedor (con ?v=). El del principal
  // ya no viaja en el enlace: lo veía cualquier cliente (lib/promo-principal.ts).
  if (sellerToken) qs.set('k', sellerToken);
  const urlProducto = `${SITE}/promos/${p.id}${qs.toString() ? `?${qs.toString()}` : ''}`;
  const waText = encodeURIComponent(
    `¡Hola! 😊 Quiero este producto:\n*${p.nombre}*${p.referencia ? `\nRef: ${p.referencia}` : ''}${color ? `\nColor: ${color}` : ''}${talla ? `\nTalla: ${talla.replace(' - ', ' ')}` : ''}\nValor: ${pesos(p.precio)}\n${urlProducto}`,
  );

  return (
    <article className="pr-card" style={{ animationDelay: `${Math.min(idx * 60, 400)}ms` }}>
      <div className="pr-imgwrap">
        {!sellerMode && <button className={`pr-check ${selected ? 'on' : ''}`} onClick={onToggle} title="Seleccionar para combo" aria-label="Seleccionar">{selected ? '✓' : ''}</button>}
        {p.destacado && <div className="pr-oro">⭐ MÁS VENDIDO</div>}
        {fotoDeColor(p, color)
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={fotoDeColor(p, color)} alt={p.nombre} className="pr-img" loading="lazy" />
          : <div className="pr-img pr-noimg">🛍️</div>}
        {conFoto.length > 1 && (
          <div className="pr-thumbs">
            {conFoto.map(c => (
              <button key={c} onClick={() => cambiarColor(c)} title={c}
                className={`pr-thumb ${color === c ? 'on' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.fotos![c]} alt={c} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pr-body">
        <h3 className="pr-name">{p.nombre}</h3>

        <div className="pr-prices">
          <span className="pr-price">{pesos(p.precio)}</span>
          {p.precio_antes ? <span className="pr-price-old">{pesos(p.precio_antes)}</span> : null}
          {desc > 0 && <span className="pr-descbadge">-{desc}%</span>}
        </div>

        {ultimas && <p className="pr-urgencia rojo">🔥 SOLO QUEDAN {total} {total === 1 ? 'UNIDAD' : 'UNIDADES'}</p>}
        {pocas && <p className="pr-urgencia amar">⚡ QUEDAN POCAS UNIDADES</p>}

        {!agotado && colores.length > 0 && (
          <>
            <div className="pr-hint">Selecciona el color para ver las tallas disponibles</div>
            <div className="pr-swrow">
              {colores.map(c => (
                <button key={c} title={c} onClick={() => cambiarColor(c)}
                  className={`pr-sdot ${color === c ? 'on' : ''}`}>
                  <span style={{ background: hexColor(c) }} />
                </button>
              ))}
            </div>
          </>
        )}

        {!agotado && grupos.length > 0 && (
          <div className="pr-tallas">
            <div className="pr-tallas-aviso">🔥 TALLAS DISPONIBLES 👇</div>
            <div className="pr-tallas-cols">
              {grupos.map(g => (
                <div key={g.genero} className="pr-genwrap">
                  {g.genero !== 'TALLA' && <div className="pr-genlabel">{ICONO_GEN[g.genero] ?? '📏'} {g.genero}</div>}
                  <div className="pr-pills">
                    {g.items.map(it => (
                      <button key={it.full}
                        onClick={() => setTalla(it.full === talla ? '' : it.full)}
                        className={`pr-pill ${talla === it.full ? 'on' : ''}`}>
                        {it.size}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {agotado && <p className="pr-urgencia rojo" style={{ textAlign: 'center' }}>AGOTADO por ahora 😔</p>}

        <div className="pr-ctas">
          {!sellerMode && <button className="pr-cta" disabled={agotado} onClick={() => onComprar(talla, color)}>COMPRAR AQUÍ</button>}
          <a className="pr-wa" href={`https://wa.me/${waNumber}?text=${waText}`} target="_blank" rel="noreferrer">COMPRAR POR WHATSAPP</a>
        </div>
      </div>
    </article>
  );
}

function ModalCompra({ promo, initialTalla, initialColor, onClose }: { promo: Promo; initialTalla?: string; initialColor?: string; onClose: () => void }) {
  const colores = coloresDe(promo);
  const precioDe = (n: number) => n === 3 ? (promo.precio_tres ?? promo.precio * 3) : n === 2 ? (promo.precio_dos ?? promo.precio * 2) : promo.precio;

  const [color, setColor] = useState(initialColor || colores[0] || '');
  const grupos = agrupar(tallasEnColor(promo, color));
  const hayTallas = grupos.length > 0;

  // Unidades disponibles en el color elegido → limita cuántas prendas puede pedir.
  const dispoColor = hayVar(promo)
    ? Object.values(promo.variantes![color] || {}).reduce((a, n) => a + (Number(n) || 0), 0)
    : (promo.stock && Object.keys(promo.stock).length ? Object.values(promo.stock).reduce((a, n) => a + (Number(n) || 0), 0) : Infinity);
  const maxQty = Math.min(3, dispoColor);
  // Solo habilita 2 o 3 prendas si hay stock suficiente (y si el producto tiene ese precio).
  const qtyOptions = [1, ...(maxQty >= 2 ? [2] : []), ...(maxQty >= 3 ? [3] : [])];

  const [cantidad, setCantidad] = useState(1);
  const [sel, setSel] = useState<string[]>([initialTalla || '']);
  const setTallaI = (i: number, t: string) => setSel(prev => { const a = [...prev]; a[i] = t; return a; });
  const setCant = (n: number) => { setCantidad(n); setSel(prev => { const a = [...prev]; while (a.length < n) a.push(''); return a.slice(0, n); }); };
  const cambiarColor = (c: string) => { setColor(c); setSel(Array(cantidad).fill('')); };
  // Si el color elegido no alcanza para la cantidad seleccionada, la baja al máximo posible.
  useEffect(() => { if (cantidad > maxQty) setCant(maxQty < 1 ? 1 : maxQty); }, [maxQty]); // eslint-disable-line react-hooks/exhaustive-deps

  const [f, setF] = useState({ nombre: '', telefono: '', direccion: '', ciudad: '', departamento: '', correo: '' });
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const total = precioDe(cantidad);

  async function enviar() {
    setErr(null);
    if (!f.nombre.trim()) { setErr('Escribe tu nombre.'); return; }
    if (colores.length > 0 && !color) { setErr('Elige el color.'); return; }
    const elegidas = sel.slice(0, cantidad);
    if (hayTallas && elegidas.some(t => !t.trim())) { setErr('Elige la talla de cada prenda.'); return; }
    if (hayTallas) {
      const conteo: Record<string, number> = {};
      for (const t of elegidas) conteo[t] = (conteo[t] ?? 0) + 1;
      for (const [t, n] of Object.entries(conteo)) if (dispoTC(promo, color, t) < n) { setErr(`Ya no hay suficientes en esa talla/color.`); return; }
    }
    if (!/^3\d{9}$/.test(f.telefono.replace(/\D/g, '').slice(-10))) { setErr('Escribe un celular válido (10 dígitos).'); return; }
    if (!f.direccion.trim() || !f.ciudad.trim()) { setErr('Completa dirección y ciudad.'); return; }
    setEnviando(true);
    try {
      const tallaFinal = elegidas.filter(Boolean).map(t => t.replace(' - ', ' ')).join(' + ');
      const productoFinal = `${promo.nombre}${color ? ` - ${color}` : ''}${cantidad > 1 ? ` (${cantidad} prendas)` : ''}`;
      const res = await fetch('/api/promociones/pedido', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, promoId: promo.id, producto: productoFinal, precio: total, cantidad, color, talla: tallaFinal, tallas: elegidas, foto: fotoDeColor(promo, color) }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || 'No se pudo enviar el pedido.'); return; }
      setOk(true);
    } catch { setErr('Error de conexión. Intenta de nuevo.'); }
    finally { setEnviando(false); }
  }

  return (
    <div className="pr-modal-bg" onClick={onClose}>
      <div className="pr-modal" onClick={e => e.stopPropagation()}>
        {ok ? (
          <div style={{ textAlign: 'center', padding: '20px 6px' }}>
            <div style={{ fontSize: 44 }}>✅</div>
            <h3 style={{ fontSize: 19, fontWeight: 800, color: '#22D3C5', margin: '6px 0' }}>¡Pedido recibido!</h3>
            <p style={{ fontSize: 14, color: '#cfe3df' }}>Te acabamos de escribir por WhatsApp con el resumen de tu pedido. Revisa tu chat 📲</p>
            <button className="pr-cta" style={{ marginTop: 16 }} onClick={onClose}>Listo</button>
          </div>
        ) : (
          <>
            <div className="pr-modal-head">
              {fotoDeColor(promo, color) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoDeColor(promo, color)} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover' }} />
              )}
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.15 }}>{promo.nombre}</h3>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#22D3C5' }}>{pesos(total)}</p>
              </div>
              <button onClick={onClose} className="pr-x">✕</button>
            </div>
            <div className="pr-aviso-top">👇 Selecciona la talla y llena los datos de envío</div>
            <p style={{ fontSize: 12, color: '#9fb4b0', margin: '0 0 2px' }}>Te confirmamos por WhatsApp. Pago contra entrega 🚚</p>

            {colores.length > 0 && (
              <div>
                <ColorPills colores={colores} sel={color} onPick={cambiarColor} />
              </div>
            )}

            <div className="pr-qtyrow">
              <span className="pr-qtylbl">Cantidad</span>
              {qtyOptions.map(n => (
                <button key={n} onClick={() => setCant(n)} className={`pr-qtymini ${cantidad === n ? 'on' : ''}`}>{n}</button>
              ))}
              <span className="pr-qtyhint">prenda{cantidad > 1 ? 's' : ''}</span>
            </div>

            {hayTallas && <div className="pr-elige">👇 Elige tu talla</div>}
            {hayTallas && Array.from({ length: cantidad }).map((_, i) => (
              <div key={i}>
                <div className="pr-lbl">{cantidad > 1 ? `Talla — prenda ${i + 1}` : 'Talla'}{color ? ` · ${color}` : ''}</div>
                {grupos.map(g => (
                  <div key={g.genero} className="pr-genwrap dark">
                    {g.genero !== 'TALLA' && <div className="pr-genlabel">{ICONO_GEN[g.genero] ?? '📏'} {g.genero}</div>}
                    <div className="pr-pills">
                      {g.items.map(it => (
                        <button key={it.full} onClick={() => setTallaI(i, it.full)}
                          className={`pr-pill ${sel[i] === it.full ? 'on' : ''}`}>{it.size}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div className="pr-total">
              <span>{cantidad} {cantidad === 1 ? 'prenda' : 'prendas'}{color ? ` · ${color}` : ''}</span>
              <span className="pr-total-num">{pesos(total)}</span>
            </div>

            <input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} className="pr-input" placeholder="Nombre completo" />
            <input value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} className="pr-input" placeholder="Celular (WhatsApp)" inputMode="numeric" />
            <input value={f.direccion} onChange={e => setF({ ...f, direccion: e.target.value })} className="pr-input" placeholder="Dirección completa" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input value={f.ciudad} onChange={e => setF({ ...f, ciudad: e.target.value })} className="pr-input" placeholder="Ciudad" />
              <input value={f.departamento} onChange={e => setF({ ...f, departamento: e.target.value })} className="pr-input" placeholder="Departamento" />
            </div>
            <input value={f.correo} onChange={e => setF({ ...f, correo: e.target.value })} className="pr-input" placeholder="Correo (opcional)" />

            {err && <p style={{ fontSize: 13, fontWeight: 700, color: '#ff6b6b' }}>⚠️ {err}</p>}

            <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
              <button onClick={onClose} className="pr-cancel">Cancelar</button>
              <button onClick={enviar} disabled={enviando} className="pr-cta" style={{ flex: 1 }}>
                {enviando ? 'Enviando…' : 'Confirmar pedido'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ComboModal({ promos, onClose, onDone }: { promos: Promo[]; onClose: () => void; onDone: () => void }) {
  const [selc, setSelc] = useState<Record<string, { color: string; talla: string }>>(() => {
    const o: Record<string, { color: string; talla: string }> = {};
    for (const p of promos) { const c = coloresDe(p); o[p.id] = { color: c[0] || '', talla: '' }; }
    return o;
  });
  const setColor = (id: string, color: string) => setSelc(s => ({ ...s, [id]: { color, talla: '' } }));
  const setTalla = (id: string, talla: string) => setSelc(s => ({ ...s, [id]: { ...s[id], talla } }));
  const total = promos.reduce((s, p) => s + conCombo(p.precio), 0);
  const totalNormal = promos.reduce((s, p) => s + (p.precio || 0), 0);

  const [f, setF] = useState({ nombre: '', telefono: '', direccion: '', ciudad: '', departamento: '', correo: '' });
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function enviar() {
    setErr(null);
    for (const p of promos) {
      const sc = selc[p.id];
      if (coloresDe(p).length > 0 && !sc.color) { setErr(`Elige el color de "${p.nombre}".`); return; }
      if (agrupar(tallasEnColor(p, sc.color)).length > 0 && !sc.talla) { setErr(`Elige la talla de "${p.nombre}".`); return; }
    }
    if (!f.nombre.trim()) { setErr('Escribe tu nombre.'); return; }
    if (!/^3\d{9}$/.test(f.telefono.replace(/\D/g, '').slice(-10))) { setErr('Escribe un celular válido (10 dígitos).'); return; }
    if (!f.direccion.trim() || !f.ciudad.trim()) { setErr('Completa dirección y ciudad.'); return; }
    setEnviando(true);
    try {
      const items = promos.map(p => { const sc = selc[p.id]; return { promoId: p.id, producto: p.nombre, color: sc.color, talla: sc.talla, tallas: [sc.talla], precio: conCombo(p.precio), foto: fotoDeColor(p, sc.color) }; });
      const res = await fetch('/api/promociones/pedido-multi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, items }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || 'No se pudo enviar el pedido.'); return; }
      setOk(true);
    } catch { setErr('Error de conexión. Intenta de nuevo.'); }
    finally { setEnviando(false); }
  }

  return (
    <div className="pr-modal-bg" onClick={onClose}>
      <div className="pr-modal" onClick={e => e.stopPropagation()}>
        {ok ? (
          <div style={{ textAlign: 'center', padding: '20px 6px' }}>
            <div style={{ fontSize: 44 }}>✅</div>
            <h3 style={{ fontSize: 19, fontWeight: 800, color: '#22D3C5', margin: '6px 0' }}>¡Combo recibido!</h3>
            <p style={{ fontSize: 14, color: '#cfe3df' }}>Te escribimos por WhatsApp con el resumen de tus {promos.length} productos. Revisa tu chat 📲</p>
            <button className="pr-cta" style={{ marginTop: 16 }} onClick={onDone}>Listo</button>
          </div>
        ) : (
          <>
            <div className="pr-modal-head">
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>🛒 Comprar combo</h3>
                <p style={{ fontSize: 12, color: '#22D3C5', fontWeight: 800 }}>🔥 12% de descuento por llevar {promos.length} prendas</p>
              </div>
              <button onClick={onClose} className="pr-x">✕</button>
            </div>

            <div className="pr-cartlist">
              {promos.map(p => {
                const sc = selc[p.id];
                const grupos = agrupar(tallasEnColor(p, sc.color));
                const cols = coloresDe(p);
                return (
                  <div key={p.id} className="pr-comboitem">
                    <div className="pr-combohead">
                      {fotoDeColor(p, sc.color)
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={fotoDeColor(p, sc.color)} alt="" />
                        : <div className="pr-cartnoimg">🛍️</div>}
                      <div className="pr-cartinfo">
                        <p className="pr-cartname">{p.nombre}</p>
                        <p className="pr-cartprice">{pesos(conCombo(p.precio))} <span className="pr-price-old" style={{ fontSize: 11 }}>{pesos(p.precio)}</span></p>
                      </div>
                    </div>
                    {cols.length > 0 && (
                      <div className="pr-pills" style={{ marginTop: 6 }}>
                        {cols.map(c => (
                          <button key={c} onClick={() => setColor(p.id, c)} className={`pr-colorpill ${sc.color === c ? 'on' : ''}`}>
                            <span className="pr-swatch" style={{ background: hexColor(c) }} />{c}
                          </button>
                        ))}
                      </div>
                    )}
                    {grupos.map(g => (
                      <div key={g.genero} className="pr-genwrap dark" style={{ marginTop: 6 }}>
                        {g.genero !== 'TALLA' && <div className="pr-genlabel">{ICONO_GEN[g.genero] ?? '📏'} {g.genero}</div>}
                        <div className="pr-pills">
                          {g.items.map(it => (
                            <button key={it.full} onClick={() => setTalla(p.id, it.full)} className={`pr-pill ${sc.talla === it.full ? 'on' : ''}`}>{it.size}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className="pr-total"><span>Total {promos.length} prendas <span className="pr-price-old" style={{ fontSize: 11 }}>{pesos(totalNormal)}</span></span><span className="pr-total-num">{pesos(total)}</span></div>
            <p style={{ fontSize: 12, color: '#9fb4b0', margin: '0 0 2px' }}>Llena tus datos y te confirmamos por WhatsApp. Pago contra entrega 🚚</p>

            <input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} className="pr-input" placeholder="Nombre completo" />
            <input value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} className="pr-input" placeholder="Celular (WhatsApp)" inputMode="numeric" />
            <input value={f.direccion} onChange={e => setF({ ...f, direccion: e.target.value })} className="pr-input" placeholder="Dirección completa" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input value={f.ciudad} onChange={e => setF({ ...f, ciudad: e.target.value })} className="pr-input" placeholder="Ciudad" />
              <input value={f.departamento} onChange={e => setF({ ...f, departamento: e.target.value })} className="pr-input" placeholder="Departamento" />
            </div>
            <input value={f.correo} onChange={e => setF({ ...f, correo: e.target.value })} className="pr-input" placeholder="Correo (opcional)" />

            {err && <p style={{ fontSize: 13, fontWeight: 700, color: '#ff6b6b' }}>⚠️ {err}</p>}
            <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
              <button onClick={onClose} className="pr-cancel">Seguir viendo</button>
              <button onClick={enviar} disabled={enviando} className="pr-cta" style={{ flex: 1 }}>
                {enviando ? 'Enviando…' : 'Confirmar combo'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.pr-searchbar{display:flex;align-items:center;gap:8px;max-width:1200px;margin:0 auto;padding:10px 12px 4px}
.pr-searchico{font-size:15px;flex:0 0 auto}
.pr-searchinput{flex:1 1 auto;min-width:0;background:linear-gradient(160deg,#10322d,#0b1b1a);color:#fff;border:1.5px solid rgba(34,211,197,.4);border-radius:12px;padding:11px 14px;font-size:14px;font-weight:600}
.pr-searchinput::placeholder{color:#8aa39e;font-weight:500}
.pr-searchinput:focus{outline:none;border-color:#22D3C5;box-shadow:0 0 0 3px rgba(34,211,197,.2)}
.pr-searchclear{flex:0 0 auto;width:36px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#cfe3df;font-size:14px;cursor:pointer}
.pr-searchclear:hover{background:rgba(255,255,255,.14)}
.pr-catbar{position:sticky;top:0;z-index:30;margin:0 auto;padding:9px 12px;display:flex;align-items:center;gap:7px;flex-wrap:nowrap;background:rgba(8,20,19,.94);backdrop-filter:blur(8px);border-bottom:1px solid rgba(34,211,197,.18);box-shadow:0 8px 24px rgba(0,0,0,.35)}
.pr-catlbl{font-size:10.5px;font-weight:800;color:#22D3C5;text-transform:uppercase;letter-spacing:.03em;white-space:nowrap;flex:0 0 auto}
.pr-catselwrap{position:relative;display:flex;align-items:center;flex:1 1 auto;min-width:0}
.pr-catsel{appearance:none;-webkit-appearance:none;width:100%;min-width:0;background:linear-gradient(160deg,#10322d,#0b1b1a);color:#fff;border:1.5px solid rgba(34,211,197,.4);border-radius:11px;padding:9px 28px 9px 12px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35);text-overflow:ellipsis}
.pr-catsel:focus{outline:none;border-color:#22D3C5;box-shadow:0 0 0 3px rgba(34,211,197,.2)}
.pr-catsel option{background:#0b1b1a;color:#fff}
.pr-catchevron{position:absolute;right:11px;color:#22D3C5;font-size:11px;pointer-events:none}
.pr-catclear{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#cfe3df;border-radius:10px;padding:8px 10px;font-size:11px;font-weight:700;cursor:pointer;flex:0 0 auto;white-space:nowrap}
.pr-catclear:hover{background:rgba(255,255,255,.14)}
.pr-sortbtn{background:linear-gradient(160deg,#10322d,#0b1b1a);border:1.5px solid rgba(34,211,197,.4);color:#fff;border-radius:11px;padding:9px 11px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;flex:0 0 auto;transition:.18s}
.pr-sortbtn:hover{border-color:#22D3C5}
.pr-sortbtn.on{background:#22D3C5;color:#04211d;border-color:#22D3C5;box-shadow:0 0 12px rgba(34,211,197,.4)}
.pr-topcount{margin-left:auto}
.pr-topcount .pr-timer{margin:0}
.pr-sellerbar{max-width:1200px;margin:0 auto;padding:8px 14px;text-align:center;font-size:12px;color:#cfe3df;background:rgba(46,204,91,.10);border-bottom:1px solid rgba(46,204,91,.25)}
.pr-sellerbar b{color:#2ECC5B}
.pr-wrap{max-width:1200px;margin:0 auto;padding:20px 14px 40px;display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:18px}
.pr-card{background:linear-gradient(160deg,#0f2a26 0%,#0b1b1a 60%,#081413 100%);border:1px solid rgba(34,211,197,.28);border-radius:20px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.45);display:flex;flex-direction:column;opacity:0;transform:translateY(14px);animation:prIn .5s ease forwards;transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}
@media(hover:hover){.pr-card:hover{transform:translateY(-6px);border-color:rgba(34,211,197,.6);box-shadow:0 26px 60px rgba(0,176,160,.25)}}
@keyframes prIn{to{opacity:1;transform:none}}
.pr-imgwrap{position:relative;aspect-ratio:1/1;background:radial-gradient(120% 120% at 50% 0%,#12352f,#081413);display:flex;align-items:center;justify-content:center}
.pr-img{width:100%;height:100%;object-fit:cover;display:block}
.pr-noimg{font-size:52px}
.pr-thumbs{position:absolute;left:8px;right:8px;bottom:8px;display:flex;gap:6px;flex-wrap:wrap;z-index:3}
.pr-thumb{width:44px;height:44px;border-radius:9px;overflow:hidden;padding:0;border:2px solid rgba(255,255,255,.55);background:#0b1b1a;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.5);transition:.18s}
.pr-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.pr-thumb.on{border-color:#22D3C5;box-shadow:0 0 12px rgba(34,211,197,.7)}
@media(hover:hover){.pr-thumb:hover{border-color:#22D3C5}}
.pr-ref{position:absolute;top:10px;left:10px;background:#c81e1e;color:#fff;border-radius:8px;padding:4px 8px;text-align:center;line-height:1;box-shadow:0 4px 12px rgba(0,0,0,.4);z-index:3}
.pr-ref span{display:block;font-size:7px;font-weight:800;letter-spacing:.12em}
.pr-ref b{font-size:15px;font-weight:900}
.pr-oro{position:absolute;top:10px;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,#E8B54A,#F7E08A);color:#4a3600;font-size:10px;font-weight:900;letter-spacing:.04em;padding:4px 10px;border-radius:999px;box-shadow:0 4px 12px rgba(230,180,74,.5);z-index:3;white-space:nowrap}
.pr-sticker{position:absolute;top:-6px;right:-6px;width:78px;height:78px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff5a5a,#c81e1e 70%);color:#fff;font-size:10px;font-weight:900;line-height:1.05;display:flex;align-items:center;justify-content:center;text-align:center;box-shadow:0 6px 16px rgba(200,30,30,.6);border:2px solid #fff2;z-index:4;animation:prPulse 2.2s ease-in-out infinite}
@keyframes prPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
.pr-body{padding:14px 14px 16px;display:flex;flex-direction:column;gap:10px;flex:1}
.pr-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.pr-name{font-size:16px;font-weight:900;color:#fff;line-height:1.15;text-align:center;text-transform:uppercase;letter-spacing:.01em}
.pr-descbadge{flex:0 0 auto;background:#22D3C5;color:#04211d;font-size:11px;font-weight:900;padding:3px 8px;border-radius:8px}
.pr-prices{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:center}
.pr-hint{font-size:9.5px;color:#8aa39e;text-align:center;text-transform:uppercase;letter-spacing:.02em;line-height:1.2;margin:-2px 0}
.pr-price{font-size:26px;font-weight:900;color:#22D3C5;text-shadow:0 0 18px rgba(34,211,197,.35)}
.pr-price-old{font-size:14px;color:#7f938f;text-decoration:line-through}
.pr-promo-tag{margin-left:auto;font-size:10px;font-weight:800;color:#E8B54A;border:1px solid rgba(232,181,74,.5);border-radius:999px;padding:2px 8px}
.pr-urgencia{font-size:12px;font-weight:900;margin:-2px 0;text-align:center;letter-spacing:.02em}
.pr-urgencia.rojo{color:#ff5a5a}
.pr-urgencia.amar{color:#F4C24A}
.pr-swrow{justify-content:center}
.pr-colores{display:flex;flex-direction:column;gap:6px}
.pr-colorpill{display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 6px;border-radius:999px;border:1.5px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);color:#fff;font-size:12px;font-weight:700;cursor:pointer;transition:.18s}
@media(hover:hover){.pr-colorpill:hover{border-color:#22D3C5}}
.pr-colorpill.on{border-color:#22D3C5;background:rgba(34,211,197,.16);box-shadow:0 0 10px rgba(34,211,197,.4)}
.pr-swatch{width:16px;height:16px;border-radius:50%;border:1.5px solid rgba(255,255,255,.5);flex:none}
.pr-swrow{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.pr-sdot{width:24px;height:24px;padding:2px;border-radius:50%;border:2px solid rgba(255,255,255,.25);background:transparent;cursor:pointer;line-height:0;flex:0 0 auto;transition:.15s}
.pr-sdot span{display:block;width:100%;height:100%;border-radius:50%}
.pr-sdot.on{border-color:#22D3C5;box-shadow:0 0 8px rgba(34,211,197,.6)}
@media(hover:hover){.pr-sdot:hover{border-color:#22D3C5}}
.pr-tallas{display:flex;flex-direction:column;gap:8px}
.pr-tallas-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.pr-tallas-aviso{font-size:12px;font-weight:800;color:#F4C24A;letter-spacing:.02em;text-align:center;text-transform:uppercase}
.pr-genwrap{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:8px 9px}
.pr-genwrap.dark{background:rgba(255,255,255,.04)}
.pr-genlabel{font-size:10px;font-weight:800;letter-spacing:.06em;color:#9fb4b0;margin-bottom:6px;text-transform:uppercase}
.pr-pills{display:flex;flex-wrap:wrap;gap:6px}
.pr-pill{min-width:38px;padding:6px 10px;border-radius:9px;border:1.5px solid rgba(255,255,255,.18);background:rgba(255,255,255,.03);color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:.18s}
@media(hover:hover){.pr-pill:hover:not(.off){border-color:#22D3C5;box-shadow:0 0 10px rgba(34,211,197,.4)}}
.pr-pill.on{background:#22D3C5;color:#04211d;border-color:#22D3C5;box-shadow:0 0 12px rgba(34,211,197,.5)}
.pr-pill.off{opacity:.35;text-decoration:line-through;cursor:not-allowed}
.pr-ctas{margin-top:auto;display:flex;flex-direction:row;gap:6px;padding-top:4px}
.pr-timer{display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(200,30,30,.14);border:1px solid rgba(255,90,90,.4);border-radius:10px;padding:6px 9px}
.pr-timer-txt{font-size:9.5px;font-weight:800;color:#ffb3b3;line-height:1.1;text-transform:uppercase;letter-spacing:.02em}
.pr-timer-clock{flex:0 0 auto;font-size:14px;font-weight:900;color:#fff;font-variant-numeric:tabular-nums;background:#c81e1e;border-radius:7px;padding:3px 7px;box-shadow:0 0 12px rgba(200,30,30,.5)}
.pr-cta{flex:1;min-width:0;padding:10px 6px;border:none;border-radius:12px;background:#12A9C9;color:#fff;font-size:13px;font-weight:900;cursor:pointer;text-transform:uppercase;line-height:1.08;text-align:center;transition:.15s;display:flex;align-items:center;justify-content:center}
.pr-cta:hover{filter:brightness(1.08)}
.pr-cta:disabled{opacity:.5;cursor:not-allowed}
.pr-wa{flex:1;min-width:0;padding:10px 6px;border-radius:12px;background:#2ECC5B;color:#fff;font-size:13px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;line-height:1.08;display:flex;align-items:center;justify-content:center}
.pr-wa:hover{filter:brightness(1.08)}
.pr-modal-bg{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;padding:0}
@media(min-width:640px){.pr-modal-bg{align-items:center;padding:16px}}
.pr-modal{background:linear-gradient(160deg,#10322d,#0b1b1a);border:1px solid rgba(34,211,197,.3);width:100%;max-width:440px;max-height:94vh;overflow-y:auto;border-radius:20px 20px 0 0;padding:18px;display:flex;flex-direction:column;gap:10px;color:#fff;box-shadow:0 -10px 40px rgba(0,0,0,.5)}
@media(min-width:640px){.pr-modal{border-radius:20px}}
.pr-modal-head{display:flex;align-items:center;gap:12px}
.pr-x{margin-left:auto;background:rgba(255,255,255,.1);border:none;color:#fff;width:30px;height:30px;border-radius:50%;font-size:15px;cursor:pointer}
.pr-lbl{font-size:11px;font-weight:800;text-transform:uppercase;color:#cfe3df;margin-bottom:6px}
.pr-aviso-top{background:linear-gradient(90deg,rgba(34,211,197,.20),rgba(34,211,197,.05));border:1px solid rgba(34,211,197,.45);color:#22D3C5;font-size:12.5px;font-weight:800;text-align:center;padding:9px;border-radius:11px;animation:prAvisoPulse 1.8s ease-in-out infinite}
@keyframes prAvisoPulse{0%,100%{box-shadow:0 0 0 rgba(34,211,197,0)}50%{box-shadow:0 0 16px rgba(34,211,197,.4)}}
.pr-modal .pr-genwrap .pr-pill:not(.on){animation:prPillBounce 1.5s ease-in-out infinite}
.pr-modal .pr-genwrap .pr-pill:nth-child(2):not(.on){animation-delay:.12s}
.pr-modal .pr-genwrap .pr-pill:nth-child(3):not(.on){animation-delay:.24s}
.pr-modal .pr-genwrap .pr-pill:nth-child(4):not(.on){animation-delay:.36s}
.pr-modal .pr-genwrap .pr-pill:nth-child(5):not(.on){animation-delay:.48s}
.pr-modal .pr-genwrap .pr-pill:nth-child(6):not(.on){animation-delay:.6s}
@keyframes prPillBounce{0%,100%{transform:translateY(0);border-color:rgba(255,255,255,.18)}50%{transform:translateY(-3px);border-color:rgba(34,211,197,.75);box-shadow:0 4px 10px rgba(34,211,197,.4)}}
/* Letrero "Elige tu talla" animado */
.pr-elige{background:linear-gradient(90deg,rgba(244,194,74,.18),rgba(244,194,74,.04));border:1px solid rgba(244,194,74,.5);color:#F4C24A;font-size:12.5px;font-weight:800;text-align:center;padding:8px;border-radius:10px;text-transform:uppercase;letter-spacing:.02em;animation:prEligePulse 1.6s ease-in-out infinite}
@keyframes prEligePulse{0%,100%{transform:scale(1);box-shadow:0 0 0 rgba(244,194,74,0)}50%{transform:scale(1.02);box-shadow:0 0 14px rgba(244,194,74,.4)}}
/* Etiqueta "Color: elige uno" animada + color pills que laten */
.pr-modal .pr-colores .pr-genlabel{color:#22D3C5;animation:prAvisoPulse 1.8s ease-in-out infinite;font-size:11px}
.pr-modal .pr-colorpill:not(.on){animation:prColorGlow 1.7s ease-in-out infinite}
@keyframes prColorGlow{0%,100%{border-color:rgba(255,255,255,.18)}50%{border-color:rgba(34,211,197,.7);box-shadow:0 0 10px rgba(34,211,197,.4)}}
.pr-qtyrow{display:flex;align-items:center;gap:6px}
.pr-qtylbl{font-size:11px;font-weight:800;text-transform:uppercase;color:#cfe3df}
.pr-qtymini{width:30px;height:30px;border-radius:8px;border:1.5px solid rgba(255,255,255,.2);background:transparent;color:#fff;font-size:13px;font-weight:800;cursor:pointer;transition:.15s}
.pr-qtymini.on{background:#22D3C5;color:#04211d;border-color:#22D3C5}
.pr-qtyhint{font-size:11px;color:#9fb4b0}
.pr-total{display:flex;align-items:center;justify-content:space-between;background:rgba(34,211,197,.12);border:1px solid rgba(34,211,197,.3);border-radius:12px;padding:10px 12px;font-size:13px;font-weight:700}
.pr-total-num{font-size:19px;font-weight:900;color:#22D3C5}
.pr-input{width:100%;padding:11px 12px;border-radius:11px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#fff;font-size:14px}
.pr-input::placeholder{color:#8aa39e}
.pr-cancel{padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#cfe3df;font-size:14px;cursor:pointer}
/* Botón agregar al carrito */
.pr-add{width:100%;padding:9px;border-radius:11px;border:1.5px dashed rgba(34,211,197,.6);background:rgba(34,211,197,.08);color:#22D3C5;font-size:12px;font-weight:800;cursor:pointer;transition:.15s}
.pr-add:hover:not(:disabled){background:rgba(34,211,197,.16)}
.pr-add:disabled{opacity:.45;cursor:not-allowed;border-style:solid}
.pr-add.ok{background:#22D3C5;color:#04211d;border-style:solid}
/* Barra flotante del carrito */
.pr-cartbar{position:fixed;left:50%;bottom:14px;z-index:60;width:min(92%,430px);display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#00C6A2,#22D3C5);color:#04211d;font-size:13.5px;font-weight:900;letter-spacing:.02em;white-space:nowrap;cursor:pointer;box-shadow:0 8px 26px rgba(34,211,197,.5);animation:prCartPulse 1.5s ease-in-out infinite}
@keyframes prCartPulse{0%,100%{transform:translateX(-50%) scale(1);box-shadow:0 8px 22px rgba(34,211,197,.45)}50%{transform:translateX(-50%) scale(1.03);box-shadow:0 12px 34px rgba(34,211,197,.75)}}
.pr-cartcount{background:#04211d;color:#22D3C5;border-radius:999px;padding:1px 9px;font-size:12px;flex:0 0 auto}
.pr-cartgo{font-size:18px;font-weight:900;margin-left:2px}
.pr-cartlist{display:flex;flex-direction:column;gap:8px;margin:2px 0}
.pr-cartitem{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:7px}
.pr-cartitem img,.pr-cartnoimg{width:46px;height:46px;border-radius:9px;object-fit:cover;flex:none}
.pr-cartnoimg{display:flex;align-items:center;justify-content:center;background:#0b1b1a;font-size:20px}
.pr-cartinfo{flex:1;min-width:0}
.pr-cartname{font-size:12.5px;font-weight:800;color:#fff;line-height:1.15;text-transform:uppercase}
.pr-cartmeta{font-size:11px;color:#9fb4b0}
.pr-cartprice{font-size:13px;font-weight:900;color:#22D3C5}
.pr-cartdel{background:rgba(255,90,90,.15);border:1px solid rgba(255,90,90,.35);color:#ff8a8a;width:26px;height:26px;border-radius:8px;font-size:13px;cursor:pointer;flex:none}
/* Casilla de selección para combo */
.pr-check{position:absolute;top:8px;left:8px;z-index:5;width:30px;height:30px;border-radius:50%;border:2.5px solid #fff;background:rgba(0,0,0,.4);color:#04211d;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.15s;box-shadow:0 2px 8px rgba(0,0,0,.4)}
.pr-check.on{background:#22D3C5;border-color:#22D3C5}
@media(hover:hover){.pr-check:hover{border-color:#22D3C5}}
.pr-comboitem{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:8px}
.pr-combohead{display:flex;align-items:center;gap:10px}
.pr-combohead img,.pr-combohead .pr-cartnoimg{width:46px;height:46px;border-radius:9px;object-fit:cover;flex:none}

/* ===== Móvil: 2 productos por fila, ordenado y compacto ===== */
@media(max-width:640px){
  .pr-wrap{grid-template-columns:repeat(2,1fr);gap:10px;padding:12px 10px 34px}
  .pr-card{border-radius:14px}
  .pr-body{padding:9px 9px 11px;gap:7px}
  .pr-ref{top:6px;left:6px;padding:3px 6px}
  .pr-ref span{font-size:6px}
  .pr-ref b{font-size:12px}
  .pr-oro{font-size:8px;padding:3px 7px}
  .pr-sticker{width:44px;height:44px;font-size:6px;top:-3px;right:-3px;border-width:1px}
  .pr-name{font-size:12px;line-height:1.2;min-height:29px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .pr-descbadge{font-size:9px;padding:2px 6px}
  .pr-price{font-size:19px}
  .pr-price-old{font-size:11px}
  .pr-promo-tag{font-size:8px;padding:2px 6px}
  .pr-urgencia{font-size:10px;line-height:1.2}
  .pr-timer{gap:5px;padding:5px 7px;border-radius:9px}
  .pr-timer-txt{font-size:7px}
  .pr-timer-clock{font-size:12px;padding:2px 6px}
  .pr-tallas{gap:4px}
  .pr-tallas-cols{grid-template-columns:1fr 1fr;gap:4px}
  .pr-tallas-aviso{font-size:8px}
  .pr-genlabel{font-size:7px;margin-bottom:2px}
  .pr-genwrap{padding:4px}
  .pr-pills{gap:3px}
  .pr-pill{min-width:0;padding:3px 4px;font-size:9px;border-radius:5px;border-width:1px;line-height:1.2}
  .pr-swrow{gap:5px}
  .pr-sdot{width:19px;height:19px;border-width:1.5px}
  .pr-colorpill{padding:4px 9px 4px 5px;font-size:11px}
  /* Botones en una sola fila, texto en 2 líneas */
  .pr-ctas{gap:5px}
  .pr-cta{padding:8px 4px;font-size:10px;border-radius:10px;min-height:38px}
  .pr-wa{padding:8px 4px;font-size:10px;border-radius:10px;min-height:38px}
  .pr-hint{font-size:8px}
  .pr-name{font-size:12px}
  .pr-urgencia{font-size:9.5px}
  .pr-swatch{width:14px;height:14px}
  .pr-thumbs{left:6px;right:6px;bottom:6px;gap:4px}
  .pr-thumb{width:34px;height:34px;border-radius:7px}
  .pr-ctas{gap:6px}
  .pr-cta{padding:10px 6px;font-size:12px;border-radius:11px}
  .pr-wa{padding:9px 6px;font-size:11px;border-radius:11px}
  .pr-waico{width:17px;height:17px;font-size:10px}
}
`;

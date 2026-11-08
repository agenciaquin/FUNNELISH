'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { comprimirImagen } from '@/lib/imagen-comprimir';

/**
 * Ventana «Confirmar datos antes de pasar al panel» (botón «Enviar al panel de Effi» del chat).
 * Todo es editable: cliente, dirección, transportadora, producto (del catálogo KLIXMANT),
 * color, talla, precio, cantidad, notas y la foto. Nada se guarda hasta «Confirmar y pasar
 * al panel»; el servidor vuelve a calcular el ID de variante y el SKU desde el catálogo.
 */

interface Variante { id: number; id_item: number; color: string | null; talla: string | null; sku: string | null; genero?: string; referencia?: string | null; foto?: string | null }
interface Producto { id_item: number; id_catalogo?: number; catalogo: string; nombre: string | null; referencia: string | null; tipo: string | null; genero: string; foto: string | null; variantes?: Variante[]; colores?: string[]; tallas?: string[] }

const TRANSPORTADORAS = ['', 'CIUDAD BONITA', 'INTER RAPIDISIMO', 'ENVIA', 'COORDINADORA', 'SERVIENTREGA', 'JOSE ENVIOS'];
const VERDE = '#0E8A7E';
const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

/** Tarjeta de sección (fuera del componente para que los campos no pierdan el foco al escribir). */
function Tarjeta({ icono, titulo, children }: { icono: string; titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
      <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#0D0D0D] mb-3"><span className="text-[18px]">{icono}</span>{titulo}</h3>
      {children}
    </section>
  );
}

export default function EnviarPanelEffiModal({ conv, onCerrar, onListo }: { conv: string; onCerrar: () => void; onListo?: (codigo: string) => void }) {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [datos, setDatos] = useState<Record<string, any>>({});
  const [candidatos, setCandidatos] = useState<Producto[]>([]);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [color, setColor] = useState('');
  const [varId, setVarId] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState<number>(0);
  const [notas, setNotas] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoChat, setFotoChat] = useState<string | null>(null);
  const [existente, setExistente] = useState<any>(null);
  const [forzar, setForzar] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; t: string; lista?: string[] } | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const set = (k: string, v: any) => setDatos(d => ({ ...d, [k]: v }));

  // Carga del producto con sus variantes
  const cargarProducto = async (idItem: number, colorPref = '', tallaPref = '', mantenerFoto = false) => {
    const r = await fetch(`/api/ventas-vendedores/desde-chat?producto=${idItem}`, { cache: 'no-store' });
    if (!r.ok) return;
    const p: Producto = await r.json();
    setProducto(p);
    const vs = p.variantes ?? [];
    const propias = vs.filter(v => v.id_item === idItem);
    const colores = [...new Set(vs.map(v => v.color).filter(Boolean))] as string[];
    const c = colores.find(x => x.toLowerCase() === colorPref.toLowerCase()) ?? propias[0]?.color ?? colores[0] ?? '';
    setColor(c);
    const t = tallaPref.toLowerCase().replace(/\s+/g, '');
    const deColor = vs.filter(v => v.color === c && (v.talla ?? '').toLowerCase().replace(/\s+/g, '') === t);
    const v = deColor.find(x => x.id_item === idItem) ?? deColor[0] ?? null;
    setVarId(v?.id ?? null);
    if (!mantenerFoto) setFoto(v?.foto ?? vs.find(x => x.color === c)?.foto ?? p.foto);
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/ventas-vendedores/desde-chat?conv=${encodeURIComponent(conv)}`, { cache: 'no-store' });
        const j = await r.json();
        if (!vivo) return;
        if (!r.ok) { setErrorCarga(j.error || 'No se pudieron leer los datos del chat'); return; }
        setDatos(j.datos ?? {});
        setCandidatos(j.candidatos ?? []);
        setExistente(j.existente ?? null);
        setCantidad(j.prenda?.cantidad ?? 1);
        setPrecio(j.prenda?.precio ?? 0);
        setFotoChat(j.prenda?.foto_chat ?? null);
        setQ(j.prenda?.texto ?? '');
        if (j.prenda?.id_item) await cargarProducto(j.prenda.id_item, j.prenda.color ?? '', j.prenda.talla ?? '');
        else setBuscando(true);
      } catch (e: any) {
        if (vivo) setErrorCarga(e?.message ?? 'Error');
      } finally { if (vivo) setCargando(false); }
    })();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', esc);
    return () => { vivo = false; window.removeEventListener('keydown', esc); };
  }, [conv]); // eslint-disable-line react-hooks/exhaustive-deps

  const colores = useMemo(() => [...new Set((producto?.variantes ?? []).map(v => v.color).filter(Boolean))] as string[], [producto]);
  const opcionesTalla = useMemo(() => (producto?.variantes ?? []).filter(v => !color || v.color === color), [producto, color]);
  const variante = useMemo(() => (producto?.variantes ?? []).find(v => v.id === varId) ?? null, [producto, varId]);
  const fotoCatalogo = variante?.foto ?? (producto?.variantes ?? []).find(v => v.color === color)?.foto ?? producto?.foto ?? null;
  const cambiarColor = (c: string) => {
    const fotoAntes = fotoCatalogo;
    setColor(c);
    // Misma talla y género en el color nuevo, si existe
    const nueva = (producto?.variantes ?? []).find(v => v.color === c && v.talla === variante?.talla && v.genero === variante?.genero) ?? null;
    setVarId(nueva?.id ?? null);
    // Si la foto era la del catálogo, pasa a la del color nuevo
    if (!foto || foto === fotoAntes) setFoto(nueva?.foto ?? (producto?.variantes ?? []).find(v => v.color === c)?.foto ?? foto);
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
    await cargarProducto(p.id_item, color, variante?.talla ?? '');
  };

  const subirFoto = async (f: File) => {
    setSubiendo(true);
    try {
      const liviana = await comprimirImagen(f).catch(() => f);
      const fd = new FormData(); fd.append('file', liviana);
      const r = await fetch('/api/catalogos/upload-imagen', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (j.url) setFoto(j.url); else setAviso({ ok: false, t: j.error || 'No se pudo subir la foto' });
    } finally { setSubiendo(false); }
  };

  const confirmar = async () => {
    setAviso(null);
    if (!producto || !variante) { setAviso({ ok: false, t: 'Elige el producto, el color y la talla del catálogo.' }); return; }
    setGuardando(true);
    try {
      const r = await fetch('/api/ventas-vendedores/desde-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conv, forzar, datos, prendas: [{ id_item: variante.id_item, color: variante.color, talla: variante.talla, cantidad, precio, foto, notas }] }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) { setAviso({ ok: true, t: j.mensaje }); onListo?.(j.codigo); setTimeout(onCerrar, 1400); }
      else setAviso({ ok: false, t: j.mensaje || 'No se pudo', lista: j.errores });
    } finally { setGuardando(false); }
  };

  const input = 'w-full h-10 px-3 rounded-xl border border-[#DADDE0] bg-white text-[13.5px] text-[#0D0D0D] focus:outline-none focus:border-[#0E8A7E] focus:ring-2 focus:ring-[#0E8A7E]/15';
  const etq = 'block text-[12px] font-medium text-[#4B5563] mb-1';
  const Campo = ({ l, k, req, ph, full }: { l: string; k: string; req?: boolean; ph?: string; full?: boolean }) => (
    <div className={full ? 'col-span-2' : ''}>
      <label className={etq}>{l}{req && <span className="text-[#DC2626]"> *</span>}</label>
      <input className={input} value={datos[k] ?? ''} placeholder={ph ?? '—'} onChange={e => set(k, e.target.value)} />
    </div>
  );
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-3" onClick={onCerrar}>
      <div className="w-full max-w-[1080px] max-h-[94vh] bg-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,.25)] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Encabezado */}
        <header className="flex items-start gap-3 px-6 pt-5 pb-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-[22px] shrink-0" style={{ background: VERDE }}>📋</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[22px] font-extrabold text-[#0D0D0D] leading-tight">Confirmar datos antes de pasar al panel</h2>
            <p className="text-[14px] text-[#6B7280]">Revisa y corrige cualquier dato antes de enviarlo al panel de Effi.</p>
          </div>
          <button onClick={onCerrar} className="w-10 h-10 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[18px]" aria-label="Cerrar">✕</button>
        </header>
        <div className="mx-6 mb-3 rounded-xl px-4 py-2.5 flex items-center gap-3 text-[13.5px]" style={{ background: '#E6F5F2' }}>
          <span className="font-bold" style={{ color: VERDE }}>⚡ Datos detectados en vivo desde el chat</span>
          <span className="text-[#9CA3AF]">|</span>
          <span className="italic text-[#4B5563]">Puedes corregir cualquier dato antes de continuar.</span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {cargando ? (
            <div className="grid grid-cols-2 gap-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-44 rounded-2xl bg-[#F3F4F6] animate-pulse" />)}</div>
          ) : errorCarga ? (
            <div className="rounded-xl bg-[#FEE2E2] text-[#B91C1C] px-4 py-3 text-[14px]">{errorCarga}</div>
          ) : (
            <>
              {existente && (
                <div className="mb-3 rounded-xl bg-[#FEF3C7] text-[#92400E] px-4 py-2.5 text-[13px] flex items-center gap-3 flex-wrap">
                  <span>⚠️ Este chat ya tiene la preventa <b>{existente.codigo}</b> ({existente.estado}{existente.effi_remision ? ` · remisión ${existente.effi_remision}` : ''}).</span>
                  <label className="flex items-center gap-1.5 font-semibold"><input type="checkbox" checked={forzar} onChange={e => setForzar(e.target.checked)} /> Es otra compra: crear otra</label>
                </div>
              )}
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

                <Tarjeta icono="📍" titulo="Dirección">
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
                        {TRANSPORTADORAS.map(t => <option key={t} value={t}>{t || '— Automática por ciudad —'}</option>)}
                      </select>
                    </div>
                  </div>
                </Tarjeta>

                <Tarjeta icono="🛒" titulo="Datos del pedido">
                  <div className="flex gap-4">
                    <div className="w-[170px] shrink-0">
                      <div className="relative w-[170px] h-[170px] rounded-2xl overflow-hidden bg-[#F3F4F6] border border-[#E5E7EB]">
                        {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#9CA3AF] text-[12px]">Sin foto</div>}
                        {subiendo && <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-[12px] font-semibold">Subiendo…</div>}
                      </div>
                      <input ref={archivo} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ''; }} />
                      <div className="mt-2 flex flex-col gap-1">
                        <button onClick={() => archivo.current?.click()} className="h-8 rounded-lg border border-[#DADDE0] text-[12px] font-semibold hover:bg-[#F3F4F6]">📷 Subir otra foto</button>
                        {fotoCatalogo && foto !== fotoCatalogo && <button onClick={() => setFoto(fotoCatalogo)} className="h-8 rounded-lg border border-[#DADDE0] text-[12px] font-semibold hover:bg-[#F3F4F6]">🗂️ Foto del catálogo</button>}
                        {fotoChat && foto !== fotoChat && <button onClick={() => setFoto(fotoChat)} className="h-8 rounded-lg border border-[#DADDE0] text-[12px] font-semibold hover:bg-[#F3F4F6]">💬 Foto del chat</button>}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start gap-2">
                        <p className="flex-1 text-[16px] font-extrabold leading-tight text-[#0D0D0D]">{producto?.catalogo ?? 'Elige el producto'}</p>
                        <button onClick={() => setBuscando(b => !b)} className="h-8 px-2.5 rounded-lg border text-[12px] font-bold shrink-0" style={{ borderColor: VERDE, color: VERDE }}>🔎 Cambiar</button>
                      </div>
                      {buscando && (
                        <div className="rounded-xl border border-[#E5E7EB] p-2">
                          <input autoFocus className={input} value={q} placeholder="Buscar en el catálogo KLIXMANT…" onChange={e => buscar(e.target.value)} />
                          <div className="mt-2 max-h-[220px] overflow-y-auto grid grid-cols-2 gap-1.5">
                            {(resultados.length ? resultados : candidatos).map(p => (
                              <button key={p.id_item} onClick={() => elegirProducto(p)} className={`flex items-center gap-2 p-1.5 rounded-lg border text-left hover:bg-[#F0FAF8] ${producto?.id_item === p.id_item ? 'border-[#0E8A7E]' : 'border-[#EEE]'}`}>
                                {p.foto ? <img src={p.foto} alt="" className="w-10 h-10 rounded object-cover shrink-0" /> : <div className="w-10 h-10 rounded bg-[#F3F4F6] shrink-0" />}
                                <span className="text-[11.5px] leading-tight"><b>{p.catalogo}</b><br /><span className="text-[#6B7280]">{p.genero} · {(p.colores ?? []).join(', ')}</span></span>
                              </button>
                            ))}
                            {!resultados.length && !candidatos.length && <p className="col-span-2 text-[12px] text-[#9CA3AF] px-1">Escribe el nombre del diseño (ej. «bmw reflectivo»).</p>}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-[70px_1fr] items-center gap-y-2 text-[13px]">
                        <span className="text-[#4B5563]">🎨 Color:</span>
                        <select className={`${input} h-9`} value={color} onChange={e => cambiarColor(e.target.value)} disabled={!producto}>
                          {colores.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <span className="text-[#4B5563]">👕 Talla:</span>
                        <select className={`${input} h-9`} value={varId ?? ''} onChange={e => setVarId(Number(e.target.value) || null)} disabled={!producto}>
                          <option value="">— Elige —</option>
                          {opcionesTalla.map(v => <option key={v.id} value={v.id}>{v.talla}{v.genero ? ` - ${v.genero}` : ''}</option>)}
                        </select>
                        <span className="text-[#4B5563]">🏷️ Precio:</span>
                        <input className={`${input} h-9`} value={precio ? String(precio) : ''} placeholder="129900" onChange={e => setPrecio(Number(e.target.value.replace(/\D/g, '')) || 0)} />
                        <span className="text-[#4B5563]">📦 Cant.:</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setCantidad(c => Math.max(1, c - 1))} className="w-8 h-8 rounded-lg border border-[#DADDE0]">−</button>
                          <span className="w-6 text-center font-bold">{cantidad}</span>
                          <button onClick={() => setCantidad(c => Math.min(50, c + 1))} className="w-8 h-8 rounded-lg border border-[#DADDE0]">+</button>
                          <span className="ml-auto text-[12.5px] text-[#4B5563]">Total <b className="text-[#0D0D0D]">{pesos(precio * cantidad)}</b></span>
                        </div>
                        <span className="text-[#4B5563]">💬 Notas:</span>
                        <input className={`${input} h-9`} value={notas} placeholder="—" onChange={e => setNotas(e.target.value)} />
                      </div>
                      {Campo({ l: 'Observaciones para el despacho', k: 'observaciones', full: true })}
                    </div>
                  </div>
                </Tarjeta>

                <Tarjeta icono="🧬" titulo="Datos traídos del catálogo KLIXMANT">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl p-4 text-center" style={{ background: '#E6F5F2' }}>
                      <p className="text-[13px] text-[#374151]">ID de la variante</p>
                      <p className="text-[34px] font-black tracking-tight text-[#0D0D0D]">{variante ? `#${variante.id}` : '—'}</p>
                    </div>
                    <div className="rounded-2xl p-4 text-center" style={{ background: '#E6F5F2' }}>
                      <p className="text-[13px] text-[#374151]">Talla (catálogo)</p>
                      <p className="mt-1 inline-block px-4 py-1 rounded-xl text-[26px] font-black" style={{ background: '#B9E6DE', color: '#0B5E56' }}>{variante?.talla ? `Talla ${variante.talla}` : '—'}</p>
                    </div>
                  </div>
                  <dl className="mt-3 divide-y divide-[#F1F1F1] text-[13.5px]">
                    {[
                      ['||||', 'SKU', variante?.sku ?? '—'],
                      ['🏷️', 'Referencia', variante?.referencia ?? producto?.referencia ?? '—'],
                      ['🚻', 'Género', variante?.genero || '—'],
                      ['🗂️', 'Catálogo', producto?.catalogo ?? '—'],
                      ['🎨', 'Color catálogo', variante?.color ?? '—'],
                      ['📐', 'Talla catálogo', variante?.talla ?? '—'],
                    ].map(([i, t, v]) => (
                      <div key={t} className="flex items-center gap-3 py-2"><span className="w-6 text-[#6B7280] text-[12px]">{i}</span><dt className="w-[130px] text-[#4B5563]">{t}:</dt><dd className="font-semibold text-[#0D0D0D] break-all">{v}</dd></div>
                    ))}
                  </dl>
                  {producto && !variante && <p className="mt-2 text-[12.5px] text-[#B45309]">⚠️ Elige color y talla: así sale el ID y el SKU exactos.</p>}
                </Tarjeta>
              </div>
            </>
          )}
        </div>

        {/* Pie */}
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
          <button disabled={guardando || cargando || !!errorCarga || subiendo || (!!existente && !forzar)} onClick={confirmar}
            className="h-11 px-5 rounded-xl text-white text-[14px] font-bold disabled:opacity-50 flex items-center gap-2" style={{ background: VERDE }}>
            {guardando ? 'Guardando…' : '→ Confirmar y pasar al panel'}
          </button>
        </footer>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react';

interface Pedido {
  id: string; referencia: string; nombre: string; telefono: string;
  producto: string; talla: string; valor: string;
  direccion: string; ciudad: string; departamento: string; correo: string;
  confirmado: boolean; estado: string; abono: number; abono_recibido: boolean;
  utm_source: string | null; utm_campaign: string | null;
  foto?: string | null;
  created_at: string;
}

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const aNumero = (v: string) => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;

function cuando(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia
    ? d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + ' ' +
      d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function estadoDe(p: Pedido): { texto: string; color: string; fondo: string } {
  const e = String(p.estado ?? '').toLowerCase();
  if (p.confirmado)         return { texto: 'Confirmado', color: '#15803D', fondo: 'rgba(21,128,61,0.10)' };
  if (e === 'cancelado')    return { texto: 'Cancelado',  color: '#DC2626', fondo: 'rgba(220,38,38,0.10)' };
  if (e === 'duplicado')    return { texto: 'Duplicado',  color: '#9A9A9A', fondo: 'rgba(154,154,154,0.10)' };
  return { texto: 'Por confirmar', color: '#EA580C', fondo: 'rgba(234,88,12,0.10)' };
}

interface Props {
  /** Abre el chat de ese cliente dentro del panel. */
  onAbrirChat?: (conversationId: string) => void;
}

export default function PedidosPanel({ onAbrirChat }: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [resumen, setResumen] = useState({ total: 0, confirmados: 0, cancelados: 0, vendido: 0 });
  const [cargando, setCargando] = useState(true);
  const [origen, setOrigen]     = useState<'web' | 'todos'>('web');
  const [dias, setDias]         = useState(7);
  const [busca, setBusca]       = useState('');

  // Selección múltiple y acciones
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [menu, setMenu]           = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<'cancelar' | 'eliminar' | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  // Ancla para seleccionar rangos con Shift + clic
  const anclaRef = useRef<number>(-1);

  // Ventana de detalle
  const [detalle, setDetalle]   = useState<Pedido | null>(null);
  const [fotos, setFotos]       = useState<string[]>([]);
  const [cargandoDet, setCargandoDet] = useState(false);

  // Marca/desmarca una fila. Con Shift, aplica lo mismo a todo el rango entre
  // la última fila tocada y esta (en cualquier dirección).
  function alternar(indice: number, conShift = false) {
    setSeleccion(prev => {
      const s = new Set(prev);
      const id = filtrados[indice]?.id;
      if (!id) return prev;

      if (conShift && anclaRef.current >= 0) {
        const desde = Math.min(anclaRef.current, indice);
        const hasta = Math.max(anclaRef.current, indice);
        // El ancla decide si el rango se marca o se desmarca:
        // si el ancla está seleccionada, se marca todo el rango.
        const marcar = prev.has(filtrados[anclaRef.current]?.id ?? '');
        for (let i = desde; i <= hasta; i++) {
          const rid = filtrados[i]?.id;
          if (!rid) continue;
          if (marcar) s.add(rid); else s.delete(rid);
        }
      } else {
        if (s.has(id)) s.delete(id); else s.add(id);
        anclaRef.current = indice;
      }
      return s;
    });
  }

  async function ejecutar(accion: 'cancelar' | 'eliminar' | 'restaurar', ids?: string[]) {
    const lista = ids ?? [...seleccion];
    if (lista.length === 0) return;
    setTrabajando(true);
    try {
      const res = await fetch('/api/pedidos/accion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: lista, accion }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d?.error ?? 'No se pudo completar la acción');
        return;
      }
      setSeleccion(new Set());
      setConfirmar(null);
      setMenu(null);
      setDetalle(null);
      await cargar();
    } finally { setTrabajando(false); }
  }

  async function abrirDetalle(p: Pedido) {
    setDetalle(p);
    setFotos([]);
    setCargandoDet(true);
    try {
      const res  = await fetch(`/api/pedidos/detalle?id=${encodeURIComponent(p.id)}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setDetalle(data.pedido ?? p);
        setFotos(data.imagenes ?? []);
      }
    } finally { setCargandoDet(false); }
  }

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res  = await fetch(`/api/pedidos/lista?origen=${origen}&dias=${dias}`, { cache: 'no-store' });
      const data = await res.json();
      setPedidos(data.pedidos ?? []);
      setResumen(data.resumen ?? { total: 0, confirmados: 0, cancelados: 0, vendido: 0 });
    } finally { setCargando(false); }
  }, [origen, dias]);

  useEffect(() => { cargar(); }, [cargar]);

  // Se refresca solo mientras tengas la pantalla abierta
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, 20000);
    return () => clearInterval(t);
  }, [cargar]);

  const filtrados = pedidos.filter(p => {
    const q = busca.toLowerCase();
    return !q
      || (p.nombre ?? '').toLowerCase().includes(q)
      || (p.telefono ?? '').includes(q)
      || (p.producto ?? '').toLowerCase().includes(q);
  });

  const todosMarcados = filtrados.length > 0 && filtrados.every(p => seleccion.has(p.id));

  const chip = (activo: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs border transition-colors ${
      activo ? 'bg-[#00A89D] text-white border-[#00A89D] font-semibold' : 'bg-white border-[#E8E8E8] hover:border-[#00A89D]'
    }`;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">

        <header className="mb-5 pl-10 md:pl-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">Pedidos</h1>
          <p className="text-xs text-[#6B6B6B] mt-1">
            Lo que entra por tus páginas de venta, en vivo.
          </p>
        </header>

        {/* Filtros */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button onClick={() => setOrigen('web')}   className={chip(origen === 'web')}>🚀 De mis páginas</button>
          <button onClick={() => setOrigen('todos')} className={chip(origen === 'todos')}>Todos</button>
          <span className="w-px h-5 bg-[#E8E8E8] mx-1" />
          {[1, 7, 30].map(d => (
            <button key={d} onClick={() => setDias(d)} className={chip(dias === d)}>
              {d === 1 ? 'Hoy' : `${d} días`}
            </button>
          ))}
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar nombre, teléfono…"
            className="ml-auto px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs w-48 focus:outline-none focus:border-[#00A89D]"
          />
          <button onClick={cargar} title="Actualizar" className="w-8 h-8 rounded-lg text-[#00A89D] hover:bg-[#00A89D]/10">⟳</button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { t: 'Pedidos',     v: String(resumen.total),       c: '#8B5CF6', i: '🛒' },
            { t: 'Confirmados', v: String(resumen.confirmados), c: '#15803D', i: '✅' },
            { t: 'Cancelados',  v: String(resumen.cancelados),  c: '#DC2626', i: '✖️' },
            { t: 'Vendido',     v: pesos(resumen.vendido),      c: '#00847A', i: '💰' },
          ].map(k => (
            <div key={k.t} className="bg-white rounded-2xl border border-[#E8E8E8] p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{k.i}</span>
                <span className="text-[11px] text-[#6B6B6B]">{k.t}</span>
              </div>
              <div className="text-lg font-bold" style={{ color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Barra de selección */}
        {seleccion.size > 0 && (
          <div className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-xl bg-[#0D0D0D] text-white shadow-lg flex-wrap">
            <span className="text-xs font-semibold">
              {seleccion.size} {seleccion.size === 1 ? 'pedido seleccionado' : 'pedidos seleccionados'}
              <span className="hidden md:inline text-white/50 font-normal ml-2">
                · Shift + clic para marcar un rango
              </span>
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setConfirmar('cancelar')}
                className="px-3 py-1.5 rounded-lg bg-[#EA580C] text-white text-xs font-semibold hover:bg-[#c2410c]"
              >✖️ Cancelar</button>
              <button
                onClick={() => setConfirmar('eliminar')}
                className="px-3 py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-semibold hover:bg-[#b91c1c]"
              >🗑️ Eliminar</button>
              <button
                onClick={() => setSeleccion(new Set())}
                className="px-3 py-1.5 rounded-lg border border-white/30 text-xs hover:bg-white/10"
              >Quitar selección</button>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-visible">
          {cargando ? (
            <div className="divide-y divide-[#F0F0F0]">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-[#FAFAFA] animate-pulse" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-[#6B6B6B] py-12 text-center px-6">
              {origen === 'web'
                ? 'Todavía no hay pedidos desde tus páginas. Aparecerán aquí apenas alguien compre.'
                : 'No hay pedidos en este período.'}
            </p>
          ) : (
            <>
              {/* Encabezado de columnas */}
              <div className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-[#FAFAFA] border-b border-[#EEE] text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wide">
                <span className="w-5 shrink-0">
                  <input
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={() => setSeleccion(todosMarcados ? new Set() : new Set(filtrados.map(p => p.id)))}
                    className="w-4 h-4 accent-[#00A89D] cursor-pointer align-middle"
                  />
                </span>
                <span className="w-24 shrink-0">Fecha</span>
                <span className="w-32 shrink-0">Estado</span>
                <span className="w-10 shrink-0" />
                <span className="flex-1 min-w-0">Cliente</span>
                <span className="flex-1 min-w-0">Producto</span>
                <span className="w-24 text-right shrink-0">Valor</span>
                <span className="w-8 shrink-0" />
              </div>

              <div className="divide-y divide-[#F4F4F4]">
                {filtrados.map((p, indice) => {
                  const est   = estadoDe(p);
                  const total = aNumero(p.valor);
                  const marcado = seleccion.has(p.id);

                  return (
                    <div
                      key={p.id}
                      onClick={() => abrirDetalle(p)}
                      className={`group relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        marcado ? 'bg-[#00A89D]/[0.07]' : 'hover:bg-[#FAFAFA]'
                      }`}
                    >
                      {/* Franja de color según el estado */}
                      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: est.color }} />

                      <span className="w-5 shrink-0" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={marcado}
                          onClick={e => alternar(indice, (e as MouseEvent).shiftKey)}
                          onChange={() => { /* el clic ya lo maneja */ }}
                          className="w-4 h-4 accent-[#00A89D] cursor-pointer align-middle"
                        />
                      </span>

                      <span className="hidden md:block w-24 shrink-0 text-[11px] text-[#9A9A9A]">
                        {cuando(p.created_at)}
                      </span>

                      <span className="hidden md:block w-32 shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block"
                              style={{ color: est.color, background: est.fondo }}>{est.texto}</span>
                      </span>

                      {/* Miniatura del producto */}
                      <span className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-[#F2F2F2] flex items-center justify-center">
                        {p.foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.foto} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-sm text-[#C9C9C9]">🛍️</span>
                        )}
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-[#0D0D0D] truncate">
                          {p.nombre || '—'}
                        </span>
                        <span className="md:hidden flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ color: est.color, background: est.fondo }}>{est.texto}</span>
                          <span className="text-[10px] text-[#9A9A9A]">{cuando(p.created_at)}</span>
                        </span>
                        <span className="md:hidden block text-[11px] text-[#6B6B6B] truncate mt-0.5">
                          {p.producto} · {p.talla || 'sin talla'}
                        </span>
                      </span>

                      <span className="hidden md:block flex-1 min-w-0">
                        <span className="block text-[12px] text-[#0D0D0D] truncate">{p.producto}</span>
                        <span className="block text-[11px] text-[#9A9A9A] truncate">
                          {p.talla || 'sin talla'}
                          {p.abono > 0 && ` · abono ${p.abono_recibido ? '✅' : '⏳'}`}
                        </span>
                      </span>

                      <span className="w-24 text-right shrink-0 text-sm font-bold text-[#0D0D0D]">
                        {pesos(total)}
                      </span>

                      {/* Menú de la fila */}
                      <span className="w-8 shrink-0 relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setMenu(menu === p.id ? null : p.id)}
                          className="w-7 h-7 rounded-lg text-[#9A9A9A] hover:bg-[#EEE] hover:text-[#0D0D0D]"
                          title="Opciones"
                        >⋮</button>

                        {menu === p.id && (
                          <>
                            <span className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                            {/* En las últimas filas el menú se abre hacia arriba para que no quede tapado */}
                            <span className={`absolute right-0 z-20 w-44 bg-white rounded-xl border border-[#E8E8E8] shadow-xl overflow-hidden block ${
                              indice >= filtrados.length - 2 ? 'bottom-8' : 'top-8'
                            }`}>
                              <button
                                onClick={() => { setMenu(null); abrirDetalle(p); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5]"
                              >👁️ Ver detalle</button>
                              {String(p.estado).toLowerCase() === 'cancelado' ? (
                                <button
                                  onClick={() => ejecutar('restaurar', [p.id])}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5]"
                                >↩️ Reactivar pedido</button>
                              ) : (
                                <button
                                  onClick={() => ejecutar('cancelar', [p.id])}
                                  className="w-full text-left px-3 py-2 text-xs text-[#EA580C] hover:bg-[#EA580C]/10"
                                >✖️ Cancelar pedido</button>
                              )}
                              <button
                                onClick={() => { setSeleccion(new Set([p.id])); setMenu(null); setConfirmar('eliminar'); }}
                                className="w-full text-left px-3 py-2 text-xs text-[#DC2626] hover:bg-[#DC2626]/10 border-t border-[#F0F0F0]"
                              >🗑️ Eliminar de la lista</button>
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Confirmación */}
        {confirmar && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
               onClick={() => !trabajando && setConfirmar(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold mb-1">
                {confirmar === 'eliminar' ? '¿Eliminar definitivamente?' : '¿Cancelar estos pedidos?'}
              </h3>
              <p className="text-xs text-[#6B6B6B] leading-relaxed mb-4">
                {confirmar === 'eliminar'
                  ? `Se borrarán ${seleccion.size} ${seleccion.size === 1 ? 'pedido' : 'pedidos'} y dejarán de contar en las estadísticas. Esto no se puede deshacer.`
                  : `Quedarán marcados como cancelados y no sumarán a lo vendido. Los puedes reactivar después.`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmar(null)}
                  disabled={trabajando}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-sm hover:bg-[#F5F5F5] disabled:opacity-50"
                >Volver</button>
                <button
                  onClick={() => ejecutar(confirmar)}
                  disabled={trabajando}
                  className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 ${
                    confirmar === 'eliminar' ? 'bg-[#DC2626] hover:bg-[#b91c1c]' : 'bg-[#EA580C] hover:bg-[#c2410c]'
                  }`}
                >{trabajando ? 'Un momento…' : confirmar === 'eliminar' ? 'Sí, eliminar' : 'Sí, cancelar'}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ventana con todo el detalle del pedido */}
      {detalle && (() => {
        const est   = estadoDe(detalle);
        const total = aNumero(detalle.valor);
        const abono = Number(detalle.abono ?? 0);
        const tel10 = String(detalle.telefono ?? '').replace(/\D/g, '').slice(-10);
        // La selección viene junta: "AZUL RED BULL / ROJO RED BULL / M HOMBRE"
        const partes = String(detalle.talla ?? '').split('/').map(s => s.trim()).filter(Boolean);

        const Dato = ({ t, v }: { t: string; v: any }) => (
          <div className="flex gap-2 py-1.5 border-b border-[#F5F5F5] last:border-0">
            <span className="text-[11px] text-[#6B6B6B] w-24 shrink-0">{t}</span>
            <span className="text-[12px] text-[#0D0D0D] flex-1 break-words">{v || '—'}</span>
          </div>
        );

        return (
          <div
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4"
            onClick={() => setDetalle(null)}
          >
            <div
              className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Encabezado */}
              <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-[#E8E8E8] shrink-0">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#0D0D0D] truncate">{detalle.nombre || '—'}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: est.color, background: est.fondo }}>{est.texto}</span>
                    <span className="text-[10px] text-[#9A9A9A]">{cuando(detalle.created_at)}</span>
                  </div>
                </div>
                <button onClick={() => setDetalle(null)} className="text-[#6B6B6B] hover:text-[#0D0D0D] text-lg w-8 h-8 shrink-0">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {/* Producto */}
                <div className="mb-4">
                  <p className="text-[11px] font-bold text-[#6B6B6B] uppercase mb-2">Producto</p>

                  {cargandoDet ? (
                    <div className="h-24 rounded-xl bg-[#F5F5F5] animate-pulse" />
                  ) : fotos.length > 0 ? (
                    <div className="flex gap-2 mb-2.5 overflow-x-auto">
                      {fotos.map((f, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={f} alt="" className="w-24 h-24 rounded-xl object-cover border border-[#E8E8E8] shrink-0" />
                      ))}
                    </div>
                  ) : null}

                  <p className="text-sm font-semibold text-[#0D0D0D] leading-snug">{detalle.producto}</p>

                  {partes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {partes.map((t, i) => (
                        <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#00A89D]/10 text-[#00847A]">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cobro */}
                <div className="mb-4 rounded-xl border border-[#E8E8E8] overflow-hidden">
                  <div className="flex justify-between px-3 py-2 text-[12px] border-b border-[#F5F5F5]">
                    <span className="text-[#6B6B6B]">Total</span>
                    <span className="font-semibold">{pesos(total)}</span>
                  </div>
                  {abono > 0 && (
                    <div className="flex justify-between px-3 py-2 text-[12px] border-b border-[#F5F5F5]">
                      <span className="text-[#6B6B6B]">
                        Abono {detalle.abono_recibido ? '✅ recibido' : '⏳ pendiente'}
                      </span>
                      <span className="font-semibold text-[#EA580C]">− {pesos(abono)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-3 py-2.5 bg-[#FAFAFA]">
                    <span className="text-[12px] font-bold">COBRAR</span>
                    <span className="text-sm font-bold text-[#15803D]">{pesos(total - abono)}</span>
                  </div>
                </div>

                {/* Envío */}
                <p className="text-[11px] font-bold text-[#6B6B6B] uppercase mb-1">Datos de envío</p>
                <div className="mb-4">
                  <Dato t="Teléfono"    v={detalle.telefono} />
                  <Dato t="Dirección"   v={detalle.direccion} />
                  <Dato t="Ciudad"      v={`${detalle.ciudad ?? ''} — ${detalle.departamento ?? ''}`} />
                  <Dato t="Correo"      v={detalle.correo} />
                </div>

                {/* Origen */}
                {(detalle.utm_campaign || detalle.utm_source) && (
                  <>
                    <p className="text-[11px] font-bold text-[#6B6B6B] uppercase mb-1">De dónde vino</p>
                    <div className="mb-2">
                      <Dato t="Campaña"  v={detalle.utm_campaign} />
                      <Dato t="Fuente"   v={detalle.utm_source} />
                    </div>
                  </>
                )}

                <p className="text-[10px] text-[#C9C9C9] mt-3">Referencia: {detalle.referencia}</p>
              </div>

              {/* Acciones */}
              <div className="px-5 py-3 border-t border-[#E8E8E8] shrink-0 flex gap-2">
                <button
                  onClick={() => {
                    setDetalle(null);
                    // El chat vive en el panel: no hace falta salir a WhatsApp
                    if (onAbrirChat) onAbrirChat(`57${tel10}`);
                    else window.open(`https://wa.me/57${tel10}`, '_blank');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold text-center hover:bg-[#00847A]"
                >💬 Abrir el chat</button>
                <button
                  onClick={() => { navigator.clipboard?.writeText(
                    `${detalle.nombre}\n${detalle.telefono}\n${detalle.direccion}\n${detalle.ciudad} — ${detalle.departamento}\n${detalle.producto}\n${detalle.talla}\nCobrar: ${pesos(total - abono)}`
                  ); }}
                  title="Copiar los datos del pedido"
                  className="px-4 py-2.5 rounded-xl border border-[#E8E8E8] text-sm hover:bg-[#F5F5F5]"
                >📋</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

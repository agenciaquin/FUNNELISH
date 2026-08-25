'use client';

import { useState, useEffect, useCallback } from 'react';
import ModalConfirm from './ModalConfirm';

interface Carrito {
  id: string;
  slug: string;
  nombre: string | null;
  telefono: string;
  producto: string | null;
  talla: string | null;
  valor: number | null;
  datos: Record<string, any> | null;
  nota: string | null;
  created_at: string;
}

// Etiquetas bonitas para los campos que el cliente llenó.
const LABELS: Record<string, string> = {
  nombre: 'Nombre', apellidos: 'Apellidos', whatsapp: 'WhatsApp', telefono: 'Teléfono',
  correo: 'Correo', direccion: 'Dirección', barrio: 'Barrio', municipio: 'Ciudad / Municipio',
  departamento: 'Departamento', seleccion: 'Selección', talla: 'Talla',
};

const pesos = (n: number | null) => (n ? `$${Math.round(n).toLocaleString('es-CO')}` : '—');

function cuandoFue(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export default function CarritosAbandonados({ onClose }: { onClose: () => void }) {
  const [carritos, setCarritos] = useState<Carrito[]>([]);
  const [loading, setLoading]   = useState(true);
  const [verRecuperados, setVerRecuperados] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [notaId, setNotaId] = useState<string | null>(null);   // carrito cuya nota se está editando
  const [notaTexto, setNotaTexto] = useState('');
  const [confirmarBorrar, setConfirmarBorrar] = useState<Carrito | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirmarBorrarSel, setConfirmarBorrarSel] = useState(false);
  const [diag, setDiag] = useState<{ totalTabla: number; permiso: boolean } | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/funnels/carrito${verRecuperados ? '?recuperados=1' : ''}`, { cache: 'no-store' });
      const d = await r.json();
      setCarritos(d.carritos ?? []);
      setSel(new Set());
      setDiag({ totalTabla: d.totalTabla ?? 0, permiso: d.permiso !== false });
    } catch { setCarritos([]); }
    finally { setLoading(false); }
  }, [verRecuperados]);

  useEffect(() => { cargar(); }, [cargar]);

  async function marcar(id: string, recuperado: boolean) {
    setMarcando(id);
    try {
      await fetch('/api/funnels/carrito', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, recuperado }),
      });
      setCarritos(cs => cs.filter(c => c.id !== id));
    } catch { /* ignorar */ }
    finally { setMarcando(null); }
  }

  async function eliminarVenta(id: string) {
    try {
      await fetch(`/api/funnels/carrito?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setCarritos(cs => cs.filter(c => c.id !== id));
    } catch { /* ignorar */ }
    finally { setConfirmarBorrar(null); }
  }

  async function guardarNota(id: string) {
    try {
      await fetch('/api/funnels/carrito', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nota: notaTexto }),
      });
      setCarritos(cs => cs.map(c => (c.id === id ? { ...c, nota: notaTexto || null } : c)));
    } catch { /* ignorar */ }
    finally { setNotaId(null); }
  }

  const alternarSel = (id: string) => setSel(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const seleccionarTodos = () =>
    setSel(s => (s.size === carritos.length ? new Set() : new Set(carritos.map(c => c.id))));

  async function eliminarSeleccionados() {
    const ids = [...sel];
    if (ids.length === 0) return;
    try {
      await fetch(`/api/funnels/carrito?ids=${ids.map(encodeURIComponent).join(',')}`, { method: 'DELETE' });
      setCarritos(cs => cs.filter(c => !sel.has(c.id)));
      setSel(new Set());
    } catch { /* ignorar */ }
    finally { setConfirmarBorrarSel(false); }
  }

  async function marcarSeleccionados() {
    const ids = [...sel];
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map(id => fetch('/api/funnels/carrito', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, recuperado: !verRecuperados }),
      })));
      setCarritos(cs => cs.filter(c => !sel.has(c.id)));
      setSel(new Set());
    } catch { /* ignorar */ }
  }

  const totalValor = carritos.reduce((s, c) => s + (c.valor ?? 0), 0);

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
        {/* Volver a la lista de embudos */}
        <button onClick={onClose} className="text-xs text-[#00A89D] font-semibold hover:underline mb-3 pl-10 md:pl-0">
          ← Volver
        </button>

        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#E8E8E8]">
            <h3 className="text-base font-bold text-[#0D0D0D]">🛒 Carritos abandonados</h3>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">
              Clientes que escribieron su nombre y WhatsApp pero no completaron la compra. ¡Escríbeles para recuperar la venta!
            </p>
          </div>

          {/* Filtro + resumen */}
          <div className="px-6 pt-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2">
              <button onClick={() => setVerRecuperados(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!verRecuperados ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A] font-semibold' : 'border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5]'}`}>
                Por recuperar
              </button>
              <button onClick={() => setVerRecuperados(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${verRecuperados ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A] font-semibold' : 'border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5]'}`}>
                Recuperados
              </button>
            </div>
            {!verRecuperados && carritos.length > 0 && (
              <span className="text-[11px] text-[#6B6B6B]">
                <b className="text-[#0D0D0D]">{carritos.length}</b> carritos · <b className="text-[#00847A]">{pesos(totalValor)}</b> por recuperar
              </span>
            )}
          </div>

          {/* Barra de selección múltiple */}
          {!loading && carritos.length > 0 && (
            <div className="px-6 pt-3 flex items-center gap-2 flex-wrap">
              <button onClick={seleccionarTodos} className="text-xs font-medium text-[#00847A] hover:underline">
                {sel.size === carritos.length ? 'Quitar selección' : 'Seleccionar todos'}
              </button>
              {sel.size > 0 && <span className="text-[11px] text-[#6B6B6B]"><b className="text-[#0D0D0D]">{sel.size}</b> seleccionado(s)</span>}
              <div className="flex-1" />
              <button
                onClick={marcarSeleccionados}
                disabled={sel.size === 0}
                className="px-3 py-1.5 rounded-lg bg-[#15803D] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40"
              >{verRecuperados ? '↩ Reabrir' : '✅ Marcar recuperados'}{sel.size ? ` (${sel.size})` : ''}</button>
              <button
                onClick={() => setConfirmarBorrarSel(true)}
                disabled={sel.size === 0}
                className="px-3 py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-semibold hover:bg-[#B91C1C] disabled:opacity-40"
              >🗑 Eliminar{sel.size ? ` (${sel.size})` : ''}</button>
            </div>
          )}

          {/* Lista */}
          <div className="px-6 py-4">
            {loading ? (
              <div className="text-center text-[#9A9A9A] text-sm py-10">Cargando…</div>
            ) : carritos.length === 0 ? (
              <div className="text-center text-[#9A9A9A] text-sm py-10">
                {verRecuperados ? 'Aún no has marcado carritos como recuperados.' : '🎉 No hay carritos abandonados. ¡Todos completaron su compra!'}
                {!verRecuperados && diag && (
                  <div className="mt-3 text-[11px] text-[#B45309] bg-[#FEF3C7] rounded-lg px-3 py-2 inline-block">
                    {!diag.permiso
                      ? '⚠️ Falta el permiso de la tabla. Corre en Supabase: grant all on table carritos_abandonados to service_role;'
                      : diag.totalTabla === 0
                        ? 'La tabla aún no tiene ningún registro. Los carritos empiezan a guardarse desde AHORA (los de antes del arreglo no se guardaron). Haz una prueba: escribe nombre + WhatsApp en un embudo sin comprar.'
                        : `Hay ${diag.totalTabla} registro(s) en total, pero todos ya compraron (pedido confirmado) o se recuperaron.`}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {carritos.map(c => {
                  const tel = c.telefono.replace(/\D/g, '').replace(/^57/, '');
                  const msg = encodeURIComponent(`¡Hola ${c.nombre?.split(' ')[0] ?? ''}! 😊 Vi que estabas por pedir ${c.producto ?? 'tu buzo'}${c.talla ? ` (${c.talla})` : ''}. ¿Te ayudo a completarlo? 🚚`);
                  // Datos que el cliente escribió + fotos elegidas.
                  const d = c.datos ?? {};
                  const fotos: string[] = Array.isArray(d.imagenes) ? d.imagenes.filter(Boolean) : [];
                  const ORDEN = ['nombre', 'apellidos', 'telefono', 'correo', 'producto', 'talla', 'seleccion', 'direccion', 'barrio', 'municipio', 'departamento'];
                  const fuente: Record<string, any> = {
                    ...d,
                    nombre: c.nombre ?? d.nombre,
                    telefono: c.telefono,
                    producto: c.producto ?? d.producto,
                    talla: c.talla ?? d.talla,
                  };
                  const campos = Object.entries(fuente)
                    .filter(([k, v]) => k !== 'imagenes' && typeof v !== 'object' && v !== null && v !== undefined && String(v).trim() !== '')
                    .sort((a, b) => {
                      const ia = ORDEN.indexOf(a[0]); const ib = ORDEN.indexOf(b[0]);
                      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
                    });
                  const estaAbierto = abierto === c.id;
                  return (
                    <div key={c.id} className={`rounded-xl border p-3 ${sel.has(c.id) ? 'border-[#00A89D] ring-1 ring-[#00A89D]/30' : 'border-[#EFEFEF]'}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={sel.has(c.id)}
                          onChange={() => alternarSel(c.id)}
                          title="Seleccionar"
                          className="w-4 h-4 accent-[#00A89D] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#0D0D0D] truncate">{c.nombre || 'Sin nombre'}</span>
                            <span className="text-[10px] text-[#9A9A9A] shrink-0">· {cuandoFue(c.created_at)}</span>
                          </div>
                          <div className="text-[12px] text-[#6B6B6B] truncate">
                            {c.producto || '—'}{c.talla ? ` · ${c.talla}` : ''} · {pesos(c.valor)}
                          </div>
                          <div className="text-[12px] text-[#00847A] font-mono">{tel}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a href={`https://wa.me/57${tel}?text=${msg}`} target="_blank" rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold hover:opacity-90">
                            WhatsApp
                          </a>
                          <a href={`tel:+57${tel}`}
                            className="px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs font-medium hover:bg-[#F5F5F5]">
                            📞
                          </a>
                          <button onClick={() => marcar(c.id, !verRecuperados)} disabled={marcando === c.id}
                            title={verRecuperados ? 'Reabrir' : 'Marcar como recuperado'}
                            className="px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs font-medium hover:bg-[#F5F5F5] disabled:opacity-50">
                            {marcando === c.id ? '…' : verRecuperados ? '↩' : '✓'}
                          </button>
                        </div>
                      </div>

                      {/* Ver todos los datos que dejó el cliente */}
                      <button
                        onClick={() => setAbierto(estaAbierto ? null : c.id)}
                        className="mt-2 text-[11px] text-[#00847A] font-semibold hover:underline"
                      >{estaAbierto ? '▲ Ocultar datos' : '▼ Ver todos los datos'}</button>

                      {estaAbierto && (
                        <div className="mt-2 rounded-lg bg-[#FAF9F6] border border-[#EFEFEF] p-3 space-y-3">
                          {/* Fotos del producto que eligió */}
                          {fotos.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {fotos.map((src, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={i} src={src} alt="" className="w-16 h-16 rounded-lg object-cover border border-[#E8E8E8] bg-white" />
                              ))}
                            </div>
                          )}

                          {/* Todos los datos */}
                          {campos.length === 0 ? (
                            <p className="text-[12px] text-[#9A9A9A]">Este cliente solo dejó nombre y WhatsApp.</p>
                          ) : (
                            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                              {campos.map(([k, v]) => (
                                <div key={k} className="contents">
                                  <dt className="text-[11px] font-semibold text-[#6B6B6B]">{LABELS[k] ?? k}</dt>
                                  <dd className="text-[12px] text-[#0D0D0D] break-words">{String(v)}</dd>
                                </div>
                              ))}
                            </dl>
                          )}

                          {/* Nota del asesor */}
                          {notaId === c.id ? (
                            <div>
                              <textarea
                                value={notaTexto} onChange={e => setNotaTexto(e.target.value)} rows={2}
                                placeholder="Ej: llamó, pide que le escriba mañana en la tarde…"
                                className="w-full text-[12px] rounded-lg border border-[#E8E8E8] p-2 focus:outline-none focus:border-[#00A89D]"
                              />
                              <div className="flex gap-2 mt-1.5">
                                <button onClick={() => guardarNota(c.id)} className="px-3 py-1 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A]">Guardar nota</button>
                                <button onClick={() => setNotaId(null)} className="px-3 py-1 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs font-medium hover:bg-[#F5F5F5]">Cancelar</button>
                              </div>
                            </div>
                          ) : c.nota ? (
                            <div className="text-[12px] text-[#B45309] bg-[#FEF3C7] rounded-lg px-3 py-2">📝 {c.nota}</div>
                          ) : null}

                          {/* Botones de acción */}
                          <div className="flex flex-wrap gap-2 pt-1 border-t border-[#EFEFEF] mt-1">
                            <button
                              onClick={() => marcar(c.id, !verRecuperados)} disabled={marcando === c.id}
                              className="mt-2 px-3 py-1.5 rounded-lg bg-[#15803D] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                            >{verRecuperados ? '↩ Reabrir' : '✅ Marcar como recuperado'}</button>
                            <button
                              onClick={() => { setNotaId(c.id); setNotaTexto(c.nota ?? ''); }}
                              className="mt-2 px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs font-semibold hover:bg-[#F5F5F5]"
                            >📝 {c.nota ? 'Editar nota' : 'Agregar nota'}</button>
                            <button
                              onClick={() => setConfirmarBorrar(c)}
                              className="mt-2 px-3 py-1.5 rounded-lg border border-[#DC2626]/40 text-[#DC2626] text-xs font-semibold hover:bg-[#FEE2E2]"
                            >🗑 Eliminar venta</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <ModalConfirm
        abierto={!!confirmarBorrar}
        titulo="Eliminar venta"
        mensaje={`¿Eliminar definitivamente el carrito de ${confirmarBorrar?.nombre || 'este cliente'}? Esta acción NO se puede deshacer.`}
        textoConfirmar="Eliminar"
        peligro
        onConfirmar={() => confirmarBorrar && eliminarVenta(confirmarBorrar.id)}
        onCancelar={() => setConfirmarBorrar(null)}
      />

      <ModalConfirm
        abierto={confirmarBorrarSel}
        titulo="Eliminar seleccionados"
        mensaje={`¿Eliminar definitivamente ${sel.size} carrito(s)? Esta acción NO se puede deshacer.`}
        textoConfirmar="Eliminar todo"
        peligro
        onConfirmar={eliminarSeleccionados}
        onCancelar={() => setConfirmarBorrarSel(false)}
      />
    </div>
  );
}

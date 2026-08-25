'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfirmacionModal from './ConfirmacionModal';

interface Carrito {
  id: string;
  slug: string;
  nombre: string | null;
  telefono: string;
  producto: string | null;
  talla: string | null;
  valor: number | null;
  created_at: string;
  // Datos parciales que el cliente alcanzó a llenar
  apellidos?: string | null;
  correo?: string | null;
  direccion?: string | null;
  barrio?: string | null;
  ciudad?: string | null;
  departamento?: string | null;
  // Blob completo (todo lo que llenó + selección + fotos) y nota privada del asesor.
  datos?: any;
  nota?: string | null;
}

const pesos = (n: number | null) => (n ? `$${Math.round(n).toLocaleString('es-CO')}` : '—');

function cuandoFue(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

// Etiquetas legibles y orden de presentación para cada campo conocido.
const ETIQUETAS: Record<string, string> = {
  nombre: 'Nombre', apellidos: 'Apellidos', whatsapp: 'WhatsApp', telefono: 'Teléfono',
  correo: 'Correo', direccion: 'Dirección', barrio: 'Barrio', municipio: 'Ciudad',
  ciudad: 'Ciudad', departamento: 'Departamento', producto: 'Producto',
  seleccion: 'Selección', talla: 'Selección', valor: 'Valor',
};
const ORDEN = [
  'nombre', 'apellidos', 'telefono', 'whatsapp', 'correo', 'direccion',
  'barrio', 'municipio', 'ciudad', 'departamento', 'producto', 'seleccion', 'talla', 'valor',
];

/** Arma la lista de campos legibles del carrito (datos blob + columnas), sin vacíos
 *  ni valores no-texto (fotos, arreglos, objetos). Ordenados y con etiqueta clara. */
function camposLegibles(c: Carrito): { etq: string; val: string }[] {
  const tel = c.telefono.replace(/\D/g, '').replace(/^57/, '');
  const d = (c.datos && typeof c.datos === 'object') ? c.datos : {};
  // Fuente combinada: el blob manda; si falta, se usa la columna suelta.
  const fuente: Record<string, any> = {
    nombre: d.nombre ?? c.nombre,
    apellidos: d.apellidos ?? c.apellidos,
    telefono: tel,
    whatsapp: d.whatsapp,
    correo: d.correo ?? c.correo,
    direccion: d.direccion ?? c.direccion,
    barrio: d.barrio ?? c.barrio,
    municipio: d.municipio ?? d.ciudad ?? c.ciudad,
    departamento: d.departamento ?? c.departamento,
    producto: d.producto ?? c.producto,
    seleccion: d.seleccion ?? c.talla,
    valor: (d.valor ?? c.valor) != null ? pesos(Number(d.valor ?? c.valor)) : '',
  };
  // Cualquier campo extra que venga en el blob y no esté mapeado (menos fotos/objetos).
  for (const k of Object.keys(d)) {
    if (k === 'imagenes' || k in fuente || k === 'ciudad') continue;
    fuente[k] = d[k];
  }

  const claves = [...ORDEN.filter(k => k in fuente), ...Object.keys(fuente).filter(k => !ORDEN.includes(k))];
  const vistos = new Set<string>();
  const filas: { etq: string; val: string }[] = [];
  for (const k of claves) {
    if (vistos.has(k)) continue;
    vistos.add(k);
    const v = fuente[k];
    if (v == null) continue;
    if (typeof v === 'object') continue;              // fotos / arreglos: fuera
    const s = String(v).trim();
    if (!s) continue;
    const etq = ETIQUETAS[k] ?? (k.charAt(0).toUpperCase() + k.slice(1));
    // Evita "Selección" y "Ciudad" duplicadas si ya se agregó una equivalente.
    if ((k === 'talla' || k === 'seleccion') && filas.some(f => f.etq === 'Selección')) continue;
    if ((k === 'municipio' || k === 'ciudad') && filas.some(f => f.etq === 'Ciudad')) continue;
    filas.push({ etq, val: s });
  }
  return filas;
}

/** Fotos del producto que el cliente estaba viendo (del blob de datos). */
function fotosDe(c: Carrito): string[] {
  const d = (c.datos && typeof c.datos === 'object') ? c.datos : {};
  const arr = Array.isArray(d.imagenes) ? d.imagenes : [];
  return arr.filter((u: any) => typeof u === 'string' && !!u).slice(0, 8);
}

export default function CarritosAbandonados({ onClose }: { onClose?: () => void }) {
  const [carritos, setCarritos] = useState<Carrito[]>([]);
  const [loading, setLoading]   = useState(true);
  const [verRecuperados, setVerRecuperados] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);   // carrito desplegado

  // Edición de nota privada.
  const [editandoNota, setEditandoNota] = useState<string | null>(null);
  const [borradorNota, setBorradorNota] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);

  // Confirmación de borrado real (individual).
  const [aEliminar, setAEliminar] = useState<Carrito | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Selección múltiple (casillas) + acciones en lote.
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [accionLote, setAccionLote] = useState(false);
  const [confirmarBorradoLote, setConfirmarBorradoLote] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/funnels/carrito${verRecuperados ? '?recuperados=1' : ''}`, { cache: 'no-store' });
      const d = await r.json();
      setCarritos(d.carritos ?? []);
    } catch { setCarritos([]); }
    finally { setLoading(false); setSeleccion(new Set()); }
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

  function abrirNota(c: Carrito) {
    setEditandoNota(c.id);
    setBorradorNota(c.nota ?? '');
  }

  async function guardarNota(id: string) {
    setGuardandoNota(true);
    try {
      const r = await fetch('/api/funnels/carrito', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nota: borradorNota }),
      });
      if (r.ok) {
        const nota = borradorNota.trim() || null;
        setCarritos(cs => cs.map(c => (c.id === id ? { ...c, nota } : c)));
        setEditandoNota(null);
      }
    } catch { /* ignorar */ }
    finally { setGuardandoNota(false); }
  }

  async function eliminar(c: Carrito) {
    setEliminando(true);
    try {
      const r = await fetch(`/api/funnels/carrito?id=${encodeURIComponent(c.id)}`, { method: 'DELETE' });
      if (r.ok) setCarritos(cs => cs.filter(x => x.id !== c.id));
    } catch { /* ignorar */ }
    finally { setEliminando(false); setAEliminar(null); }
  }

  // ── Selección múltiple ──
  function alternar(id: string) {
    setSeleccion(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  const todosMarcados = carritos.length > 0 && seleccion.size === carritos.length;
  function alternarTodos() {
    setSeleccion(todosMarcados ? new Set() : new Set(carritos.map(c => c.id)));
  }

  async function recuperarSeleccionados() {
    const ids = [...seleccion];
    if (!ids.length) return;
    setAccionLote(true);
    try {
      const r = await fetch('/api/funnels/carrito', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, recuperado: !verRecuperados }),
      });
      if (r.ok) {
        setCarritos(cs => cs.filter(c => !seleccion.has(c.id)));
        setSeleccion(new Set());
      }
    } catch { /* ignorar */ }
    finally { setAccionLote(false); }
  }

  async function eliminarSeleccionados() {
    const ids = [...seleccion];
    if (!ids.length) return;
    setAccionLote(true);
    try {
      const r = await fetch(`/api/funnels/carrito?ids=${encodeURIComponent(ids.join(','))}`, { method: 'DELETE' });
      if (r.ok) {
        setCarritos(cs => cs.filter(c => !seleccion.has(c.id)));
        setSeleccion(new Set());
      }
    } catch { /* ignorar */ }
    finally { setAccionLote(false); setConfirmarBorradoLote(false); }
  }

  const totalValor = carritos.reduce((s, c) => s + (c.valor ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-[#E8E8E8] w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8E8E8] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#0D0D0D]">🛒 Carritos abandonados</h3>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">
              Clientes que escribieron su nombre y WhatsApp pero no completaron la compra. ¡Escríbeles para recuperar la venta!
            </p>
          </div>
          {onClose && <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#0D0D0D] text-xl leading-none">×</button>}
        </div>

        {/* Filtro + resumen */}
        <div className="px-6 pt-4 flex items-center justify-between gap-2">
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
          <div className="px-6 pt-3">
            <div className="flex items-center gap-2 flex-wrap rounded-xl border border-[#EFEFEF] bg-[#FAFAFA] px-3 py-2">
              <label className="flex items-center gap-2 text-xs font-medium text-[#3A3A3A] cursor-pointer select-none">
                <input type="checkbox" checked={todosMarcados} onChange={alternarTodos}
                  className="w-4 h-4 accent-[#00A89D] cursor-pointer" />
                Seleccionar todo
              </label>
              {seleccion.size > 0 && (
                <span className="text-[11px] text-[#6B6B6B]">({seleccion.size} seleccionados)</span>
              )}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={recuperarSeleccionados}
                  disabled={seleccion.size === 0 || accionLote}
                  className="px-3 py-1.5 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A] disabled:opacity-40 disabled:cursor-not-allowed">
                  {verRecuperados ? '↩ Reabrir seleccionados' : '✅ Marcar recuperados'}
                </button>
                <button
                  onClick={() => setConfirmarBorradoLote(true)}
                  disabled={seleccion.size === 0 || accionLote}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  🗑 Eliminar seleccionados
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="text-center text-[#9A9A9A] text-sm py-10">Cargando…</div>
          ) : carritos.length === 0 ? (
            <div className="text-center text-[#9A9A9A] text-sm py-10">
              {verRecuperados ? 'Aún no has marcado carritos como recuperados.' : '🎉 No hay carritos abandonados. ¡Todos completaron su compra!'}
            </div>
          ) : (
            <div className="space-y-2">
              {carritos.map(c => {
                const tel = c.telefono.replace(/\D/g, '').replace(/^57/, '');
                const msg = encodeURIComponent(`¡Hola ${c.nombre?.split(' ')[0] ?? ''}! 😊 Vi que estabas por pedir ${c.producto ?? 'tu buzo'}${c.talla ? ` (${c.talla})` : ''}. ¿Te ayudo a completarlo? 🚚`);
                const campos = camposLegibles(c);
                const fotos = fotosDe(c);
                const estaAbierto = abierto === c.id;
                return (
                  <div key={c.id} className={`rounded-xl border ${seleccion.has(c.id) ? 'border-[#00A89D] bg-[#00A89D]/[0.04]' : 'border-[#EFEFEF]'}`}>
                    <div className="p-3 flex items-center gap-3">
                      <input type="checkbox" checked={seleccion.has(c.id)} onChange={() => alternar(c.id)}
                        title="Seleccionar" className="w-4 h-4 accent-[#00A89D] cursor-pointer shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#0D0D0D] truncate">{c.nombre || 'Sin nombre'}</span>
                          <span className="text-[10px] text-[#9A9A9A] shrink-0">· {cuandoFue(c.created_at)}</span>
                          {c.nota && <span title="Tiene nota del asesor" className="text-[11px] shrink-0">📝</span>}
                        </div>
                        <div className="text-[12px] text-[#6B6B6B] truncate">
                          {c.producto || '—'}{c.talla ? ` · ${c.talla}` : ''} · {pesos(c.valor)}
                        </div>
                        <div className="text-[12px] text-[#00847A] font-mono">{tel}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setAbierto(estaAbierto ? null : c.id)}
                          title="Ver todos los datos que alcanzó a llenar"
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${estaAbierto ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A]' : 'border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5]'}`}>
                          Ver todos los datos {estaAbierto ? '▴' : '▾'}
                        </button>
                        <a href={`https://wa.me/57${tel}?text=${msg}`} target="_blank" rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold hover:opacity-90">
                          WhatsApp
                        </a>
                        <a href={`tel:+57${tel}`}
                          className="px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs font-medium hover:bg-[#F5F5F5]">
                          📞
                        </a>
                      </div>
                    </div>

                    {/* Desplegable: todos los datos + fotos + acciones */}
                    {estaAbierto && (
                      <div className="px-3 pb-3 border-t border-[#F0F0F0] pt-2.5">
                        {/* Fotos del producto que veía */}
                        {fotos.length > 0 && (
                          <div className="flex gap-2 flex-wrap mb-3">
                            {fotos.map((u, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <a key={i} href={u} target="_blank" rel="noreferrer">
                                <img src={u} alt="" className="w-16 h-16 object-cover rounded-lg border border-[#E8E8E8]" loading="lazy" />
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Todos los campos */}
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1.5">Datos que llenó</p>
                        {campos.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                            {campos.map(x => (
                              <div key={x.etq} className="flex gap-1.5 text-[12px]">
                                <span className="text-[#9A9A9A] shrink-0">{x.etq}:</span>
                                <span className="text-[#0D0D0D] break-words">{x.val}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[12px] text-[#9A9A9A]">Solo alcanzó a dejar su nombre y WhatsApp.</p>
                        )}

                        <button
                          onClick={() => { navigator.clipboard?.writeText(campos.map(x => `${x.etq}: ${x.val}`).join('\n')).catch(() => {}); }}
                          className="mt-2 text-[11px] text-[#00847A] font-semibold hover:underline">
                          📋 Copiar datos
                        </button>

                        {/* Nota privada del asesor */}
                        <div className="mt-3 pt-3 border-t border-[#F0F0F0]">
                          {c.nota && editandoNota !== c.id && (
                            <div className="mb-2 rounded-lg bg-[#FFF8E1] border border-[#F3E4B3] px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-[#B8860B] mb-0.5">📝 Nota del asesor</p>
                              <p className="text-[12px] text-[#5C4B00] whitespace-pre-wrap break-words">{c.nota}</p>
                            </div>
                          )}

                          {editandoNota === c.id ? (
                            <div>
                              <textarea
                                value={borradorNota}
                                onChange={e => setBorradorNota(e.target.value)}
                                rows={3}
                                placeholder="Escribe una nota privada sobre este cliente (no la ve él)…"
                                className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-[13px] text-[#0D0D0D] focus:outline-none focus:border-[#00A89D] resize-y"
                              />
                              <div className="flex gap-2 mt-1.5">
                                <button onClick={() => guardarNota(c.id)} disabled={guardandoNota}
                                  className="px-3 py-1.5 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A] disabled:opacity-50">
                                  {guardandoNota ? 'Guardando…' : 'Guardar nota'}
                                </button>
                                <button onClick={() => setEditandoNota(null)} disabled={guardandoNota}
                                  className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs font-medium hover:bg-[#F5F5F5]">
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <button onClick={() => abrirNota(c)}
                                className="px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs font-medium hover:bg-[#F5F5F5]">
                                📝 {c.nota ? 'Editar nota' : 'Agregar nota'}
                              </button>
                              <button onClick={() => marcar(c.id, !verRecuperados)} disabled={marcando === c.id}
                                className="px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs font-medium hover:bg-[#F5F5F5] disabled:opacity-50">
                                {marcando === c.id ? '…' : verRecuperados ? '↩ Reabrir' : '✅ Marcar como recuperado'}
                              </button>
                              <button onClick={() => setAEliminar(c)}
                                className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 ml-auto">
                                🗑 Eliminar venta
                              </button>
                            </div>
                          )}
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

      <ConfirmacionModal
        abierto={!!aEliminar}
        titulo="¿Eliminar esta venta?"
        mensaje={aEliminar ? `Se borrará de verdad el carrito de ${aEliminar.nombre || 'este cliente'} (${aEliminar.telefono}). Esta acción no se puede deshacer.` : undefined}
        textoAceptar={eliminando ? 'Eliminando…' : 'Sí, eliminar'}
        textoCancelar="Cancelar"
        peligro
        onAceptar={() => { if (aEliminar) eliminar(aEliminar); }}
        onCancelar={() => { if (!eliminando) setAEliminar(null); }}
      />

      <ConfirmacionModal
        abierto={confirmarBorradoLote}
        titulo={`¿Eliminar ${seleccion.size} venta${seleccion.size === 1 ? '' : 's'}?`}
        mensaje="Se borrarán de verdad los carritos seleccionados. Esta acción no se puede deshacer."
        textoAceptar={accionLote ? 'Eliminando…' : 'Sí, eliminar'}
        textoCancelar="Cancelar"
        peligro
        onAceptar={eliminarSeleccionados}
        onCancelar={() => { if (!accionLote) setConfirmarBorradoLote(false); }}
      />
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DetalleVenta from '../ventas-vendedores/DetalleVenta';
import { pesos, fechaCorta, telBonito, type VentaVV } from '../ventas-vendedores/comun';
import { comprimirImagen } from '@/lib/imagen-comprimir';

/**
 * MASTER VENDEDORES (08-nov-2026). Módulo nuevo e independiente: ventas que los vendedores mandan por
 * WhatsApp, asignadas por su teléfono, y lo que ya subieron a Effi. Ver/editar/enviar una venta abre el
 * MISMO detalle del Centro Maestro EFFI (no se duplica esa lógica).
 */
const VERDE = '#00A89D';
const tarjeta = 'bg-white rounded-2xl border border-[#E8ECEB] shadow-sm';
type Pest = 'por_subir' | 'en_effi' | 'pendientes' | 'incidencias' | 'todas';
const POR_SUBIR = ['confirmada', 'lista_effi'];
const PENDIENTES = ['recibida', 'incompleta', 'ambigua', 'esperando_confirmacion'];
const INCIDENCIAS = ['error_effi', 'escalada'];

interface Vend {
  tercero: number; nombre: string; nombre_effi: string; telefono_principal: string; telefonos_extra: string[];
  foto: string | null; meta_mes: number | null; recepcion: boolean;
  stats?: { por_subir: number; pendientes: number; incidencias: number; en_effi_mes: number; valor_mes: number; valor_por_subir: number; unidades_por_subir: number; ventas_mes: number };
}
interface Rem { id_effi: string; telefono: string | null; nombre: string | null; ciudad: string | null; departamento: string | null; direccion: string | null; estado: string | null; total: number | null; guia: string | null; fecha_trans: string }

export default function MasterVendedoresPanel({ onAbrirChat }: { onAbrirChat?: (id: string) => void }) {
  const [lista, setLista] = useState<Vend[]>([]);
  const [resumen, setResumen] = useState<any>(null);
  const [actividad, setActividad] = useState<any[]>([]);
  const [sync, setSync] = useState<any>(null);
  const [moduloActivo, setModuloActivo] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [det, setDet] = useState<{ vendedor: Vend; ventas: VentaVV[]; remisiones: Rem[] } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [buscarV, setBuscarV] = useState('');
  const [pest, setPest] = useState<Pest>('por_subir');
  const [q, setQ] = useState('');
  const [vista, setVista] = useState<'grid' | 'lista'>('grid');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ nombre: string; principal: string; extra: string[] } | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch('/api/master-vendedores', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setLista(j.vendedores ?? []); setResumen(j.resumen_dia ?? null); setActividad(j.actividad ?? []);
    setSync(j.sync ?? null); setModuloActivo(!!j.modulo_activo); setCargando(false);
    setSel(s => s ?? (j.vendedores?.[0]?.tercero ?? null));
  }, []);
  const cargarVendedor = useCallback(async (t: number) => {
    const r = await fetch(`/api/master-vendedores?vendedor=${t}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setDet(j); setEdit({ nombre: j.vendedor.nombre, principal: j.vendedor.telefono_principal.slice(2), extra: (j.vendedor.telefonos_extra ?? []).map((x: string) => x.slice(2)) }); }
  }, []);
  useEffect(() => { cargar(); const t = setInterval(cargar, 60_000); return () => clearInterval(t); }, [cargar]);
  useEffect(() => { if (sel != null) cargarVendedor(sel); }, [sel, cargarVendedor]);

  const guardarFicha = async (cambios: Record<string, any>) => {
    if (sel == null) return;
    const r = await fetch('/api/master-vendedores', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tercero: sel, ...cambios }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setAviso(`❌ ${j.error ?? 'No se pudo guardar'}`); return false; }
    setAviso('✅ Guardado.'); cargar(); cargarVendedor(sel); return true;
  };
  const alternarRecepcion = async (activar: boolean) => {
    if (sel == null) return;
    if (activar && !confirm('Desde ahora el bot RECIBE las ventas que este vendedor mande por WhatsApp (foto + datos) y le pide confirmar, en vez de preguntarle el conteo. ¿Activar?')) return;
    const r = await fetch('/api/master-vendedores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tercero: sel, accion: 'recepcion', activar }) });
    if (r.ok) { setAviso(activar ? '✅ Recepción activada para este vendedor.' : 'Recepción apagada: vuelve al flujo de siempre.'); cargar(); cargarVendedor(sel); }
  };
  const subirFoto = async (f: File) => {
    const liviana = await comprimirImagen(f).catch(() => f);
    const fd = new FormData(); fd.append('file', liviana);
    const r = await fetch('/api/catalogos/upload-imagen', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (j.url) guardarFicha({ foto: j.url });
  };

  const v = det?.vendedor ?? lista.find(x => x.tercero === sel) ?? null;
  const s = lista.find(x => x.tercero === sel)?.stats;

  // Tarjetas: ventas del bot + remisiones subidas a mano
  type Tarjeta = { key: string; tipo: 'vv' | 'rem'; grupo: Pest; fecha: string; venta?: VentaVV; rem?: Rem };
  const tarjetas: Tarjeta[] = useMemo(() => {
    if (!det) return [];
    const a: Tarjeta[] = det.ventas.map(x => ({
      key: x.id, tipo: 'vv', fecha: x.creado_at, venta: x,
      grupo: x.effi_remision || x.estado === 'en_effi' ? 'en_effi' : POR_SUBIR.includes(x.estado) ? 'por_subir' : PENDIENTES.includes(x.estado) ? 'pendientes' : INCIDENCIAS.includes(x.estado) ? 'incidencias' : 'pendientes',
    }));
    const b: Tarjeta[] = det.remisiones.map(r => ({ key: `r${r.id_effi}`, tipo: 'rem', grupo: 'en_effi', fecha: r.fecha_trans, rem: r }));
    return [...a, ...b].sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)));
  }, [det]);
  const cuenta = (g: Pest) => g === 'todas' ? tarjetas.length : tarjetas.filter(t => t.grupo === g).length;
  const sinT = (t: unknown) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const visibles = tarjetas.filter(t => pest === 'todas' || t.grupo === pest).filter(t => {
    if (!q.trim()) return true;
    const txt = t.venta ? [t.venta.cliente_nombre, t.venta.cliente_celular, t.venta.municipio, t.venta.codigo, ...t.venta.items.map(i => `${i.catalogo} ${i.referencia}`)].join(' ')
      : [t.rem?.nombre, t.rem?.telefono, t.rem?.ciudad, t.rem?.id_effi].join(' ');
    return sinT(txt).includes(sinT(q));
  });

  const totales = useMemo(() => lista.reduce((a, x) => ({
    por_subir: a.por_subir + (x.stats?.por_subir ?? 0), valor: a.valor + (x.stats?.valor_por_subir ?? 0),
    unidades: a.unidades + (x.stats?.unidades_por_subir ?? 0), pend: a.pend + (x.stats?.pendientes ?? 0), inc: a.inc + (x.stats?.incidencias ?? 0),
  }), { por_subir: 0, valor: 0, unidades: 0, pend: 0, inc: 0 }), [lista]);

  const iniciales = (n: string) => n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const Avatar = ({ x, tam }: { x: Vend; tam: number }) => x.foto
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={x.foto} alt="" className="rounded-full object-cover shrink-0" style={{ width: tam, height: tam }} />
    : <div className="rounded-full shrink-0 flex items-center justify-center font-bold text-white" style={{ width: tam, height: tam, background: 'linear-gradient(135deg,#0B7F78,#00A89D)', fontSize: tam * 0.36 }}>{iniciales(x.nombre)}</div>;

  if (cargando) return <div className="flex-1 flex items-center justify-center text-sm text-[#6B6B6B]">Cargando Master Vendedores…</div>;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#F4F6F5]">
      <div className="max-w-[1700px] mx-auto px-4 md:px-6 py-5">
        {/* Encabezado */}
        <header className="flex items-start gap-4 flex-wrap mb-4 pl-10 md:pl-0">
          <div className="text-3xl">👥</div>
          <div className="flex-1 min-w-[260px]">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#0D1F1C]">Master Vendedores</h1>
              <span className="px-4 py-1 rounded-xl bg-[#0D1F1C] text-white text-sm font-extrabold tracking-wide">MASTER VENDEDORES</span>
            </div>
            <p className="text-[13px] text-[#5B6B68] mt-1 max-w-2xl">Las ventas que los vendedores envían desde sus números de WhatsApp las detecta el bot y se asignan solas al vendedor según su teléfono. También se ve lo que cada uno ya subió a Effi.</p>
          </div>
          <span className={`px-3 py-2 rounded-xl text-sm font-bold ${moduloActivo ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#F1F1F1] text-[#6B6B6B]'}`}>● {moduloActivo ? 'Módulo activo' : 'Módulo apagado'}</span>
          <button onClick={() => { cargar(); if (sel != null) cargarVendedor(sel); }} className="px-4 py-2 rounded-xl bg-white border border-[#E1E5E4] text-sm font-semibold hover:bg-[#F4F7F6]">⟳ Actualizar</button>
        </header>
        {aviso && <p className="mb-3 text-xs px-3 py-2 rounded-lg bg-white border border-[#E8ECEB]">{aviso} <button onClick={() => setAviso(null)} className="ml-2 text-[#9AA]">✕</button></p>}

        <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
          <div className="min-w-0">
            {/* Métricas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {[
                { i: '🛒', t: 'Ventas por subir', v: String(totales.por_subir), c: '#E6F7F4' },
                { i: '$', t: 'Valor por subir', v: pesos(totales.valor), c: '#FEF3C7' },
                { i: '📦', t: 'Unidades por subir', v: String(totales.unidades), c: '#FDF2E9' },
                { i: '⚠️', t: 'Pendientes / incidencias', v: `${totales.pend} / ${totales.inc}`, c: '#FEE2E2' },
              ].map(m => (
                <div key={m.t} className={`${tarjeta} p-4 flex items-center gap-3`}>
                  <span className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: m.c }}>{m.i}</span>
                  <div className="min-w-0"><p className="text-[12px] text-[#5B6B68]">{m.t}</p><p className="text-2xl font-extrabold text-[#0D1F1C] truncate">{m.v}</p></div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[270px_1fr]">
              {/* Lista de vendedores */}
              <div className={`${tarjeta} p-3 self-start`}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="font-extrabold text-[#0D1F1C]">👥 Vendedores ({lista.length})</h3>
                </div>
                <input value={buscarV} onChange={e => setBuscarV(e.target.value)} placeholder="🔍 Buscar vendedor…" className="w-full mb-2 px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm" />
                <ul className="space-y-1.5 max-h-[720px] overflow-y-auto">
                  {lista.filter(x => !buscarV.trim() || sinT(x.nombre).includes(sinT(buscarV))).map(x => (
                    <li key={x.tercero}>
                      <button onClick={() => { setSel(x.tercero); setPest('por_subir'); }}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition ${sel === x.tercero ? 'border-[#00A89D] bg-[#ECFDF8]' : 'border-transparent hover:bg-[#F4F7F6]'}`}>
                        <Avatar x={x} tam={40} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold truncate">{x.nombre}</span>
                          <span className="block text-[11px] text-[#5B6B68]">
                            Por subir: <b className={x.stats?.por_subir ? 'text-[#C2410C]' : ''}>{x.stats?.por_subir ?? 0}</b> · Effi mes: {x.stats?.en_effi_mes ?? 0}
                          </span>
                          {x.meta_mes ? <span className="block text-[10px] text-[#7A8A87]">Faltan {Math.max(0, x.meta_mes - (x.stats?.ventas_mes ?? 0))} para la meta</span> : null}
                        </span>
                        {x.recepcion && <span title="Recepción por WhatsApp activa" className="w-2 h-2 rounded-full bg-[#22C55E]" />}
                        <span className="text-[#B5C0BE]">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Vendedor seleccionado */}
              {v && (
                <div className="min-w-0 space-y-4">
                  <div className={`${tarjeta} p-4`}>
                    <div className="flex items-start gap-4 flex-wrap">
                      <label className="relative cursor-pointer" title="Cambiar foto">
                        <Avatar x={v} tam={84} />
                        <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#25D366] text-white flex items-center justify-center text-sm border-2 border-white">📷</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ''; }} />
                      </label>
                      <div className="flex-1 min-w-[260px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-extrabold">{v.nombre}</h2>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-xs font-bold">Vendedor activo</span>
                        </div>
                        <p className="text-[11px] text-[#5B6B68] mt-1">ⓘ Nombre y teléfono traídos de Vendedores de Effi ({v.nombre_effi}).</p>
                        {edit && (
                          <div className="grid sm:grid-cols-2 gap-3 mt-3">
                            <div>
                              <label className="block text-[12px] font-semibold mb-1">Nombre</label>
                              <input value={edit.nombre} onChange={e => setEdit({ ...edit, nombre: e.target.value })} onBlur={() => edit.nombre !== v.nombre && guardarFicha({ nombre: edit.nombre })}
                                className="w-full px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm" />
                            </div>
                            <div>
                              <label className="block text-[12px] font-semibold mb-1">Teléfono principal</label>
                              <input value={edit.principal} onChange={e => setEdit({ ...edit, principal: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                onBlur={() => edit.principal !== v.telefono_principal.slice(2) && guardarFicha({ telefono_principal: edit.principal })}
                                className="w-full px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[12px] font-semibold mb-1">Otros teléfonos (las ventas de estos números también son de {v.nombre.split(' ')[0]})</label>
                              <div className="flex flex-wrap gap-2">
                                {edit.extra.map((t, i) => (
                                  <span key={i} className="flex items-center gap-1 rounded-xl border border-[#E1E5E4] pl-2 pr-1 py-1">
                                    <input value={t} onChange={e => { const n = [...edit.extra]; n[i] = e.target.value.replace(/\D/g, '').slice(0, 10); setEdit({ ...edit, extra: n }); }}
                                      onBlur={() => guardarFicha({ telefonos_extra: edit.extra.filter(Boolean) })} className="w-28 text-sm outline-none" />
                                    <button onClick={() => { const n = edit.extra.filter((_, k) => k !== i); setEdit({ ...edit, extra: n }); guardarFicha({ telefonos_extra: n }); }} className="w-6 h-6 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2]">✕</button>
                                  </span>
                                ))}
                                <button onClick={() => setEdit({ ...edit, extra: [...edit.extra, ''] })} className="px-3 py-1.5 rounded-xl border-2 border-[#00A89D] text-[#00847A] text-sm font-bold">+ Agregar teléfono</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="w-full sm:w-auto rounded-xl border border-[#E8ECEB] p-3">
                        <p className="text-[12px] font-bold">Recepción de ventas por WhatsApp</p>
                        <p className="text-[11px] text-[#7A8A87] max-w-[220px]">{v.recepcion ? 'El bot recibe sus ventas y las asigna aquí.' : 'Apagada: el bot sigue con el flujo de siempre (conteo de ventas).'}</p>
                        <button onClick={() => alternarRecepcion(!v.recepcion)}
                          className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-bold ${v.recepcion ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'text-white'}`} style={v.recepcion ? undefined : { background: VERDE }}>
                          {v.recepcion ? 'Apagar recepción' : 'Activar recepción'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Ventas */}
                  <div className={`${tarjeta} p-4`}>
                    <div className="flex gap-2 flex-wrap mb-3">
                      {([['por_subir', 'Por subir', '#0B7F78'], ['en_effi', 'En EFFI', '#2563EB'], ['pendientes', 'Pendientes', '#B45309'], ['incidencias', 'Incidencias', '#B91C1C'], ['todas', 'Todas', '#374151']] as [Pest, string, string][]).map(([k, t, c]) => (
                        <button key={k} onClick={() => setPest(k)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition ${pest === k ? 'text-white border-transparent' : 'bg-white border-[#E1E5E4] text-[#1F2A28]'}`}
                          style={pest === k ? { background: c } : undefined}>
                          {t} <span className={`px-2 rounded-full text-xs ${pest === k ? 'bg-white/25' : 'bg-[#F1F5F4]'}`}>{cuenta(k)}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 mb-3">
                      <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Buscar venta, cliente, producto…" className="flex-1 px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm" />
                      <div className="flex p-1 rounded-xl border border-[#E1E5E4]">
                        <button onClick={() => setVista('grid')} className={`px-2.5 rounded-lg ${vista === 'grid' ? 'bg-[#0B7F78] text-white' : ''}`}>▦</button>
                        <button onClick={() => setVista('lista')} className={`px-2.5 rounded-lg ${vista === 'lista' ? 'bg-[#0B7F78] text-white' : ''}`}>☰</button>
                      </div>
                    </div>
                    {visibles.length === 0 ? (
                      <p className="text-sm text-[#7A8A87] py-10 text-center">
                        {pest === 'por_subir' && !v.recepcion ? 'No hay ventas por subir. La recepción por WhatsApp de este vendedor está apagada.' : 'No hay ventas aquí.'}
                      </p>
                    ) : (
                      <div className={vista === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-2'}>
                        {visibles.map(t => t.tipo === 'vv' ? (
                          <TarjetaVenta key={t.key} venta={t.venta!} grupo={t.grupo} vendedor={v.nombre} onVer={() => setAbierta(t.venta!.id)} onChat={() => t.venta!.conversacion_id && onAbrirChat?.(t.venta!.conversacion_id)} />
                        ) : (
                          <TarjetaRemision key={t.key} r={t.rem!} vendedor={v.nombre} onChat={() => t.rem!.telefono && onAbrirChat?.(`57${String(t.rem!.telefono).replace(/\D/g, '').slice(-10)}`)} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Columna derecha */}
          <aside className="space-y-4">
            <div className={`${tarjeta} p-4`}>
              <div className="flex items-center justify-between mb-2"><h3 className="font-extrabold">📅 Resumen del día</h3><span className="text-[11px] text-[#7A8A87]">{new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' })}</span></div>
              {[
                ['✅', 'Enviadas a EFFI (hoy)', resumen?.enviadas_effi ?? 0, '#DCFCE7'],
                ['💬', 'Ventas por subir', resumen?.por_subir ?? 0, '#E6F7F4'],
                ['📦', 'Unidades recibidas hoy', resumen?.unidades ?? 0, '#EFF6FF'],
                ['⚠️', 'Pendientes / incidencias', resumen?.pendientes ?? 0, '#FEF3C7'],
              ].map(([i, t, n, c]) => (
                <div key={String(t)} className="flex items-center gap-2 px-3 py-2 rounded-xl mb-1.5" style={{ background: String(c) }}>
                  <span>{i}</span><span className="flex-1 text-sm">{t}</span><b>{n}</b>
                </div>
              ))}
            </div>

            {v && s && (
              <div className={`${tarjeta} p-4`}>
                <h3 className="font-extrabold mb-1">👤 Resumen del vendedor</h3>
                <p className="font-bold text-[#0D1F1C] mb-2">{v.nombre}</p>
                {[
                  ['📊', 'Ventas del mes', s.ventas_mes],
                  ['$', 'Valor del mes', pesos(s.valor_mes)],
                  ['✅', 'En Effi este mes', s.en_effi_mes],
                  ['🛒', 'Por subir', s.por_subir],
                ].map(([i, t, n]) => (
                  <div key={String(t)} className="flex items-center gap-2 px-1 py-1.5 border-b border-[#F0F3F2] text-sm"><span className="w-5 text-center">{i}</span><span className="flex-1">{t}</span><b>{n}</b></div>
                ))}
                <div className="mt-3">
                  <label className="text-[12px] font-semibold">Meta del mes (opcional)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="number" min={0} defaultValue={v.meta_mes ?? ''} key={`meta-${v.tercero}`} onBlur={e => guardarFicha({ meta_mes: Number(e.target.value) || null })}
                      placeholder="Ej. 100" className="w-24 px-2 py-1.5 rounded-lg border border-[#E1E5E4] text-sm" />
                    {v.meta_mes ? <span className="text-sm text-[#5B6B68]">{s.ventas_mes} / {v.meta_mes}</span> : null}
                  </div>
                  {v.meta_mes ? (
                    <div className="mt-2 h-2 rounded-full bg-[#E8ECEB] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((s.ventas_mes / v.meta_mes) * 100))}%`, background: VERDE }} /></div>
                  ) : null}
                </div>
              </div>
            )}

            <div className={`${tarjeta} p-4`}>
              <h3 className="font-extrabold mb-2">🔄 Actividad de sincronización</h3>
              {sync && <p className="text-[11px] text-[#7A8A87] mb-2">Copia de Effi: {sync.fin ? fechaCorta(sync.fin) : 'en curso…'}{sync.remisiones != null ? ` · ${sync.remisiones} remisiones` : ''}</p>}
              {actividad.length === 0 ? <p className="text-sm text-[#7A8A87]">Sin actividad todavía.</p> : (
                <ul className="space-y-2">
                  {actividad.map((a, i) => (
                    <li key={i} className="flex gap-2 rounded-xl bg-[#F7FAF9] p-2">
                      <span>{a.tipo === 'effi' || a.tipo === 'effi_enviada' ? '✅' : a.tipo === 'effi_error' ? '⚠️' : '💬'}</span>
                      <div className="flex-1 min-w-0"><p className="text-[12.5px] font-bold">{a.titulo}</p><p className="text-[11px] text-[#5B6B68] truncate">{a.detalle}</p></div>
                      <span className="text-[10px] text-[#9AA7A5] whitespace-nowrap">{fechaCorta(a.fecha)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>

      {abierta && (
        <DetalleVenta id={abierta} onCerrar={() => setAbierta(null)} onCambio={() => { cargar(); if (sel != null) cargarVendedor(sel); }}
          onChat={tel => onAbrirChat?.(tel)} />
      )}
    </div>
  );
}

function TarjetaVenta({ venta, grupo, vendedor, onVer, onChat }: { venta: VentaVV; grupo: Pest; vendedor: string; onVer: () => void; onChat: () => void }) {
  const it = venta.items[0];
  const foto = it?.foto_vendedor || it?.foto_oficial || venta.fotos_vendedor?.[0] || null;
  const chip = grupo === 'en_effi' ? ['En EFFI', '#DCFCE7', '#15803D'] : grupo === 'por_subir' ? ['Por subir', '#FEF3C7', '#B45309'] : grupo === 'incidencias' ? ['Incidencia', '#FEE2E2', '#B91C1C'] : ['Pendiente', '#FFF7ED', '#C2410C'];
  return (
    <div className="rounded-2xl border border-[#E8ECEB] p-3 flex gap-3 bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {foto ? <img src={foto} alt="" className="w-24 h-24 rounded-xl object-cover bg-[#F1F5F4] shrink-0" /> : <div className="w-24 h-24 rounded-xl bg-[#F1F5F4] flex items-center justify-center text-2xl shrink-0">📦</div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: chip[1], color: chip[2] }}>● {chip[0]}</span>
          <span className="text-[10.5px] text-[#5B6B68]">👤 {vendedor}</span>
          {venta.conversacion_id && <button onClick={onChat} className="ml-auto w-7 h-7 rounded-full border border-[#25D366] text-[#25D366] text-sm" title="Ir al chat">💬</button>}
        </div>
        <p className="font-bold text-[15px] mt-1 truncate">{venta.cliente_nombre || 'Sin nombre aún'}</p>
        <p className="text-[12px] text-[#5B6B68]">📞 {telBonito(venta.cliente_celular)} · 📍 {venta.municipio || '—'}</p>
        {it && <p className="text-[12.5px] font-bold uppercase mt-1 truncate">{it.catalogo || it.descripcion}</p>}
        {it && <p className="text-[11px] text-[#7A8A87]">Talla: <b>{it.talla || '—'}</b> · Color: <b>{it.color || '—'}</b>{it.referencia ? ` · Ref.: ${it.referencia}` : ''} · {venta.items.reduce((a, x) => a + (x.cantidad || 0), 0)} und.</p>}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-lg bg-[#FEF3C7] text-[#92400E] text-sm font-extrabold">{pesos(venta.total)}</span>
          <span className="text-[10.5px] text-[#9AA7A5]">{fechaCorta(venta.creado_at)}</span>
          <button onClick={onVer} className="ml-auto px-3 py-1.5 rounded-lg border border-[#E1E5E4] text-xs font-semibold">Ver detalle ›</button>
          {grupo === 'en_effi'
            ? <span className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-bold">✓ En Effi {venta.effi_remision ? `#${venta.effi_remision}` : ''}</span>
            : <button onClick={onVer} className="px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ background: VERDE }}>➤ Enviar a EFFI</button>}
        </div>
      </div>
    </div>
  );
}

function TarjetaRemision({ r, vendedor, onChat }: { r: Rem; vendedor: string; onChat: () => void }) {
  return (
    <div className="rounded-2xl border border-[#E8ECEB] p-3 flex gap-3 bg-white">
      <div className="w-24 h-24 rounded-xl bg-[#EFF6FF] flex flex-col items-center justify-center shrink-0 text-[#1D4ED8]">
        <span className="text-2xl">🧾</span><span className="text-[11px] font-bold">#{r.id_effi}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D]">● En EFFI</span>
          <span className="text-[10.5px] text-[#5B6B68]">👤 {vendedor}</span>
          {r.telefono && <button onClick={onChat} className="ml-auto w-7 h-7 rounded-full border border-[#25D366] text-[#25D366] text-sm" title="Ir al chat">💬</button>}
        </div>
        <p className="font-bold text-[15px] mt-1 truncate">{(r.nombre ?? '').trim() || 'Cliente'}</p>
        <p className="text-[12px] text-[#5B6B68]">📞 {telBonito(r.telefono)} · 📍 {r.ciudad || '—'}</p>
        <p className="text-[11px] text-[#7A8A87] truncate">{r.estado ?? ''}{r.guia ? ` · Guía ${r.guia}` : ' · Sin guía aún'}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="px-2.5 py-1 rounded-lg bg-[#FEF3C7] text-[#92400E] text-sm font-extrabold">{pesos(r.total)}</span>
          <span className="text-[10.5px] text-[#9AA7A5]">{fechaCorta(r.fecha_trans)}</span>
          <span className="ml-auto px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-bold">✓ En Effi</span>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { PildoraEstado, pesos, fechaCorta, type VentaVV, type ItemVV } from './comun';
import { ETIQUETA_ESTADO } from '@/lib/ventas-vendedores/estados';

type Campos = Partial<Record<keyof VentaVV, string>>;

const SECCION = (ico: string, t: string) => (
  <h4 className="flex items-center gap-2 text-[12px] font-extrabold tracking-wide text-[#5E5E5A] uppercase mt-5 mb-2">
    <span className="text-[#A5791F]">{ico}</span>{t}
  </h4>
);

function Campo({ l, v, k, editable, onCambio, mono, full }: {
  l: string; v: string | null | undefined; k?: keyof VentaVV; editable?: boolean; mono?: boolean; full?: boolean;
  onCambio?: (k: keyof VentaVV, val: string) => void;
}) {
  return (
    <label className={`block ${full ? 'col-span-2' : ''}`}>
      <span className="block text-[12px] text-[#5E5E5A] mb-1">{l}</span>
      {editable && k ? (
        <input defaultValue={v ?? ''} onChange={e => onCambio?.(k, e.target.value)}
          className={`w-full min-h-[44px] px-3 rounded-xl bg-[#F1F1EF] border border-transparent focus:border-[#C79A3B] focus:bg-white outline-none text-[14px] ${mono ? 'font-mono' : ''}`} />
      ) : (
        <span className={`block min-h-[44px] px-3 py-2.5 rounded-xl bg-[#F1F1EF] text-[14px] text-[#3a3a37] ${mono ? 'font-mono' : ''}`}>{v || '—'}</span>
      )}
    </label>
  );
}

export default function DetalleVenta({ id, onCerrar, onCambio, onChat }: {
  id: string; onCerrar: () => void; onCambio: () => void; onChat: (tel: string) => void;
}) {
  const [d, setD] = useState<{ venta: VentaVV; items: ItemVV[]; eventos: any[]; opciones: Record<number, { color: string; talla: string }[]> } | null>(null);
  const [campos, setCampos] = useState<Campos>({});
  const [items, setItems] = useState<Record<number, Partial<ItemVV>>>({});
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; t: string } | null>(null);
  const [verFoto, setVerFoto] = useState<string | null>(null);

  const cargar = async () => {
    const r = await fetch(`/api/ventas-vendedores/${id}`, { cache: 'no-store' });
    if (r.ok) { setD(await r.json()); setCampos({}); setItems({}); }
  };
  useEffect(() => { cargar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  const v = d?.venta;
  const bloqueada = !!v && (!!v.effi_remision || v.estado === 'en_effi' || v.estado === 'enviando_effi');
  const editable = !!v && !bloqueada && v.estado !== 'cancelada';
  const hayCambios = Object.keys(campos).length > 0 || Object.keys(items).length > 0;

  const llamar = async (url: string, metodo: string, body?: unknown) => {
    setTrabajando(true); setAviso(null);
    try {
      const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok && j.ok !== false, j };
    } finally { setTrabajando(false); }
  };

  const guardar = async () => {
    if (!motivo.trim()) { setAviso({ ok: false, t: 'Escribe el motivo del cambio.' }); return; }
    const { ok, j } = await llamar(`/api/ventas-vendedores/${id}`, 'PATCH', {
      motivo, campos, items: Object.entries(items).map(([iid, x]) => ({ id: Number(iid), ...x })),
    });
    setAviso({ ok, t: ok ? 'Cambios guardados.' : (j.error || (j.problemas ?? []).join(' · ') || 'No se pudo guardar') });
    setMotivo(''); await cargar(); onCambio();
  };
  const accion = async (a: string, conMotivo = false) => {
    const m = conMotivo ? (window.prompt('Motivo:') ?? '') : '';
    if (conMotivo && !m.trim()) return;
    const { ok, j } = await llamar(`/api/ventas-vendedores/${id}`, 'PATCH', { accion: a, motivo: m });
    setAviso({ ok, t: ok ? 'Listo.' : j.error || 'No se pudo' });
    await cargar(); onCambio();
  };
  const subirEffi = async () => {
    const { ok, j } = await llamar(`/api/ventas-vendedores/${id}/effi`, 'POST');
    setAviso({ ok, t: [j.mensaje, ...(j.errores ?? [])].filter(Boolean).join(' · ') });
    await cargar(); onCambio();
    // La vista previa de la remisión está arriba del detalle: se sube para verla.
    document.getElementById('vv-detalle-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPrendas = (d?.items ?? []).reduce((s, i) => s + (i.cantidad || 0), 0);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/30" onClick={onCerrar}>
      <aside className="w-full max-w-[540px] h-full bg-white shadow-[0_20px_60px_rgba(20,20,20,.22)] flex flex-col animate-[vvEntra_.22s_ease-out]" onClick={e => e.stopPropagation()}>
        <style>{`@keyframes vvEntra{from{transform:translateX(40px);opacity:.4}to{transform:none;opacity:1}} @media (prefers-reduced-motion:reduce){aside{animation:none!important}}`}</style>
        {/* Encabezado */}
        <header className="px-5 pt-4 pb-3 border-b border-[#EFEEEA] flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-extrabold leading-tight truncate">Venta de {v?.cliente_nombre || '…'}</h2>
            {v && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <PildoraEstado estado={v.estado} />
                <span className="text-[12px] text-[#8B8B86] font-mono">{fechaCorta(v.creado_at)}</span>
                <span className="text-[11px] text-[#8B8B86] font-mono">#{v.codigo}</span>
              </div>
            )}
          </div>
          {v && <button onClick={() => onChat(v.vendedor_tel)} className="h-9 px-3 rounded-xl border-2 border-[#14804A] text-[#14804A] text-[13px] font-bold hover:bg-[#E0F3E8]">💬 Novedades</button>}
          <button onClick={onCerrar} className="w-9 h-9 rounded-xl border border-[#E7E6E1] hover:bg-[#F1F1EF]" aria-label="Cerrar">✕</button>
        </header>

        <div id="vv-detalle-scroll" className="flex-1 overflow-y-auto px-5 pb-6">
          {!d || !v ? (
            <div className="space-y-3 pt-5">{[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-[#F1F1EF] animate-pulse" />)}</div>
          ) : (
            <>
              {/* Effi */}
              {v.effi_remision ? (
                <>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[13px] text-[#14804A]">🧾 Remisión en Effi <b>{v.effi_remision}</b></span>
                    <span className="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-[#E0F3E8] text-[#14804A]">Ver en Effi ↗</span>
                  </div>
                  <div className="mt-3 rounded-xl bg-[#E0EAFA] text-[#1F5FBF] text-[13px] px-3 py-2.5">🔒 Esta venta ya está en Effi. Para cambiarla o anularla, escríbele a Novedades.</div>
                </>
              ) : v.effi_payload?.vista ? (
                <VistaRemision p={v.effi_payload} lista={v.effi_estado === 'simulado'} />
              ) : v.effi_estado === 'simulado' ? (
                <div className="mt-4 rounded-xl bg-[#F7EEDA] text-[#7A5A12] text-[13px] px-3 py-2.5">🧪 La solicitud a Effi está armada y guardada, pero <b>no se envió</b> (modo simulación).</div>
              ) : null}
              {v.faltantes?.length > 0 && v.estado !== 'cancelada' && (
                <div className="mt-3 rounded-xl bg-[#FDEBD0] text-[#B25E00] text-[13px] px-3 py-2.5">⚠️ Falta: {v.faltantes.join(' · ')}</div>
              )}
              {v.motivo_revision && v.estado === 'escalada' && (
                <div className="mt-3 rounded-xl bg-[#FBE3D3] text-[#A04300] text-[13px] px-3 py-2.5">↗ Escalada: {v.motivo_revision}</div>
              )}

              {SECCION('👤', 'Cliente')}
              <div className="grid grid-cols-2 gap-3">
                <Campo full l="Nombre del cliente" v={v.cliente_nombre} k="cliente_nombre" editable={editable} onCambio={(k, x) => setCampos(c => ({ ...c, [k]: x }))} />
                <Campo l="Celular" v={v.cliente_celular} k="cliente_celular" editable={editable} mono onCambio={(k, x) => setCampos(c => ({ ...c, [k]: x }))} />
                <Campo l="Identificación" v={v.cliente_identificacion} k="cliente_identificacion" editable={editable} mono onCambio={(k, x) => setCampos(c => ({ ...c, [k]: x }))} />
                <Campo full l="Correo (vacío = gerencia@klixmant.com)" v={v.cliente_correo} k="cliente_correo" editable={editable} onCambio={(k, x) => setCampos(c => ({ ...c, [k]: x }))} />
              </div>

              {SECCION('📍', 'Dirección')}
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Departamento', 'departamento'], ['Municipio', 'municipio'], ['Dirección', 'direccion'], ['Barrio', 'barrio'],
                  ['Complemento', 'complemento'], ['Referencia', 'referencia_dir'], ['Transportadora', 'transportadora'],
                ] as [string, keyof VentaVV][]).map(([l, k]) => (
                  <Campo key={k} l={l} v={v[k] as string} k={k} editable={editable} onCambio={(kk, x) => setCampos(c => ({ ...c, [kk]: x }))} />
                ))}
              </div>

              {SECCION('👕', `Prendas (${totalPrendas})`)}
              <div className="space-y-3">
                {d.items.length === 0 && <p className="text-[13px] text-[#8B8B86]">Sin prendas todavía.</p>}
                {d.items.map(it => {
                  const ops = it.id_item ? d.opciones[it.id_item] ?? [] : [];
                  const colorSel = (items[it.id]?.color ?? it.color) || '';
                  const colores = [...new Set(ops.map(o => o.color).filter(Boolean))];
                  const tallas = [...new Set(ops.filter(o => !colorSel || o.color === colorSel).map(o => o.talla).filter(Boolean))];
                  return (
                    <div key={it.id} className="rounded-2xl border border-[#E7E6E1] p-3">
                      <div className="flex gap-3">
                        {[it.foto_oficial, it.foto_vendedor].filter(Boolean).map((f, i) => (
                          <button key={i} onClick={() => setVerFoto(f!)} className="w-20 h-24 rounded-xl overflow-hidden bg-[#F1F1EF] shrink-0 relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={f!} alt="" className="w-full h-full object-cover" />
                            <span className="absolute bottom-0 inset-x-0 text-[9px] font-bold bg-black/55 text-white py-0.5">{i === 0 && it.foto_oficial ? 'Oficial' : 'Vendedor'}</span>
                          </button>
                        ))}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-extrabold uppercase leading-tight">{it.catalogo || it.descripcion || 'Sin identificar'}</p>
                          <p className="text-[11px] text-[#8B8B86] font-mono">Ref. {it.referencia || '—'} · {it.tipo || '—'} · {it.genero || 'Hombre'}</p>
                          <p className="text-[11px] text-[#8B8B86] font-mono">Variante {it.id_variante ?? '—'} · SKU {it.sku || '—'}</p>
                          <p className="text-[11px] text-[#8B8B86] font-mono">Producto {it.id_item ?? '—'} · Catálogo {it.id_catalogo ?? '—'}{it.confianza != null ? ` · confianza ${Math.round(Number(it.confianza) * 100)}%` : ''}</p>
                          {it.estado !== 'ok' && <p className="text-[11.5px] font-bold text-[#B25E00] mt-0.5">⚠️ {it.estado === 'ambiguo' ? 'Producto por elegir' : it.estado === 'sin_variante' ? 'Variante no encontrada' : it.estado === 'sin_identificar' ? 'No está en el catálogo' : it.estado}</p>}
                        </div>
                      </div>
                      {it.id_variante ? <CodigosEffi it={it} /> : null}
                      <div className="grid grid-cols-4 gap-2 mt-3">
                        {editable && colores.length ? (
                          <label className="text-[11px] text-[#5E5E5A]">Color
                            <select value={colorSel} onChange={e => setItems(s => ({ ...s, [it.id]: { ...s[it.id], color: e.target.value } }))} className="mt-1 w-full h-10 px-2 rounded-xl bg-[#F1F1EF] text-[13px]">
                              {colores.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </label>
                        ) : <Mini l="Color" v={it.color} />}
                        {editable && tallas.length ? (
                          <label className="text-[11px] text-[#5E5E5A]">Talla
                            <select value={(items[it.id]?.talla ?? it.talla) || ''} onChange={e => setItems(s => ({ ...s, [it.id]: { ...s[it.id], talla: e.target.value } }))} className="mt-1 w-full h-10 px-2 rounded-xl bg-[#F1F1EF] text-[13px]">
                              <option value="">—</option>
                              {tallas.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </label>
                        ) : <Mini l="Talla" v={it.talla} />}
                        {editable ? (
                          <label className="text-[11px] text-[#5E5E5A]">Cantidad
                            <input type="number" min={1} defaultValue={it.cantidad} onChange={e => setItems(s => ({ ...s, [it.id]: { ...s[it.id], cantidad: Number(e.target.value) } }))} className="mt-1 w-full h-10 px-2 rounded-xl bg-[#F1F1EF] text-[13px]" />
                          </label>
                        ) : <Mini l="Cantidad" v={String(it.cantidad)} />}
                        {editable ? (
                          <label className="text-[11px] text-[#5E5E5A]">Precio c/u
                            <input defaultValue={it.precio ?? ''} onChange={e => setItems(s => ({ ...s, [it.id]: { ...s[it.id], precio: Number(e.target.value.replace(/\D/g, '')) } }))} className="mt-1 w-full h-10 px-2 rounded-xl bg-[#F1F1EF] text-[13px] font-mono" />
                          </label>
                        ) : <Mini l="Precio c/u" v={pesos(it.precio)} />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {SECCION('💵', 'Pago')}
              <div className="grid grid-cols-2 gap-3">
                <Campo l="Valor total" v={v.total ? String(v.total) : ''} k="total" editable={editable} mono onCambio={(k, x) => setCampos(c => ({ ...c, [k]: x }))} />
                <Campo l="Tipo de pago" v={v.tipo_pago} k="tipo_pago" editable={editable} onCambio={(k, x) => setCampos(c => ({ ...c, [k]: x }))} />
                <Campo l="Abono recibido" v={v.abono ? String(v.abono) : ''} k="abono" editable={editable} mono onCambio={(k, x) => setCampos(c => ({ ...c, [k]: x }))} />
                <Campo l="Saldo pendiente" v={pesos((Number(v.total) || 0) - (Number(v.abono) || 0))} mono />
                <Campo full l="Observaciones" v={v.observaciones} k="observaciones" editable={editable} onCambio={(k, x) => setCampos(c => ({ ...c, [k]: x }))} />
              </div>

              {v.fotos_vendedor?.length > 0 && (
                <>
                  {SECCION('📷', 'Fotos que mandó el vendedor')}
                  <div className="flex gap-2 flex-wrap">
                    {v.fotos_vendedor.map(f => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <button key={f} onClick={() => setVerFoto(f)}><img src={f} alt="" className="w-16 h-16 rounded-xl object-cover" /></button>
                    ))}
                  </div>
                </>
              )}

              {SECCION('🧭', 'Trazabilidad')}
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
                <Dt t="Vendedor" v={`${v.vendedor_nombre || '—'} (${v.vendedor_tel})`} />
                <Dt t="Recibida" v={fechaCorta(v.creado_at)} />
                <Dt t="Confirmada" v={v.confirmado_at ? fechaCorta(v.confirmado_at) : '—'} />
                <Dt t="Effi" v={v.effi_estado ? `${v.effi_estado}${v.effi_enviado_at ? ` · ${fechaCorta(v.effi_enviado_at)}` : ''}` : '—'} />
                <Dt t="Remisión" v={v.effi_remision || '—'} />
                <Dt t="Estado" v={ETIQUETA_ESTADO[v.estado as keyof typeof ETIQUETA_ESTADO] ?? v.estado} />
              </dl>
              <ul className="mt-3 space-y-2 border-l-2 border-[#EFEEEA] pl-3">
                {d.eventos.map(e => (
                  <li key={e.id} className="text-[12px]">
                    <span className="text-[#8B8B86] font-mono">{fechaCorta(e.creado_at)} · {e.quien || '—'}</span>
                    <p className="text-[#3a3a37]">{textoEvento(e)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Pie */}
        <footer className="border-t border-[#EFEEEA] px-5 py-3 space-y-2">
          {aviso && <p className={`text-[12.5px] ${aviso.ok ? 'text-[#14804A]' : 'text-[#B42318]'}`}>{aviso.t}</p>}
          {editable && hayCambios && (
            <div className="flex gap-2">
              <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo del cambio (obligatorio)" className="flex-1 h-10 px-3 rounded-xl border border-[#E7E6E1] text-[13px]" />
              <button disabled={trabajando} onClick={guardar} className="h-10 px-4 rounded-xl bg-[#141414] text-white text-[13px] font-bold disabled:opacity-50">Guardar cambios</button>
            </div>
          )}
          {v && editable && (
            <div className="flex gap-2 flex-wrap">
              {['confirmada', 'lista_effi', 'error_effi', 'escalada'].includes(v.estado) && (
                <button disabled={trabajando} onClick={subirEffi} className="h-10 px-4 rounded-xl bg-[#A5791F] text-white text-[13px] font-bold disabled:opacity-50">⬆ Subir a Effi</button>
              )}
              {['incompleta', 'ambigua', 'esperando_confirmacion', 'recibida', 'escalada'].includes(v.estado) && (
                <button disabled={trabajando} onClick={() => accion('confirmar')} className="h-10 px-3 rounded-xl border border-[#E7E6E1] text-[13px] font-semibold">✓ Marcar confirmada</button>
              )}
              {v.estado !== 'escalada' && <button disabled={trabajando} onClick={() => accion('escalar', true)} className="h-10 px-3 rounded-xl border border-[#E8D4A3] text-[#A04300] text-[13px] font-semibold">↗ Escalar</button>}
              <button disabled={trabajando} onClick={() => { if (window.confirm('¿Cancelar esta preventa?')) accion('cancelar'); }} className="h-10 px-3 rounded-xl border border-[#F3C6C0] text-[#B42318] text-[13px] font-semibold">✕ Cancelar</button>
            </div>
          )}
          {v && v.estado === 'cancelada' && !v.effi_remision && (
            <button disabled={trabajando} onClick={() => accion('reabrir')} className="h-10 px-3 rounded-xl border border-[#E7E6E1] text-[13px] font-semibold">↩ Reabrir</button>
          )}
          <button onClick={onCerrar} className="w-full h-11 rounded-xl border border-[#E7E6E1] text-[14px] font-bold hover:bg-[#F1F1EF]">Cerrar</button>
        </footer>
      </aside>

      {verFoto && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" onClick={e => { e.stopPropagation(); setVerFoto(null); }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={verFoto} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
}

/** Vista previa de la remisión de Effi tal como quedaría (no se envía). */
function VistaRemision({ p, lista }: { p: any; lista: boolean }) {
  const vi = p.vista ?? {};
  const [verJson, setVerJson] = useState(false);
  const fila = (t: string, x: ReactNode) => (
    <div className="flex gap-2 text-[12.5px] py-1 border-b border-[#EFE6CF] last:border-0">
      <span className="w-[108px] shrink-0 text-[#8B6B1F]">{t}</span><span className="flex-1 font-medium text-[#3A2E10] break-words">{x}</span>
    </div>
  );
  return (
    <div className="mt-4 rounded-2xl border border-[#E8D9B0] bg-[#FBF6E8] p-3">
      <p className="text-[13px] font-extrabold text-[#7A5A12]">🧾 Remisión de venta en Effi — vista previa</p>
      <p className="text-[11.5px] text-[#8B6B1F] mb-2">{lista ? 'Así quedaría. No se ha enviado nada a Effi.' : 'Faltan datos: corrígelos y vuelve a oprimir «Subir a Effi».'}</p>
      {(p.errores ?? []).length > 0 && (
        <div className="mb-2 rounded-xl bg-[#FBE3E3] text-[#B42318] text-[12.5px] px-3 py-2">{p.errores.map((e: string, i: number) => <div key={i}>✖ {e}</div>)}</div>
      )}
      {(p.avisos ?? []).length > 0 && (
        <div className="mb-2 rounded-xl bg-[#FDEBD0] text-[#B25E00] text-[12.5px] px-3 py-2">{p.avisos.map((e: string, i: number) => <div key={i}>⚠️ {e}</div>)}</div>
      )}
      {fila('Cliente', vi.cliente)}
      {fila('Dirección', vi.direccion)}
      {fila('Ciudad (Effi)', vi.ciudad_ids)}
      {fila('Vendedor', vi.vendedor)}
      {fila('Ubicación venta', vi.ubicacion)}
      {fila('Centro costos', vi.centro_costos)}
      {(vi.prendas ?? []).map((x: any, i: number) => fila(`Concepto ${i + 1}`, (
        <span>Art. <b>{x.articulo}</b> · {x.descripcion} · cant {x.cantidad}<br />
          Observación <b>{x.observacion}</b> <span className="text-[#8B6B1F]">({x.estampado})</span><br />
          ${Math.round(x.precio_con_iva).toLocaleString('es-CO')} con IVA → {Number(x.precio_sin_iva).toLocaleString('es-CO')} sin IVA + IVA 19%</span>
      )))}
      {fila('Pagos', (vi.pagos ?? []).join(' + ') || '—')}
      {fila('Total', vi.total)}
      <button onClick={() => setVerJson(s => !s)} className="mt-2 text-[11.5px] font-bold text-[#7A5A12] underline">{verJson ? 'Ocultar' : 'Ver'} datos técnicos</button>
      {verJson && <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-white border border-[#EFE6CF] p-2 text-[10.5px] leading-snug">{JSON.stringify({ remision_v: p.solicitud, crear_cliente: p.crear_cliente }, null, 2)}</pre>}
    </div>
  );
}

/** Tarjeta de códigos para Effi (igual a la de Klixmsoft): talla/color, ID de variante, SKU y referencia, con copiar. */
function CodigosEffi({ it }: { it: ItemVV }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = async (txt: string, clave: string) => {
    try { await navigator.clipboard.writeText(txt); setCopiado(clave); setTimeout(() => setCopiado(null), 1400); } catch { /* sin portapapeles */ }
  };
  const ref = String(it.referencia ?? '').replace(/\s+/g, '');
  const talla = String(it.talla ?? '');
  const tituloTalla = /^niñ/i.test(talla) ? talla : `Talla ${talla}`;
  const filas: [string, string, string][] = [
    ['ID variante', `#${it.id_variante}`, String(it.id_variante)],
    ['SKU', it.sku || '—', it.sku || ''],
    ['Código referencia', ref || '—', ref],
    ['Referencia', it.referencia || '—', it.referencia || ''],
    ['Producto · Catálogo', `${it.id_item ?? '—'} · ${it.id_catalogo ?? '—'}`, ''],
  ];
  return (
    <div className="mt-3 rounded-2xl overflow-hidden border border-[#E7E6E1]">
      <div className="bg-gradient-to-b from-[#1E293B] to-[#334155] text-white text-center py-2">
        <p className="text-[14px] font-extrabold leading-tight">{tituloTalla}</p>
        <p className="text-[10px] font-bold tracking-wide uppercase opacity-80">{it.color || '—'} · Códigos para Effi</p>
      </div>
      <div className="p-3 text-center">
        <p className="text-[11px] font-bold text-[#8B8B86]">ID</p>
        <p className="text-[30px] font-extrabold leading-none text-[#334155]">#{it.id_variante}</p>
        <p className="text-[11px] font-bold text-[#8B8B86] mt-2">SKU</p>
        <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] font-mono">{it.sku || '—'}</span>
        <div className="flex gap-2 justify-center flex-wrap mt-3">
          <button onClick={() => copiar(String(it.id_variante), 'id')} className="h-9 px-3 rounded-xl bg-[#141414] text-white text-[12.5px] font-bold">
            {copiado === 'id' ? '✓ Copiado' : `⧉ Copiar #${it.id_variante}`}
          </button>
          {it.sku && (
            <button onClick={() => copiar(it.sku!, 'sku')} className="h-9 px-3 rounded-xl bg-[#F59E0B] text-white text-[11.5px] font-bold">
              {copiado === 'sku' ? '✓ Copiado' : `⧉ ${it.sku}`}
            </button>
          )}
          {ref && (
            <button onClick={() => copiar(ref, 'ref')} className="h-9 px-3 rounded-xl border border-[#E7E6E1] text-[12px] font-bold">
              {copiado === 'ref' ? '✓ Copiado' : `⧉ Ref. ${ref}`}
            </button>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-left text-[11.5px]">
          {filas.map(([l, v]) => (<Fragment key={l}><dt className="text-[#8B8B86]">{l}</dt><dd className="font-mono text-[#141414] truncate">{v}</dd></Fragment>))}
        </dl>
      </div>
    </div>
  );
}

function Mini({ l, v }: { l: string; v: string | null | undefined }) {
  return (
    <div className="text-[11px] text-[#5E5E5A]">{l}
      <span className="mt-1 block h-10 px-2 rounded-xl bg-[#F1F1EF] text-[13px] text-[#141414] flex items-center">{v || '—'}</span>
    </div>
  );
}
function Dt({ t, v }: { t: string; v: ReactNode }) {
  return (<><dt className="text-[#8B8B86]">{t}</dt><dd className="text-[#141414] truncate">{v}</dd></>);
}

function textoEvento(e: any): string {
  const d = e.detalle ?? {};
  switch (e.tipo) {
    case 'creada': return 'Venta recibida por WhatsApp';
    case 'foto': return `Foto recibida${d.descripcion ? `: ${d.descripcion}` : ''}`;
    case 'confirmada': return 'El vendedor confirmó la venta';
    case 'cancelada': return 'El vendedor canceló la venta';
    case 'producto_elegido': return `El vendedor eligió la opción ${d.opcion}`;
    case 'edicion': return `Edición: ${Object.keys(d.cambios ?? {}).join(', ')}${d.motivo ? ` — ${d.motivo}` : ''}`;
    case 'validacion': return `Validación para Effi: ${(d.errores ?? []).join(' · ') || 'OK'}`;
    case 'effi_simulado': return 'Solicitud a Effi armada (simulación, no enviada)';
    case 'effi_error': return `Error Effi: ${d.error ?? ''}`;
    default:
      if (String(e.tipo).startsWith('accion_')) return `${String(e.tipo).replace('accion_', 'Acción: ')}${d.motivo ? ` — ${d.motivo}` : ''}`;
      return e.tipo;
  }
}

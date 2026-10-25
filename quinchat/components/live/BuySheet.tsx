'use client';

import { useMemo, useState } from 'react';
import type { LiveConfig, PedidoDemo, ProductoLive, Seleccion, Talla } from '@/lib/live/tipos';
import { DEPARTAMENTOS, celularValido, precioCOP } from '@/lib/live/formato';
import { track } from '@/lib/live/track';

/**
 * "Comprar aquí" — panel inferior (bottom sheet).
 * No pausa el video y deja ver la parte de arriba. MAQUETA: al enviar solo muestra la
 * confirmación y registra el pedido en consola. No guarda nada en la base de datos.
 */
interface Props {
  live: LiveConfig;
  producto: ProductoLive;
  seleccion: Seleccion;
  onSeleccion: (s: Seleccion) => void;
  onCerrar: () => void;
}

const VACIO = { nombre: '', celular: '', departamento: '', ciudad: '', direccion: '', barrio: '', notas: '' };
type Errores = Partial<Record<keyof typeof VACIO | 'talla' | 'color' | 'autoriza', string>>;

const campo = 'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[14px] text-black placeholder:text-neutral-400 focus:outline-none focus:border-[#00A89D] focus:ring-1 focus:ring-[#00A89D]';

export default function BuySheet({ live, producto, seleccion, onSeleccion, onCerrar }: Props) {
  const [modalidad, setModalidad] = useState<'unidad' | 'pack'>('unidad');
  const [cantidad, setCantidad] = useState(1);
  const [f, setF] = useState(VACIO);
  const [autoriza, setAutoriza] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [enviado, setEnviado] = useState<PedidoDemo | null>(null);

  const sel = seleccion.productoId === producto.id ? seleccion : { productoId: producto.id };
  const color = producto.colores.find(c => c.id === sel.colorId);
  const foto = (color ?? producto.colores[0])?.foto;

  const precioUnit = modalidad === 'pack' && producto.promo ? producto.promo.precioPack : producto.precio;
  const total = precioUnit * cantidad;
  const ahorro = useMemo(
    () => (producto.promo ? producto.precio * producto.promo.unidades - producto.promo.precioPack : 0),
    [producto],
  );

  const limpiar = (k: keyof Errores) => setErrores(prev => (prev[k] ? { ...prev, [k]: undefined } : prev));
  const cambiar = (patch: Partial<Seleccion>) => {
    onSeleccion({ ...sel, productoId: producto.id, ...patch });
    if (patch.talla) limpiar('talla');
    if (patch.colorId) limpiar('color');
  };
  const set = (k: keyof typeof VACIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setF(prev => ({ ...prev, [k]: e.target.value }));
    limpiar(k);
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Errores = {};
    if (!sel.talla) er.talla = 'Elige tu talla';
    if (!sel.colorId) er.color = 'Elige un color';
    if (f.nombre.trim().split(/\s+/).filter(Boolean).length < 2) er.nombre = 'Escribe nombre y apellido';
    if (!celularValido(f.celular)) er.celular = 'Celular de 10 dígitos que empiece por 3';
    if (!f.departamento) er.departamento = 'Elige el departamento';
    if (f.ciudad.trim().length < 2) er.ciudad = 'Escribe la ciudad';
    if (f.direccion.trim().length < 5) er.direccion = 'Escribe la dirección completa';
    if (f.barrio.trim().length < 2) er.barrio = 'Escribe el barrio';
    if (!autoriza) er.autoriza = 'Debes autorizar el tratamiento de tus datos';
    setErrores(er);
    if (Object.keys(er).length) return;

    const pedido: PedidoDemo = {
      productoId: producto.id,
      talla: sel.talla as Talla,
      colorId: sel.colorId as string,
      modalidad, cantidad, total,
      cliente: { ...f, celular: f.celular.replace(/\s+/g, '') },
      autorizaDatos: true,
    };
    track('order_submit', { productoId: producto.id, total, modalidad, cantidad });
    console.log('[QUIN LIVE] Pedido (MAQUETA — no se guarda en ninguna base de datos):', pedido);
    setEnviado(pedido);
  };

  const Err = ({ k }: { k: keyof Errores }) => (errores[k] ? <p className="text-[11px] text-red-600 mt-0.5">{errores[k]}</p> : null);

  return (
    <div
      className="live-sheet pointer-events-auto absolute inset-x-0 bottom-0 z-30 max-h-[68%] flex flex-col rounded-t-3xl bg-white text-black shadow-[0_-10px_40px_rgba(0,0,0,.45)]"
      role="dialog" aria-label="Comprar"
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <span className="mx-auto absolute left-1/2 -translate-x-1/2 top-2 h-1 w-10 rounded-full bg-neutral-300" />
        <p className="text-[12px] font-semibold text-neutral-500 mt-2">El video sigue arriba ↑</p>
        <button onClick={onCerrar} aria-label="Cerrar" className="mt-1 w-8 h-8 rounded-full bg-neutral-100 text-lg leading-none">×</button>
      </div>

      {enviado ? (
        <div className="px-5 pb-8 pt-2 overflow-y-auto text-center">
          <div className="text-5xl mb-2">✅</div>
          <h2 className="text-xl font-extrabold">¡Pedido recibido!</h2>
          <p className="text-[14px] text-neutral-600 mt-1">Te contactaremos por WhatsApp para confirmarlo.</p>
          <div className="mt-4 rounded-xl bg-neutral-50 border border-neutral-200 p-3 text-left text-[13px] space-y-0.5">
            <p className="font-semibold">{producto.nombre}</p>
            <p>Talla {enviado.talla} · {producto.colores.find(c => c.id === enviado.colorId)?.nombre} · {enviado.modalidad === 'pack' ? `${enviado.cantidad} × Pack x2` : `${enviado.cantidad} und.`}</p>
            <p>Pago contraentrega: <b>{precioCOP(enviado.total)}</b></p>
          </div>
          <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2 mt-3">Maqueta: este pedido es de prueba y no se guardó.</p>
          <button onClick={onCerrar} className="mt-4 w-full h-11 rounded-xl bg-black text-white font-bold">Seguir viendo</button>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate className="overflow-y-auto px-4 pb-6 space-y-4">
          {/* Producto */}
          <div className="flex items-center gap-3">
            {foto && /* eslint-disable-next-line @next/next/no-img-element */ <img src={foto} alt="" width={64} height={64} className="w-16 h-16 rounded-xl object-cover bg-neutral-100" />}
            <div>
              <p className="font-bold leading-tight">{producto.nombre}</p>
              <p className="text-[12px] text-neutral-500">{producto.descripcion}</p>
            </div>
          </div>

          {/* Color con fotos */}
          <div>
            <p className="text-[12px] font-bold uppercase text-neutral-500 mb-1.5">Color {color && <span className="normal-case font-semibold text-black">· {color.nombre}</span>}</p>
            <div className="flex gap-2">
              {producto.colores.map(c => (
                <button type="button" key={c.id} onClick={() => cambiar({ colorId: c.id })} aria-pressed={sel.colorId === c.id}
                  className={`w-16 rounded-xl border-2 p-0.5 text-center ${sel.colorId === c.id ? 'border-[#00A89D]' : 'border-neutral-200'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.foto} alt={c.nombre} width={56} height={56} className="w-full aspect-square rounded-lg object-cover bg-neutral-100" />
                  <span className="block text-[10px] leading-tight mt-0.5 truncate">{c.nombre}</span>
                </button>
              ))}
            </div>
            <Err k="color" />
          </div>

          {/* Talla */}
          <div>
            <p className="text-[12px] font-bold uppercase text-neutral-500 mb-1.5">Talla</p>
            <div className="flex gap-2">
              {producto.tallas.map(t => (
                <button type="button" key={t} onClick={() => cambiar({ talla: t })} aria-pressed={sel.talla === t}
                  className={`h-10 min-w-12 px-3 rounded-lg border-2 font-bold text-sm ${sel.talla === t ? 'border-[#00A89D] bg-[#00A89D] text-white' : 'border-neutral-200'}`}>{t}</button>
              ))}
            </div>
            <Err k="talla" />
          </div>

          {/* Promo / pack */}
          {producto.promo && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setModalidad('unidad')} className={`rounded-xl border-2 p-2 text-left ${modalidad === 'unidad' ? 'border-[#00A89D] bg-[#00A89D]/5' : 'border-neutral-200'}`}>
                <span className="block text-[12px] font-bold">1 buzo</span>
                <span className="block text-[14px] font-extrabold">{precioCOP(producto.precio)}</span>
              </button>
              <button type="button" onClick={() => setModalidad('pack')} className={`relative rounded-xl border-2 p-2 text-left ${modalidad === 'pack' ? 'border-[#00A89D] bg-[#00A89D]/5' : 'border-neutral-200'}`}>
                <span className="absolute -top-2 right-2 text-[9px] font-bold bg-black text-amber-300 rounded-full px-2 py-0.5">Ahorras {precioCOP(ahorro)}</span>
                <span className="block text-[12px] font-bold">{producto.promo.etiqueta} · {producto.promo.unidades} buzos</span>
                <span className="block text-[14px] font-extrabold">{precioCOP(producto.promo.precioPack)}</span>
              </button>
            </div>
          )}

          {/* Cantidad + resumen */}
          <div className="flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 p-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setCantidad(c => Math.max(1, c - 1))} className="w-9 h-9 rounded-lg border border-neutral-300 text-lg" aria-label="Menos">−</button>
              <span className="w-6 text-center font-bold">{cantidad}</span>
              <button type="button" onClick={() => setCantidad(c => Math.min(5, c + 1))} className="w-9 h-9 rounded-lg border border-neutral-300 text-lg" aria-label="Más">+</button>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-neutral-500">Total · pagas al recibir</p>
              <p className="text-xl font-extrabold">{precioCOP(total)}</p>
            </div>
          </div>

          {/* Datos de entrega */}
          <div className="space-y-2.5">
            <p className="text-[12px] font-bold uppercase text-neutral-500">Datos de entrega · contraentrega</p>
            <div><input className={campo} placeholder="Nombre completo" autoComplete="name" value={f.nombre} onChange={set('nombre')} /><Err k="nombre" /></div>
            <div><input className={campo} placeholder="Celular (10 dígitos)" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={f.celular} onChange={e => { setF(p => ({ ...p, celular: e.target.value.replace(/\D/g, '') })); limpiar('celular'); }} /><Err k="celular" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <select className={campo} value={f.departamento} onChange={set('departamento')} aria-label="Departamento">
                  <option value="">Departamento</option>
                  {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                </select><Err k="departamento" />
              </div>
              <div><input className={campo} placeholder="Ciudad" autoComplete="address-level2" value={f.ciudad} onChange={set('ciudad')} /><Err k="ciudad" /></div>
            </div>
            <div><input className={campo} placeholder="Dirección" autoComplete="street-address" value={f.direccion} onChange={set('direccion')} /><Err k="direccion" /></div>
            <div><input className={campo} placeholder="Barrio" value={f.barrio} onChange={set('barrio')} /><Err k="barrio" /></div>
            <textarea className={campo} placeholder="Notas (opcional)" rows={2} value={f.notas} onChange={set('notas')} />
          </div>

          {/* Ley 1581 */}
          <div>
            <label className="flex items-start gap-2 text-[12px] leading-snug">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#00A89D]" checked={autoriza} onChange={e => { setAutoriza(e.target.checked); limpiar('autoriza'); }} />
              <span>Autorizo el tratamiento de mis datos personales para gestionar este pedido, conforme a la Ley 1581 de 2012. Lee la{' '}
                <a href={live.privacidadUrl} target="_blank" rel="noopener noreferrer" className="underline text-[#007A72] font-semibold">política de privacidad</a>.</span>
            </label>
            <Err k="autoriza" />
          </div>

          <button type="submit" className="w-full h-12 rounded-xl bg-[#00A89D] text-white font-extrabold text-[15px] active:scale-[.98] transition-transform">
            Confirmar pedido · {precioCOP(total)}
          </button>
        </form>
      )}
    </div>
  );
}

'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { acentoDe, imgOptim } from '@/lib/funnels';
import type { Funnel, VarianteFunnel } from '@/lib/funnels';
import { registrarPaso } from './FunnelTracker';

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

interface Props {
  funnel: Funnel;
  utms: Record<string, string>;
  // Cuando el checkout va DENTRO de la página de venta (una sola pantalla), la
  // barra flotante no debe salir hasta que el cliente llegue al formulario.
  embebido?: boolean;
}

/**
 * Checkout de CIERRE ALTO — limpio y por pasos:
 *   1) Modelo (con foto)   2) Género   3) Talla   4) Cantidad
 * El botón se enciende solo cuando el pedido está completo. Es un componente
 * aparte del clásico (FormularioPedido): no afecta a los embudos existentes.
 */
export default function CheckoutPro({ funnel, utms, embebido }: Props) {
  const router = useRouter();
  const acento = acentoDe(funnel.color);

  // Cada variante es un MODELO (Red Bull, McLaren…). Si no hay, un producto único.
  const modelos: VarianteFunnel[] = funnel.variantes.length > 0
    ? funnel.variantes
    : [{ id: 'unico', nombre: funnel.producto, precio: funnel.precio, precioAntes: funnel.precio_antes ?? undefined, imagen: funnel.imagenes[0] }];

  const generos = ['Hombre', 'Mujer'];
  const tallas = funnel.tallas.length > 0 ? funnel.tallas : ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  const [modeloId, setModeloId] = useState(modelos.length > 1 ? '' : modelos[0].id);
  const [genero, setGenero] = useState('');
  const [talla, setTalla] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [datos, setDatos] = useState({
    nombre: '', apellidos: '', whatsapp: '', correo: '',
    direccion: '', barrio: '', municipio: '', departamento: '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [señalando, setSeñalando] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const modelo = useMemo(
    () => modelos.find(m => m.id === modeloId) ?? modelos[0],
    [modeloId, modelos]
  );
  const precioUnit = modelo.precio || funnel.precio;
  const precioAntesUnit = modelo.precioAntes ?? funnel.precio_antes ?? undefined;
  const total = precioUnit * cantidad;

  const completo = !!modeloId && !!genero && !!talla;
  const seleccion = [modelo.nombre, genero, talla ? `Talla ${talla}` : '', cantidad > 1 ? `x${cantidad}` : '']
    .filter(Boolean).join(' · ');

  // ── Barra flotante (aparece cuando el botón real se sale de pantalla) ────────
  const botonRef = useRef<HTMLButtonElement>(null);
  const [botonFlotante, setBotonFlotante] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [enCheckout, setEnCheckout] = useState(!embebido);
  const datosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = botonRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setBotonFlotante(!e.isIntersecting), { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!embebido) { setEnCheckout(true); return; }
    const revisar = () => {
      const el = contenedorRef.current;
      if (!el) return;
      if (el.getBoundingClientRect().top <= window.innerHeight * 0.55) {
        setEnCheckout(true);
        window.removeEventListener('scroll', revisar);
      }
    };
    window.addEventListener('scroll', revisar, { passive: true });
    revisar();
    return () => window.removeEventListener('scroll', revisar);
  }, [embebido]);

  function señalar(campo: string) {
    setSeñalando(campo);
    document.querySelector(`[data-campo="${campo}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => setSeñalando(a => (a === campo ? null : a)), 3000);
  }

  const set = (campo: string, valor: string) => {
    setDatos(d => ({ ...d, [campo]: valor }));
    if (errores[campo]) setErrores(e => ({ ...e, [campo]: '' }));
  };

  // ── Rastreo del embudo (estadísticas + carrito abandonado) ──────────────────
  const carritoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (completo) registrarPaso(funnel.slug, 'talla');
  }, [completo, funnel.slug]);

  useEffect(() => {
    const tel = datos.whatsapp.replace(/\D/g, '').replace(/^57/, '');
    if (!datos.nombre.trim() || !/^3\d{9}$/.test(tel)) return;
    registrarPaso(funnel.slug, 'datos');
    if (carritoTimer.current) clearTimeout(carritoTimer.current);
    carritoTimer.current = setTimeout(() => {
      fetch('/api/funnels/carrito', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({
          slug: funnel.slug, telefono: tel,
          nombre: `${datos.nombre} ${datos.apellidos}`.trim(),
          producto: cantidad > 1 ? `${modelo.nombre} x${cantidad}` : modelo.nombre,
          talla: seleccion, valor: total,
        }),
      }).catch(() => {});
    }, 1500);
  }, [datos.nombre, datos.apellidos, datos.whatsapp, seleccion, total, modelo, cantidad, funnel.slug]);

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!modeloId) e.modelo = 'Elige un modelo';
    if (!genero) e.genero = 'Elige el género';
    if (!talla) e.talla = 'Elige la talla';
    if (!datos.nombre.trim()) e.nombre = 'Escribe tu nombre';
    if (!datos.apellidos.trim()) e.apellidos = 'Escribe tus apellidos';
    const tel = datos.whatsapp.replace(/\D/g, '').replace(/^57/, '');
    if (!/^3\d{9}$/.test(tel)) e.whatsapp = 'Debe ser un celular de 10 dígitos que empiece por 3';
    if (!datos.direccion.trim()) e.direccion = 'Escribe tu dirección';
    if (!datos.barrio.trim()) e.barrio = 'Escribe tu barrio';
    if (!datos.municipio.trim()) e.municipio = 'Escribe tu municipio';
    if (!datos.departamento.trim()) e.departamento = 'Escribe tu departamento';

    setErrores(e);
    if (Object.keys(e).length > 0) {
      const orden = ['modelo', 'genero', 'talla', ...CAMPOS.map(c => c.id as string)];
      señalar(orden.find(k => e[k]) ?? Object.keys(e)[0]);
      return false;
    }
    return true;
  }

  async function enviar() {
    registrarPaso(funnel.slug, 'boton');
    if (enviando || !validar()) return;
    setEnviando(true);

    const referencia = `web-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nombreProducto = cantidad > 1 ? `${modelo.nombre} x${cantidad}` : modelo.nombre;
    const foto = modelo.imagen ?? funnel.imagenes[0] ?? null;
    const imagenes = cantidad > 1 && foto ? Array(cantidad).fill(foto) : undefined;

    try {
      sessionStorage.setItem('quin_ultimo_pedido', JSON.stringify({
        producto: nombreProducto, seleccion, valor: total, foto, imagenes, nombre: datos.nombre, referencia,
      }));
    } catch { /* ignorar */ }

    const w = window as any;
    try {
      w.fbq?.('track', 'Purchase', { value: total, currency: 'COP', content_name: nombreProducto }, { eventID: referencia });
      w.ttq?.track('CompletePayment', { value: total, currency: 'COP', content_name: nombreProducto }, { event_id: referencia });
    } catch { /* ignorar */ }

    const cookie = (n: string) =>
      (typeof document !== 'undefined'
        ? document.cookie.split('; ').find(c => c.startsWith(`${n}=`))?.split('=')[1]
        : '') ?? '';

    const cuerpo = JSON.stringify({
      referencia, slug: funnel.slug, variante: nombreProducto, precio: total,
      talla: seleccion, imagen: foto, imagenes,
      fbp: cookie('_fbp'), fbc: cookie('_fbc'),
      ...datos, utms,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
    });

    const envio = fetch('/api/pedidos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, keepalive: true,
    });
    const espera = new Promise<'lento'>(r => setTimeout(() => r('lento'), 2500));

    try {
      const resultado = await Promise.race([envio, espera]);
      if (resultado !== 'lento') {
        const res = resultado as Response;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.error ?? 'No pudimos registrar tu pedido. Intenta de nuevo.');
          setEnviando(false);
          return;
        }
      }
      router.push(`/${funnel.slug}/gracias?ref=${encodeURIComponent(referencia)}`);
    } catch {
      alert('No pudimos registrar tu pedido. Revisa tu conexión e intenta de nuevo.');
      setEnviando(false);
    }
  }

  const CAMPOS: { id: keyof typeof datos; label: string; tipo?: string; placeholder?: string }[] = [
    { id: 'nombre', label: 'Nombre' },
    { id: 'apellidos', label: 'Apellidos' },
    { id: 'whatsapp', label: 'WhatsApp', tipo: 'tel', placeholder: '3001234567' },
    { id: 'correo', label: 'Correo electrónico', tipo: 'email' },
    { id: 'direccion', label: 'Dirección', placeholder: 'Calle 15 # 20-30' },
    { id: 'barrio', label: 'Barrio' },
    { id: 'municipio', label: 'Municipio' },
    { id: 'departamento', label: 'Departamento' },
  ];

  const faltantes: string[] = [];
  if (!completo) {
    if (!modeloId) faltantes.push('modelo');
    if (!genero) faltantes.push('género');
    if (!talla) faltantes.push('talla');
  } else {
    for (const c of CAMPOS) if (c.id !== 'correo' && !String(datos[c.id]).trim()) faltantes.push(c.label.toLowerCase());
  }

  const paso = 'text-[11px] font-bold tracking-widest text-[#9A9A9A]';
  const tituloPaso = 'text-[15px] font-bold mb-2.5';

  return (
    <div ref={contenedorRef} className="bg-white">
      {/* Confianza */}
      <div className="grid grid-cols-3 gap-2 px-3 pt-4">
        {[
          ['🛡️', 'Pagas al recibir'],
          ['🔁', 'Cambios gratis'],
          ['🚚', 'Envío gratis'],
        ].map(([ic, tx], i) => (
          <div key={i} className="bg-[#F7F7F5] rounded-xl py-2.5 text-center">
            <div className="text-lg leading-none">{ic}</div>
            <div className="text-[11px] text-[#555] mt-1 leading-tight">{tx}</div>
          </div>
        ))}
      </div>

      <div className="px-3 pt-5">
        <h2 className="text-center text-lg font-extrabold">Arma tu pedido</h2>
        <p className="text-center text-[12px] text-[#8A8A8A] mb-3">Sin pagar nada ahora · Confirmas por WhatsApp</p>
      </div>

      {/* PASO 1 · Modelo */}
      {modelos.length > 1 && (
        <div className="px-3 pb-1" data-campo="modelo">
          <p className={paso}>PASO 1</p>
          <p className={tituloPaso}>Elige tu modelo {modeloId && <span style={{ color: acento.texto }}>✓</span>}</p>
          <div className="grid grid-cols-2 gap-2">
            {modelos.map(m => {
              const activo = m.id === modeloId;
              return (
                <button
                  key={m.id}
                  onClick={() => { setModeloId(m.id); setErrores(e => ({ ...e, modelo: '' })); setSeñalando(null); }}
                  className={`rounded-xl border-2 p-1.5 text-center transition-colors ${señalando === 'modelo' && !modeloId ? 'animate-pulse' : ''}`}
                  style={{ borderColor: activo ? acento.boton : '#E5E5E5', background: activo ? '#F3FBF6' : '#fff' }}
                >
                  {m.imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgOptim(m.imagen, 240)} alt={m.nombre} className="w-full aspect-square object-cover rounded-lg" loading="lazy" />
                  ) : (
                    <div className="w-full aspect-square rounded-lg bg-[#F2F2F2] flex items-center justify-center text-2xl">👕</div>
                  )}
                  <div className="text-[12.5px] font-bold mt-1.5 leading-tight">{m.nombre}</div>
                </button>
              );
            })}
          </div>
          {errores.modelo && <p className="text-[12px] font-bold text-[#C1121F] mt-1.5 text-center">👆 {errores.modelo}</p>}
        </div>
      )}

      {/* PASO 2 · Género */}
      <div className="px-3 pt-4" data-campo="genero">
        <p className={paso}>PASO {modelos.length > 1 ? '2' : '1'}</p>
        <p className={tituloPaso}>Género {genero && <span style={{ color: acento.texto }}>✓</span>}</p>
        <div className="flex gap-2">
          {generos.map(g => {
            const activo = g === genero;
            return (
              <button
                key={g}
                onClick={() => { setGenero(g); setErrores(e => ({ ...e, genero: '' })); setSeñalando(null); }}
                className={`flex-1 rounded-xl border-2 py-3 font-bold text-[14px] transition-colors ${señalando === 'genero' && !genero ? 'animate-pulse' : ''}`}
                style={{ borderColor: activo ? acento.boton : '#E5E5E5', background: activo ? '#F3FBF6' : '#fff' }}
              >{g}</button>
            );
          })}
        </div>
        {errores.genero && <p className="text-[12px] font-bold text-[#C1121F] mt-1.5 text-center">👆 {errores.genero}</p>}
      </div>

      {/* PASO 3 · Talla */}
      <div className="px-3 pt-4" data-campo="talla">
        <p className={paso}>PASO {modelos.length > 1 ? '3' : '2'}</p>
        <p className={tituloPaso}>Talla {talla && <span style={{ color: acento.texto }}>✓</span>}</p>
        <div className="flex flex-wrap gap-2">
          {tallas.map(t => {
            const activo = t === talla;
            return (
              <button
                key={t}
                onClick={() => { setTalla(t); setErrores(e => ({ ...e, talla: '' })); setSeñalando(null); }}
                className={`min-w-[52px] rounded-lg border-2 py-2.5 px-3 font-bold text-[14px] transition-colors ${señalando === 'talla' && !talla ? 'animate-pulse' : ''}`}
                style={{ borderColor: activo ? acento.boton : '#E5E5E5', background: activo ? '#F3FBF6' : '#fff' }}
              >{t}</button>
            );
          })}
        </div>
        {errores.talla && <p className="text-[12px] font-bold text-[#C1121F] mt-1.5 text-center">👆 {errores.talla}</p>}
      </div>

      {/* PASO 4 · Cantidad */}
      <div className="px-3 pt-4">
        <p className={paso}>PASO {modelos.length > 1 ? '4' : '3'}</p>
        <p className={tituloPaso}>¿Cuántas quieres?</p>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2].map(n => {
            const activo = n === cantidad;
            return (
              <button
                key={n}
                onClick={() => setCantidad(n)}
                className="rounded-xl border-2 py-3 px-2 text-center transition-colors"
                style={{ borderColor: activo ? acento.boton : '#E5E5E5', background: activo ? '#F3FBF6' : '#fff' }}
              >
                <div className="font-bold text-[14px]">{n === 1 ? '1 unidad' : '2 unidades'}</div>
                <div className="text-[12px] text-[#0A8A3E] font-semibold">{n === 1 ? 'Envío gratis' : 'Las 2 con envío gratis'}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumen en vivo */}
      <div className="px-3 pt-4">
        <div className="rounded-xl bg-[#F7F7F5] px-4 py-3">
          {completo ? (
            <div className="flex items-center gap-3">
              {modelo.imagen && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgOptim(modelo.imagen, 160)} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" loading="lazy" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold leading-tight">{modelo.nombre}</div>
                <div className="text-[12px] text-[#666]">{genero} · Talla {talla}{cantidad > 1 ? ` · ${cantidad} unidades` : ''}</div>
              </div>
              <div className="text-right shrink-0">
                {precioAntesUnit && cantidad === 1 && (
                  <div className="text-[12px] text-[#C1121F] line-through">{pesos(precioAntesUnit)}</div>
                )}
                <div className="font-extrabold text-[16px]" style={{ color: acento.texto }}>{pesos(total)}</div>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#666] text-center">
              Falta elegir: <span className="text-[#C1121F] font-semibold">{faltantes.join(', ')}</span>
            </p>
          )}
        </div>
      </div>

      {/* Datos de envío */}
      <div ref={datosRef} className="scroll-mt-2" />
      <h2 className="font-extrabold text-lg px-3 pt-6 pb-1">Datos para el envío</h2>
      <p className="px-3 text-[12px] italic text-[#8A8A8A] mb-4">Solo se usan para gestionar tu pedido.</p>

      <div className="px-3 space-y-3.5">
        {CAMPOS.map(c => (
          <div key={c.id} data-campo={c.id}>
            <label className="block font-bold text-[14px] mb-1.5">
              {c.label} {c.id !== 'correo' && <span className="text-[#C1121F]">*</span>}
            </label>
            <input
              type={c.tipo ?? 'text'}
              inputMode={c.id === 'whatsapp' ? 'numeric' : undefined}
              autoComplete={
                c.id === 'nombre' ? 'given-name' :
                c.id === 'apellidos' ? 'family-name' :
                c.id === 'whatsapp' ? 'tel' :
                c.id === 'correo' ? 'email' :
                c.id === 'direccion' ? 'street-address' : 'off'
              }
              value={datos[c.id]}
              onChange={e => set(c.id, e.target.value)}
              placeholder={c.placeholder}
              className={`w-full px-4 py-3 rounded-lg border text-[16px] outline-none transition-colors ${
                errores[c.id] ? 'border-[#C1121F] bg-[#FEF2F2]' : 'border-[#D8D8D8] focus:border-[#0A8A3E]'
              } ${señalando === c.id ? 'sacudir' : ''}`}
            />
            {errores[c.id] && <p className="text-[12px] font-semibold text-[#C1121F] mt-1">⚠️ {errores[c.id]}</p>}
          </div>
        ))}
      </div>

      {/* Botón principal */}
      <button
        ref={botonRef}
        onClick={enviar}
        disabled={enviando}
        style={{ background: acento.boton }}
        className="relative block w-[calc(100%-1.5rem)] mx-3 mt-6 mb-3 rounded-full hover:opacity-90 disabled:opacity-60 text-white text-center font-extrabold text-xl py-4 transition-opacity"
      >
        {enviando ? 'ENVIANDO…' : `COMPRAR CONTRA ENTREGA · ${pesos(total)}`}
      </button>
      <p className="text-center text-[12px] text-[#8A8A8A] pb-6 px-6">
        🔒 No pagas nada ahora. Te escribimos por WhatsApp para confirmar tu pedido.
      </p>

      {/* Barra flotante que acompaña al cliente */}
      {botonFlotante && enCheckout && <div className="h-24" />}
      {botonFlotante && enCheckout && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-2 bg-gradient-to-t from-white via-white to-transparent">
          <div className="max-w-lg mx-auto">
            {faltantes.length > 0 && (
              <p className="text-center text-[11px] font-semibold text-[#C1121F] mb-1.5">Te falta: {faltantes.slice(0, 3).join(', ')}</p>
            )}
            <button
              onClick={enviar}
              disabled={enviando}
              style={{ background: acento.boton }}
              className="w-full rounded-full hover:opacity-90 disabled:opacity-60 text-white text-center font-extrabold text-lg py-3.5 shadow-lg transition-opacity"
            >
              {enviando ? 'ENVIANDO…' : `COMPLETAR PEDIDO · ${pesos(total)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

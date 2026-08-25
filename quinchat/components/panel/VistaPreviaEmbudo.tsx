'use client';

import { useState, useEffect } from 'react';
import { esVideo } from '@/lib/funnels';
import type { LayoutEmbudo } from '@/lib/bloques';

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

interface Opcion { valor: string; imagen?: string }
interface Selector { etiqueta: string; grupo?: string; opciones: (string | Opcion)[] }
interface Variante {
  id: string; nombre: string; precio: number; precioAntes?: number;
  imagen?: string; tallas?: string[]; selectores?: Selector[];
}

/** Lo que necesita la vista previa del embudo (inicio + checkout). */
interface Draft {
  producto: string;
  titulo: string;
  frases: string[];
  precio: number;
  precio_antes: number | null;
  imagenes: string[];
  imagen_clientes: string | null;
  imagen_banner: string | null;
  imagen_detalle: string | null;
  video_url?: string | null;
  color?: string | null;
  miniatura_url?: string | null;
  caracteristicas: string[];
  tallas: string[];
  variantes: Variante[];
  horas_contador: number;
  personas_comprando: number;
}

const opValor = (o: string | Opcion) => (typeof o === 'string' ? o : o.valor);
const opImg   = (o: string | Opcion) => (typeof o === 'string' ? undefined : o.imagen);

/**
 * Marco de celular que muestra cómo se verá la página con los datos que se
 * están editando. Dos pestañas: la página de Inicio y la de Checkout.
 */
export default function VistaPreviaEmbudo({ d, layout }: { d: Draft; layout?: LayoutEmbudo | null }) {
  const [modo, setModo] = useState<'inicio' | 'checkout'>('inicio');
  // Si el diseño trae el bloque Checkout, es UNA sola pantalla: inicio + formulario.
  const unaPantalla = !!layout?.bloques?.some(b => b.tipo === 'checkout' && b.visible !== false);
  const frases = (d.frases?.length ? d.frases : [d.titulo]).filter(Boolean);
  const [fraseIdx, setFraseIdx] = useState(0);
  const [imgIdx, setImgIdx]     = useState(0);

  useEffect(() => {
    if (frases.length < 2) return;
    const t = setInterval(() => setFraseIdx(i => (i + 1) % frases.length), 3000);
    return () => clearInterval(t);
  }, [frases.length]);

  useEffect(() => { if (imgIdx >= d.imagenes.length) setImgIdx(0); }, [d.imagenes.length, imgIdx]);

  const principal = d.imagenes[imgIdx] ?? d.imagenes[0] ?? null;
  const acentoBoton = (d.color ?? '').trim() || '#3DC12A';
  const acentoTexto = (d.color ?? '').trim() || '#0D8A3E';
  const tab = (activo: boolean) =>
    `flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
      activo ? 'bg-[#00A89D] text-white' : 'text-[#6B6B6B] hover:bg-[#EEE]'
    }`;

  return (
    <div className="mx-auto w-full max-w-[340px]">
      {/* Selector de pantalla (solo si son dos páginas separadas) */}
      {unaPantalla ? (
        <div className="mb-2 p-1.5 bg-[#00A89D]/10 rounded-xl text-center text-[11px] font-semibold text-[#00847A]">
          🧾 Una sola pantalla · el cliente baja hasta el formulario
        </div>
      ) : (
        <div className="flex gap-1 mb-2 p-1 bg-[#F0F0F0] rounded-xl">
          <button onClick={() => setModo('inicio')}   className={tab(modo === 'inicio')}>🏠 Inicio</button>
          <button onClick={() => setModo('checkout')} className={tab(modo === 'checkout')}>🛒 Checkout</button>
        </div>
      )}

      {/* Marco de celular */}
      <div className="rounded-[2rem] border-[6px] border-[#111] bg-[#111] shadow-2xl overflow-hidden">
        <div className="h-5 bg-[#111] flex items-center justify-center">
          <span className="w-16 h-1.5 rounded-full bg-[#333]" />
        </div>

        <div className="relative bg-white max-h-[68vh] overflow-y-auto text-[#0D0D0D]">
          {(modo === 'inicio' || unaPantalla) && d.miniatura_url && (
            <div className="absolute top-16 right-2 z-20 w-20 rounded-lg overflow-hidden border-2 border-white shadow-xl bg-black">
              {esVideo(d.miniatura_url)
                // eslint-disable-next-line jsx-a11y/media-has-caption
                ? <video src={d.miniatura_url} muted loop playsInline autoPlay className="w-full h-20 object-cover" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={d.miniatura_url} alt="" className="w-full h-20 object-cover" />}
            </div>
          )}
          {(modo === 'inicio' || unaPantalla) && (
            /* ─────────────── PÁGINA DE INICIO ─────────────── */
            <>
              {d.imagen_clientes && (esVideo(d.imagen_clientes)
                // eslint-disable-next-line jsx-a11y/media-has-caption
                ? <video src={d.imagen_clientes} muted loop playsInline autoPlay className="w-full bg-black" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={d.imagen_clientes} alt="" className="w-full" />
              )}

              <div className="bg-[#FFF3CD] text-center text-[13px] font-extrabold py-2 px-2 leading-snug min-h-[36px] flex items-center justify-center">
                {frases[fraseIdx] ?? '🔥 COMPRA YA 🔥'}
              </div>

              {d.video_url ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={d.video_url} controls muted playsInline className="w-full aspect-square object-cover bg-black" />
              ) : principal ? (
                <div>
                  <div className="relative">
                    {esVideo(principal)
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      ? <video src={principal} muted loop playsInline autoPlay className="w-full h-auto bg-black" />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={principal} alt="" className="w-full h-auto" />}
                    {d.imagenes.length > 1 && (
                      <>
                        <button onClick={() => setImgIdx(i => (i - 1 + d.imagenes.length) % d.imagenes.length)}
                          className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 text-sm shadow">‹</button>
                        <button onClick={() => setImgIdx(i => (i + 1) % d.imagenes.length)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 text-sm shadow">›</button>
                      </>
                    )}
                  </div>
                  {d.imagenes.length > 1 && (
                    <div className="flex gap-1 px-2 py-1.5 overflow-x-auto">
                      {d.imagenes.map((im, i) => (
                        <button key={i} onClick={() => setImgIdx(i)} className="shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={im} alt="" className={`w-12 h-12 object-cover rounded border-2 ${i === imgIdx ? 'border-[#3DC12A]' : 'border-transparent'}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-square bg-[#F5F5F5] flex items-center justify-center text-4xl text-[#CFCFCF]">🛍️</div>
              )}

              <div style={{ background: acentoBoton }} className="boton-compra relative overflow-hidden mx-3 my-3 rounded-full text-white text-center font-extrabold text-base leading-tight py-3">
                COMPRAR<br /><span className="text-sm">CONTRA ENTREGA →</span>
              </div>

              <div className="text-center py-1">
                {d.precio_antes ? (
                  <p className="text-[#C1121F] text-sm font-bold italic line-through">Antes {pesos(d.precio_antes)}</p>
                ) : null}
                <p className="text-[20px] font-extrabold leading-tight">
                  HOY 🔥 <span style={{ color: acentoTexto }}>{pesos(d.precio)}</span> 🔥
                </p>
              </div>

              <div className="flex items-center justify-center gap-4 py-2 text-center">
                {[['09', 'HORAS'], ['59', 'MIN'], ['50', 'SEG']].map(([n, l]) => (
                  <div key={l}>
                    <div className="text-lg font-extrabold text-[#C1121F]">{n}</div>
                    <div className="text-[8px] text-[#6B6B6B]">{l}</div>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#E8E8E8] mx-3" />
              <p className="text-center font-extrabold text-lg text-[#C1121F] py-3">⚠️ ÚLTIMAS UNIDADES</p>

              {d.imagen_detalle && (esVideo(d.imagen_detalle)
                // eslint-disable-next-line jsx-a11y/media-has-caption
                ? <video src={d.imagen_detalle} muted loop playsInline autoPlay className="w-full bg-black" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={d.imagen_detalle} alt="" className="w-full" />
              )}

              {d.caracteristicas.filter(Boolean).length > 0 && (
                <div className="px-4 py-3">
                  <h3 style={{ color: acentoTexto }} className="font-extrabold text-sm mb-1.5">CARACTERÍSTICAS DEL PRODUCTO:</h3>
                  <ul className="space-y-1">
                    {d.caracteristicas.filter(Boolean).map((c, i) => (
                      <li key={i} className="text-[13px] font-semibold">✅ {c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-center text-lg py-1">⭐⭐⭐⭐⭐</p>

              <div style={{ background: acentoBoton }} className="boton-compra relative overflow-hidden mx-3 my-3 rounded-full text-white text-center font-extrabold text-base leading-tight py-3">
                COMPRAR<br /><span className="text-sm">CONTRA ENTREGA →</span>
              </div>

              <div className="relative">
                <p className="text-center text-[10px] text-[#9A9A9A] py-4">Klixmant SAS · Pago contra entrega</p>
                <div className="absolute bottom-2 left-2 bg-white border border-[#E8E8E8] rounded-full px-2.5 py-1 shadow text-[9px] font-semibold">
                  🔥 {d.personas_comprando || 27} comprando
                </div>
              </div>
            </>
          )}

          {/* En una sola pantalla, el formulario va justo debajo del inicio */}
          {unaPantalla && (
            <div className="text-center text-[10px] font-extrabold text-[#00847A] bg-[#00A89D]/10 py-1.5">
              👇 EL BOTÓN "COMPRAR" BAJA HASTA AQUÍ 👇
            </div>
          )}
          {(modo === 'checkout' || unaPantalla) && (
            /* ─────────────── CHECKOUT ─────────────── */
            <CheckoutPreview d={d} />
          )}
        </div>
      </div>

      <p className="text-center text-[10px] text-[#9A9A9A] mt-2">
        Vista previa · así se verá en el celular
      </p>
    </div>
  );
}

/** Réplica visual (no funcional) de la página de pedido/checkout. */
function CheckoutPreview({ d }: { d: Draft }) {
  const variantes = d.variantes ?? [];
  // Producto de ejemplo a mostrar: la primera variante, o el producto base
  const v0 = variantes[0];
  const foto = v0?.imagen ?? d.imagenes[0] ?? d.imagen_banner ?? null;
  const precio = v0?.precio ?? d.precio;
  const acentoBoton = (d.color ?? '').trim() || '#3DC12A';
  const acentoTexto = (d.color ?? '').trim() || '#0D8A3E';

  const campo = 'w-full px-2.5 py-2 rounded-lg border border-[#E0E0E0] text-[11px] bg-[#FAFAFA] text-[#9A9A9A]';
  const label = 'block text-[10px] font-bold text-[#0D0D0D] mb-0.5 uppercase';

  const selectoresMostrar: Selector[] = v0?.selectores?.length
    ? v0.selectores
    : [{ etiqueta: 'TALLA', opciones: (v0?.tallas ?? d.tallas ?? []) }];

  return (
    <div>
      {d.imagen_banner && (esVideo(d.imagen_banner)
        // eslint-disable-next-line jsx-a11y/media-has-caption
        ? <video src={d.imagen_banner} muted loop playsInline autoPlay className="w-full bg-black" />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={d.imagen_banner} alt="" className="w-full" />
      )}

      <div className="px-3 py-3 space-y-3">
        <h3 className="text-sm font-extrabold text-center">Completa tus datos 👇</h3>

        {/* Producto elegido */}
        <div className="flex items-center gap-2 p-2 rounded-xl border border-[#E8E8E8]">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#F5F5F5] flex items-center justify-center shrink-0">🛍️</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold truncate">{v0?.nombre || d.producto || 'Producto'}</p>
            <p className="text-[12px] font-extrabold" style={{ color: acentoTexto }}>{pesos(precio)}</p>
          </div>
        </div>

        {/* Selectores de talla / color */}
        {selectoresMostrar.map((s, i) => (
          <div key={i}>
            <label className={label}>{s.etiqueta || 'ELIGE'}</label>
            <div className="flex flex-wrap gap-1">
              {(s.opciones ?? []).slice(0, 6).map((o, j) => (
                <span key={j} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[#E0E0E0] text-[10px] bg-white">
                  {opImg(o) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={opImg(o)} alt="" className="w-5 h-5 rounded object-cover" />
                  )}
                  {opValor(o)}
                </span>
              ))}
              {(s.opciones ?? []).length === 0 && (
                <span className="text-[10px] text-[#9A9A9A]">Sin opciones aún</span>
              )}
            </div>
          </div>
        ))}

        {/* Campos del formulario */}
        <div><label className={label}>Nombre</label><div className={campo}>Ej: María</div></div>
        <div><label className={label}>Apellidos</label><div className={campo}>Ej: Gómez</div></div>
        <div><label className={label}>WhatsApp</label><div className={campo}>3001234567</div></div>
        <div><label className={label}>Correo</label><div className={campo}>correo@ejemplo.com</div></div>
        <div><label className={label}>Dirección</label><div className={campo}>Calle 1 # 2-3</div></div>
        <div className="flex gap-2">
          <div className="flex-1"><label className={label}>Ciudad</label><div className={campo}>Ciudad</div></div>
          <div className="flex-1"><label className={label}>Depto</label><div className={campo}>Depto</div></div>
        </div>

        {/* Resumen + botón */}
        <div className="rounded-xl bg-[#F6FBF7] border border-[#CDE9D5] p-2.5">
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-[#6B6B6B]">Producto</span>
            <span className="font-semibold">{pesos(precio)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[#6B6B6B]">Envío</span>
            <span className="font-semibold" style={{ color: acentoTexto }}>GRATIS</span>
          </div>
          <div className="flex justify-between border-t border-[#CDE9D5] mt-1 pt-1">
            <span className="text-[12px] font-extrabold">TOTAL A PAGAR</span>
            <span className="text-[13px] font-extrabold" style={{ color: acentoTexto }}>{pesos(precio)}</span>
          </div>
        </div>

        <div style={{ background: acentoBoton }} className="boton-compra relative overflow-hidden rounded-full text-white text-center font-extrabold text-sm py-3">
          ✅ COMPLETAR MI PEDIDO
        </div>
        <p className="text-center text-[9px] text-[#9A9A9A]">Pagas cuando recibes 🚚 · Envío a toda Colombia</p>
      </div>
    </div>
  );
}

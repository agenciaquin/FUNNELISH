'use client';

import { Fragment, useState, useEffect, useRef } from 'react';
import { esVideo } from '@/lib/funnels';
import Testimonios from '@/components/publico/Testimonios';
import Gatillos from '@/components/publico/Gatillos';
import Stock from '@/components/publico/Stock';
import { bloquesARenderizar, CATALOGO_BLOQUES, nuevoIdBloque, estiloBloque, botonVariante, type LayoutEmbudo, type Bloque } from '@/lib/bloques';

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
 * Marco de celular que además ORGANIZA: cada bloque de la página se puede
 * arrastrar (o mover con ▲▼) dentro del teléfono para reordenar cómo se ve.
 * A la derecha editas el contenido; aquí decides el orden.
 */
export default function VistaPreviaEmbudo({
  d, layout, onLayout, selectedId, onSelect, onImagenes, onSubirArchivo, onModoChange,
}: {
  d: Draft;
  layout?: LayoutEmbudo | null;
  onLayout?: (l: LayoutEmbudo) => void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onImagenes?: (lista: string[]) => void;
  onSubirArchivo?: (file: File) => Promise<string | null>;
  onModoChange?: (m: 'inicio' | 'checkout') => void;
}) {
  const [modo, setModoState] = useState<'inicio' | 'checkout'>('inicio');
  const setModo = (m: 'inicio' | 'checkout') => { setModoState(m); onModoChange?.(m); };
  const [dragI, setDragI] = useState<number | null>(null);
  const [paletaOpen, setPaletaOpen] = useState(false);
  const [paletaIdx, setPaletaIdx] = useState<number | null>(null);
  const [subiendoFotos, setSubiendoFotos] = useState(false);
  const refFotos = useRef<HTMLInputElement>(null);
  const fotosTarget = useRef<string | null>(null); // id del bloque portada destino

  const bloques = bloquesARenderizar(layout);
  const unaPantalla = bloques.some(b => (b.tipo === 'checkout' || b.tipo === 'checkout_pro') && b.visible !== false);

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

  // ── Reordenar bloques ──────────────────────────────────────────────────────
  const aplicar = (nueva: Bloque[]) => onLayout?.({ bloques: nueva });
  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= bloques.length) return;
    const n = [...bloques];
    [n[i], n[j]] = [n[j], n[i]];
    aplicar(n);
  };
  const soltar = (i: number) => {
    if (dragI == null || dragI === i) { setDragI(null); return; }
    const n = [...bloques];
    const [it] = n.splice(dragI, 1);
    n.splice(i, 0, it);
    setDragI(null);
    aplicar(n);
  };
  const borrar = (i: number) => {
    const b = bloques[i];
    // Portada con galería (varias fotos, sin foto propia): el ✕ borra SOLO la
    // foto actual del carrusel; si queda una sola, ahí sí se borra el bloque.
    if (b?.tipo === 'portada' && !b.props?.url && b.props?.modo !== 'collage' && onImagenes) {
      const imgs = (d.imagenes || []).filter(Boolean);
      if (imgs.length > 1) {
        const actual = imgIdx % imgs.length;
        onImagenes(imgs.filter((_, k) => k !== actual));
        setImgIdx(0);
        return;
      }
    }
    aplicar(bloques.filter((_, k) => k !== i));
  };
  const duplicar = (i: number) => {
    const copia: Bloque = { ...bloques[i], id: nuevoIdBloque() };
    aplicar([...bloques.slice(0, i + 1), copia, ...bloques.slice(i + 1)]);
  };
  const setPropBloque = (id: string, patch: Record<string, any>) =>
    aplicar(bloques.map(b => (b.id === id ? { ...b, props: { ...(b.props || {}), ...patch } } : b)));

  // "Agregar más fotos" desde el teléfono (carrusel de portada): sube varias,
  // las agrega a la galería y las marca en el carrusel de ESE bloque.
  const pedirFotos = (blockId: string) => { fotosTarget.current = blockId; refFotos.current?.click(); };
  const subirFotosDesdeTelefono = async (files: FileList) => {
    if (!onSubirArchivo || !fotosTarget.current) return;
    setSubiendoFotos(true);
    try {
      const nuevas: string[] = [];
      for (const file of Array.from(files)) { const url = await onSubirArchivo(file); if (url) nuevas.push(url); }
      if (nuevas.length) {
        const galeria = d.imagenes || [];
        onImagenes?.([...galeria, ...nuevas]);
        const b = bloques.find(x => x.id === fotosTarget.current);
        const sel: string[] = Array.isArray(b?.props?.fotos) && b!.props!.fotos.length ? b!.props!.fotos : [...galeria];
        setPropBloque(fotosTarget.current, { fotos: [...sel, ...nuevas] });
      }
    } finally { setSubiendoFotos(false); fotosTarget.current = null; }
  };
  // Arrastrar la esquina del botón para cambiar su tamaño (escala).
  const resizeRef = useRef<{ y: number; esc: number; id: string } | null>(null);
  const onResizeDown = (e: React.PointerEvent, id: string, escActual: number) => {
    e.stopPropagation(); e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    resizeRef.current = { y: e.clientY, esc: escActual, id };
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r || e.buttons !== 1) return;
    let esc = r.esc + (e.clientY - r.y) / 130; // arrastrar hacia abajo = más grande
    esc = Math.max(0.7, Math.min(1.6, esc));
    setPropBloque(r.id, { escala: esc === 1 ? undefined : Math.round(esc * 20) / 20 });
  };
  const toggleVis = (i: number) =>
    aplicar(bloques.map((b, k) => (k === i ? { ...b, visible: b.visible === false } : b)));
  const agregar = (tipo: string) => {
    aplicar([...bloques, { id: nuevoIdBloque(), tipo, visible: true }]);
    setPaletaOpen(false);
  };
  // Insertar un bloque JUSTO DESPUÉS del bloque #idx (con el + de cada bloque).
  const agregarEn = (idx: number, tipo: string) => {
    const nuevo: Bloque = { id: nuevoIdBloque(), tipo, visible: true };
    aplicar([...bloques.slice(0, idx + 1), nuevo, ...bloques.slice(idx + 1)]);
    setPaletaIdx(null);
  };
  // Bloques que se pueden agregar: los repetibles siempre; los únicos solo si no están ya.
  const disponibles = CATALOGO_BLOQUES.filter(
    dfb => dfb.repetible || !bloques.some(b => b.tipo === dfb.clave),
  );


  return (
    <div className="mx-auto w-full max-w-[360px]">
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

      {(modo === 'inicio' || unaPantalla) && onLayout && (
        <p className="text-[10px] text-center text-[#00847A] bg-[#00A89D]/10 rounded-lg py-1 mb-2 font-semibold">
          ✋ Arrastra los bloques (o usa ▲▼) para ordenar la página
        </p>
      )}

      {/* Marco de celular */}
      <div className="rounded-[2rem] border-[6px] border-[#111] bg-[#111] shadow-2xl overflow-hidden">
        <div className="h-5 bg-[#111] flex items-center justify-center">
          <span className="w-16 h-1.5 rounded-full bg-[#333]" />
        </div>

        <div className="relative bg-white overflow-y-auto text-[#0D0D0D]" style={{ height: 'min(80vh, 720px)' }}>
          {(modo === 'inicio' || unaPantalla) && (
            <>
              {bloques.map((b, idx) => {
                const oculto = b.visible === false;
                if (oculto && !onLayout) return null;
                const contenido = renderPreviewBloque(b, d, {
                  frases, fraseIdx, principal, imgIdx, setImgIdx, acentoBoton, acentoTexto,
                  pedirFotos: onSubirArchivo ? pedirFotos : undefined, blockId: b.id, subiendoFotos,
                });
                if (contenido == null && !onLayout) return null;
                const def = ETIQUETA[b.tipo] ?? b.tipo;
                return (
                  <Fragment key={b.id}>
                  <div
                    draggable={!!onLayout}
                    onDragStart={() => setDragI(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => soltar(idx)}
                    onClick={() => onSelect?.(b.id)}
                    style={{
                      marginTop: Number(b.props?.mt) || undefined,
                      marginBottom: Number(b.props?.mb) || undefined,
                      width: Number(b.props?.w) && Number(b.props?.w) < 100 ? `${Number(b.props?.w)}%` : undefined,
                      marginLeft: Number(b.props?.w) && Number(b.props?.w) < 100 ? 'auto' : undefined,
                      marginRight: Number(b.props?.w) && Number(b.props?.w) < 100 ? 'auto' : undefined,
                    }}
                    className={`relative group border-b border-dashed cursor-pointer ${selectedId === b.id ? 'border-[#00A89D] ring-2 ring-inset ring-[#00A89D]' : 'border-transparent hover:border-[#00A89D]/40'} ${dragI === idx ? 'opacity-40' : ''} ${oculto ? 'opacity-30' : ''}`}
                  >
                    {onLayout && (
                      <div className="absolute right-1 top-1 z-20 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="px-1 rounded bg-black/60 text-white text-[9px] font-bold">{def}{oculto ? ' (oculto)' : ''}</span>
                        <button onClick={() => mover(idx, -1)} title="Subir"
                          className="w-5 h-5 rounded bg-white/90 border border-[#E8E8E8] text-[10px] shadow">▲</button>
                        <button onClick={() => mover(idx, 1)} title="Bajar"
                          className="w-5 h-5 rounded bg-white/90 border border-[#E8E8E8] text-[10px] shadow">▼</button>
                        <button onClick={() => duplicar(idx)} title="Duplicar"
                          className="w-5 h-5 rounded bg-white/90 border border-[#E8E8E8] text-[10px] shadow">⧉</button>
                        <button onClick={() => toggleVis(idx)} title={oculto ? 'Mostrar' : 'Ocultar'}
                          className="w-5 h-5 rounded bg-white/90 border border-[#E8E8E8] text-[10px] shadow">{oculto ? '🙈' : '👁'}</button>
                        <button onClick={() => borrar(idx)} title="Quitar bloque"
                          className="w-5 h-5 rounded bg-white/90 border border-[#DC2626]/40 text-[#DC2626] text-[10px] shadow">✕</button>
                        <span className="w-5 h-5 rounded bg-white/90 border border-[#E8E8E8] text-[10px] shadow flex items-center justify-center cursor-grab" title="Arrastrar">⠿</span>
                      </div>
                    )}
                    {contenido ?? <div className="py-3 text-center text-[10px] text-[#C9C9C9] italic">({def} — sin contenido; edítalo a la derecha)</div>}

                    {/* Asa para redimensionar el botón arrastrando */}
                    {onLayout && selectedId === b.id && b.tipo === 'boton' && (
                      <span
                        onPointerDown={(e) => onResizeDown(e, b.id, Number(b.props?.escala) || 1)}
                        onPointerMove={onResizeMove}
                        onDragStart={(e) => e.preventDefault()}
                        draggable={false}
                        title="Arrastra para agrandar/achicar el botón"
                        className="absolute right-4 bottom-1 z-30 w-5 h-5 rounded-full bg-[#00A89D] text-white text-[10px] flex items-center justify-center shadow cursor-ns-resize select-none"
                      >⇕</span>
                    )}
                  </div>

                  {/* + Insertar bloque justo aquí — SOLO en el bloque seleccionado */}
                  {onLayout && selectedId === b.id && (
                    <div className="relative">
                      <div className="flex items-center justify-center py-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setPaletaIdx(v => (v === idx ? null : idx))}
                          title="Agregar bloque aquí"
                          className={`w-6 h-6 rounded-full text-sm font-bold shadow flex items-center justify-center transition-all ${paletaIdx === idx ? 'bg-[#DC2626] text-white opacity-100' : 'bg-[#00A89D] text-white opacity-30 hover:opacity-100'}`}
                        >{paletaIdx === idx ? '✕' : '＋'}</button>
                      </div>
                      {paletaIdx === idx && (
                        <div className="px-2 pb-2" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-2 gap-1">
                            {disponibles.map(dfb => (
                              <button
                                key={dfb.clave}
                                onClick={() => agregarEn(idx, dfb.clave)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[#E8E8E8] text-[10px] hover:bg-[#00A89D]/10 text-left"
                                title={dfb.desc}
                              >
                                <span>{dfb.emoji}</span>
                                <span className="truncate">{dfb.nombre}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  </Fragment>
                );
              })}

              {/* Agregar un bloque nuevo desde el teléfono */}
              {onLayout && (
                <div className="p-2 border-t border-dashed border-[#DADADA]">
                  <button
                    onClick={() => setPaletaOpen(o => !o)}
                    className="w-full py-2 rounded-lg border-2 border-dashed border-[#00A89D]/50 text-[#00847A] text-xs font-bold hover:bg-[#00A89D]/10"
                  >{paletaOpen ? '✕ Cerrar' : '＋ Agregar bloque'}</button>
                  {paletaOpen && (
                    <div className="grid grid-cols-2 gap-1 mt-2">
                      {disponibles.map(dfb => (
                        <button
                          key={dfb.clave}
                          onClick={() => agregar(dfb.clave)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[#E8E8E8] text-[10px] hover:bg-[#00A89D]/10 text-left"
                          title={dfb.desc}
                        >
                          <span>{dfb.emoji}</span>
                          <span className="truncate">{dfb.nombre}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="relative">
                <p className="text-center text-[10px] text-[#9A9A9A] py-4">Klixmant SAS · Pago contra entrega</p>
                <div className="absolute bottom-2 left-2 bg-white border border-[#E8E8E8] rounded-full px-2.5 py-1 shadow text-[9px] font-semibold">
                  🔥 {d.personas_comprando || 27} comprando
                </div>
              </div>
            </>
          )}

          {unaPantalla && (
            <div className="text-center text-[10px] font-extrabold text-[#00847A] bg-[#00A89D]/10 py-1.5">
              👇 EL BOTÓN "COMPRAR" BAJA HASTA AQUÍ 👇
            </div>
          )}
          {(modo === 'checkout' || unaPantalla) && <CheckoutPreview d={d} />}
        </div>
      </div>

      <p className="text-center text-[10px] text-[#9A9A9A] mt-2">
        Vista previa · así se verá en el celular
      </p>

      {/* Input oculto para "agregar más fotos" desde el teléfono (carrusel) */}
      <input ref={refFotos} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) subirFotosDesdeTelefono(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

const ETIQUETA: Record<string, string> = {
  banner: 'Banner', titular: 'Titular', portada: 'Portada', boton: 'Botón',
  precio: 'Precio', contador: 'Contador', ultimas_unidades: 'Últimas', caracteristicas: 'Caract.',
  estrellas: 'Estrellas', checkout: 'Checkout', checkout_pro: 'Checkout', texto: 'Texto',
  imagen: 'Imagen', espacio: 'Espacio',
};

/** Dibuja un bloque en la vista previa (versión chiquita, no funcional). */
function renderPreviewBloque(
  b: Bloque,
  d: Draft,
  ctx: {
    frases: string[]; fraseIdx: number; principal: string | null; imgIdx: number;
    setImgIdx: (fn: (i: number) => number) => void; acentoBoton: string; acentoTexto: string;
    pedirFotos?: (blockId: string) => void; blockId?: string; subiendoFotos?: boolean;
  },
) {
  const p = b.props ?? {};
  const { frases, fraseIdx, principal, imgIdx, setImgIdx, acentoBoton, acentoTexto, pedirFotos, subiendoFotos } = ctx;
  const { style: est, anim } = estiloBloque(p);
  const hStyle = Number(p.h) ? { height: Number(p.h), objectFit: 'cover' as const } : undefined;

  switch (b.tipo) {
    case 'banner':
      if (p.modo === 'collage') {
        const fotos = (d.imagenes || []).filter(Boolean).slice(0, 4);
        if (fotos.length) return (
          <div className="grid grid-cols-2 gap-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {fotos.map((im, i) => <img key={i} src={im} alt="" className="w-full h-24 object-cover" />)}
          </div>
        );
      }
      {
        const src = (p.url as string) || d.imagen_clientes;
        return src ? (esVideo(src)
          // eslint-disable-next-line jsx-a11y/media-has-caption
          ? <video src={src} muted loop playsInline autoPlay className="w-full bg-black" style={hStyle} />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={src} alt="" className="w-full" style={hStyle} />) : null;
      }

    case 'titular':
      return (
        <div className={`bg-[#FFF3CD] text-center text-[13px] font-extrabold py-2 px-2 leading-snug min-h-[36px] flex items-center justify-center ${anim}`} style={est}>
          {frases[fraseIdx] ?? '🔥 COMPRA YA 🔥'}
        </div>
      );

    case 'portada':
      if (p.modo === 'carrusel') {
        const galeriaC = (d.imagenes || []).filter(Boolean);
        const selC = (Array.isArray(p.fotos) ? p.fotos : []).filter((u: string) => galeriaC.includes(u));
        const elegidas = (selC.length ? selC : galeriaC).filter(Boolean);
        const idx = elegidas.length ? imgIdx % elegidas.length : 0;
        return (
          <div>
            {elegidas.length > 0 && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={elegidas[idx]} alt="" className="w-full h-auto" />
                <span className="absolute top-1 left-1 text-[8px] bg-black/70 text-white px-1.5 py-0.5 rounded-full">🎞️ Carrusel · {elegidas.length} fotos · 2s</span>
                <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
                  {elegidas.map((_, k) => <span key={k} className={`h-1 rounded-full ${k === idx ? 'w-4 bg-white' : 'w-1 bg-white/60'}`} />)}
                </div>
              </div>
            )}
            {/* Tira de miniaturas + casilla "agregar más fotos" (solo en el editor) */}
            <div className="flex gap-1 p-1 bg-white overflow-x-auto" onClick={e => e.stopPropagation()}>
              {elegidas.map((src, k) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={k} src={src} alt="" className={`shrink-0 w-[23%] aspect-square object-cover border-2 ${k === idx ? 'border-[#0D8A3E]' : 'border-transparent'}`} />
              ))}
              {pedirFotos && (
                <button onClick={() => pedirFotos(b.id)}
                  className="shrink-0 w-[23%] aspect-square border-2 border-dashed border-[#00A89D]/60 rounded flex flex-col items-center justify-center text-[8px] font-bold text-[#00847A] hover:bg-[#00A89D]/10">
                  {subiendoFotos ? '…' : <>➕<br/>agregar<br/>más fotos</>}
                </button>
              )}
            </div>
          </div>
        );
      }
      if (p.modo === 'collage') {
        const fotos = (d.imagenes || []).filter(Boolean).slice(0, 4);
        if (fotos.length) return (
          <div className="grid grid-cols-2 gap-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {fotos.map((im, i) => <img key={i} src={im} alt="" className="w-full h-28 object-cover" />)}
          </div>
        );
      }
      if (p.url) {
        return esVideo(String(p.url))
          // eslint-disable-next-line jsx-a11y/media-has-caption
          ? <video src={String(p.url)} muted loop playsInline autoPlay className="w-full bg-black" style={hStyle} />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={String(p.url)} alt="" className="w-full" style={hStyle} />;
      }
      if (d.video_url) {
        return (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={d.video_url} controls muted playsInline className="w-full aspect-square object-cover bg-black" />
        );
      }
      if (!principal) {
        return <div className="w-full aspect-square bg-[#F5F5F5] flex items-center justify-center text-4xl text-[#CFCFCF]">🛍️</div>;
      }
      return (
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
                <button key={i} onClick={() => setImgIdx(() => i)} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im} alt="" className={`w-12 h-12 object-cover rounded border-2 ${i === imgIdx ? 'border-[#3DC12A]' : 'border-transparent'}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      );

    case 'boton': {
      const label = String(p.label ?? '').trim();
      const v = botonVariante(p.variante, p.bg || acentoBoton);
      const escala = Number(p.escala) || 1;
      const baseF = p.compacto ? 14 : 16;
      const baseP = p.compacto ? 10 : 12;
      const escStyle = {
        paddingTop: Math.round(baseP * escala), paddingBottom: Math.round(baseP * escala),
        fontSize: (est.fontSize as any) ?? Math.round(baseF * escala),
      };
      return (
        <div className="relative">
          {p.flotante && <span className="absolute top-0 right-3 z-10 text-[8px] bg-black/70 text-white px-1 rounded-b">📌 flotante</span>}
          <div style={{ ...v.estilo, ...escStyle, ...est }} className={`boton-compra relative overflow-hidden mx-3 my-2 text-white text-center font-extrabold ${v.clase} ${anim}`}>
            {label ? label : (p.compacto ? 'COMPRAR CONTRA ENTREGA →' : <>COMPRAR<br /><span className="text-sm">CONTRA ENTREGA →</span></>)}
          </div>
        </div>
      );
    }

    case 'precio':
      return (
        <div className={`text-center py-1 ${anim}`}>
          {d.precio_antes ? (
            <p className="text-sm font-bold italic line-through" style={{ color: p.colorAntes || '#C1121F' }}>{p.labelAntes ?? 'Antes'} {pesos(d.precio_antes)}</p>
          ) : null}
          <p className="text-[20px] font-extrabold leading-tight" style={est}>
            {p.labelHoy ?? 'HOY'} 🔥 <span style={{ color: p.colorHoy || (est.color as string) || acentoTexto }}>{pesos(d.precio)}</span> 🔥
          </p>
        </div>
      );

    case 'contador':
      return (
        <div className="flex items-center justify-center gap-4 py-2 text-center">
          {[['09', 'HORAS'], ['59', 'MIN'], ['50', 'SEG']].map(([n, l]) => (
            <div key={l}>
              <div className="text-lg font-extrabold text-[#C1121F]">{n}</div>
              <div className="text-[8px] text-[#6B6B6B]">{l}</div>
            </div>
          ))}
        </div>
      );

    case 'ultimas_unidades': {
      const fotosU = (d.imagenes || []).filter(Boolean).slice(0, 4);
      const srcDet = (p.url as string) || d.imagen_detalle;
      return (
        <>
          <div className="border-t border-[#E8E8E8] mx-3" />
          <p className="text-center font-extrabold text-lg text-[#C1121F] py-3">⚠️ ÚLTIMAS UNIDADES</p>
          {!p.soloTexto && (p.modo === 'collage'
            ? (fotosU.length ? (
                <div className="grid grid-cols-2 gap-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {fotosU.map((im, i) => <img key={i} src={im} alt="" className="w-full h-24 object-cover" />)}
                </div>
              ) : null)
            : srcDet && (esVideo(srcDet)
              // eslint-disable-next-line jsx-a11y/media-has-caption
              ? <video src={srcDet} muted loop playsInline autoPlay className="w-full bg-black" style={hStyle} />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={srcDet} alt="" className="w-full" style={hStyle} />))}
        </>
      );
    }

    case 'caracteristicas':
      return d.caracteristicas.filter(Boolean).length > 0 ? (
        <div className="px-4 py-3">
          <h3 style={{ color: acentoTexto }} className="font-extrabold text-sm mb-1.5">CARACTERÍSTICAS DEL PRODUCTO:</h3>
          <ul className="space-y-1">
            {d.caracteristicas.filter(Boolean).map((c, i) => (
              <li key={i} className="text-[13px] font-semibold">✅ {c}</li>
            ))}
          </ul>
        </div>
      ) : null;

    case 'estrellas':
      return <p className={`text-center text-lg py-1 ${anim}`} style={est}>⭐⭐⭐⭐⭐</p>;

    case 'testimonios':
      return <div className={anim}><Testimonios props={p} acento={acentoTexto} /></div>;

    case 'gatillos':
      return <div className={anim}><Gatillos props={p} precio={d.precio} precioAntes={d.precio_antes} acento={acentoTexto} /></div>;

    case 'stock':
      return (
        <div className={`relative ${anim}`}>
          {p.flotante && <span className="absolute top-0 right-3 z-10 text-[8px] bg-black/70 text-white px-1 rounded-b">📌 flotante</span>}
          <Stock props={p} />
        </div>
      );

    case 'texto': {
      const texto = String(p.texto ?? '').trim();
      if (!texto) return <p className="px-4 py-2 text-center text-[11px] text-[#C9C9C9] italic">(texto vacío)</p>;
      return <p className={`px-4 py-2 whitespace-pre-line text-[13px] ${anim}`} style={{ fontWeight: p.bold !== false ? 800 : 400, textAlign: 'center', ...est }}>{texto}</p>;
    }

    case 'imagen': {
      if (p.modo === 'collage') {
        const fotos = (d.imagenes || []).filter(Boolean).slice(0, 4);
        return fotos.length ? (
          <div className="grid grid-cols-2 gap-0.5">
            {fotos.map((im, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={im} alt="" className="w-full h-24 object-cover" />
            ))}
          </div>
        ) : <div className="mx-3 my-2 py-4 text-center text-[11px] text-[#C9C9C9] border border-dashed border-[#DADADA] rounded">(collage: sube fotos a la galería)</div>;
      }
      return p.url ? (esVideo(String(p.url))
        // eslint-disable-next-line jsx-a11y/media-has-caption
        ? <video src={String(p.url)} muted loop playsInline autoPlay className="w-full bg-black" style={hStyle} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={String(p.url)} alt="" className="w-full" style={hStyle} />)
        : <div className="mx-3 my-2 py-4 text-center text-[11px] text-[#C9C9C9] border border-dashed border-[#DADADA] rounded">(imagen extra)</div>;
    }

    case 'espacio':
      return <div style={{ height: Number(p.alto) > 0 ? Number(p.alto) : 24 }} />;

    case 'mas_vendido': {
      const txt = String(p.texto ?? 'MÁS VENDIDO').toUpperCase();
      const emoji = String(p.emoji ?? '🔥');
      const modelo = String(p.modelo ?? '');
      return (
        <div className="flex flex-col items-center gap-1 py-2">
          <span className="rounded-full font-extrabold shadow border-2 border-white px-3 py-1.5 text-[11px]"
            style={{ background: p.color || '#C1121F', color: p.colorTexto || '#fff' }}>{emoji} {txt}</span>
          <span className="text-[9px] text-[#9A9A9A]">📌 Flotante · {modelo ? `→ ${modelo}` : 'baja al checkout'}</span>
        </div>
      );
    }

    case 'ventas': {
      const items: string[] = Array.isArray(p.items) && p.items.length ? p.items : ['RED BULL NEGRO: Felipe P.'];
      return (
        <div className="flex flex-col items-center gap-1 py-2">
          <span className="rounded-xl shadow border-2 border-white px-3 py-1.5 text-left" style={{ background: p.color || '#0D0D0D' }}>
            <span className="block text-[8px] font-extrabold tracking-wide" style={{ color: p.colorTexto || '#FFD400' }}>{String(p.titulo ?? 'NUEVA VENTA REALIZADA').toUpperCase()}</span>
            <span className="block text-[10px] font-bold" style={{ color: p.colorTexto || '#FFD400' }}>{items[0]} {p.emoji ?? '🛒'}</span>
          </span>
          <span className="text-[9px] text-[#9A9A9A]">📌 Flotante · rota {items.length} mensaje(s)</span>
        </div>
      );
    }

    case 'checkout':
    case 'checkout_pro':
      return <div className="mx-3 my-2 py-3 text-center text-[11px] font-semibold text-[#00847A] bg-[#00A89D]/10 rounded-lg">🧾 Formulario de pedido (aquí)</div>;

    default:
      return null;
  }
}

/** Réplica visual (no funcional) de la página de pedido/checkout. */
function CheckoutPreview({ d }: { d: Draft }) {
  const variantes = d.variantes ?? [];
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

        <div><label className={label}>Nombre</label><div className={campo}>Ej: María</div></div>
        <div><label className={label}>WhatsApp</label><div className={campo}>3001234567</div></div>
        <div><label className={label}>Dirección</label><div className={campo}>Calle 1 # 2-3</div></div>

        <div className="rounded-xl bg-[#F6FBF7] border border-[#CDE9D5] p-2.5">
          <div className="flex justify-between border-t border-[#CDE9D5] pt-1">
            <span className="text-[12px] font-extrabold">TOTAL A PAGAR</span>
            <span className="text-[13px] font-extrabold" style={{ color: acentoTexto }}>{pesos(precio)}</span>
          </div>
        </div>

        <div style={{ background: acentoBoton }} className="boton-compra relative overflow-hidden rounded-full text-white text-center font-extrabold text-sm py-3">
          ✅ COMPLETAR MI PEDIDO
        </div>
      </div>
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { esVideo } from '@/lib/funnels';
import { defDeBloque, FUENTES, ANIMACIONES, PALETA_COLORES, VARIANTES_BOTON, TESTIMONIOS_DEFAULT, GATILLOS_DEFAULT, STOCK_DEFAULT, MAS_VENDIDO_DEFAULT, VENTAS_DEFAULT, type Bloque } from '@/lib/bloques';
import MiniBarraTexto from './MiniBarraTexto';

const EMOJIS = ['🔥', '✅', '⭐', '🚚', '💰', '🎁', '⚡', '👉', '❤️', '😍', '🏆', '⏰', '🛒', '💳', '📦', '🤩', '💥', '✨', '👑', '🥇'];

const TEXT_LIKE = ['titular', 'boton', 'texto', 'precio', 'estrellas', 'caracteristicas'];

/** Editor lateral "premium" del bloque seleccionado en el teléfono. */
export default function EditorBloqueLateral({
  bloque, onChange, onDuplicar, onBorrar, onCerrar, onGuardar,
  onSubirArchivo, setCampo, imagenes, frases, onFrases, precio, precioAntes, variantes,
}: {
  bloque: Bloque;
  onChange: (b: Bloque) => void;
  onDuplicar: () => void;
  onBorrar: () => void;
  onCerrar: () => void;
  onGuardar?: () => void;
  onSubirArchivo?: (file: File) => Promise<string | null>;
  setCampo?: (campo: any, valor: any) => void;
  imagenes?: string[];
  frases?: string[];
  onFrases?: (lista: string[]) => void;
  precio?: number;
  precioAntes?: number | null;
  variantes?: { id: string; nombre: string }[];
}) {
  const def = defDeBloque(bloque.tipo);
  const p = bloque.props ?? {};
  const setProp = (k: string, v: any) => onChange({ ...bloque, props: { ...p, [k]: v } });

  const refFile = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const abrirPicker = (acepta: string) => {
    if (refFile.current) { refFile.current.accept = acepta; refFile.current.click(); }
  };
  const alSubir = async (file: File) => {
    if (!onSubirArchivo) return;
    setSubiendo(true);
    try {
      const url = await onSubirArchivo(file);
      if (!url) return;
      // La foto/video se guarda POR BLOQUE (props.url). Así al duplicar cada
      // bloque es independiente y no quedan ligados por un campo compartido.
      setProp('url', url);
    } finally { setSubiendo(false); }
  };

  const esTexto  = bloque.tipo === 'texto';
  const esBoton  = bloque.tipo === 'boton';
  const esTitular = bloque.tipo === 'titular';
  const lista = (frases && frases.length ? frases : ['']);
  const setFrases = (l: string[]) => onFrases?.(l);

  // ── Bloque "Gatillos mentales" ─────────────────────────────────────────────
  const esStock = bloque.tipo === 'stock';
  const esMasVendido = bloque.tipo === 'mas_vendido';
  const esVentas = bloque.tipo === 'ventas';
  const vItems: string[] = Array.isArray(p.items) ? p.items : ['RED BULL NEGRO: Felipe P.', 'MCLAREN NARANJA: Juan G.'];
  const setVItem = (i: number, v: string) => setProp('items', vItems.map((x, k) => (k === i ? v : x)));
  const addVItem = () => setProp('items', [...vItems, 'NUEVO MODELO: Cliente X.']);
  const delVItem = (i: number) => setProp('items', vItems.filter((_, k) => k !== i));
  const esGatillos = bloque.tipo === 'gatillos';
  const gBadges: string[] = Array.isArray(p.badges) ? p.badges : GATILLOS_DEFAULT.badges;
  const setGBadge = (i: number, v: string) => setProp('badges', gBadges.map((b, k) => (k === i ? v : b)));
  const addGBadge = () => setProp('badges', [...gBadges, '✅ Nuevo sello']);
  const delGBadge = (i: number) => setProp('badges', gBadges.filter((_, k) => k !== i));

  // ── Bloque "Clientes felices" (testimonios) ────────────────────────────────
  const esTestimonios = bloque.tipo === 'testimonios';
  const tItems: any[] = Array.isArray(p.items) && p.items.length ? p.items : TESTIMONIOS_DEFAULT.items;
  const tBadges: string[] = Array.isArray(p.badges) ? p.badges : TESTIMONIOS_DEFAULT.badges;
  const setItem = (i: number, patch: any) => setProp('items', tItems.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const addItem = () => setProp('items', [...tItems, { nombre: 'Cliente', estrellas: 5, texto: '', foto: '' }]);
  const delItem = (i: number) => setProp('items', tItems.filter((_, k) => k !== i));
  const setBadge = (i: number, v: string) => setProp('badges', tBadges.map((b, k) => (k === i ? v : b)));
  const addBadge = () => setProp('badges', [...tBadges, '✅ Nuevo sello']);
  const delBadge = (i: number) => setProp('badges', tBadges.filter((_, k) => k !== i));
  const refItemFile = useRef<HTMLInputElement>(null);
  const idxItem = useRef<number>(-1);
  const subirFotoItem = async (file: File) => {
    if (!onSubirArchivo || idxItem.current < 0) return;
    setSubiendo(true);
    try { const url = await onSubirArchivo(file); if (url) setItem(idxItem.current, { foto: url }); }
    finally { setSubiendo(false); }
  };

  // Subir VARIAS fotos a la vez para el carrusel de la portada: se agregan a la
  // galería del embudo y quedan seleccionadas en el carrusel (props.fotos).
  const refCarrusel = useRef<HTMLInputElement>(null);
  const subirVariasCarrusel = async (files: FileList) => {
    if (!onSubirArchivo) return;
    setSubiendo(true);
    try {
      const nuevas: string[] = [];
      for (const file of Array.from(files)) {
        const url = await onSubirArchivo(file);
        if (url) nuevas.push(url);
      }
      if (nuevas.length) {
        const galeria = Array.isArray(imagenes) ? imagenes : [];
        setCampo?.('imagenes', [...galeria, ...nuevas]);
        const sel: string[] = Array.isArray(p.fotos) && p.fotos.length ? p.fotos : [...galeria];
        setProp('fotos', [...sel, ...nuevas]);
      }
    } finally { setSubiendo(false); }
  };
  const esPrecio = bloque.tipo === 'precio';
  const esMedia  = ['imagen', 'portada', 'banner', 'ultimas_unidades'].includes(bloque.tipo);
  const textLike = TEXT_LIKE.includes(bloque.tipo);

  // Campo de texto que se edita (contenido del bloque texto o etiqueta del botón)
  const campoTexto = esTexto ? 'texto' : esBoton ? 'label' : null;
  const valorTexto = campoTexto ? String(p[campoTexto] ?? '') : '';
  const insertarEmoji = (e: string) => { if (campoTexto) setProp(campoTexto, valorTexto + e); };

  const swatch = (valor: string, actual: string | undefined, onPick: (c: string) => void) => (
    <button
      key={valor}
      onClick={() => onPick(valor)}
      title={valor}
      className={`w-6 h-6 rounded-full border-2 ${actual === valor ? 'border-[#00A89D] scale-110' : 'border-white'} shadow`}
      style={{ background: valor }}
    />
  );

  return (
    <div className="bg-white rounded-2xl border border-[#00A89D]/40 shadow-sm p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={onCerrar} className="text-xs text-[#00A89D] font-semibold hover:underline">← Volver</button>
        <span className="text-sm font-bold text-[#0D0D0D]">{def?.emoji} {def?.nombre ?? bloque.tipo}</span>
      </div>

      {/* Guardar cambios (todo el embudo) */}
      {onGuardar && (
        <button onClick={onGuardar} className="w-full py-2.5 rounded-lg bg-[#00A89D] text-white text-sm font-bold hover:bg-[#00847A]">
          💾 Guardar cambios
        </button>
      )}

      {/* Acciones */}
      <div className="flex gap-2">
        <button onClick={onDuplicar} className="flex-1 py-2 rounded-lg border border-[#E8E8E8] text-xs font-semibold hover:bg-[#F5F5F5]">⧉ Duplicar</button>
        <button onClick={onBorrar} className="flex-1 py-2 rounded-lg border border-[#DC2626]/40 text-[#DC2626] text-xs font-semibold hover:bg-[#FEE2E2]">🗑 Borrar</button>
      </div>

      {/* Texto editable (bloque texto o etiqueta del botón) */}
      {campoTexto && (
        <div>
          <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">{esBoton ? 'Texto del botón' : 'Texto'}</label>
          <MiniBarraTexto p={p} setProp={setProp} fontKey="font" colorKey="color" sizeKey="size" textKey={campoTexto}
            sizeMin={12} sizeMax={44} colorDefault={esBoton ? '#FFFFFF' : '#0D0D0D'} />
          {esTexto ? (
            <textarea value={valorTexto} onChange={e => setProp('texto', e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" placeholder="Escribe aquí…" />
          ) : (
            <input value={valorTexto} onChange={e => setProp('label', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" placeholder="COMPRAR CONTRA ENTREGA →" />
          )}
        </div>
      )}

      {/* Precio: textos y colores de "HOY" y "ANTES" */}
      {esPrecio && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Precio de hoy</label>
              <input type="number" value={precio ?? ''} onChange={e => setCampo?.('precio', Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" placeholder="129900" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Precio tachado</label>
              <input type="number" value={precioAntes ?? ''} onChange={e => setCampo?.('precio_antes', e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" placeholder="195000" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Texto precio actual</label>
            <input value={String(p.labelHoy ?? 'HOY')} onChange={e => setProp('labelHoy', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm mb-1.5" placeholder="HOY" />
            <div className="flex flex-wrap gap-1.5 items-center">
              {PALETA_COLORES.map(c => swatch(c, p.colorHoy, (v) => setProp('colorHoy', v)))}
              <input type="color" value={p.colorHoy || '#0D8A3E'} onChange={e => setProp('colorHoy', e.target.value)}
                className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Texto precio tachado</label>
            <input value={String(p.labelAntes ?? 'Antes')} onChange={e => setProp('labelAntes', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm mb-1.5" placeholder="Antes" />
            <div className="flex flex-wrap gap-1.5 items-center">
              {PALETA_COLORES.map(c => swatch(c, p.colorAntes, (v) => setProp('colorAntes', v)))}
              <input type="color" value={p.colorAntes || '#C1121F'} onChange={e => setProp('colorAntes', e.target.value)}
                className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
            </div>
          </div>
        </div>
      )}

      {/* Titular: frases que rotan */}
      {esTitular && onFrases && (
        <div>
          <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Frases del titular</label>
          <p className="text-[10px] text-[#9A9A9A] mb-2">Rotan cada 5 segundos. Puedes poner hasta 5.</p>
          <div className="space-y-1.5">
            {lista.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#00A89D]/10 text-[#00847A] text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <input value={f} onChange={e => { const c = [...lista]; c[i] = e.target.value; setFrases(c); }}
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#E0E0E0] text-sm" placeholder="🔥 ÚLTIMAS UNIDADES 🔥" />
                {lista.length > 1 && (
                  <button onClick={() => setFrases(lista.filter((_, j) => j !== i))}
                    className="w-6 h-6 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] shrink-0 text-xs">✕</button>
                )}
              </div>
            ))}
          </div>
          {lista.length < 5 && (
            <button onClick={() => setFrases([...lista, ''])} className="mt-1.5 text-[11px] text-[#00A89D] font-semibold hover:underline">+ Agregar frase</button>
          )}
        </div>
      )}

      {/* Stock / escasez */}
      {esMasVendido && (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Texto del sello</label>
            <input value={String(p.texto ?? MAS_VENDIDO_DEFAULT.texto)} onChange={e => setProp('texto', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" placeholder="MÁS VENDIDO" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Producto estrella (se preselecciona en el checkout)</label>
            {variantes && variantes.length > 0 ? (
              <select value={String(p.modelo ?? '')} onChange={e => setProp('modelo', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm bg-white">
                <option value="">— Solo bajar al checkout —</option>
                {variantes.map(v => <option key={v.id} value={v.nombre}>{v.nombre}</option>)}
              </select>
            ) : (
              <input value={String(p.modelo ?? '')} onChange={e => setProp('modelo', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm"
                placeholder="Nombre exacto del modelo (o vacío)" />
            )}
            <p className="text-[10px] text-[#9A9A9A] mt-1">Al tocar el sello, el checkout se abre con este producto ya elegido y con la etiqueta 🔥 MÁS VENDIDO. Déjalo vacío si solo quieres que baje al formulario.</p>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Emoji</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setProp('emoji', e)}
                  className={`w-8 h-8 rounded-lg border text-lg ${p.emoji === e ? 'border-[#00A89D] bg-[#00A89D]/10' : 'border-[#E0E0E0]'}`}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Posición en pantalla</label>
            <div className="flex gap-2">
              {[['arriba', 'Arriba'], ['centro', 'Centro'], ['abajo', 'Abajo']].map(([val, txt]) => (
                <button key={val} onClick={() => setProp('posicion', val)}
                  className={`flex-1 rounded-lg border-2 py-2 text-xs font-semibold ${(p.posicion || 'arriba') === val ? 'border-[#00A89D] bg-[#00A89D]/10' : 'border-[#E0E0E0]'}`}>{txt}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Tamaño de letra: {Number(p.size) || MAS_VENDIDO_DEFAULT.size}px</label>
            <input type="range" min={10} max={22} value={Number(p.size) || MAS_VENDIDO_DEFAULT.size}
              onChange={e => setProp('size', Number(e.target.value))} className="w-full accent-[#00A89D]" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Color del sello</label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {PALETA_COLORES.map(c => swatch(c, p.color, (v) => setProp('color', v)))}
              <input type="color" value={p.color || MAS_VENDIDO_DEFAULT.color} onChange={e => setProp('color', e.target.value)}
                className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Color del texto</label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {PALETA_COLORES.map(c => swatch(c, p.colorTexto, (v) => setProp('colorTexto', v)))}
              <input type="color" value={p.colorTexto || MAS_VENDIDO_DEFAULT.colorTexto} onChange={e => setProp('colorTexto', e.target.value)}
                className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
            </div>
          </div>
        </div>
      )}

      {esVentas && (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Título fijo (arriba)</label>
            <input value={String(p.titulo ?? VENTAS_DEFAULT.titulo)} onChange={e => setProp('titulo', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" placeholder="NUEVA VENTA REALIZADA" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Mensajes que van saliendo (uno por línea)</label>
            <p className="text-[10px] text-[#9A9A9A] mb-1.5">Ej: “RED BULL NEGRO: Felipe P.”. Van rotando en orden.</p>
            <div className="space-y-1.5">
              {vItems.map((it, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input value={it} onChange={e => setVItem(i, e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-[#E0E0E0] text-[12px]" placeholder="MODELO: Nombre del cliente" />
                  <button onClick={() => delVItem(i)} className="w-6 h-6 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] text-xs shrink-0">✕</button>
                </div>
              ))}
            </div>
            <button onClick={addVItem} className="mt-1.5 text-[11px] text-[#00A89D] font-semibold hover:underline">+ Agregar mensaje</button>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Emoji</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setProp('emoji', e)}
                  className={`w-8 h-8 rounded-lg border text-lg ${(p.emoji ?? VENTAS_DEFAULT.emoji) === e ? 'border-[#00A89D] bg-[#00A89D]/10' : 'border-[#E0E0E0]'}`}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Ubicación en pantalla</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[['sup-izq', '↖ Arriba izq'], ['sup-der', '↗ Arriba der'], ['inf-izq', '↙ Abajo izq'], ['inf-der', '↘ Abajo der'], ['centro', '⬇ Abajo centro']].map(([val, txt]) => (
                <button key={val} onClick={() => setProp('posicion', val)}
                  className={`rounded-lg border-2 py-1.5 text-[11px] font-semibold ${(p.posicion || VENTAS_DEFAULT.posicion) === val ? 'border-[#00A89D] bg-[#00A89D]/10' : 'border-[#E0E0E0]'}`}>{txt}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Tamaño de letra: {Number(p.size) || VENTAS_DEFAULT.size}px</label>
            <input type="range" min={10} max={20} value={Number(p.size) || VENTAS_DEFAULT.size}
              onChange={e => setProp('size', Number(e.target.value))} className="w-full accent-[#00A89D]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Color de fondo</label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {PALETA_COLORES.map(c => swatch(c, p.color, (v) => setProp('color', v)))}
                <input type="color" value={p.color || VENTAS_DEFAULT.color} onChange={e => setProp('color', e.target.value)}
                  className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Color del texto</label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {PALETA_COLORES.map(c => swatch(c, p.colorTexto, (v) => setProp('colorTexto', v)))}
                <input type="color" value={p.colorTexto || VENTAS_DEFAULT.colorTexto} onChange={e => setProp('colorTexto', e.target.value)}
                  className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-[#E8E8E8] p-2.5 bg-[#FAFAFA] space-y-2">
            <p className="text-[11px] font-bold text-[#0D0D0D] uppercase">⏱ Tiempos</p>
            <div>
              <label className="block text-[10px] font-bold text-[#0D0D0D] mb-1 uppercase">Sale por primera vez a los: {Number(p.delayInicial) || VENTAS_DEFAULT.delayInicial} seg</label>
              <input type="range" min={3} max={30} value={Number(p.delayInicial) || VENTAS_DEFAULT.delayInicial}
                onChange={e => setProp('delayInicial', Number(e.target.value))} className="w-full accent-[#00A89D]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#0D0D0D] mb-1 uppercase">Vuelve a salir cada: {Number(p.intervalo) || VENTAS_DEFAULT.intervalo} seg</label>
              <input type="range" min={5} max={60} value={Number(p.intervalo) || VENTAS_DEFAULT.intervalo}
                onChange={e => setProp('intervalo', Number(e.target.value))} className="w-full accent-[#00A89D]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#0D0D0D] mb-1 uppercase">Dura visible: {Number(p.duracion) || VENTAS_DEFAULT.duracion} seg</label>
              <input type="range" min={2} max={10} value={Number(p.duracion) || VENTAS_DEFAULT.duracion}
                onChange={e => setProp('duracion', Number(e.target.value))} className="w-full accent-[#00A89D]" />
            </div>
          </div>
        </div>
      )}

      {esStock && (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Título</label>
            <MiniBarraTexto p={p} setProp={setProp} fontKey="tituloFont" colorKey="tituloColor" sizeKey="tituloSize" textKey="titulo" sizeMin={12} sizeMax={28} />
            <input value={String(p.titulo ?? STOCK_DEFAULT.titulo)} onChange={e => setProp('titulo', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Barra de stock: {Number(p.porcentaje) || STOCK_DEFAULT.porcentaje}%</label>
            <input type="range" min={3} max={100} value={Number(p.porcentaje) || STOCK_DEFAULT.porcentaje}
              onChange={e => setProp('porcentaje', Number(e.target.value))} className="w-full accent-[#DC2626]" />
            <p className="text-[10px] text-[#9A9A9A]">Menos % = más urgencia (quedan pocas).</p>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Mensaje</label>
            <textarea value={String(p.mensaje ?? STOCK_DEFAULT.mensaje)} onChange={e => setProp('mensaje', e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" placeholder="Quedan pocas unidades en talla M…" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Alerta (con ⚠️)</label>
            <input value={String(p.alerta ?? STOCK_DEFAULT.alerta)} onChange={e => setProp('alerta', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" placeholder="¡No te quedes sin el tuyo!" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Color</label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {PALETA_COLORES.map(c => swatch(c, p.color, (v) => setProp('color', v)))}
              <input type="color" value={p.color || '#DC2626'} onChange={e => setProp('color', e.target.value)}
                className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
            </div>
          </div>
          <div className="rounded-lg border border-[#E8E8E8] p-2.5 bg-[#FAFAFA] space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input type="checkbox" checked={p.animar === true} onChange={e => setProp('animar', e.target.checked || undefined)} className="w-4 h-4 accent-[#00A89D]" />
              📉 Barra que baja sola (efecto de urgencia)
            </label>
            {p.animar === true && (
              <div className="space-y-2 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Barra inicial: {Number(p.barraInicial) || STOCK_DEFAULT.porcentaje}%</label>
                  <input type="range" min={5} max={100} value={Number(p.barraInicial) || STOCK_DEFAULT.porcentaje}
                    onChange={e => setProp('barraInicial', Number(e.target.value))} className="w-full accent-[#DC2626]" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Barra final (mínimo, nunca baja de aquí): {Number(p.barraFinal) || 10}%</label>
                  <input type="range" min={1} max={95} value={Number(p.barraFinal) || 10}
                    onChange={e => setProp('barraFinal', Number(e.target.value))} className="w-full accent-[#DC2626]" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Baja cada: {Number(p.cadaSeg) || 15} seg</label>
                  <input type="range" min={5} max={60} step={5} value={Number(p.cadaSeg) || 15}
                    onChange={e => setProp('cadaSeg', Number(e.target.value))} className="w-full accent-[#00A89D]" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Cuánto baja cada vez: {Number(p.paso) || 1}%</label>
                  <input type="range" min={1} max={5} value={Number(p.paso) || 1}
                    onChange={e => setProp('paso', Number(e.target.value))} className="w-full accent-[#00A89D]" />
                </div>
                <p className="text-[10px] text-[#9A9A9A]">Empieza en la barra inicial y baja de a poquito hasta la final. Nunca queda vacía.</p>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked={p.flotante === true} onChange={e => setProp('flotante', e.target.checked || undefined)} className="w-4 h-4 accent-[#00A89D]" />
            📌 Flotante (fijo abajo en la pantalla)
          </label>
        </div>
      )}

      {/* Gatillos mentales */}
      {esGatillos && (
        <div className="space-y-3">
          {/* Título + tamaño + color */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Título</label>
            <input value={String(p.titulo ?? GATILLOS_DEFAULT.titulo)} onChange={e => setProp('titulo', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm mb-1.5" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#6B6B6B] shrink-0">Tamaño {Number(p.tituloSize) || GATILLOS_DEFAULT.tituloSize}px</span>
              <input type="range" min={14} max={40} value={Number(p.tituloSize) || GATILLOS_DEFAULT.tituloSize}
                onChange={e => setProp('tituloSize', Number(e.target.value))} className="flex-1 accent-[#00A89D]" />
            </div>
            <div className="flex flex-wrap gap-1.5 items-center mt-1.5">
              {PALETA_COLORES.map(c => swatch(c, p.colorTitulo, (v) => setProp('colorTitulo', v)))}
              <input type="color" value={p.colorTitulo || '#0D0D0D'} onChange={e => setProp('colorTitulo', e.target.value)} className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
            </div>
          </div>

          {/* Tipografía (todo el bloque) */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Tipografía</label>
            <select value={p.font || ''} onChange={e => setProp('font', e.target.value || undefined)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm bg-white">
              {FUENTES.map(f => <option key={f.nombre} value={f.css}>{f.nombre}</option>)}
            </select>
          </div>

          {/* Mensaje de escasez + tamaño + color */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Mensaje de urgencia</label>
            <input value={String(p.mensaje ?? GATILLOS_DEFAULT.mensaje)} onChange={e => setProp('mensaje', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm mb-1.5" placeholder="SE ESTÁ AGOTANDO LA TALLA L" />
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] text-[#6B6B6B] shrink-0">Tamaño {Number(p.mensajeSize) || GATILLOS_DEFAULT.mensajeSize}px</span>
              <input type="range" min={10} max={28} value={Number(p.mensajeSize) || GATILLOS_DEFAULT.mensajeSize} onChange={e => setProp('mensajeSize', Number(e.target.value))} className="flex-1 accent-[#00A89D]" />
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {PALETA_COLORES.map(c => swatch(c, p.colorMensaje, (v) => setProp('colorMensaje', v)))}
              <input type="color" value={p.colorMensaje || '#DC2626'} onChange={e => setProp('colorMensaje', e.target.value)} className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
            </div>
          </div>

          {/* Barra de stock */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Barra: {Number(p.porcentaje) || GATILLOS_DEFAULT.porcentaje}%</label>
            <input type="range" min={3} max={100} value={Number(p.porcentaje) || GATILLOS_DEFAULT.porcentaje}
              onChange={e => setProp('porcentaje', Number(e.target.value))} className="w-full accent-[#DC2626]" />
            <div className="flex flex-wrap gap-1.5 items-center mt-1">
              {PALETA_COLORES.map(c => swatch(c, p.colorBarra, (v) => setProp('colorBarra', v)))}
              <input type="color" value={p.colorBarra || '#DC2626'} onChange={e => setProp('colorBarra', e.target.value)} className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
            </div>
          </div>

          {/* Instrucción */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Texto de instrucción</label>
            <textarea value={String(p.descripcion ?? GATILLOS_DEFAULT.descripcion)} onChange={e => setProp('descripcion', e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm mb-1.5" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#6B6B6B] shrink-0">Tamaño {Number(p.descSize) || GATILLOS_DEFAULT.descSize}px</span>
              <input type="range" min={10} max={24} value={Number(p.descSize) || GATILLOS_DEFAULT.descSize} onChange={e => setProp('descSize', Number(e.target.value))} className="flex-1 accent-[#00A89D]" />
              {PALETA_COLORES.slice(0, 6).map(c => swatch(c, p.colorDesc, (v) => setProp('colorDesc', v)))}
            </div>
          </div>

          {/* Precio: etiquetas + color */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Etiqueta precio normal</label>
              <input value={String(p.labelNormal ?? GATILLOS_DEFAULT.labelNormal)} onChange={e => setProp('labelNormal', e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-[#E0E0E0] text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Etiqueta oferta</label>
              <input value={String(p.labelOferta ?? GATILLOS_DEFAULT.labelOferta)} onChange={e => setProp('labelOferta', e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-[#E0E0E0] text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Color del precio</label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {PALETA_COLORES.map(c => swatch(c, p.colorPrecio, (v) => setProp('colorPrecio', v)))}
              <input type="color" value={p.colorPrecio || '#DC2626'} onChange={e => setProp('colorPrecio', e.target.value)} className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
            </div>
            <p className="text-[10px] text-[#9A9A9A] mt-0.5">Los valores del precio salen del bloque <b>Precio</b>.</p>
          </div>

          {/* Tamaños de "oferta" y del precio */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Tamaño “oferta”: {Number(p.ofertaSize) || GATILLOS_DEFAULT.ofertaSize}px</label>
              <input type="range" min={12} max={34} value={Number(p.ofertaSize) || GATILLOS_DEFAULT.ofertaSize} onChange={e => setProp('ofertaSize', Number(e.target.value))} className="w-full accent-[#00A89D]" />
              <div className="flex flex-wrap gap-1 mt-1">{PALETA_COLORES.slice(0, 8).map(c => swatch(c, p.colorOferta, (v) => setProp('colorOferta', v)))}</div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Tamaño precio: {Number(p.precioSize) || GATILLOS_DEFAULT.precioSize}px</label>
              <input type="range" min={18} max={56} value={Number(p.precioSize) || GATILLOS_DEFAULT.precioSize} onChange={e => setProp('precioSize', Number(e.target.value))} className="w-full accent-[#00A89D]" />
            </div>
          </div>

          {/* Botón */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Texto del botón</label>
            <input value={String(p.cta ?? GATILLOS_DEFAULT.cta)} onChange={e => setProp('cta', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm mb-1.5" placeholder="COMPRAR" />
            <div className="flex flex-wrap gap-1.5 items-center">
              {PALETA_COLORES.map(c => swatch(c, p.colorCta, (v) => setProp('colorCta', v)))}
              <input type="color" value={p.colorCta || '#3DC12A'} onChange={e => setProp('colorCta', e.target.value)} className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
            </div>
            {/* Tamaño de letra + tamaño del botón */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <span className="text-[10px] text-[#6B6B6B]">Letra {Number(p.ctaSize) || GATILLOS_DEFAULT.ctaSize}px</span>
                <input type="range" min={12} max={30} value={Number(p.ctaSize) || GATILLOS_DEFAULT.ctaSize} onChange={e => setProp('ctaSize', Number(e.target.value))} className="w-full accent-[#00A89D]" />
              </div>
              <div>
                <span className="text-[10px] text-[#6B6B6B]">Botón {Math.round((Number(p.ctaEscala) || 1) * 100)}%</span>
                <input type="range" min={70} max={160} step={5} value={Math.round((Number(p.ctaEscala) || 1) * 100)} onChange={e => setProp('ctaEscala', Number(e.target.value) / 100)} className="w-full accent-[#00A89D]" />
              </div>
            </div>
            {/* Forma del botón */}
            <label className="block text-[10px] font-bold text-[#0D0D0D] mt-1.5 mb-1 uppercase">Forma</label>
            <div className="grid grid-cols-2 gap-1">
              {VARIANTES_BOTON.map(v => (
                <button key={v.clave} onClick={() => setProp('ctaVariante', v.clave)}
                  className={`py-1 rounded-lg border text-[11px] font-semibold ${(p.ctaVariante || 'redondeado') === v.clave ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A]' : 'border-[#E8E8E8]'}`}>{v.nombre}</button>
              ))}
            </div>
          </div>

          {/* Sellos */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Sellos</label>
            <div className="space-y-1">
              {gBadges.map((b, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input value={b} onChange={e => setGBadge(i, e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg border border-[#E0E0E0] text-[12px]" placeholder="🔁 Cambios fáciles" />
                  <button onClick={() => delGBadge(i)} className="w-6 h-6 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] text-xs">✕</button>
                </div>
              ))}
            </div>
            <button onClick={addGBadge} className="mt-1 text-[11px] text-[#00A89D] font-semibold hover:underline">+ Agregar sello</button>
          </div>
        </div>
      )}

      {/* Clientes felices (testimonios) */}
      {esTestimonios && (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Título</label>
            <MiniBarraTexto p={p} setProp={setProp} fontKey="tituloFont" colorKey="tituloColor" sizeKey="tituloSize" textKey="titulo" sizeMin={14} sizeMax={32} />
            <input value={String(p.titulo ?? TESTIMONIOS_DEFAULT.titulo)} onChange={e => setProp('titulo', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Reseñas</label>
            <div className="space-y-2">
              {tItems.map((it, i) => (
                <div key={i} className="rounded-xl border border-[#E8E8E8] p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    {it.foto
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={it.foto} alt="" className="w-9 h-9 rounded-lg object-cover" />
                      : <div className="w-9 h-9 rounded-lg bg-[#00A89D]/10 text-[#00847A] font-bold text-sm flex items-center justify-center">{(it.nombre || '?').slice(0, 1)}</div>}
                    <input value={it.nombre ?? ''} onChange={e => setItem(i, { nombre: e.target.value })}
                      className="flex-1 px-2 py-1.5 rounded-lg border border-[#E0E0E0] text-sm" placeholder="Nombre" />
                    <select value={Number(it.estrellas) || 5} onChange={e => setItem(i, { estrellas: Number(e.target.value) })}
                      className="px-1.5 py-1.5 rounded-lg border border-[#E0E0E0] text-sm">
                      {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n}⭐</option>)}
                    </select>
                    <button onClick={() => delItem(i)} className="w-7 h-7 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] text-xs shrink-0">✕</button>
                  </div>
                  <textarea value={it.texto ?? ''} onChange={e => setItem(i, { texto: e.target.value })} rows={2}
                    className="w-full px-2 py-1.5 rounded-lg border border-[#E0E0E0] text-[12px]" placeholder="Comentario del cliente…" />
                  <div className="flex gap-2">
                    <button onClick={() => { idxItem.current = i; refItemFile.current?.click(); }} disabled={subiendo}
                      className="text-[11px] text-[#00847A] font-semibold hover:underline disabled:opacity-50">📷 {it.foto ? 'Cambiar foto' : 'Subir foto'}</button>
                    {it.foto && <button onClick={() => setItem(i, { foto: '' })} className="text-[11px] text-[#6B6B6B] hover:underline">quitar foto</button>}
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#DC2626] cursor-pointer select-none">
                    <input type="checkbox" checked={!!it.gatillo} onChange={e => setItem(i, { gatillo: e.target.checked })} />
                    🆕 Reseña gatillo (aparece a los 6s)
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#15803D] cursor-pointer select-none">
                    <input type="checkbox" checked={!!it.boton} onChange={e => setItem(i, { boton: e.target.checked })} />
                    🛒 Poner botón de compra después de esta reseña
                  </label>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-1.5 text-[11px] text-[#00A89D] font-semibold hover:underline">+ Agregar reseña</button>
            <input ref={refItemFile} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) subirFotoItem(f); e.target.value = ''; }} />
          </div>

          {/* Botón de compra intercalado entre reseñas — mismas opciones que un botón normal */}
          <div className="rounded-xl border border-[#E8E8E8] bg-[#F0FDF4] p-2.5 space-y-2.5">
            <p className="text-[11px] font-bold text-[#15803D] uppercase">🛒 Botón de compra entre reseñas</p>
            <p className="text-[10px] text-[#6B6B6B] -mt-1">Marca 🛒 en las reseñas donde quieras que aparezca el botón. Aquí eliges cómo se ve.</p>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Texto del botón</label>
              <input value={String(p.botonTexto ?? 'COMPRA FÁCIL AQUÍ')} onChange={e => setProp('botonTexto', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" placeholder="COMPRA FÁCIL AQUÍ" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Tipo de botón</label>
              <div className="grid grid-cols-3 gap-1.5">
                {VARIANTES_BOTON.map(v => (
                  <button key={v.clave} onClick={() => setProp('botonVariante', v.clave)}
                    className={`py-1.5 rounded-lg border text-xs font-semibold ${(p.botonVariante || 'pill') === v.clave ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A]' : 'border-[#E8E8E8]'}`}>{v.nombre}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Tamaño del botón: {Math.round((Number(p.botonEscala) || 1) * 100)}%</label>
              <input type="range" min={70} max={160} step={5} value={Math.round((Number(p.botonEscala) || 1) * 100)}
                onChange={e => { const v = Number(e.target.value) / 100; setProp('botonEscala', v === 1 ? undefined : v); }}
                className="w-full accent-[#00A89D]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Tamaño de letra: {Number(p.botonSize) || 18}px</label>
              <input type="range" min={12} max={28} value={Number(p.botonSize) || 18}
                onChange={e => setProp('botonSize', Number(e.target.value))} className="w-full accent-[#00A89D]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Color del botón</label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {PALETA_COLORES.map(c => swatch(c, p.botonColor, (v) => setProp('botonColor', v)))}
                <input type="color" value={p.botonColor || '#3DC12A'} onChange={e => setProp('botonColor', e.target.value)}
                  className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Color del texto</label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {PALETA_COLORES.map(c => swatch(c, p.botonColorTexto, (v) => setProp('botonColorTexto', v)))}
                <input type="color" value={p.botonColorTexto || '#FFFFFF'} onChange={e => setProp('botonColorTexto', e.target.value)}
                  className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Ancho del botón: {Number(p.botonAncho) || 100}%</label>
              <input type="range" min={40} max={100} step={5} value={Number(p.botonAncho) || 100}
                onChange={e => { const v = Number(e.target.value); setProp('botonAncho', v === 100 ? undefined : v); }}
                className="w-full accent-[#00A89D]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Ubicación</label>
              <div className="flex gap-2">
                {[['left', '⬅ Izq'], ['center', '⬌ Centro'], ['right', 'Der ➡']].map(([val, txt]) => (
                  <button key={val} onClick={() => setProp('botonAlign', val)}
                    className={`flex-1 rounded-lg border-2 py-1.5 text-[11px] font-semibold ${(p.botonAlign || 'center') === val ? 'border-[#00A89D] bg-[#00A89D]/10' : 'border-[#E0E0E0]'}`}>{txt}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Aviso flotante "Nueva reseña agregada" (reseña gatillo) */}
          <div className="rounded-xl border border-[#E8E8E8] bg-[#EFF6FF] p-2.5 space-y-2.5">
            <p className="text-[11px] font-bold text-[#1E3A8A] uppercase">🆕 Aviso flotante de reseña gatillo</p>
            <p className="text-[10px] text-[#6B6B6B] -mt-1">Marca 🆕 en una reseña arriba. Ese aviso aparece solo y al tocarlo lleva a la reseña.</p>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Texto del aviso</label>
              <input value={String(p.avisoTexto ?? 'Nueva reseña')} onChange={e => setProp('avisoTexto', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" placeholder="Nueva reseña" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Ubicación</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[['sup-izq', '↖ Arriba izq'], ['sup-der', '↗ Arriba der'], ['inf-izq', '↙ Abajo izq'], ['inf-der', '↘ Abajo der']].map(([val, txt]) => (
                  <button key={val} onClick={() => setProp('avisoPosicion', val)}
                    className={`rounded-lg border-2 py-1.5 text-[11px] font-semibold ${(p.avisoPosicion || 'sup-der') === val ? 'border-[#00A89D] bg-[#00A89D]/10' : 'border-[#E0E0E0]'}`}>{txt}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Color fondo</label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {PALETA_COLORES.map(c => swatch(c, p.avisoColor, (v) => setProp('avisoColor', v)))}
                  <input type="color" value={p.avisoColor || '#1E3A8A'} onChange={e => setProp('avisoColor', e.target.value)}
                    className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Color texto</label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {PALETA_COLORES.map(c => swatch(c, p.avisoColorTexto, (v) => setProp('avisoColorTexto', v)))}
                  <input type="color" value={p.avisoColorTexto || '#FFFFFF'} onChange={e => setProp('avisoColorTexto', e.target.value)}
                    className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Aparece a los: {Number(p.avisoAparece) || 6} seg</label>
              <input type="range" min={2} max={30} value={Number(p.avisoAparece) || 6}
                onChange={e => setProp('avisoAparece', Number(e.target.value))} className="w-full accent-[#00A89D]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Dura visible: {Number(p.avisoDura) || 20} seg</label>
              <input type="range" min={3} max={40} value={Number(p.avisoDura) || 20}
                onChange={e => setProp('avisoDura', Number(e.target.value))} className="w-full accent-[#00A89D]" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Sellos de confianza</label>
            <div className="space-y-1">
              {tBadges.map((b, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input value={b} onChange={e => setBadge(i, e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-[#E0E0E0] text-[12px]" placeholder="🚚 Envío gratis" />
                  <button onClick={() => delBadge(i)} className="w-6 h-6 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] text-xs">✕</button>
                </div>
              ))}
            </div>
            <button onClick={addBadge} className="mt-1 text-[11px] text-[#00A89D] font-semibold hover:underline">+ Agregar sello</button>
          </div>
        </div>
      )}

      {/* Media (portada/banner/imagen): subir, modo y tamaño */}
      {esMedia && (
        <div className="space-y-3">
          {/* Subir archivo — se oculta en Portada modo Carrusel (ahí las fotos salen
              del carrusel de abajo, no de este "Archivo"). */}
          {onSubirArchivo && !(bloque.tipo === 'portada' && p.modo === 'carrusel') && (
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Archivo</label>
              {/* Recuadro grande para subir o arrastrar */}
              <div
                onClick={() => abrirPicker('image/*,video/*')}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) alSubir(f); }}
                className="rounded-xl border-2 border-dashed border-[#00A89D]/50 p-4 text-center cursor-pointer hover:bg-[#00A89D]/5"
              >
                {p.url ? (
                  <div className="space-y-1.5">
                    {esVideo(String(p.url))
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      ? <video src={String(p.url)} muted className="max-h-28 mx-auto rounded-lg" />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={String(p.url)} alt="" className="max-h-28 mx-auto rounded-lg" />}
                    <p className="text-[11px] text-[#00847A] font-semibold">🔄 Cambiar archivo</p>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl leading-none">🖼️</div>
                    <p className="text-xs font-semibold text-[#0D0D0D] mt-1">Subir o arrastrar archivo</p>
                    <p className="text-[10px] text-[#9A9A9A]">Foto, GIF o video</p>
                  </>
                )}
                {subiendo && <p className="text-[11px] text-[#00847A] mt-1">Subiendo…</p>}
              </div>
              <div className="grid grid-cols-2 gap-1 mt-1.5">
                <button onClick={() => abrirPicker('image/*')} disabled={subiendo}
                  className="py-1.5 rounded-lg border border-[#E8E8E8] text-xs font-semibold hover:bg-[#F5F5F5] disabled:opacity-50">📷 Foto / GIF</button>
                <button onClick={() => abrirPicker('video/*')} disabled={subiendo}
                  className="py-1.5 rounded-lg border border-[#E8E8E8] text-xs font-semibold hover:bg-[#F5F5F5] disabled:opacity-50">🎬 Video</button>
              </div>
              <input ref={refFile} type="file" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) alSubir(f); e.target.value = ''; }} />
            </div>
          )}

          {/* Cómo se ve */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Cómo se ve</label>
            <div className="grid grid-cols-2 gap-1">
              {(bloque.tipo === 'portada'
                ? [['individual', '🖼️ Foto/Video'], ['carrusel', '🎞️ Carrusel']]
                : [['individual', '🖼️ Foto/Video'], ['collage', '🧩 Collage']]
              ).map(([v, t]) => (
                <button key={v} onClick={() => setProp('modo', v)}
                  className={`py-1.5 rounded-lg border text-xs font-semibold ${(p.modo || 'individual') === v ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A]' : 'border-[#E8E8E8]'}`}>{t}</button>
              ))}
            </div>
          </div>

          {/* Selector de fotos del carrusel (portada) */}
          {bloque.tipo === 'portada' && p.modo === 'carrusel' && (
            <div>
              <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Fotos del carrusel</label>
              <p className="text-[10px] text-[#9A9A9A] mb-1.5">Elige cuáles fotos de la galería salen y cambian solas cada 2 seg. Si no eliges ninguna, salen todas.</p>
              {onSubirArchivo && (
                <div className="mb-2">
                  <button onClick={() => refCarrusel.current?.click()} disabled={subiendo}
                    className="w-full py-2 rounded-lg border-2 border-dashed border-[#00A89D]/60 text-[#00847A] text-xs font-bold hover:bg-[#00A89D]/10 disabled:opacity-50">
                    {subiendo ? 'Subiendo…' : '➕ Subir varias fotos (elige varias a la vez)'}
                  </button>
                  <input ref={refCarrusel} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => { if (e.target.files?.length) subirVariasCarrusel(e.target.files); e.target.value = ''; }} />
                </div>
              )}
              {(imagenes && imagenes.length > 0) ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {imagenes.map((src, i) => {
                    const sel: string[] = Array.isArray(p.fotos) ? p.fotos : [];
                    const activa = sel.length === 0 || sel.includes(src);
                    return (
                      <button key={i}
                        onClick={() => {
                          const base: string[] = Array.isArray(p.fotos) && p.fotos.length ? p.fotos : (sel.length === 0 ? [...imagenes] : []);
                          const next = base.includes(src) ? base.filter(x => x !== src) : [...base, src];
                          setProp('fotos', next.length ? next : undefined);
                        }}
                        className={`relative rounded-lg overflow-hidden border-2 ${activa ? 'border-[#00A89D]' : 'border-[#E0E0E0] opacity-40'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="w-full aspect-square object-cover" />
                        {activa && <span className="absolute top-0.5 right-0.5 text-[10px] bg-[#00A89D] text-white rounded-full w-4 h-4 flex items-center justify-center">✓</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-[#C2410C]">Sube fotos a la galería del embudo (sección de fotos) para poder elegirlas.</p>
              )}
            </div>
          )}

          {/* Tamaño (alto) */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Alto: {Number(p.h) ? `${Number(p.h)}px` : 'automático'}</label>
            <input type="range" min={0} max={600} step={10} value={Number(p.h) || 0}
              onChange={e => setProp('h', Number(e.target.value) || undefined)} className="w-full accent-[#00A89D]" />
            <p className="text-[10px] text-[#9A9A9A] mt-0.5">0 = tamaño original. Para <b>GIF/Video</b>, sube ese archivo con “Video” o “Foto/GIF”.</p>
          </div>
        </div>
      )}

      {/* Botón: tipo de botón + flotante */}
      {esBoton && (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Tipo de botón</label>
            <div className="grid grid-cols-2 gap-1">
              {VARIANTES_BOTON.map(v => (
                <button key={v.clave} onClick={() => setProp('variante', v.clave)}
                  className={`py-1.5 rounded-lg border text-xs font-semibold ${(p.variante || 'pill') === v.clave ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A]' : 'border-[#E8E8E8]'}`}>{v.nombre}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Tamaño del botón: {Math.round((Number(p.escala) || 1) * 100)}%</label>
            <input type="range" min={70} max={160} step={5} value={Math.round((Number(p.escala) || 1) * 100)}
              onChange={e => { const v = Number(e.target.value) / 100; setProp('escala', v === 1 ? undefined : v); }}
              className="w-full accent-[#00A89D]" />
            <p className="text-[10px] text-[#9A9A9A]">La letra se adapta al tamaño. También puedes arrastrar la esquina del botón en el teléfono.</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked={p.flotante === true} onChange={e => setProp('flotante', e.target.checked || undefined)} className="w-4 h-4 accent-[#00A89D]" />
            📌 Botón flotante (fijo abajo en la pantalla)
          </label>
        </div>
      )}

      {textLike && (
        <>
          {/* Medidas (tamaño de letra) */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Tamaño de letra: {Number(p.size) || '—'}{p.size ? 'px' : ''}</label>
            <input type="range" min={10} max={48} value={Number(p.size) || 18}
              onChange={e => setProp('size', Number(e.target.value))} className="w-full accent-[#00A89D]" />
          </div>

          {/* Color de letra */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Color de letra</label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {PALETA_COLORES.map(c => swatch(c, p.color, (v) => setProp('color', v)))}
              <input type="color" value={p.color || '#0D0D0D'} onChange={e => setProp('color', e.target.value)}
                className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" title="Color personalizado" />
              {p.color && <button onClick={() => setProp('color', undefined)} className="text-[10px] text-[#6B6B6B] hover:underline">quitar</button>}
            </div>
          </div>

          {/* Color de fondo (botón y textos) */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">{esBoton ? 'Color del botón' : 'Color de fondo'}</label>
            <div className="flex flex-wrap gap-1.5 items-center">
              <button onClick={() => setProp('bg', 'transparent')} title="Sin fondo"
                className={`w-6 h-6 rounded-full border-2 ${p.bg === 'transparent' ? 'border-[#00A89D]' : 'border-[#E8E8E8]'} bg-white relative overflow-hidden`}>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] text-[#DC2626]">∅</span>
              </button>
              {PALETA_COLORES.map(c => swatch(c, p.bg, (v) => setProp('bg', v)))}
              <input type="color" value={p.bg && p.bg !== 'transparent' ? p.bg : '#3DC12A'} onChange={e => setProp('bg', e.target.value)}
                className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" title="Color personalizado" />
              {p.bg && <button onClick={() => setProp('bg', undefined)} className="text-[10px] text-[#6B6B6B] hover:underline">quitar</button>}
            </div>
            {!esBoton && <p className="text-[10px] text-[#9A9A9A] mt-0.5">“∅” = sin fondo (transparente).</p>}
          </div>

          {/* Tipografía */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Tipografía</label>
            <select value={p.font || ''} onChange={e => setProp('font', e.target.value || undefined)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm bg-white">
              {FUENTES.map(f => <option key={f.nombre} value={f.css}>{f.nombre}</option>)}
            </select>
          </div>
        </>
      )}

      {/* Animación (todos los bloques) */}
      <div>
        <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Animación</label>
        <select value={p.anim || ''} onChange={e => setProp('anim', e.target.value || undefined)}
          className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm bg-white">
          {ANIMACIONES.map(a => <option key={a.clave} value={a.clave}>{a.nombre}</option>)}
        </select>
      </div>

      {/* Ancho del bloque (todos los bloques) */}
      <div>
        <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Ancho del bloque: {Number(p.w) || 100}%</label>
        <input type="range" min={40} max={100} step={5} value={Number(p.w) || 100}
          onChange={e => { const v = Number(e.target.value); setProp('w', v >= 100 ? undefined : v); }}
          className="w-full accent-[#00A89D]" />
        <p className="text-[10px] text-[#9A9A9A] mt-0.5">100% = ancho completo. Menos lo hace más angosto y centrado.</p>
      </div>

      {/* Espaciado (todos los bloques) — negativo = juntar con el bloque vecino */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Espacio arriba: {Number(p.mt) || 0}px</label>
          <input type="range" min={-40} max={60} value={Number(p.mt) || 0}
            onChange={e => setProp('mt', Number(e.target.value) || undefined)} className="w-full accent-[#00A89D]" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Espacio abajo: {Number(p.mb) || 0}px</label>
          <input type="range" min={-40} max={60} value={Number(p.mb) || 0}
            onChange={e => setProp('mb', Number(e.target.value) || undefined)} className="w-full accent-[#00A89D]" />
        </div>
      </div>
      <p className="text-[10px] text-[#9A9A9A] -mt-1">← Muévelo a la izquierda (negativo) para juntar este bloque con el de al lado y quitar espacio.</p>

      {/* Alineación (texto) */}
      {(esTexto || bloque.tipo === 'titular') && (
        <div>
          <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Alineación</label>
          <div className="flex gap-1">
            {(['left', 'center', 'right'] as const).map(a => (
              <button key={a} onClick={() => setProp('align', a)}
                className={`flex-1 py-1.5 rounded-lg border text-xs ${p.align === a || (!p.align && a === 'center') ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A] font-semibold' : 'border-[#E8E8E8]'}`}>
                {a === 'left' ? '⬅' : a === 'center' ? '⬍' : '➡'}
              </button>
            ))}
          </div>
        </div>
      )}

      {!textLike && !esTexto && (
        <p className="text-[11px] text-[#9A9A9A] leading-snug">
          Este bloque ({def?.nombre}) toma su contenido (fotos, precio, etc.) de los campos de la derecha. Aquí puedes duplicarlo, borrarlo y animarlo.
        </p>
      )}
    </div>
  );
}

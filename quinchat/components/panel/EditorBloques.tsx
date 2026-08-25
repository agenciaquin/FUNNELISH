'use client';

import { useState } from 'react';
import {
  CATALOGO_BLOQUES, layoutPorDefecto, defDeBloque, nuevoIdBloque,
  type Bloque, type LayoutEmbudo,
} from '@/lib/bloques';

/**
 * Editor libre de bloques de la página de venta.
 * - value null  → el embudo usa el diseño estándar (orden de siempre).
 * - value {..}  → diseño personalizado (bloques prendidos/apagados y reordenados).
 */
export default function EditorBloques({
  value, onChange,
}: {
  value: LayoutEmbudo | null;
  onChange: (l: LayoutEmbudo | null) => void;
}) {
  const [abierto, setAbierto] = useState<string | null>(null); // bloque con opciones abiertas
  const [paleta, setPaleta] = useState(false);

  const bloques = value?.bloques ?? null;

  const emitir = (nuevos: Bloque[]) => onChange({ bloques: nuevos });

  // Si aún no se personalizó, se muestra el aviso + botón para empezar.
  if (!bloques) {
    return (
      <div className="rounded-xl border border-dashed border-[#C9C9C9] p-4 text-center bg-[#FAFAFA]">
        <p className="text-xs text-[#6B6B6B] mb-3 leading-snug">
          Esta página usa el <b>diseño estándar</b> (el orden de siempre).<br />
          Personalízalo para prender/apagar bloques y reordenarlos a tu gusto.
        </p>
        <button
          onClick={() => emitir(layoutPorDefecto())}
          className="px-4 py-2 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A]"
        >🧩 Personalizar diseño</button>
      </div>
    );
  }

  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= bloques.length) return;
    const n = [...bloques];
    [n[i], n[j]] = [n[j], n[i]];
    emitir(n);
  };
  const quitar = (i: number) => emitir(bloques.filter((_, k) => k !== i));
  const alternar = (i: number) => emitir(bloques.map((b, k) => k === i ? { ...b, visible: b.visible === false } : b));
  const cambiarProps = (i: number, props: Record<string, any>) =>
    emitir(bloques.map((b, k) => k === i ? { ...b, props: { ...(b.props ?? {}), ...props } } : b));

  const agregar = (tipo: string) => {
    const def = defDeBloque(tipo);
    if (!def) return;
    // Los no repetibles solo pueden estar una vez.
    if (!def.repetible && bloques.some(b => b.tipo === tipo)) { setPaleta(false); return; }
    emitir([...bloques, { id: nuevoIdBloque(), tipo, visible: true, props: {} }]);
    setPaleta(false);
  };

  // Arrastrar para reordenar (además de las flechas)
  const onDrop = (destino: number, origen: number) => {
    if (origen === destino || origen < 0) return;
    const n = [...bloques];
    const [m] = n.splice(origen, 1);
    n.splice(destino, 0, m);
    emitir(n);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[#6B6B6B]">Arrastra ⠿ o usa ↑↓ para ordenar. El 👁️ prende/apaga.</p>
        <button
          onClick={() => onChange(null)}
          className="text-[11px] text-[#DC2626] font-semibold hover:underline"
          title="Volver al diseño estándar"
        >↺ Diseño estándar</button>
      </div>

      <div className="space-y-1.5">
        {bloques.map((b, i) => {
          const def = defDeBloque(b.tipo);
          const apagado = b.visible === false;
          const conOpciones = def?.contenido;
          return (
            <div
              key={b.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onDrop(i, Number(e.dataTransfer.getData('text/plain'))); }}
              className={`rounded-lg border bg-white ${apagado ? 'border-[#E8E8E8] opacity-60' : 'border-[#00A89D]/25'}`}
            >
              <div className="flex items-center gap-2 px-2.5 py-2">
                <span className="cursor-grab active:cursor-grabbing text-[#00A89D] text-[15px] leading-none select-none" title="Arrastrar">⠿</span>
                <span className="text-base leading-none">{def?.emoji ?? '🔧'}</span>
                <span className="flex-1 min-w-0 text-xs font-semibold text-[#0D0D0D] truncate">
                  {def?.nombre ?? b.tipo}
                  {b.tipo === 'texto' && b.props?.texto ? <span className="text-[#9A9A9A] font-normal"> · “{String(b.props.texto).slice(0, 20)}”</span> : null}
                </span>

                {conOpciones && (
                  <button
                    onClick={() => setAbierto(abierto === b.id ? null : b.id)}
                    className="w-7 h-7 rounded-md text-[13px] text-[#00847A] hover:bg-[#00A89D]/10"
                    title="Opciones del bloque"
                  >⚙️</button>
                )}
                <button onClick={() => alternar(i)} className="w-7 h-7 rounded-md text-[13px] hover:bg-[#F5F5F5]" title={apagado ? 'Prender' : 'Apagar'}>
                  {apagado ? '🚫' : '👁️'}
                </button>
                <button onClick={() => mover(i, -1)} disabled={i === 0} className="w-6 h-7 rounded-md text-[12px] text-[#00847A] hover:bg-[#00A89D]/10 disabled:opacity-30" title="Subir">↑</button>
                <button onClick={() => mover(i, 1)} disabled={i === bloques.length - 1} className="w-6 h-7 rounded-md text-[12px] text-[#00847A] hover:bg-[#00A89D]/10 disabled:opacity-30" title="Bajar">↓</button>
                <button onClick={() => quitar(i)} className="w-7 h-7 rounded-md text-[12px] text-[#DC2626] hover:bg-[#FEE2E2]" title="Quitar">🗑</button>
              </div>

              {/* Opciones para bloques con contenido propio */}
              {conOpciones && abierto === b.id && (
                <div className="px-2.5 pb-2.5 pt-0 space-y-2 border-t border-[#F0F0F0]">
                  {b.tipo === 'texto' && <OpcionesTexto b={b} onChange={(p) => cambiarProps(i, p)} />}
                  {b.tipo === 'imagen' && <OpcionesImagen b={b} onChange={(p) => cambiarProps(i, p)} />}
                  {b.tipo === 'espacio' && <OpcionesEspacio b={b} onChange={(p) => cambiarProps(i, p)} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Agregar bloque */}
      {paleta ? (
        <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-2">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[11px] font-bold text-[#6B6B6B]">Elige un bloque</span>
            <button onClick={() => setPaleta(false)} className="text-[11px] text-[#6B6B6B] hover:underline">Cerrar</button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {CATALOGO_BLOQUES.map(def => {
              const yaEsta = !def.repetible && bloques.some(b => b.tipo === def.clave);
              return (
                <button
                  key={def.clave}
                  onClick={() => agregar(def.clave)}
                  disabled={yaEsta}
                  title={def.desc}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left text-[11px] ${
                    yaEsta ? 'border-[#E8E8E8] text-[#C9C9C9] cursor-not-allowed' : 'border-[#E8E8E8] hover:border-[#00A89D] hover:bg-white'
                  }`}
                >
                  <span className="text-sm">{def.emoji}</span>
                  <span className="font-semibold truncate">{def.nombre}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setPaleta(true)}
          className="w-full py-2 rounded-lg border-2 border-dashed border-[#C9C9C9] text-xs text-[#6B6B6B] font-semibold hover:border-[#00A89D] hover:text-[#00A89D]"
        >+ Agregar bloque</button>
      )}
    </div>
  );
}

const miniInput = 'w-full px-2 py-1.5 rounded-md border border-[#E8E8E8] text-xs focus:outline-none focus:border-[#00A89D]';

function OpcionesTexto({ b, onChange }: { b: Bloque; onChange: (p: Record<string, any>) => void }) {
  const p = b.props ?? {};
  return (
    <div className="space-y-2 pt-2">
      <textarea
        rows={2}
        value={p.texto ?? ''}
        onChange={(e) => onChange({ texto: e.target.value })}
        placeholder="Escribe tu texto…"
        className={`${miniInput} resize-y`}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <select value={p.align ?? 'center'} onChange={(e) => onChange({ align: e.target.value })} className={`${miniInput} w-auto`}>
          <option value="left">Izquierda</option>
          <option value="center">Centro</option>
          <option value="right">Derecha</option>
        </select>
        <label className="flex items-center gap-1 text-[11px]">
          Tamaño
          <input type="number" value={p.size ?? 16} onChange={(e) => onChange({ size: Number(e.target.value) })} className={`${miniInput} w-16`} />
        </label>
        <label className="flex items-center gap-1 text-[11px] cursor-pointer">
          <input type="checkbox" checked={p.bold !== false} onChange={(e) => onChange({ bold: e.target.checked })} />
          Negrita
        </label>
        <label className="flex items-center gap-1 text-[11px] cursor-pointer">
          Color
          <input type="color" value={p.color ?? '#0D0D0D'} onChange={(e) => onChange({ color: e.target.value })} className="w-6 h-6 p-0 border-0 bg-transparent" />
        </label>
      </div>
    </div>
  );
}

function OpcionesImagen({ b, onChange }: { b: Bloque; onChange: (p: Record<string, any>) => void }) {
  const p = b.props ?? {};
  return (
    <div className="space-y-2 pt-2">
      <input
        value={p.url ?? ''}
        onChange={(e) => onChange({ url: e.target.value })}
        placeholder="Pega el enlace de la foto o video…"
        className={miniInput}
      />
      {p.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={String(p.url)} alt="" className="w-full max-h-28 object-contain rounded-md border border-[#E8E8E8] bg-[#FAFAFA]" />
      ) : (
        <p className="text-[10px] text-[#9A9A9A]">Consejo: sube la foto a la galería del embudo y copia su enlace aquí.</p>
      )}
    </div>
  );
}

function OpcionesEspacio({ b, onChange }: { b: Bloque; onChange: (p: Record<string, any>) => void }) {
  const p = b.props ?? {};
  return (
    <div className="pt-2">
      <label className="flex items-center gap-2 text-[11px]">
        Alto del espacio (px)
        <input type="number" value={p.alto ?? 24} onChange={(e) => onChange({ alto: Number(e.target.value) })} className={`${miniInput} w-20`} />
      </label>
    </div>
  );
}

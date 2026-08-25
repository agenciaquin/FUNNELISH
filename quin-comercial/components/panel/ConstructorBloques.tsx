'use client';

import { useState } from 'react';

export type BloqueTipo = 'foto' | 'video' | 'texto' | 'boton';
export interface Bloque {
  id: string;
  tipo: BloqueTipo;
  url?: string;
  titulo?: string;
  cuerpo?: string;
  centrado?: boolean;
  texto?: string;
  accion?: 'comprar' | 'url';
}

const nid = () => 'b-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);

const PALETA: { tipo: BloqueTipo; label: string; icono: string }[] = [
  { tipo: 'foto', label: 'Foto', icono: '📷' },
  { tipo: 'video', label: 'Video', icono: '🎬' },
  { tipo: 'texto', label: 'Texto', icono: '📝' },
  { tipo: 'boton', label: 'Botón', icono: '🔘' },
];

/**
 * Constructor visual de bloques (arrastrar y soltar).
 *  - Paleta a la derecha: arrastra Foto/Video/Texto/Botón a la página.
 *  - Suéltalo donde quieras: aparece una línea que marca el lugar.
 *  - Toca un bloque para editarlo en el lugar. Barra: arrastrar, cambiar tipo, duplicar, borrar.
 */
export default function ConstructorBloques({
  bloques,
  onChange,
  subir,
}: {
  bloques: Bloque[];
  onChange: (bs: Bloque[]) => void;
  subir: (f: File) => Promise<string | null>;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [zona, setZona] = useState<number | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);

  const nuevo = (tipo: BloqueTipo): Bloque => {
    const b: Bloque = { id: nid(), tipo };
    if (tipo === 'texto') b.cuerpo = 'Escribe aquí tu texto…';
    if (tipo === 'boton') { b.texto = 'COMPRAR AHORA'; b.accion = 'comprar'; }
    return b;
  };

  const editar = (id: string, patch: Partial<Bloque>) =>
    onChange(bloques.map(b => (b.id === id ? { ...b, ...patch } : b)));
  const borrar = (id: string) => { onChange(bloques.filter(b => b.id !== id)); if (sel === id) setSel(null); };
  const duplicar = (id: string) => {
    const i = bloques.findIndex(b => b.id === id);
    if (i < 0) return;
    const copia: Bloque = { ...bloques[i], id: nid() };
    const bs = [...bloques]; bs.splice(i + 1, 0, copia); onChange(bs); setSel(copia.id);
  };
  const cambiarTipo = (id: string, tipo: BloqueTipo) =>
    onChange(bloques.map(b => {
      if (b.id !== id) return b;
      const n: Bloque = { id: b.id, tipo };
      if (tipo === 'foto' || tipo === 'video') n.url = b.url;
      if (tipo === 'texto') { n.cuerpo = b.cuerpo ?? b.texto ?? ''; n.titulo = b.titulo; n.centrado = b.centrado; }
      if (tipo === 'boton') { n.texto = b.texto ?? b.titulo ?? b.cuerpo ?? 'COMPRAR'; n.accion = b.accion ?? 'comprar'; n.url = b.url; }
      return n;
    }));

  const soltar = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setZona(null);
    const data = e.dataTransfer.getData('text/plain');
    if (data.startsWith('nuevo:')) {
      const b = nuevo(data.slice(6) as BloqueTipo);
      const bs = [...bloques]; bs.splice(idx, 0, b); onChange(bs); setSel(b.id);
    } else if (data.startsWith('mover:')) {
      const id = data.slice(6);
      const from = bloques.findIndex(b => b.id === id);
      if (from < 0) return;
      const bs = [...bloques];
      const [m] = bs.splice(from, 1);
      const dest = from < idx ? idx - 1 : idx;
      bs.splice(dest, 0, m); onChange(bs);
    }
  };

  const subirA = async (id: string, f: File) => {
    setSubiendo(id);
    try { const url = await subir(f); if (url) editar(id, { url }); }
    finally { setSubiendo(null); }
  };

  const Zona = ({ idx }: { idx: number }) => (
    <div
      onDragOver={e => { e.preventDefault(); setZona(idx); }}
      onDragLeave={() => setZona(v => (v === idx ? null : v))}
      onDrop={soltar(idx)}
      className={`transition-all ${zona === idx ? 'h-9 bg-[#00A89D]/15 border-2 border-dashed border-[#00A89D] rounded-lg my-1' : 'h-2'}`}
    />
  );

  return (
    <div className="flex gap-3">
      {/* CANVAS: la página */}
      <div className="flex-1 min-w-0 rounded-2xl border border-[#E8E8E8] bg-[#F7F7F5] p-2">
        <Zona idx={0} />
        {bloques.length === 0 && zona === null && (
          <p className="text-center text-xs text-[#9A9A9A] py-10">
            Arrastra un elemento de la derecha hasta aquí →<br />o toca “Agregar”.
          </p>
        )}
        {bloques.map((b, i) => (
          <div key={b.id}>
            <div
              draggable={sel !== b.id}
              onDragStart={e => { e.dataTransfer.setData('text/plain', 'mover:' + b.id); }}
              onClick={() => setSel(b.id)}
              className={`relative rounded-lg bg-white border p-2 ${sel === b.id ? 'border-[#00A89D] ring-1 ring-[#00A89D]' : 'border-[#E8E8E8] cursor-pointer hover:border-[#00A89D]/50'}`}
            >
              <div className="absolute -top-2.5 right-2 flex items-center gap-0.5 bg-white border border-[#E8E8E8] rounded-lg px-1 py-0.5 shadow-sm z-10">
                <span className="cursor-grab text-xs px-0.5 select-none" title="Arrastrar">⠿</span>
                <select
                  value={b.tipo}
                  onClick={e => e.stopPropagation()}
                  onChange={e => cambiarTipo(b.id, e.target.value as BloqueTipo)}
                  className="text-[11px] bg-transparent outline-none cursor-pointer"
                  title="Cambiar tipo"
                >
                  <option value="foto">📷</option>
                  <option value="video">🎬</option>
                  <option value="texto">📝</option>
                  <option value="boton">🔘</option>
                </select>
                <button onClick={e => { e.stopPropagation(); duplicar(b.id); }} title="Duplicar" className="text-xs px-0.5">⧉</button>
                <button onClick={e => { e.stopPropagation(); borrar(b.id); }} title="Borrar" className="text-xs px-0.5 text-[#DC2626]">🗑</button>
              </div>
              {contenido(b)}
            </div>
            <Zona idx={i + 1} />
          </div>
        ))}
      </div>

      {/* PALETA */}
      <div className="w-28 md:w-32 shrink-0">
        <p className="text-[11px] font-semibold text-[#6B6B6B] mb-2">Agregar</p>
        <div className="space-y-2">
          {PALETA.map(p => (
            <div
              key={p.tipo}
              draggable
              onDragStart={e => { e.dataTransfer.setData('text/plain', 'nuevo:' + p.tipo); }}
              onClick={() => { const b = nuevo(p.tipo); onChange([...bloques, b]); setSel(b.id); }}
              className="flex items-center gap-2 px-2 py-2 rounded-xl border border-[#E8E8E8] bg-white text-xs cursor-grab hover:border-[#00A89D] active:scale-95 transition-all"
              title={`Arrastra a la página para agregar ${p.label}`}
            >
              <span>{p.icono}</span><span>{p.label}</span>
            </div>
          ))}
          <p className="text-[10px] text-[#9A9A9A] leading-tight pt-1">
            Arrástralos a la página, o toca uno para agregarlo al final.
          </p>
        </div>
      </div>
    </div>
  );

  function contenido(b: Bloque) {
    if (sel === b.id) {
      if (b.tipo === 'foto' || b.tipo === 'video') {
        return (
          <div className="space-y-2 pt-3" onClick={e => e.stopPropagation()}>
            {b.url && (b.tipo === 'foto'
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={b.url} alt="" className="w-full max-h-40 object-contain rounded" />
              : <video src={b.url} controls className="w-full max-h-40 rounded bg-black" />)}
            <div className="flex gap-2">
              <label className="px-2 py-1 rounded border border-[#E8E8E8] text-[11px] cursor-pointer shrink-0">
                {subiendo === b.id ? 'Subiendo…' : (b.url ? 'Cambiar' : (b.tipo === 'foto' ? 'Subir foto' : 'Subir video'))}
                <input type="file" accept={b.tipo === 'foto' ? 'image/*' : 'video/*'} className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirA(b.id, f); e.target.value = ''; }} />
              </label>
              <input value={b.url ?? ''} onChange={e => editar(b.id, { url: e.target.value })}
                placeholder="o pega un enlace" className="flex-1 min-w-0 text-[11px] border border-[#E8E8E8] rounded px-2" />
            </div>
          </div>
        );
      }
      if (b.tipo === 'texto') {
        return (
          <div className="space-y-2 pt-3" onClick={e => e.stopPropagation()}>
            <input value={b.titulo ?? ''} onChange={e => editar(b.id, { titulo: e.target.value })}
              placeholder="Título (opcional)" className="w-full text-sm font-bold border border-[#E8E8E8] rounded px-2 py-1" />
            <textarea value={b.cuerpo ?? ''} onChange={e => editar(b.id, { cuerpo: e.target.value })}
              rows={3} placeholder="Escribe el texto…" className="w-full text-sm border border-[#E8E8E8] rounded px-2 py-1" />
            <label className="flex items-center gap-2 text-[11px] text-[#6B6B6B]">
              <input type="checkbox" checked={!!b.centrado} onChange={e => editar(b.id, { centrado: e.target.checked })} /> Centrar
            </label>
          </div>
        );
      }
      return (
        <div className="space-y-2 pt-3" onClick={e => e.stopPropagation()}>
          <input value={b.texto ?? ''} onChange={e => editar(b.id, { texto: e.target.value })}
            placeholder="Texto del botón" className="w-full text-sm border border-[#E8E8E8] rounded px-2 py-1" />
          <select value={b.accion ?? 'comprar'} onChange={e => editar(b.id, { accion: e.target.value as ('comprar' | 'url') })}
            className="w-full text-sm border border-[#E8E8E8] rounded px-2 py-1">
            <option value="comprar">Ir a comprar (pedido)</option>
            <option value="url">Abrir un enlace</option>
          </select>
          {b.accion === 'url' && (
            <input value={b.url ?? ''} onChange={e => editar(b.id, { url: e.target.value })}
              placeholder="https://…" className="w-full text-sm border border-[#E8E8E8] rounded px-2 py-1" />
          )}
        </div>
      );
    }
    // Vista (no seleccionado)
    if (b.tipo === 'foto') return b.url
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={b.url} alt="" className="w-full max-h-40 object-contain rounded" />
      : <Vacio icono="📷" label="Foto — toca para subir" />;
    if (b.tipo === 'video') return b.url
      ? <video src={b.url} className="w-full max-h-40 rounded bg-black" />
      : <Vacio icono="🎬" label="Video — toca para subir" />;
    if (b.tipo === 'texto') return (
      <div className={b.centrado ? 'text-center' : ''}>
        {b.titulo && <div className="font-bold text-sm">{b.titulo}</div>}
        <div className="text-sm whitespace-pre-line text-[#3A3A3A]">{b.cuerpo || 'Texto…'}</div>
      </div>
    );
    return <div className="bg-[#00A89D] text-white text-center font-bold rounded-full py-2 text-sm">{b.texto || 'COMPRAR'}</div>;
  }
}

function Vacio({ icono, label }: { icono: string; label: string }) {
  return <div className="flex items-center justify-center gap-2 h-16 text-xs text-[#9A9A9A] bg-[#F5F5F5] rounded">{icono} {label}</div>;
}

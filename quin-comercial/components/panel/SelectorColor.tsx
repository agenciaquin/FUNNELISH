'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Selector de color PRO y reutilizable (se usa en todos los bloques del embudo).
 * · Muestra una muestra del color; al tocarla abre una paleta.
 * · Paleta con colores listos + campo HEX + rueda de color (personalizado).
 * · Opcional "Sin color" (transparente) cuando `permitirVacio`.
 * El popover va en posición FIJA (no se corta dentro de paneles con scroll).
 */

// Paleta curada (marca + neutros + vivos). Se puede ampliar sin tocar el resto.
const PRESETS: string[] = [
  '#FFFFFF', '#F5F5F5', '#CFCFCF', '#8A8A8A', '#4A4A4A', '#0D0D0D',
  '#00A89D', '#00847A', '#0D8A3E', '#1E9E5A', '#1B4FA0', '#4C6EF5',
  '#C1121F', '#E5484D', '#F26A21', '#F5C518', '#FFB300', '#8A6D00',
  '#6B3FA0', '#B9A3E3', '#F2A0BC', '#6B4423', '#FFF3CD', '#E9F7F5',
];

const POP_W = 200;
const POP_H = 210;
const esHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s.trim());

export default function SelectorColor({
  value, onChange, permitirVacio, titulo, className,
}: {
  value?: string | null;
  onChange: (color: string) => void;
  permitirVacio?: boolean;
  titulo?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value || '');
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setHex(value || ''); }, [value]);

  // Calcula la posición fija del popover pegado a la muestra, sin salirse de la pantalla.
  const reposicionar = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const margen = 8;
    let top = r.bottom + 6;
    if (top + POP_H > window.innerHeight - margen) top = Math.max(margen, r.top - POP_H - 6);
    let left = r.left;
    if (left + POP_W > window.innerWidth - margen) left = Math.max(margen, window.innerWidth - POP_W - margen);
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposicionar();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onMove = () => reposicionar();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, reposicionar]);

  const actual = value || '';
  const aplicar = (c: string) => { onChange(c); setHex(c); };
  const cerrar = () => { setOpen(false); setHex(value || ''); };

  return (
    <div className={`inline-block ${className ?? ''}`}>
      {/* Muestra del color actual */}
      <button ref={btnRef} type="button" onClick={() => (open ? cerrar() : setOpen(true))} title={titulo || 'Elegir color'}
        className="flex items-center gap-1 rounded-lg border border-[#E8E8E8] bg-white px-1.5 py-1 hover:border-[#00A89D]/50">
        <span className="w-6 h-6 rounded-md border border-black/10 shrink-0"
          style={actual
            ? { background: actual }
            : { backgroundImage: 'linear-gradient(45deg,#ddd 25%,transparent 25%,transparent 75%,#ddd 75%),linear-gradient(45deg,#ddd 25%,#fff 25%,#fff 75%,#ddd 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0,4px 4px' }} />
        <span className="text-[9px] text-[#9A9A9A] leading-none">▾</span>
      </button>

      {open && pos && (
        <div ref={popRef} className="fixed z-[80] bg-white border border-[#E8E8E8] rounded-xl shadow-xl p-2.5" style={{ top: pos.top, left: pos.left, width: POP_W }}>
          {titulo && <p className="text-[10px] font-bold text-[#6B6B6B] mb-1.5">{titulo}</p>}
          {/* Colores listos */}
          <div className="grid grid-cols-6 gap-1.5">
            {PRESETS.map(c => {
              const sel = actual.toLowerCase() === c.toLowerCase();
              return (
                <button key={c} type="button" onClick={() => aplicar(c)} title={c}
                  className={`w-6 h-6 rounded-md border transition-transform hover:scale-110 ${sel ? 'ring-2 ring-[#00A89D] ring-offset-1' : 'border-black/10'}`}
                  style={{ background: c }} />
              );
            })}
          </div>

          {/* HEX + rueda personalizada */}
          <div className="flex items-center gap-1.5 mt-2.5">
            <div className="flex items-center gap-1 flex-1 border border-[#E8E8E8] rounded-lg px-1.5 py-1">
              <span className="text-[11px] text-[#9A9A9A]">#</span>
              <input value={hex.replace(/^#/, '')} maxLength={6}
                onChange={e => { const v = '#' + e.target.value.replace(/[^0-9a-fA-F]/g, ''); setHex(v); if (esHex(v)) onChange(v); }}
                placeholder="RRGGBB"
                className="w-full text-[12px] font-mono outline-none uppercase" />
            </div>
            <label className="relative w-8 h-8 rounded-lg border border-[#E8E8E8] overflow-hidden cursor-pointer shrink-0" title="Rueda de color">
              <span className="absolute inset-0 grid place-items-center text-[14px] pointer-events-none">🎨</span>
              <input type="color" value={esHex(actual) ? actual : '#00A89D'} onChange={e => aplicar(e.target.value)}
                className="absolute -inset-2 w-[150%] h-[150%] cursor-pointer opacity-0" />
            </label>
          </div>

          <div className="flex gap-1.5 mt-2">
            {permitirVacio && (
              <button type="button" onClick={() => { onChange(''); setHex(''); }}
                className="flex-1 text-[11px] font-semibold text-[#6B6B6B] border border-[#E8E8E8] rounded-lg py-1 hover:bg-[#F5F5F5]">Sin color</button>
            )}
            <button type="button" onClick={cerrar}
              className="flex-1 text-[11px] font-bold text-white bg-[#00A89D] rounded-lg py-1 hover:bg-[#00847A]">Listo</button>
          </div>
        </div>
      )}
    </div>
  );
}

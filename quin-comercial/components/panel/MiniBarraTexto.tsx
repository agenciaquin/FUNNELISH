'use client';

import { useState } from 'react';
import { FONTS_LISTA } from '@/lib/bloque-estilo';
import SelectorColor from './SelectorColor';

/**
 * Mini-barra de estilo de texto: 🔤 Fuente · ● Color · 🅰 Tamaño · 😊 Emoji.
 * Cada chip abre un pop pequeño. Se usa en texto libre, etiqueta de botón, etc.
 */
const EMOJIS = ['🔥', '✅', '🚚', '💰', '⭐', '🎁', '👌', '😊', '❤️', '🙌', '⚡', '🛒', '💥', '🏆', '📦', '👇'];

export default function MiniBarraTexto({
  font, color, size, onFont, onColor, onSize, onEmoji,
  sizeMin = 12, sizeMax = 40, colorDefault = '#0D0D0D',
}: {
  font?: string; color?: string; size?: number;
  onFont: (v: string) => void; onColor: (v: string) => void; onSize: (v: number) => void; onEmoji?: (e: string) => void;
  sizeMin?: number; sizeMax?: number; colorDefault?: string;
}) {
  const [open, setOpen] = useState<null | 'font' | 'color' | 'size' | 'emoji'>(null);
  const tog = (k: typeof open) => setOpen(o => (o === k ? null : k));
  const chip = 'flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold bg-white';
  const on = (k: typeof open) => open === k ? { borderColor: '#00A89D', color: '#00847A' } : { borderColor: '#E8E8E8' };

  return (
    <div className="rounded-lg border border-[#E8E8E8] bg-[#FCFBF8] p-1.5">
      <div className="flex gap-1.5 flex-wrap">
        <button type="button" className={chip} style={on('font')} onClick={() => tog('font')}>🔤 Fuente</button>
        <button type="button" className={chip} style={on('color')} onClick={() => tog('color')}>
          <span className="w-3 h-3 rounded-full border border-[#ccc]" style={{ background: color || colorDefault }} /> Color
        </button>
        <button type="button" className={chip} style={on('size')} onClick={() => tog('size')}>🅰 Tamaño</button>
        {onEmoji && <button type="button" className={chip} style={on('emoji')} onClick={() => tog('emoji')}>😊 Emoji</button>}
      </div>

      {open === 'font' && (
        <div className="flex gap-1 flex-wrap mt-1.5">
          {FONTS_LISTA.map(f => (
            <button key={f.key} type="button" onClick={() => { onFont(f.key); setOpen(null); }}
              className="px-2 py-1 rounded-lg border text-[11px] font-semibold"
              style={font === f.key ? { borderColor: '#00A89D', background: '#E9F7F5', color: '#00847A' } : { borderColor: '#E8E8E8', background: '#fff' }}>
              {f.label}
            </button>
          ))}
        </div>
      )}
      {open === 'color' && (
        <div className="flex items-center gap-2 mt-1.5">
          <SelectorColor value={color || colorDefault} onChange={v => onColor(v)} titulo="Color del texto" />
          <span className="text-[11px] text-[#6B6B6B] font-mono">{color || colorDefault}</span>
          <button type="button" onClick={() => onColor('')} className="text-[11px] text-[#00847A] font-semibold ml-auto">Por defecto</button>
        </div>
      )}
      {open === 'size' && (
        <div className="flex items-center gap-2 mt-1.5">
          <input type="range" min={sizeMin} max={sizeMax} value={size || Math.round((sizeMin + sizeMax) / 2)} onChange={e => onSize(Number(e.target.value))} className="flex-1 accent-[#00A89D]" />
          <span className="text-[11px] text-[#6B6B6B] w-10 text-right">{size || '—'}px</span>
          <button type="button" onClick={() => onSize(0)} className="text-[11px] text-[#00847A] font-semibold">Auto</button>
        </div>
      )}
      {open === 'emoji' && onEmoji && (
        <div className="flex gap-1 flex-wrap mt-1.5">
          {EMOJIS.map(e => (
            <button key={e} type="button" onClick={() => onEmoji(e)} className="w-7 h-7 rounded-lg border border-[#E8E8E8] bg-white text-base hover:bg-[#F5F5F5]">{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

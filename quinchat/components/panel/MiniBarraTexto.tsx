'use client';

import { useState } from 'react';
import { FUENTES, PALETA_COLORES } from '@/lib/bloques';

const EMOJIS = ['🔥', '✅', '⭐', '🚚', '💰', '🎁', '⚡', '👉', '❤️', '😍', '🏆', '⏰', '🛒', '💳', '📦', '🤩', '💥', '✨', '👑', '🥇'];

/**
 * Mini-barra estética que se pone ENCIMA de cualquier campo de texto del editor:
 * Fuente · Color · Tamaño · Emoji. Cada botón abre un pop pequeño y edita la
 * prop correspondiente del bloque. Se muestra solo lo que reciba (keys opcionales).
 */
export default function MiniBarraTexto({
  p, setProp, fontKey, colorKey, sizeKey, textKey,
  sizeMin = 12, sizeMax = 40, colorDefault = '#0D0D0D',
}: {
  p: Record<string, any>;
  setProp: (k: string, v: any) => void;
  fontKey?: string; colorKey?: string; sizeKey?: string; textKey?: string;
  sizeMin?: number; sizeMax?: number; colorDefault?: string;
}) {
  const [abierto, setAbierto] = useState<null | 'fuente' | 'color' | 'tamano' | 'emoji'>(null);
  const toggle = (k: typeof abierto) => setAbierto(a => (a === k ? null : k));

  const chip = 'flex items-center gap-1 rounded-full border border-[#E0E0E0] bg-white px-2 py-[3px] text-[10px] font-bold text-[#4B4B4B] hover:border-[#00A89D] hover:text-[#00847A] transition-colors';
  const pop = 'absolute z-30 top-[26px] left-0 rounded-xl border border-[#E8E8E8] bg-white shadow-xl p-2';

  const size = Number(p[sizeKey || '']) || Math.round((sizeMin + sizeMax) / 2);

  return (
    <div className="relative flex flex-wrap items-center gap-1 mb-1">
      {fontKey && (
        <button type="button" onClick={() => toggle('fuente')} className={chip}>🔤 Fuente ▾</button>
      )}
      {colorKey && (
        <button type="button" onClick={() => toggle('color')} className={chip}>
          <span className="w-3 h-3 rounded-full border border-[#ccc]" style={{ background: p[colorKey] || colorDefault }} /> Color ▾
        </button>
      )}
      {sizeKey && (
        <button type="button" onClick={() => toggle('tamano')} className={chip}>🅰 Tamaño ▾</button>
      )}
      {textKey && (
        <button type="button" onClick={() => toggle('emoji')} className={chip}>😊 Emoji ▾</button>
      )}

      {abierto === 'fuente' && fontKey && (
        <div className={`${pop} w-48`}>
          {FUENTES.map(f => (
            <button key={f.nombre} type="button"
              onClick={() => { setProp(fontKey, f.css); setAbierto(null); }}
              className={`block w-full text-left px-2 py-1.5 rounded-lg text-[12px] hover:bg-[#F3FBF9] ${(p[fontKey] || '') === f.css ? 'bg-[#00A89D]/10 text-[#00847A] font-bold' : ''}`}
              style={{ fontFamily: f.css || undefined }}>{f.nombre}</button>
          ))}
        </div>
      )}

      {abierto === 'color' && colorKey && (
        <div className={`${pop} w-[188px]`}>
          <div className="flex flex-wrap gap-1.5 items-center">
            {PALETA_COLORES.map(c => (
              <button key={c} type="button" title={c} onClick={() => { setProp(colorKey, c); }}
                className={`w-6 h-6 rounded-full border-2 ${(p[colorKey] || colorDefault) === c ? 'border-[#00A89D] scale-110' : 'border-white'} shadow`}
                style={{ background: c }} />
            ))}
            <input type="color" value={p[colorKey] || colorDefault} onChange={e => setProp(colorKey, e.target.value)}
              className="w-7 h-7 rounded-full border-0 bg-transparent p-0 cursor-pointer" />
          </div>
        </div>
      )}

      {abierto === 'tamano' && sizeKey && (
        <div className={`${pop} w-52`}>
          <label className="block text-[10px] font-bold text-[#0D0D0D] mb-1 uppercase">Tamaño: {size}px</label>
          <input type="range" min={sizeMin} max={sizeMax} value={size}
            onChange={e => setProp(sizeKey, Number(e.target.value))} className="w-full accent-[#00A89D]" />
        </div>
      )}

      {abierto === 'emoji' && textKey && (
        <div className={`${pop} w-[212px]`}>
          <div className="grid grid-cols-8 gap-1">
            {EMOJIS.map(e => (
              <button key={e} type="button" onClick={() => setProp(textKey, String(p[textKey] ?? '') + e)}
                className="w-6 h-6 rounded hover:bg-[#F3FBF9] text-base leading-none">{e}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

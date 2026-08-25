// Estilos por bloque (fuente/color/tamaño y espacios arriba/abajo).
// Lo leen IGUAL la página pública y la vista previa del editor, así se ven idénticos.
// Todo es opcional: un bloque sin `props` se comporta como antes (retrocompatible).
import type { CSSProperties } from 'react';

/** Familias de letra disponibles (stacks seguros, sin cargar fuentes externas). */
export const FONTS: Record<string, string> = {
  sans:   'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif:  'Georgia, "Times New Roman", serif',
  round:  '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
  mono:   '"Courier New", monospace',
  narrow: '"Arial Narrow", "Helvetica Neue", Arial, sans-serif',
};
export const FONTS_LISTA: { key: string; label: string }[] = [
  { key: 'sans', label: 'Normal' },
  { key: 'round', label: 'Redondeada' },
  { key: 'serif', label: 'Elegante' },
  { key: 'narrow', label: 'Angosta' },
  { key: 'mono', label: 'Máquina' },
];

/** Estilo de texto de un bloque, leyendo props.{font,color,size} con defaults. */
export function estiloTexto(props?: Record<string, any> | null, def: { color?: string; size?: number } = {}): CSSProperties {
  const p = props || {};
  const s: CSSProperties = {};
  if (p.font && FONTS[p.font]) s.fontFamily = FONTS[p.font];
  if (p.color) s.color = p.color; else if (def.color) s.color = def.color;
  const size = Number(p.size);
  if (size > 0) s.fontSize = `${size}px`; else if (def.size) s.fontSize = `${def.size}px`;
  return s;
}

/** Animaciones de bloque disponibles (se aplican con claseAnim). */
export const ANIMACIONES: { key: string; label: string }[] = [
  { key: '', label: 'Ninguna' },
  { key: 'aparece', label: 'Aparece (sube)' },
  { key: 'desliza', label: 'Desliza (entra de lado)' },
  { key: 'zoom', label: 'Zoom (acerca)' },
  { key: 'palpita', label: 'Palpita (llama la atención)' },
  { key: 'rebota', label: 'Rebota' },
];
/** Clase CSS de la animación elegida (o '' si ninguna). */
export function claseAnim(anim?: string): string {
  const a = (anim ?? '').trim();
  return a && ANIMACIONES.some(x => x.key === a) ? `blk-${a}` : '';
}

/** Formas de botón disponibles (para el bloque Botón y los CTA de otros bloques). */
export const VARIANTES_BOTON: { key: string; label: string }[] = [
  { key: 'pill', label: 'Redonda' },
  { key: 'redondeado', label: 'Redondeado' },
  { key: 'cuadrado', label: 'Recto' },
  { key: 'borde', label: 'Solo borde' },
  { key: 'sombra', label: 'Con sombra' },
  { key: 'degradado', label: 'Degradado' },
];

/** Aclara un color HEX un % (0-1) para el degradado. Tolerante a formatos raros. */
function aclararHex(hex: string, factor = 0.35): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return hex || '#00A89D';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mez = (c: number) => Math.round(c + (255 - c) * factor);
  return `#${((mez(r) << 16) | (mez(g) << 8) | mez(b)).toString(16).padStart(6, '0')}`;
}

/**
 * Clase + estilo de un botón según su FORMA (variante) y color base.
 * Lo usan igual la página pública y la vista previa, así se ven idénticos.
 */
export function botonVariante(variante?: string, bg?: string): { className: string; style: CSSProperties } {
  const color = bg || '#00A89D';
  const base = 'text-center font-extrabold transition-all';
  switch (variante) {
    case 'cuadrado':
      return { className: `${base} rounded-lg text-white`, style: { background: color } };
    case 'redondeado':
      return { className: `${base} rounded-2xl text-white`, style: { background: color } };
    case 'borde':
      return { className: `${base} rounded-full bg-transparent`, style: { border: `2.5px solid ${color}`, color } };
    case 'sombra':
      return { className: `${base} rounded-full text-white`, style: { background: color, boxShadow: `0 12px 26px -8px ${color}` } };
    case 'degradado':
      return { className: `${base} rounded-full text-white`, style: { backgroundImage: `linear-gradient(135deg, ${color}, ${aclararHex(color)})` } };
    case 'pill':
    default:
      return { className: `${base} rounded-full text-white`, style: { background: color } };
  }
}

/** Espacio arriba/abajo del bloque (acepta negativos para juntar bloques). */
export function estiloEspacio(props?: Record<string, any> | null): CSSProperties {
  const p = props || {};
  const s: CSSProperties = {};
  if (typeof p.mt === 'number') s.marginTop = p.mt;
  if (typeof p.mb === 'number') s.marginBottom = p.mb;
  return s;
}

/** True si el bloque define algún espacio (para decidir si hace falta envolver). */
export function tieneEspacio(props?: Record<string, any> | null): boolean {
  const p = props || {};
  return typeof p.mt === 'number' || typeof p.mb === 'number';
}

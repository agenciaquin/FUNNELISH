'use client';

/**
 * Botón "MÁS VENDIDO". Al tocarlo hace scroll al checkout (#checkout) y avisa
 * qué modelo preseleccionar (evento quin:mas-vendido). Es un bloque más del
 * editor; su estilo vive en `props`. No renderiza insignia flotante.
 */
export default function BotonMasVendido({ props = {} }: { props?: any }) {
  const p = props || {};
  const texto = p.texto || 'EL MÁS VENDIDO';
  const emoji = p.emoji ?? '🔥';
  const color = p.color || '#C1121F';
  const colorTexto = p.colorTexto || '#FFFFFF';
  const size = p.size || 'md';
  const modelo = p.modelo || '';
  const py = size === 'lg' ? 'py-4 text-xl' : size === 'sm' ? 'py-2.5 text-base' : 'py-3.5 text-lg';

  function ir() {
    try { window.dispatchEvent(new CustomEvent('quin:mas-vendido', { detail: { modelo } })); } catch { /* ignora */ }
    const el = document.getElementById('checkout');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Modo FLOTANTE: insignia fija palpitante en una esquina (no ocupa el flujo).
  if (p.flotante) {
    const pos = p.posicion || 'bottom-right';
    const esq =
      pos === 'bottom-left' ? 'bottom-4 left-3' :
      pos === 'top-right' ? 'top-4 right-3' :
      pos === 'top-left' ? 'top-4 left-3' :
      pos === 'bottom-center' ? 'bottom-4 left-1/2 -translate-x-1/2' :
      'bottom-4 right-3';
    const pyF = size === 'lg' ? 'py-3 px-5 text-base' : size === 'sm' ? 'py-2 px-3.5 text-xs' : 'py-2.5 px-4 text-sm';
    return (
      <button onClick={ir} style={{ background: color, color: colorTexto }}
        className={`fixed ${esq} z-40 rounded-full font-extrabold ${pyF} shadow-xl animate-pulse hover:opacity-90`}>
        {emoji} {texto}
      </button>
    );
  }

  return (
    <div className="px-3 my-3">
      <button
        onClick={ir}
        style={{ background: color, color: colorTexto }}
        className={`w-full rounded-full font-extrabold ${py} shadow-lg hover:opacity-90 transition-opacity`}
      >
        {emoji} {texto}
      </button>
    </div>
  );
}

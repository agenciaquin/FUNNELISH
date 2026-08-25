'use client';

/**
 * Sello flotante "MÁS VENDIDO" (clickeable). Al tocarlo:
 *   1) baja suavemente al checkout (#checkout)
 *   2) avisa al checkout qué modelo dejar preseleccionado (evento quin:mas-vendido)
 * El modelo estrella lo define el admin en el bloque (prop `modelo`).
 */
export default function MasVendidoFlotante({
  texto = 'MÁS VENDIDO', emoji = '🔥', color = '#C1121F', colorTexto = '#FFFFFF',
  modelo = '', posicion = 'arriba', size = 14,
}: {
  texto?: string; emoji?: string; color?: string; colorTexto?: string;
  modelo?: string; posicion?: string; size?: number;
}) {
  const pos =
    posicion === 'centro' ? { top: '45%' } :
    posicion === 'abajo' ? { bottom: '86px' } :
    { top: '12%' };

  const ir = () => {
    if (modelo) {
      window.dispatchEvent(new CustomEvent('quin:mas-vendido', { detail: { modelo } }));
    }
    const el = document.getElementById('checkout');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else document.getElementById('checkout-pro')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <button
      onClick={ir}
      className="mv-palpita fixed left-1/2 z-40 flex items-center gap-1 rounded-full font-extrabold shadow-xl border-2 border-white whitespace-nowrap px-4 py-2 active:scale-95"
      style={{ ...pos, transform: 'translateX(-50%)', background: color, color: colorTexto, fontSize: size }}
    >
      {emoji} {(texto || 'MÁS VENDIDO').toUpperCase()}
      <style>{`
        @keyframes mvPalpita { 0%,100%{ transform: translateX(-50%) scale(1);} 50%{ transform: translateX(-50%) scale(1.08);} }
        .mv-palpita { animation: mvPalpita 1s ease-in-out infinite; }
      `}</style>
    </button>
  );
}

'use client';

import { registrarPaso } from './FunnelTracker';

/**
 * Botón COMPRAR para embudos de UNA sola pantalla: en vez de ir a /pedido,
 * baja suavemente hasta el bloque de checkout (id="checkout") en la misma página.
 * Registra el paso 'pedido' del embudo al tocarlo.
 */
export default function BotonBajarCheckout({ slug, color }: { slug: string; color: string }) {
  const bajar = () => {
    registrarPaso(slug, 'pedido');
    const el = document.getElementById('checkout');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <button
      onClick={bajar}
      style={{ background: color }}
      className="boton-compra relative overflow-hidden block w-[calc(100%-1.5rem)] mx-3 my-4 rounded-full hover:opacity-90 text-white text-center font-extrabold text-xl leading-tight py-4 transition-opacity"
    >
      COMPRAR<br />
      <span className="text-lg">CONTRA ENTREGA →</span>
    </button>
  );
}

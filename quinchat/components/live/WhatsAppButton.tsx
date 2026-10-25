'use client';

import type { ProductoLive, Seleccion } from '@/lib/live/tipos';
import { track } from '@/lib/live/track';

/** Mensaje prellenado. Si no hay talla o color elegidos, se envía igual sin esos datos. */
export function mensajeWhatsApp(producto: ProductoLive | null, sel?: Seleccion): string {
  const base = 'Hola 👋 Vengo de QUIN LIVE SHOPPING.';
  if (!producto) return `${base} ¿Me ayudas con el pedido?`;
  const propia = sel && sel.productoId === producto.id ? sel : undefined;
  const color = propia?.colorId ? producto.colores.find(c => c.id === propia.colorId)?.nombre : undefined;
  const partes = [producto.nombre, propia?.talla && `Talla ${propia.talla}`, color && `Color ${color}`].filter(Boolean);
  return `${base} Me interesa: ${partes.join(' – ')}. ¿Me ayudas con el pedido?`;
}

export function urlWhatsApp(numero: string, mensaje: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

interface Props {
  numero: string;
  producto: ProductoLive | null;
  seleccion?: Seleccion;
  className?: string;
}

const ICONO_WA = 'M12 2C6.48 2 2 6.48 2 12c0 1.77.46 3.42 1.27 4.86L2 22l5.25-1.38A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.58 0-3.05-.46-4.29-1.25l-.3-.18-3.12.82.83-3.04-.2-.31A7.93 7.93 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8zm4.5-5.6c-.25-.12-1.47-.72-1.7-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.38-1.73-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.42l-.48-.01c-.16 0-.42.06-.64.31-.22.25-.85.83-.85 2.02s.87 2.35 1 2.51c.12.17 1.7 2.6 4.13 3.65.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.28z';

/** Botón flotante de WhatsApp (círculo verde grande, abajo a la derecha). */
export default function WhatsAppButton({ numero, producto, seleccion, className = '' }: Props) {
  const mensaje = mensajeWhatsApp(producto, seleccion);
  return (
    <a
      href={urlWhatsApp(numero, mensaje)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Comprar por WhatsApp"
      onClick={() => track('buy_whatsapp_click', { productoId: producto?.id, talla: seleccion?.talla, colorId: seleccion?.colorId })}
      className={`pointer-events-auto flex flex-col items-center gap-0.5 active:scale-95 transition-transform ${className}`}
    >
      <span className="w-16 h-16 rounded-full bg-[#25D366] flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,.45)]">
        <svg viewBox="0 0 24 24" width="38" height="38" fill="#fff" aria-hidden><path d={ICONO_WA} /></svg>
      </span>
      <span className="text-[12px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.85)]">WhatsApp</span>
    </a>
  );
}

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

export default function WhatsAppButton({ numero, producto, seleccion, className = '' }: Props) {
  const mensaje = mensajeWhatsApp(producto, seleccion);
  return (
    <a
      href={urlWhatsApp(numero, mensaje)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('buy_whatsapp_click', { productoId: producto?.id, talla: seleccion?.talla, colorId: seleccion?.colorId })}
      className={`pointer-events-auto flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-black font-bold text-[13px] h-11 px-3 active:scale-95 transition-transform ${className}`}
    >
      <span aria-hidden>💬</span> Comprar por WhatsApp
    </a>
  );
}

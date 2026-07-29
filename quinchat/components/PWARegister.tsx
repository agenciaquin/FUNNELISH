'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker que hace instalable la app (PWA)
 * y permite recibir notificaciones push.
 * No pinta nada en pantalla.
 */
export default function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Las páginas de venta NO son una app instalable: al cliente no se le
    // debe ofrecer "descargar QuinChat". Solo el panel del equipo lo hace.
    const host = window.location.hostname.toLowerCase();
    const ruta = window.location.pathname;
    const esTienda =
      host.startsWith('pedido.') || ruta.startsWith('/p/') || ruta === '/tienda';
    if (esTienda) return;

    const registrar = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((e) => console.warn('[PWA] no se pudo registrar el service worker:', e));
    };

    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar);

    return () => window.removeEventListener('load', registrar);
  }, []);

  return null;
}

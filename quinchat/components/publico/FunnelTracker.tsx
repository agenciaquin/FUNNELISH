'use client';

import { useEffect } from 'react';

/** Envía un evento del embudo, una sola vez por sesión y paso. No pinta nada.
 *  Se usa para pasos que dependen de una interacción del cliente (scroll, elegir
 *  talla, escribir datos, tocar el botón). Los pasos de "carga de página"
 *  (landing/pedido/compra) se registran en el SERVIDOR (más confiable). */
export function registrarPaso(slug: string, paso: string) {
  if (!slug) return;
  const clave = `fev:${slug}:${paso}`;
  try {
    if (sessionStorage.getItem(clave)) return; // ya se contó en esta sesión
    sessionStorage.setItem(clave, '1');
  } catch { /* sin sessionStorage: igual registra */ }

  const qs = new URLSearchParams(window.location.search);
  const cuerpo = {
    slug, paso,
    utm_source: qs.get('utm_source') ?? undefined,
    utm_medium: qs.get('utm_medium') ?? undefined,
    utm_campaign: qs.get('utm_campaign') ?? undefined,
    referrer: document.referrer || undefined,
  };
  try {
    fetch('/api/funnels/evento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      keepalive: true,
    }).catch(() => {});
  } catch { /* silencioso */ }
}

// Detecta cuándo el cliente baja hasta el final de la página de venta (vio el
// collage / todo) y registra 'scroll_fin'. El 'landing' lo hace el servidor.
export default function FunnelTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;
    // 'landing' se cuenta desde el navegador: una vez por sesión y solo humanos
    // (los rastreadores de FB/TikTok/WhatsApp y las recargas no ejecutan JS).
    registrarPaso(slug, 'landing');
    let disparado = false;
    const alBajar = () => {
      if (disparado) return;
      const cerca = window.innerHeight + window.scrollY >= document.body.offsetHeight - 250;
      if (cerca) {
        disparado = true;
        registrarPaso(slug, 'scroll_fin');
        window.removeEventListener('scroll', alBajar);
      }
    };
    window.addEventListener('scroll', alBajar, { passive: true });
    alBajar();
    return () => window.removeEventListener('scroll', alBajar);
  }, [slug]);

  return null;
}

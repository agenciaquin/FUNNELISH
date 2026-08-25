'use client';

import { useEffect } from 'react';

/** Envía un evento del embudo, una sola vez por sesión y paso. No pinta nada. */
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

// Registra el paso al montar. En la landing, además detecta cuando el cliente
// baja hasta el final de la página (vio el collage / todo el contenido).
export default function FunnelTracker({ slug, paso }: { slug: string; paso: 'landing' | 'pedido' | 'compra' }) {
  useEffect(() => {
    registrarPaso(slug, paso);
    if (paso !== 'landing') return;

    // ¿Llegó al final de la página de venta? (últimos ~250px del documento)
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
    alBajar(); // por si la página es corta y ya se ve el final
    return () => window.removeEventListener('scroll', alBajar);
  }, [slug, paso]);

  return null;
}

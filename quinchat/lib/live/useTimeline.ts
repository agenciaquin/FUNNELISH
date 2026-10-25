'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EventoComentario, EventoLinea, EventoPregunta, EventoProducto, LineaDeTiempo } from './tipos';

export interface EstadoLinea {
  cargada: boolean;
  /** Producto destacado en este instante (o null). */
  producto: EventoProducto | null;
  /** Preguntas frecuentes y comentarios visibles ahora, del más viejo al más nuevo. */
  mensajes: Array<EventoPregunta | EventoComentario>;
}

const MAX_MENSAJES = 4;
const activo = (e: EventoLinea, t: number) => t >= e.inicio && t < e.fin;

/**
 * Lee el JSON de la línea de tiempo (archivo separado del video) y, dado el
 * segundo actual del video, devuelve qué debe mostrar el overlay.
 * El overlay NO conoce el video: solo recibe un número (currentTime).
 */
export function useTimeline(url: string, tiempo: number): EstadoLinea {
  const [linea, setLinea] = useState<LineaDeTiempo | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(url, { cache: 'force-cache' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: LineaDeTiempo) => { if (!cancelado) setLinea(j); })
      .catch(err => console.warn('[QUIN LIVE] No se pudo cargar la línea de tiempo', err));
    return () => { cancelado = true; };
  }, [url]);

  // Resolución de medio segundo: evita recalcular en cada timeupdate
  const t = Math.floor(tiempo * 2) / 2;

  return useMemo<EstadoLinea>(() => {
    if (!linea) return { cargada: false, producto: null, mensajes: [] };
    const act = linea.eventos.filter(e => activo(e, t));
    const producto = (act.find(e => e.tipo === 'producto') as EventoProducto | undefined) ?? null;
    const mensajes = act
      .filter((e): e is EventoPregunta | EventoComentario => e.tipo !== 'producto')
      .sort((a, b) => a.inicio - b.inicio)
      .slice(-MAX_MENSAJES);
    return { cargada: true, producto, mensajes };
  }, [linea, t]);
}

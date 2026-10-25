'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LiveConfig, ProductoLive, Seleccion } from '@/lib/live/tipos';
import { useTimeline } from '@/lib/live/useTimeline';
import { track } from '@/lib/live/track';
import { etiquetaValida, leerEtiqueta } from '@/lib/live/etiqueta';
import VideoBackground, { type VideoHandle } from './VideoBackground';
import LiveOverlay from './LiveOverlay';
import BuySheet from './BuySheet';
import type { ComentarioPropio } from './CommentsFeed';
import { ESTILOS_LIVE } from './estilos';

/**
 * Orquesta las dos capas. Video y overlay solo se comunican por:
 *   · el número `tiempo` (currentTime) → useTimeline → qué mostrar
 *   · unas pocas acciones (silenciar, reproducir)
 * En escritorio muestra la experiencia dentro de un marco de celular.
 */
export default function LiveShell({ live }: { live: LiveConfig }) {
  const router = useRouter();
  const videoRef = useRef<VideoHandle>(null);
  const [tiempo, setTiempo] = useState(0);
  const [silenciado, setSilenciado] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);
  const [seleccion, setSeleccion] = useState<Seleccion>({ productoId: '' });
  const [sheet, setSheet] = useState<ProductoLive | null>(null);
  const [etiqueta, setEtiqueta] = useState(() => etiquetaValida(live.etiquetaGrabada));
  useEffect(() => { setEtiqueta(leerEtiqueta(live.slug, live.etiquetaGrabada)); }, [live.slug, live.etiquetaGrabada]);
  const [propios, setPropios] = useState<ComentarioPropio[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const idComentario = useRef(0);
  const temporizadorAviso = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrarAviso = useCallback((txt: string) => {
    setAviso(txt);
    if (temporizadorAviso.current) clearTimeout(temporizadorAviso.current);
    temporizadorAviso.current = setTimeout(() => setAviso(null), 2500);
  }, []);

  // Comentario del propio visitante: solo se ve en su pantalla (MAQUETA: no se envía a ningún servidor)
  const comentar = useCallback((texto: string) => {
    const id = ++idComentario.current;
    setPropios(p => [...p.slice(-2), { id, texto }]);
    setTimeout(() => setPropios(p => p.filter(c => c.id !== id)), 9000);
  }, []);

  const compartir = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: live.titulo, url }); return; }
      await navigator.clipboard.writeText(url);
      mostrarAviso('Enlace copiado');
    } catch { /* el usuario canceló o el navegador no lo permite */ }
  }, [live.titulo, mostrarAviso]);

  // MODO_REPRODUCCION 'sincronizado': aquí se haría seek a posicionSincronizada(...) al cargar. Preparado, no activo.
  const { producto: evProducto, mensajes } = useTimeline(live.timelineUrl, tiempo);
  const producto = evProducto ? live.productos.find(p => p.id === evProducto.contenido.productoId) ?? null : null;

  useEffect(() => { track('live_view', { slug: live.slug, modo: live.modo }); }, [live.slug, live.modo]);
  useEffect(() => { if (producto) track('product_shown', { productoId: producto.id, segundo: Math.floor(tiempo) }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [producto?.id]);

  const alternarSonido = useCallback(() => {
    const nuevo = !silenciado;
    videoRef.current?.setMuted(nuevo);
    setSilenciado(nuevo);
    if (!nuevo) track('sound_on');
  }, [silenciado]);

  const cerrar = () => { if (window.history.length > 1) router.back(); else router.push('/'); };

  return (
    <div className="min-h-[100dvh] bg-neutral-950 md:flex md:items-center md:justify-center">
      <style>{ESTILOS_LIVE}</style>
      <main className="relative w-full h-[100dvh] overflow-hidden bg-black md:w-[390px] md:h-[min(844px,94vh)] md:rounded-[40px] md:border-[10px] md:border-neutral-800 md:shadow-2xl">
        {/* CAPA 1 */}
        <VideoBackground
          src={live.videoUrl}
          poster={live.posterUrl}
          handleRef={videoRef}
          onTiempo={setTiempo}
          onPrimeraReproduccion={() => track('video_play', { slug: live.slug })}
          onAutoplayBloqueado={() => setBloqueado(true)}
          onReproduciendo={r => { if (r) setBloqueado(false); }}
        />
        {/* CAPA 2 */}
        <LiveOverlay
          live={live}
          etiqueta={etiqueta}
          producto={producto}
          mensajes={mensajes}
          seleccion={seleccion}
          silenciado={silenciado}
          bloqueado={bloqueado}
          onSonido={alternarSonido}
          onReproducir={() => videoRef.current?.reproducir().catch(() => {})}
          onCerrar={cerrar}
          onProductoClick={p => { track('product_click', { productoId: p.id }); setSheet(p); }}
          onComprarAqui={p => { track('buy_here_open', { productoId: p.id }); setSheet(p); }}
          propios={propios}
          onComentar={comentar}
          onCompartir={compartir}
        />
        {aviso && <div role="status" className="live-pop absolute left-1/2 -translate-x-1/2 top-24 z-40 rounded-full bg-black/80 px-4 py-2 text-[13px] font-semibold">{aviso}</div>}
        {sheet && (
          <BuySheet live={live} producto={sheet} seleccion={seleccion} onSeleccion={setSeleccion} onCerrar={() => setSheet(null)} />
        )}
      </main>
    </div>
  );
}

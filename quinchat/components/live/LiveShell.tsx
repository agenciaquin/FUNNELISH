'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LiveConfig, ProductoLive, Seleccion } from '@/lib/live/tipos';
import type { Funnel } from '@/lib/funnels';
import FormularioPedido from '@/components/publico/FormularioPedido';
import { useTimeline } from '@/lib/live/useTimeline';
import { track } from '@/lib/live/track';
import { etiquetaValida, leerEtiqueta } from '@/lib/live/etiqueta';
import { MAX_PREGUNTAS_IA, esPregunta, responderPregunta } from '@/lib/live/asistente';
import { mensajeWhatsApp, urlWhatsApp } from './WhatsAppButton';
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
export default function LiveShell({ live, funnel }: { live: LiveConfig; funnel?: Funnel | null }) {
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

  const { producto: evProducto, mensajes } = useTimeline(live.timelineUrl, tiempo);
  const producto = evProducto ? live.productos.find(p => p.id === evProducto.contenido.productoId) ?? null : null;

  // ── CHAT: los comentarios ya NO se borran. Se acumulan (máx. MAX_FEED en pantalla; los
  // más viejos suben y se desvanecen). Los del público se guardan y se repiten (replay)
  // en el mismo segundo del video para quien entre después.
  const MAX_FEED = 14;
  const agregar = useCallback((c: ComentarioPropio) => setPropios(p => [...p, c].slice(-MAX_FEED)), []);
  const preguntasIA = useRef(0);

  // Identidad anónima del visitante (para el límite de comentarios) y su nombre opcional.
  const sesionId = useRef('');
  const [nombre, setNombre] = useState('');
  const [pidiendoNombre, setPidiendoNombre] = useState<string | null>(null); // texto pendiente
  useEffect(() => {
    try {
      let sid = localStorage.getItem('quin_live_sid');
      if (!sid) { sid = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; localStorage.setItem('quin_live_sid', sid); }
      sesionId.current = sid;
      setNombre(localStorage.getItem('quin_live_nombre') ?? '');
    } catch { sesionId.current = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; }
  }, []);

  // Comentarios del público (guardados) + cuáles ya se mostraron en esta vuelta del video.
  const publicos = useRef<{ id: number; nombre: string; texto: string; segundo: number }[]>([]);
  const ultimoId = useRef(0);
  const mostradosPub = useRef(new Set<number>());
  const mostradosTL = useRef(new Set<string>());
  const tiempoPrev = useRef(0);

  const publicar = useCallback(async (texto: string, nombreUsar: string, idLocal: number) => {
    try {
      const r = await fetch(`/api/live/${encodeURIComponent(live.slug)}/comentarios`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, nombre: nombreUsar, segundo: tiempo, sesion_id: sesionId.current }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.comentario?.id) {
        mostradosPub.current.add(Number(j.comentario.id));   // ya está en pantalla como "Tú"
        publicos.current.push({ id: Number(j.comentario.id), nombre: j.comentario.nombre, texto: j.comentario.texto, segundo: Number(j.comentario.segundo) });
        ultimoId.current = Math.max(ultimoId.current, Number(j.comentario.id));
      } else if (r.status === 422 || r.status === 429) {
        // Bloqueado por moderación o por límite: se quita de la pantalla y se explica.
        setPropios(p => p.filter(c => c.id !== idLocal));
        mostrarAviso(j?.error || 'No se pudo publicar tu comentario.');
      }
      // 404 (live de maqueta sin base): se queda solo en tu pantalla.
    } catch { /* sin conexión: se queda solo en tu pantalla */ }
  }, [live.slug, tiempo, mostrarAviso]);

  const comentar = useCallback(async (texto: string) => {
    // Primera vez: pedir nombre (opcional) antes de publicar.
    let n = nombre;
    try { n = n || localStorage.getItem('quin_live_nombre') || ''; } catch { /* */ }
    if (!n && pidiendoNombre === null) {
      try { if (localStorage.getItem('quin_live_nombre_omitido')) n = 'Cliente'; } catch { /* */ }
      if (!n) { setPidiendoNombre(texto); return; }
    }
    const id = ++idComentario.current;
    agregar({ id, texto, autor: 'yo' });
    publicar(texto, n || 'Cliente', id);
    if (!esPregunta(texto)) return;

    const destino = producto ?? live.productos[0];
    if (!destino) return;
    if (preguntasIA.current >= MAX_PREGUNTAS_IA) {
      mostrarAviso('Llegaste al límite de preguntas. Escríbenos por WhatsApp.');
      return;
    }
    preguntasIA.current += 1;
    track('ai_question', { productoId: destino.id });

    const idIA = ++idComentario.current;
    agregar({ id: idIA, texto: '', autor: 'ia', escribiendo: true });
    const r = await responderPregunta(texto, destino);
    const waUrl = r.sinDato ? urlWhatsApp(live.whatsapp, mensajeWhatsApp(destino, seleccion)) : undefined;
    setPropios(p => p.map(c => (c.id === idIA ? { id: idIA, texto: r.texto, autor: 'ia', waUrl } : c)));
    track('ai_answer', { productoId: destino.id, tema: r.tema, sinDato: r.sinDato });
  }, [producto, live.productos, live.whatsapp, seleccion, mostrarAviso, nombre, pidiendoNombre, agregar, publicar]);

  const confirmarNombre = (valor: string | null) => {
    const texto = pidiendoNombre; if (texto === null) return;
    const n = (valor ?? '').trim().slice(0, 24);
    try {
      if (n) localStorage.setItem('quin_live_nombre', n);
      else localStorage.setItem('quin_live_nombre_omitido', '1');
    } catch { /* */ }
    setNombre(n || 'Cliente');
    setPidiendoNombre(null);
    const id = ++idComentario.current;
    agregar({ id, texto, autor: 'yo' });
    publicar(texto, n || 'Cliente', id);
  };

  // Cargar comentarios guardados del live y buscar nuevos cada 8 s.
  useEffect(() => {
    let vivo = true;
    const traer = async (desde: number) => {
      try {
        const r = await fetch(`/api/live/${encodeURIComponent(live.slug)}/comentarios${desde ? `?desde=${desde}` : ''}`, { cache: 'no-store' });
        const j = await r.json();
        if (!vivo) return;
        const nuevos: { id: number; nombre: string; texto: string; segundo: number }[] = (j.comentarios ?? []).map((c: any) => ({ id: Number(c.id), nombre: String(c.nombre ?? 'Cliente'), texto: String(c.texto ?? ''), segundo: Number(c.segundo) || 0 }));
        for (const c of nuevos) {
          if (publicos.current.some(x => x.id === c.id)) continue;
          publicos.current.push(c);
          ultimoId.current = Math.max(ultimoId.current, c.id);
          // Los que llegan mientras miras (no en la carga inicial) salen de una vez.
          if (desde && !mostradosPub.current.has(c.id)) {
            mostradosPub.current.add(c.id);
            agregar({ id: ++idComentario.current, texto: c.texto, autor: 'publico', nombre: c.nombre });
          }
        }
      } catch { /* sin conexión: se reintenta */ }
    };
    traer(0);
    const t = setInterval(() => traer(ultimoId.current), 8000);
    return () => { vivo = false; clearInterval(t); };
  }, [live.slug, agregar]);

  // Replay: al avanzar el video aparecen los comentarios guardados de ese segundo y los
  // eventos de la línea de tiempo (preguntas preparadas / preguntas frecuentes), y se QUEDAN.
  useEffect(() => {
    // Si el video volvió a empezar (loop), se pueden repetir en la siguiente vuelta.
    if (tiempo < tiempoPrev.current - 3) { mostradosPub.current.clear(); mostradosTL.current.clear(); }
    tiempoPrev.current = tiempo;
    for (const c of publicos.current) {
      if (c.segundo <= tiempo && !mostradosPub.current.has(c.id)) {
        mostradosPub.current.add(c.id);
        agregar({ id: ++idComentario.current, texto: c.texto, autor: 'publico', nombre: c.nombre });
      }
    }
  }, [tiempo, agregar]);

  // Eventos de la línea de tiempo → al chat, una vez por vuelta, y se quedan.
  useEffect(() => {
    for (const m of mensajes) {
      const clave = `${m.tipo}-${m.inicio}`;
      if (mostradosTL.current.has(clave)) continue;
      mostradosTL.current.add(clave);
      if (m.tipo === 'pregunta_frecuente') {
        agregar({ id: ++idComentario.current, texto: '', autor: 'faq', pregunta: m.contenido.pregunta, respuesta: m.contenido.respuesta });
      } else {
        agregar({ id: ++idComentario.current, texto: m.contenido.texto, autor: 'demo', nombre: m.contenido.autor });
      }
    }
  }, [mensajes, agregar]);

  const compartir = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: live.titulo, url }); return; }
      await navigator.clipboard.writeText(url);
      mostrarAviso('Enlace copiado');
    } catch { /* el usuario canceló o el navegador no lo permite */ }
  }, [live.titulo, mostrarAviso]);

  // MODO_REPRODUCCION 'sincronizado': aquí se haría seek a posicionSincronizada(...) al cargar. Preparado, no activo.

  useEffect(() => { track('live_view', { slug: live.slug, modo: live.modo }); }, [live.slug, live.modo]);
  useEffect(() => { if (producto) track('product_shown', { productoId: producto.id, nombre: producto.nombre, precio: producto.precio, segundo: Math.floor(tiempo) }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [producto?.id]);

  // Comentarios de AMBIENTE (demo): van apareciendo solos durante el live, como un chat vivo.
  // Salen de live.comentariosAuto (editables desde el panel). Siempre marcados DEMO.
  useEffect(() => {
    const lista = live.comentariosAuto ?? [];
    if (lista.length === 0) return;
    const NOMBRES = ['Camilo', 'Daniela', 'Andrés', 'Paola', 'Juan', 'Mateo', 'Valentina', 'Santiago', 'Laura', 'Sebastián', 'Carolina', 'Jhon', 'Kevin', 'Luisa', 'Felipe', 'Natalia'];
    let i = Math.floor(Math.random() * lista.length);
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      const id = ++idComentario.current;
      const texto = lista[i % lista.length]; i++;
      const nombre = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
      agregar({ id, texto, autor: 'demo', nombre });
      timer = setTimeout(loop, 4000 + Math.random() * 4000);
    };
    timer = setTimeout(loop, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.comentariosAuto]);

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
          mensajes={[]}
          seleccion={seleccion}
          silenciado={silenciado}
          bloqueado={bloqueado}
          onSonido={alternarSonido}
          onReproducir={() => videoRef.current?.reproducir().catch(() => {})}
          onCerrar={cerrar}
          onProductoClick={p => { track('product_click', { productoId: p.id, nombre: p.nombre, precio: p.precio }); setSheet(p); }}
          onComprarAqui={p => { track('buy_here_open', { productoId: p.id, nombre: p.nombre, precio: p.precio }); setSheet(p); }}
          propios={propios}
          onComentar={comentar}
          onCompartir={compartir}
        />
        {aviso && <div role="status" className="live-pop absolute left-1/2 -translate-x-1/2 top-24 z-40 max-w-[88%] text-center rounded-2xl bg-black/80 px-4 py-2 text-[13px] font-semibold">{aviso}</div>}
        {pidiendoNombre !== null && (
          <div className="absolute inset-0 z-40 bg-black/50 flex items-end justify-center p-4" onClick={() => confirmarNombre(null)}>
            <form className="live-sheet w-full max-w-sm bg-white text-black rounded-2xl p-4 mb-20" onClick={e => e.stopPropagation()}
                  onSubmit={e => { e.preventDefault(); confirmarNombre((e.currentTarget.elements.namedItem('nombre') as HTMLInputElement).value); }}>
              <p className="font-bold text-[15px]">¿Cómo te llamas?</p>
              <p className="text-xs text-neutral-500 mb-2">Tu nombre aparece junto a tu comentario. Es opcional.</p>
              <input name="nombre" autoFocus maxLength={24} placeholder="Tu nombre" className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm mb-3" />
              <div className="flex gap-2">
                <button type="button" onClick={() => confirmarNombre(null)} className="flex-1 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold">Omitir</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-[#ff3366] text-white text-sm font-bold">Publicar</button>
              </div>
            </form>
          </div>
        )}
        {sheet && (funnel ? (
          /* Checkout DEL EMBUDO tal cual, dentro de un panel inferior (el video sigue arriba). */
          <div className="absolute inset-0 z-30 flex flex-col justify-end" onClick={() => setSheet(null)}>
            <div className="live-sheet bg-white text-black rounded-t-3xl max-h-[88%] overflow-y-auto pb-4" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur flex items-center justify-between px-4 py-2 border-b border-neutral-100">
                <span className="text-xs text-neutral-500">El video sigue arriba ↑</span>
                <button onClick={() => setSheet(null)} aria-label="Cerrar" className="w-8 h-8 rounded-full bg-neutral-100 text-lg leading-none">×</button>
              </div>
              <FormularioPedido funnel={funnel} utms={{}} embebido compacto />
            </div>
          </div>
        ) : (
          <BuySheet live={live} producto={sheet} seleccion={seleccion} onSeleccion={setSeleccion} onCerrar={() => setSheet(null)} />
        ))}
      </main>
    </div>
  );
}

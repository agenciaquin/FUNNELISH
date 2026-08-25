'use client';

import { useState, useRef, useEffect } from 'react';
import EntrenadorQuino from './EntrenadorQuino';

/**
 * Asistente "Quino" — copiloto FLOTANTE de toda la app. Sabe en qué sección
 * está parado el usuario y lo guía en eso. Corre en el servidor con la llave
 * de la agencia (gratis para el cliente). Memoria en la sesión. Aprende de lo
 * que sirve. Acepta capturas de pantalla (adjuntar o pegar con Ctrl+V).
 */

const SOPORTE_WA = 'https://wa.me/573167648391?text=Hola%20QUIN%2C%20necesito%20ayuda%20conectando%20mi%20WhatsApp%20con%20Meta';
const MAX_ADJ = 2;        // imágenes por mensaje
const TOPE_CONV = 8;      // imágenes por conversación (cuida el costo)

type Fb = 'up' | 'down' | 'auto';
type Adj = { dataUrl: string; base64: string };
type Msg = { role: 'user' | 'assistant'; content: string; fb?: Fb; imgs?: string[] };

const SALUDO =
  '¡Hola! 👋 Soy Quino, tu copiloto en QuinChat. Te ayudo con lo que estás viendo en esta pantalla. Puedes escribirme o pegarme una captura (Ctrl+V). ¿Qué necesitas?';

const CHIPS_BASE = ['¿Qué puedo hacer en esta pantalla?', '¿Cómo empiezo?'];
const CHIPS_MAP: Record<string, string[]> = {
  wa_config: ['¿Por dónde empiezo?', '¿Dónde saco el Phone Number ID?', '¿Cómo hago el token permanente?', 'El webhook no verifica ❌', '¿Cuál es mi URL de webhook?'],
  embudos: ['¿Cómo creo un embudo?', '¿Dónde pongo los píxeles?', '¿Cómo copio el link para anuncios?'],
  plantillas_embudo: ['¿Cómo uso una plantilla?', '¿Puedo editarla después?'],
  entrenamiento: ['¿Cómo cambio el tono del bot?', '¿Qué escribo aquí?'],
  pedidos: ['¿Dónde veo mis ventas?', '¿Cómo hago seguimiento?'],
  ventas: ['¿Cómo cruzo con Effi?', '¿Qué archivo subo?'],
  catalogos: ['¿Cómo agrego un producto?', '¿Cómo pongo colores y fotos?'],
  seguimiento: ['¿Cómo conecto Meta Ads?', '¿Qué es el costo por venta?'],
  chat: ['¿Cómo respondo un chat?', '¿Cómo etiqueto un cliente?'],
  chat_ventas: ['¿Cómo respondo por WhatsApp?', '¿El bot responde solo?'],
  faq: ['¿Cómo agrego una respuesta?'],
  disparadores: ['¿Cómo hago un mensaje automático?'],
  etiquetas: ['¿Cómo creo una etiqueta?'],
  memoria: ['¿Qué apruebo aquí?'],
};
function chipsDe(seccion?: string): string[] {
  return (seccion && CHIPS_MAP[seccion]) ? CHIPS_MAP[seccion] : CHIPS_BASE;
}

function esExito(texto: string): boolean {
  const t = texto.toLowerCase();
  if (/\bno\s+(funcion|sirv|qued|me\s+sirv)/.test(t)) return false;
  return /(ya\s+(funcion|sirv|qued|arranc)|qued[oó]\s+list|\blisto\b|resuelto|lo\s+logr|perfecto,?\s+(ya|funciona|listo)|gracias.*(funcion|sirvi|qued))/.test(t);
}

/** Baja la resolución de la captura para que pese poco y cueste centavos. */
function procesarImagen(file: File): Promise<Adj> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1024;
        let w = img.width, h = img.height;
        if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve({ dataUrl, base64: dataUrl.split(',')[1] ?? '' });
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fmt(text: string) {
  return text.split('\n').map((linea, i) => {
    const partes = linea.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      /^\*\*[^*]+\*\*$/.test(p)
        ? <strong key={j} className="font-semibold text-[#0D0D0D]">{p.slice(2, -2)}</strong>
        : <span key={j}>{p}</span>
    );
    return <div key={i}>{partes.length ? partes : <br />}</div>;
  });
}

export default function AsistenteConexion({ seccion }: { seccion?: string }) {
  const [abierto, setAbierto] = useState(false);
  // Burbuja de Quino: movible (arrastrable) para que no tape el botón de enviar.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  function lanzadorDown(e: React.PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  }
  function lanzadorMove(e: React.PointerEvent) {
    const d = dragRef.current; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    setPos({
      x: Math.min(window.innerWidth - 56, Math.max(4, d.ox + dx)),
      y: Math.min(window.innerHeight - 56, Math.max(4, d.oy + dy)),
    });
  }
  function lanzadorUp() {
    const d = dragRef.current; dragRef.current = null;
    if (d && !d.moved) setAbierto(true); // fue un clic (no arrastre) → abrir
  }
  const [modo, setModo] = useState<'ayuda' | 'entrenar'>('ayuda');
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', content: SALUDO }]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [adjuntos, setAdjuntos] = useState<Adj[]>([]);
  const [totalImgs, setTotalImgs] = useState(0);
  const finRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 🎤 Dictado por voz: la persona habla y se transcribe al cuadro de texto
  // (usa el reconocimiento del navegador, gratis). Así puede "hablarle" a Quino.
  const [grabando, setGrabando] = useState(false);
  const [vozOk, setVozOk] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => { if (abierto) finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, cargando, abierto, adjuntos]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVozOk(!!SR);
  }, []);

  function toggleVoz() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setVozOk(false); return; }
    if (grabando) { try { recRef.current?.stop(); } catch { /* nada */ } return; }
    const rec = new SR();
    rec.lang = 'es-CO';
    rec.interimResults = true;
    rec.continuous = false;
    let finalTxt = '';
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTxt += tr; else interim += tr;
      }
      setInput((finalTxt + interim).trim());
    };
    rec.onerror = () => { setGrabando(false); };
    rec.onend = () => { setGrabando(false); recRef.current = null; };
    recRef.current = rec;
    setGrabando(true);
    try { rec.start(); } catch { setGrabando(false); }
  }

  function preguntaAntesDe(lista: Msg[], i: number): string {
    for (let k = i - 1; k >= 0; k--) if (lista[k].role === 'user') return lista[k].content;
    return '';
  }

  async function aprender(problema: string, solucion: string) {
    if (!problema || !solucion) return;
    try {
      await fetch('/api/asistente-conexion/util', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problema, solucion }),
      });
    } catch { /* silencioso */ }
  }

  function marcar(i: number, fb: Fb) {
    setMsgs(prev => {
      if (prev[i]?.fb) return prev;
      const copia = prev.slice();
      copia[i] = { ...copia[i], fb };
      if (fb === 'up') aprender(preguntaAntesDe(copia, i), copia[i].content);
      return copia;
    });
  }

  async function agregarArchivo(file: File | null | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    if (totalImgs >= TOPE_CONV) return;
    if (adjuntos.length >= MAX_ADJ) return;
    try {
      const a = await procesarImagen(file);
      setAdjuntos(prev => prev.length >= MAX_ADJ ? prev : [...prev, a]);
    } catch { /* nada */ }
  }

  function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) { e.preventDefault(); agregarArchivo(f); }
      }
    }
  }

  async function enviar(texto?: string) {
    const t = (texto ?? input).trim();
    if ((!t && adjuntos.length === 0) || cargando) return;
    const imgsData = adjuntos.map(a => a.dataUrl);
    const contenido = t || (adjuntos.length ? 'Mira esta captura, ¿qué hago aquí? 👀' : '');
    const nuevos: Msg[] = [...msgs, { role: 'user', content: contenido, imgs: imgsData.length ? imgsData : undefined }];

    if (esExito(t)) {
      for (let k = nuevos.length - 2; k >= 0; k--) {
        if (nuevos[k].role === 'assistant' && !nuevos[k].fb) {
          nuevos[k] = { ...nuevos[k], fb: 'auto' };
          aprender(preguntaAntesDe(nuevos, k), nuevos[k].content);
          break;
        }
      }
    }

    const imagenesBody = adjuntos.map(a => ({ mimeType: 'image/jpeg', base64: a.base64 }));
    setMsgs(nuevos);
    setInput('');
    if (adjuntos.length) setTotalImgs(n => n + adjuntos.length);
    setAdjuntos([]);
    setCargando(true);
    try {
      const r = await fetch('/api/asistente-conexion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seccion,
          messages: nuevos.map(m => ({ role: m.role, content: m.content })),
          imagenes: imagenesBody.length ? imagenesBody : undefined,
        }),
      });
      const d = await r.json();
      setMsgs(m => [...m, { role: 'assistant', content: r.ok ? d.reply : (d.error ?? 'Ups, no pude responder. Intenta de nuevo.') }]);
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: 'Se cayó la conexión un momento. Intenta otra vez 🙏' }]);
    } finally {
      setCargando(false);
    }
  }

  const puedeAdjuntar = adjuntos.length < MAX_ADJ && totalImgs < TOPE_CONV;

  return (
    <>
      {/* Burbuja lanzadora — movible (arrástrala para reubicarla). Sube por
          defecto para no tapar el botón de enviar. */}
      {!abierto && (
        <button
          onPointerDown={lanzadorDown}
          onPointerMove={lanzadorMove}
          onPointerUp={lanzadorUp}
          style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
          className={`${pos ? 'fixed' : 'fixed bottom-24 right-5'} z-50 flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full bg-white border border-[#00A89D]/30 shadow-xl shadow-black/10 hover:shadow-2xl transition-shadow touch-none cursor-grab active:cursor-grabbing select-none`}
          title="Arrástrame para moverme · toca para abrir"
        >
          <span className="relative">
            <img src="/quino-avatar.png" alt="Quino" className="w-10 h-10 rounded-full bg-white border border-[#00A89D]/30 object-cover" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#00A89D] border-2 border-white animate-pulse" />
          </span>
          <span className="text-sm font-semibold text-[#0D0D0D] hidden sm:block">¿Te ayudo?</span>
        </button>
      )}

      {/* Ventana de chat flotante */}
      {abierto && (
        <div className="fixed bottom-5 right-5 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl bg-white border border-[#E8E8E8] shadow-2xl shadow-black/20 overflow-hidden">
          {/* Encabezado */}
          <div className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-[#00A89D] to-[#00847A] text-white shrink-0">
            <img src="/quino-avatar.png" alt="Quino" className="w-10 h-10 rounded-full bg-white/90 border border-white/50 object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">Quino · Asistente</span>
                <span className="text-[10px] font-bold bg-white/25 rounded-full px-2 py-0.5">GRATIS</span>
              </div>
              <p className="text-[11px] text-white/85">Tu copiloto en QuinChat. Te guío en cada pantalla.</p>
            </div>
            <button
              onClick={() => {
                if (grabando) { try { recRef.current?.stop(); } catch { /* nada */ } }
                setMsgs([{ role: 'assistant', content: SALUDO }]);
                setInput(''); setAdjuntos([]); setTotalImgs(0); setCargando(false);
              }}
              className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center text-white/90 text-base shrink-0"
              title="Nuevo chat (empezar de cero)"
            >🔄</button>
            <button onClick={() => setAbierto(false)} className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center text-white/90 text-lg shrink-0" title="Cerrar">✕</button>
          </div>

          {/* Cambiador de modo: Ayuda vs Entrenar al bot */}
          <div className="flex gap-1 p-1.5 bg-[#F0F0F0] shrink-0">
            <button
              onClick={() => setModo('ayuda')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${modo === 'ayuda' ? 'bg-white text-[#00847A] shadow-sm' : 'text-[#6B6B6B] hover:text-[#0D0D0D]'}`}
            >💬 Ayuda</button>
            <button
              onClick={() => setModo('entrenar')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${modo === 'entrenar' ? 'bg-white text-[#00847A] shadow-sm' : 'text-[#6B6B6B] hover:text-[#0D0D0D]'}`}
            >🎓 Entrenar al bot</button>
          </div>

          {/* Modo entrenar: le hablas a Quino y enseña/corrige al bot vendedor */}
          {modo === 'entrenar' && (
            <div className="flex-1 min-h-0 p-3 bg-white">
              <EntrenadorQuino compacto placeholder="Enséñale o corrígele algo al bot…" />
            </div>
          )}

          {/* Mensajes (modo ayuda) */}
          {modo === 'ayuda' && (<>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF9F6]">
            {msgs.map((m, i) => (
              <div key={i}>
                <div className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <img src="/quino-avatar.png" alt="" className="w-7 h-7 rounded-full bg-white border border-[#E8E8E8] object-cover shrink-0 mt-0.5" />
                  )}
                  <div className={`max-w-[80%] text-[13px] leading-relaxed rounded-2xl px-3.5 py-2.5 ${
                    m.role === 'user'
                      ? 'bg-[#00A89D] text-white rounded-br-sm'
                      : 'bg-white border border-[#E8E8E8] text-[#3A3A3A] rounded-bl-sm'
                  }`}>
                    {m.imgs && m.imgs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {m.imgs.map((src, k) => (
                          <img key={k} src={src} alt="captura" className="w-24 h-24 object-cover rounded-lg border border-white/30" />
                        ))}
                      </div>
                    )}
                    {m.role === 'assistant' ? fmt(m.content) : m.content}
                  </div>
                </div>
                {m.role === 'assistant' && i > 0 && (
                  <div className="flex items-center gap-2 mt-1 ml-9">
                    {!m.fb ? (
                      <>
                        <span className="text-[11px] text-[#9A9A9A]">¿Te sirvió?</span>
                        <button onClick={() => marcar(i, 'up')} className="text-[13px] hover:scale-110 transition-transform" title="Sí, me sirvió">👍</button>
                        <button onClick={() => marcar(i, 'down')} className="text-[13px] hover:scale-110 transition-transform" title="No del todo">👎</button>
                      </>
                    ) : m.fb === 'down' ? (
                      <span className="text-[11px] text-[#9A9A9A]">Gracias, lo tendré en cuenta 🙏</span>
                    ) : (
                      <span className="text-[11px] text-[#00847A]">¡Gracias! Aprendí de esto 🙌</span>
                    )}
                  </div>
                )}
              </div>
            ))}
            {cargando && (
              <div className="flex gap-2 justify-start">
                <img src="/quino-avatar.png" alt="" className="w-7 h-7 rounded-full bg-white border border-[#E8E8E8] object-cover shrink-0 mt-0.5" />
                <div className="bg-white border border-[#E8E8E8] rounded-2xl rounded-bl-sm px-3.5 py-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00A89D] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00A89D] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00A89D] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={finRef} />
          </div>

          {/* Chips de preguntas rápidas */}
          {msgs.length <= 2 && (
            <div className="px-3 pb-2 pt-1 flex flex-wrap gap-2 bg-[#FAF9F6] shrink-0">
              {chipsDe(seccion).map(c => (
                <button
                  key={c}
                  onClick={() => enviar(c)}
                  disabled={cargando}
                  className="text-[12px] px-3 py-1.5 rounded-full border border-[#00A89D]/30 text-[#00847A] bg-white hover:bg-[#00A89D]/10 disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Vista previa de capturas por enviar */}
          {adjuntos.length > 0 && (
            <div className="px-3 pt-2 flex gap-2 bg-white shrink-0">
              {adjuntos.map((a, k) => (
                <div key={k} className="relative">
                  <img src={a.dataUrl} alt="captura" className="w-14 h-14 object-cover rounded-lg border border-[#E8E8E8]" />
                  <button
                    onClick={() => setAdjuntos(prev => prev.filter((_, j) => j !== k))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#0D0D0D] text-white text-[11px] flex items-center justify-center"
                    title="Quitar"
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Entrada */}
          <div className="p-3 border-t border-[#F0F0F0] bg-white shrink-0">
            <div className="flex gap-2 items-center">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { agregarArchivo(e.target.files?.[0]); if (fileRef.current) fileRef.current.value = ''; }} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={cargando || !puedeAdjuntar}
                title={puedeAdjuntar ? 'Adjuntar captura' : 'Límite de imágenes'}
                className="w-9 h-9 shrink-0 rounded-xl border border-[#E8E8E8] text-[#6B6B6B] hover:border-[#00A89D] hover:text-[#00A89D] disabled:opacity-40 flex items-center justify-center text-lg"
              >📎</button>
              {vozOk && (
                <button
                  onClick={toggleVoz}
                  disabled={cargando}
                  title={grabando ? 'Detener y usar lo dicho' : 'Hablar (dictar tu pregunta)'}
                  className={`w-9 h-9 shrink-0 rounded-xl border flex items-center justify-center text-lg disabled:opacity-40 ${
                    grabando
                      ? 'border-red-400 text-red-500 bg-red-50 animate-pulse'
                      : 'border-[#E8E8E8] text-[#6B6B6B] hover:border-[#00A89D] hover:text-[#00A89D]'
                  }`}
                >🎤</button>
              )}
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') enviar(); }}
                onPaste={onPaste}
                placeholder={grabando ? 'Escuchando… habla ahora 🎤' : 'Escribe, habla 🎤 o pega una captura…'}
                disabled={cargando}
                className="flex-1 bg-white border border-[#E8E8E8] rounded-xl px-3 py-2 text-sm text-[#0D0D0D] placeholder:text-[#B5B5B5] focus:outline-none focus:border-[#00A89D]"
              />
              <button
                onClick={() => enviar()}
                disabled={cargando || (!input.trim() && adjuntos.length === 0)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#00847A] active:scale-95 disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <a href="/manual-whatsapp-meta.pdf" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#00847A] font-semibold hover:underline">
                📘 Manual (PDF)
              </a>
              <a href={SOPORTE_WA} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#6B6B6B] hover:text-[#00847A]">
                ¿Atascado? <span className="font-semibold text-[#00847A]">Soporte →</span>
              </a>
            </div>
          </div>
          </>)}
        </div>
      )}
    </>
  );
}

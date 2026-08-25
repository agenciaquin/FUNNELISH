'use client';

import { useState, useRef, useEffect, Fragment, type ReactNode } from 'react';
import type { Conversation, Message, Etiqueta } from '@/lib/panel/types';
import { ETIQUETAS_FIJAS, parseLabels, joinLabels, conEstado, conTag } from '@/lib/panel/types';

// Fila del selector de etiquetas ya resuelta (fija de fábrica, o personalizada/nueva de la BD).
type EtqUI = { key: string; nombre: string; color: string; es_estado: boolean; dbId?: string; baseId?: string };

// Colores sugeridos para crear/editar estados y etiquetas desde el chat.
const COLORES_ETQ = ['#8B5CF6','#00847A','#F59E0B','#DC2626','#14B8A6','#EF4444','#3B82F6','#EC4899','#6B7280','#0D0D0D'];
import { createBrowserSupabaseClient } from '@/lib/supabase';
import SelectorPlantillaWA from './SelectorPlantillaWA';
import EntrenadorQuino from './EntrenadorQuino';

// ─── Emoji data ───────────────────────────────────────────────────────────────
const EMOJI_DATA: { icon: string; label: string; emojis: string[] }[] = [
  { icon: '😀', label: 'Caras', emojis: ['😀','😂','🤣','😊','🥰','😍','😘','😎','🤔','😅','😭','😢','😤','😡','🥺','😴','😷','🤒','😏','😒','🙄','😳','🥳','🤩','😇','🤗','😬','😱','🙃','☺️','😋','😜','🤪','😌','😪','😵','🤯','🤠','🤓','🧐','😕','😟','😦','😧','😨','😰','😥','😣','😖','😫','😩','🥱','😤','🤬','😈','👿','💩'] },
  { icon: '👋', label: 'Gestos', emojis: ['👋','✋','🤚','🖐️','👌','🤌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','👍','👎','✊','👊','🤛','🤜','👏','🙌','🤝','🙏','💪','🦾','✍️','🤳','💅','🖖','🫶','🫵','🫱','🫲','🫳','🫴'] },
  { icon: '❤️', label: 'Amor', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','💯','🔥','⭐','✨','🌟','💫','🎉','🎊','🎈','🎁','🎀'] },
  { icon: '🐶', label: 'Animales', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦋','🐌','🐞','🦓','🦒','🦘','🐘','🦏','🦛','🦑','🐙','🦈','🐬','🐳'] },
  { icon: '🍕', label: 'Comida', emojis: ['🍕','🍔','🍟','🌮','🌯','🍱','🍜','🍝','🍣','🍦','🎂','🍰','🧁','🍫','🍬','🍭','🥤','☕','🧋','🍵','🍎','🍊','🍋','🍇','🍓','🍑','🥑','🌽','🥕','🍺','🍷','🥂'] },
  { icon: '⚽', label: 'Deporte', emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🏸','🥊','🎯','🎮','🎲','🎭','🎨','🎵','🎶','🎤','🎧','🎸','🥁','🎹','🎺','🎻','🏆','🥇','🥈','🥉','🏅','🎖️'] },
  { icon: '🚗', label: 'Viajes', emojis: ['🚗','🚕','🚙','🚌','🏎️','🚑','🚒','✈️','🚀','🛸','🚁','⛵','🚢','🚂','🏠','🏡','🏢','🏥','🏦','🏨','🏪','🏫','🌍','🌎','🌏','🗺️','🏔️','🌋','🗼','🗽','🌴','🏖️','🏕️'] },
  { icon: '#️⃣', label: 'Símbolos', emojis: ['✅','❌','⭕','❓','❗','💯','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','▶️','⏸️','⏹️','🔁','🔀','🔔','🔕','💬','📝','✏️','📌','📍','🔍','🔎','🔒','🔓','💡','🔧','🔨','⚙️','📦','📧','📅','🗓️'] },
];

function EmojiPickerPanel({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const [category, setCategory] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-[290px] bg-white border border-[#E8E8E8] rounded-2xl shadow-xl z-40 overflow-hidden"
    >
      <div className="flex gap-0.5 px-2 pt-2 pb-1 border-b border-[#F5F5F5] overflow-x-auto scrollbar-none">
        {EMOJI_DATA.map((cat, i) => (
          <button
            key={i}
            onClick={() => setCategory(i)}
            title={cat.label}
            className={`shrink-0 w-8 h-8 flex items-center justify-center text-base rounded-lg transition-all ${
              category === i ? 'bg-[#00A89D]/15' : 'hover:bg-[#F5F5F5]'
            }`}
          >
            {cat.icon}
          </button>
        ))}
      </div>
      <div className="h-[200px] overflow-y-auto px-2 py-1.5">
        <div className="text-[9px] text-[#6B6B6B] font-semibold uppercase tracking-wide px-1 mb-1">
          {EMOJI_DATA[category].label}
        </div>
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_DATA[category].emojis.map((emoji, i) => (
            <button
              key={i}
              onClick={() => onSelect(emoji)}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-[#F5F5F5] rounded-lg transition-all active:scale-90"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

/** ¿Dos fechas caen en el mismo día del calendario? */
function mismoDia(a: string, b: string): boolean {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/** Etiqueta del separador de día, tipo WhatsApp: Hoy / Ayer / Antier / fecha. */
function etiquetaDia(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy);    ayer.setDate(hoy.getDate() - 1);
  const antier = new Date(hoy);  antier.setDate(hoy.getDate() - 2);
  const igual = (p: Date, q: Date) =>
    p.getFullYear() === q.getFullYear() && p.getMonth() === q.getMonth() && p.getDate() === q.getDate();
  if (igual(d, hoy))    return 'Hoy';
  if (igual(d, ayer))   return 'Ayer';
  if (igual(d, antier)) return 'Antier';
  const txt = d.toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function formatRecTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Palomitas de estado: ✓ enviado · ✓✓ entregado · ✓✓ azul leído · ⚠ falló */
function Ticks({ status, error }: { status?: string; error?: string }) {
  if (!status) return null;
  if (status === 'failed') {
    return (
      <span className="ml-1 text-amber-200" title={error ? `No se pudo entregar — ${error}` : 'No se pudo entregar'}>
        ⚠
      </span>
    );
  }
  const leido = status === 'read';
  const doble = status === 'delivered' || leido;
  const titulo = leido ? 'Leído' : status === 'delivered' ? 'Entregado' : 'Enviado';
  return (
    <span className={`ml-1 ${leido ? 'text-sky-300' : 'text-white/50'}`} title={titulo}>
      {doble ? '✓✓' : '✓'}
    </span>
  );
}

interface Props {
  conversation: Conversation | null;
  messages: Message[];
  onMessageSent: (msg: Message) => void;
  onConversationsUpdate: () => void;
  onBack?: () => void;
}

/**
 * Texto que acompaña a una foto o video. Se guarda como "🖼️ Imagen: el texto",
 * así que basta con quedarse con lo que va después de los dos puntos.
 */
function pieDeFoto(msg: Message): string {
  if (msg.type !== 'image' && msg.type !== 'video') return '';
  // Preferir la columna persistida en BD (sobrevive a recargas).
  if (msg.caption && msg.caption.trim()) return msg.caption.trim();
  const c = String(msg.content ?? '');
  if (c.startsWith('http')) return '';
  const i = c.indexOf(': ');
  return i > 0 ? c.slice(i + 2).trim() : '';
}

export default function ChatArea({ conversation, messages, onMessageSent, onConversationsUpdate, onBack }: Props) {
  const [input, setInput]               = useState('');
  const [sending, setSending]           = useState(false);
  const [botEnabled, setBotEnabled]     = useState(true);
  const [botOpen, setBotOpen]           = useState(false);
  const [plantillaOpen, setPlantillaOpen] = useState(false);
  // Respuestas rápidas (plantillas GENERALES/internas — no necesitan aprobación de Meta)
  const [respOpen, setRespOpen]         = useState(false);
  const [respBusca, setRespBusca]       = useState('');
  const [respRapidas, setRespRapidas]   = useState<{ id: string; nombre: string; tipo: string; contenido: string; imagen_url: string }[]>([]);

  // Archivos en espera de confirmación antes de enviarse
  const [preview, setPreview]       = useState<{ file: File; url: string; caption: string }[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const previewLen = preview.length;
  const previewRef = useRef<HTMLInputElement>(null);

  // Menú de un mensaje (responder / copiar / eliminar) y mensaje citado
  const [menuMsg, setMenuMsg]   = useState<Message | null>(null);
  const [citando, setCitando]   = useState<Message | null>(null);
  const [corrigiendo, setCorrigiendo] = useState<Message | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const pulsacionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!menuMsg) return;
    const cerrar = () => setMenuMsg(null);
    document.addEventListener('click', cerrar);
    return () => document.removeEventListener('click', cerrar);
  }, [menuMsg]);

  /** Texto legible de un mensaje, para copiarlo o citarlo. */
  function textoDe(m: Message): string {
    const pie = pieDeFoto(m);
    if (pie) return pie;
    const c = String(m.content ?? '');
    if (c.startsWith('http')) {
      return m.type === 'image' ? '📷 Foto' : m.type === 'video' ? '🎬 Video' : m.type === 'audio' ? '🎵 Audio' : '📎 Archivo';
    }
    return c;
  }

  /** Enlace del archivo de un mensaje, si lo tiene. */
  function urlDe(m: Message): string | null {
    if (m.media_url?.startsWith('http')) return m.media_url;
    const c = String(m.content ?? '');
    return c.startsWith('http') ? c : null;
  }

  /** Descarga una imagen por su URL. Siempre funciona. */
  async function descargarImagen(url: string) {
    if (!url) return;
    try {
      const resp = await fetch(url, { mode: 'cors', cache: 'no-store' });
      const blob = await resp.blob();
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(blob);
      enlace.download = `foto-${Date.now()}.${ext}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(enlace.href), 5000);
    } catch {
      window.open(url, '_blank');
    }
  }
  async function descargarFoto(m: Message) {
    setMenuMsg(null);
    const url = urlDe(m);
    if (url) await descargarImagen(url);
  }

  /** Copia una imagen al portapapeles por su URL (con respaldos). */
  async function copiarImagen(url: string) {
    if (!url) return;
    const aPng = async (): Promise<Blob> => {
      const resp = await fetch(url, { mode: 'cors', cache: 'no-store' });
      if (!resp.ok) throw new Error(`no se pudo descargar (${resp.status})`);
      const original = await resp.blob();
      if (original.type === 'image/png') return original;
      const bitmap = await createImageBitmap(original);
      const lienzo = document.createElement('canvas');
      lienzo.width = bitmap.width; lienzo.height = bitmap.height;
      lienzo.getContext('2d')?.drawImage(bitmap, 0, 0);
      return await new Promise<Blob>((ok, err) =>
        lienzo.toBlob(b => (b ? ok(b) : err(new Error('no se pudo convertir'))), 'image/png'));
    };
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': aPng() })]);
    } catch {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': await aPng() })]);
      } catch {
        await descargarImagen(url);
        alert('Tu navegador no dejó copiar la imagen.\nLa descargué para que la puedas adjuntar.');
      }
    }
  }

  async function copiarMensaje(m: Message) {
    setMenuMsg(null);
    const url = urlDe(m);

    // Si es una foto, se copia la imagen misma para poder pegarla en otro chat.
    // Copiar el texto "📷 Foto" no le sirve a nadie.
    if (m.type === 'image' && url) {
      // Convierte la foto a PNG, que es el único formato del portapapeles
      const aPng = async (): Promise<Blob> => {
        const resp = await fetch(url, { mode: 'cors', cache: 'no-store' });
        if (!resp.ok) throw new Error(`no se pudo descargar (${resp.status})`);
        const original = await resp.blob();
        if (original.type === 'image/png') return original;

        const bitmap = await createImageBitmap(original);
        const lienzo = document.createElement('canvas');
        lienzo.width = bitmap.width;
        lienzo.height = bitmap.height;
        lienzo.getContext('2d')?.drawImage(bitmap, 0, 0);
        return await new Promise<Blob>((ok, err) =>
          lienzo.toBlob(b => (b ? ok(b) : err(new Error('no se pudo convertir'))), 'image/png'));
      };

      // Intento 1: promesa al portapapeles (conserva el permiso del clic)
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': aPng() })]);
        return;
      } catch (e1) {
        // Intento 2: descargar primero y luego copiar
        try {
          const png = await aPng();
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
          return;
        } catch (e2) {
          // Si tampoco, se descarga la foto: así siempre puede reenviarla
          const motivo = (e2 as Error)?.message || (e1 as Error)?.message || 'desconocido';
          try {
            const png = await aPng();
            const enlace = document.createElement('a');
            enlace.href = URL.createObjectURL(png);
            enlace.download = `foto-${Date.now()}.png`;
            document.body.appendChild(enlace);
            enlace.click();
            enlace.remove();
            setTimeout(() => URL.revokeObjectURL(enlace.href), 5000);
            alert(`Tu navegador no dejó copiar la imagen (${motivo}).\nLa descargué para que la puedas adjuntar.`);
          } catch {
            try {
              await navigator.clipboard.writeText(url);
              alert(`No se pudo copiar la imagen (${motivo}).\nSe copió el enlace de la foto.`);
            } catch { alert(`No se pudo copiar la imagen: ${motivo}`); }
          }
          return;
        }
      }
    }

    // Audio, video o documento: se copia el enlace
    if (url) {
      try { await navigator.clipboard.writeText(url); } catch { alert('No se pudo copiar.'); }
      return;
    }

    try { await navigator.clipboard.writeText(textoDe(m)); }
    catch { alert('No se pudo copiar.'); }
  }

  async function eliminarMensaje(m: Message) {
    if (!confirm('¿Quitar este mensaje del panel?\n\nSeguirá visible en el WhatsApp del cliente: WhatsApp no permite borrarlo de su teléfono desde aquí.')) return;
    setMenuMsg(null);
    await supabase.from('messages').delete().eq('id', m.id);
    onConversationsUpdate();
  }

  /** Mantener pulsado en el celular abre el menú, como en WhatsApp. */
  function iniciarPulsacion(m: Message) {
    pulsacionRef.current = setTimeout(() => setMenuMsg(m), 450);
  }
  function cancelarPulsacion() {
    if (pulsacionRef.current) clearTimeout(pulsacionRef.current);
    pulsacionRef.current = null;
  }
  const [etiquetasDB, setEtiquetasDB]   = useState<Etiqueta[]>([]);
  const [labelOpen, setLabelOpen]       = useState(false);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  // Edición/creación de etiquetas desde el chat
  const [editEtq,      setEditEtq]      = useState<EtqUI | null>(null);          // fila en edición
  const [addTipo,      setAddTipo]      = useState<null | 'estado' | 'tag'>(null); // formulario "agregar"
  const [formNombre,   setFormNombre]   = useState('');
  const [formColor,    setFormColor]    = useState('#00A89D');
  const [guardandoEtq, setGuardandoEtq] = useState(false);

  // ── Modelo de etiquetas del selector ────────────────────────────────────────
  // Base = etiquetas de fábrica. La BD puede PERSONALIZARLAS (base_id) o AGREGAR
  // nuevas, para que el cliente edite/cree estados y etiquetas desde el chat.
  const overridePorBase = new Map<string, Etiqueta>();
  for (const e of etiquetasDB) if (e.base_id) overridePorBase.set(String(e.base_id), e);
  const fijasEfectivas: EtqUI[] = ETIQUETAS_FIJAS.map(f => {
    const ov = overridePorBase.get(f.id);
    return ov
      ? { key: f.id, nombre: ov.nombre, color: ov.color, es_estado: ov.es_estado ?? !!f.es_estado, dbId: ov.id, baseId: f.id }
      : { key: f.id, nombre: f.nombre, color: f.color, es_estado: !!f.es_estado, baseId: f.id };
  });
  const nombresFijos = new Set(fijasEfectivas.map(f => f.nombre.toUpperCase()));
  const nuevasEtq: EtqUI[] = etiquetasDB
    .filter(e => !e.base_id && !nombresFijos.has(e.nombre.toUpperCase()))
    .map(e => ({ key: e.id, nombre: e.nombre, color: e.color, es_estado: !!e.es_estado, dbId: e.id }));
  const modeloEtq: EtqUI[]     = [...fijasEfectivas, ...nuevasEtq];
  const estadosLista           = modeloEtq.filter(m => m.es_estado);
  const adicionalesLista       = modeloEtq.filter(m => !m.es_estado);
  const nombresEstado          = estadosLista.map(m => m.nombre);

  // Revisión de la venta antes de registrarla a mano (corregir producto/talla/valor)
  const [ventaModal, setVentaModal]       = useState(false);
  const [ventaProducto, setVentaProducto] = useState('');
  const [ventaTalla, setVentaTalla]       = useState('');
  const [ventaValor, setVentaValor]       = useState('');
  const [ventaGuardando, setVentaGuardando] = useState(false);

  // Media toolbar
  const [showEmoji, setShowEmoji]   = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [recording, setRecording]   = useState(false);
  const [recTime, setRecTime]       = useState(0);

  const bottomRef     = useRef<HTMLDivElement>(null);
  const labelBoxRef   = useRef<HTMLDivElement>(null);   // popover de estados/etiquetas
  const respBoxRef    = useRef<HTMLDivElement>(null);   // popover de respuestas rápidas
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecRef   = useRef<any>(null); // opus-recorder instance
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase      = createBrowserSupabaseClient();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecRef.current?.stop) {
        try { mediaRecRef.current.stop(); } catch {}
      }
    };
  }, []);

  useEffect(() => {
    setBotEnabled(conversation?.bot_enabled ?? true);
    setCurrentLabel(conversation?.label ?? null);
    setBotOpen(false);
    setLabelOpen(false);
  }, [conversation?.id, conversation?.bot_enabled, conversation?.label]);

  useEffect(() => {
    fetch('/api/etiquetas').then(r => r.json()).then(d => setEtiquetasDB(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // Plantillas GENERALES (respuestas rápidas internas) para insertarlas en el chat.
  useEffect(() => {
    fetch('/api/plantillas').then(r => r.json()).then(d => setRespRapidas(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // Cierra el popover de respuestas rápidas SOLO al hacer clic afuera (no dentro,
  // para poder buscar/escribir sin que se cierre).
  useEffect(() => {
    if (!respOpen) return;
    const h = (e: MouseEvent) => {
      if (respBoxRef.current && !respBoxRef.current.contains(e.target as Node)) setRespOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [respOpen]);

  // Cierra el popover de estados/etiquetas SOLO al hacer clic AFUERA. Así, al tocar
  // "Nuevo estado", "Nueva etiqueta" o ✏️ Editar, el popover NO se cierra y deja
  // escribir el nombre y elegir el color. (Antes se cerraba con cualquier clic.)
  useEffect(() => {
    if (!labelOpen) return;
    const h = (e: MouseEvent) => {
      if (labelBoxRef.current && !labelBoxRef.current.contains(e.target as Node)) {
        setLabelOpen(false);
        setEditEtq(null); setAddTipo(null); setFormNombre('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [labelOpen]);

  useEffect(() => {
    if (!botOpen) return;
    const h = () => setBotOpen(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [botOpen]);

  useEffect(() => {
    if (!showAttach) return;
    const h = () => setShowAttach(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [showAttach]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [input]);

  // ── Send text ──────────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!input.trim() || !conversation || sending) return;
    const text = input.trim();
    const respondiendo = citando;
    setInput('');
    setCitando(null);
    setSending(true);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: conversation.id,
          message: text,
          responderA: respondiendo?.whatsapp_id ?? null,
          citado: respondiendo ? textoDe(respondiendo).slice(0, 200) : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onMessageSent({
          id: data.id ?? `agent-${Date.now()}`,
          conversation_id: conversation.id,
          content: text,
          role: 'agent',
          type: 'text',
          reply_to: respondiendo ? textoDe(respondiendo).slice(0, 200) : undefined,
          created_at: new Date().toISOString(),
        });
        onConversationsUpdate();
      } else {
        alert('No se pudo enviar el mensaje.');
        setInput(text);
      }
    } catch {
      setInput(text);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  // ── Respuestas rápidas (plantillas generales/internas) ──────────────────────
  // Texto → se coloca en el cuadro para que lo revises/edites y lo envíes con Enter.
  // Con imagen → se envía la foto con el texto como pie, al toque.
  async function usarRespuestaRapida(p: { nombre: string; contenido: string; imagen_url: string }) {
    setRespOpen(false);
    setRespBusca('');
    if (!conversation) return;
    const texto = String(p.contenido ?? '').trim();
    const img   = String(p.imagen_url ?? '').trim();

    if (img.startsWith('http')) {
      setSending(true);
      try {
        const r = await fetch('/api/whatsapp/send-media-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: conversation.id, url: img, type: 'image', caption: texto || undefined }),
        });
        if (r.ok) {
          const data = await r.json();
          const pie = texto ? `: ${texto}` : '';
          onMessageSent({
            id: data.id ?? `agent-resp-${Date.now()}`,
            conversation_id: conversation.id, content: `🖼️ Imagen${pie}`,
            caption: texto || undefined, role: 'agent', type: 'image',
            media_url: data.media_url ?? img, created_at: new Date().toISOString(),
          });
          onConversationsUpdate();
        } else { alert('No se pudo enviar la plantilla.'); }
      } catch { alert('No se pudo enviar la plantilla.'); }
      finally { setSending(false); }
      return;
    }

    // Solo texto: se coloca en el cuadro de escribir (lo envías tú con Enter).
    setInput(prev => (prev.trim() ? prev.trimEnd() + '\n' : '') + texto);
    textareaRef.current?.focus();
  }

  // ── Send file/image ────────────────────────────────────────────────────────
  /**
   * Pegar una imagen copiada (Ctrl+V) desde internet, otro chat o una captura.
   * WhatsApp lo permite, así que aquí también.
   */
  function pegarDesdePortapapeles(e: React.ClipboardEvent) {
    if (!conversation) return;
    const items = Array.from(e.clipboardData?.items ?? []);
    const archivos: File[] = [];

    for (const item of items) {
      if (item.kind !== 'file') continue;
      const f = item.getAsFile();
      if (!f) continue;
      // Las capturas llegan sin nombre: se le pone uno para poder enviarlas
      const nombre = f.name && f.name !== 'image.png'
        ? f.name
        : `pegado-${Date.now()}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
      archivos.push(new File([f], nombre, { type: f.type }));
    }

    if (archivos.length === 0) return; // texto normal: pegado corriente
    e.preventDefault();
    abrirPrevisualizacion(archivos);
  }

  /** Prepara los archivos y abre la vista previa antes de enviarlos. */
  function abrirPrevisualizacion(files: File[]) {
    const nuevos = files.filter(Boolean).map(f => ({
      file: f,
      url: f.type.startsWith('image/') || f.type.startsWith('video/') ? URL.createObjectURL(f) : '',
      caption: '',
    }));
    if (nuevos.length === 0) return;
    setPreview(prev => [...prev, ...nuevos]);
    setPreviewIdx(prev => (previewLen === 0 ? 0 : prev));
    setShowAttach(false);
  }

  function cerrarPrevisualizacion() {
    preview.forEach(p => { if (p.url) URL.revokeObjectURL(p.url); });
    setPreview([]);
    setPreviewIdx(0);
  }

  function quitarDePrevisualizacion(i: number) {
    const p = preview[i];
    if (p?.url) URL.revokeObjectURL(p.url);
    const resto = preview.filter((_, j) => j !== i);
    setPreview(resto);
    setPreviewIdx(Math.max(0, Math.min(previewIdx, resto.length - 1)));
  }

  async function enviarPrevisualizacion() {
    const lote = [...preview];
    setPreview([]);
    setPreviewIdx(0);
    for (const p of lote) {
      await sendFile(p.file, p.caption);
      if (p.url) URL.revokeObjectURL(p.url);
    }
  }

  async function sendFile(file: File, caption?: string) {
    if (!conversation || !file) return;
    setSending(true);

    const t = file.type;
    const waType = t.startsWith('image/') ? 'image' : t.startsWith('video/') ? 'video' : t.startsWith('audio/') ? 'audio' : 'document';

    // ── Videos y archivos grandes (>4MB): subir DIRECTO a Supabase y enviar por
    //    URL, para saltarnos el tope de 4.5MB del servidor. ────────────────────
    const usarDirecto = (waType === 'video' || waType === 'image' || waType === 'audio') && file.size > 4 * 1024 * 1024;
    if (usarDirecto) {
      try {
        const ext = (file.name.split('.').pop() || (waType === 'video' ? 'mp4' : 'jpg')).toLowerCase();
        const r1 = await fetch('/api/funnels/upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: 'chat', ext }),
        });
        const up = await r1.json();
        if (!up?.token || !up?.path) throw new Error('no se pudo firmar la subida');
        const { error: upErr } = await supabase.storage.from('chat-media')
          .uploadToSignedUrl(up.path, up.token, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        const r2 = await fetch('/api/whatsapp/send-media-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: conversation.id, url: up.publicUrl, type: waType, caption: caption?.trim() || undefined }),
        });
        if (r2.ok) {
          const data = await r2.json();
          const pie = caption?.trim() ? `: ${caption.trim()}` : '';
          const content = waType === 'image' ? `🖼️ Imagen${pie}` : waType === 'video' ? `🎬 Video${pie}` : '🎵 Audio';
          onMessageSent({
            id: data.id ?? `agent-url-${Date.now()}`,
            conversation_id: conversation.id, content, role: 'agent', type: waType,
            caption: caption?.trim() || undefined,
            media_url: data.media_url ?? up.publicUrl, created_at: new Date().toISOString(),
          });
          onConversationsUpdate();
        } else {
          alert('No se pudo enviar. WhatsApp solo acepta video mp4 (H.264) de hasta 16 MB.');
        }
      } catch (e) {
        console.error('[ChatArea] subida directa falló:', e);
        alert('No se pudo enviar el archivo.');
      } finally {
        setSending(false);
        if (fileInputRef.current)  fileInputRef.current.value = '';
        if (imageInputRef.current) imageInputRef.current.value = '';
      }
      return;
    }

    // Create preview URL for immediate display in the panel (in-session only)
    const mediaUrl = (waType === 'image' || waType === 'audio' || waType === 'video')
      ? URL.createObjectURL(file)
      : undefined;

    const fd = new FormData();
    fd.append('to', conversation.id);
    fd.append('file', file);
    if (caption?.trim()) fd.append('caption', caption.trim());

    try {
      const res = await fetch('/api/whatsapp/send-media', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        const pie = caption?.trim() ? `: ${caption.trim()}` : '';
        const content = waType === 'image' ? `🖼️ Imagen${pie}` : waType === 'video' ? `🎬 Video${pie}` : waType === 'audio' ? '🎵 Audio' : `📎 ${file.name}`;
        // Prefer permanent Supabase URL returned by API; fall back to ephemeral object URL
        const finalMediaUrl = (data.media_url as string | undefined) ?? mediaUrl;
        onMessageSent({
          id: data.id ?? `agent-media-${Date.now()}`,
          conversation_id: conversation.id,
          content,
          caption: caption?.trim() || undefined,
          role: 'agent',
          type: waType,
          media_url: finalMediaUrl,
          created_at: new Date().toISOString(),
        });
        onConversationsUpdate();
      } else {
        if (mediaUrl) URL.revokeObjectURL(mediaUrl);
        alert('No se pudo enviar el archivo. El formato puede no ser compatible con WhatsApp.');
      }
    } catch {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      alert('Error al enviar el archivo.');
    } finally {
      setSending(false);
      if (fileInputRef.current)  fileInputRef.current.value = '';
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  }

  // ── Audio recording (opus-recorder — OGG/Opus nativo en Chrome) ───────────
  async function startRecording() {
    try {
      const { default: Recorder } = await import('opus-recorder');

      let shouldSend = true;

      const recorder = new Recorder({
        encoderPath: '/encoderWorker.min.js',
        numberOfChannels: 1,
        encoderSampleRate: 48000,
        maxFramesPerPage: 40,
        encoderComplexity: 6,
        streamPages: false,
      });

      recorder.ondataavailable = (typedArray: Uint8Array) => {
        if (!shouldSend) return;
        const safeBuf = typedArray.buffer.slice(
          typedArray.byteOffset,
          typedArray.byteOffset + typedArray.byteLength,
        ) as ArrayBuffer;
        const blob = new Blob([safeBuf], { type: 'audio/ogg' });
        sendFile(new File([blob], 'audio.ogg', { type: 'audio/ogg' }));
      };

      await recorder.start();

      // Store a controller object so stopRecording can call it
      mediaRecRef.current = {
        stop: (send: boolean) => {
          shouldSend = send;
          recorder.stop();
        },
      };

      setRecording(true);
      setRecTime(0);
      timerRef.current = setInterval(() => setRecTime(prev => prev + 1), 1000);

    } catch (e) {
      console.error('[OpusRecorder]', e);
      // Fallback: open audio file picker
      audioInputRef.current?.click();
    }
  }

  function stopRecording(send: boolean) {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setRecTime(0);
    if (mediaRecRef.current?.stop) {
      mediaRecRef.current.stop(send);
      mediaRecRef.current = null;
    }
  }

  // ── Emoji insert ───────────────────────────────────────────────────────────
  function insertEmoji(emoji: string) {
    const ta    = textareaRef.current;
    const start = ta ? (ta.selectionStart ?? input.length) : input.length;
    const end   = ta ? (ta.selectionEnd   ?? input.length) : input.length;
    const next  = input.slice(0, start) + emoji + input.slice(end);
    setInput(next);
    setTimeout(() => {
      ta?.focus();
      ta?.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  }

  // ── Bot / Label ────────────────────────────────────────────────────────────
  async function setBot(encendido: boolean) {
    if (!conversation) return;
    setBotEnabled(encendido);
    setBotOpen(false);
    await supabase.from('conversations').update({ bot_enabled: encendido }).eq('id', conversation.id);
    onConversationsUpdate();
  }

  // Guarda el nuevo texto de etiquetas (una o varias, separadas por |) y avisa.
  async function guardarEtiquetas(nuevo: string | null, cambios: Record<string, unknown> = {}) {
    if (!conversation) return;
    setCurrentLabel(nuevo);
    await supabase.from('conversations').update({ label: nuevo, ...cambios }).eq('id', conversation.id);
    onConversationsUpdate();
  }

  // ── Estado del pedido: uno solo. Reemplaza al anterior sin tocar las
  //    etiquetas adicionales. ──────────────────────────────────────────────────
  async function cambiarEstado(nombre: string | null) {
    if (!conversation) return;
    const nuevo = conEstado(currentLabel, nombre, nombresEstado);
    // Al marcar la venta, se anota la hora para que el bot se apague solo a los 30 min.
    const esVenta = !!nombre && nombre.toUpperCase().includes('VENTA REALIZADA');
    await guardarEtiquetas(nuevo, esVenta ? { vendido_at: new Date().toISOString() } : {});

    // Marcar VENTA REALIZADA a mano: abrir revisión para corregir el pedido antes
    // de registrarlo (por si el asesor lo ajustó por chat y la base quedó vieja).
    if (nombre && nombre.toUpperCase().includes('VENTA REALIZADA')) {
      try {
        const tel10 = String(conversation.id).replace(/^57/, '').slice(-10);
        const { data: ped } = await supabase
          .from('clientes_funnelish')
          .select('producto, talla, valor, confirmado')
          .eq('telefono', tel10)
          .not('estado', 'in', '("cancelado","duplicado")')
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        // Si ya estaba confirmado, no se vuelve a registrar (idempotente).
        if (ped && ped.confirmado) {
          // ya se envió antes: no duplicar
        } else if (ped) {
          // Pedido del funnel: se abre con sus datos para revisar y confirmar.
          setVentaProducto(String(ped.producto ?? ''));
          setVentaTalla(String(ped.talla ?? ''));
          setVentaValor(String(ped.valor ?? ''));
          setVentaModal(true);
        } else {
          // Chat de WhatsApp puro (sin pedido del funnel): se abre en blanco para
          // que el asesor ponga producto/talla/valor. El resto lo arma la IA del chat.
          setVentaProducto('');
          setVentaTalla('');
          setVentaValor('');
          setVentaModal(true);
        }
      } catch (e) {
        console.error('[Panel] no se pudo abrir la revisión de venta:', e);
      }
    }
  }

  // Registra la venta manual con los datos revisados (corregidos si hizo falta).
  async function confirmarVentaManual() {
    if (!conversation) return;
    setVentaGuardando(true);
    try {
      await fetch('/api/ventas/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          producto: ventaProducto,
          talla: ventaTalla,
          valor: ventaValor,
        }),
      });
      setVentaModal(false);
    } catch (e) {
      console.error('[Panel] no se pudo registrar la venta manual:', e);
    } finally {
      setVentaGuardando(false);
    }
  }

  // ── Etiquetas adicionales: se suman o se quitan sin borrar el estado. ─────────
  async function alternarEtiqueta(nombre: string) {
    if (!conversation) return;
    const nuevo = conTag(currentLabel, nombre);
    // Poner HUMANO apaga el bot (responde una persona)
    const activandoHumano =
      nombre.toUpperCase().includes('HUMANO') &&
      parseLabels(nuevo).some(l => l.toUpperCase() === 'HUMANO');
    await guardarEtiquetas(nuevo, activandoHumano ? { bot_enabled: false } : {});
    if (activandoHumano) setBotEnabled(false);
  }

  // ── Crear / editar / borrar estados y etiquetas DESDE el chat ────────────────
  async function recargarEtiquetas() {
    try {
      const r = await fetch('/api/etiquetas');
      const d = await r.json();
      setEtiquetasDB(Array.isArray(d) ? d : []);
    } catch { /* si falla, se conservan las que ya había */ }
  }

  // Al renombrar una etiqueta, se pasan las conversaciones que la tenían al nombre
  // nuevo, para que ningún chat pierda su estado/etiqueta.
  async function migrarNombreEtiqueta(viejo: string, nuevo: string) {
    if (!viejo || !nuevo || viejo.toUpperCase() === nuevo.toUpperCase()) return;
    try {
      const { data } = await supabase.from('conversations').select('id, label').ilike('label', `%${viejo}%`);
      for (const c of (data ?? []) as { id: string; label: string | null }[]) {
        const partes = parseLabels(c.label).map(l => (l.toUpperCase() === viejo.toUpperCase() ? nuevo : l));
        const nuevoLabel = joinLabels(partes) || null;
        await supabase.from('conversations').update({ label: nuevoLabel }).eq('id', c.id);
        if (conversation && c.id === conversation.id) setCurrentLabel(nuevoLabel);
      }
    } catch (e) { console.error('[Panel] no se pudo migrar el nombre de etiqueta:', e); }
  }

  // Crea una etiqueta NUEVA (estado o adicional).
  async function crearEtiqueta(nombre: string, color: string, esEstado: boolean) {
    const nom = nombre.trim().toUpperCase();
    if (!nom) return;
    setGuardandoEtq(true);
    try {
      await fetch('/api/etiquetas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nom, color, es_estado: esEstado }),
      });
      await recargarEtiquetas();
      setAddTipo(null); setFormNombre('');
    } finally { setGuardandoEtq(false); }
  }

  // Guarda la edición de una fila (renombrar / recolorear). Si es una fija de
  // fábrica se crea su personalización (base_id); si ya es de BD, se actualiza.
  async function guardarEdicionEtiqueta(item: EtqUI, nombre: string, color: string) {
    const nom = nombre.trim().toUpperCase();
    if (!nom) return;
    setGuardandoEtq(true);
    try {
      const payload = JSON.stringify({ nombre: nom, color, es_estado: item.es_estado, base_id: item.baseId ?? null });
      if (item.dbId) {
        await fetch(`/api/etiquetas/${item.dbId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: payload });
      } else {
        await fetch('/api/etiquetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      }
      if (item.nombre.toUpperCase() !== nom) await migrarNombreEtiqueta(item.nombre, nom);
      await recargarEtiquetas();
      setEditEtq(null); setFormNombre('');
      onConversationsUpdate();
    } finally { setGuardandoEtq(false); }
  }

  // Borra una etiqueta de BD. Si era la personalización de una fija, vuelve al
  // valor de fábrica; si era nueva, desaparece.
  async function eliminarEtiquetaCustom(item: EtqUI) {
    if (!item.dbId) return; // las de fábrica no se borran (solo se personalizan)
    setGuardandoEtq(true);
    try {
      await fetch(`/api/etiquetas/${item.dbId}`, { method: 'DELETE' });
      await recargarEtiquetas();
      setEditEtq(null);
    } finally { setGuardandoEtq(false); }
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!conversation) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#FAF9F6] text-[#6B6B6B] select-none">
        <div className="text-5xl mb-3 opacity-20">💬</div>
        <p className="text-sm text-[#6B6B6B]">No se ha seleccionado ninguna conversación</p>
      </div>
    );
  }

  const initial = conversation.contact_name.charAt(0).toUpperCase() || '?';

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-[#FAF9F6]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E8E8] bg-white shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden -ml-2 w-8 h-8 rounded-lg text-[#00A89D] flex items-center justify-center text-lg shrink-0 hover:bg-[#00A89D]/10"
              aria-label="Volver"
            >◀</button>
          )}
          <div className="w-8 h-8 rounded-full bg-[#00A89D] flex items-center justify-center text-sm font-bold text-white">
            {initial}
          </div>
          <div>
            <div className="text-sm font-semibold text-[#0D0D0D]">{conversation.contact_name}</div>
            <div className="text-[10px] text-[#6B6B6B]">+{conversation.id}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Estado del bot — prendido / apagado */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setBotOpen(prev => !prev)}
              title={botEnabled ? 'El bot responde automáticamente' : 'El bot está apagado — responde una persona'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                botEnabled
                  ? 'bg-[#00A89D]/10 text-[#00A89D] border-[#00A89D]/25 hover:bg-[#00A89D]/20'
                  : 'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5] hover:bg-[#FECACA]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${botEnabled ? 'bg-[#00A89D] animate-pulse' : 'bg-[#DC2626]'}`} />
              🤖 {botEnabled ? 'Prendido' : 'Apagado'}
              <span className="text-[10px] opacity-60">▾</span>
            </button>
            {botOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E8] rounded-xl shadow-lg z-20 overflow-hidden min-w-[190px]">
                <button
                  onClick={() => setBot(true)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-[#00A89D] hover:bg-[#F5F5F5] transition-all ${botEnabled ? 'bg-[#F5F5F5]' : ''}`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0 bg-[#00A89D]" />
                  Prender bot
                  {botEnabled && <span className="ml-auto text-[10px] opacity-60">✓</span>}
                </button>
                <button
                  onClick={() => setBot(false)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-[#DC2626] hover:bg-[#F5F5F5] transition-all ${!botEnabled ? 'bg-[#F5F5F5]' : ''}`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0 bg-[#DC2626]" />
                  Apagar bot
                  {!botEnabled && <span className="ml-auto text-[10px] opacity-60">✓</span>}
                </button>
                <p className="px-3 py-2 text-[10px] leading-snug text-[#6B6B6B] border-t border-[#F5F5F5]">
                  Apagado, el bot no responde: contesta una persona desde este chat.
                </p>
              </div>
            )}
          </div>

          {/* Selector de etiquetas: estado (uno) + adicionales (varias) */}
          {(() => {
            const norm      = (s: string) => (s ?? '').toUpperCase();
            const puestas   = parseLabels(currentLabel);
            const esEstadoN = (n: string) => nombresEstado.some(x => norm(x) === norm(n));
            const estadoAct = puestas.find(esEstadoN) ?? null;
            const tienesTag = (n: string) => puestas.some(l => norm(l) === norm(n));
            const colorDe   = (n: string) => modeloEtq.find(m => norm(m.nombre) === norm(n))?.color ?? '#6B6B6B';
            const tagsExtra = puestas.filter(l => !esEstadoN(l)); // para el conteo del botón

            const abrirEditor  = (item: EtqUI) => { setAddTipo(null); setEditEtq(item); setFormNombre(item.nombre); setFormColor(item.color); };
            const abrirAgregar = (tipo: 'estado' | 'tag') => { setEditEtq(null); setAddTipo(tipo); setFormNombre(''); setFormColor(tipo === 'estado' ? '#8B5CF6' : '#6B7280'); };
            const cerrarForm   = () => { setEditEtq(null); setAddTipo(null); setFormNombre(''); };

            // Editor/creador de etiqueta (mismo formulario para editar o crear).
            const Formulario = (onGuardar: () => void, item?: EtqUI) => (
              <div className="px-3 py-2.5 bg-[#FAFAFA] border-y border-[#F0F0F0] flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                <input
                  autoFocus
                  value={formNombre}
                  onChange={e => setFormNombre(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter' && formNombre.trim()) onGuardar(); if (e.key === 'Escape') cerrarForm(); }}
                  placeholder="Nombre"
                  className="w-full bg-white border border-[#E8E8E8] rounded-lg px-2.5 py-1.5 text-xs text-[#0D0D0D] uppercase focus:outline-none focus:border-[#00A89D]"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  {COLORES_ETQ.map(c => (
                    <button key={c} onClick={() => setFormColor(c)}
                      className={`w-5 h-5 rounded-full transition-all ${formColor === c ? 'ring-2 ring-offset-1 ring-[#00A89D] scale-110' : 'hover:scale-105'}`}
                      style={{ background: c }} title={c} />
                  ))}
                  <input type="color" value={formColor} onChange={e => setFormColor(e.target.value)}
                    className="w-5 h-5 rounded-full cursor-pointer border-0 p-0 bg-transparent" title="Otro color" />
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={onGuardar} disabled={guardandoEtq || !formNombre.trim()}
                    className="flex-1 py-1.5 rounded-lg bg-[#00A89D] text-white text-[11px] font-bold hover:bg-[#007A72] disabled:opacity-40">
                    {guardandoEtq ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button onClick={cerrarForm}
                    className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-[11px] hover:bg-[#F5F5F5]">
                    Cancelar
                  </button>
                  {item?.dbId && (
                    <button onClick={() => eliminarEtiquetaCustom(item)} disabled={guardandoEtq} title="Borrar"
                      className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 text-[11px] hover:bg-red-50 disabled:opacity-40">
                      🗑
                    </button>
                  )}
                </div>
                {item?.dbId && item.baseId && (
                  <p className="text-[9px] text-[#9A9A9A] leading-snug">Borrar la deja como venía de fábrica.</p>
                )}
              </div>
            );

            const Fila = (item: EtqUI, seleccion: ReactNode, onClick: () => void, activa: boolean) => (
              <div key={item.key}>
                <div className={`w-full flex items-stretch group/etq ${activa ? 'bg-[#F5F5F5]' : 'hover:bg-[#F5F5F5]'}`}>
                  <button onClick={onClick}
                    className="flex-1 flex items-center gap-2 px-3 py-2 text-xs font-medium text-left"
                    style={{ color: item.color }}>
                    {seleccion}
                    <span className="truncate">{item.nombre}</span>
                  </button>
                  <button onClick={() => abrirEditor(item)} title="Editar etiqueta"
                    className="px-2.5 text-[11px] text-[#9A9A9A] hover:text-[#00A89D] opacity-0 group-hover/etq:opacity-100 transition-opacity">
                    ✏️
                  </button>
                </div>
                {editEtq?.key === item.key && Formulario(() => guardarEdicionEtiqueta(item, formNombre, formColor), item)}
              </div>
            );

            return (
              <div ref={labelBoxRef} className="relative" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setLabelOpen(prev => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                  style={
                    estadoAct
                      ? { color: colorDe(estadoAct), background: colorDe(estadoAct) + '18', borderColor: colorDe(estadoAct) + '40' }
                      : { color: '#6B6B6B', background: '#F5F5F5', borderColor: '#E8E8E8' }
                  }
                >
                  🏷️ {estadoAct
                    ? estadoAct.split(' ').slice(0, 2).join(' ') + (estadoAct.split(' ').length > 2 ? '…' : '')
                    : 'Etiqueta'}
                  {tagsExtra.length > 0 && (
                    <span className="ml-0.5 px-1.5 py-px rounded-full bg-black/10 text-[9px] font-bold">
                      +{tagsExtra.length}
                    </span>
                  )}
                  <span className="text-[10px] opacity-60">▾</span>
                </button>

                {labelOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E8] rounded-xl shadow-xl z-20 overflow-hidden min-w-[250px] max-h-[75vh] overflow-y-auto">

                    {/* ── Estado del pedido (uno solo) ── */}
                    <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A]">
                      Estado del pedido
                    </p>
                    <button onClick={() => cambiarEstado(null)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#6B6B6B] hover:bg-[#F5F5F5]">
                      <span className="w-2 h-2 rounded-full bg-[#E8E8E8] shrink-0" />
                      Sin estado
                      {!estadoAct && <span className="ml-auto text-[10px] opacity-60">✓</span>}
                    </button>
                    {estadosLista.map(item => Fila(
                      item,
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />,
                      () => cambiarEstado(item.nombre),
                      !!estadoAct && norm(estadoAct) === norm(item.nombre),
                    ))}
                    {/* Agregar un nuevo estado */}
                    {addTipo === 'estado'
                      ? Formulario(() => crearEtiqueta(formNombre, formColor, true))
                      : (
                        <button onClick={() => abrirAgregar('estado')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#00A89D] hover:bg-[#F5F5F5]">
                          <span className="w-4 h-4 rounded-full border border-dashed border-[#00A89D] shrink-0 flex items-center justify-center text-[10px]">＋</span>
                          Nuevo estado
                        </button>
                      )}

                    {/* ── Etiquetas adicionales (varias) ── */}
                    <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] border-t border-[#F0F0F0] mt-1">
                      Etiquetas adicionales
                    </p>
                    {adicionalesLista.map(item => {
                      const activa = tienesTag(item.nombre);
                      return Fila(
                        item,
                        <span
                          className="w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px]"
                          style={{ borderColor: item.color, background: activa ? item.color : 'transparent', color: '#fff' }}
                        >{activa ? '✓' : ''}</span>,
                        () => alternarEtiqueta(item.nombre),
                        activa,
                      );
                    })}
                    {/* Agregar una nueva etiqueta adicional */}
                    {addTipo === 'tag'
                      ? Formulario(() => crearEtiqueta(formNombre, formColor, false))
                      : (
                        <button onClick={() => abrirAgregar('tag')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#00A89D] hover:bg-[#F5F5F5]">
                          <span className="w-4 h-4 rounded border border-dashed border-[#00A89D] shrink-0 flex items-center justify-center text-[10px]">＋</span>
                          Nueva etiqueta
                        </button>
                      )}

                    <p className="px-3 py-2 text-[10px] leading-snug text-[#9A9A9A] border-t border-[#F0F0F0]">
                      El estado es uno solo (poner otro reemplaza al anterior). Las adicionales se
                      suman encima sin borrarlo. Toca ✏️ para renombrar o cambiar el color.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-2">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-24 text-[#6B6B6B] text-xs">
            Sin mensajes aún
          </div>
        )}

        {messages.map((msg, idx) => {
          const isOutgoing = msg.role === 'assistant' || msg.role === 'agent';

          // ── Separador de día (Hoy / Ayer / Antier / fecha), como en WhatsApp ──
          const prev = idx > 0 ? messages[idx - 1] : null;
          const mostrarFecha = !prev || !mismoDia(prev.created_at, msg.created_at);
          const divisorFecha = mostrarFecha ? (
            <div className="flex justify-center my-3">
              <span className="px-3 py-1 rounded-full bg-white/90 border border-[#E8E8E8] text-[10px] font-semibold text-[#6B6B6B] shadow-sm">
                {etiquetaDia(msg.created_at)}
              </span>
            </div>
          ) : null;

          // ── Reacción del cliente ──
          if (msg.type === 'reaction') {
            return (
              <Fragment key={msg.id}>
                {divisorFecha}
                <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E8E8E8] rounded-full shadow-sm">
                    <span className="text-base">{msg.content}</span>
                    <span className="text-[9px] text-[#6B6B6B]">{formatMsgTime(msg.created_at)}</span>
                  </div>
                </div>
              </Fragment>
            );
          }

          // ── Determinar src de media ──
          // media_url: object URL pasado en memoria (imágenes enviadas desde el panel)
          // content starting with http: URL de Meta API (imágenes recibidas del cliente)
          const mediaSrc = msg.media_url
            ?? ((msg.type === 'image' || msg.type === 'audio' || msg.type === 'video') && msg.content.startsWith('http')
              ? msg.content
              : null);

          return (
            <Fragment key={msg.id}>
            {divisorFecha}
            <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} group`}>
              {/* Menú del mensaje */}
              {menuMsg?.id === msg.id && (
                <div
                  onClick={e => e.stopPropagation()}
                  className={`absolute z-30 mt-8 bg-white border border-[#E8E8E8] rounded-xl shadow-xl overflow-hidden min-w-[170px] ${isOutgoing ? 'right-8' : 'left-8'}`}
                >
                  <button
                    onClick={() => { setCitando(msg); setMenuMsg(null); textareaRef.current?.focus(); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-[#0D0D0D] hover:bg-[#F5F5F5] text-left"
                  >↩ Responder</button>
                  <button
                    onClick={() => copiarMensaje(msg)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-[#0D0D0D] hover:bg-[#F5F5F5] text-left"
                  >📋 Copiar</button>
                  {msg.role === 'assistant' && msg.type !== 'image' && (
                    <button
                      onClick={() => { setCorrigiendo(msg); setMenuMsg(null); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-[#00847A] font-semibold hover:bg-[#00A89D]/10 text-left border-t border-[#F5F5F5]"
                    >❌ Corregir al bot</button>
                  )}
                  {msg.type === 'image' && (
                    <button
                      onClick={() => descargarFoto(msg)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-[#0D0D0D] hover:bg-[#F5F5F5] text-left"
                    >⬇ Descargar foto</button>
                  )}
                  <button
                    onClick={() => eliminarMensaje(msg)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-[#DC2626] hover:bg-[#FEE2E2] text-left border-t border-[#F5F5F5]"
                  >🗑 Eliminar del panel</button>
                </div>
              )}

              <div
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMenuMsg(msg); }}
                onTouchStart={() => iniciarPulsacion(msg)}
                onTouchEnd={cancelarPulsacion}
                onTouchMove={cancelarPulsacion}
                className={`rounded-2xl text-sm leading-snug relative shadow-sm cursor-default ${
                  msg.type === 'audio' && mediaSrc
                    ? 'w-[270px] max-w-[85%] overflow-visible px-2 py-2'   // audio: ancho cómodo y sin recortar
                    : msg.type === 'image' && mediaSrc
                      ? 'max-w-[68%] p-1 overflow-hidden'
                      : 'max-w-[68%] px-3.5 py-2.5 overflow-hidden'
                } ${
                  isOutgoing
                    ? 'bg-[#00A89D] text-white rounded-br-sm'
                    : 'bg-white text-[#0D0D0D] border border-[#E8E8E8] rounded-bl-sm'
                }`}
              >
                {/* Flechita para abrir el menú (aparece al pasar el mouse) */}
                <button
                  onClick={e => { e.stopPropagation(); setMenuMsg(menuMsg?.id === msg.id ? null : msg); }}
                  className={`absolute top-1 right-1 z-20 w-5 h-5 rounded-full items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex ${
                    isOutgoing ? 'bg-black/20 text-white' : 'bg-[#F0F0F0] text-[#6B6B6B]'
                  }`}
                  aria-label="Opciones del mensaje"
                >▾</button>
                {msg.role === 'agent' && msg.type !== 'image' && (
                  <span className="text-[9px] text-white/60 font-semibold uppercase tracking-wide block mb-0.5">Agente</span>
                )}
                {msg.role === 'assistant' && (
                  <span className="text-[9px] text-white/60 font-semibold uppercase tracking-wide block mb-0.5">Bot IA</span>
                )}

                {/* ── Quoted/replied-to message ── */}
                {msg.reply_to && (
                  <div className={`mb-1.5 rounded-lg overflow-hidden border-l-[3px] ${
                    isOutgoing ? 'bg-white/10 border-white/50' : 'bg-[#F0F0F0] border-[#00A89D]'
                  }`}>
                    {msg.reply_to.startsWith('http') ? (
                      <div className="flex items-center gap-2 px-2 py-1">
                        <img src={msg.reply_to} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                        <span className={`text-[10px] ${isOutgoing ? 'text-white/60' : 'text-[#6B6B6B]'}`}>📷 Foto</span>
                      </div>
                    ) : (
                      <p className={`text-[10px] px-2 py-1.5 line-clamp-2 ${isOutgoing ? 'text-white/60' : 'text-[#6B6B6B]'}`}>
                        {msg.reply_to}
                      </p>
                    )}
                  </div>
                )}

                {msg.type === 'image' && mediaSrc ? (
                  <div className="relative">
                    <img
                      src={mediaSrc}
                      alt="Imagen"
                      loading="lazy"
                      decoding="async"
                      onClick={() => setFotoAmpliada(mediaSrc)}
                      className="rounded-xl max-w-full max-h-52 object-cover block cursor-zoom-in"
                    />
                    {/* Pie de foto: el texto que acompaña la imagen */}
                    {pieDeFoto(msg) && (
                      <p className={`text-[12px] whitespace-pre-wrap break-words px-2 pt-1.5 pb-0.5 ${isOutgoing ? 'text-white' : 'text-[#0D0D0D]'}`}>
                        {pieDeFoto(msg)}
                      </p>
                    )}
                    <div className={
                      pieDeFoto(msg)
                        ? `text-[9px] text-right px-2 pb-1 ${isOutgoing ? 'text-white/50' : 'text-[#6B6B6B]'}`
                        : `text-[9px] absolute bottom-1 right-1.5 px-1 rounded ${isOutgoing ? 'text-white/70 bg-black/20' : 'text-[#6B6B6B] bg-white/80'}`
                    }>
                      {formatMsgTime(msg.created_at)}
                      {isOutgoing && <Ticks status={msg.status} error={msg.error_envio} />}
                    </div>
                  </div>
                ) : msg.type === 'audio' && mediaSrc ? (
                  <>
                    <audio controls preload="metadata" src={mediaSrc} className="w-full min-w-[220px] block" />
                    <div className={`text-[9px] mt-1 text-right ${isOutgoing ? 'text-white/40' : 'text-[#6B6B6B]'}`}>
                      {formatMsgTime(msg.created_at)}
                      {isOutgoing && <Ticks status={msg.status} error={msg.error_envio} />}
                    </div>
                  </>
                ) : msg.type === 'video' && mediaSrc ? (
                  <>
                    <video controls src={mediaSrc} className="rounded-lg max-w-full max-h-48 block mb-1" />
                    <div className={`text-[9px] text-right ${isOutgoing ? 'text-white/40' : 'text-[#6B6B6B]'}`}>
                      {formatMsgTime(msg.created_at)}
                      {isOutgoing && <Ticks status={msg.status} error={msg.error_envio} />}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                    <div className={`text-[9px] mt-1.5 text-right ${isOutgoing ? 'text-white/40' : 'text-[#6B6B6B]'}`}>
                      {formatMsgTime(msg.created_at)}
                      {isOutgoing && <Ticks status={msg.status} error={msg.error_envio} />}
                    </div>
                  </>
                )}

                {/* Si Meta rechazó el envío, se muestra el motivo a la vista */}
                {isOutgoing && msg.status === 'failed' && (
                  <div className="mt-1.5 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-[10px] px-2 py-1 leading-snug">
                    ⚠️ No se entregó{msg.error_envio ? `: ${msg.error_envio}` : ' (motivo no informado)'}
                  </div>
                )}
              </div>
            </div>
            </Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="px-4 py-3 border-t border-[#E8E8E8] bg-white shrink-0">
        {!botEnabled && !recording && (
          <div className="mb-2 text-[10px] text-[#00A89D]/80 text-center font-medium">
            Bot pausado — respondiendo manualmente
          </div>
        )}

        {/* Mensaje al que se está respondiendo */}
        {citando && (
          <div className="mb-2 flex items-start gap-2 bg-[#F5F5F5] border-l-[3px] border-[#00A89D] rounded-lg px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[#00A89D] mb-0.5">
                Respondiendo a {citando.role === 'user' ? (conversation.contact_name || 'el cliente') : 'ti'}
              </p>
              <p className="text-[11px] text-[#6B6B6B] line-clamp-2 break-words">{textoDe(citando)}</p>
            </div>
            <button
              onClick={() => setCitando(null)}
              className="text-[#6B6B6B] hover:text-[#0D0D0D] shrink-0 w-6 h-6 rounded"
              aria-label="Cancelar respuesta"
            >✕</button>
          </div>
        )}

        {/* ── Recording UI ── */}
        {recording ? (
          <div className="flex items-center gap-3 bg-[#FAF9F6] border border-[#E8E8E8] rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-red-500 text-xs font-mono font-bold">{formatRecTime(recTime)}</span>
            </div>
            <span className="text-xs text-[#6B6B6B] flex-1">Grabando audio...</span>
            <button
              onClick={() => stopRecording(false)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#6B6B6B] bg-[#F5F5F5] hover:bg-[#EBEBEB] transition-all border border-[#E8E8E8]"
            >
              Cancelar
            </button>
            <button
              onClick={() => stopRecording(true)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#00A89D] hover:bg-[#007A72] transition-all"
            >
              ✓ Enviar
            </button>
          </div>
        ) : (
          /* ── Normal input ── */
          <div className="relative flex items-end gap-2">

            {/* Emoji picker panel */}
            {showEmoji && (
              <EmojiPickerPanel
                onSelect={emoji => insertEmoji(emoji)}
                onClose={() => setShowEmoji(false)}
              />
            )}

            {/* Attachment menu */}
            {showAttach && (
              <div className="absolute bottom-full left-0 mb-2 bg-white border border-[#E8E8E8] rounded-xl shadow-lg z-30 overflow-hidden min-w-[190px]">
                <button
                  onClick={e => { e.stopPropagation(); setShowAttach(false); imageInputRef.current?.click(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#0D0D0D] hover:bg-[#F5F5F5] transition-all"
                >
                  <span className="text-xl">🖼️</span>
                  <div className="text-left">
                    <div className="font-medium text-xs">Fotos y videos</div>
                    <div className="text-[10px] text-[#6B6B6B]">JPG, PNG, MP4…</div>
                  </div>
                </button>
                <div className="h-px bg-[#F5F5F5] mx-3" />
                <button
                  onClick={e => { e.stopPropagation(); setShowAttach(false); fileInputRef.current?.click(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#0D0D0D] hover:bg-[#F5F5F5] transition-all"
                >
                  <span className="text-xl">📄</span>
                  <div className="text-left">
                    <div className="font-medium text-xs">Documento</div>
                    <div className="text-[10px] text-[#6B6B6B]">PDF, Word, Excel…</div>
                  </div>
                </button>
                <div className="h-px bg-[#F5F5F5] mx-3" />
                <button
                  onClick={e => { e.stopPropagation(); setShowAttach(false); audioInputRef.current?.click(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#0D0D0D] hover:bg-[#F5F5F5] transition-all"
                >
                  <span className="text-xl">🎵</span>
                  <div className="text-left">
                    <div className="font-medium text-xs">Audio</div>
                    <div className="text-[10px] text-[#6B6B6B]">MP3, M4A, OGG, AAC</div>
                  </div>
                </button>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) abrirPrevisualizacion(fs); e.target.value = ''; }}
            />
            <input
              ref={previewRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) abrirPrevisualizacion(fs); e.target.value = ''; }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) abrirPrevisualizacion([f]); e.target.value = ''; }}
            />
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/amr,.mp3,.m4a,.aac,.ogg,.amr"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) sendFile(f); }}
            />

            {/* + Attach */}
            <button
              onClick={e => { e.stopPropagation(); setShowAttach(prev => !prev); setShowEmoji(false); }}
              title="Adjuntar archivo"
              className={`w-9 h-9 flex items-center justify-center rounded-xl border text-base font-bold transition-all shrink-0 ${
                showAttach
                  ? 'bg-[#00A89D]/10 border-[#00A89D]/40 text-[#00A89D]'
                  : 'bg-[#F5F5F5] border-[#E8E8E8] text-[#6B6B6B] hover:border-[#00A89D]/40 hover:text-[#00A89D]'
              }`}
            >
              +
            </button>

            {/* ⚡ Respuestas rápidas (plantillas internas/generales — dentro de 24 h) */}
            <div ref={respBoxRef} className="relative shrink-0" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => { setRespOpen(v => !v); setShowAttach(false); setShowEmoji(false); }}
                title="Respuestas rápidas (plantillas generales, sin aprobación de Meta)"
                className={`w-9 h-9 flex items-center justify-center rounded-xl border text-base transition-all ${
                  respOpen ? 'bg-[#00A89D]/10 border-[#00A89D]/40 text-[#00A89D]' : 'bg-[#F5F5F5] border-[#E8E8E8] text-[#6B6B6B] hover:border-[#00A89D]/40 hover:text-[#00A89D]'
                }`}
              >
                ⚡
              </button>

              {respOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-[300px] bg-white border border-[#E8E8E8] rounded-2xl shadow-xl z-40 overflow-hidden">
                  <div className="px-3 pt-2.5 pb-2 border-b border-[#F0F0F0]">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1.5">Respuestas rápidas</p>
                    <input
                      autoFocus
                      value={respBusca}
                      onChange={e => setRespBusca(e.target.value)}
                      placeholder="Buscar plantilla…"
                      className="w-full bg-[#FAF9F6] border border-[#E8E8E8] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#00A89D]"
                    />
                  </div>
                  <div className="max-h-[45vh] overflow-y-auto">
                    {respRapidas.length === 0 ? (
                      <p className="px-3 py-4 text-[11px] text-[#9A9A9A] leading-snug">
                        No tienes plantillas generales. Créalas en <b>Bot → Plantillas WhatsApp → Plantilla general</b>.
                      </p>
                    ) : (
                      respRapidas
                        .filter(p => p.nombre.toLowerCase().includes(respBusca.toLowerCase()))
                        .map(p => (
                          <button key={p.id} onClick={() => usarRespuestaRapida(p)}
                            className="w-full text-left px-3 py-2 hover:bg-[#F5F5F5] border-b border-[#F5F5F5] last:border-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-[#0D0D0D] truncate">{p.nombre}</span>
                              {String(p.imagen_url ?? '').startsWith('http') && <span className="text-[10px] shrink-0">🖼️</span>}
                            </div>
                            {p.contenido && <p className="text-[11px] text-[#6B6B6B] line-clamp-2 mt-0.5">{p.contenido}</p>}
                          </button>
                        ))
                    )}
                    {respRapidas.length > 0 && respRapidas.filter(p => p.nombre.toLowerCase().includes(respBusca.toLowerCase())).length === 0 && (
                      <p className="px-3 py-4 text-[11px] text-[#9A9A9A]">Sin resultados.</p>
                    )}
                  </div>
                  <p className="px-3 py-2 text-[10px] leading-snug text-[#9A9A9A] border-t border-[#F0F0F0]">
                    Solo funcionan si el cliente te escribió en las últimas 24 h. El texto se coloca en el cuadro para que lo revises y lo envíes.
                  </p>
                </div>
              )}
            </div>

            {/* 📋 Plantilla de WhatsApp (sirve pasadas las 24 h) */}
            <button
              onClick={() => setPlantillaOpen(true)}
              title="Enviar plantilla de WhatsApp — funciona pasadas las 24 horas"
              className="w-9 h-9 flex items-center justify-center rounded-xl border text-base transition-all shrink-0 bg-[#F5F5F5] border-[#E8E8E8] text-[#6B6B6B] hover:border-[#00A89D]/40 hover:text-[#00A89D]"
            >
              📋
            </button>

            {/* 😊 Emoji */}
            <button
              onClick={() => { setShowEmoji(prev => !prev); setShowAttach(false); }}
              title="Emojis"
              className={`w-9 h-9 flex items-center justify-center rounded-xl border text-lg transition-all shrink-0 ${
                showEmoji
                  ? 'bg-[#00A89D]/10 border-[#00A89D]/40'
                  : 'bg-[#F5F5F5] border-[#E8E8E8] hover:border-[#00A89D]/40'
              }`}
            >
              😊
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              onPaste={pegarDesdePortapapeles}
              placeholder="Escribe un mensaje... (Enter para enviar)"
              rows={1}
              className="flex-1 bg-[#FAF9F6] border border-[#E8E8E8] rounded-xl px-4 py-2.5 text-sm text-[#0D0D0D] placeholder-[#6B6B6B]/60 focus:outline-none focus:border-[#00A89D] resize-none transition-colors leading-relaxed"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />

            {/* Send / Mic */}
            {input.trim() ? (
              <button
                onClick={sendMessage}
                disabled={sending}
                title="Enviar"
                className="w-9 h-9 bg-[#00A89D] text-white rounded-xl flex items-center justify-center text-base font-bold shrink-0 disabled:opacity-30 hover:bg-[#007A72] active:scale-95 transition-all"
              >
                {sending ? <span className="animate-spin text-xs">⏳</span> : '➤'}
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={sending}
                title="Grabar audio"
                className="w-9 h-9 bg-[#F5F5F5] border border-[#E8E8E8] text-[#6B6B6B] rounded-xl flex items-center justify-center text-base shrink-0 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-all disabled:opacity-30"
              >
                🎤
              </button>
            )}
          </div>
        )}
      </div>

      {/* Imagen ampliada: clic para abrir, botones de copiar/descargar, clic derecho nativo */}
      {/* ── Corregir al bot: enseñarle qué debió responder (Quino) ── */}
      {corrigiendo && (
        <div className="fixed inset-0 z-[75] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setCorrigiendo(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[75vh] max-h-[620px] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-[#E8E8E8] flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-[#0D0D0D]">🎓 Corregir al bot</h3>
                <p className="text-[11px] text-[#6B6B6B]">Enséñale qué debió responder para que no lo repita.</p>
              </div>
              <button onClick={() => setCorrigiendo(null)} className="w-8 h-8 rounded-lg hover:bg-[#F5F5F5] text-[#6B6B6B] text-lg">✕</button>
            </div>
            <div className="px-4 pt-3 shrink-0">
              <div className="bg-[#FAF9F6] border-l-[3px] border-[#DC2626] rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold text-[#DC2626] mb-0.5">El bot respondió:</p>
                <p className="text-xs text-[#6B6B6B] line-clamp-3 break-words">{textoDe(corrigiendo)}</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-3">
              <EntrenadorQuino contexto={textoDe(corrigiendo)} compacto placeholder="Escribe qué debió responder…" />
            </div>
          </div>
        </div>
      )}

      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex flex-col"
          onClick={() => setFotoAmpliada(null)}
        >
          <div className="flex items-center justify-end gap-2 px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => copiarImagen(fotoAmpliada)}
              className="px-3 py-1.5 rounded-lg bg-white/15 text-white text-sm hover:bg-white/25"
            >📋 Copiar</button>
            <button
              onClick={() => descargarImagen(fotoAmpliada)}
              className="px-3 py-1.5 rounded-lg bg-white/15 text-white text-sm hover:bg-white/25"
            >⬇ Descargar</button>
            <button
              onClick={() => setFotoAmpliada(null)}
              className="w-9 h-9 rounded-full text-white/80 hover:bg-white/15 flex items-center justify-center text-xl"
              aria-label="Cerrar"
            >✕</button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={e => e.stopPropagation()}>
            {/* Clic derecho del navegador funciona: "Copiar imagen" / "Guardar imagen como" */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoAmpliada} alt="" className="max-h-full max-w-full object-contain rounded-lg select-none" />
          </div>
          <p className="text-center text-white/50 text-xs pb-3">Clic derecho para copiar o guardar · toca fuera para cerrar</p>
        </div>
      )}

      {/* Vista previa antes de enviar */}
      {previewLen > 0 && (() => {
        const actual = preview[previewIdx] ?? preview[0];
        const esImagen = actual.file.type.startsWith('image/');
        const esVideo  = actual.file.type.startsWith('video/');
        return (
          <div className="fixed inset-0 z-50 bg-[#0D0D0D]/95 flex flex-col">
            {/* Barra superior */}
            <div className="flex items-center justify-between px-4 py-3 shrink-0">
              <button
                onClick={cerrarPrevisualizacion}
                className="w-9 h-9 rounded-full text-white/80 hover:bg-white/10 flex items-center justify-center text-xl"
                aria-label="Cancelar"
              >✕</button>
              <span className="text-white/60 text-xs">
                {previewLen > 1 ? `${previewIdx + 1} de ${previewLen}` : actual.file.name}
              </span>
              <button
                onClick={() => quitarDePrevisualizacion(previewIdx)}
                className="w-9 h-9 rounded-full text-white/80 hover:bg-white/10 flex items-center justify-center"
                title="Quitar este archivo"
              >🗑</button>
            </div>

            {/* Vista del archivo */}
            <div className="flex-1 flex items-center justify-center px-4 min-h-0">
              {esImagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={actual.url} alt="" className="max-h-full max-w-full object-contain rounded-lg" />
              ) : esVideo ? (
                <video src={actual.url} controls className="max-h-full max-w-full rounded-lg" />
              ) : (
                <div className="text-center text-white/80">
                  <div className="text-6xl mb-3">📎</div>
                  <p className="text-sm">{actual.file.name}</p>
                  <p className="text-xs text-white/50 mt-1">{Math.round(actual.file.size / 1024)} KB</p>
                </div>
              )}
            </div>

            {/* Pie de foto */}
            <div className="px-4 py-3 shrink-0">
              <div className="max-w-2xl mx-auto flex items-center gap-2 bg-white rounded-2xl px-4 py-2.5">
                <input
                  value={actual.caption}
                  onChange={e => setPreview(prev => prev.map((p, i) => i === previewIdx ? { ...p, caption: e.target.value } : p))}
                  onKeyDown={e => { if (e.key === 'Enter') enviarPrevisualizacion(); }}
                  placeholder="Escribe un mensaje"
                  className="flex-1 text-sm outline-none bg-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Miniaturas + enviar */}
            <div className="px-4 pb-5 shrink-0">
              <div className="max-w-2xl mx-auto flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 overflow-x-auto">
                  {preview.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setPreviewIdx(i)}
                      className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                        i === previewIdx ? 'border-[#00A89D]' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      {p.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-white/10 flex items-center justify-center text-lg">📎</div>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => previewRef.current?.click()}
                    className="w-14 h-14 rounded-lg shrink-0 border-2 border-dashed border-white/30 text-white/60 hover:border-[#00A89D] hover:text-[#00A89D] flex items-center justify-center text-xl"
                    title="Agregar otra"
                  >+</button>
                </div>

                <button
                  onClick={enviarPrevisualizacion}
                  disabled={sending}
                  className="w-14 h-14 rounded-full bg-[#00A89D] text-white flex items-center justify-center text-xl shadow-lg hover:bg-[#00847A] disabled:opacity-50 shrink-0 transition-colors"
                  title="Enviar"
                >{sending ? '…' : '➤'}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {plantillaOpen && (
        <SelectorPlantillaWA
          telefono={conversation.id}
          nombreContacto={conversation.contact_name}
          onCerrar={() => setPlantillaOpen(false)}
          onEnviada={onConversationsUpdate}
        />
      )}

      {/* Revisión de la venta antes de registrarla a mano */}
      {ventaModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E8E8E8] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0D0D0D]">✅ Confirmar venta</h3>
              <button onClick={() => setVentaModal(false)} className="text-[#6B6B6B] hover:text-[#0D0D0D] text-xl leading-none">×</button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <p className="text-[12px] text-[#6B6B6B]">
                Revisa que el pedido esté como quedó con el cliente. Si lo cambiaste por chat,
                corrígelo aquí antes de registrar (así el registro y las estadísticas quedan bien).
              </p>
              <div>
                <label className="text-[11px] font-semibold text-[#6B6B6B] uppercase tracking-wide block mb-1">Producto</label>
                <input
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A89D]/40"
                  value={ventaProducto}
                  onChange={e => setVentaProducto(e.target.value)}
                  placeholder="Ej: NEGRO ESPAÑA"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-[#6B6B6B] uppercase tracking-wide block mb-1">Talla</label>
                  <input
                    className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A89D]/40"
                    value={ventaTalla}
                    onChange={e => setVentaTalla(e.target.value)}
                    placeholder="Ej: L"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-[#6B6B6B] uppercase tracking-wide block mb-1">Valor</label>
                  <input
                    className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A89D]/40"
                    value={ventaValor}
                    onChange={e => setVentaValor(e.target.value)}
                    placeholder="Ej: $129.900"
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[#E8E8E8] flex justify-end gap-3">
              <button
                onClick={() => setVentaModal(false)}
                className="px-4 py-2 text-sm text-[#6B6B6B] hover:text-[#0D0D0D] rounded-xl border border-[#E8E8E8] hover:bg-[#F5F5F5]"
              >Cancelar</button>
              <button
                onClick={confirmarVentaManual}
                disabled={ventaGuardando || !ventaProducto.trim()}
                className="px-5 py-2 text-sm font-semibold bg-[#00A89D] text-white rounded-xl hover:bg-[#008F85] disabled:opacity-40"
              >{ventaGuardando ? 'Registrando…' : 'Registrar venta'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import type { Conversation, Message, ConversationStatus } from '@/lib/panel/types';
import { STATUS_CONFIG } from '@/lib/panel/types';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface Etiqueta { id: string; nombre: string; color: string; }

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

function formatRecTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface Props {
  conversation: Conversation | null;
  messages: Message[];
  onMessageSent: (msg: Message) => void;
  onConversationsUpdate: () => void;
  onBack?: () => void;
}

export default function ChatArea({ conversation, messages, onMessageSent, onConversationsUpdate, onBack }: Props) {
  const [input, setInput]               = useState('');
  const [sending, setSending]           = useState(false);
  const [botEnabled, setBotEnabled]     = useState(true);
  const [status, setStatus]             = useState<ConversationStatus>('nuevo');
  const [statusOpen, setStatusOpen]     = useState(false);
  const [etiquetas, setEtiquetas]       = useState<Etiqueta[]>([]);
  const [labelOpen, setLabelOpen]       = useState(false);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);

  // Media toolbar
  const [showEmoji, setShowEmoji]   = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [recording, setRecording]   = useState(false);
  const [recTime, setRecTime]       = useState(0);

  const bottomRef     = useRef<HTMLDivElement>(null);
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
    setStatus((conversation?.status ?? 'nuevo') as ConversationStatus);
    setCurrentLabel(conversation?.label ?? null);
    setStatusOpen(false);
    setLabelOpen(false);
  }, [conversation?.id, conversation?.bot_enabled, conversation?.status, conversation?.label]);

  useEffect(() => {
    fetch('/api/etiquetas').then(r => r.json()).then(setEtiquetas).catch(() => {});
  }, []);

  useEffect(() => {
    if (!labelOpen) return;
    const h = () => setLabelOpen(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [labelOpen]);

  useEffect(() => {
    if (!statusOpen) return;
    const h = () => setStatusOpen(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [statusOpen]);

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
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: conversation.id, message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        onMessageSent({
          id: data.id ?? `agent-${Date.now()}`,
          conversation_id: conversation.id,
          content: text,
          role: 'agent',
          type: 'text',
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

  // ── Send file/image ────────────────────────────────────────────────────────
  async function sendFile(file: File) {
    if (!conversation || !file) return;
    setSending(true);

    const t = file.type;
    const waType = t.startsWith('image/') ? 'image' : t.startsWith('video/') ? 'video' : t.startsWith('audio/') ? 'audio' : 'document';

    // Create preview URL for immediate display in the panel (in-session only)
    const mediaUrl = (waType === 'image' || waType === 'audio' || waType === 'video')
      ? URL.createObjectURL(file)
      : undefined;

    const fd = new FormData();
    fd.append('to', conversation.id);
    fd.append('file', file);

    try {
      const res = await fetch('/api/whatsapp/send-media', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        const content = waType === 'image' ? '🖼️ Imagen' : waType === 'video' ? '🎬 Video' : waType === 'audio' ? '🎵 Audio' : `📎 ${file.name}`;
        // Prefer permanent Supabase URL returned by API; fall back to ephemeral object URL
        const finalMediaUrl = (data.media_url as string | undefined) ?? mediaUrl;
        onMessageSent({
          id: data.id ?? `agent-media-${Date.now()}`,
          conversation_id: conversation.id,
          content,
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

  // ── Bot / Status / Label ───────────────────────────────────────────────────
  async function toggleBot() {
    if (!conversation) return;
    const newVal = !botEnabled;
    setBotEnabled(newVal);
    await supabase.from('conversations').update({ bot_enabled: newVal }).eq('id', conversation.id);
  }

  async function changeStatus(newStatus: ConversationStatus) {
    if (!conversation) return;
    setStatus(newStatus);
    setStatusOpen(false);
    await supabase.from('conversations').update({ status: newStatus }).eq('id', conversation.id);
    onConversationsUpdate();
  }

  async function changeLabel(nombre: string | null) {
    if (!conversation) return;
    setCurrentLabel(nombre);
    setLabelOpen(false);
    await supabase.from('conversations').update({ label: nombre }).eq('id', conversation.id);
    onConversationsUpdate();
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

  const initial   = conversation.contact_name.charAt(0).toUpperCase() || '?';
  const statusCfg = STATUS_CONFIG[status];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAF9F6]">

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
          {/* Status selector */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setStatusOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
              style={{ color: statusCfg.color, background: statusCfg.bg, borderColor: statusCfg.border }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusCfg.color }} />
              {statusCfg.label}
              <span className="text-[10px] opacity-60">▾</span>
            </button>
            {statusOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E8] rounded-xl shadow-lg z-20 overflow-hidden min-w-[150px]">
                {(Object.keys(STATUS_CONFIG) as ConversationStatus[]).map(s => {
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <button key={s} onClick={() => changeStatus(s)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-all hover:bg-[#F5F5F5] ${status === s ? 'bg-[#F5F5F5]' : ''}`}
                      style={{ color: cfg.color }}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
                      {cfg.label}
                      {status === s && <span className="ml-auto text-[10px] opacity-60">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Label selector */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLabelOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
              style={
                currentLabel && etiquetas.find(e => e.nombre === currentLabel)
                  ? {
                      color: etiquetas.find(e => e.nombre === currentLabel)!.color,
                      background: etiquetas.find(e => e.nombre === currentLabel)!.color + '18',
                      borderColor: etiquetas.find(e => e.nombre === currentLabel)!.color + '40',
                    }
                  : { color: '#6B6B6B', background: '#F5F5F5', borderColor: '#E8E8E8' }
              }
            >
              🏷️ {currentLabel
                ? currentLabel.split(' ').slice(0, 2).join(' ') + (currentLabel.split(' ').length > 2 ? '…' : '')
                : 'Etiqueta'}
              <span className="text-[10px] opacity-60">▾</span>
            </button>
            {labelOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E8] rounded-xl shadow-lg z-20 overflow-hidden min-w-[210px]">
                {currentLabel && (
                  <button onClick={() => changeLabel(null)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-[#6B6B6B] hover:bg-[#F5F5F5] border-b border-[#F5F5F5]">
                    <span className="w-2 h-2 rounded-full bg-[#E8E8E8] shrink-0" />
                    Sin etiqueta
                  </button>
                )}
                {etiquetas.map(etq => (
                  <button key={etq.id} onClick={() => changeLabel(etq.nombre)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium hover:bg-[#F5F5F5] transition-all ${currentLabel === etq.nombre ? 'bg-[#F5F5F5]' : ''}`}
                    style={{ color: etq.color }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: etq.color }} />
                    {etq.nombre}
                    {currentLabel === etq.nombre && <span className="ml-auto text-[10px] opacity-60">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bot toggle */}
          <button
            onClick={toggleBot}
            title={botEnabled ? 'Bot activo — click para pausar' : 'Bot pausado — click para activar'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              botEnabled
                ? 'bg-[#00A89D]/10 text-[#00A89D] border-[#00A89D]/25 hover:bg-[#00A89D]/20'
                : 'bg-[#F5F5F5] text-[#6B6B6B] border-[#E8E8E8] hover:text-[#0D0D0D]'
            }`}
          >
            🤖 Bot {botEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-2">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-24 text-[#6B6B6B] text-xs">
            Sin mensajes aún
          </div>
        )}

        {messages.map(msg => {
          const isOutgoing = msg.role === 'assistant' || msg.role === 'agent';

          // ── Reacción del cliente ──
          if (msg.type === 'reaction') {
            return (
              <div key={msg.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E8E8E8] rounded-full shadow-sm">
                  <span className="text-base">{msg.content}</span>
                  <span className="text-[9px] text-[#6B6B6B]">{formatMsgTime(msg.created_at)}</span>
                </div>
              </div>
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
            <div key={msg.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[68%] rounded-2xl text-sm leading-snug relative shadow-sm overflow-hidden ${
                  msg.type === 'image' && mediaSrc ? 'p-1' : 'px-3.5 py-2.5'
                } ${
                  isOutgoing
                    ? 'bg-[#00A89D] text-white rounded-br-sm'
                    : 'bg-white text-[#0D0D0D] border border-[#E8E8E8] rounded-bl-sm'
                }`}
              >
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
                      className="rounded-xl max-w-full max-h-52 object-cover block"
                    />
                    <div className={`text-[9px] absolute bottom-1 right-1.5 px-1 rounded ${isOutgoing ? 'text-white/70 bg-black/20' : 'text-[#6B6B6B] bg-white/80'}`}>
                      {formatMsgTime(msg.created_at)}
                    </div>
                  </div>
                ) : msg.type === 'audio' && mediaSrc ? (
                  <>
                    <audio controls src={mediaSrc} className="w-full max-w-[220px] h-8" />
                    <div className={`text-[9px] mt-1 text-right ${isOutgoing ? 'text-white/40' : 'text-[#6B6B6B]'}`}>
                      {formatMsgTime(msg.created_at)}
                    </div>
                  </>
                ) : msg.type === 'video' && mediaSrc ? (
                  <>
                    <video controls src={mediaSrc} className="rounded-lg max-w-full max-h-48 block mb-1" />
                    <div className={`text-[9px] text-right ${isOutgoing ? 'text-white/40' : 'text-[#6B6B6B]'}`}>
                      {formatMsgTime(msg.created_at)}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                    <div className={`text-[9px] mt-1.5 text-right ${isOutgoing ? 'text-white/40' : 'text-[#6B6B6B]'}`}>
                      {formatMsgTime(msg.created_at)}
                    </div>
                  </>
                )}
              </div>
            </div>
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
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) sendFile(f); }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) sendFile(f); }}
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
    </div>
  );
}

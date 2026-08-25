'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/* Entrenador Quino (reutilizable).
 * El dueño le habla con sus palabras; Quino propone reglas y el dueño CONFIRMA
 * antes de que el bot las aprenda (candado de seguridad).
 * Se usa en: sección "Entrenar bot", botón "Corregir" del chat, y la burbuja. */

interface Propuesta {
  tipo: 'etiqueta' | 'conocimiento' | 'comportamiento' | 'catalogo';
  resumen: string;
  condicion?: string;
  etiqueta?: string;
  categoria?: string;
  regla?: string;
}
interface Turno {
  role: 'user' | 'assistant';
  content: string;
  propuestas?: Propuesta[];   // en turnos del asistente
  estado?: 'pendiente' | 'guardadas' | 'descartadas';
}

const ETIQUETA_TIPO: Record<string, string> = {
  etiqueta: '🏷 Etiqueta',
  conocimiento: '📚 Dato del negocio',
  comportamiento: '🎯 Comportamiento',
  catalogo: '🛍 Catálogo',
};

export default function EntrenadorQuino({
  contexto,
  compacto,
  onGuardado,
  placeholder,
}: {
  contexto?: string | null;        // mensaje malo del bot que se está corrigiendo
  compacto?: boolean;              // alto reducido (para modal / burbuja)
  onGuardado?: () => void;
  placeholder?: string;
}) {
  const saludo = contexto
    ? '¿Qué debió responder el bot en ese caso? Escríbelo con tus palabras y se lo enseño para que no lo repita.'
    : '¡Hola! Soy Quino. Enséñame o corrígeme al bot con tus palabras. Por ejemplo: "cuando confirmen y den la dirección, márcalo como Venta Realizada", o "si preguntan por envíos a pueblos, di que sí enviamos a todo el país".';

  const [chat, setChat] = useState<Turno[]>([{ role: 'assistant', content: saludo }]);
  const [entrada, setEntrada] = useState('');
  const [pensando, setPensando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat, pensando]);

  const enviar = useCallback(async (texto?: string) => {
    const t = (texto ?? entrada).trim();
    if (!t || pensando) return;
    const historial = chat.filter(m => m.content).map(m => ({ role: m.role, content: m.content }));
    setChat(prev => [...prev, { role: 'user', content: t }]);
    setEntrada('');
    setPensando(true);
    try {
      const res = await fetch('/api/entrenar-bot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'interpretar', mensaje: t, historial, contexto: contexto ?? null }),
      });
      const d = await res.json();
      setChat(prev => [...prev, {
        role: 'assistant',
        content: d.reply || 'Listo.',
        propuestas: Array.isArray(d.propuestas) && d.propuestas.length ? d.propuestas : undefined,
        estado: Array.isArray(d.propuestas) && d.propuestas.length ? 'pendiente' : undefined,
      }]);
    } catch {
      setChat(prev => [...prev, { role: 'assistant', content: 'Se cayó la conexión un momento. Intenta otra vez 🙏' }]);
    }
    setPensando(false);
  }, [entrada, pensando, chat, contexto]);

  async function confirmar(idx: number) {
    const turno = chat[idx];
    if (!turno?.propuestas?.length) return;
    setChat(prev => prev.map((m, i) => i === idx ? { ...m, estado: 'guardadas' } : m));
    try {
      await fetch('/api/entrenar-bot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'aplicar', propuestas: turno.propuestas }),
      });
      onGuardado?.();
    } catch {
      setChat(prev => prev.map((m, i) => i === idx ? { ...m, estado: 'pendiente' } : m));
    }
  }
  function descartar(idx: number) {
    setChat(prev => prev.map((m, i) => i === idx ? { ...m, estado: 'descartadas' } : m));
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={`flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 ${compacto ? 'p-3' : 'p-4'} bg-[#FAF9F6] rounded-xl`}>
        {chat.map((m, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className={`max-w-[88%] text-[13px] leading-relaxed rounded-2xl px-3.5 py-2.5 ${
              m.role === 'user' ? 'self-end bg-[#00A89D] text-white rounded-br-sm' : 'self-start bg-white border border-[#E8E8E8] text-[#3A3A3A] rounded-bl-sm'
            }`}>
              {m.content}
            </div>

            {/* Tarjeta de propuestas para confirmar */}
            {m.propuestas && m.propuestas.length > 0 && (
              <div className="self-start w-[92%] bg-white border border-[#00A89D]/40 rounded-2xl p-3 flex flex-col gap-2 shadow-sm">
                <p className="text-[11px] font-bold text-[#00847A] uppercase tracking-wide">
                  {m.estado === 'guardadas' ? '✅ Aprendido' : m.estado === 'descartadas' ? 'Descartado' : 'Voy a enseñarle esto:'}
                </p>
                {m.propuestas.map((p, k) => (
                  <div key={k} className="bg-[#FAF9F6] rounded-xl px-3 py-2 flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-[#6B6B6B]">{ETIQUETA_TIPO[p.tipo] ?? p.tipo}</span>
                    {p.tipo === 'etiqueta' ? (
                      <span className="text-xs text-[#0D0D0D]">
                        Si <strong>{p.condicion}</strong> → <span className="text-[#007A72] font-bold">{p.etiqueta}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-[#0D0D0D]">{p.regla}</span>
                    )}
                  </div>
                ))}
                {(!m.estado || m.estado === 'pendiente') && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => confirmar(i)} className="flex-1 py-2 rounded-xl bg-[#00A89D] text-white text-xs font-bold hover:bg-[#007A72] transition-colors">
                      Sí, enséñaselo
                    </button>
                    <button onClick={() => descartar(i)} className="px-4 py-2 rounded-xl border border-[#E8E8E8] text-[#6B6B6B] text-xs font-medium hover:bg-[#F5F5F5] transition-colors">
                      No
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {pensando && <div className="self-start text-xs text-[#6B6B6B] px-3 py-2">Quino está pensando…</div>}
        <div ref={finRef} />
      </div>

      <div className="flex gap-2 pt-3 shrink-0">
        <input
          value={entrada}
          onChange={e => setEntrada(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') enviar(); }}
          placeholder={placeholder ?? 'Escríbele a Quino…'}
          disabled={pensando}
          className="flex-1 bg-white border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm text-[#0D0D0D] placeholder:text-[#B5B5B5] focus:outline-none focus:border-[#00A89D]"
        />
        <button
          onClick={() => enviar()}
          disabled={pensando || !entrada.trim()}
          className="px-4 py-2.5 rounded-xl bg-[#0D0D0D] text-white text-sm font-bold hover:bg-[#333] disabled:opacity-40 transition-colors shrink-0"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

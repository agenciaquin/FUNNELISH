'use client';

import type { EventoComentario, EventoPregunta } from '@/lib/live/tipos';

export interface ComentarioPropio {
  id: number;
  texto: string;
  /** 'yo' = lo escribió el visitante · 'ia' = asistente · 'demo' = ambiente/pregunta preparada ·
   *  'publico' = comentario real de otra persona (guardado) · 'faq' = pregunta frecuente del equipo. */
  autor?: 'yo' | 'ia' | 'demo' | 'publico' | 'faq';
  /** Nombre a mostrar (demo / público). */
  nombre?: string;
  /** Solo para 'faq'. */
  pregunta?: string;
  respuesta?: string;
  escribiendo?: boolean;
  /** Enlace a WhatsApp cuando el asistente no tiene el dato. */
  waUrl?: string;
}

interface Props {
  mensajes: Array<EventoPregunta | EventoComentario>;
  /** Comentarios que escribió el propio visitante (solo se ven en su pantalla). */
  propios: ComentarioPropio[];
  logo?: string;
}

const sombra = '[text-shadow:0_1px_3px_rgba(0,0,0,.85)]';

function Avatar({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold overflow-hidden ${className}`}>
      {children}
    </span>
  );
}

/**
 * Comentarios superpuestos (izquierda, con desvanecido hacia arriba). Tres tipos, bien diferenciados:
 *  · Pregunta frecuente → respuesta del equipo (avatar con el logo + insignia).
 *  · Comentario de cliente → en la maqueta SIEMPRE marcado DEMO; sin fotos ni nombres de personas.
 *  · Comentario propio → lo que escribe el visitante, solo en su pantalla.
 */
export default function CommentsFeed({ mensajes, propios, logo }: Props) {
  return (
    <div className="live-fade-up flex flex-col justify-end gap-2.5 max-h-[30vh] overflow-hidden pointer-events-none" aria-live="polite">
      {mensajes.map(m =>
        m.tipo === 'pregunta_frecuente' ? (
          <div key={`${m.tipo}-${m.inicio}`} className="live-in flex items-start gap-2 max-w-[94%]">
            <Avatar className="bg-white">{logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="" className="w-full h-full object-contain p-0.5" />}</Avatar>
            <div className="rounded-2xl rounded-tl-md bg-[#00A89D]/90 px-3 py-1.5 text-white">
              <span className="inline-block text-[9px] font-bold uppercase tracking-wide bg-white text-[#007A72] rounded-full px-2 py-0.5 mb-0.5">✓ Pregunta frecuente · Equipo</span>
              <p className="text-[13px] font-semibold leading-snug">{m.contenido.pregunta}</p>
              <p className="text-[13px] leading-snug">{m.contenido.respuesta}</p>
            </div>
          </div>
        ) : (
          <div key={`${m.tipo}-${m.inicio}`} className="live-in flex items-start gap-2 max-w-[90%] text-white">
            <Avatar className="bg-white/25 text-white/90">C</Avatar>
            <p className={`text-[13px] leading-snug ${sombra}`}>
              <span className="font-semibold text-white/75">{m.contenido.autor}</span>
              <span className="ml-1.5 text-[8px] font-bold bg-amber-400 text-black rounded px-1 py-px align-middle [text-shadow:none]">DEMO</span>
              <br />{m.contenido.texto}
            </p>
          </div>
        ),
      )}
      {propios.map(c => c.autor === 'ia' ? (
        <div key={c.id} className="live-in flex items-start gap-2 max-w-[94%] text-white">
          <Avatar className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[15px]">✨</Avatar>
          <div className="rounded-2xl rounded-tl-md bg-black/60 border border-violet-300/40 px-3 py-1.5">
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide bg-violet-500 text-white rounded-full px-2 py-0.5 mb-0.5">
              ✨ Asistente IA
              <span className="bg-amber-400 text-black rounded px-1 text-[8px]">DEMO</span>
            </span>
            {c.escribiendo
              ? <p className="text-[13px] leading-snug text-white/80">Escribiendo…</p>
              : <p className="text-[13px] leading-snug">{c.texto}</p>}
            {c.waUrl && (
              <a href={c.waUrl} target="_blank" rel="noopener noreferrer" className="pointer-events-auto mt-1 inline-flex items-center gap-1 rounded-full bg-[#25D366] text-black text-[12px] font-bold px-3 py-1">
                💬 Preguntar por WhatsApp
              </a>
            )}
          </div>
        </div>
      ) : c.autor === 'faq' ? (
        <div key={c.id} className="live-in flex items-start gap-2 max-w-[94%]">
          <Avatar className="bg-white">{logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="" className="w-full h-full object-contain p-0.5" />}</Avatar>
          <div className="rounded-2xl rounded-tl-md bg-[#00A89D]/90 px-3 py-1.5 text-white">
            <span className="inline-block text-[9px] font-bold uppercase tracking-wide bg-white text-[#007A72] rounded-full px-2 py-0.5 mb-0.5">✓ Pregunta frecuente · Equipo</span>
            <p className="text-[13px] font-semibold leading-snug">{c.pregunta}</p>
            <p className="text-[13px] leading-snug">{c.respuesta}</p>
          </div>
        </div>
      ) : c.autor === 'publico' ? (
        <div key={c.id} className="live-in flex items-start gap-2 max-w-[90%] text-white">
          <Avatar className="bg-sky-500/80 text-white">{(c.nombre || 'C').charAt(0).toUpperCase()}</Avatar>
          <p className={`text-[13px] leading-snug ${sombra}`}>
            <span className="font-semibold text-white/75">{c.nombre || 'Cliente'}</span>
            <br />{c.texto}
          </p>
        </div>
      ) : c.autor === 'demo' ? (
        <div key={c.id} className="live-in flex items-start gap-2 max-w-[90%] text-white">
          <Avatar className="bg-white/25 text-white/90">{(c.nombre || 'C').charAt(0).toUpperCase()}</Avatar>
          <p className={`text-[13px] leading-snug ${sombra}`}>
            <span className="font-semibold text-white/75">{c.nombre || 'Cliente'}</span>
            <span className="ml-1.5 text-[8px] font-bold bg-amber-400 text-black rounded px-1 py-px align-middle [text-shadow:none]">DEMO</span>
            <br />{c.texto}
          </p>
        </div>
      ) : (
        <div key={c.id} className="live-in flex items-start gap-2 max-w-[90%] text-white">
          <Avatar className="bg-[#ff3366]">Tú</Avatar>
          <p className={`text-[13px] leading-snug ${sombra}`}><span className="font-semibold text-white/75">Tú</span><br />{c.texto}</p>
        </div>
      ))}
    </div>
  );
}

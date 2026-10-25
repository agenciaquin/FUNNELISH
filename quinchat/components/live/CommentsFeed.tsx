'use client';

import type { EventoComentario, EventoPregunta } from '@/lib/live/tipos';

/**
 * Columna de comentarios (izquierda, con desvanecido hacia arriba).
 * Dos tipos bien diferenciados:
 *  · Pregunta frecuente → respuesta del equipo, con insignia.
 *  · Comentario de cliente → en la maqueta SIEMPRE marcado DEMO (no son personas reales).
 */
export default function CommentsFeed({ mensajes }: { mensajes: Array<EventoPregunta | EventoComentario> }) {
  return (
    <div className="live-fade-up flex flex-col justify-end gap-2 max-h-[34vh] overflow-hidden pointer-events-none" aria-live="polite">
      {mensajes.map(m =>
        m.tipo === 'pregunta_frecuente' ? (
          <div key={`${m.tipo}-${m.inicio}`} className="live-in rounded-2xl rounded-bl-md bg-[#00A89D]/90 text-white px-3 py-2 shadow-lg max-w-[92%]">
            <span className="inline-block text-[9px] font-bold uppercase tracking-wide bg-white text-[#007A72] rounded-full px-2 py-0.5 mb-1">
              ✓ Pregunta frecuente · Equipo
            </span>
            <p className="text-[12px] font-semibold leading-snug">{m.contenido.pregunta}</p>
            <p className="text-[12px] leading-snug text-white/95 mt-0.5">{m.contenido.respuesta}</p>
          </div>
        ) : (
          <div key={`${m.tipo}-${m.inicio}`} className="live-in rounded-2xl rounded-bl-md bg-black/45 backdrop-blur text-white px-3 py-1.5 max-w-[85%]">
            <p className="text-[11px] leading-snug">
              <span className="font-semibold text-white/80">{m.contenido.autor}</span>
              <span className="ml-1 text-[8px] font-bold bg-amber-400 text-black rounded px-1 py-px align-middle">DEMO</span>
            </p>
            <p className="text-[12px] leading-snug">{m.contenido.texto}</p>
          </div>
        ),
      )}
    </div>
  );
}

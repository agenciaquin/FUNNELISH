'use client';

import { useState, useEffect, useCallback } from 'react';
import EntrenadorQuino from './EntrenadorQuino';

/* Sección "Entrenar bot": el dueño le habla a Quino para enseñar/corregir al
 * bot vendedor, y ve todo lo que el bot ya sabe (para borrar lo que sobre). */

interface ReglaMem {
  id: string;
  regla: string;
  categoria: string | null;
  aprobada_at?: string | null;
}

export default function EntrenarBotPanel() {
  const [aprendido, setAprendido] = useState<ReglaMem[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [borrando, setBorrando]   = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch('/api/memoria?estado=aprobada');
      if (res.ok) {
        const d = await res.json();
        setAprendido(Array.isArray(d.reglas) ? d.reglas : []);
      }
    } catch { /* red */ }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function borrar(id: string) {
    setBorrando(null);
    setAprendido(prev => prev.filter(r => r.id !== id));
    try {
      await fetch('/api/memoria', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'borrar-definitivo', id }),
      });
    } catch { cargar(); }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#FAF9F6] overflow-hidden">
      {/* Encabezado */}
      <div className="px-6 py-4 border-b border-[#E8E8E8] bg-white shrink-0">
        <h2 className="text-[#0D0D0D] font-semibold text-base flex items-center gap-2">🎓 Entrenar al bot con Quino</h2>
        <p className="text-[#6B6B6B] text-xs mt-0.5">Háblale a Quino con tus palabras para enseñarle o corregir al bot. Tú confirmas antes de que aprenda.</p>
        <div className="mt-2 text-[11px] text-[#00847A] bg-[#00A89D]/[0.08] border border-[#00A89D]/20 rounded-lg px-3 py-2 leading-relaxed">
          <b>¿Para qué es esta pantalla?</b> Es para <b>corregir o enseñarle cosas puntuales</b> cuando el bot <b>ya está funcionando</b> — el mantenimiento del día a día.
          Ej: <i>"cuando confirmen y den la dirección, márcalo como Venta Realizada"</i> o <i>"no digas que no enviamos a pueblos, sí llegamos a todo el país"</i>.
          <br />👉 Si en cambio quieres <b>crear el bot desde cero</b> respondiendo un cuestionario, usa <b>🪄 Arma tu bot</b>.
        </div>
      </div>

      {/* Cuerpo: chat + lo aprendido */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-4 p-4 overflow-hidden">
        {/* Chat entrenador */}
        <div className="lg:col-span-3 bg-white border border-[#E8E8E8] rounded-2xl p-3 flex flex-col min-h-0 overflow-hidden">
          <EntrenadorQuino onGuardado={cargar} placeholder="Ej: si preguntan por la garantía, di que son 2 meses…" />
        </div>

        {/* Lo que el bot ya sabe */}
        <div className="lg:col-span-2 bg-white border border-[#E8E8E8] rounded-2xl p-4 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className="text-sm font-semibold text-[#0D0D0D]">Lo que tu bot ya sabe</h3>
            <span className="text-[10px] text-[#6B6B6B] bg-[#FAF9F6] rounded-full px-2 py-0.5">{aprendido.length}</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
            {cargando && <div className="text-xs text-[#6B6B6B] text-center py-4">Cargando…</div>}
            {!cargando && aprendido.length === 0 && (
              <div className="text-xs text-[#6B6B6B] text-center py-6 bg-[#FAF9F6] rounded-xl">
                Aún no le has enseñado nada por aquí. Empieza escribiéndole a Quino a la izquierda.
              </div>
            )}
            {aprendido.map(r => (
              <div key={r.id} className="border border-[#E8E8E8] rounded-xl p-2.5 flex items-start gap-2 group">
                <div className="flex-1 min-w-0">
                  {r.categoria && <span className="text-[10px] font-bold text-[#6B6B6B] uppercase">{r.categoria}</span>}
                  <p className="text-xs text-[#0D0D0D] leading-snug">{r.regla}</p>
                </div>
                {borrando === r.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => borrar(r.id)} className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded-lg">Sí</button>
                    <button onClick={() => setBorrando(null)} className="px-2 py-1 border border-[#E8E8E8] text-[#6B6B6B] text-[10px] rounded-lg">No</button>
                  </div>
                ) : (
                  <button onClick={() => setBorrando(r.id)} title="Que el bot lo olvide" className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg bg-[#F5F5F5] border border-[#E8E8E8] text-[#6B6B6B] hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity">🗑</button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#9A9A9A] mt-2 shrink-0">Las etiquetas automáticas se gestionan en la sección <strong>Etiquetas</strong>.</p>
        </div>
      </div>
    </div>
  );
}

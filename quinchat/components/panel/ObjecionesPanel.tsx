'use client';

import { useState, useEffect, useCallback } from 'react';
import { COLOR_OBJ, EMOJI_OBJ } from '@/lib/objeciones';

interface Ejemplo {
  conversation_id: string;
  detalle: string | null;
  cita: string | null;
  fecha: string;
}
interface CatResumen {
  categoria: string;
  total: number;
  ejemplos: Ejemplo[];
}

interface Props {
  onAbrirChat?: (id: string) => void;
}

export default function ObjecionesPanel({ onAbrirChat }: Props) {
  const [dias, setDias]         = useState(7);
  const [total, setTotal]       = useState(0);
  const [cats, setCats]         = useState<CatResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [analizando, setAnalizando] = useState(false);
  const [aviso, setAviso]       = useState<string | null>(null);
  const [abierta, setAbierta]   = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res  = await fetch(`/api/objeciones/resumen?dias=${dias}`, { cache: 'no-store' });
      const data = await res.json();
      setCats(data.categorias ?? []);
      setTotal(data.total ?? 0);
    } finally { setCargando(false); }
  }, [dias]);

  useEffect(() => { cargar(); }, [cargar]);

  async function analizarAhora() {
    setAnalizando(true);
    setAviso(null);
    try {
      const res  = await fetch('/api/cron/objeciones?horas=48', { cache: 'no-store' });
      const data = await res.json();
      if (data.status === 'ok')                 setAviso(`✅ Clasifiqué ${data.clasificados} chats perdidos de ${data.analizados} revisados.`);
      else if (data.status === 'sin-perdidos')  setAviso('Revisé y no encontré chats perdidos para clasificar (o siguen activos).');
      else if (data.status === 'sin-material')  setAviso('Todavía no hay suficientes conversaciones para analizar.');
      else if (data.error)                      setAviso(`❌ ${data.error}`);
      await cargar();
    } catch (e: any) {
      setAviso(`❌ ${e?.message ?? 'Error inesperado.'}`);
    } finally { setAnalizando(false); }
  }

  const maxTotal = cats.reduce((m, c) => Math.max(m, c.total), 0) || 1;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">

        <header className="mb-5 pl-10 md:pl-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">¿Por qué no compran?</h1>
          <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
            Cada noche la IA revisa los chats que NO terminaron en venta y los clasifica por
            objeción. Así ves qué está frenando tus ventas y puedes atacarlo.
          </p>
        </header>

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {[7, 15, 30].map(d => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                dias === d ? 'bg-[#00A89D] text-white shadow-sm' : 'text-[#6B6B6B] hover:text-[#0D0D0D] hover:bg-[#F0F0F0]'
              }`}
            >{d} días</button>
          ))}
          <div className="flex-1" />
          <button
            onClick={analizarAhora}
            disabled={analizando}
            className="px-3 py-2 rounded-lg text-xs font-semibold border border-[#00A89D]/40 text-[#00847A] hover:bg-[#00A89D]/10 disabled:opacity-50"
          >
            {analizando ? 'Revisando chats…' : '🔍 Revisar ahora'}
          </button>
        </div>

        {aviso && <div className="mb-4 text-xs p-3 rounded-xl bg-white border border-[#E8E8E8] text-[#0D0D0D]">{aviso}</div>}

        {cargando ? (
          <p className="text-sm text-[#6B6B6B] py-12 text-center">Cargando…</p>
        ) : total === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="text-4xl mb-3 opacity-30">🔍</div>
            <p className="text-sm text-[#6B6B6B]">
              Aún no hay chats perdidos clasificados. Pulsa <strong>“Revisar ahora”</strong> para
              analizar los últimos días, o espera al análisis automático de la noche.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 bg-white rounded-2xl border border-[#E8E8E8] p-4 shadow-sm">
              <p className="text-xs text-[#6B6B6B] mb-3">
                <strong className="text-[#0D0D0D]">{total}</strong> chats perdidos en los últimos {dias} días.
                La barra más larga es tu mayor fuga de ventas.
              </p>
              <div className="space-y-2.5">
                {cats.map(c => {
                  const color = COLOR_OBJ[c.categoria] ?? '#6B7280';
                  const pct = Math.round((c.total / total) * 100);
                  return (
                    <button
                      key={c.categoria}
                      onClick={() => setAbierta(abierta === c.categoria ? null : c.categoria)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm shrink-0">{EMOJI_OBJ[c.categoria] ?? '•'}</span>
                        <span className="text-xs font-semibold text-[#0D0D0D]">{c.categoria}</span>
                        <span className="text-[11px] text-[#9A9A9A]">{c.total} · {pct}%</span>
                        <span className="ml-auto text-[10px] text-[#9A9A9A] group-hover:text-[#00847A]">
                          {abierta === c.categoria ? 'ocultar ▲' : 'ver ejemplos ▾'}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-[#F0F0F0] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.max(6, (c.total / maxTotal) * 100)}%`, background: color }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ejemplos de la categoría abierta */}
            {abierta && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-[#0D0D0D] flex items-center gap-1.5">
                  {EMOJI_OBJ[abierta]} Ejemplos — {abierta}
                </h3>
                {(cats.find(c => c.categoria === abierta)?.ejemplos ?? []).map((e, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-[#E8E8E8] p-4 shadow-sm">
                    {e.detalle && <p className="text-sm text-[#0D0D0D] leading-snug mb-1.5">{e.detalle}</p>}
                    {e.cita && (
                      <p className="text-[11px] text-[#6B6B6B] italic border-l-2 border-[#E8E8E8] pl-2 mb-2">“{e.cita}”</p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#9A9A9A]">{e.fecha}</span>
                      {onAbrirChat && (
                        <button
                          onClick={() => onAbrirChat(e.conversation_id)}
                          className="ml-auto text-[11px] font-semibold text-[#00847A] hover:underline"
                        >Abrir chat →</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p className="text-[10px] text-[#9A9A9A] text-center mt-6 leading-relaxed">
          Tip: si “Precio” o “Desconfianza” dominan, ajusta el guion del bot o suma pruebas sociales.
          Lo que aprendas puedes enseñárselo en <strong>Memoria del bot</strong>.
        </p>
      </div>
    </div>
  );
}

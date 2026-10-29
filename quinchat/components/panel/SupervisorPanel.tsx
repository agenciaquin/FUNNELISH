'use client';

import { useState, useEffect, useCallback } from 'react';

interface Leccion {
  id: string; regla: string; estado: 'aprobada' | 'propuesta'; ejemplo: string | null;
  conversacion_id: string | null; creada_at: string; riesgo: 'bajo' | 'alto' | null; auto: boolean | null;
}
interface ErrorAud { mensaje?: number; tipo: string; descripcion: string; gravedad?: string }
interface Auditoria {
  conversation_id: string; resultado: string; puntaje: number; perfil: string; resumen: string;
  errores: ErrorAud[]; aciertos: string[]; etapas: Record<string, number | null> | null; creado_at: string;
}
interface Datos {
  resumen: { auditadas: number; sinInteraccion: number; nota: number | null; notaVendidas: number | null; notaPerdidas: number | null; leccionesActivas: number; leccionesPorRevisar: number };
  tendencia: { dia: string; nota: number; chats: number; vendidas: number }[];
  topErrores: { tipo: string; etiqueta: string; n: number; ejemplo: string; chat: string }[];
  perfiles: { perfil: string; etiqueta: string; chats: number; vendidas: number; conversion: number; nota: number | null }[];
  notaEtapas: Record<string, number>;
  auditorias: Auditoria[];
  lecciones: Leccion[];
}

const ETAPAS: [string, string][] = [['bienvenida', 'Bienvenida'], ['eleccion', 'Elección'], ['talla', 'Talla'], ['datos', 'Datos'], ['cierre', 'Cierre']];
const colorNota = (n: number | null | undefined) => n == null ? '#9A9A9A' : n >= 75 ? '#15803D' : n >= 55 ? '#B45309' : '#DC2626';

export default function SupervisorPanel({ onAbrirChat }: { onAbrirChat?: (id: string) => void }) {
  const [dias, setDias] = useState(7);
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [revisando, setRevisando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [modo, setModo] = useState<{ activo: boolean; hasta: string | null } | null>(null);
  const [aprendiendo, setAprendiendo] = useState(false);
  const [metodo, setMetodo] = useState<{ metodo: any; activo: boolean; actualizado: string | null; chats: number } | null>(null);
  const [verMetodo, setVerMetodo] = useState(false);
  const cargarMetodo = useCallback(async () => {
    try { const r = await fetch('/api/supervisor/metodo', { cache: 'no-store' }); if (r.ok) setMetodo(await r.json()); } catch { /* ignorar */ }
  }, []);
  useEffect(() => { cargarMetodo(); }, [cargarMetodo]);
  async function alternarMetodo() {
    if (!metodo) return;
    await fetch('/api/supervisor/metodo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !metodo.activo }) });
    await cargarMetodo();
  }

  const cargarModo = useCallback(async () => {
    try { const r = await fetch('/api/supervisor/modo', { cache: 'no-store' }); if (r.ok) setModo(await r.json()); } catch { /* ignorar */ }
  }, []);
  useEffect(() => { cargarModo(); }, [cargarModo]);

  async function cambiarModo(activo: boolean) {
    if (!activo && !confirm('¿Terminar el modo "solo bienvenida"? El bot vuelve a responder toda la conversación en los chats que apagó este modo.')) return;
    const r = await fetch('/api/supervisor/modo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo }) });
    const j = await r.json();
    setAviso(activo ? '✅ Modo "solo bienvenida" activo hasta las 11:59 pm: el bot solo responde el primer mensaje y tú atiendes el resto.'
                    : `✅ Modo terminado. El bot volvió a prenderse en ${j.reactivados ?? 0} chat(s).`);
    await cargarModo();
  }

  async function aprenderDeMi() {
    setAprendiendo(true); setAviso(null);
    try {
      const r = await fetch('/api/supervisor/aprender', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      setAviso(j.chats
        ? `📚 Leí ${j.chats} chat(s) que atendiste a mano. ${j.metodo ? `Actualicé tu MÉTODO DE VENTA (${j.metodo} pasos). ` : ''}Aprendí ${j.nuevas} cosa(s): ${j.activas} ya activas y ${j.porAprobar} por aprobar (tocan precios/pagos/envíos).`
        : (j.motivo || 'No encontré respuestas tuyas hoy.'));
      await Promise.all([cargar(), cargarMetodo()]);
    } catch (e: any) { setAviso(`❌ ${e.message}`); }
    finally { setAprendiendo(false); }
  }

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`/api/supervisor?dias=${dias}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo cargar');
      setD(j);
    } catch (e: any) { setAviso(`❌ ${e.message}`); }
    finally { setCargando(false); }
  }, [dias]);
  useEffect(() => { cargar(); }, [cargar]);

  async function revisarAhora() {
    setRevisando(true); setAviso(null);
    try {
      const r = await fetch('/api/supervisor', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      setAviso(j.auditados || j.omitidos
        ? `✅ Revisé ${j.auditados} chats (${j.omitidos} sin interacción). ${j.lecciones} lección(es) nueva(s), ${j.auto} activada(s) sola(s).`
        : 'No hay chats terminados nuevos para revisar (se revisan los que llevan 3 h quietos).');
      await cargar();
    } catch (e: any) { setAviso(`❌ ${e.message}`); }
    finally { setRevisando(false); }
  }

  async function accion(id: string, acc: 'aprobar' | 'desactivar') {
    await fetch('/api/supervisor', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, accion: acc }) });
    await cargar();
  }

  const r = d?.resumen;
  const porRevisar = (d?.lecciones ?? []).filter(l => l.estado === 'propuesta');
  const activas = (d?.lecciones ?? []).filter(l => l.estado === 'aprobada');
  const maxErr = Math.max(1, ...(d?.topErrores ?? []).map(e => e.n));

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        <header className="mb-5 pl-10 md:pl-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">🧑‍🏫 Supervisor del bot</h1>
          <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
            Revisa cada chat de ventas que terminó, califica al bot por etapa, señala el error exacto y le enseña.
            Las lecciones de <b>bajo riesgo</b> (forma de vender) se activan solas; las que tocan <b>precios, pagos, envíos o políticas</b> esperan tu aprobación.
          </p>
        </header>

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {[7, 15, 30].map(x => (
            <button key={x} onClick={() => setDias(x)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold ${dias === x ? 'bg-[#00A89D] text-white shadow-sm' : 'text-[#6B6B6B] hover:bg-[#F0F0F0]'}`}>
              Últimos {x} días
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={revisarAhora} disabled={revisando}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0D0D0D] text-white hover:opacity-90 disabled:opacity-50">
            {revisando ? 'Revisando chats…' : '🔍 Revisar ahora'}
          </button>
        </div>

        {/* Modo temporal: el bot solo da la bienvenida y el dueño atiende para enseñarle */}
        <section className={`rounded-2xl border p-4 mb-5 ${modo?.activo ? 'bg-[#FFFBEB] border-[#F59E0B]/50' : 'bg-white border-[#E8E8E8]'}`}>
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <h2 className="text-sm font-bold">🎓 Enséñale al bot cómo vendes tú</h2>
              <p className="text-[11px] text-[#6B6B6B] mt-0.5 leading-relaxed">
                Con el modo <b>“solo bienvenida”</b> el bot del Chat WhatsApp solo responde el primer mensaje (catálogo) y se apaga en ese chat; tú atiendes el resto.
                Al final del día dale <b>“Aprender de mis respuestas de hoy”</b>: guarda tu estilo, tus respuestas a las preguntas y cómo cierras.
              </p>
              <p className="text-[11px] mt-1 font-semibold" style={{ color: modo?.activo ? '#B45309' : '#6B6B6B' }}>
                {modo?.activo ? `● Modo activo hasta ${modo.hasta ? new Date(modo.hasta).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'hoy'}` : '○ Modo apagado: el bot responde toda la conversación'}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {modo?.activo
                ? <button onClick={() => cambiarModo(false)} className="px-3 py-2 rounded-lg text-xs font-semibold border border-[#E8E8E8] bg-white hover:bg-[#F5F5F5]">⏹ Terminar modo y prender el bot</button>
                : <button onClick={() => cambiarModo(true)} className="px-3 py-2 rounded-lg text-xs font-semibold border border-[#F59E0B] text-[#B45309] bg-white hover:bg-[#FFFBEB]">▶ Activar “solo bienvenida” hoy</button>}
              <button onClick={aprenderDeMi} disabled={aprendiendo} className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#00A89D] text-white hover:bg-[#00847A] disabled:opacity-50">
                {aprendiendo ? 'Leyendo tus chats…' : '📚 Aprender de mis respuestas de hoy'}
              </button>
            </div>
          </div>
        </section>

        {/* El MÉTODO DE VENTA aprendido (flujo completo) */}
        {metodo?.metodo && (
          <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4 mb-5">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <h2 className="text-sm font-bold">🧭 Tu método de venta (lo que el bot replica)</h2>
                <p className="text-[11px] text-[#6B6B6B] mt-0.5">{metodo.metodo.resumen}</p>
                <p className="text-[11px] mt-1 font-semibold" style={{ color: metodo.activo ? '#15803D' : '#9A9A9A' }}>
                  {metodo.activo ? '● El bot lo está usando' : '○ Desactivado'} · aprendido de {metodo.chats} chat(s){metodo.actualizado ? ` · actualizado ${new Date(metodo.actualizado).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setVerMetodo(v => !v)} className="px-3 py-2 rounded-lg text-xs font-semibold border border-[#E8E8E8] hover:bg-[#F5F5F5]">{verMetodo ? 'Ocultar' : 'Ver los pasos'}</button>
                <button onClick={alternarMetodo} className={`px-3 py-2 rounded-lg text-xs font-semibold ${metodo.activo ? 'border border-[#DC2626]/40 text-[#DC2626]' : 'bg-[#15803D] text-white'}`}>{metodo.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
            </div>
            {verMetodo && (
              <div className="mt-3 space-y-2 text-xs">
                {(metodo.metodo.pasos ?? []).map((p: any, i: number) => (
                  <div key={i} className="rounded-xl border border-[#EFEFEF] p-3">
                    <p className="font-bold text-[#0D0D0D]">Paso {i + 1} · {p.nombre}</p>
                    <p className="text-[#6B6B6B]">🎯 {p.objetivo}</p>
                    {(p.como ?? []).map((c: string, k: number) => <p key={k} className="text-[#00847A]">💬 “{c}”</p>)}
                    {p.avanzar_cuando && <p className="text-[#9A9A9A]">➡️ Avanza cuando: {p.avanzar_cuando}</p>}
                  </div>
                ))}
                {(metodo.metodo.objeciones ?? []).length > 0 && (
                  <div className="rounded-xl border border-[#EFEFEF] p-3">
                    <p className="font-bold mb-1">Cómo respondes las dudas</p>
                    {metodo.metodo.objeciones.map((o: any, k: number) => <p key={k}><b>“{o.objecion}”</b> → {o.respuesta}</p>)}
                  </div>
                )}
                {metodo.metodo.ejemplo && <pre className="rounded-xl bg-[#FAFAFA] border border-[#EFEFEF] p-3 whitespace-pre-wrap font-sans">{metodo.metodo.ejemplo}</pre>}
              </div>
            )}
          </section>
        )}

        {aviso && <div className="mb-4 rounded-xl border border-[#E8E8E8] bg-white px-4 py-3 text-xs text-[#0D0D0D]">{aviso}</div>}

        {cargando && !d ? <p className="text-sm text-[#6B6B6B] py-10 text-center">Cargando…</p> : d && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="bg-white rounded-xl border border-[#E8E8E8] p-3">
                <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">Nota del bot</p>
                <p className="text-2xl font-extrabold" style={{ color: colorNota(r?.nota) }}>{r?.nota ?? '—'}<span className="text-xs text-[#9A9A9A]">/100</span></p>
                <p className="text-[11px] text-[#6B6B6B]">{r?.auditadas} chats revisados</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E8E8E8] p-3">
                <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">Vendidas vs perdidas</p>
                <p className="text-lg font-extrabold"><span style={{ color: colorNota(r?.notaVendidas) }}>{r?.notaVendidas ?? '—'}</span> <span className="text-[#CCC]">vs</span> <span style={{ color: colorNota(r?.notaPerdidas) }}>{r?.notaPerdidas ?? '—'}</span></p>
                <p className="text-[11px] text-[#6B6B6B]">nota promedio</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E8E8E8] p-3">
                <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">Lecciones activas</p>
                <p className="text-2xl font-extrabold text-[#00847A]">{r?.leccionesActivas}</p>
                <p className="text-[11px] text-[#6B6B6B]">enseñadas por el supervisor</p>
              </div>
              <div className={`rounded-xl border p-3 ${r?.leccionesPorRevisar ? 'bg-[#FFFBEB] border-[#F59E0B]/50' : 'bg-white border-[#E8E8E8]'}`}>
                <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">Por revisar</p>
                <p className="text-2xl font-extrabold text-[#B45309]">{r?.leccionesPorRevisar}</p>
                <p className="text-[11px] text-[#6B6B6B]">necesitan tu aprobación</p>
              </div>
            </div>

            {/* Lecciones por revisar */}
            {porRevisar.length > 0 && (
              <section className="bg-white rounded-2xl border border-[#F59E0B]/50 p-4 mb-5">
                <h2 className="text-sm font-bold mb-1">⚠️ Lecciones importantes por aprobar</h2>
                <p className="text-[11px] text-[#6B6B6B] mb-3">Tocan precios, pagos, envíos o políticas. No entran al bot hasta que las apruebes.</p>
                <div className="space-y-2">
                  {porRevisar.map(l => (
                    <div key={l.id} className="rounded-xl border border-[#EFEFEF] p-3">
                      <p className="text-sm text-[#0D0D0D]">{l.regla}</p>
                      {l.ejemplo && <p className="text-[11px] text-[#6B6B6B] mt-1">💡 {l.ejemplo}</p>}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <button onClick={() => accion(l.id, 'aprobar')} className="px-3 py-1.5 rounded-lg bg-[#15803D] text-white text-xs font-semibold">✅ Aprobar</button>
                        <button onClick={() => accion(l.id, 'desactivar')} className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs font-semibold">❌ Descartar</button>
                        {l.conversacion_id && onAbrirChat && <button onClick={() => onAbrirChat(l.conversacion_id!)} className="px-3 py-1.5 rounded-lg text-[#00847A] text-xs font-semibold hover:underline">Ver el chat →</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="grid md:grid-cols-2 gap-5 mb-5">
              {/* Top errores */}
              <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4">
                <h2 className="text-sm font-bold mb-3">🚨 Errores más frecuentes del bot</h2>
                {d.topErrores.length === 0 ? <p className="text-xs text-[#9A9A9A]">Aún no hay errores registrados.</p> : (
                  <div className="space-y-2.5">
                    {d.topErrores.map(e => (
                      <div key={e.tipo}>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-44 font-semibold truncate">{e.etiqueta}</span>
                          <span className="flex-1 h-3 bg-[#F1F1F1] rounded-full overflow-hidden"><span className="block h-full bg-[#DC2626] rounded-full" style={{ width: `${(e.n / maxErr) * 100}%` }} /></span>
                          <span className="w-8 text-right font-bold">{e.n}</span>
                        </div>
                        <p className="text-[10.5px] text-[#8A8A8A] ml-1 mt-0.5 line-clamp-2">ej.: {e.ejemplo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Etapas + perfiles */}
              <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4">
                <h2 className="text-sm font-bold mb-3">📶 Nota por etapa</h2>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {ETAPAS.map(([k, label]) => (
                    <div key={k} className="text-center rounded-lg bg-[#FAFAFA] py-2">
                      <p className="text-lg font-extrabold" style={{ color: colorNota(d.notaEtapas[k]) }}>{d.notaEtapas[k] ?? '—'}</p>
                      <p className="text-[10px] text-[#6B6B6B]">{label}</p>
                    </div>
                  ))}
                </div>
                <h2 className="text-sm font-bold mb-2">👥 Perfiles de cliente</h2>
                <table className="w-full text-xs">
                  <thead><tr className="text-[10px] text-[#9A9A9A] uppercase"><th className="text-left py-1">Perfil</th><th>Chats</th><th>Ventas</th><th>Conv.</th><th>Nota</th></tr></thead>
                  <tbody>
                    {d.perfiles.map(p => (
                      <tr key={p.perfil} className="border-t border-[#F4F4F4]">
                        <td className="py-1.5">{p.etiqueta}</td>
                        <td className="text-center">{p.chats}</td>
                        <td className="text-center">{p.vendidas}</td>
                        <td className="text-center font-semibold">{p.conversion}%</td>
                        <td className="text-center font-bold" style={{ color: colorNota(p.nota) }}>{p.nota ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>

            {/* Lecciones activas */}
            <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4 mb-5">
              <h2 className="text-sm font-bold mb-1">🧠 Lo que el supervisor le ha enseñado al bot</h2>
              <p className="text-[11px] text-[#6B6B6B] mb-3">Ya están activas. Si una no te gusta, desactívala y no se volverá a proponer.</p>
              {activas.length === 0 ? <p className="text-xs text-[#9A9A9A]">Todavía ninguna.</p> : (
                <div className="space-y-2">
                  {activas.map(l => (
                    <div key={l.id} className="flex items-start gap-3 rounded-xl border border-[#EFEFEF] p-3">
                      <span className={`shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5 ${l.auto ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#E0F2FE] text-[#0369A1]'}`}>{l.auto ? 'AUTO' : 'APROBADA'}</span>
                      <p className="flex-1 text-sm text-[#0D0D0D]">{l.regla}</p>
                      <button onClick={() => accion(l.id, 'desactivar')} className="shrink-0 text-[11px] text-[#DC2626] font-semibold hover:underline">Desactivar</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Auditorías */}
            <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4">
              <h2 className="text-sm font-bold mb-3">📝 Últimas conversaciones revisadas</h2>
              {d.auditorias.length === 0 ? <p className="text-xs text-[#9A9A9A]">Aún no hay revisiones. Dale a “Revisar ahora”.</p> : (
                <div className="divide-y divide-[#F4F4F4]">
                  {d.auditorias.map(a => {
                    const ab = abierta === a.conversation_id;
                    return (
                      <div key={a.conversation_id} className="py-2.5">
                        <button onClick={() => setAbierta(ab ? null : a.conversation_id)} className="w-full flex items-center gap-3 text-left">
                          <span className="w-10 text-center text-base font-extrabold" style={{ color: colorNota(a.puntaje) }}>{a.puntaje}</span>
                          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${a.resultado === 'vendida' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>{a.resultado === 'vendida' ? 'VENDIDA' : 'PERDIDA'}</span>
                          <span className="flex-1 min-w-0 text-xs text-[#0D0D0D] truncate">{a.resumen}</span>
                          <span className="text-[11px] text-[#9A9A9A]">{ab ? '▲' : '▼'}</span>
                        </button>
                        {ab && (
                          <div className="mt-2 ml-12 space-y-2 text-xs">
                            {(a.errores ?? []).map((e, i) => (
                              <p key={i} className="text-[#DC2626]">✗ {e.mensaje ? <b>Msj {e.mensaje}: </b> : null}{e.descripcion}</p>
                            ))}
                            {(a.aciertos ?? []).map((s, i) => <p key={i} className="text-[#15803D]">✓ {s}</p>)}
                            {onAbrirChat && <button onClick={() => onAbrirChat(a.conversation_id)} className="text-[#00847A] font-semibold hover:underline">Abrir el chat →</button>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

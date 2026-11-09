'use client';

import { useCallback, useEffect, useState } from 'react';

/** Aviso «Pedido listo para reclamar» (Interrapidísimo → oficina). API: /api/novedades/oficina */

const VERDE = '#00A89D';
const fecha = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }) : '—');
const ESTADO_TPL: Record<string, { t: string; c: string; bg: string }> = {
  APPROVED: { t: 'Aprobada por Meta', c: '#067647', bg: '#DCFAE6' },
  PENDING: { t: 'En revisión de Meta', c: '#B54708', bg: '#FEF0C7' },
  REJECTED: { t: 'Rechazada por Meta', c: '#B42318', bg: '#FEE4E2' },
  PAUSED: { t: 'Pausada por Meta', c: '#B42318', bg: '#FEE4E2' },
};
const ESTADO_AVISO: Record<string, { t: string; c: string }> = {
  enviado: { t: 'Enviado', c: '#067647' }, previo: { t: 'Ya estaba en oficina', c: '#5B6B68' }, error: { t: 'Error', c: '#B42318' },
  omitido: { t: 'Omitido', c: '#B54708' }, reservado: { t: 'Enviando…', c: '#175CD3' },
};

export default function AvisoOficina({ onCerrar }: { onCerrar: () => void }) {
  const [d, setD] = useState<any>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    const r = await fetch('/api/novedades/oficina', { cache: 'no-store' }); const j = await r.json().catch(() => ({}));
    if (r.ok) setD(j); else setMsg(j.error ?? 'No se pudo cargar');
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const elegir = (f: File | undefined) => {
    if (!f) return;
    if (f.type === 'image/gif') { setMsg('Meta no acepta GIF en las plantillas. Conviértelo a video MP4 (ezgif.com → GIF to MP4) y súbelo.'); return; }
    if (!['image/jpeg', 'image/png', 'video/mp4'].includes(f.type)) { setMsg('Sube una imagen JPG o PNG, o un video MP4.'); return; }
    if (f.size > 4 * 1024 * 1024) { setMsg('El archivo no puede pasar de 4 MB.'); return; }
    setMsg(null); setArchivo(f); setVista(URL.createObjectURL(f));
  };
  const subir = async (soloMedia: boolean) => {
    if (!archivo) return;
    setTrabajando(soloMedia ? 'Guardando el archivo…' : 'Enviando a Meta…');
    const fd = new FormData(); fd.append('file', archivo, archivo.name); if (soloMedia) fd.append('solo_media', '1');
    const r = await fetch('/api/novedades/oficina', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({}));
    setTrabajando(null);
    setMsg(r.ok ? (soloMedia ? '✅ Archivo guardado: los próximos avisos salen con él.' : `✅ Plantilla enviada a Meta (${j.status ?? 'en revisión'}).${j.sin_emoji ? ' Meta no aceptó emojis en los botones: quedaron sin emoji.' : ''} Cuando Meta la apruebe podrás activarla.`) : `⚠️ ${j.error}`);
    if (r.ok) { setArchivo(null); setVista(null); }
    cargar();
  };
  const accion = async (cuerpo: any, confirmar?: string) => {
    if (confirmar && !confirm(confirmar)) return;
    setTrabajando('Procesando…');
    const r = await fetch('/api/novedades/oficina', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => ({}));
    setTrabajando(null);
    if (!r.ok) setMsg(`⚠️ ${j.error}`);
    else if (cuerpo.accion === 'activar') setMsg(`✅ Aviso ACTIVADO. ${j.previos ?? 0} guías que ya estaban en oficina quedaron sin aviso automático (puedes mandárselo abajo).`);
    else if (cuerpo.accion === 'desactivar') setMsg('Aviso desactivado: no sale ningún mensaje.');
    else setMsg(j.apagado ? 'El aviso está apagado.' : j.fuera_de_horario ? 'Fuera de horario (7 a. m. – 8 p. m.): sale en la siguiente pasada.' : j.error ? `⚠️ ${j.error}` : `✅ Enviados ${j.enviados ?? 0} · omitidos ${j.omitidos ?? 0} · errores ${j.errores ?? 0}${j.pendientes ? ` · quedan ${j.pendientes} para la siguiente pasada` : ''}`);
    setSel(new Set()); cargar();
  };

  const tpl = d?.plantilla; const cfg = d?.ajustes; const est = tpl?.status ? ESTADO_TPL[tpl.status] ?? { t: tpl.status, c: '#5B6B68', bg: '#F1F5F4' } : null;
  const aprobada = tpl?.status === 'APPROVED';
  const media = vista ?? cfg?.media_url ?? null;
  const esVideo = archivo ? archivo.type === 'video/mp4' : cfg?.media_tipo === 'VIDEO';
  const seleccionables = (d?.avisos ?? []).filter((a: any) => ['previo', 'error'].includes(a.estado) && a.telefono);

  return (
    <div className="fixed inset-0 z-[85] bg-black/50 flex items-center justify-center p-3" onClick={onCerrar}>
      <div className="w-full max-w-5xl max-h-full overflow-auto bg-white rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#E8ECEB] flex items-center gap-3">
          <span className="text-3xl">📲</span>
          <div className="flex-1">
            <p className="text-lg font-extrabold text-[#0D1F1C]">Aviso «Pedido listo para reclamar»</p>
            <p className="text-[12.5px] text-[#5B6B68]">Cuando una guía de Interrapidísimo queda «en oficina» en Effi, se le avisa al cliente por WhatsApp una sola vez. Solo FUNNELISTH LANDING y QUINO AGENCIA.</p>
          </div>
          <button onClick={onCerrar} className="text-xl text-[#5B6B68] px-2">✕</button>
        </div>
        {!d ? <p className="p-10 text-center text-sm text-[#5B6B68]">Cargando…</p> : (
          <div className="grid md:grid-cols-[340px_1fr] gap-5 p-5">
            {/* Vista previa tipo WhatsApp */}
            <div className="rounded-2xl p-3 bg-[#E7DDD3]">
              <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                <div className="aspect-square bg-[#F1F5F4] flex items-center justify-center text-[12px] text-[#5B6B68]">
                  {media ? (esVideo
                    ? <video src={media} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={media} alt="" className="w-full h-full object-cover" />) : 'Imagen o video del encabezado'}
                </div>
                <p className="p-3 text-[13px] whitespace-pre-wrap text-[#111B21]">{String(tpl?.cuerpo ?? '').replace('{{1}}', 'María').replace('{{2}}', '240012345678')}</p>
                {(tpl?.botones ?? []).map((b: string) => <div key={b} className="border-t border-[#E9EDEF] py-2 text-center text-[13px] font-semibold text-[#00A884]">{b}</div>)}
              </div>
              <p className="text-[11px] text-[#5B6B68] mt-2 text-center">{'{{1}}'} = primer nombre del cliente en Effi · {'{{2}}'} = número de guía</p>
            </div>

            <div className="flex flex-col gap-4 min-w-0">
              {/* Plantilla */}
              <div className="rounded-xl border border-[#E8ECEB] p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm flex-1">Plantilla <code className="text-[12px] bg-[#F1F5F4] px-1.5 rounded">{tpl?.nombre}</code></p>
                  {est ? <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: est.bg, color: est.c }}>{est.t}</span>
                    : <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#F1F5F4] text-[#5B6B68]">Aún no creada</span>}
                </div>
                {tpl?.error && <p className="text-[12px] text-[#B42318] mt-1">{tpl.error}</p>}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <label className="px-3 py-2 rounded-xl border border-dashed border-[#CBD5D3] text-sm font-bold cursor-pointer hover:bg-[#F7FAF9]">
                    ⬆ {archivo ? archivo.name : 'Elegir imagen (JPG/PNG) o video (MP4)'}
                    <input type="file" accept="image/jpeg,image/png,video/mp4,image/gif" className="hidden" onChange={e => elegir(e.target.files?.[0])} />
                  </label>
                  {!tpl?.status
                    ? <button disabled={!archivo || !!trabajando} onClick={() => subir(false)} className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40" style={{ background: VERDE }}>Crear y enviar a aprobación de Meta</button>
                    : <button disabled={!archivo || !!trabajando} onClick={() => subir(true)} className="px-4 py-2 rounded-xl border border-[#E1E5E4] text-sm font-bold disabled:opacity-40">Cambiar imagen de los envíos</button>}
                </div>
                <p className="text-[11px] text-[#5B6B68] mt-2">Meta no acepta GIF: un GIF animado se sube convertido a MP4. Máximo 4 MB. Categoría: Utilidad, español.</p>
              </div>

              {/* Interruptor */}
              <div className="rounded-xl border border-[#E8ECEB] p-4 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-sm">Automatización {cfg?.activo ? <span className="text-[#067647]">● ACTIVA</span> : <span className="text-[#5B6B68]">● APAGADA</span>}</p>
                  <p className="text-[12px] text-[#5B6B68]">{cfg?.activo ? `Desde ${fecha(cfg.desde)} · revisa cada hora con la sincronización de Effi · de ${cfg.horas?.[0]} a ${cfg.horas?.[1]} h` : aprobada ? 'Lista para activar.' : 'Se puede activar cuando Meta apruebe la plantilla.'} · Hoy en oficina: <b>{d.en_oficina}</b></p>
                </div>
                {cfg?.activo
                  ? <>
                    <button disabled={!!trabajando} onClick={() => accion({ accion: 'pasada' })} className="px-3 py-2 rounded-xl border border-[#E1E5E4] text-sm font-bold">🔄 Revisar ahora</button>
                    <button disabled={!!trabajando} onClick={() => accion({ accion: 'desactivar' }, '¿Desactivar el aviso? No saldrá ningún mensaje hasta que lo vuelvas a activar.')} className="px-4 py-2 rounded-xl bg-[#FEE4E2] text-[#B42318] text-sm font-bold">Desactivar</button>
                  </>
                  : <button disabled={!aprobada || !cfg?.media_url || !!trabajando} onClick={() => accion({ accion: 'activar' }, `¿Activar el aviso automático?\n\nDesde ahora, cada guía de Interrapidísimo que quede en oficina recibirá la plantilla una sola vez.\nLas ${d.en_oficina} que YA están en oficina NO recibirán nada automático (podrás mandárselo abajo).`)}
                    className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40" style={{ background: VERDE }}>Activar</button>}
              </div>

              {msg && <div className="rounded-xl bg-[#F7FAF9] border border-[#E8ECEB] px-3 py-2 text-[13px] flex gap-2"><span className="flex-1 whitespace-pre-wrap">{msg}</span><button onClick={() => setMsg(null)}>✕</button></div>}
              {trabajando && <p className="text-[12px] text-[#175CD3]">{trabajando}</p>}

              {/* Supervisión */}
              <div className="grid grid-cols-5 gap-2 text-center">
                {[['Enviados', d.contadores.enviado, '#067647'], ['Respondieron', d.contadores.respondieron, '#175CD3'], ['Ya estaban', d.contadores.previo, '#5B6B68'], ['Errores', d.contadores.error, '#B42318'], ['Omitidos', d.contadores.omitido, '#B54708']].map(([t, n, c]) => (
                  <div key={String(t)} className="rounded-xl border border-[#E8ECEB] py-2"><p className="text-lg font-extrabold" style={{ color: String(c) }}>{n}</p><p className="text-[11px] text-[#5B6B68]">{t}</p></div>
                ))}
              </div>
              {seleccionables.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#5B6B68] flex-1">Marca «Ya estaban» o con error para mandarles el aviso a mano (máx. 10 a la vez).</span>
                  <button disabled={!sel.size || !aprobada || !cfg?.activo || !!trabajando} onClick={() => accion({ accion: 'enviar', ids: [...sel] }, `¿Mandar el aviso a ${sel.size} cliente(s)?`)}
                    className="px-3 py-1.5 rounded-lg text-white text-[12px] font-bold disabled:opacity-40" style={{ background: VERDE }}>Enviar a {sel.size} seleccionados</button>
                </div>
              )}
              <div className="rounded-xl border border-[#E8ECEB] overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#F7FAF9] text-[#5B6B68]"><tr><th className="w-8" /><th className="text-left p-2">Cliente</th><th className="text-left p-2">Guía</th><th className="text-left p-2">Estado</th><th className="text-left p-2">Enviado</th><th className="text-left p-2">Respuesta</th></tr></thead>
                  <tbody>
                    {!d.avisos.length && <tr><td colSpan={6} className="p-4 text-center text-[#5B6B68]">Aún no hay avisos.</td></tr>}
                    {d.avisos.map((a: any) => {
                      const e = ESTADO_AVISO[a.estado] ?? { t: a.estado, c: '#5B6B68' };
                      const puede = ['previo', 'error'].includes(a.estado) && a.telefono;
                      return (
                        <tr key={a.id_guia_effi} className="border-t border-[#F1F5F4] align-top">
                          <td className="p-2">{puede && <input type="checkbox" checked={sel.has(a.id_guia_effi)} onChange={ev => setSel(p => { const s = new Set(p); ev.target.checked ? s.add(a.id_guia_effi) : s.delete(a.id_guia_effi); return s; })} />}</td>
                          <td className="p-2"><p className="font-semibold">{a.nombre ?? '—'}</p><p className="text-[#5B6B68]">{a.telefono ?? 'sin teléfono'}</p></td>
                          <td className="p-2">{a.guia ?? a.id_guia_effi}</td>
                          <td className="p-2"><span className="font-bold" style={{ color: e.c }}>{e.t}</span>{a.motivo && <p className="text-[#5B6B68]">{a.motivo}</p>}</td>
                          <td className="p-2">{fecha(a.enviado_at)}</td>
                          <td className="p-2">{a.respuesta ? <><p className="font-semibold text-[#175CD3]">{a.respuesta}</p><p className="text-[#5B6B68]">{fecha(a.respuesta_at)}</p></> : a.estado === 'enviado' ? <span className="text-[#5B6B68]">Sin respuesta aún</span> : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';

interface Prov { id: string; nombre: string; gratis: boolean; modeloDefault: string; ayuda: string; soportaVision?: boolean; modeloVision?: string | null; soportaAudio?: boolean; modeloAudio?: string | null; recomendado?: boolean }

// Enlace directo a la página del proveedor (para sacar la llave).
const urlLlave = (ayuda: string) => 'https://' + String(ayuda || '').replace(/^https?:\/\//, '');

// 🎥 Video "paso a paso" por proveedor. Pega aquí el link del video (YouTube,
// Drive, Loom, etc.). Déjalo en '' si aún no lo tienes: se mostrará "próximamente".
const VIDEOS_IA: Record<string, string> = {
  gemini:     '',
  groq:       '',
  cerebras:   '',
  mistral:    '',
  openrouter: '',
  github:     '',
  nvidia:     '',
  openai:     '',
  anthropic:  '',
};

// Convierte un link de YouTube/Loom/Drive a su forma "incrustable" (embed).
function urlEmbed(u: string): string {
  const url = String(u || '').trim();
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  return url; // mp4 directo u otro embed
}
interface Integ {
  id: string; proveedor: string; etiqueta: string | null;
  modelo: string | null; prioridad: number; activo: boolean; estado: string; mask: string;
  soporta_vision?: boolean | null; modelo_vision?: string | null;
  rl_limite?: number | null; rl_restante?: number | null; rl_unidad?: string | null;
  rl_reset_at?: string | null; rl_fuente?: string | null; uso_hoy?: number;
}

const SEMAFORO: Record<string, string> = { activa: '🟢', agotada: '🟡', error: '🔴' };

const miles = (n: number) => Math.round(n).toLocaleString('es-CO');

function relReset(iso?: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'se recarga ya';
  const min = Math.round(ms / 60000);
  if (min < 1) return 'se recarga en <1 min';
  if (min < 60) return `se recarga en ~${min} min`;
  const h = Math.round(min / 60);
  return `se recarga en ~${h} h`;
}

/** Barra "cuánto lleva usado / cuánto le queda" de una IA. */
function BarraUso({ it }: { it: Integ }) {
  const limite = it.rl_limite ?? null;
  const restante = it.rl_restante ?? null;
  if (limite == null || restante == null || limite <= 0) {
    return <p className="text-[11px] text-[#9A9A9A] mt-2">Aún sin datos de uso. Se llena en cuanto el bot use esta IA.</p>;
  }
  const rest = Math.max(0, Math.min(limite, restante));
  const usado = Math.max(0, limite - rest);
  const pctUsado = Math.max(0, Math.min(100, (usado / limite) * 100));
  const fracQueda = rest / limite;
  const color = fracQueda <= 0.1 ? 'bg-red-500' : fracQueda <= 0.25 ? 'bg-amber-400' : 'bg-[#00A89D]';
  const unidad = it.rl_unidad === 'tokens' ? 'tokens' : 'solicitudes';
  const aprox = it.rl_fuente === 'contado' ? ' (aprox.)' : '';
  const reset = relReset(it.rl_reset_at);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-[#6B6B6B]">Usado <b className="text-[#0D0D0D]">{miles(usado)}</b> de {miles(limite)} {unidad}{aprox}</span>
        <span className={fracQueda <= 0.1 ? 'text-red-600 font-semibold' : 'text-[#00847A] font-medium'}>quedan {miles(rest)}</span>
      </div>
      <div className="h-2.5 rounded-full bg-[#F0F0F0] overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pctUsado}%` }} />
      </div>
      {reset && <div className="text-[10px] text-[#9A9A9A] mt-1 text-right">{reset}</div>}
    </div>
  );
}

export default function IntegrarIaPanel() {
  const [provs, setProvs] = useState<Prov[]>([]);
  const [videoAbierto, setVideoAbierto] = useState<string | null>(null); // popup de video
  const [integ, setInteg] = useState<Integ[]>([]);
  const [loading, setLoading] = useState(true);
  // Formulario "nueva llave" por proveedor.
  const [nuevaKey, setNuevaKey] = useState<Record<string, string>>({});
  const [nuevaModelo, setNuevaModelo] = useState<Record<string, string>>({});
  const [abrirNueva, setAbrirNueva] = useState<Record<string, boolean>>({});
  // Reemplazo de llave existente (por id).
  const [editKey, setEditKey] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [prueba, setPrueba] = useState<Record<string, { ok: boolean; txt: string }>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function cargar() {
    setLoading(true);
    try {
      const r = await fetch('/api/ia');
      const d = await r.json();
      if (r.ok) { setProvs(d.proveedores ?? []); setInteg(d.integraciones ?? []); }
    } finally { setLoading(false); }
  }
  useEffect(() => {
    cargar();
    // Refresca solo el uso cada 30s para ver la barra actualizada sin recargar.
    const t = setInterval(() => { fetch('/api/ia').then(r => r.json()).then(d => { if (d?.integraciones) setInteg(d.integraciones); }).catch(() => {}); }, 30000);
    return () => clearInterval(t);
  }, []);

  const integDe = (provId: string) => integ.filter(i => i.proveedor === provId).sort((a, b) => a.prioridad - b.prioridad);
  const provDe = (id: string) => provs.find(p => p.id === id);

  // Crear una llave nueva de un proveedor (permite varias del mismo).
  async function crearLlave(provId: string) {
    if (!nuevaKey[provId]) { setMsg({ ok: false, text: 'Pega la API key primero.' }); return; }
    setBusy('new-' + provId); setMsg(null);
    try {
      const body: any = { proveedor: provId, nueva: true, api_key: nuevaKey[provId] };
      if (nuevaModelo[provId]) body.modelo = nuevaModelo[provId];
      const r = await fetch('/api/ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) {
        setMsg({ ok: true, text: 'Llave agregada ✓' });
        setNuevaKey(k => ({ ...k, [provId]: '' })); setNuevaModelo(k => ({ ...k, [provId]: '' }));
        setAbrirNueva(a => ({ ...a, [provId]: false }));
        cargar();
      } else setMsg({ ok: false, text: d.error ?? 'No se pudo agregar' });
    } catch { setMsg({ ok: false, text: 'Error de conexión' }); } finally { setBusy(null); }
  }

  // Actualizar un campo de una llave existente (por id).
  async function patchLlave(id: string, patch: any, tag: string) {
    setBusy(tag);
    try {
      const r = await fetch('/api/ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
      const d = await r.json();
      if (r.ok) cargar(); else setMsg({ ok: false, text: d.error ?? 'No se pudo guardar' });
    } catch { setMsg({ ok: false, text: 'Error de conexión' }); } finally { setBusy(null); }
  }

  async function reemplazarKey(id: string) {
    if (!editKey[id]) return;
    await patchLlave(id, { api_key: editKey[id] }, 'rk-' + id);
    setEditKey(k => ({ ...k, [id]: '' }));
  }

  async function probarNueva(provId: string) {
    if (!nuevaKey[provId]) { setMsg({ ok: false, text: 'Pega la API key primero para probarla.' }); return; }
    setBusy('tp-' + provId); setPrueba(p => ({ ...p, [provId]: { ok: false, txt: 'Probando…' } }));
    try {
      const r = await fetch('/api/ia/probar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proveedor: provId, api_key: nuevaKey[provId], modelo: nuevaModelo[provId] || undefined }) });
      const d = await r.json();
      setPrueba(p => ({ ...p, [provId]: d.ok ? { ok: true, txt: 'Funciona ✓' } : { ok: false, txt: d.error || 'Falló' } }));
    } catch { setPrueba(p => ({ ...p, [provId]: { ok: false, txt: 'Error de conexión' } })); } finally { setBusy(null); }
  }

  async function quitar(id: string) {
    setBusy('d-' + id);
    try { await fetch('/api/ia?id=' + id, { method: 'DELETE' }); cargar(); } finally { setBusy(null); }
  }

  async function toggleActivo(id: string, activo: boolean) {
    setInteg(prev => prev.map(i => i.id === id ? { ...i, activo } : i));
    await fetch('/api/ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, activo }) });
    cargar();
  }

  async function mover(id: string, dir: -1 | 1) {
    const orden = [...integ].sort((a, b) => a.prioridad - b.prioridad).map(i => i.id);
    const i = orden.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= orden.length) return;
    [orden[i], orden[j]] = [orden[j], orden[i]];
    setInteg(prev => prev.map(x => ({ ...x, prioridad: orden.indexOf(x.id) + 1 })));
    await fetch('/api/ia', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orden }) });
  }

  const inputCls ='w-full bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm text-[#0D0D0D] placeholder:text-[#B5B5B5] focus:outline-none focus:border-[#00A89D]';
  const configuradas = [...integ].sort((a, b) => a.prioridad - b.prioridad);
  const etiquetaDe = (i: Integ) => i.etiqueta || (provDe(i.proveedor)?.nombre ?? i.proveedor);
  const veImagenes = (i: Integ) => (i.soporta_vision ?? provDe(i.proveedor)?.soportaVision) === true;
  const oyeAudio = (i: Integ) => provDe(i.proveedor)?.soportaAudio === true;

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-[#0D0D0D] font-bold text-lg">Integrar IA</h1>
        <p className="text-xs text-[#6B6B6B] mb-2">Conecta tus propias llaves gratuitas de IA. Puedes poner <b>varias del mismo proveedor</b> (ej. dos Groq de cuentas distintas para duplicar el límite). El bot las usa en orden y, si una se agota, salta sola a la siguiente. Si el cliente manda una <b>foto</b>, el bot usa automáticamente una IA que lea imágenes 👁. Si manda una <b>nota de voz</b>, el bot la transcribe solo con una IA que lea audios 🎙 (la misma llave de Groq sirve, ¡gratis!).</p>
        <div className="mb-5 text-xs text-[#065F46] bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 leading-relaxed">
          👉 <b>Te recomendamos empezar con Groq</b>: es gratis, rápida, lee fotos y transcribe audios. Y si quieres más margen, agrega también <b>NVIDIA</b> (es la que más solicitudes gratis da al día). Con esas dos tu bot queda de sobra.
        </div>

        {msg && <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>{msg.text}</div>}

        {loading ? <div className="text-[#9A9A9A] text-sm">Cargando…</div> : (
          <>
            {/* Orden de prioridad (por llave) */}
            {configuradas.length > 0 && (
              <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-sm mb-5">
                <h2 className="text-sm font-bold text-[#0D0D0D] mb-1">Orden de uso (failover)</h2>
                <p className="text-[11px] text-[#6B6B6B] mb-3">El bot prueba de arriba hacia abajo. Cada llave es un paso independiente.</p>
                <div className="space-y-1.5">
                  {configuradas.map((i, idx) => (
                    <div key={i.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F7F7F5] border border-[#EFEFEF]">
                      <span className="text-xs text-[#9A9A9A] w-4">{idx + 1}</span>
                      <span className="text-sm">{SEMAFORO[i.estado] ?? '⚪'}</span>
                      <span className="text-sm font-medium flex-1">{etiquetaDe(i)}{veImagenes(i) && <span className="ml-1" title="Lee imágenes">👁</span>}{oyeAudio(i) && <span className="ml-1" title="Transcribe audios">🎙</span>}</span>
                      {!i.activo && <span className="text-[10px] text-[#9A9A9A]">apagada</span>}
                      <button onClick={() => mover(i.id, -1)} disabled={idx === 0} className="w-6 h-6 rounded border border-[#E8E8E8] disabled:opacity-30">↑</button>
                      <button onClick={() => mover(i.id, 1)} disabled={idx === configuradas.length - 1} className="w-6 h-6 rounded border border-[#E8E8E8] disabled:opacity-30">↓</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proveedores */}
            <h2 className="text-sm font-semibold text-[#0D0D0D] mb-2">Proveedores</h2>
            <div className="space-y-3">
              {provs.map(p => {
                const llaves = integDe(p.id);
                const pr = prueba[p.id];
                const nueva = abrirNueva[p.id] || llaves.length === 0;
                return (
                  <div key={p.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${p.recomendado ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-[#E8E8E8]'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-[#0D0D0D]">{p.nombre}</span>
                      {p.recomendado && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">⭐ RECOMENDADO</span>}
                      {p.gratis ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">GRATIS</span>
                        : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">DE PAGO</span>}
                      {p.soportaVision && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700" title="Puede leer imágenes">👁 IMÁGENES</span>}
                      {p.soportaAudio && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700" title="Transcribe notas de voz">🎙 AUDIOS</span>}
                      {llaves.length > 0 && <span className="text-[11px] text-[#9A9A9A] ml-auto">{llaves.length} llave{llaves.length > 1 ? 's' : ''}</span>}
                    </div>

                    {/* Enlace directo a la IA + video paso a paso */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <a
                        href={urlLlave(p.ayuda)} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[#00A89D] text-white hover:bg-[#00847A]"
                      >🔑 Conseguir mi llave gratis →</a>
                      {VIDEOS_IA[p.id] ? (
                        <button
                          onClick={() => setVideoAbierto(VIDEOS_IA[p.id])}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[#00A89D]/40 text-[#00847A] hover:bg-[#00A89D]/10"
                        >🎥 Ver video paso a paso</button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-lg border border-dashed border-[#E8E8E8] text-[#B5B5B5]"
                          title="El video se agregará pronto"
                        >🎥 Video (próximamente)</span>
                      )}
                    </div>

                    {/* Llaves ya guardadas de este proveedor */}
                    {llaves.map(it => (
                      <div key={it.id} className="rounded-xl border border-[#EFEFEF] bg-[#FAFAF8] p-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{SEMAFORO[it.estado] ?? '⚪'}</span>
                          <span className="text-sm font-medium text-[#0D0D0D]">{etiquetaDe(it)}</span>
                          <span className="text-[11px] text-[#9A9A9A] font-mono">{it.mask}</span>
                          {veImagenes(it) && <span className="text-[10px]" title="Lee imágenes">👁</span>}
                          {oyeAudio(it) && <span className="text-[10px]" title="Transcribe audios">🎙</span>}
                          <label className="flex items-center gap-1 text-[11px] text-[#6B6B6B] ml-auto"><input type="checkbox" checked={it.activo} onChange={e => toggleActivo(it.id, e.target.checked)} className="accent-[#00A89D]" /> Activa</label>
                          <button onClick={() => quitar(it.id)} disabled={busy === 'd-' + it.id} className="px-2 py-1 rounded-lg text-[11px] text-[#DC2626] hover:bg-[#FEE2E2]">Quitar</button>
                        </div>
                        {p.gratis && <BarraUso it={it} />}
                        {/* Reemplazar la llave sin borrarla */}
                        <div className="flex items-center gap-2 mt-2">
                          <input value={editKey[it.id] ?? ''} onChange={e => setEditKey(k => ({ ...k, [it.id]: e.target.value }))} placeholder="Reemplazar por una llave nueva…" className={inputCls + ' text-xs'} autoComplete="off" />
                          <button onClick={() => reemplazarKey(it.id)} disabled={!editKey[it.id] || busy === 'rk-' + it.id} className="px-3 py-2 rounded-lg text-xs font-medium border border-[#E8E8E8] hover:bg-[#F5F5F5] disabled:opacity-40 whitespace-nowrap">Cambiar</button>
                        </div>
                      </div>
                    ))}

                    {/* Botón para abrir el formulario de otra llave */}
                    {llaves.length > 0 && !nueva && (
                      <button onClick={() => setAbrirNueva(a => ({ ...a, [p.id]: true }))} className="text-xs font-medium text-[#00847A] hover:underline mt-1">+ Agregar otra llave de {p.nombre}</button>
                    )}

                    {/* Formulario de nueva llave */}
                    {nueva && (
                      <div className={llaves.length > 0 ? 'mt-2 pt-3 border-t border-[#EFEFEF]' : ''}>
                        <div className="grid md:grid-cols-2 gap-2">
                          <input value={nuevaKey[p.id] ?? ''} onChange={e => setNuevaKey(k => ({ ...k, [p.id]: e.target.value }))} placeholder="Pega tu API key aquí" className={inputCls} autoComplete="off" />
                          <input value={nuevaModelo[p.id] ?? ''} onChange={e => setNuevaModelo(k => ({ ...k, [p.id]: e.target.value }))} placeholder={`Modelo (por defecto: ${p.modeloDefault})`} className={inputCls + ' font-mono text-xs'} autoComplete="off" />
                        </div>
                        <p className="text-[10px] text-[#9A9A9A] mt-1">Consigue tu llave en: <a href={urlLlave(p.ayuda)} target="_blank" rel="noreferrer" className="text-[#00847A] font-medium hover:underline">{p.ayuda}</a></p>
                        {p.soportaVision && <p className="text-[10px] text-indigo-500 mt-0.5">Esta IA lee imágenes: si el cliente manda una foto, el bot la usará con el modelo <span className="font-mono">{p.modeloVision}</span> automáticamente.</p>}
                        {p.soportaAudio && <p className="text-[10px] text-purple-500 mt-0.5">Esta IA transcribe notas de voz: si el cliente manda un audio, el bot lo entiende con <span className="font-mono">{p.modeloAudio}</span> automáticamente.</p>}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <button onClick={() => probarNueva(p.id)} disabled={busy === 'tp-' + p.id} className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs hover:bg-[#F5F5F5] disabled:opacity-50">Probar conexión</button>
                          <button onClick={() => crearLlave(p.id)} disabled={busy === 'new-' + p.id} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#00A89D] text-white hover:bg-[#00847A] disabled:opacity-50">{busy === 'new-' + p.id ? 'Agregando…' : (llaves.length > 0 ? 'Agregar llave' : 'Guardar')}</button>
                          {llaves.length > 0 && <button onClick={() => setAbrirNueva(a => ({ ...a, [p.id]: false }))} className="px-3 py-1.5 rounded-lg text-xs text-[#6B6B6B] hover:bg-[#F5F5F5]">Cancelar</button>}
                          {pr && <span className={`text-xs ${pr.ok ? 'text-emerald-600' : 'text-red-600'}`}>{pr.txt}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Popup de video paso a paso (incrustado) */}
      {videoAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setVideoAbierto(null)}>
          <div className="bg-black rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 bg-[#0D0D0D]">
              <span className="text-white text-sm font-semibold">🎥 Cómo integrar tu IA — paso a paso</span>
              <button onClick={() => setVideoAbierto(null)} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
              <iframe
                src={urlEmbed(videoAbierto)}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

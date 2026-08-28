'use client';

import { useEffect, useRef, useState } from 'react';
import { comprimirImagen } from '@/lib/imagen-comprimir';

interface EtiquetaConteo { nombre: string; color: string; count: number }
interface Reporte { campanaId: string; template?: string; fecha?: string; total: number; enviados: number; entregados: number; leidos: number; respondieron: number; fallidos: number }

/**
 * Remarketing por etiqueta: eliges una o varias etiquetas y envías una plantilla
 * de Meta APROBADA (promo/descuento) a todos esos clientes. Funciona fuera de la
 * ventana de 24h porque usa plantilla.
 */
export default function RemarketingPanel() {
  const [etiquetas, setEtiquetas] = useState<EtiquetaConteo[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [diasMin, setDiasMin] = useState(0); // antigüedad mínima (días sin actividad); 0 = todos
  const [template, setTemplate] = useState('promo_amor_amistad_24h');
  const [imageUrl, setImageUrl] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<{ total: number; enviados: number; fallidos: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reporte, setReporte] = useState<Reporte | null>(null);   // campaña recién enviada (en vivo)
  const [campanas, setCampanas] = useState<Reporte[]>([]);        // historial de campañas
  const fileRef = useRef<HTMLInputElement | null>(null);

  function cargarCampanas() {
    fetch('/api/remarketing/reporte')
      .then(r => r.json())
      .then(d => setCampanas(d.campanas ?? []))
      .catch(() => {});
  }
  useEffect(() => { cargarCampanas(); }, []);

  // Refresca el reporte de la campaña activa cada 6s (los estados llegan de a poco).
  useEffect(() => {
    if (!reporte?.campanaId) return;
    const id = reporte.campanaId;
    const t = setInterval(() => {
      fetch(`/api/remarketing/reporte?id=${encodeURIComponent(id)}`)
        .then(r => r.json())
        .then(d => { if (d && !d.error) setReporte(d); })
        .catch(() => {});
    }, 6000);
    return () => clearInterval(t);
  }, [reporte?.campanaId]);

  async function subirImagen(file: File) {
    setError(null); setSubiendo(true);
    try {
      const liviana = await comprimirImagen(file);
      const fd = new FormData();
      fd.append('file', liviana);
      fd.append('slug', 'remarketing');
      const res = await fetch('/api/funnels/imagen', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'No se pudo subir la imagen.'); return; }
      setImageUrl(d.url as string);
    } catch {
      setError('No se pudo subir la imagen.');
    } finally { setSubiendo(false); }
  }

  // Recarga los conteos cada vez que cambia el filtro de antigüedad, para que los
  // números de cada etiqueta reflejen a cuántos se les enviaría REALMENTE.
  useEffect(() => {
    setCargando(true);
    fetch(`/api/remarketing?dias=${diasMin}`)
      .then(r => r.json())
      .then(d => setEtiquetas(d.etiquetas ?? []))
      .catch(() => setError('No se pudieron cargar las etiquetas.'))
      .finally(() => setCargando(false));
  }, [diasMin]);

  const OPCIONES_DIAS = [
    { v: 0, t: 'Todos' },
    { v: 3, t: '3+ días' },
    { v: 5, t: '5+ días' },
    { v: 7, t: '7+ días' },
    { v: 15, t: '15+ días' },
    { v: 30, t: '30+ días' },
  ];

  const toggle = (n: string) => setSel(s => {
    const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x;
  });

  const totalSel = etiquetas.filter(e => sel.has(e.nombre)).reduce((s, e) => s + e.count, 0);

  async function enviar() {
    setError(null); setResultado(null);
    if (sel.size === 0) { setError('Elige al menos una etiqueta.'); return; }
    if (!template.trim()) { setError('Escribe el nombre de la plantilla aprobada en Meta.'); return; }
    const filtro = diasMin > 0 ? ` que lleven ${diasMin}+ días sin actividad` : '';
    const ok = window.confirm(
      `Vas a enviar la plantilla "${template}" a aprox. ${totalSel} cliente(s) de las etiquetas seleccionadas${filtro}.\n\n¿Enviar ahora?`,
    );
    if (!ok) return;
    setEnviando(true);
    try {
      const res = await fetch('/api/remarketing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etiquetas: [...sel], template: template.trim(), imageUrl: imageUrl.trim() || undefined, diasMin }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'No se pudo enviar.'); return; }
      setResultado(d);
      if (d.campanaId) {
        setReporte({ campanaId: d.campanaId, template: template.trim(), total: d.total, enviados: d.enviados, entregados: 0, leidos: 0, respondieron: 0, fallidos: d.fallidos });
        setTimeout(cargarCampanas, 1500);
      }
    } catch {
      setError('Error de conexión al enviar.');
    } finally { setEnviando(false); }
  }

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto">
    <div className="p-4 md:p-6 pb-28 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-[#0D0D0D]">📣 Remarketing por etiqueta</h1>
        <p className="text-sm text-[#6B6B6B]">Envía una promo o descuento a todos los clientes de una etiqueta. Usa una plantilla de Meta aprobada (llega aunque hayan pasado más de 24h).</p>
      </div>

      {/* Etiquetas */}
      <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4">
        <p className="text-[12px] font-bold text-[#0D0D0D] uppercase mb-2">1. Elige a quién enviar</p>

        {/* Filtro de antigüedad: solo a quienes lleven X días sin actividad */}
        <div className="mb-3 rounded-xl bg-[#F8FAFA] border border-[#E8E8E8] p-3">
          <label className="block text-[11px] font-bold text-[#0D0D0D] uppercase mb-2">⏱️ Antigüedad — evita molestar a los recientes</label>
          <div className="flex flex-wrap gap-1.5">
            {OPCIONES_DIAS.map(o => (
              <button key={o.v} onClick={() => setDiasMin(o.v)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-bold border-2 transition-colors ${diasMin === o.v ? 'border-[#00A89D] bg-[#00A89D] text-white' : 'border-[#E0E0E0] text-[#6B6B6B] hover:border-[#00A89D]/40'}`}>
                {o.t}
              </button>
            ))}
            <div className="flex items-center gap-1 ml-1">
              <input type="number" min={0} value={diasMin}
                onChange={e => setDiasMin(Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
                className="w-16 px-2 py-1.5 rounded-lg border border-[#E0E0E0] text-[12px] text-center" />
              <span className="text-[11px] text-[#9A9A9A]">días o más</span>
            </div>
          </div>
          <p className="text-[10px] text-[#9A9A9A] mt-2">
            {diasMin === 0
              ? 'Enviando a TODOS los de la etiqueta, sin importar cuándo escribieron.'
              : `Solo se enviará a quienes lleven ${diasMin}+ días sin actividad (los recientes quedan fuera).`}
          </p>
        </div>

        {cargando ? (
          <p className="text-sm text-[#9A9A9A]">Cargando etiquetas…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {etiquetas.map(e => {
              const activa = sel.has(e.nombre);
              return (
                <button key={e.nombre} onClick={() => toggle(e.nombre)}
                  className={`flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${activa ? 'border-[#00A89D] bg-[#00A89D]/10' : 'border-[#E8E8E8] hover:border-[#00A89D]/40'}`}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: e.color }} />
                    <span className="text-[13px] font-semibold truncate">{e.nombre}</span>
                  </span>
                  <span className="text-[12px] font-bold shrink-0" style={{ color: activa ? '#00847A' : '#9A9A9A' }}>{e.count}</span>
                </button>
              );
            })}
          </div>
        )}
        {sel.size > 0 && (
          <p className="text-[13px] font-bold text-[#00847A] mt-3">✅ {totalSel} cliente(s) seleccionado(s) en {sel.size} etiqueta(s)</p>
        )}
      </section>

      {/* Plantilla */}
      <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4 space-y-3">
        <p className="text-[12px] font-bold text-[#0D0D0D] uppercase">2. Plantilla aprobada de Meta</p>
        <div>
          <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Nombre de la plantilla</label>
          <input value={template} onChange={e => setTemplate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" placeholder="promo_amor_amistad_24h" />
          <p className="text-[10px] text-[#9A9A9A] mt-1">Debe estar APROBADA en Meta (categoría Marketing). Su cuerpo usa {'{{1}}'} = nombre del cliente.</p>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1 uppercase">Imagen del encabezado (opcional)</label>
          <div className="flex gap-2">
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" placeholder="Sube una foto o pega un enlace https://…" />
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) subirImagen(f); e.target.value = ''; }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={subiendo}
              className="shrink-0 px-3 py-2 rounded-lg bg-[#0D0D0D] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50">
              {subiendo ? 'Subiendo…' : '📎 Subir'}
            </button>
          </div>
          {imageUrl && (
            <div className="mt-2 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-[#E8E8E8]" />
              <button type="button" onClick={() => setImageUrl('')}
                className="text-[12px] font-semibold text-[#DC2626] hover:underline">Quitar imagen</button>
            </div>
          )}
        </div>
      </section>

      {/* Enviar */}
      <button onClick={enviar} disabled={enviando || sel.size === 0}
        className="w-full py-3 rounded-xl bg-[#00A89D] text-white font-extrabold text-base hover:opacity-90 disabled:opacity-50">
        {enviando ? 'Enviando…' : `📤 Enviar a ${totalSel} cliente(s)`}
      </button>

      {error && <p className="text-sm font-semibold text-[#DC2626] text-center">⚠️ {error}</p>}

      {/* Reporte EN VIVO de la campaña recién enviada */}
      {reporte && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="font-extrabold text-[#15803D]">✅ Campaña enviada · seguimiento en vivo</p>
            <button onClick={() => fetch(`/api/remarketing/reporte?id=${encodeURIComponent(reporte.campanaId)}`).then(r => r.json()).then(d => { if (d && !d.error) setReporte(d); })}
              className="text-[12px] font-bold text-[#00847A] hover:underline">↻ Actualizar</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            <Metrica etiqueta="Enviados" valor={reporte.enviados} color="#0D0D0D" />
            <Metrica etiqueta="✓✓ Entregados" valor={reporte.entregados} color="#2563EB" />
            <Metrica etiqueta="👀 Leídos" valor={reporte.leidos} color="#7C3AED" />
            <Metrica etiqueta="💬 Respondieron" valor={reporte.respondieron} color="#15803D" />
          </div>
          {reporte.fallidos > 0 && (
            <p className="text-[11px] text-[#9A9A9A] mt-2">No salieron: <b>{reporte.fallidos}</b> (números inválidos o sin WhatsApp).</p>
          )}
          <p className="text-[10px] text-[#9A9A9A] mt-2">Los estados llegan poco a poco desde WhatsApp; esta tarjeta se actualiza sola cada pocos segundos.</p>
        </div>
      )}

      {/* Historial de campañas */}
      {campanas.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4">
          <p className="text-[12px] font-bold text-[#0D0D0D] uppercase mb-2">📊 Campañas anteriores</p>
          <div className="space-y-1.5">
            {campanas.map(c => (
              <button key={c.campanaId} onClick={() => setReporte(c)}
                className="w-full text-left flex items-center justify-between gap-2 rounded-xl border border-[#EEE] px-3 py-2 hover:bg-[#F8FAFA]">
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[#0D0D0D] truncate">{c.template || c.campanaId}</span>
                  <span className="block text-[10px] text-[#9A9A9A]">{c.fecha ? new Date(c.fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span>
                </span>
                <span className="shrink-0 text-[11px] font-bold text-[#6B6B6B]">
                  {c.enviados} env · <span className="text-[#2563EB]">{c.entregados} entr</span> · <span className="text-[#7C3AED]">{c.leidos} leí</span> · <span className="text-[#15803D]">{c.respondieron} resp</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
    </div>
  );
}

/** Cuadrito de métrica del reporte. */
function Metrica({ etiqueta, valor, color }: { etiqueta: string; valor: number; color: string }) {
  return (
    <div className="rounded-xl bg-white border border-[#E8E8E8] px-3 py-2 text-center">
      <div className="text-xl font-extrabold" style={{ color }}>{valor}</div>
      <div className="text-[10px] font-bold text-[#6B6B6B] uppercase">{etiqueta}</div>
    </div>
  );
}

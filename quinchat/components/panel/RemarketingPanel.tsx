'use client';

import { useEffect, useState } from 'react';

interface EtiquetaConteo { nombre: string; color: string; count: number }

/**
 * Remarketing por etiqueta: eliges una o varias etiquetas y envías una plantilla
 * de Meta APROBADA (promo/descuento) a todos esos clientes. Funciona fuera de la
 * ventana de 24h porque usa plantilla.
 */
export default function RemarketingPanel() {
  const [etiquetas, setEtiquetas] = useState<EtiquetaConteo[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [template, setTemplate] = useState('promo_amor_amistad_24h');
  const [imageUrl, setImageUrl] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ total: number; enviados: number; fallidos: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/remarketing')
      .then(r => r.json())
      .then(d => setEtiquetas(d.etiquetas ?? []))
      .catch(() => setError('No se pudieron cargar las etiquetas.'))
      .finally(() => setCargando(false));
  }, []);

  const toggle = (n: string) => setSel(s => {
    const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x;
  });

  const totalSel = etiquetas.filter(e => sel.has(e.nombre)).reduce((s, e) => s + e.count, 0);

  async function enviar() {
    setError(null); setResultado(null);
    if (sel.size === 0) { setError('Elige al menos una etiqueta.'); return; }
    if (!template.trim()) { setError('Escribe el nombre de la plantilla aprobada en Meta.'); return; }
    const ok = window.confirm(
      `Vas a enviar la plantilla "${template}" a aprox. ${totalSel} cliente(s) de las etiquetas seleccionadas.\n\n¿Enviar ahora?`,
    );
    if (!ok) return;
    setEnviando(true);
    try {
      const res = await fetch('/api/remarketing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etiquetas: [...sel], template: template.trim(), imageUrl: imageUrl.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'No se pudo enviar.'); return; }
      setResultado(d);
    } catch {
      setError('Error de conexión al enviar.');
    } finally { setEnviando(false); }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-[#0D0D0D]">📣 Remarketing por etiqueta</h1>
        <p className="text-sm text-[#6B6B6B]">Envía una promo o descuento a todos los clientes de una etiqueta. Usa una plantilla de Meta aprobada (llega aunque hayan pasado más de 24h).</p>
      </div>

      {/* Etiquetas */}
      <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4">
        <p className="text-[12px] font-bold text-[#0D0D0D] uppercase mb-2">1. Elige a quién enviar</p>
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
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm" placeholder="https://… (solo si la plantilla lleva imagen)" />
        </div>
      </section>

      {/* Enviar */}
      <button onClick={enviar} disabled={enviando || sel.size === 0}
        className="w-full py-3 rounded-xl bg-[#00A89D] text-white font-extrabold text-base hover:opacity-90 disabled:opacity-50">
        {enviando ? 'Enviando…' : `📤 Enviar a ${totalSel} cliente(s)`}
      </button>

      {error && <p className="text-sm font-semibold text-[#DC2626] text-center">⚠️ {error}</p>}
      {resultado && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 text-center">
          <p className="font-extrabold text-[#15803D]">✅ Campaña enviada</p>
          <p className="text-sm text-[#0D0D0D] mt-1">Enviados: <b>{resultado.enviados}</b> · Fallidos: <b>{resultado.fallidos}</b> · Total: {resultado.total}</p>
          {resultado.fallidos > 0 && <p className="text-[11px] text-[#9A9A9A] mt-1">Los fallidos suelen ser números inválidos o sin WhatsApp.</p>}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface PlantillaWA {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  cuerpo: string;
  variables: number;
  tieneImagen: boolean;
}

const ESTADOS: Record<string, { texto: string; color: string; bg: string }> = {
  APPROVED: { texto: 'Aprobada',    color: '#4ADE80', bg: 'rgba(74,222,128,0.12)'  },
  PENDING:  { texto: 'En revisión', color: '#EAB308', bg: 'rgba(234,179,8,0.12)'   },
  REJECTED: { texto: 'Rechazada',   color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
  PAUSED:   { texto: 'Pausada',     color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' },
};

export default function PlantillasWhatsApp() {
  const [plantillas, setPlantillas] = useState<PlantillaWA[]>([]);
  const [cargando, setCargando]     = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [vista, setVista]           = useState<'lista' | 'nueva'>('lista');

  const [nombre, setNombre]       = useState('');
  const [categoria, setCategoria] = useState<'MARKETING' | 'UTILITY'>('MARKETING');
  const [cuerpo, setCuerpo]       = useState('');
  const [pie, setPie]             = useState('');
  const [imagen, setImagen]       = useState<{ base64: string; mime: string; nombre: string } | null>(null);
  const [ejemplos, setEjemplos]   = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso]         = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const numVars = new Set((cuerpo.match(/\{\{\s*\d+\s*\}\}/g) ?? [])).size;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res  = await fetch('/api/plantillas-wa', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'No se pudieron cargar.'); setPlantillas([]); }
      else { setError(null); setPlantillas(data.plantillas ?? []); }
    } catch {
      setError('No se pudo conectar con Meta.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    setEjemplos(prev => {
      const out = [...prev];
      out.length = numVars;
      return Array.from(out, v => v ?? '');
    });
  }, [numVars]);

  async function elegirImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede pesar más de 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setImagen({ base64: String(reader.result), mime: file.type, nombre: file.name });
    reader.readAsDataURL(file);
  }

  function limpiar() {
    setNombre(''); setCuerpo(''); setPie(''); setImagen(null);
    setEjemplos([]); setCategoria('MARKETING'); setAviso(null);
  }

  async function crear() {
    if (!nombre.trim() || !cuerpo.trim()) { alert('Ponle nombre y texto a la plantilla.'); return; }
    if (numVars > 0 && ejemplos.some(v => !v?.trim())) {
      alert('Completa un ejemplo para cada variable. Meta los exige para aprobarla.');
      return;
    }
    setGuardando(true); setAviso(null);
    try {
      const res = await fetch('/api/plantillas-wa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre, categoria, idioma: 'es', cuerpo, pie, ejemplos,
          imagenBase64: imagen?.base64, imagenMime: imagen?.mime,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAviso(`❌ ${data.error}`); return; }

      // Guardar la foto para reutilizarla en cada envío, sin pedir enlaces
      if (imagen && data.nombre) {
        await fetch('/api/plantillas-wa/imagen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: data.nombre, imagenBase64: imagen.base64, imagenMime: imagen.mime }),
        }).catch(() => {});
      }

      setAviso(`✅ "${data.nombre}" enviada a revisión. Meta suele responder en minutos.`);
      limpiar();
      await cargar();
      setVista('lista');
    } catch (e: any) {
      setAviso(`❌ ${e?.message ?? 'Error inesperado.'}`);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(nombrePlantilla: string) {
    if (!confirm(`¿Borrar la plantilla "${nombrePlantilla}"? No se puede deshacer.`)) return;
    await fetch(`/api/plantillas-wa?nombre=${encodeURIComponent(nombrePlantilla)}`, { method: 'DELETE' });
    await cargar();
  }

  const inputCls = 'w-full bg-[#1A1A1A] border border-[#252525] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40';

  // ── Formulario ─────────────────────────────────────────────────────────────
  if (vista === 'nueva') {
    return (
      <div className="p-6 max-w-4xl">
        <button
          onClick={() => { setVista('lista'); limpiar(); }}
          className="text-xs text-[#C9A84C] font-semibold mb-4 hover:underline"
        >← Volver</button>

        <h2 className="text-white font-bold text-base mb-1">Nueva plantilla de WhatsApp</h2>
        <p className="text-xs text-gray-600 mb-5">Meta debe aprobarla antes de poder usarla. Suele tardar unos minutos.</p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Nombre interno</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="promo_diciembre" className={inputCls} />
              <p className="text-[10px] text-gray-600 mt-1">Solo minúsculas y guion bajo. El cliente no lo ve.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Tipo</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value as 'MARKETING' | 'UTILITY')}
                className={inputCls}
              >
                <option value="MARKETING">Marketing — promociones, catálogos, novedades</option>
                <option value="UTILITY">Utilidad — estado del pedido, guía, recordatorio</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Foto de encabezado (opcional)</label>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" onChange={elegirImagen} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full px-3 py-2.5 rounded-lg border border-dashed border-[#333] text-xs text-gray-500 hover:border-[#C9A84C]/50 hover:text-[#C9A84C] transition-colors"
              >
                {imagen ? `🖼️ ${imagen.nombre} — cambiar` : '📷 Subir una foto (JPG o PNG, máx. 5 MB)'}
              </button>
              {imagen && (
                <button onClick={() => setImagen(null)} className="text-[10px] text-red-400 mt-1 hover:underline">Quitar foto</button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Mensaje</label>
              <textarea
                value={cuerpo}
                onChange={e => setCuerpo(e.target.value)}
                rows={6}
                placeholder={'Hola {{1}} 😊 Tenemos nueva colección de buzos de escuderías.\n\n¿Quieres que te muestre los modelos disponibles?'}
                className={`${inputCls} resize-y`}
              />
              <p className="text-[10px] text-gray-600 mt-1">
                Usa <code className="bg-[#1A1A1A] px-1 rounded text-[#C9A84C]">{'{{1}}'}</code>, <code className="bg-[#1A1A1A] px-1 rounded text-[#C9A84C]">{'{{2}}'}</code>… para lo que cambia en cada envío (nombre, producto…).
              </p>
            </div>

            {numVars > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Ejemplos de cada variable</label>
                <div className="space-y-2">
                  {Array.from({ length: numVars }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[11px] text-[#C9A84C] w-9 shrink-0">{`{{${i + 1}}}`}</span>
                      <input
                        value={ejemplos[i] ?? ''}
                        onChange={e => setEjemplos(prev => { const c = [...prev]; c[i] = e.target.value; return c; })}
                        placeholder={i === 0 ? 'Camila' : 'Buzo Ferrari'}
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-600 mt-1">Meta los pide para entender de qué trata la plantilla.</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Pie de página (opcional)</label>
              <input value={pie} onChange={e => setPie(e.target.value)} maxLength={60} placeholder="Klixmant — Moda para motociclistas" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">Así lo verá el cliente</label>
            <div className="rounded-2xl p-4 bg-[#0d1418] border border-[#1C1C1C] min-h-[220px]">
              <div className="bg-white rounded-xl rounded-tl-sm shadow-lg overflow-hidden max-w-[85%]">
                {imagen && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagen.base64} alt="" className="w-full h-36 object-cover" />
                )}
                <div className="px-3 py-2">
                  <p className="text-[13px] text-[#0D0D0D] whitespace-pre-wrap break-words">
                    {cuerpo
                      ? cuerpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => ejemplos[Number(n) - 1] || `{{${n}}}`)
                      : <span className="text-gray-400">Escribe el mensaje…</span>}
                  </p>
                  {pie && <p className="text-[11px] text-[#8696A0] mt-1.5">{pie}</p>}
                </div>
              </div>
            </div>

            {aviso && <div className="mt-4 text-xs p-3 rounded-lg bg-[#1A1A1A] text-gray-300 leading-snug">{aviso}</div>}

            <button
              onClick={crear}
              disabled={guardando}
              className="w-full mt-4 py-2.5 rounded-xl bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#d4b05c] disabled:opacity-50 transition-colors"
            >
              {guardando ? 'Enviando a Meta…' : 'Enviar a aprobación'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Lista ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-white font-bold text-base">Plantillas de WhatsApp</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Las únicas que puedes enviar cuando ya pasaron 24 horas del último mensaje del cliente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cargar} title="Actualizar" className="w-8 h-8 rounded-lg text-[#C9A84C] hover:bg-[#C9A84C]/10">⟳</button>
          <button
            onClick={() => setVista('nueva')}
            className="px-4 py-2 rounded-lg bg-[#C9A84C] text-black text-xs font-bold hover:bg-[#d4b05c] transition-colors"
          >+ Nueva plantilla</button>
        </div>
      </div>

      {error && <div className="text-xs p-3 rounded-lg bg-red-500/10 text-red-300 mb-4 leading-snug border border-red-500/20">{error}</div>}

      {cargando ? (
        <p className="text-sm text-gray-600 py-8 text-center">Cargando…</p>
      ) : plantillas.length === 0 && !error ? (
        <p className="text-sm text-gray-600 py-8 text-center">Aún no tienes plantillas. Crea la primera.</p>
      ) : (
        <div className="space-y-2">
          {plantillas.map(p => {
            const est = ESTADOS[p.status] ?? { texto: p.status, color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };
            return (
              <div key={p.id} className="bg-[#141414] rounded-xl border border-[#1F1F1F] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-sm font-semibold text-white truncate">{p.name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ color: est.color, background: est.bg }}>
                        {est.texto}
                      </span>
                      {p.tieneImagen && <span className="text-[10px] text-gray-600">🖼️ con foto</span>}
                      {p.variables > 0 && <span className="text-[10px] text-gray-600">{p.variables} variable{p.variables > 1 ? 's' : ''}</span>}
                    </div>
                    <p className="text-xs text-gray-500 whitespace-pre-wrap line-clamp-2">{p.cuerpo}</p>
                  </div>
                  <button
                    onClick={() => borrar(p.name)}
                    title="Borrar plantilla"
                    className="text-red-400 hover:bg-red-500/10 w-8 h-8 rounded-lg shrink-0 transition-colors"
                  >🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-gray-700 mt-6 leading-snug">
        Para enviarle una plantilla a un cliente, abre su chat y usa el botón 📋 junto al campo de mensaje.
      </p>
    </div>
  );
}

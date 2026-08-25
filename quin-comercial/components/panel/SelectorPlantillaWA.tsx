'use client';

import { useState, useEffect, useRef } from 'react';

interface PlantillaWA {
  id: string;
  name: string;
  status: string;
  language: string;
  cuerpo: string;
  variables: number;
  tieneImagen: boolean;
}

interface Props {
  telefono: string;                 // id de la conversación (ej. 573001234567)
  nombreContacto?: string;
  onCerrar: () => void;
  onEnviada: () => void;
}

/**
 * Escoger una plantilla aprobada y enviársela al cliente.
 * Es la única vía cuando ya pasaron 24 h desde su último mensaje.
 */
export default function SelectorPlantillaWA({ telefono, nombreContacto, onCerrar, onEnviada }: Props) {
  const [plantillas, setPlantillas] = useState<PlantillaWA[]>([]);
  const [cargando, setCargando]     = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [busca, setBusca]           = useState('');
  const [sel, setSel]               = useState<PlantillaWA | null>(null);
  const [valores, setValores]       = useState<string[]>([]);
  const [imagenUrl, setImagenUrl]   = useState('');
  const [enviando, setEnviando]     = useState(false);
  const [subiendoImg, setSubiendoImg] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/plantillas-wa', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) setError(data.error ?? 'No se pudieron cargar las plantillas.');
        else setPlantillas((data.plantillas ?? []).filter((p: PlantillaWA) => p.status === 'APPROVED'));
      } catch {
        setError('No se pudo conectar con Meta.');
      } finally { setCargando(false); }
    })();
  }, []);

  function elegir(p: PlantillaWA) {
    setSel(p);
    // La primera variable suele ser el nombre: se rellena sola
    const iniciales = Array.from({ length: p.variables }, (_, i) =>
      i === 0 ? (nombreContacto && nombreContacto !== 'Desconocido' ? nombreContacto.split(' ')[0] : '') : ''
    );
    setValores(iniciales);
    setImagenUrl('');

    // Recuperar la foto que se guardó al crear la plantilla
    if (p.tieneImagen) {
      fetch(`/api/plantillas-wa/imagen?nombre=${encodeURIComponent(p.name)}`)
        .then(r => r.json())
        .then(d => { if (d?.url) setImagenUrl(d.url); })
        .catch(() => {});
    }
  }

  /** Subir una foto desde el equipo y dejarla guardada para esta plantilla. */
  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !sel) return;
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede pesar más de 5 MB.'); return; }

    setSubiendoImg(true);
    try {
      const base64 = await new Promise<string>((ok, err) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result));
        r.onerror = err;
        r.readAsDataURL(file);
      });
      const res = await fetch('/api/plantillas-wa/imagen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: sel.name, imagenBase64: base64, imagenMime: file.type }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`No se pudo subir: ${data.error}`); return; }
      setImagenUrl(data.url);
    } finally {
      setSubiendoImg(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const vistaPrevia = sel
    ? sel.cuerpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => valores[Number(n) - 1] || `{{${n}}}`)
    : '';

  async function enviar() {
    if (!sel) return;
    if (sel.variables > 0 && valores.some(v => !v?.trim())) {
      alert('Completa todos los datos de la plantilla.');
      return;
    }
    if (sel.tieneImagen && !imagenUrl.trim()) {
      alert('Esta plantilla lleva foto. Súbela con el botón de arriba y queda guardada para siempre.');
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch('/api/plantillas-wa/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: telefono, nombre: sel.name, idioma: sel.language,
          variables: valores, imagenUrl: sel.tieneImagen ? imagenUrl.trim() : null,
          vistaPrevia,
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`No se pudo enviar: ${data.error}`); return; }
      onEnviada();
      onCerrar();
    } catch (e: any) {
      alert(`No se pudo enviar: ${e?.message ?? 'error'}`);
    } finally { setEnviando(false); }
  }

  const filtradas = plantillas.filter(p =>
    p.name.toLowerCase().includes(busca.toLowerCase()) ||
    p.cuerpo.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCerrar}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8E8E8] shrink-0">
          <div>
            <h3 className="text-sm font-bold text-[#0D0D0D]">Enviar plantilla</h3>
            <p className="text-[10px] text-[#6B6B6B]">Funciona aunque hayan pasado 24 horas</p>
          </div>
          <button onClick={onCerrar} className="text-[#6B6B6B] hover:text-[#0D0D0D] text-lg w-8 h-8">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {cargando ? (
            <p className="text-sm text-[#6B6B6B] text-center py-8">Cargando plantillas…</p>
          ) : error ? (
            <div className="text-xs p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] leading-snug">{error}</div>
          ) : !sel ? (
            <>
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar plantilla…"
                className="w-full px-3 py-2 rounded-lg border border-[#E8E8E8] text-sm mb-3 focus:outline-none focus:border-[#00A89D]"
              />
              {filtradas.length === 0 ? (
                <p className="text-xs text-[#6B6B6B] text-center py-8">
                  No hay plantillas aprobadas todavía.<br />
                  Créalas en <strong>Herramientas → Plantillas → WhatsApp</strong>.
                </p>
              ) : (
                <div className="space-y-2">
                  {filtradas.map(p => (
                    <button
                      key={p.id}
                      onClick={() => elegir(p)}
                      className="w-full text-left p-3 rounded-xl border border-[#E8E8E8] hover:border-[#00A89D] hover:bg-[#00A89D]/5 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-[#0D0D0D]">{p.name}</span>
                        {p.tieneImagen && <span className="text-[10px] text-[#6B6B6B]">🖼️</span>}
                        {p.variables > 0 && <span className="text-[10px] text-[#6B6B6B]">{p.variables} dato{p.variables > 1 ? 's' : ''}</span>}
                      </div>
                      <p className="text-[11px] text-[#6B6B6B] line-clamp-2 whitespace-pre-wrap">{p.cuerpo}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <button onClick={() => setSel(null)} className="text-xs text-[#00A89D] font-semibold mb-3 hover:underline">
                ← Escoger otra
              </button>

              {sel.variables > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-semibold text-[#0D0D0D]">Completa los datos</p>
                  {Array.from({ length: sel.variables }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[11px] text-[#6B6B6B] w-9 shrink-0">{`{{${i + 1}}}`}</span>
                      <input
                        value={valores[i] ?? ''}
                        onChange={e => setValores(prev => { const c = [...prev]; c[i] = e.target.value; return c; })}
                        placeholder={i === 0 ? 'Nombre del cliente' : 'Dato'}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-sm focus:outline-none focus:border-[#00A89D]"
                      />
                    </div>
                  ))}
                </div>
              )}

              {sel.tieneImagen && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-[#0D0D0D] mb-1.5">Foto de la plantilla</label>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png" onChange={subirFoto} className="hidden" />

                  {imagenUrl ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagenUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-[#E8E8E8]" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-[#15803D] font-medium">✓ Lista para enviar</p>
                        <button
                          onClick={() => fileRef.current?.click()}
                          disabled={subiendoImg}
                          className="text-[11px] text-[#00A89D] hover:underline disabled:opacity-50"
                        >
                          {subiendoImg ? 'Subiendo…' : 'Cambiar foto'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={subiendoImg}
                      className="w-full px-3 py-2.5 rounded-lg border border-dashed border-[#C9C9C9] text-xs text-[#6B6B6B] hover:border-[#00A89D] hover:text-[#00A89D] disabled:opacity-50 transition-colors"
                    >
                      {subiendoImg ? 'Subiendo…' : '📷 Subir la foto de esta plantilla'}
                    </button>
                  )}
                  <p className="text-[10px] text-[#6B6B6B] mt-1.5">
                    Queda guardada: la próxima vez se usa sola.
                  </p>
                </div>
              )}

              <p className="text-xs font-semibold text-[#0D0D0D] mb-2">Vista previa</p>
              <div className="rounded-xl p-3 bg-[#ECE5DD]">
                <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 shadow-sm max-w-[90%]">
                  <p className="text-[13px] text-[#0D0D0D] whitespace-pre-wrap break-words">{vistaPrevia}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {sel && (
          <div className="px-5 py-3 border-t border-[#E8E8E8] shrink-0">
            <button
              onClick={enviar}
              disabled={enviando}
              className="w-full py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A] disabled:opacity-50 transition-colors"
            >
              {enviando ? 'Enviando…' : 'Enviar al cliente'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

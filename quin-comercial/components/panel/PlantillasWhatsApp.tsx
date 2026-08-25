'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ConfirmacionModal from './ConfirmacionModal';

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

// Emojis frecuentes para el selector rápido del editor.
const EMOJIS = ['😊','😍','🥰','🙌','👍','🔥','✨','🎉','🚚','📦','✅','❌','⭐','💛','🛍️','👀','📸','🙏','💬','🕒','📍','🎁'];

// Formatea el texto de WhatsApp para la vista previa: *negrita*, _cursiva_, ~tachado~.
function fmtPreview(texto: string) {
  const partes = texto.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return partes.map((p, i) => {
    if (/^\*[^*\n]+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>;
    if (/^_[^_\n]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    if (/^~[^~\n]+~$/.test(p)) return <span key={i} className="line-through">{p.slice(1, -1)}</span>;
    return <span key={i}>{p}</span>;
  });
}

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
  const [botones, setBotones]     = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso]         = useState<string | null>(null);
  const [emojiAbierto, setEmojiAbierto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef   = useRef<HTMLTextAreaElement>(null);

  // Confirmaciones flotantes: salir sin guardar / eliminar plantilla.
  const [confSalir, setConfSalir]   = useState(false);
  const [aBorrar, setABorrar]       = useState<string | null>(null);

  const numVars = new Set((cuerpo.match(/\{\{\s*\d+\s*\}\}/g) ?? [])).size;

  // ¿Hay algo escrito sin guardar? (para avisar al salir).
  const hayCambios = !!(nombre.trim() || cuerpo.trim() || pie.trim() || imagen || botones.length > 0 || ejemplos.some(v => v?.trim()));

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
    setEjemplos([]); setBotones([]); setCategoria('MARKETING'); setAviso(null);
  }

  // ── Barra de formato del mensaje (como en Meta) ────────────────────────────
  function envolver(marca: string) {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart ?? cuerpo.length;
    const e = ta.selectionEnd ?? cuerpo.length;
    const sel = cuerpo.slice(s, e) || 'texto';
    const nuevo = cuerpo.slice(0, s) + marca + sel + marca + cuerpo.slice(e);
    setCuerpo(nuevo);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = s + marca.length;
      ta.selectionEnd = s + marca.length + sel.length;
    });
  }

  function insertar(txt: string) {
    const ta = taRef.current;
    if (!ta) { setCuerpo(c => c + txt); return; }
    const s = ta.selectionStart ?? cuerpo.length;
    const e = ta.selectionEnd ?? cuerpo.length;
    const nuevo = cuerpo.slice(0, s) + txt + cuerpo.slice(e);
    setCuerpo(nuevo);
    requestAnimationFrame(() => {
      ta.focus();
      const p = s + txt.length;
      ta.selectionStart = ta.selectionEnd = p;
    });
  }

  function insertarVariable() {
    const nums = (cuerpo.match(/\{\{\s*(\d+)\s*\}\}/g) ?? []).map(x => Number(x.replace(/\D/g, '')));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    insertar(`{{${next}}}`);
  }

  // ── Botones de respuesta rápida ────────────────────────────────────────────
  function agregarBoton() {
    if (botones.length >= 3) return;
    setBotones(prev => [...prev, '']);
  }
  function cambiarBoton(i: number, val: string) {
    setBotones(prev => { const c = [...prev]; c[i] = val.slice(0, 25); return c; });
  }
  function quitarBoton(i: number) {
    setBotones(prev => prev.filter((_, j) => j !== i));
  }

  async function crear() {
    if (!nombre.trim() || !cuerpo.trim()) { alert('Ponle nombre y texto a la plantilla.'); return; }
    if (numVars > 0 && ejemplos.some(v => !v?.trim())) {
      alert('Completa un ejemplo para cada variable. Meta los exige para aprobarla.');
      return;
    }
    const botonesLimpios = botones.map(b => b.trim()).filter(Boolean);
    setGuardando(true); setAviso(null);
    try {
      const res = await fetch('/api/plantillas-wa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre, categoria, idioma: 'es', cuerpo, pie, ejemplos,
          botones: botonesLimpios,
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

  // Salir del formulario: si hay cambios sin guardar, pide confirmación.
  function intentarVolver() {
    if (hayCambios) { setConfSalir(true); return; }
    setVista('lista'); limpiar();
  }
  function confirmarSalir() {
    setConfSalir(false); setVista('lista'); limpiar();
  }

  // Eliminar plantilla (con confirmación).
  async function confirmarBorrar() {
    const nombrePlantilla = aBorrar;
    setABorrar(null);
    if (!nombrePlantilla) return;
    await fetch(`/api/plantillas-wa?nombre=${encodeURIComponent(nombrePlantilla)}`, { method: 'DELETE' });
    await cargar();
  }

  const inputCls = 'w-full bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm text-[#0D0D0D] placeholder:text-[#B5B5B5] focus:outline-none focus:border-[#00A89D]';
  const btnBarra = 'w-8 h-8 rounded-lg border border-[#E8E8E8] text-[#3A3A3A] hover:border-[#00A89D] hover:text-[#00A89D] flex items-center justify-center text-sm transition-colors';

  // ── Formulario ─────────────────────────────────────────────────────────────
  if (vista === 'nueva') {
    return (
      <div className="p-6 max-w-4xl">
        <button
          onClick={intentarVolver}
          className="text-xs text-[#00A89D] font-semibold mb-4 hover:underline"
        >← Volver</button>

        <h2 className="text-[#0D0D0D] font-bold text-base mb-1">Nueva plantilla de WhatsApp</h2>
        <p className="text-xs text-[#9A9A9A] mb-5">Meta debe aprobarla antes de poder usarla. Suele tardar unos minutos.</p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Nombre interno</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="promo_diciembre" className={inputCls} />
              <p className="text-[10px] text-[#9A9A9A] mt-1">Solo minúsculas y guion bajo. El cliente no lo ve.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Tipo</label>
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
              <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Foto de encabezado (opcional)</label>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" onChange={elegirImagen} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full px-3 py-2.5 rounded-lg border border-dashed border-[#E8E8E8] text-xs text-[#9A9A9A] hover:border-[#00A89D]/50 hover:text-[#00A89D] transition-colors"
              >
                {imagen ? `🖼️ ${imagen.nombre} — cambiar` : '📷 Subir una foto (JPG o PNG, máx. 5 MB)'}
              </button>
              <p className="text-[10px] text-[#9A9A9A] mt-1">Formatos que Meta acepta en el encabezado: JPG o PNG, hasta 5 MB. Debe ser una imagen real (no logos genéricos ni marcas de agua) para que aprueben la plantilla.</p>
              {imagen && (
                <button onClick={() => setImagen(null)} className="text-[10px] text-red-600 mt-1 hover:underline">Quitar foto</button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Mensaje</label>

              {/* Barra de formato (como en Meta): negrita, cursiva, tachado, variable, emoji */}
              <div className="flex items-center gap-1.5 mb-1.5 relative">
                <button type="button" onClick={() => envolver('*')} className={btnBarra} title="Negrita (*texto*)"><strong>B</strong></button>
                <button type="button" onClick={() => envolver('_')} className={btnBarra} title="Cursiva (_texto_)"><em>I</em></button>
                <button type="button" onClick={() => envolver('~')} className={btnBarra} title="Tachado (~texto~)"><span className="line-through">S</span></button>
                <button type="button" onClick={insertarVariable} className="h-8 px-2.5 rounded-lg border border-[#E8E8E8] text-[#3A3A3A] hover:border-[#00A89D] hover:text-[#00A89D] text-xs font-semibold transition-colors" title="Insertar variable">+ Variable</button>
                <button type="button" onClick={() => setEmojiAbierto(v => !v)} className={btnBarra} title="Emojis">😊</button>
                {emojiAbierto && (
                  <div className="absolute top-9 right-0 z-20 w-56 p-2 bg-white border border-[#E8E8E8] rounded-xl shadow-xl grid grid-cols-8 gap-1">
                    {EMOJIS.map(em => (
                      <button key={em} type="button" onClick={() => { insertar(em); setEmojiAbierto(false); }} className="text-lg hover:bg-[#F5F5F5] rounded">{em}</button>
                    ))}
                  </div>
                )}
              </div>

              <textarea
                ref={taRef}
                value={cuerpo}
                onChange={e => setCuerpo(e.target.value)}
                rows={6}
                placeholder={'Hola {{1}} 😊 Tenemos nueva colección de buzos de escuderías.\n\n¿Quieres que te muestre los modelos disponibles?'}
                className={`${inputCls} resize-y`}
              />
              <p className="text-[10px] text-[#9A9A9A] mt-1">
                Formato de WhatsApp: <b>*negrita*</b>, <i>_cursiva_</i>, ~tachado~. Usa <code className="bg-[#F5F5F5] px-1 rounded text-[#00A89D]">{'{{1}}'}</code>, <code className="bg-[#F5F5F5] px-1 rounded text-[#00A89D]">{'{{2}}'}</code>… para lo que cambia en cada envío.
              </p>
            </div>

            {numVars > 0 && (
              <div>
                <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Ejemplos de cada variable</label>
                <div className="space-y-2">
                  {Array.from({ length: numVars }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[11px] text-[#00A89D] w-9 shrink-0">{`{{${i + 1}}}`}</span>
                      <input
                        value={ejemplos[i] ?? ''}
                        onChange={e => setEjemplos(prev => { const c = [...prev]; c[i] = e.target.value; return c; })}
                        placeholder={['Imer', 'Imer Montero', '3126119455', 'Calle 17C #135-51', 'Bogotá', 'Cundinamarca', 'correo@correo.com', 'XXL HOMBRE', 'BUZO KTM NEGRO', '129.900'][i] ?? 'Ejemplo'}
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[#9A9A9A] mt-1">Meta los pide para entender de qué trata la plantilla.</p>
              </div>
            )}

            {/* Botones de respuesta rápida */}
            <div>
              <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Botones de respuesta rápida (opcional)</label>
              <div className="space-y-2">
                {botones.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={b}
                      onChange={e => cambiarBoton(i, e.target.value)}
                      maxLength={25}
                      placeholder={i === 0 ? 'Ver catálogo' : i === 1 ? 'Comprar ahora' : 'Más info'}
                      className={inputCls}
                    />
                    <button onClick={() => quitarBoton(i)} title="Quitar botón" className="text-red-600 hover:bg-red-50 w-8 h-8 rounded-lg shrink-0">✕</button>
                  </div>
                ))}
              </div>
              {botones.length < 3 && (
                <button onClick={agregarBoton} className="mt-2 text-xs font-semibold text-[#00A89D] hover:underline">+ Agregar botón</button>
              )}
              <p className="text-[10px] text-[#9A9A9A] mt-1">Hasta 3 botones, máximo 25 caracteres cada uno. El cliente los ve como botones para responder de un toque (ej. “Ver catálogo”).</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Pie de página (opcional)</label>
              <input value={pie} onChange={e => setPie(e.target.value)} maxLength={60} placeholder="Klixmant — Moda para motociclistas" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#6B6B6B] mb-2">Así lo verá el cliente</label>
            <div className="rounded-2xl p-4 bg-[#F5F5F5] border border-[#E8E8E8] min-h-[220px]">
              <div className="bg-white rounded-xl rounded-tl-sm shadow-lg overflow-hidden max-w-[85%]">
                {imagen && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagen.base64} alt="" className="w-full h-36 object-cover" />
                )}
                <div className="px-3 py-2">
                  <p className="text-[13px] text-[#0D0D0D] whitespace-pre-wrap break-words">
                    {cuerpo
                      ? fmtPreview(cuerpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => ejemplos[Number(n) - 1] || `{{${n}}}`))
                      : <span className="text-[#9A9A9A]">Escribe el mensaje…</span>}
                  </p>
                  {pie && <p className="text-[11px] text-[#8696A0] mt-1.5">{pie}</p>}
                </div>
                {botones.filter(b => b.trim()).length > 0 && (
                  <div className="border-t border-[#F0F0F0]">
                    {botones.filter(b => b.trim()).map((b, i) => (
                      <div key={i} className="text-center py-2 text-[13px] font-medium text-[#00A5F4] border-b border-[#F0F0F0] last:border-b-0">{b}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {aviso && <div className="mt-4 text-xs p-3 rounded-lg bg-[#F5F5F5] text-[#3A3A3A] leading-snug">{aviso}</div>}

            <button
              onClick={crear}
              disabled={guardando}
              className="w-full mt-4 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-bold hover:bg-[#00847A] disabled:opacity-50 transition-colors"
            >
              {guardando ? 'Enviando a Meta…' : 'Enviar a aprobación'}
            </button>
          </div>
        </div>

        <ConfirmacionModal
          abierto={confSalir}
          titulo="¿Deseas salir de Plantillas sin guardar?"
          mensaje="Perderás lo que hayas escrito en esta plantilla. Esta acción no se puede deshacer."
          textoAceptar="Salir sin guardar"
          peligro
          onAceptar={confirmarSalir}
          onCancelar={() => setConfSalir(false)}
        />
      </div>
    );
  }

  // ── Lista ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-[#0D0D0D] font-bold text-base">Plantilla de WhatsApp</h2>
          <p className="text-xs text-[#9A9A9A] mt-0.5">
            Aprobadas por Meta. Las únicas para escribirle primero al cliente o cuando ya pasaron las 24 h.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cargar} title="Actualizar" className="w-8 h-8 rounded-lg text-[#00A89D] hover:bg-[#00A89D]/10">⟳</button>
          <button
            onClick={() => setVista('nueva')}
            className="px-4 py-2 rounded-lg bg-[#00A89D] text-white text-xs font-bold hover:bg-[#00847A] transition-colors"
          >+ Nueva plantilla</button>
        </div>
      </div>

      {error && <div className="text-xs p-3 rounded-lg bg-red-50 text-red-600 mb-4 leading-snug border border-red-200">{error}</div>}

      {cargando ? (
        <p className="text-sm text-[#9A9A9A] py-8 text-center">Cargando…</p>
      ) : plantillas.length === 0 && !error ? (
        <p className="text-sm text-[#9A9A9A] py-8 text-center">Aún no tienes plantillas. Crea la primera.</p>
      ) : (
        <div className="space-y-2">
          {plantillas.map(p => {
            const est = ESTADOS[p.status] ?? { texto: p.status, color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };
            return (
              <div key={p.id} className="bg-white rounded-xl border border-[#E8E8E8] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-sm font-semibold text-[#0D0D0D] truncate">{p.name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ color: est.color, background: est.bg }}>
                        {est.texto}
                      </span>
                      {p.tieneImagen && <span className="text-[10px] text-[#9A9A9A]">🖼️ con foto</span>}
                      {p.variables > 0 && <span className="text-[10px] text-[#9A9A9A]">{p.variables} variable{p.variables > 1 ? 's' : ''}</span>}
                    </div>
                    <p className="text-xs text-[#9A9A9A] whitespace-pre-wrap line-clamp-2">{p.cuerpo}</p>
                  </div>
                  <button
                    onClick={() => setABorrar(p.name)}
                    title="Borrar plantilla"
                    className="text-red-600 hover:bg-red-50 w-8 h-8 rounded-lg shrink-0 transition-colors"
                  >🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-[#9A9A9A] mt-6 leading-snug">
        Para enviarle una plantilla a un cliente, abre su chat y usa el botón 📋 junto al campo de mensaje.
      </p>

      <ConfirmacionModal
        abierto={!!aBorrar}
        titulo="¿Estás seguro que deseas eliminar la plantilla?"
        mensaje={aBorrar ? `Se eliminará "${aBorrar}" de forma permanente. Esta acción no se puede deshacer.` : undefined}
        textoAceptar="Eliminar"
        peligro
        onAceptar={confirmarBorrar}
        onCancelar={() => setABorrar(null)}
      />
    </div>
  );
}

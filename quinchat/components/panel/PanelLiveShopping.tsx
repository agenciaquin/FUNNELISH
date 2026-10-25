'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import VentasLive, { ESTADO_UI } from './VentasLive';

// ───────────────────────── tipos del editor ─────────────────────────
type EstadoLive = 'borrador' | 'activo' | 'archivado';
interface LiveResumen { id: string; slug: string; titulo: string; estado: EstadoLive; video_url: string | null; poster_url: string | null; whatsapp: string | null; etiqueta_grabada: string | null; duracion_seg: number | null; embudo_slug: string | null; creado_en: string; productos: number; }
interface VentaMini { id: number; foto: string | null; producto: string; valor: number; estado: 'pendiente' | 'confirmado' | 'cancelado'; fecha: string; }
interface Color { id?: string; nombre: string; hex: string; foto_url: string; }
interface Producto { id: string; nombre: string; descripcion: string | null; ficha_tela: string | null; ficha_cuidados: string | null; precio: number; precio_antes: number | null; promo_etiqueta: string | null; promo_unidades: number | null; promo_precio: number | null; tallas: string[]; colores: Color[]; }
interface EventoTL { tipo: 'producto' | 'pregunta_frecuente' | 'comentario'; inicio_seg: number; fin_seg: number; producto_id?: string | null; pregunta?: string; respuesta?: string; autor?: string; texto?: string; }
interface LiveFull { id: string; slug: string; titulo: string; estado: EstadoLive; video_url: string | null; poster_url: string | null; whatsapp: string | null; etiqueta_grabada: string | null; duracion_seg: number | null; tienda_nombre: string | null; tienda_logo: string | null; modo: string; comentarios: string[] | null; embudo_slug: string | null; }

const TALLAS = ['S', 'M', 'L', 'XL'];
const peso = (n: number) => `$${(Number(n) || 0).toLocaleString('es-CO')}`;
// Precios: la gente escribe "195.000"; guardamos solo los dígitos → 195000.
const soloNum = (s: string) => Number(String(s).replace(/\D/g, '')) || 0;
const verNum = (n: number | null | undefined) => (n == null || n === 0 ? '' : Number(n).toLocaleString('es-CO'));

async function api(url: string, opts?: RequestInit) {
  const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || 'error');
  return j;
}

export default function PanelLiveShopping() {
  const [lives, setLives] = useState<LiveResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel] = useState<string | null>(null);  // id del live en edición
  const [copiado, setCopiado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const flash = useCallback((t: string) => { setAviso(t); setTimeout(() => setAviso(null), 2200); }, []);

  const cargarLives = useCallback(async () => {
    setCargando(true);
    try { const j = await api('/api/live-admin/lives'); setLives(j.lives ?? []); }
    catch { setLives([]); }
    setCargando(false);
  }, []);
  useEffect(() => { cargarLives(); }, [cargarLives]);

  const urlPublica = (slug: string) => (typeof window !== 'undefined' ? window.location.origin : '') + `/live/${slug}`;
  const copiar = async (slug: string) => { try { await navigator.clipboard.writeText(urlPublica(slug)); setCopiado(slug); setTimeout(() => setCopiado(null), 1600); } catch { /* */ } };

  const crearLive = async () => {
    try { const j = await api('/api/live-admin/lives', { method: 'POST', body: JSON.stringify({ titulo: 'Nuevo live' }) }); await cargarLives(); setSel(j.live.id); }
    catch (e: any) { flash('No se pudo crear: ' + e.message); }
  };
  const borrarLive = async (id: string) => {
    if (!confirm('¿Borrar este live? No se puede deshacer.')) return;
    try { await api(`/api/live-admin/lives/${id}`, { method: 'DELETE' }); if (sel === id) setSel(null); await cargarLives(); }
    catch (e: any) { flash('No se pudo borrar: ' + e.message); }
  };

  // ── Navegación interna del módulo (sin recargar la app) ──
  const [vista, setVista] = useState<'inicio' | 'editar' | 'ventas'>('inicio');
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [resumen, setResumen] = useState<{ hoy: number; mes: number; recientes: VentaMini[] } | null>(null);

  const cargarResumen = useCallback(async () => {
    try {
      const j = await api('/api/live-admin/ventas?resumen=1');
      setResumen({ hoy: j.kpis?.hoy ?? 0, mes: j.kpis?.mes ?? 0, recientes: j.recientes ?? [] });
    } catch { setResumen({ hoy: 0, mes: 0, recientes: [] }); }
  }, []);
  useEffect(() => { cargarResumen(); }, [cargarResumen]);

  const alternarActivo = async (l: LiveResumen) => {
    const nuevo: EstadoLive = l.estado === 'activo' ? 'borrador' : 'activo';
    try { await api(`/api/live-admin/lives/${l.id}`, { method: 'PATCH', body: JSON.stringify({ estado: nuevo }) }); flash(nuevo === 'activo' ? 'Live activado (público)' : 'Live desactivado (borrador)'); await cargarLives(); }
    catch (e: any) { flash('No se pudo cambiar: ' + e.message); }
  };

  if (sel) return <EditorLive id={sel} onVolver={() => { setSel(null); cargarLives(); }} onAviso={flash} />;
  if (vista === 'ventas') return <VentasLive onVolver={() => { setVista('inicio'); cargarResumen(); }} />;

  const vistaPrevia = lives.find(l => l.estado === 'activo' && l.video_url) ?? lives.find(l => l.video_url);

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto bg-brand-ivory p-4 md:p-8">
      <style>{`@keyframes pl-float{0%{opacity:0;transform:translateY(0) scale(.6)}15%{opacity:1}100%{opacity:0;transform:translateY(-90px) scale(1.15)}}
      .pl-h{position:absolute;animation:pl-float 2.6s ease-out infinite}
      @media (prefers-reduced-motion: reduce){.pl-h{animation:none;opacity:.9}}`}</style>
      <div className="max-w-6xl mx-auto">
        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-2xl bg-white border border-brand-border shadow-sm flex items-center justify-center text-2xl">🎬</span>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-brand-black tracking-tight">QUIN LIVE SHOPPING</h1>
            <p className="text-sm text-brand-gray-mid">Gestiona tus transmisiones grabadas y revisa todas las ventas generadas desde tus lives.</p>
          </div>
        </div>

        {aviso && <div className="mb-4 text-sm bg-[#00A89D] text-white rounded-lg px-3 py-2">{aviso}</div>}

        {vista === 'inicio' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            {/* ── Tarjeta EDITAR LIVES ── */}
            <div className="relative overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-violet-100/60 p-5 md:p-6 shadow-[0_8px_30px_rgba(109,40,217,.08)]">
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="w-14 h-14 shrink-0 rounded-2xl bg-violet-100 flex items-center justify-center text-3xl">🎬</span>
                    <div>
                      <h2 className="text-xl font-extrabold text-brand-black">Editar lives</h2>
                      <p className="text-sm text-brand-gray-mid leading-snug">Crea, edita y gestiona tus transmisiones de live shopping.</p>
                    </div>
                  </div>
                  <ul className="space-y-2.5 mb-5">
                    {['Sube y organiza tus videos', 'Agrega productos y precios', 'Configura la línea de tiempo', 'Activa o desactiva lives'].map(t => (
                      <li key={t} className="flex items-center gap-2.5 text-sm text-brand-black">
                        <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] flex items-center justify-center shrink-0">✓</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Miniatura del live (video real del primer live) */}
                <div className="hidden sm:block relative w-[150px] h-[230px] shrink-0 rounded-[22px] overflow-hidden bg-neutral-900 border-4 border-neutral-900 shadow-xl">
                  {vistaPrevia?.video_url
                    ? <video src={vistaPrevia.video_url} poster={vistaPrevia.poster_url ?? undefined} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline preload="metadata" />
                    : <div className="absolute inset-0 bg-gradient-to-b from-violet-500 to-fuchsia-600" />}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
                  <span className="absolute top-2 left-2 text-[8px] font-bold bg-black/60 text-white rounded-full px-1.5 py-0.5">● PRESENTACIÓN</span>
                  <span className="pl-h right-2 bottom-16 text-sm">❤️</span>
                  <span className="pl-h right-4 bottom-16 text-xs" style={{ animationDelay: '.8s' }}>❤️</span>
                  <span className="pl-h right-1 bottom-16 text-base" style={{ animationDelay: '1.6s' }}>❤️</span>
                  <div className="absolute left-2 right-2 bottom-2 rounded-xl bg-black/65 border border-white/20 p-1.5">
                    <p className="text-[9px] font-bold text-white truncate">{vistaPrevia?.titulo ?? 'Tu live'}</p>
                    <span className="mt-1 block text-center text-[9px] font-bold text-white bg-[#ff3366] rounded-md py-1">🛒 Comprar</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setVista('editar')} className="w-full md:w-auto md:min-w-[260px] px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md transition-colors">Ir a editar lives →</button>
            </div>

            {/* ── Tarjeta VENTAS LIVE ── */}
            <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-100/60 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,168,157,.10)]">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="w-14 h-14 shrink-0 rounded-2xl bg-[#00A89D] flex items-center justify-center text-3xl shadow">🛍️</span>
                    <div>
                      <h2 className="text-xl font-extrabold text-brand-black">Ventas live</h2>
                      <p className="text-sm text-brand-gray-mid leading-snug">Revisa todas las ventas generadas desde tus lives.</p>
                    </div>
                  </div>
                  <ul className="space-y-2.5 mb-5">
                    {['Todas las ventas en un solo lugar', 'Filtra por live, fecha o producto', 'Estado de pedidos en tiempo real', 'Exporta reportes'].map(t => (
                      <li key={t} className="flex items-center gap-2.5 text-sm text-brand-black">
                        <span className="w-5 h-5 rounded-full bg-[#00A89D] text-white text-[11px] flex items-center justify-center shrink-0">✓</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Ventas recientes (reales) */}
                <div className="sm:w-[210px] shrink-0 space-y-2">
                  {resumen === null ? (
                    <p className="text-xs text-brand-gray-mid">Cargando ventas…</p>
                  ) : resumen.recientes.length === 0 ? (
                    <div className="rounded-2xl bg-white/80 border border-emerald-100 p-3 text-xs text-brand-gray-mid">Aún no hay ventas desde tus lives. Aparecerán aquí apenas entre la primera.</div>
                  ) : resumen.recientes.map(v => (
                    <div key={v.id} className="rounded-2xl bg-white border border-emerald-100 p-2 flex gap-2 shadow-sm">
                      {v.foto ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.foto} alt="" className="w-11 h-11 rounded-lg object-cover bg-neutral-100 shrink-0" /> : <span className="w-11 h-11 rounded-lg bg-neutral-100 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-brand-black truncate">{v.producto}</p>
                        <p className="text-[12px] font-extrabold">{peso(v.valor)}</p>
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ESTADO_UI[v.estado].cls}`}>{ESTADO_UI[v.estado].txt}</span>
                          <span className="text-[9px] text-brand-gray-mid">{hace(v.fecha)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setVista('ventas')} className="w-full md:w-auto md:min-w-[260px] px-6 py-3 rounded-xl bg-[#00847A] hover:bg-[#006B63] text-white font-bold text-sm shadow-md transition-colors">Ver ventas live →</button>
              {resumen && (resumen.hoy > 0 || resumen.mes > 0) && (
                <p className="text-[11px] text-brand-gray-mid mt-2">Hoy: {resumen.hoy} pedido{resumen.hoy === 1 ? '' : 's'} · Este mes: {resumen.mes}</p>
              )}
            </div>
          </div>
        ) : (
          <button onClick={() => setVista('inicio')} className="text-sm text-[#00A89D] font-semibold mb-4">← Volver a Live Shopping</button>
        )}

        {/* ── MIS LIVES ── */}
        <section className="bg-white border border-brand-border rounded-3xl p-4 md:p-6 shadow-sm mb-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-brand-black">{vista === 'editar' ? 'Administrar lives' : 'Mis lives'}</h2>
              <p className="text-sm text-brand-gray-mid">Tus transmisiones de live shopping</p>
            </div>
            <button onClick={crearLive} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#00A89D] text-white hover:bg-[#007A72] shadow-sm">+ Nuevo live</button>
          </div>

          {cargando ? <p className="text-sm text-brand-gray-mid">Cargando…</p> : lives.length === 0 ? (
            <p className="text-sm text-brand-gray-mid py-6 text-center">Todavía no hay lives. Crea el primero con “+ Nuevo live”.</p>
          ) : (
            <div className="space-y-3">
              {lives.map(l => (
                <div key={l.id} className="rounded-2xl border border-brand-border p-3 flex flex-col md:flex-row md:items-center gap-3 hover:shadow-sm transition-shadow">
                  {/* Miniatura + datos */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative w-[96px] h-[64px] md:w-[110px] md:h-[72px] shrink-0 rounded-xl overflow-hidden bg-neutral-200">
                      {l.video_url
                        ? <video src={`${l.video_url}#t=1`} poster={l.poster_url ?? undefined} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                        : <div className="w-full h-full bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-2xl">🎬</div>}
                      {l.duracion_seg ? <span className="absolute bottom-1 right-1 text-[10px] font-bold bg-black/75 text-white rounded px-1">{duracion(l.duracion_seg)}</span> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-brand-black truncate">{l.titulo}</p>
                        <EstadoChip estado={l.estado} />
                      </div>
                      <p className="text-xs text-brand-gray-mid truncate">/live/{l.slug} · {l.productos} producto{l.productos === 1 ? '' : 's'}</p>
                      {l.embudo_slug && <p className="text-[11px] text-[#00847A] truncate">Checkout: {l.embudo_slug}</p>}
                    </div>
                  </div>
                  {/* Fecha real */}
                  <div className="flex items-center gap-2 md:w-[170px] shrink-0 md:border-l md:border-brand-border md:pl-4">
                    <span className="text-lg">📅</span>
                    <div className="text-[11px] leading-tight text-brand-gray-mid">
                      <p>Creado el</p>
                      <p className="text-brand-black font-semibold">{fechaLarga(l.creado_en)}</p>
                    </div>
                  </div>
                  {/* Acciones */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setSel(l.id)} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00A89D] text-white hover:bg-[#007A72]">Editar</button>
                    <button onClick={() => copiar(l.slug)} className="px-3 py-2 rounded-xl text-xs font-semibold border border-brand-border hover:bg-brand-gray-light whitespace-nowrap">{copiado === l.slug ? '¡Copiado!' : 'Copiar enlace'}</button>
                    <a href={`/live/${l.slug}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-xl text-xs font-semibold border border-brand-border hover:bg-brand-gray-light">Abrir</a>
                    <div className="relative">
                      <button onClick={() => setMenuAbierto(menuAbierto === l.id ? null : l.id)} aria-label="Más acciones" className="w-9 h-9 rounded-xl border border-brand-border hover:bg-brand-gray-light font-bold">⋯</button>
                      {menuAbierto === l.id && (
                        <>
                          <span className="fixed inset-0 z-10" onClick={() => setMenuAbierto(null)} />
                          <div className="absolute right-0 top-10 z-20 w-48 bg-white rounded-xl border border-brand-border shadow-xl overflow-hidden">
                            <button onClick={() => { setMenuAbierto(null); alternarActivo(l); }} className="w-full text-left px-3 py-2 text-xs hover:bg-brand-gray-light">{l.estado === 'activo' ? '⏸️ Desactivar (borrador)' : '▶️ Activar (público)'}</button>
                            <button onClick={() => { setMenuAbierto(null); setVista('ventas'); }} className="w-full text-left px-3 py-2 text-xs hover:bg-brand-gray-light">🛍️ Ver ventas live</button>
                            <button onClick={() => { setMenuAbierto(null); borrarLive(l.id); }} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50">🗑️ Eliminar</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ───────────────────────── moderación del chat del público ─────────────────────────
function ModeracionChat({ liveId }: { liveId: string }) {
  const [lista, setLista] = useState<{ id: number; nombre: string; texto: string; segundo: number; estado: 'visible' | 'oculto'; creado_en: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { const j = await api(`/api/live-admin/comentarios?live_id=${liveId}`); setLista(j.comentarios ?? []); }
    catch { setLista([]); }
    setCargando(false);
  }, [liveId]);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiar = async (id: number, estado: 'visible' | 'oculto') => {
    await api('/api/live-admin/comentarios', { method: 'PATCH', body: JSON.stringify({ id, estado }) }).catch(() => {});
    setLista(l => l.map(c => c.id === id ? { ...c, estado } : c));
  };
  const borrar = async (id: number) => {
    if (!confirm('¿Borrar este comentario para siempre?')) return;
    await api(`/api/live-admin/comentarios?id=${id}`, { method: 'DELETE' }).catch(() => {});
    setLista(l => l.filter(c => c.id !== id));
  };

  const visibles = lista.filter(c => c.estado === 'visible').length;
  return (
    <section className="bg-white border border-brand-border rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-brand-black">Comentarios del público</h2>
          <p className="text-xs text-brand-gray-mid">Lo que escriben los clientes en el live. Se repiten en el mismo segundo del video para quien entre después. {cargando ? '' : `${visibles} visibles · ${lista.length - visibles} ocultos`}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-brand-border hover:bg-brand-gray-light">↻</button>
          <button onClick={() => setAbierto(a => !a)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-brand-border hover:bg-brand-gray-light">{abierto ? 'Ocultar lista' : 'Moderar'}</button>
        </div>
      </div>
      {abierto && (
        <div className="mt-3 max-h-80 overflow-y-auto space-y-2">
          {cargando ? <p className="text-sm text-brand-gray-mid">Cargando…</p> : lista.length === 0 ? (
            <p className="text-sm text-brand-gray-mid">Todavía nadie ha comentado en este live.</p>
          ) : lista.map(c => (
            <div key={c.id} className={`flex items-start gap-2 rounded-xl border p-2 ${c.estado === 'oculto' ? 'border-red-200 bg-red-50/50 opacity-70' : 'border-brand-border'}`}>
              <div className="min-w-0 flex-1">
                <p className="text-xs"><b>{c.nombre}</b> <span className="text-brand-gray-mid">· seg {Math.round(c.segundo)} · {fechaLarga(c.creado_en)}</span></p>
                <p className="text-sm break-words">{c.texto}</p>
              </div>
              {c.estado === 'visible'
                ? <button onClick={() => cambiar(c.id, 'oculto')} className="shrink-0 px-2 py-1 rounded-lg text-[11px] font-semibold border border-brand-border">Ocultar</button>
                : <button onClick={() => cambiar(c.id, 'visible')} className="shrink-0 px-2 py-1 rounded-lg text-[11px] font-semibold border border-brand-border">Mostrar</button>}
              <button onClick={() => borrar(c.id)} className="shrink-0 px-2 py-1 rounded-lg text-[11px] font-semibold text-red-600 border border-red-200">Borrar</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function duracion(seg: number) {
  const s = Math.max(0, Math.round(seg));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
function fechaLarga(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function hace(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  return `Hace ${Math.round(h / 24)} d`;
}

function EstadoChip({ estado }: { estado: EstadoLive }) {
  const m: Record<EstadoLive, string> = { activo: 'bg-emerald-100 text-emerald-700', borrador: 'bg-amber-100 text-amber-700', archivado: 'bg-neutral-200 text-neutral-600' };
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${m[estado]}`}>{estado}</span>;
}

// ───────────────────────── editor de un live ─────────────────────────
function EditorLive({ id, onVolver, onAviso }: { id: string; onVolver: () => void; onAviso: (t: string) => void }) {
  const [live, setLive] = useState<LiveFull | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [timeline, setTimeline] = useState<EventoTL[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  // Aviso visible DENTRO del editor (antes solo salía en la lista).
  const [aviso, setAviso] = useState<string | null>(null);
  const flash = useCallback((t: string) => { setAviso(t); onAviso(t); setTimeout(() => setAviso(null), 3000); }, [onAviso]);

  // Importar producto desde el catálogo existente (catalogos_bot + colores con foto).
  const [catOpen, setCatOpen] = useState(false);
  const [catProds, setCatProds] = useState<{ catalogo_id: string; familia: string; colores: { nombre: string; foto_url: string }[] }[]>([]);
  const [catCargando, setCatCargando] = useState(false);
  const [catBusca, setCatBusca] = useState('');
  const abrirCatalogo = async () => {
    setCatOpen(true);
    if (catProds.length) return;
    setCatCargando(true);
    try { const j = await api('/api/live-admin/catalogo'); setCatProds(j.productos ?? []); }
    catch (e: any) { flash('No se pudo cargar el catálogo: ' + e.message); }
    setCatCargando(false);
  };
  const importar = async (c: { catalogo_id: string; familia: string; colores: { nombre: string; foto_url: string }[] }) => {
    try {
      const colores: Color[] = c.colores.map(x => ({ nombre: x.nombre, hex: '#888888', foto_url: x.foto_url }));
      const j = await api('/api/live-admin/productos', { method: 'POST', body: JSON.stringify({ nombre: c.familia, precio: 129900, tallas: TALLAS, colores }) });
      const nuevo: Producto = { id: j.id, nombre: c.familia, descripcion: '', ficha_tela: '', ficha_cuidados: '', precio: 129900, precio_antes: null, promo_etiqueta: null, promo_unidades: null, promo_precio: null, tallas: TALLAS, colores };
      setProductos(p => [...p, nuevo]);
      flash(`"${c.familia}" agregado del catálogo. Ponle precio y pulsa Guardar todo.`);
      setCatOpen(false);
    } catch (e: any) { flash('Error: ' + e.message); }
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const j = await api(`/api/live-admin/lives/${id}`);
      setLive(j.live);
      setProductos((j.productos ?? []).map((p: any) => ({ ...p, colores: p.colores ?? [], tallas: p.tallas ?? TALLAS })));
      setTimeline((j.timeline ?? []).map((e: any) => ({ tipo: e.tipo, inicio_seg: Number(e.inicio_seg), fin_seg: Number(e.fin_seg), producto_id: e.producto_id, pregunta: e.pregunta ?? '', respuesta: e.respuesta ?? '', autor: e.autor ?? 'Cliente DEMO', texto: e.texto ?? '' })));
    } catch (e: any) { setAviso('No se pudo cargar: ' + e.message); }
    setCargando(false);
    // onAviso es estable (useCallback en el padre); no lo ponemos como dependencia
    // para que el editor NO se recargue en bucle mientras editas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  const setCampo = (k: keyof LiveFull, v: any) => setLive(l => l ? { ...l, [k]: v } : l);

  const guardarLive = async () => {
    if (!live) return;
    setGuardando(true);
    try {
      await api(`/api/live-admin/lives/${id}`, { method: 'PATCH', body: JSON.stringify({
        titulo: live.titulo, slug: live.slug, estado: live.estado, video_url: live.video_url,
        whatsapp: live.whatsapp, etiqueta_grabada: live.etiqueta_grabada, duracion_seg: live.duracion_seg,
        tienda_nombre: live.tienda_nombre, tienda_logo: live.tienda_logo,
        comentarios: (live.comentarios ?? []).map(s => s.trim()).filter(Boolean),
        embudo_slug: (live.embudo_slug ?? '').trim() || null,
      }) });
      flash('Datos del live guardados ✅');
    } catch (e: any) { flash('Error: ' + e.message); }
    setGuardando(false);
  };

  const cuerpoProducto = (p: Producto) => ({
    nombre: p.nombre, descripcion: p.descripcion, ficha_tela: p.ficha_tela, ficha_cuidados: p.ficha_cuidados,
    precio: p.precio, precio_antes: p.precio_antes, promo_etiqueta: p.promo_etiqueta, promo_unidades: p.promo_unidades, promo_precio: p.promo_precio,
    tallas: p.tallas, colores: p.colores,
  });

  // UN SOLO botón: guarda los campos de CADA producto, luego los vincula al live y guarda la línea de tiempo.
  const guardarTodo = async () => {
    setGuardando(true);
    try {
      for (const p of productos) {
        await api(`/api/live-admin/productos/${p.id}`, { method: 'PATCH', body: JSON.stringify(cuerpoProducto(p)) });
      }
      await api(`/api/live-admin/lives/${id}/contenido`, { method: 'PUT', body: JSON.stringify({
        productos: productos.map((p, i) => ({ producto_id: p.id, orden: i })),
        timeline: timeline,
      }) });
      flash('Todo guardado ✅');
    } catch (e: any) { flash('Error al guardar: ' + e.message); }
    setGuardando(false);
  };

  const agregarProducto = async () => {
    try {
      const j = await api('/api/live-admin/productos', { method: 'POST', body: JSON.stringify({ nombre: 'Buzo nuevo', precio: 129900, tallas: TALLAS }) });
      const nuevo = { id: j.id, nombre: 'Buzo nuevo', descripcion: '', ficha_tela: '', ficha_cuidados: '', precio: 129900, precio_antes: null, promo_etiqueta: null, promo_unidades: null, promo_precio: null, tallas: TALLAS, colores: [] } as Producto;
      setProductos(p => [...p, nuevo]);
      flash('Producto agregado. Edítalo y pulsa “Guardar todo” abajo.');
    } catch (e: any) { flash('Error: ' + e.message); }
  };

  const guardarProducto = async (p: Producto) => {
    try {
      await api(`/api/live-admin/productos/${p.id}`, { method: 'PATCH', body: JSON.stringify(cuerpoProducto(p)) });
      flash('Producto guardado ✅');
    } catch (e: any) { flash('Error: ' + e.message); }
  };

  const quitarProducto = (pid: string) => setProductos(ps => ps.filter(p => p.id !== pid));
  const setProd = (pid: string, patch: Partial<Producto>) => setProductos(ps => ps.map(p => p.id === pid ? { ...p, ...patch } : p));

  if (cargando || !live) return <div className="flex-1 p-8 text-sm text-brand-gray-mid">Cargando editor…</div>;

  const campo = 'w-full rounded-lg border border-brand-border px-3 py-2 text-sm';

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto bg-brand-ivory p-5 md:p-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={onVolver} className="text-sm text-[#00A89D] font-semibold mb-3">← Volver a la lista</button>

        {aviso && <div className="sticky top-2 z-10 mb-3 text-sm bg-[#00A89D] text-white rounded-lg px-3 py-2 shadow">{aviso}</div>}

        {/* Datos del live */}
        <section className="bg-white border border-brand-border rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-brand-black">Datos del live</h2>
            <a href={`/live/${live.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#00A89D]">Abrir maqueta ↗</a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-brand-black">Título
              <input className={campo} value={live.titulo} onChange={e => setCampo('titulo', e.target.value)} /></label>
            <label className="text-xs font-semibold text-brand-black">Slug (dirección)
              <input className={campo} value={live.slug} onChange={e => setCampo('slug', e.target.value)} /></label>
            <label className="text-xs font-semibold text-brand-black">URL del video (Cloudflare R2)
              <input className={campo} placeholder="https://… .mp4 o .m3u8" value={live.video_url ?? ''} onChange={e => setCampo('video_url', e.target.value)} /></label>
            <label className="text-xs font-semibold text-brand-black">WhatsApp (57XXXXXXXXXX)
              <input className={campo} value={live.whatsapp ?? ''} onChange={e => setCampo('whatsapp', e.target.value.replace(/\D/g, ''))} /></label>
            <label className="text-xs font-semibold text-brand-black">Etiqueta del encabezado
              <input className={campo} value={live.etiqueta_grabada ?? ''} onChange={e => setCampo('etiqueta_grabada', e.target.value)} /></label>
            <label className="text-xs font-semibold text-brand-black">Duración del video (seg)
              <input type="number" className={campo} value={live.duracion_seg ?? 180} onChange={e => setCampo('duracion_seg', Number(e.target.value))} /></label>
            <label className="text-xs font-semibold text-brand-black">Estado
              <select className={campo} value={live.estado} onChange={e => setCampo('estado', e.target.value as EstadoLive)}>
                <option value="borrador">Borrador (solo tú)</option>
                <option value="activo">Activo (público)</option>
                <option value="archivado">Archivado</option>
              </select></label>
            <label className="text-xs font-semibold text-brand-black md:col-span-2">Checkout del embudo (slug) — opcional
              <input className={campo} placeholder="ej. motero-tk  (déjalo vacío para usar el checkout propio del live)" value={live.embudo_slug ?? ''} onChange={e => setCampo('embudo_slug', e.target.value.trim())} />
              <span className="block text-[11px] text-brand-gray-mid font-normal mt-0.5">Si pones el slug de uno de tus embudos, al comprar se abre ESE checkout tal cual (con sus variantes, precios y pedido real).</span>
            </label>
          </div>
          <button onClick={guardarLive} disabled={guardando} className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#007A72] disabled:opacity-50">Guardar datos del live</button>
        </section>

        {/* Comentarios de ambiente */}
        <section className="bg-white border border-brand-border rounded-2xl p-4 mb-4">
          <h2 className="font-bold text-brand-black mb-1">Comentarios del live (demo)</h2>
          <p className="text-xs text-brand-gray-mid mb-2">Un comentario por línea. Aparecen solos durante el video, como un chat en vivo (siempre marcados DEMO). Se guardan con el botón “Guardar datos del live”.</p>
          <textarea
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm min-h-[140px]"
            placeholder={'me encanta ese buzo 🔥\n¿lo tienen en talla XL?\n¿hacen envío a Medellín?\n¿pago contra entrega?'}
            value={(live.comentarios ?? []).join('\n')}
            onChange={e => setCampo('comentarios', e.target.value.split('\n'))}
          />
        </section>

        {/* Productos */}
        <section className="bg-white border border-brand-border rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-brand-black">Productos ({productos.length})</h2>
            <div className="flex gap-2">
              <button onClick={abrirCatalogo} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00A89D] text-white hover:bg-[#007A72]">📦 Importar de mi catálogo</button>
              <button onClick={agregarProducto} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-brand-border hover:bg-brand-gray-light">+ En blanco</button>
            </div>
          </div>
          {productos.length === 0 && <p className="text-sm text-brand-gray-mid">Sin productos. Agrega el primero.</p>}
          {productos.map((p, idx) => (
            <ProductoEditor key={p.id} p={p} indice={idx + 1} campo={campo}
              onChange={patch => setProd(p.id, patch)}
              onGuardar={() => guardarProducto(p)}
              onQuitar={() => quitarProducto(p.id)}
              onAviso={flash} />
          ))}
        </section>

        {/* Línea de tiempo */}
        <section className="bg-white border border-brand-border rounded-2xl p-4 mb-4">
          <h2 className="font-bold text-brand-black mb-1">Línea de tiempo</h2>
          <p className="text-xs text-brand-gray-mid mb-3">En qué segundo del video aparece cada producto, pregunta o comentario de ejemplo.</p>
          <TimelineEditor timeline={timeline} setTimeline={setTimeline} productos={productos} campo={campo} />
        </section>

        <ModeracionChat liveId={id} />

        <button onClick={guardarTodo} disabled={guardando} className="mb-10 px-6 py-3 rounded-lg text-sm font-bold bg-[#00A89D] text-white hover:bg-[#007A72] disabled:opacity-50">
          {guardando ? 'Guardando…' : '💾 Guardar todo (datos, productos y línea de tiempo)'}
        </button>
      </div>

      {/* Ventana: importar producto del catálogo */}
      {catOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCatOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-brand-border flex items-center justify-between">
              <h3 className="font-bold text-brand-black">Importar de mi catálogo</h3>
              <button onClick={() => setCatOpen(false)} className="w-8 h-8 rounded-full hover:bg-brand-gray-light text-lg">×</button>
            </div>
            <div className="p-3 border-b border-brand-border">
              <input className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm" placeholder="Buscar producto…" value={catBusca} onChange={e => setCatBusca(e.target.value)} />
            </div>
            <div className="overflow-y-auto p-3">
              {catCargando ? <p className="text-sm text-brand-gray-mid">Cargando catálogo…</p> : (
                catProds.filter(c => c.familia.toLowerCase().includes(catBusca.toLowerCase())).map(c => (
                  <div key={c.catalogo_id} className="flex items-center gap-3 p-2 border border-brand-border rounded-xl mb-2">
                    {c.colores[0]?.foto_url
                      ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.colores[0].foto_url} alt="" className="w-12 h-12 rounded object-cover bg-neutral-100 shrink-0" />
                      : <span className="w-12 h-12 rounded bg-neutral-100 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-brand-black truncate">{c.familia}</p>
                      <p className="text-xs text-brand-gray-mid">{c.colores.length} color{c.colores.length === 1 ? '' : 'es'}</p>
                    </div>
                    <button onClick={() => importar(c)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00A89D] text-white hover:bg-[#007A72] shrink-0">Agregar</button>
                  </div>
                ))
              )}
              {!catCargando && catProds.length === 0 && <p className="text-sm text-brand-gray-mid">No hay productos en el catálogo.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── editor de un producto ─────────────────────────
function ProductoEditor({ p, indice, campo, onChange, onGuardar, onQuitar, onAviso }: {
  p: Producto; indice: number; campo: string;
  onChange: (patch: Partial<Producto>) => void; onGuardar: () => void; onQuitar: () => void; onAviso: (t: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState<number | null>(null);

  const subirFoto = async (i: number, file: File) => {
    setSubiendo(i);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/catalogos/upload-imagen', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j?.error || 'subida falló');
      const cols = [...p.colores]; cols[i] = { ...cols[i], foto_url: j.url }; onChange({ colores: cols });
    } catch (e: any) { onAviso('Foto: ' + e.message); }
    setSubiendo(null);
  };
  const setColor = (i: number, patch: Partial<Color>) => { const c = [...p.colores]; c[i] = { ...c[i], ...patch }; onChange({ colores: c }); };
  const addColor = () => onChange({ colores: [...p.colores, { nombre: 'Color', hex: '#888888', foto_url: '' }] });
  const delColor = (i: number) => onChange({ colores: p.colores.filter((_, j) => j !== i) });
  const toggleTalla = (t: string) => onChange({ tallas: p.tallas.includes(t) ? p.tallas.filter(x => x !== t) : [...p.tallas, t] });

  return (
    <div className="border border-brand-border rounded-xl p-3 mb-2">
      <div className="flex items-center gap-2 justify-between">
        <button onClick={() => setAbierto(a => !a)} className="flex items-center gap-2 min-w-0 text-left">
          <span className="text-[10px] font-bold bg-[#ff3366] text-white rounded px-1.5 py-0.5">{String(indice).padStart(2, '0')}</span>
          <span className="font-semibold text-brand-black truncate">{p.nombre || 'Sin nombre'}</span>
          <span className="text-xs text-brand-gray-mid">{peso(p.precio)}</span>
          <span className="text-xs text-[#00A89D]">{abierto ? '▲' : '▼'}</span>
        </button>
        <button onClick={onQuitar} className="text-xs text-red-600 shrink-0">Quitar</button>
      </div>

      {abierto && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="text-xs font-semibold">Nombre<input className={campo} value={p.nombre} onChange={e => onChange({ nombre: e.target.value })} /></label>
            <label className="text-xs font-semibold">Descripción<input className={campo} value={p.descripcion ?? ''} onChange={e => onChange({ descripcion: e.target.value })} /></label>
            <label className="text-xs font-semibold">Precio<input inputMode="numeric" className={campo} value={verNum(p.precio)} onChange={e => onChange({ precio: soloNum(e.target.value) })} /></label>
            <label className="text-xs font-semibold">Precio antes (opcional)<input inputMode="numeric" className={campo} value={verNum(p.precio_antes)} onChange={e => onChange({ precio_antes: soloNum(e.target.value) || null })} /></label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="text-xs font-semibold">Promo etiqueta<input className={campo} placeholder="Pack x2" value={p.promo_etiqueta ?? ''} onChange={e => onChange({ promo_etiqueta: e.target.value || null })} /></label>
            <label className="text-xs font-semibold">Unidades pack<input inputMode="numeric" className={campo} value={p.promo_unidades ?? ''} onChange={e => onChange({ promo_unidades: soloNum(e.target.value) || null })} /></label>
            <label className="text-xs font-semibold">Precio pack<input inputMode="numeric" className={campo} value={verNum(p.promo_precio)} onChange={e => onChange({ promo_precio: soloNum(e.target.value) || null })} /></label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="text-xs font-semibold">Ficha · tela<input className={campo} value={p.ficha_tela ?? ''} onChange={e => onChange({ ficha_tela: e.target.value })} /></label>
            <label className="text-xs font-semibold">Ficha · cuidados<input className={campo} value={p.ficha_cuidados ?? ''} onChange={e => onChange({ ficha_cuidados: e.target.value })} /></label>
          </div>
          <div>
            <p className="text-xs font-semibold mb-1">Tallas</p>
            <div className="flex gap-2">{TALLAS.map(t => (
              <button key={t} onClick={() => toggleTalla(t)} className={`h-8 w-10 rounded-lg border-2 text-sm font-bold ${p.tallas.includes(t) ? 'border-[#00A89D] bg-[#00A89D] text-white' : 'border-brand-border'}`}>{t}</button>
            ))}</div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold">Colores</p>
              <button onClick={addColor} className="text-xs text-[#00A89D] font-semibold">+ Color</button>
            </div>
            {p.colores.map((c, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                {c.foto_url
                  ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.foto_url} alt="" className="w-10 h-10 rounded object-cover bg-neutral-100 shrink-0" />
                  : <span className="w-10 h-10 rounded bg-neutral-100 shrink-0" />}
                <input className="flex-1 min-w-0 rounded-lg border border-brand-border px-2 py-1 text-sm" placeholder="Nombre del color" value={c.nombre} onChange={e => setColor(i, { nombre: e.target.value })} />
                <input type="color" className="w-8 h-8 rounded border border-brand-border shrink-0" value={c.hex || '#888888'} onChange={e => setColor(i, { hex: e.target.value })} />
                <label className="text-xs font-semibold text-[#00A89D] cursor-pointer shrink-0">
                  {subiendo === i ? '…' : 'Foto'}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(i, f); }} />
                </label>
                <button onClick={() => delColor(i)} className="text-xs text-red-600 shrink-0">✕</button>
              </div>
            ))}
          </div>
          <button onClick={onGuardar} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00A89D] text-white hover:bg-[#007A72]">Guardar producto</button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── editor de la línea de tiempo ─────────────────────────
function TimelineEditor({ timeline, setTimeline, productos, campo }: {
  timeline: EventoTL[]; setTimeline: (t: EventoTL[]) => void; productos: Producto[]; campo: string;
}) {
  const set = (i: number, patch: Partial<EventoTL>) => setTimeline(timeline.map((e, j) => j === i ? { ...e, ...patch } : e));
  const add = (tipo: EventoTL['tipo']) => setTimeline([...timeline, {
    tipo, inicio_seg: 0, fin_seg: tipo === 'comentario' ? 10 : 60,
    producto_id: productos[0]?.id ?? null, pregunta: '', respuesta: '', autor: tipo === 'comentario' ? '' : 'Cliente', texto: '',
  }]);
  const del = (i: number) => setTimeline(timeline.filter((_, j) => j !== i));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => add('producto')} className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-brand-border hover:bg-brand-gray-light">+ Producto</button>
        <button onClick={() => add('pregunta_frecuente')} className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-brand-border hover:bg-brand-gray-light">+ Pregunta frecuente</button>
        <button onClick={() => add('comentario')} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#ff3366] text-white hover:opacity-90">+ Pregunta tipo comentario</button>
      </div>
      {[...timeline].map((e, i) => (
        <div key={i} className="border border-brand-border rounded-xl p-2 mb-2">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${e.tipo === 'comentario' ? 'bg-pink-100 text-pink-700' : 'bg-neutral-100 text-neutral-600'}`}>{e.tipo === 'pregunta_frecuente' ? 'Pregunta frecuente' : e.tipo === 'comentario' ? 'Pregunta / comentario' : 'Producto'}</span>
            <label className="text-xs">Del seg <input type="number" className="w-16 rounded border border-brand-border px-1.5 py-0.5 text-sm" value={e.inicio_seg} onChange={ev => set(i, { inicio_seg: Number(ev.target.value) })} /></label>
            <label className="text-xs">al <input type="number" className="w-16 rounded border border-brand-border px-1.5 py-0.5 text-sm" value={e.fin_seg} onChange={ev => set(i, { fin_seg: Number(ev.target.value) })} /></label>
            <button onClick={() => del(i)} className="ml-auto text-xs text-red-600">✕</button>
          </div>
          {e.tipo === 'producto' && (
            <select className={campo} value={e.producto_id ?? ''} onChange={ev => set(i, { producto_id: ev.target.value })}>
              <option value="">— elige producto —</option>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          )}
          {e.tipo === 'pregunta_frecuente' && (
            <div className="space-y-1">
              <input className={campo} placeholder="Pregunta" value={e.pregunta ?? ''} onChange={ev => set(i, { pregunta: ev.target.value })} />
              <input className={campo} placeholder="Respuesta" value={e.respuesta ?? ''} onChange={ev => set(i, { respuesta: ev.target.value })} />
            </div>
          )}
          {e.tipo === 'comentario' && (
            <div>
              <div className="flex gap-2">
                <input className="w-36 rounded-lg border border-brand-border px-2 py-1 text-sm" placeholder="Nombre (ej. Camilo)" value={e.autor ?? ''} onChange={ev => set(i, { autor: ev.target.value })} />
                <input className="flex-1 min-w-0 rounded-lg border border-brand-border px-2 py-1 text-sm" placeholder="Pregunta (ej. ¿Lo tienen en talla XL?)" maxLength={140} value={e.texto ?? ''} onChange={ev => set(i, { texto: ev.target.value })} />
              </div>
              <p className="text-[11px] text-brand-gray-mid mt-1">Aparece en el chat en el segundo “Del” y se queda. Respóndela en el video en ese momento.</p>
            </div>
          )}
        </div>
      ))}
      {timeline.length === 0 && <p className="text-sm text-brand-gray-mid">Sin eventos todavía.</p>}
    </div>
  );
}

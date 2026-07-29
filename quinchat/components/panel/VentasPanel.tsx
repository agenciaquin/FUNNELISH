'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

type EstadoEffi = 'subida' | 'anulada' | 'sin_subir';
const tel10 = (t: any) => String(t ?? '').replace(/\D/g, '').slice(-10);

interface Venta {
  id: string;
  nombre: string;
  telefono: string;
  producto: string;
  talla: string;
  valor: string;
  valorNum: number;
  direccion: string;
  ciudad: string;
  departamento: string;
  correo: string;
  fecha: string | null;
  foto: string | null;
  conversationId: string;
  abono: number;
  abonoRecibido: boolean;
  cobrar: string | null;
  contactado: boolean;
}
interface Resumen { total: number; ingresos: number; }

const pesos = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Math.round(n).toLocaleString('es-CO');

// Colores por estado en Effi: verde=en Effi, naranja=sin subir, amarillo=anulada
const ESTILO_EFFI: Record<EstadoEffi, { texto: string; color: string; borde: string; fondo: string }> = {
  subida:    { texto: '🟢 En Effi',   color: '#15803D', borde: '#86EFAC', fondo: 'rgba(21,128,61,0.06)' },
  sin_subir: { texto: '🟠 Sin subir', color: '#C2410C', borde: '#FDBA74', fondo: 'rgba(234,88,12,0.06)' },
  anulada:   { texto: '🟡 Anulada',   color: '#B45309', borde: '#FDE68A', fondo: 'rgba(202,138,4,0.10)' },
};

function fechaLegible(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function VentasPanel({ onAbrirChat, soloOrigen }: { onAbrirChat?: (id: string) => void; soloOrigen?: 'funnel' | 'whatsapp' } = {}) {
  const hoy    = new Date().toISOString().slice(0, 10);
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [desde, setDesde] = useState(hace30);
  const [hasta, setHasta] = useState(hoy);
  // Si el panel se usa forzado a un origen (ej. Ventas=funnel, META ADS=whatsapp),
  // se fija ese origen y se oculta el selector de pestañas.
  const [origen, setOrigen]     = useState<'todos' | 'funnel' | 'whatsapp'>(soloOrigen ?? 'todos');
  const [ventas, setVentas]     = useState<Venta[]>([]);
  const [resumen, setResumen]   = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(false);
  const [foto, setFoto]         = useState<string | null>(null); // lightbox
  const [busca, setBusca]       = useState('');

  // ── Cruce con Effi ──────────────────────────────────────────────────────────
  const [effi, setEffi]           = useState<Map<string, EstadoEffi>>(new Map());
  const [motivos, setMotivos]     = useState<Map<string, string>>(new Map()); // motivo de anulación por teléfono
  const [filtroEffi, setFiltroEffi] = useState<'todos' | EstadoEffi>('todos');
  const [avisoExcel, setAvisoExcel] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res  = await fetch(`/api/ventas/lista?desde=${desde}&hasta=${hasta}&origen=${origen === 'todos' ? '' : origen}`, { cache: 'no-store' });
      const data = await res.json();
      setVentas(data.ventas ?? []);
      setResumen(data.resumen ?? null);
    } finally { setCargando(false); }
  }, [desde, hasta, origen]);

  // ── Papelera (borrado suave, 30 días) ──────────────────────────────────────
  const [papelera, setPapelera]         = useState<Venta[]>([]);
  const [papeleraOpen, setPapeleraOpen] = useState(false);
  const cargarPapelera = useCallback(async () => {
    try {
      const res  = await fetch(`/api/ventas/lista?papelera=1&origen=${origen === 'todos' ? '' : origen}`, { cache: 'no-store' });
      const data = await res.json();
      setPapelera(data.ventas ?? []);
    } catch { /* ignorar */ }
  }, [origen]);
  useEffect(() => { cargarPapelera(); }, [cargarPapelera]);

  // ── Marca "mensaje enviado al cliente" ─────────────────────────────────────
  // Actualiza al instante en pantalla y guarda en la base (no se pierde ni se
  // resetea entre dispositivos).
  async function marcarContacto(id: string, marcado: boolean) {
    setVentas(prev => prev.map(v => v.id === id ? { ...v, contactado: marcado } : v));
    try {
      await fetch('/api/ventas/contacto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, marcado }),
      });
    } catch { /* si falla, se revierte al recargar */ }
  }

  async function moverPapelera(id: string, accion: 'enviar' | 'restaurar') {
    try {
      await fetch('/api/ventas/papelera', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, accion }),
      });
      await Promise.all([cargar(), cargarPapelera()]);
    } catch { /* ignorar */ }
  }

  // Trae las guías de Effi ya guardadas (persisten entre sesiones)
  const cargarEffi = useCallback(async () => {
    try {
      const res  = await fetch('/api/seguimiento/effi', { cache: 'no-store' });
      const data = await res.json();
      const m  = new Map<string, EstadoEffi>();
      const mm = new Map<string, string>();
      for (const g of data.guias ?? []) {
        const t = tel10(g.telefono);
        if (t.length === 10) {
          m.set(t, g.estado === 'anulada' ? 'anulada' : 'subida');
          if (g.motivo) mm.set(t, String(g.motivo));
        }
      }
      setEffi(m);
      setMotivos(mm);
    } catch { /* sin datos de Effi */ }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarEffi(); }, [cargarEffi]);

  const effiDe = (v: Venta): EstadoEffi => effi.get(tel10(v.telefono)) ?? 'sin_subir';
  const motivoDe = (v: Venta): string => motivos.get(tel10(v.telefono)) ?? '';

  // Lee el Excel de Effi (el "xls" real es una tabla HTML) y guarda el cruce.
  async function subirExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvisoExcel(null);
    try {
      const buffer = await file.arrayBuffer();
      const bytes  = new Uint8Array(buffer);
      const inicio = new TextDecoder('latin1').decode(bytes.slice(0, 200)).toLowerCase();
      const esHtml = inicio.includes('<table') || inicio.includes('<html') || inicio.trim().startsWith('<');
      const wb = esHtml
        ? XLSX.read(new TextDecoder('latin1').decode(bytes), { type: 'string' })
        : XLSX.read(buffer, { type: 'array' });
      const hoja  = wb.Sheets[wb.SheetNames[0]];
      const filas: Record<string, any>[] = XLSX.utils.sheet_to_json(hoja, { defval: '' });
      if (!filas.length) { setAvisoExcel('❌ El archivo no tiene filas.'); return; }

      const claves = Object.keys(filas[0]);
      const buscar = (cond: (k: string) => boolean) => claves.find(cond);
      const colTel     = buscar(k => k.toLowerCase().includes('tel'))
                      ?? buscar(k => /celular|whatsapp|m[oó]vil/.test(k.toLowerCase()));
      const colEstadoR = buscar(k => k.toLowerCase().includes('estado remis'));
      const colFechaAn = buscar(k => k.toLowerCase().includes('anulaci') && k.toLowerCase().includes('fecha'))
                      ?? buscar(k => k.toLowerCase().includes('anulaci'));
      // Columna con el MOTIVO de la anulación ("Observación de anulación")
      const colObs     = buscar(k => k.toLowerCase().includes('observaci') && k.toLowerCase().includes('anul'))
                      ?? buscar(k => k.toLowerCase().includes('observaci'))
                      ?? buscar(k => k.toLowerCase().includes('motivo'));
      if (!colTel) { setAvisoExcel('❌ No encontré la columna de Teléfono en el reporte.'); return; }

      const mapa = new Map<string, EstadoEffi>();
      const motivoMapa = new Map<string, string>();
      for (const f of filas) {
        const t = tel10(f[colTel]);
        if (t.length !== 10) continue;
        const estadoR = colEstadoR ? String(f[colEstadoR] ?? '').toLowerCase() : '';
        const fechaAn = colFechaAn ? String(f[colFechaAn] ?? '').trim() : '';
        const anulada = estadoR.includes('anul') || fechaAn.length > 0;
        const previo = mapa.get(t);
        if (anulada) {
          if (previo !== 'subida') mapa.set(t, 'anulada');
          const obs = colObs ? String(f[colObs] ?? '').trim() : '';
          if (obs) motivoMapa.set(t, obs);
        } else mapa.set(t, 'subida');
      }

      const combinado = new Map(effi);
      for (const [t, es] of mapa) combinado.set(t, es);
      setEffi(combinado);
      const combinadoMot = new Map(motivos);
      for (const [t, mo] of motivoMapa) combinadoMot.set(t, mo);
      setMotivos(combinadoMot);
      setNombreArchivo(file.name);

      try {
        const res = await fetch('/api/seguimiento/effi', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guias: [...mapa].map(([telefono, estado]) => ({ telefono, estado, motivo: motivoMapa.get(telefono) ?? '' })) }),
        });
        const j = await res.json().catch(() => ({}));
        setAvisoExcel(res.ok
          ? `✅ ${mapa.size} guías leídas y guardadas. Quedan guardadas aunque salgas.`
          : `⚠️ ${mapa.size} leídas, pero no se guardaron: ${j?.error ?? 'error'}`);
        // Recargar desde el servidor para confirmar que quedó persistido
        if (res.ok) cargarEffi();
      } catch { setAvisoExcel(`⚠️ ${mapa.size} leídas, pero falló el guardado.`); }
    } catch (err: any) {
      setAvisoExcel(`❌ No pude leer el archivo: ${err?.message ?? 'error'}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const contEffi = {
    subida:    ventas.filter(v => effiDe(v) === 'subida').length,
    sin_subir: ventas.filter(v => effiDe(v) === 'sin_subir').length,
    anulada:   ventas.filter(v => effiDe(v) === 'anulada').length,
  };

  const filtradas = ventas.filter(v => {
    if (filtroEffi !== 'todos' && effiDe(v) !== filtroEffi) return false;
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return [v.nombre, v.telefono, v.producto, v.ciudad].some(x => String(x).toLowerCase().includes(t));
  });

  return (
    <div className={soloOrigen ? '' : 'panel-scroll flex-1 h-full overflow-y-auto bg-[#F8F8F8]'}>
      <div className={soloOrigen ? '' : 'max-w-5xl mx-auto px-4 md:px-8 py-6'}>
        {/* Encabezado propio solo cuando NO está embebido (en META ADS ya hay título) */}
        {!soloOrigen && (
          <>
            <h1 className="text-2xl font-extrabold text-[#0D0D0D]">🔵 Estado en Effi</h1>
            <p className="text-sm text-[#6B6B6B] mb-4">
              Todas las ventas realizadas (Funnel + WhatsApp) cruzadas con Effi. El objetivo:
              que ninguna venta quede <b>sin subir</b>.
            </p>
          </>
        )}

        {/* Selector de origen: Funnel vs Ventas WhatsApp (oculto si viene forzado) */}
        {!soloOrigen && (
        <div className="inline-flex bg-[#EFEFEF] rounded-xl p-1 mb-5">
          <button
            onClick={() => setOrigen('todos')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${origen === 'todos' ? 'bg-white shadow text-[#0D0D0D]' : 'text-[#6B6B6B]'}`}
          >🔵 Ambos chats</button>
          <button
            onClick={() => setOrigen('funnel')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${origen === 'funnel' ? 'bg-white shadow text-[#2563EB]' : 'text-[#6B6B6B]'}`}
          >📊 Funnel</button>
          <button
            onClick={() => setOrigen('whatsapp')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${origen === 'whatsapp' ? 'bg-white shadow text-[#25D366]' : 'text-[#6B6B6B]'}`}
          >💬 WhatsApp</button>
        </div>
        )}

        {/* Filtros */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-[#6B6B6B]">Desde</span>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white" />
          <span className="text-xs text-[#6B6B6B]">a</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white" />
          <button onClick={cargar} className="w-8 h-8 rounded-lg text-[#00A89D] hover:bg-[#00A89D]/10">⟳</button>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar nombre, teléfono, producto…"
            className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white"
          />
        </div>

        {/* Resumen */}
        {resumen && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-4">
              <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">Ventas confirmadas</p>
              <p className="text-2xl font-extrabold text-[#15803D]">{resumen.total}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-4">
              <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">Ingresos</p>
              <p className="text-2xl font-extrabold text-[#0D0D0D]">{pesos(resumen.ingresos)}</p>
            </div>
          </div>
        )}

        {/* Aviso: ventas sin subir a Effi (el objetivo es dejarlo en 0) */}
        {!soloOrigen && contEffi.sin_subir > 0 && (
          <button
            onClick={() => setFiltroEffi('sin_subir')}
            className="w-full mb-4 flex items-center gap-3 rounded-xl border-2 border-[#FDBA74] bg-[#FFF7ED] px-4 py-3 text-left hover:bg-[#FFEEDD] transition-colors"
          >
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-sm font-bold text-[#C2410C]">
                Tienes {contEffi.sin_subir} venta{contEffi.sin_subir === 1 ? '' : 's'} sin subir a Effi
              </p>
              <p className="text-[11px] text-[#9A5B2E]">
                Tócalo para ver solo las pendientes y súbelas — que no se te quede ninguna. 🚚
              </p>
            </div>
          </button>
        )}

        {/* Cruce con Effi (oculto embebido en META ADS: allí ya está la pestaña Effi) */}
        {!soloOrigen && (
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-4 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-bold text-[#0D0D0D]">📦 Cruce con Effi</p>
              <p className="text-[11px] text-[#6B6B6B]">
                Sube el reporte <b>una sola vez</b> y se cruza con todas las ventas (Funnel y WhatsApp).
                🟢 En Effi · 🟠 sin subir · 🟡 anulada.
                {nombreArchivo ? ` · Último: ${nombreArchivo}` : ''}
              </p>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#008F85]"
            >⬆️ Subir archivo de Effi</button>
            <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv,.htm,.html" className="hidden" onChange={subirExcel} />
          </div>
          {avisoExcel && <p className="text-[12px] mt-2 text-[#6B6B6B]">{avisoExcel}</p>}

          {/* Contadores con filtro */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            {([
              ['todos',     'Todas',     ventas.length,        '#0D0D0D'],
              ['subida',    'En Effi',   contEffi.subida,      '#15803D'],
              ['sin_subir', 'Sin subir', contEffi.sin_subir,   '#C2410C'],
              ['anulada',   'Anuladas',  contEffi.anulada,     '#CA8A04'],
            ] as const).map(([k, t, n, c]) => (
              <button
                key={k}
                onClick={() => setFiltroEffi(k as any)}
                className={`rounded-xl border p-2.5 text-left transition-all ${filtroEffi === k ? 'border-[#00A89D] ring-2 ring-[#00A89D]/30' : 'border-[#E8E8E8] hover:border-[#CCC]'}`}
              >
                <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">{t}</p>
                <p className="text-xl font-extrabold" style={{ color: c }}>{n}</p>
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Lista */}
        {cargando ? (
          <p className="text-sm text-[#6B6B6B] py-12 text-center">Cargando…</p>
        ) : filtradas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] py-14 text-center px-6">
            <div className="text-4xl mb-2 opacity-30">🧾</div>
            <p className="text-sm text-[#6B6B6B]">No hay ventas confirmadas en este periodo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtradas.map(v => {
              const est = ESTILO_EFFI[effiDe(v)];
              return (
              <div
                key={v.id}
                onClick={() => onAbrirChat?.(v.conversationId)}
                style={{ borderColor: est.borde, background: est.fondo }}
                className={`rounded-2xl border-2 shadow-sm overflow-hidden flex ${onAbrirChat ? 'cursor-pointer hover:shadow-md transition-all' : ''}`}
                title={onAbrirChat ? 'Abrir el chat del cliente' : undefined}
              >
                {v.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.foto} alt={v.producto}
                    onClick={e => { e.stopPropagation(); setFoto(v.foto); }}
                    className="w-28 h-full object-cover cursor-zoom-in shrink-0"
                  />
                ) : (
                  <div className="w-28 shrink-0 bg-[#F2F2F2] flex items-center justify-center text-3xl text-[#CCC]">📦</div>
                )}
                <div className="flex-1 min-w-0 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-[#0D0D0D] truncate">{v.nombre}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ color: est.color, background: est.fondo, border: `1px solid ${est.borde}` }}
                      >{est.texto}</span>
                      <button
                        onClick={e => { e.stopPropagation(); if (confirm('¿Enviar esta venta a la papelera? Quedará 30 días y puedes restaurarla.')) moverPapelera(v.id, 'enviar'); }}
                        title="Enviar a papelera"
                        className="w-6 h-6 rounded-lg text-[#B0B0B0] hover:text-[#DC2626] hover:bg-[#FEE2E2] text-xs"
                      >🗑</button>
                    </div>
                  </div>
                  <p className="text-[12px] text-[#00847A] font-semibold truncate">{v.producto}</p>
                  {/* Motivo de anulación de Effi (letrero rojo) */}
                  {effiDe(v) === 'anulada' && motivoDe(v) && (
                    <p className="text-[11px] font-bold text-[#B91C1C] bg-[#FEE2E2] border border-[#FCA5A5] rounded-md px-2 py-1 my-1">
                      🚫 Anulada: {motivoDe(v)}
                    </p>
                  )}
                  <p className="text-[11px] text-[#6B6B6B] mt-1">
                    Talla: <b>{v.talla}</b> · {v.valor}{v.cobrar ? ` · Cobrar: ${v.cobrar}` : ''}
                  </p>
                  <p className="text-[11px] text-[#6B6B6B] truncate">📍 {v.direccion}, {v.ciudad} ({v.departamento})</p>
                  <p className="text-[11px] text-[#6B6B6B] truncate">✉️ {v.correo}</p>
                  <div className="flex items-center justify-between mt-1.5 gap-2">
                    <span className="text-[11px] text-[#9A9A9A]">📞 {v.telefono}</span>
                    <span className="text-[10px] text-[#B0B0B0]">{fechaLegible(v.fecha)}</span>
                  </div>
                  {onAbrirChat && (
                    <button
                      onClick={e => { e.stopPropagation(); if (!v.contactado) marcarContacto(v.id, true); onAbrirChat(v.conversationId); }}
                      className="mt-2 w-full py-1.5 rounded-lg bg-[#00A89D] text-white text-[12px] font-semibold hover:bg-[#008F85] transition-colors"
                    >💬 Ir al chat</button>
                  )}
                  {/* Aviso: ¿ya se le escribió al cliente? — clic para cambiar */}
                  <button
                    onClick={e => { e.stopPropagation(); marcarContacto(v.id, !v.contactado); }}
                    title={v.contactado ? 'Marcar como NO escrito' : 'Marcar como mensaje enviado'}
                    className={`mt-1.5 w-full py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                      v.contactado
                        ? 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC] hover:bg-[#bbf7d0]'
                        : 'bg-[#F3F4F6] text-[#9A9A9A] border-[#E5E7EB] hover:bg-[#E9EAED]'
                    }`}
                  >{v.contactado ? '✅ Mensaje enviado al cliente' : '☐ Sin escribir — marcar enviado'}</button>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* ─────────── PAPELERA (30 días) ─────────── */}
        <div className="mt-4 bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-hidden">
          <button
            onClick={() => setPapeleraOpen(o => !o)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-[#0D0D0D] hover:bg-[#FAFAFA]"
          >
            🗑 Papelera
            {papelera.length > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626]">{papelera.length}</span>}
            <span className="text-[10px] text-[#9A9A9A] font-normal">· se guardan 30 días</span>
            <span className="ml-auto text-[10px] text-[#9A9A9A]">{papeleraOpen ? '▲' : '▼'}</span>
          </button>
          {papeleraOpen && (
            papelera.length === 0 ? (
              <p className="text-xs text-[#9A9A9A] text-center py-6">La papelera está vacía.</p>
            ) : (
              <div className="divide-y divide-[#F4F4F4] border-t border-[#F0F0F0]">
                {papelera.map(v => (
                  <div key={v.id} className="flex items-center gap-3 px-4 py-2.5 opacity-80">
                    <span className="w-9 h-9 shrink-0 rounded-lg overflow-hidden bg-[#F2F2F2] flex items-center justify-center">
                      {v.foto
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={v.foto} alt="" className="w-full h-full object-cover" loading="lazy" />
                        : <span className="text-xs text-[#C9C9C9]">📦</span>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate line-through text-[#6B6B6B]">{v.nombre}</p>
                      <p className="text-[11px] text-[#9A9A9A] truncate">{v.telefono} · {v.producto}</p>
                    </div>
                    <button
                      onClick={() => moverPapelera(v.id, 'restaurar')}
                      className="text-[11px] font-semibold text-[#00847A] hover:underline shrink-0"
                    >↩ Restaurar</button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Lightbox de la foto */}
      {foto && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6"
          onClick={() => setFoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt="" className="max-h-full max-w-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}

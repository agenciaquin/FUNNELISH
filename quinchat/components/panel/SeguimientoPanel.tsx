'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import VentasPanel from './VentasPanel';

interface Pedido {
  id: string; referencia: string; nombre: string; telefono: string;
  producto: string; talla: string; valor: string;
  confirmado: boolean; estado: string; created_at: string;
  foto?: string | null; etiqueta?: string;
}

// Estado REAL de entrega según el reporte de Effi ("Estado global guía inicial")
type EstadoEffi = 'entregada' | 'en_camino' | 'devuelta' | 'novedad' | 'anulada' | 'sin-subir';

/** Traduce el texto del Excel de Effi a un estado normalizado. */
function normalizarEstadoEffi(txt: string): EstadoEffi | null {
  const s = String(txt ?? '').toLowerCase();
  if (!s.trim()) return null;
  if (s.includes('entregad')) return 'entregada';
  if (s.includes('devoluci') || s.includes('devuelt')) return 'devuelta';
  if (s.includes('novedad')) return 'novedad';
  if (s.includes('anul')) return 'anulada';
  if (s.includes('transito') || s.includes('tránsito') || s.includes('reparto')
    || s.includes('retiro') || s.includes('oficina') || s.includes('generad')
    || s.includes('disponible')) return 'en_camino';
  return null;
}

/** Estado guardado en BD → tipo (compatibilidad con lo viejo: 'subida'). */
function estadoGuardado(e: string): EstadoEffi {
  const v = String(e ?? '');
  if (['entregada', 'en_camino', 'devuelta', 'novedad', 'anulada'].includes(v)) return v as EstadoEffi;
  if (v === 'subida') return 'en_camino';
  return 'sin-subir';
}

interface Props { onAbrirChat?: (conversationId: string) => void; }

const soloDigitos = (v: any) => String(v ?? '').replace(/\D/g, '');
const tel10 = (v: any) => soloDigitos(v).slice(-10);

function cuando(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + ' ' +
         d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

// Estado de QuinChat: primer estado que aparezca en la etiqueta, o por el pedido
function estadoQuin(p: Pedido): string {
  const l = (p.etiqueta ?? '').toUpperCase();
  const estados = ['VENTA REALIZADA', 'PEDIDO CANCELADO', 'PEDIDO PROGRAMADO', 'ANULADO EN EFFI', 'ABONO POR VERIFICAR', 'PENDIENTE POR CONFIRMACIÓN'];
  for (const e of estados) if (l.includes(e)) return e;
  if (p.confirmado) return 'VENTA REALIZADA';
  if (String(p.estado).toLowerCase() === 'cancelado') return 'PEDIDO CANCELADO';
  return 'PENDIENTE';
}

interface Campana {
  anuncioId: string; producto: string; mensajes: number; ventas: number; conversion: number;
  estado: string | null; activa: boolean | null;
  gasto: number | null; impresiones: number | null; alcance: number | null; clics: number | null;
  cpm: number | null; cpc: number | null; ctr: number | null; nombreAnuncio: string | null;
  frecuencia: number | null; mensajesMeta: number | null; thruplays: number | null;
  costoPorMensajeMeta: number | null;
  costoPorMensaje: number | null; costoPorVenta: number | null;
  entregadas?: number; devueltas?: number; enCamino?: number; flete?: number;
  tasaEntrega?: number | null; costoPorEntregada?: number | null;
}
interface ResumenCamp { gasto: number; ventas: number; mensajes: number; costoPorVenta: number; costoPorMensaje: number; moneda: string; }

/** 134900 → "$134.900" (formato colombiano). */
const pesos = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Math.round(n).toLocaleString('es-CO');

export default function SeguimientoPanel({ onAbrirChat }: Props) {
  const [tab, setTab] = useState<'campanas' | 'ventas_wa' | 'effi'>('campanas');
  // Costo objetivo por venta (para las recomendaciones apagar/escalar). Se guarda.
  const [costoObjetivo, setCostoObjetivo] = useState(45000);
  useEffect(() => {
    const g = Number(localStorage.getItem('metaAds_costoObjetivo'));
    if (g > 0) setCostoObjetivo(g);
  }, []);
  const guardarObjetivo = (n: number) => { setCostoObjetivo(n); try { localStorage.setItem('metaAds_costoObjetivo', String(n)); } catch { /* */ } };
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [dias, setDias]       = useState(30);
  const [cargando, setCargando] = useState(true);
  const [busca, setBusca]     = useState('');
  const [filtroEffi, setFiltroEffi] = useState<'todos' | EstadoEffi>('todos');
  // Por defecto solo VENTAS reales (los pendientes no son ventas ni van a Effi)
  const [soloVentas, setSoloVentas] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cruce con Effi: teléfono → 'anulada' | 'subida'
  const [effi, setEffi] = useState<Map<string, EstadoEffi>>(new Map());
  const [avisoExcel, setAvisoExcel] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res  = await fetch(`/api/seguimiento/lista?dias=${dias}`, { cache: 'no-store' });
      const data = await res.json();
      setPedidos(data.pedidos ?? []);
    } finally { setCargando(false); }
  }, [dias]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Papelera (borrado suave, 30 días) ──────────────────────────────────────
  const [papelera, setPapelera]         = useState<Pedido[]>([]);
  const [papeleraOpen, setPapeleraOpen] = useState(false);
  const cargarPapelera = useCallback(async () => {
    try {
      const res  = await fetch('/api/seguimiento/lista?papelera=1', { cache: 'no-store' });
      const data = await res.json();
      setPapelera(data.pedidos ?? []);
    } catch { /* ignorar */ }
  }, []);
  useEffect(() => { cargarPapelera(); }, [cargarPapelera]);

  async function moverPapelera(id: string, accion: 'enviar' | 'restaurar') {
    try {
      await fetch('/api/ventas/papelera', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, accion }),
      });
      await Promise.all([cargar(), cargarPapelera()]);
    } catch { /* ignorar */ }
  }

  // Al abrir, se recupera el cruce de Effi que ya se había subido antes
  const cargarEffi = useCallback(async () => {
    try {
      const res  = await fetch('/api/seguimiento/effi', { cache: 'no-store' });
      const data = await res.json();
      const m = new Map<string, EstadoEffi>();
      for (const g of (data.guias ?? [])) {
        const t = tel10(g.telefono);
        if (t.length === 10) m.set(t, estadoGuardado(g.estado));
      }
      if (m.size) { setEffi(m); setAvisoExcel(`✅ ${m.size} guías de Effi guardadas.`); }
    } catch { /* si no hay nada guardado, no pasa nada */ }
  }, []);

  useEffect(() => { cargarEffi(); }, [cargarEffi]);

  // ── Campañas de WhatsApp ──────────────────────────────────────────────────
  const hoy = new Date().toISOString().slice(0, 10);
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [desde, setDesde] = useState(hace30);
  const [hasta, setHasta] = useState(hoy);
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [resumenCamp, setResumenCamp] = useState<ResumenCamp | null>(null);
  const [gastoMetaError, setGastoMetaError] = useState<string | null>(null);
  const [cargandoCamp, setCargandoCamp] = useState(false);

  // ── Orden de la tabla de campañas (clic en la columna) ──────────────────────
  type CampoOrden = 'mensajes' | 'ventas' | 'gasto' | 'costoVenta' | 'conversion';
  const [orden, setOrden] = useState<{ campo: CampoOrden; dir: 'asc' | 'desc' }>({ campo: 'ventas', dir: 'desc' });
  const ordenarPor = (campo: CampoOrden) =>
    setOrden(o => (o.campo === campo ? { campo, dir: o.dir === 'desc' ? 'asc' : 'desc' } : { campo, dir: 'desc' }));
  const flecha = (campo: CampoOrden) => (orden.campo === campo ? (orden.dir === 'desc' ? ' ▼' : ' ▲') : '');
  const valorDe = (c: Campana, campo: CampoOrden): number => {
    if (campo === 'gasto')      return c.gasto ?? -1;
    if (campo === 'costoVenta') return c.costoPorVenta ?? -1;
    return Number((c as any)[campo] ?? -1);
  };
  const campanasOrdenadas = [...campanas].sort((a, b) => {
    const va = valorDe(a, orden.campo), vb = valorDe(b, orden.campo);
    return orden.dir === 'desc' ? vb - va : va - vb;
  });

  const cargarCampanas = useCallback(async () => {
    setCargandoCamp(true);
    try {
      const res  = await fetch(`/api/seguimiento/campanas?desde=${desde}&hasta=${hasta}`, { cache: 'no-store' });
      const data = await res.json();
      setCampanas(data.campanas ?? []);
      setResumenCamp(data.resumen ?? null);
      setGastoMetaError(data.gastoMeta && !data.gastoMeta.ok ? (data.gastoMeta.error ?? 'no disponible') : null);
    } finally { setCargandoCamp(false); }
  }, [desde, hasta]);

  useEffect(() => { if (tab === 'campanas') cargarCampanas(); }, [tab, cargarCampanas]);

  // Lee el Excel de Effi: detecta teléfono y estado (anulada) por nombre de columna
  async function subirExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvisoExcel(null);
    try {
      const buffer = await file.arrayBuffer();

      // El "xls" de Effi en realidad es una tabla HTML. Si es HTML, se lee como
      // texto (latin-1, para no dañar tildes); si no, como Excel normal.
      const bytes = new Uint8Array(buffer);
      const inicio = new TextDecoder('latin1').decode(bytes.slice(0, 200)).toLowerCase();
      const esHtml = inicio.includes('<table') || inicio.includes('<html') || inicio.trim().startsWith('<');

      const wb = esHtml
        ? XLSX.read(new TextDecoder('latin1').decode(bytes), { type: 'string' })
        : XLSX.read(buffer, { type: 'array' });
      const hoja = wb.Sheets[wb.SheetNames[0]];
      const filas: Record<string, any>[] = XLSX.utils.sheet_to_json(hoja, { defval: '' });
      if (!filas.length) { setAvisoExcel('❌ El archivo no tiene filas.'); return; }

      // Columnas del reporte de Effi (por nombre, no por posición)
      const claves = Object.keys(filas[0]);
      const buscar = (cond: (k: string) => boolean) => claves.find(cond);
      const colTel     = buscar(k => k.toLowerCase().includes('tel'))
                      ?? buscar(k => /celular|whatsapp|m[oó]vil/.test(k.toLowerCase()));
      const colEstadoR = buscar(k => k.toLowerCase().includes('estado remis'));
      const colFechaAn = buscar(k => k.toLowerCase().includes('anulaci') && k.toLowerCase().includes('fecha'))
                      ?? buscar(k => k.toLowerCase().includes('anulaci'));
      // Estado REAL de entrega y flete (columnas del reporte de remisiones)
      const colEstadoGlobal = buscar(k => k.toLowerCase().includes('estado global'))
                      ?? buscar(k => k.toLowerCase().includes('estado transportadora'));
      const colFlete = buscar(k => k.toLowerCase().includes('flete'));

      if (!colTel) {
        setAvisoExcel('❌ No encontré la columna de Teléfono en el reporte.');
        return;
      }

      const prioridad: EstadoEffi[] = ['sin-subir', 'novedad', 'en_camino', 'anulada', 'devuelta', 'entregada'];
      const mapa = new Map<string, EstadoEffi>();
      const fletes = new Map<string, number>();
      for (const f of filas) {
        const t = tel10(f[colTel]);
        if (t.length !== 10) continue;
        // Estado real de la guía; si no hay, se cae al viejo (anulada por remisión)
        let estado = colEstadoGlobal ? normalizarEstadoEffi(String(f[colEstadoGlobal] ?? '')) : null;
        if (!estado) {
          const estadoR = colEstadoR ? String(f[colEstadoR] ?? '').toLowerCase() : '';
          const fechaAn = colFechaAn ? String(f[colFechaAn] ?? '').trim() : '';
          estado = (estadoR.includes('anul') || fechaAn.length > 0) ? 'anulada' : 'en_camino';
        }
        // Si el mismo teléfono aparece varias veces, gana el estado más avanzado
        const previo = mapa.get(t);
        if (!previo || prioridad.indexOf(estado) >= prioridad.indexOf(previo)) mapa.set(t, estado);
        // Flete de la guía
        if (colFlete) {
          const fl = Number(String(f[colFlete] ?? '').replace(/[^\d]/g, '')) || 0;
          if (fl > 0) fletes.set(t, fl);
        }
      }

      // Se combina con lo que ya había (cada Excel actualiza el anterior)
      const combinado = new Map(effi);
      for (const [t, e] of mapa) combinado.set(t, e);
      setEffi(combinado);
      setNombreArchivo(file.name);

      // Se guarda en el servidor para que no se pierda al salir
      try {
        const res = await fetch('/api/seguimiento/effi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guias: [...mapa].map(([telefono, estado]) => ({ telefono, estado, flete: fletes.get(telefono) ?? 0 })) }),
        });
        if (res.ok) setAvisoExcel(`✅ ${mapa.size} guías leídas y guardadas.`);
        else setAvisoExcel(`⚠️ ${mapa.size} leídas, pero no se pudieron guardar en el servidor.`);
      } catch {
        setAvisoExcel(`⚠️ ${mapa.size} leídas, pero falló el guardado.`);
      }
    } catch (err: any) {
      setAvisoExcel(`❌ No pude leer el archivo: ${err?.message ?? 'error'}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const effiDe = (p: Pedido): EstadoEffi => effi.get(tel10(p.telefono)) ?? 'sin-subir';

  const chipEffi: Record<EstadoEffi, { texto: string; color: string; fondo: string }> = {
    entregada:  { texto: 'ENTREGADA',       color: '#15803D', fondo: 'rgba(21,128,61,0.12)' },
    en_camino:  { texto: 'EN CAMINO',       color: '#2563EB', fondo: 'rgba(37,99,235,0.10)' },
    devuelta:   { texto: 'DEVUELTA',        color: '#DC2626', fondo: 'rgba(220,38,38,0.10)' },
    novedad:    { texto: 'NOVEDAD',         color: '#D97706', fondo: 'rgba(217,119,6,0.12)' },
    anulada:    { texto: 'ANULADA',         color: '#9333EA', fondo: 'rgba(147,51,234,0.10)' },
    'sin-subir':{ texto: 'SIN SUBIR A EFFI',color: '#B45309', fondo: 'rgba(180,83,9,0.12)' },
  };

  const colorQuin = (e: string) =>
    e.includes('VENTA')     ? '#00847A' :
    e.includes('CANCEL')    ? '#DC2626' :
    e.includes('PROGR')     ? '#14B8A6' :
    e.includes('PROCES')    ? '#15803D' :
    e.includes('ABONO')     ? '#F59E0B' : '#8B5CF6';

  // Recomendación por campaña según el costo objetivo por venta.
  function recomendacion(c: Campana): { txt: string; color: string; bg: string } | null {
    const obj = costoObjetivo;
    if (!c.gasto || obj <= 0) return null;
    const costo = c.costoPorEntregada ?? c.costoPorVenta ?? null; // preferir entregada
    if (c.ventas === 0 && c.gasto >= obj * 1.5)
      return { txt: '🔴 Apagar', color: '#DC2626', bg: 'rgba(220,38,38,0.10)' };
    if (costo != null) {
      if (costo > obj * 1.8)               return { txt: '🔴 Apagar',  color: '#DC2626', bg: 'rgba(220,38,38,0.10)' };
      if (costo <= obj * 0.7 && c.ventas)  return { txt: '🟢 Escalar', color: '#15803D', bg: 'rgba(21,128,61,0.12)' };
      if (costo <= obj)                    return { txt: '🟢 Va bien', color: '#15803D', bg: 'rgba(21,128,61,0.12)' };
    }
    return { txt: '🟡 Vigilar', color: '#D97706', bg: 'rgba(217,119,6,0.12)' };
  }

  // Una venta real: confirmada o etiquetada VENTA REALIZADA
  const esVenta = (p: Pedido) =>
    p.confirmado || (p.etiqueta ?? '').toUpperCase().includes('VENTA REALIZADA');

  // Solo ventas de WhatsApp (línea de ventas: estado empieza en "wa_").
  // Las de la Funnel se migran a otro lado.
  const esWhatsApp = (p: Pedido) => String(p.estado ?? '').toLowerCase().startsWith('wa');

  const baseVentas = pedidos.filter(p => esWhatsApp(p) && (!soloVentas || esVenta(p)));

  const filtrados = baseVentas.filter(p => {
    const q = busca.toLowerCase();
    const okBusca = !q || (p.nombre ?? '').toLowerCase().includes(q) || (p.telefono ?? '').includes(q);
    const okEffi = filtroEffi === 'todos' || effiDe(p) === filtroEffi;
    return okBusca && okEffi;
  });

  const chip = (activo: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs border transition-colors ${
      activo ? 'bg-[#00A89D] text-white border-[#00A89D] font-semibold' : 'bg-white border-[#E8E8E8] hover:border-[#00A89D]'
    }`;

  const cuenta = (e: EstadoEffi) => baseVentas.filter(p => effiDe(p) === e).length;
  const resumen = {
    entregada: cuenta('entregada'),
    enCamino:  cuenta('en_camino'),
    devuelta:  cuenta('devuelta'),
    novedad:   cuenta('novedad'),
    anulada:   cuenta('anulada'),
    sinSubir:  cuenta('sin-subir'),
  };
  const entregadas = resumen.entregada;
  const finalizadas = resumen.entregada + resumen.devuelta; // guías que ya cerraron
  const tasaEntrega = finalizadas > 0 ? Math.round((entregadas / finalizadas) * 100) : null;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        <header className="mb-4 pl-10 md:pl-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">META ADS</h1>
          <p className="text-xs text-[#6B6B6B] mt-1">
            Rendimiento de tus campañas de WhatsApp y cruce de ventas con Effi.
          </p>
        </header>

        {/* Pestañas */}
        <div className="flex gap-1 mb-4 p-1 bg-[#F0F0F0] rounded-xl w-fit flex-wrap">
          <button onClick={() => setTab('campanas')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === 'campanas' ? 'bg-white shadow text-[#0D0D0D]' : 'text-[#6B6B6B]'}`}>
            📣 Campañas
          </button>
          <button onClick={() => setTab('ventas_wa')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === 'ventas_wa' ? 'bg-white shadow text-[#25D366]' : 'text-[#6B6B6B]'}`}>
            💬 Ventas WhatsApp
          </button>
          <button onClick={() => setTab('effi')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === 'effi' ? 'bg-white shadow text-[#0D0D0D]' : 'text-[#6B6B6B]'}`}>
            🚚 Effi
          </button>
        </div>

        {/* ─────────── VENTAS WHATSAPP (reusa el panel de Ventas) ─────────── */}
        {tab === 'ventas_wa' && (
          <div className="-mt-2">
            <VentasPanel soloOrigen="whatsapp" onAbrirChat={onAbrirChat} />
          </div>
        )}

        {/* ─────────── CAMPAÑAS DE WHATSAPP ─────────── */}
        {tab === 'campanas' && (
          <>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs text-[#6B6B6B]">Desde</span>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white" />
              <span className="text-xs text-[#6B6B6B]">a</span>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white" />
              <button onClick={cargarCampanas} className="w-8 h-8 rounded-lg text-[#00A89D] hover:bg-[#00A89D]/10">⟳</button>
              <span className="w-px h-5 bg-[#E8E8E8] mx-1" />
              <span className="text-xs text-[#6B6B6B]">🎯 Costo objetivo/venta</span>
              <input type="number" value={costoObjetivo} onChange={e => guardarObjetivo(Number(e.target.value) || 0)}
                className="px-2 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white w-28"
                title="Hasta cuánto quieres pagar por venta. Sobre esto se calculan las recomendaciones." />
            </div>

            {/* Resumen del periodo: gasto real de Meta contra ventas confirmadas */}
            {resumenCamp && resumenCamp.gasto > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-white rounded-xl border border-[#E8E8E8] p-3">
                  <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">Gasto total</p>
                  <p className="text-lg font-extrabold text-[#DC2626]">{pesos(resumenCamp.gasto)}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E8E8E8] p-3">
                  <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">Ventas realizadas</p>
                  <p className="text-lg font-extrabold text-[#15803D]">{resumenCamp.ventas}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E8E8E8] p-3">
                  <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">Costo por venta</p>
                  <p className="text-lg font-extrabold text-[#0D0D0D]">{pesos(resumenCamp.costoPorVenta)}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E8E8E8] p-3">
                  <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">Costo por mensaje</p>
                  <p className="text-lg font-extrabold text-[#8B5CF6]">{pesos(resumenCamp.costoPorMensaje)}</p>
                </div>
              </div>
            )}

            {/* Aviso si el token de Meta no está configurado */}
            {gastoMetaError && (
              <div className="mb-4 rounded-xl border border-[#F0C674] bg-[#FFF9E8] px-4 py-3 text-[12px] text-[#8A6D00]">
                ⚠️ No se pudo traer el gasto de Meta ({gastoMetaError}). Las campañas se muestran
                igual, pero sin gasto ni costo por venta. Revisa el token en Vercel.
              </div>
            )}

            <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-hidden">
              <div className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-[#FAFAFA] border-b border-[#EEE] text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wide">
                <span className="flex-1">Campaña / Producto</span>
                <span className="w-44 text-center">ID anuncio</span>
                <button onClick={() => ordenarPor('mensajes')} className={`w-20 text-center uppercase tracking-wide hover:text-[#0D0D0D] ${orden.campo === 'mensajes' ? 'text-[#0D0D0D]' : ''}`}>Mensajes{flecha('mensajes')}</button>
                <button onClick={() => ordenarPor('ventas')} className={`w-16 text-center uppercase tracking-wide hover:text-[#0D0D0D] ${orden.campo === 'ventas' ? 'text-[#0D0D0D]' : ''}`}>Ventas{flecha('ventas')}</button>
                <button onClick={() => ordenarPor('gasto')} className={`w-20 text-center uppercase tracking-wide hover:text-[#0D0D0D] ${orden.campo === 'gasto' ? 'text-[#0D0D0D]' : ''}`}>Gasto{flecha('gasto')}</button>
                <button onClick={() => ordenarPor('costoVenta')} className={`w-24 text-center uppercase tracking-wide hover:text-[#0D0D0D] ${orden.campo === 'costoVenta' ? 'text-[#0D0D0D]' : ''}`}>Costo/venta{flecha('costoVenta')}</button>
                <button onClick={() => ordenarPor('conversion')} className={`w-16 text-center uppercase tracking-wide hover:text-[#0D0D0D] ${orden.campo === 'conversion' ? 'text-[#0D0D0D]' : ''}`}>Conv.{flecha('conversion')}</button>
              </div>

              {cargandoCamp ? (
                <p className="text-sm text-[#6B6B6B] py-12 text-center">Cargando…</p>
              ) : campanas.length === 0 ? (
                <p className="text-sm text-[#6B6B6B] py-12 text-center px-6">
                  Aún no hay chats que hayan llegado desde una campaña con ID configurado.
                  Pega los IDs en Catálogos o Embudos y espera a que lleguen clientes.
                </p>
              ) : (
                <div className="divide-y divide-[#F4F4F4]">
                  {campanasOrdenadas.map(c => (
                    <div key={c.anuncioId} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{c.producto}</p>
                          {c.estado && (
                            <span
                              className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={c.activa
                                ? { background: 'rgba(21,128,61,0.12)', color: '#15803D' }
                                : { background: 'rgba(154,154,154,0.15)', color: '#7A7A7A' }}
                            >
                              <span style={{
                                width: 6, height: 6, borderRadius: 999,
                                background: c.activa ? '#22C55E' : '#B0B0B0',
                                display: 'inline-block',
                              }} />
                              {c.estado}
                            </span>
                          )}
                          {/* Recomendación (apagar / escalar / vigilar) */}
                          {(() => { const r = recomendacion(c); return r ? (
                            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ color: r.color, background: r.bg }}>{r.txt}</span>
                          ) : null; })()}
                        </div>
                        {c.nombreAnuncio && <p className="text-[10px] text-[#B0B0B0] truncate">{c.nombreAnuncio}</p>}
                        {/* Métricas de Meta (embudo del anuncio) — vista de trafficker */}
                        {c.impresiones != null && (
                          <p className="text-[10px] text-[#8A8A8A] mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                            <span>👁 {c.impresiones.toLocaleString('es-CO')} impr.</span>
                            {c.alcance != null && <span>👤 {c.alcance.toLocaleString('es-CO')} alc.</span>}
                            {c.frecuencia != null && <span>Frec {c.frecuencia}</span>}
                            {c.ctr != null && <span>CTR {c.ctr}%</span>}
                            {c.cpm != null && <span>CPM {pesos(c.cpm)}</span>}
                            {!!c.mensajesMeta && (
                              <span className="text-[#00847A] font-semibold">
                                💬 {c.mensajesMeta} chats{c.costoPorMensajeMeta ? ` (${pesos(c.costoPorMensajeMeta)}/chat)` : ''}
                              </span>
                            )}
                            {!!c.thruplays && <span>▶️ {c.thruplays.toLocaleString('es-CO')} thruplays</span>}
                          </p>
                        )}
                        {/* Entrega real (cruce con Effi) — lo que importa en contraentrega */}
                        {!!(c.entregadas || c.devueltas || c.enCamino) && (
                          <p className="text-[10px] mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                            <span className="text-[#15803D] font-semibold">📦 {c.entregadas ?? 0} entregadas</span>
                            {!!c.devueltas && <span className="text-[#DC2626]">↩ {c.devueltas} devueltas</span>}
                            {!!c.enCamino && <span className="text-[#2563EB]">🚚 {c.enCamino} en camino</span>}
                            {c.tasaEntrega != null && <span className="text-[#00847A] font-semibold">✅ {c.tasaEntrega}% entrega</span>}
                            {c.costoPorEntregada != null && <span className="text-[#0D0D0D] font-bold">Costo/entregada {pesos(c.costoPorEntregada)}</span>}
                          </p>
                        )}
                        <p className="text-[10px] text-[#9A9A9A] md:hidden break-all">
                          ID: {c.anuncioId} · Gasto: {pesos(c.gasto)} · Costo/venta: {pesos(c.costoPorVenta)}
                        </p>
                      </div>
                      <span
                        className="hidden md:block w-44 text-center text-[10px] text-[#6B6B6B] break-all select-all leading-tight cursor-pointer"
                        title="Clic para copiar el ID"
                        onClick={() => { navigator.clipboard?.writeText(c.anuncioId); }}
                      >{c.anuncioId}</span>
                      <span className="hidden md:block w-20 text-center text-sm font-bold text-[#8B5CF6]">{c.mensajes}</span>
                      <span className="hidden md:block w-16 text-center text-sm font-bold text-[#15803D]">{c.ventas}</span>
                      <span className="hidden md:block w-20 text-center text-xs font-semibold text-[#DC2626]">{pesos(c.gasto)}</span>
                      <span className="hidden md:block w-24 text-center text-xs font-bold text-[#0D0D0D]">{pesos(c.costoPorVenta)}</span>
                      <span className="hidden md:block w-16 text-center text-xs font-semibold text-[#00847A]">{c.conversion}%</span>
                      {/* Vista compacta móvil: mensajes/ventas a la derecha */}
                      <div className="md:hidden text-right">
                        <span className="text-sm font-bold text-[#8B5CF6]">{c.mensajes}</span>
                        <span className="text-[#CCC]"> / </span>
                        <span className="text-sm font-bold text-[#15803D]">{c.ventas}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-[#9A9A9A] mt-3">
              <b>Mensajes</b> = personas que escribieron desde esa campaña · <b>Ventas</b> = chats que cerraron con VENTA REALIZADA ·
              <b> Gasto</b> y <b>Costo/venta</b> vienen directo de Meta según el ID del anuncio.
            </p>
          </>
        )}

        {/* ─────────── EFFI ─────────── */}
        {tab === 'effi' && (<>

        {/* Subir Excel */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-4 shadow-sm mb-4 flex items-center gap-3 flex-wrap">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={subirExcel} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A]"
          >📄 Subir archivo de Effi</button>
          {nombreArchivo && <span className="text-xs text-[#6B6B6B]">{nombreArchivo}</span>}
          {avisoExcel && <span className="text-xs font-medium ml-auto">{avisoExcel}</span>}
        </div>

        {/* Resumen del cruce */}
        {effi.size > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { t: 'Entregadas',  v: resumen.entregada, c: '#15803D' },
              { t: 'En camino',   v: resumen.enCamino,  c: '#2563EB' },
              { t: 'Devueltas',   v: resumen.devuelta,  c: '#DC2626' },
              { t: tasaEntrega != null ? `Tasa entrega ${tasaEntrega}%` : 'Sin subir', v: tasaEntrega != null ? `${tasaEntrega}%` : resumen.sinSubir, c: '#00847A' },
            ].map(k => (
              <div key={k.t} className="bg-white rounded-2xl border border-[#E8E8E8] p-3 shadow-sm">
                <div className="text-[11px] text-[#6B6B6B]">{k.t}</div>
                <div className="text-lg font-bold" style={{ color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDias(d)} className={chip(dias === d)}>{d} días</button>
          ))}
          <span className="w-px h-5 bg-[#E8E8E8] mx-1" />
          <button onClick={() => setSoloVentas(v => !v)} className={chip(soloVentas)}>
            {soloVentas ? '✅ Solo ventas' : 'Todos los pedidos'}
          </button>
          <span className="w-px h-5 bg-[#E8E8E8] mx-1" />
          {([['todos','Todos'],['entregada','Entregadas'],['en_camino','En camino'],['devuelta','Devueltas'],['novedad','Novedad'],['anulada','Anuladas'],['sin-subir','Sin subir']] as const).map(([k, t]) => (
            <button key={k} onClick={() => setFiltroEffi(k as any)} className={chip(filtroEffi === k)}>{t}</button>
          ))}
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar nombre, teléfono…"
            className="ml-auto px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs w-48 focus:outline-none focus:border-[#00A89D]"
          />
        </div>

        {/* Lista */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-hidden">
          {cargando ? (
            <p className="text-sm text-[#6B6B6B] py-12 text-center">Cargando…</p>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-[#6B6B6B] py-12 text-center px-6">No hay pedidos en este período.</p>
          ) : (
            <div className="divide-y divide-[#F4F4F4]">
              {filtrados.map(p => {
                const eQuin = estadoQuin(p);
                const eEffi = chipEffi[effiDe(p)];
                const tel = tel10(p.telefono);
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Foto */}
                    <span className="w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-[#F2F2F2] flex items-center justify-center">
                      {p.foto
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.foto} alt="" className="w-full h-full object-cover" loading="lazy" />
                        : <span className="text-sm text-[#C9C9C9]">🛍️</span>}
                    </span>

                    {/* Cliente */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{p.nombre || '—'}</p>
                      <p className="text-[11px] text-[#6B6B6B]">{tel} · {cuando(p.created_at)}</p>
                    </div>

                    {/* Estado QuinChat */}
                    <span className="hidden md:inline text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                          style={{ color: colorQuin(eQuin), background: colorQuin(eQuin) + '18' }}>
                      {eQuin}
                    </span>

                    {/* Estado Effi */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                          style={{ color: eEffi.color, background: eEffi.fondo }}>
                      {eEffi.texto}
                    </span>

                    {/* Chat */}
                    <button
                      onClick={() => onAbrirChat ? onAbrirChat(`57${tel}`) : window.open(`https://wa.me/57${tel}`, '_blank')}
                      title="Abrir el chat"
                      className="w-8 h-8 rounded-lg text-[#00A89D] hover:bg-[#00A89D]/10 shrink-0"
                    >💬</button>
                    {/* Enviar a papelera */}
                    <button
                      onClick={() => { if (confirm('¿Enviar esta venta a la papelera? Quedará 30 días y puedes restaurarla.')) moverPapelera(p.id, 'enviar'); }}
                      title="Enviar a papelera"
                      className="w-8 h-8 rounded-lg text-[#B0B0B0] hover:text-[#DC2626] hover:bg-[#FEE2E2] shrink-0"
                    >🗑</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
                {papelera.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 opacity-80">
                    <span className="w-9 h-9 shrink-0 rounded-lg overflow-hidden bg-[#F2F2F2] flex items-center justify-center">
                      {p.foto
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.foto} alt="" className="w-full h-full object-cover" loading="lazy" />
                        : <span className="text-xs text-[#C9C9C9]">🛍️</span>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate line-through text-[#6B6B6B]">{p.nombre || '—'}</p>
                      <p className="text-[11px] text-[#9A9A9A]">{tel10(p.telefono)} · {p.producto || ''}</p>
                    </div>
                    <button
                      onClick={() => moverPapelera(p.id, 'restaurar')}
                      className="text-[11px] font-semibold text-[#00847A] hover:underline shrink-0"
                    >↩ Restaurar</button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
        </>)}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react';
import { imgOptim } from '@/lib/funnels';
import CarritosAbandonados from './CarritosAbandonados';

interface Pedido {
  id: string; referencia: string; nombre: string; telefono: string;
  producto: string; talla: string; valor: string;
  direccion: string; ciudad: string; departamento: string; correo: string;
  confirmado: boolean; estado: string; abono: number; abono_recibido: boolean;
  utm_source: string | null; utm_campaign: string | null;
  campana_nombre?: string | null;
  plataforma?: 'facebook' | 'tiktok' | null;
  canal?: string; fuente?: string;
  foto?: string | null;
  embudo_slug?: string | null;
  embudo_nombre?: string | null;
  prendas?: number;
  created_at: string;
}

type Canal = 'todas' | 'embudos' | 'funnelish' | 'whatsapp' | 'promociones';
interface DesgloseCanal { canal: string; label: string; total: number; confirmados: number; prendas?: number; prendasConf?: number; pendientes: number; cancelados: number; valor: number; conversion: number; }
interface DesgloseFuente { fuente: string; label: string; total: number; confirmados: number; prendas?: number; prendasConf?: number; pendientes: number; cancelados: number; valor: number; conversion: number; }
interface DiaFila { dia: string; total: number; conf: number; pend: number; canc: number; valor: number; prendas?: number; prendasConf?: number; }
interface HoraFila { hora: number; total: number; conf: number; pend: number; canc: number; valor: number; prendas: number; prendasConf: number; }

const CANAL_CHIP: Record<string, string> = {
  embudos: 'bg-[#e6f7f5] text-[#0b8a86]', funnelish: 'bg-[#eef4ff] text-[#2f80ed]',
  whatsapp: 'bg-[#e9f9f0] text-[#1e9e63]', promociones: 'bg-[#fff4d6] text-[#9a6a00]',
  sin_identificar: 'bg-[#f1f1f1] text-[#777]',
};
const FUENTE_ICO: Record<string, string> = { tiktok: '⬛', meta: '🔵', organico: '🌱', directo: '➡️', sin_identificar: '❔' };

/** Logo de Facebook (azul). */
function LogoFacebook() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-label="Facebook">
      <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.95.93-1.95 1.88v2.25h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07" />
    </svg>
  );
}
/** Logo de TikTok (negro). */
function LogoTikTok() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-label="TikTok">
      <path fill="#111" d="M16.6 5.82c-.9-.6-1.5-1.5-1.72-2.57a4.2 4.2 0 0 1-.07-.75h-2.9v11.6c0 1.37-1.1 2.48-2.47 2.48a2.48 2.48 0 0 1-2.48-2.48c0-1.37 1.1-2.48 2.48-2.48.26 0 .52.04.76.12V9.4a5.4 5.4 0 0 0-.76-.05 5.37 5.37 0 1 0 5.37 5.37V9.01a7.03 7.03 0 0 0 4.12 1.32V7.44c-.9 0-1.74-.27-2.45-.73" />
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Gráficas en SVG puro (sin librerías: carga instantánea y sin dependencias)
// ════════════════════════════════════════════════════════════════════════════

/** Mini gráfica de tendencia para las tarjetas. */
function Sparkline({ valores, color }: { valores: number[]; color: string }) {
  if (valores.length < 2 || valores.every(v => v === 0)) return <div className="w-24 h-9" />;
  const W = 96, H = 34, max = Math.max(...valores, 1), min = Math.min(...valores, 0);
  const pts = valores.map((v, i) => [ (i / (valores.length - 1)) * W, H - 3 - ((v - min) / (max - min || 1)) * (H - 6) ]);
  const linea = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const id = `sp${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-24 h-9 shrink-0" aria-hidden>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${linea} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />
      <path d={linea} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Barras agrupadas: por cada punto, dos barras (pedidos y prendas) con su número encima. */
function BarrasDobles({ datos, alto = 230 }: { datos: { etiqueta: string; a: number; b: number; resaltar?: boolean; titulo?: string }[]; alto?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!datos.length) return <p className="text-xs text-[#9A9A9A] py-16 text-center">Sin datos en el período.</p>;
  const max = Math.max(...datos.map(d => Math.max(d.a, d.b)), 1);
  const paso = max <= 10 ? 2 : max <= 25 ? 5 : max <= 60 ? 10 : max <= 150 ? 25 : Math.ceil(max / 5 / 10) * 10;
  const tope = Math.ceil(max / paso) * paso;
  const marcas = Array.from({ length: tope / paso + 1 }, (_, i) => i * paso);
  const colW = Math.max(30, 680 / datos.length);
  const W = Math.max(680, datos.length * colW), H = alto, top = 22, bottom = 26, left = 30;
  const altoUtil = H - top - bottom;
  const y = (v: number) => top + altoUtil - (v / tope) * altoUtil;
  const bw = Math.min(18, colW * 0.3);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W + left} ${H}`} className="w-full min-w-[560px]" style={{ height: H }} role="img">
        {marcas.map(m => (
          <g key={m}>
            <line x1={left} x2={W + left} y1={y(m)} y2={y(m)} stroke="#EEF0F0" strokeDasharray={m ? '3 4' : undefined} />
            <text x={left - 6} y={y(m) + 3} fontSize="10" fill="#9A9A9A" textAnchor="end">{m}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const cx = left + i * colW + colW / 2;
          const ha = (d.a / tope) * altoUtil, hb = (d.b / tope) * altoUtil;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }}>
              <title>{d.titulo ?? `${d.etiqueta}: ${d.a} pedidos · ${d.b} prendas`}</title>
              {(d.resaltar || hover === i) && <rect x={cx - colW / 2 + 2} y={top - 14} width={colW - 4} height={altoUtil + 14} rx="6" fill={d.resaltar ? '#00A89D' : '#0D0D0D'} opacity=".05" />}
              <rect x={cx - bw - 1} y={y(d.a)} width={bw} height={Math.max(ha, d.a ? 2 : 0)} rx="3" fill="#0B6E4F" className="qp-barra" />
              <rect x={cx + 1} y={y(d.b)} width={bw} height={Math.max(hb, d.b ? 2 : 0)} rx="3" fill="#3CC7BC" className="qp-barra" />
              {d.a > 0 && <text x={cx - bw / 2 - 1} y={y(d.a) - 4} fontSize="10" fontWeight="700" fill="#0B6E4F" textAnchor="middle">{d.a}</text>}
              {d.b > 0 && <text x={cx + bw / 2 + 1} y={y(d.b) - 4} fontSize="10" fontWeight="700" fill="#0E9C92" textAnchor="middle">{d.b}</text>}
              <text x={cx} y={H - 8} fontSize="10" fill={d.resaltar ? '#00847A' : '#6B6B6B'} fontWeight={d.resaltar ? 700 : 400} textAnchor="middle">{d.etiqueta}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Dona de estados. */
function Dona({ partes, centro, sub }: { partes: { valor: number; color: string }[]; centro: string; sub: string }) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  const R = 52, C = 2 * Math.PI * R;
  let acum = 0;
  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36 shrink-0" role="img">
      <circle cx="70" cy="70" r={R} fill="none" stroke="#F0F0F0" strokeWidth="18" />
      {total > 0 && partes.map((p, i) => {
        const largo = (p.valor / total) * C;
        const el = <circle key={i} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="18"
          strokeDasharray={`${largo} ${C - largo}`} strokeDashoffset={-acum} transform="rotate(-90 70 70)" />;
        acum += largo;
        return el;
      })}
      <text x="70" y="68" textAnchor="middle" fontSize="24" fontWeight="800" fill="#0D0D0D">{centro}</text>
      <text x="70" y="86" textAnchor="middle" fontSize="10" fill="#6B6B6B">{sub}</text>
    </svg>
  );
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "PAREJA MOTO PULSAR - NEGRO" + "L HOMBRE" → "L · Negro" */
function tallaColor(p: Pedido): string {
  const color = String(p.producto ?? '').split(' - ').slice(1).join(' - ').trim();
  const talla = String(p.talla ?? '').trim();
  const t = [talla || 'sin talla', color ? color.charAt(0) + color.slice(1).toLowerCase() : ''].filter(Boolean);
  return t.join(' / ');
}

/** Cuántos pedidos se pintan de entrada y en cada "Ver más". */
const PASO_LISTA = 60;

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const aNumero = (v: string) => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;

function cuando(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia
    ? d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + ' ' +
      d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

// Día en Colombia (YYYY-MM-DD) a partir de una fecha ISO.
function diaCol(iso: string) {
  return new Date(new Date(iso).getTime() - 5 * 3600000).toISOString().slice(0, 10);
}
function diaBonito(iso: string) {
  const hoy = diaCol(new Date().toISOString());
  if (iso === hoy) return 'Hoy';
  const [, m, d] = iso.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)} ${meses[Number(m) - 1]}`;
}

// ── Fechas en zona horaria de Colombia (America/Bogotá, UTC-5) ──────────────
const hoyBogota = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
function sumarDias(ymd: string, n: number) {
  const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Presets del selector de fechas → {desde, hasta} en YYYY-MM-DD (Colombia). */
function rangoPreset(clave: string): { desde: string; hasta: string } | null {
  const hoy = hoyBogota();
  const [y, m] = hoy.split('-').map(Number);
  switch (clave) {
    case 'hoy':        return { desde: hoy, hasta: hoy };
    case 'ayer':       return { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) };
    case '7':          return { desde: sumarDias(hoy, -6), hasta: hoy };
    case '15':         return { desde: sumarDias(hoy, -14), hasta: hoy };
    case '30':         return { desde: sumarDias(hoy, -29), hasta: hoy };
    case 'mes':        return { desde: `${y}-${String(m).padStart(2, '0')}-01`, hasta: hoy };
    case 'mesprev': {
      const pm = m === 1 ? 12 : m - 1; const py = m === 1 ? y - 1 : y;
      const ultimo = new Date(Date.UTC(py, pm, 0)).getUTCDate();
      return { desde: `${py}-${String(pm).padStart(2, '0')}-01`, hasta: `${py}-${String(pm).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}` };
    }
    default: return null;
  }
}

function estadoDe(p: Pedido): { texto: string; color: string; fondo: string } {
  const e = String(p.estado ?? '').toLowerCase();
  if (p.confirmado)         return { texto: 'Confirmado', color: '#15803D', fondo: 'rgba(21,128,61,0.10)' };
  if (e === 'cancelado')    return { texto: 'Cancelado',  color: '#DC2626', fondo: 'rgba(220,38,38,0.10)' };
  if (e === 'duplicado')    return { texto: 'Duplicado',  color: '#9A9A9A', fondo: 'rgba(154,154,154,0.10)' };
  return { texto: 'Por confirmar', color: '#EA580C', fondo: 'rgba(234,88,12,0.10)' };
}

interface Props {
  /** Abre el chat de ese cliente dentro del panel. */
  onAbrirChat?: (conversationId: string) => void;
  /** Abre ese embudo en el editor (sección Embudos) para editarlo. */
  onEditarEmbudo?: (slug: string) => void;
}

export default function PedidosPanel({ onAbrirChat, onEditarEmbudo }: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [resumen, setResumen] = useState<{ total: number; confirmados: number; pendientes: number; cancelados: number; vendido: number; tasa: number; prendas?: number; prendasConf?: number }>({ total: 0, confirmados: 0, pendientes: 0, cancelados: 0, vendido: 0, tasa: 0, prendas: 0, prendasConf: 0 });
  const [porCanal, setPorCanal]   = useState<DesgloseCanal[]>([]);
  const [porFuente, setPorFuente] = useState<DesgloseFuente[]>([]);
  const [porDiaApi, setPorDiaApi] = useState<DiaFila[]>([]);
  const [porHora, setPorHora] = useState<HoraFila[] | null>(null);
  // La gráfica principal puede mirar un rango distinto al filtro (por defecto 15 días)
  const [rangoGrafica, setRangoGrafica] = useState<'filtro' | '7' | '15' | '30'>('filtro');
  const [diasGrafica, setDiasGrafica] = useState<DiaFila[]>([]);
  const [comparacion, setComparacion] = useState<Record<string, number> | null>(null);
  const [promoInfo, setPromoInfo] = useState<{ total: number; confirmados: number }>({ total: 0, confirmados: 0 });
  const [cargando, setCargando] = useState(true);
  const [canal, setCanal]       = useState<Canal>('todas');
  const [fuente, setFuente]     = useState('');
  const [dias, setDias]         = useState(1);
  const [rango, setRango]       = useState<{ desde: string; hasta: string } | null>(() => rangoPreset('hoy'));
  const [preset, setPreset]     = useState<string>('hoy');   // etiqueta del rango activo
  const [verRango, setVerRango] = useState(false);          // abre inputs de rango personalizado
  const [busca, setBusca]       = useState('');
  const [verCarritos, setVerCarritos] = useState(false);

  // Selección múltiple y acciones
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [menu, setMenu]           = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<'cancelar' | 'eliminar' | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  // Ancla para seleccionar rangos con Shift + clic
  const anclaRef = useRef<number>(-1);

  // Ventana de detalle
  const [detalle, setDetalle]   = useState<Pedido | null>(null);
  const [fotos, setFotos]       = useState<string[]>([]);
  const [cargandoDet, setCargandoDet] = useState(false);

  // Marca/desmarca una fila. Con Shift, aplica lo mismo a todo el rango entre
  // la última fila tocada y esta (en cualquier dirección).
  function alternar(indice: number, conShift = false) {
    setSeleccion(prev => {
      const s = new Set(prev);
      const id = filtrados[indice]?.id;
      if (!id) return prev;

      if (conShift && anclaRef.current >= 0) {
        const desde = Math.min(anclaRef.current, indice);
        const hasta = Math.max(anclaRef.current, indice);
        // El ancla decide si el rango se marca o se desmarca:
        // si el ancla está seleccionada, se marca todo el rango.
        const marcar = prev.has(filtrados[anclaRef.current]?.id ?? '');
        for (let i = desde; i <= hasta; i++) {
          const rid = filtrados[i]?.id;
          if (!rid) continue;
          if (marcar) s.add(rid); else s.delete(rid);
        }
      } else {
        if (s.has(id)) s.delete(id); else s.add(id);
        anclaRef.current = indice;
      }
      return s;
    });
  }

  async function ejecutar(accion: 'cancelar' | 'eliminar' | 'restaurar', ids?: string[]) {
    const lista = ids ?? [...seleccion];
    if (lista.length === 0) return;
    setTrabajando(true);
    try {
      const res = await fetch('/api/pedidos/accion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: lista, accion }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d?.error ?? 'No se pudo completar la acción');
        return;
      }
      setSeleccion(new Set());
      setConfirmar(null);
      setMenu(null);
      setDetalle(null);
      await cargar(false);
    } finally { setTrabajando(false); }
  }

  async function abrirDetalle(p: Pedido) {
    setDetalle(p);
    setFotos([]);
    setCargandoDet(true);
    try {
      const res  = await fetch(`/api/pedidos/detalle?id=${encodeURIComponent(p.id)}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setDetalle(data.pedido ?? p);
        setFotos(data.imagenes ?? []);
      }
    } finally { setCargandoDet(false); }
  }

  // Carga de datos.
  //  · Al entrar o al cambiar un filtro → muestra el esqueleto (carga "visible").
  //  · El refresco automático es SILENCIOSO: no borra la lista ni mueve el scroll,
  //    y si los datos no cambiaron no se vuelve a pintar nada.
  const [actualizando, setActualizando] = useState(false);
  // La lista se pinta por partes (rápido aunque haya cientos de pedidos)
  const [visibles, setVisibles] = useState(PASO_LISTA);
  const [verTodosDias, setVerTodosDias] = useState(false);
  const ultimaRespuesta = useRef<string>('');
  const pidiendo = useRef(false);
  const cargar = useCallback(async (silencioso = false) => {
    if (pidiendo.current && silencioso) return;      // no encimar refrescos
    pidiendo.current = true;
    if (silencioso) setActualizando(true); else setCargando(true);
    try {
      const rangoQs = rango ? `desde=${rango.desde}&hasta=${rango.hasta}` : `dias=${dias}`;
      const qs = `canal=${canal}&${rangoQs}${fuente ? `&fuente=${fuente}` : ''}`;
      const res  = await fetch(`/api/pedidos/lista?${qs}`, { cache: 'no-store' });
      const texto = await res.text();
      if (silencioso && texto === ultimaRespuesta.current) return;   // nada nuevo: no repintar
      ultimaRespuesta.current = texto;
      const data = JSON.parse(texto);
      setPedidos(data.pedidos ?? []);
      setResumen(data.resumen ?? { total: 0, confirmados: 0, pendientes: 0, cancelados: 0, vendido: 0, tasa: 0 });
      setPorCanal(data.porCanal ?? []);
      setPorFuente(data.porFuente ?? []);
      setPorDiaApi(data.porDia ?? []);
      setPorHora(data.porHora ?? null);
      setComparacion(data.comparacion ?? null);
      setPromoInfo(data.promociones ?? { total: 0, confirmados: 0 });
    } catch { /* si falla un refresco, se deja lo que había */ }
    finally { pidiendo.current = false; setCargando(false); setActualizando(false); }
  }, [canal, dias, fuente, rango]);

  useEffect(() => { setVisibles(PASO_LISTA); cargar(false); }, [cargar]);

  // Datos de la gráfica principal cuando mira un rango propio (7/15/30 días)
  const [tickGrafica, setTickGrafica] = useState(0);
  useEffect(() => {
    if (rangoGrafica === 'filtro') return;
    let vivo = true;
    const r = rangoPreset(rangoGrafica)!;
    fetch(`/api/pedidos/lista?canal=${canal}&desde=${r.desde}&hasta=${r.hasta}${fuente ? `&fuente=${fuente}` : ''}`, { cache: 'no-store' })
      .then(res => res.json()).then(d => { if (vivo) setDiasGrafica(d.porDia ?? []); }).catch(() => {});
    return () => { vivo = false; };
  }, [rangoGrafica, canal, fuente, tickGrafica]);

  // Refresco automático cada 60 s, silencioso, solo con la pantalla visible y
  // sin interrumpir si estás revisando un pedido o tienes pedidos seleccionados.
  const ocupadoRef = useRef(false);
  ocupadoRef.current = !!detalle || seleccion.size > 0 || !!confirmar;
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && !ocupadoRef.current) { cargar(true); setTickGrafica(t => t + 1); }
    }, 60000);
    return () => clearInterval(t);
  }, [cargar]);



  // La API ya devuelve el subconjunto correcto según el canal (incl. Funnelish).
  const base = pedidos;
  const resumenVista = resumen;

  const filtrados = base.filter(p => {
    const q = busca.toLowerCase();
    return !q
      || (p.nombre ?? '').toLowerCase().includes(q)
      || (p.telefono ?? '').includes(q)
      || (p.producto ?? '').toLowerCase().includes(q);
  });

  const todosMarcados = filtrados.length > 0 && filtrados.every(p => seleccion.has(p.id));

  // Desglose por día (del API: confirmados / pendientes / cancelados).
  const porDia = porDiaApi;

  const chip = (activo: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs border transition-colors ${
      activo ? 'bg-[#00A89D] text-white border-[#00A89D] font-semibold' : 'bg-white border-[#E8E8E8] hover:border-[#00A89D]'
    }`;

  // Carritos abandonados en pantalla completa (con "← Volver")
  if (verCarritos) return <CarritosAbandonados onClose={() => setVerCarritos(false)} onAbrirChat={onAbrirChat} />;

  // ── Series para las gráficas ───────────────────────────────────────────────
  const diasAsc = [...porDia].reverse();                      // del más viejo al más nuevo
  const serieKpi = porHora ?? diasAsc;                         // un solo día → por hora
  const spark = (f: (d: any) => number) => serieKpi.map(f);
  const datosGrafica = (rangoGrafica === 'filtro'
    ? (porHora
        ? porHora.filter((h, i) => h.total > 0 || i >= 6).map(h => ({ etiqueta: `${h.hora}h`, a: h.total, b: h.prendas, titulo: `${h.hora}:00 — ${h.total} pedidos · ${h.prendas} prendas · ${h.conf} confirmados` }))
        : diasAsc.map(d => ({ etiqueta: diaBonito(d.dia), a: d.total, b: d.prendas ?? 0, resaltar: diaBonito(d.dia) === 'Hoy', titulo: `${diaBonito(d.dia)} — ${d.total} pedidos · ${d.prendas ?? 0} prendas · ${d.conf} confirmados` })))
    : [...diasGrafica].reverse().map(d => ({ etiqueta: diaBonito(d.dia), a: d.total, b: d.prendas ?? 0, resaltar: diaBonito(d.dia) === 'Hoy', titulo: `${diaBonito(d.dia)} — ${d.total} pedidos · ${d.prendas ?? 0} prendas · ${d.conf} confirmados` })));
  const etiquetaRango = preset === 'hoy' ? 'Hoy' : preset === 'ayer' ? 'Ayer' : preset === 'mes' ? 'Este mes' : preset === 'mesprev' ? 'Mes anterior'
    : preset === 'custom' ? 'Personalizado' : `Últimos ${preset} días`;
  const canalesGraf = (['funnelish', 'embudos', 'whatsapp'] as const).map(c => porCanal.find(x => x.canal === c)
    ?? { canal: c, label: c === 'embudos' ? 'Embudos QuinChat' : c === 'funnelish' ? 'Funnelish' : 'WhatsApp (bot)', total: 0, prendas: 0, confirmados: 0, valor: 0, conversion: 0 } as any);
  const maxCanal = Math.max(1, ...canalesGraf.map(c => Math.max(c.total, c.prendas ?? 0)));
  const ICONO_CANAL: Record<string, string> = { funnelish: '📄', embudos: '🚀', whatsapp: '💬' };

  function exportarCSV() {
    const filas = [['Fecha', 'Estado', 'Cliente', 'Teléfono', 'Producto', 'Talla/Color', 'Canal', 'Campaña', 'Prendas', 'Valor', 'Ciudad']];
    for (const p of filtrados) filas.push([
      new Date(p.created_at).toLocaleString('es-CO'), estadoDe(p).texto, p.nombre ?? '', p.telefono ?? '', p.producto ?? '',
      tallaColor(p), p.canal ?? '', p.campana_nombre || p.utm_campaign || 'Directo', String(p.prendas ?? 1), String(aNumero(p.valor)), p.ciudad ?? '',
    ]);
    const csv = filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `pedidos-${preset}-${hoyBogota()}.csv`;
    a.click();
  }

  const tarjeta = 'bg-white rounded-2xl border border-[#EDEFEF] shadow-[0_1px_3px_rgba(16,24,40,.04)]';

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#F6F8F8]">
      <style>{`@keyframes qp-sube{from{transform:scaleY(0)}to{transform:scaleY(1)}} .qp-barra{transform-box:fill-box;transform-origin:bottom;animation:qp-sube .5s ease-out both} @media (prefers-reduced-motion: reduce){.qp-barra{animation:none}}`}</style>
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-6">

        {/* Encabezado */}
        <header className="mb-5 pl-10 md:pl-0 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-[28px] font-extrabold text-[#0D0D0D] tracking-tight">Pedidos y estadísticas</h1>
            <p className="text-xs text-[#6B6B6B] mt-1">Analiza tus ventas, confirmaciones y resultados por canal.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-stretch rounded-2xl bg-gradient-to-r from-[#00847A] to-[#00A89D] text-white shadow-md overflow-hidden">
              <div className="px-4 py-2">
                <p className="text-lg font-extrabold leading-tight">{pesos(resumenVista.vendido)}</p>
                <p className="text-[10px] text-white/80">Vendido · {etiquetaRango}</p>
              </div>
              <div className="w-px bg-white/25 my-2" />
              <div className="px-4 py-2">
                <p className="text-lg font-extrabold leading-tight">{resumenVista.prendasConf ?? 0}</p>
                <p className="text-[10px] text-white/80">Prendas vendidas</p>
              </div>
            </div>
            <button onClick={() => cargar(false)} title="Actualizar" className={`w-10 h-10 rounded-xl bg-white border border-[#E8E8E8] text-[#00A89D] hover:bg-[#00A89D]/10 ${actualizando ? 'animate-spin' : ''}`}>⟳</button>
            <button onClick={exportarCSV} className="h-10 px-4 rounded-xl bg-[#0D1B2A] text-white text-sm font-semibold hover:opacity-90">⬇ Exportar</button>
            <button onClick={() => setVerCarritos(true)} title="Clientes que empezaron a comprar y no terminaron"
              className="h-10 px-4 rounded-xl border border-[#F59E0B]/50 bg-white text-[#B45309] text-sm font-semibold hover:bg-[#F59E0B]/10">🛒 Carritos</button>
          </div>
        </header>

        {/* Filtros */}
        <div className={`${tarjeta} px-4 py-3 mb-5 space-y-2.5`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-[#6B6B6B] w-28 shrink-0">Canal:</span>
            <button onClick={() => setCanal('todas')}       className={chip(canal === 'todas')}>Todas</button>
            <button onClick={() => setCanal('funnelish')}   className={chip(canal === 'funnelish')}>📄 Funnelish</button>
            <button onClick={() => setCanal('embudos')}     className={chip(canal === 'embudos')}>🚀 Embudos QuinChat</button>
            <button onClick={() => setCanal('whatsapp')}    className={chip(canal === 'whatsapp')}>💬 WhatsApp (bot)</button>
            <button onClick={() => setCanal('promociones')} className={chip(canal === 'promociones')}>🎟️ Promociones</button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-[#6B6B6B] w-28 shrink-0">Rango de fechas:</span>
            {([
              ['hoy', 'Hoy'], ['ayer', 'Ayer'], ['7', '7 días'], ['15', '15 días'],
              ['30', '30 días'], ['mes', 'Este mes'], ['mesprev', 'Mes anterior'],
            ] as [string, string][]).map(([clave, txt]) => (
              <button key={clave}
                onClick={() => { setPreset(clave); setVerRango(false); setRango(rangoPreset(clave)); }}
                className={chip(preset === clave && !verRango)}>{txt}</button>
            ))}
            <button onClick={() => { setVerRango(v => !v); setPreset('custom'); }} className={chip(verRango)}>📆 Personalizado</button>
            {verRango && (
              <span className="flex items-center gap-1.5">
                <input type="date" value={rango?.desde ?? hoyBogota()}
                  onChange={e => setRango(r => ({ desde: e.target.value, hasta: r?.hasta ?? hoyBogota() }))}
                  className="px-2 py-1 rounded-lg border border-[#E8E8E8] text-xs" />
                <span className="text-[11px] text-[#9A9A9A]">a</span>
                <input type="date" value={rango?.hasta ?? hoyBogota()}
                  onChange={e => setRango(r => ({ desde: r?.desde ?? hoyBogota(), hasta: e.target.value }))}
                  className="px-2 py-1 rounded-lg border border-[#E8E8E8] text-xs" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-[#6B6B6B] w-28 shrink-0">Fuente:</span>
            <select value={fuente} onChange={e => setFuente(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white focus:outline-none focus:border-[#00A89D]">
              <option value="">Todas</option>
              <option value="tiktok">TikTok Ads</option>
              <option value="meta">Meta Ads</option>
              <option value="organico">Orgánico</option>
              <option value="directo">Directo</option>
              <option value="sin_identificar">Sin identificar</option>
            </select>
            {(fuente || canal !== 'todas') && (
              <button onClick={() => { setCanal('todas'); setFuente(''); }}
                className="px-3 py-1.5 rounded-lg text-xs border border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5]">✕ Limpiar filtros</button>
            )}
            <input value={busca} onChange={e => { setBusca(e.target.value); setVisibles(PASO_LISTA); }}
              placeholder="🔎 Buscar cliente, teléfono, producto…"
              className="ml-auto px-3 py-2 rounded-lg border border-[#E8E8E8] text-xs w-full sm:w-72 focus:outline-none focus:border-[#00A89D]" />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 mb-5">
          {[
            { t: 'Pedidos recibidos',  v: String(resumenVista.total),       c: '#2F80ED', i: '🛒', d: comparacion?.total, extra: `${resumenVista.prendas ?? 0} prendas`, serie: spark(d => d.total) },
            { t: 'Pedidos confirmados', v: String(resumenVista.confirmados), c: '#15803D', i: '✅', d: comparacion?.confirmados, extra: `${resumenVista.prendasConf ?? 0} prendas`, serie: spark(d => d.conf) },
            { t: 'Por confirmar',      v: String(resumenVista.pendientes),  c: '#EA580C', i: '⏳', d: comparacion?.pendientes, inv: true, extra: '', serie: spark(d => d.pend) },
            { t: 'Cancelados',         v: String(resumenVista.cancelados),  c: '#DC2626', i: '✖️', d: comparacion?.cancelados, inv: true, extra: '', serie: spark(d => d.canc) },
            { t: 'Valor vendido',      v: pesos(resumenVista.vendido),      c: '#0B6E4F', i: '💰', d: comparacion?.vendido, extra: '', serie: spark(d => d.valor) },
          ].map(k => {
            const d = k.d as number | null | undefined;
            const bueno = d == null ? false : k.inv ? d <= 0 : d >= 0;
            return (
              <div key={k.t} className={`${tarjeta} p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center text-base" style={{ background: `${k.c}14` }}>{k.i}</span>
                  <span className="text-[12px] text-[#4B5563] font-medium leading-tight">{k.t}</span>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-2xl font-extrabold leading-none" style={{ color: k.c }}>{k.v}</div>
                    {k.extra && <div className="text-[11px] font-semibold text-[#0E9C92] mt-1">👕 {k.extra}</div>}
                  </div>
                  <Sparkline valores={k.serie} color={k.c} />
                </div>
                {d != null && (
                  <div className={`text-[10.5px] font-bold mt-2 ${bueno ? 'text-[#15803D]' : 'text-[#DC2626]'}`}>
                    {d >= 0 ? '▲' : '▼'} {Math.abs(d)}% <span className="text-[#9A9A9A] font-normal">vs. período previo</span>
                  </div>
                )}
              </div>
            );
          })}
          {/* Tasa de confirmación con barra */}
          <div className={`${tarjeta} p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-xl flex items-center justify-center text-base bg-[#2F80ED]/10">🎯</span>
              <span className="text-[12px] text-[#4B5563] font-medium">Tasa de confirmación</span>
            </div>
            <div className="text-2xl font-extrabold leading-none text-[#2F80ED]">{resumenVista.tasa}%</div>
            <div className="text-[11px] text-[#2F80ED] mt-1">{resumenVista.confirmados} de {resumenVista.total} pedidos</div>
            <div className="h-2 rounded-full bg-[#EEF2F7] mt-2 overflow-hidden"><div className="h-full rounded-full bg-[#2F80ED]" style={{ width: `${resumenVista.tasa}%` }} /></div>
          </div>
        </div>

        {/* Gráfica principal + ventas por canal */}
        <div className="grid grid-cols-1 xl:grid-cols-10 gap-4 mb-5">
          <section className={`${tarjeta} p-4 xl:col-span-7`}>
            <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
              <div>
                <h2 className="text-[15px] font-extrabold text-[#0D0D0D]">📊 Ventas y prendas por {rangoGrafica === 'filtro' && porHora ? 'hora' : 'día'}</h2>
                <p className="text-[11px] text-[#6B6B6B]">{rangoGrafica === 'filtro' ? `Período: ${etiquetaRango}` : `Comparativo de los últimos ${rangoGrafica} días`}</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-[11px] text-[#4B5563]"><span className="w-2.5 h-2.5 rounded-full bg-[#0B6E4F]" /> Ventas (pedidos)</span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#4B5563]"><span className="w-2.5 h-2.5 rounded-full bg-[#3CC7BC]" /> Prendas</span>
                <select value={rangoGrafica} onChange={e => setRangoGrafica(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white">
                  <option value="7">Últimos 7 días</option>
                  <option value="15">Últimos 15 días</option>
                  <option value="30">Últimos 30 días</option>
                  <option value="filtro">Igual al filtro ({etiquetaRango})</option>
                </select>
              </div>
            </div>
            <BarrasDobles datos={datosGrafica} />
          </section>

          <section className={`${tarjeta} p-4 xl:col-span-3`}>
            <h2 className="text-[15px] font-extrabold text-[#0D0D0D]">🧭 Ventas por canal</h2>
            <p className="text-[11px] text-[#6B6B6B] mb-3">Pedidos y prendas · {etiquetaRango}</p>
            <div className="flex items-end justify-around gap-2 h-44 border-b border-[#EEF0F0] pb-1">
              {canalesGraf.map(c => (
                <div key={c.canal} className="flex items-end gap-1.5 h-full" title={`${c.label}: ${c.total} pedidos · ${c.prendas ?? 0} prendas`}>
                  {[{ v: c.total, col: '#0B6E4F' }, { v: c.prendas ?? 0, col: '#3CC7BC' }].map((b, k) => (
                    <div key={k} className="flex flex-col items-center justify-end h-full">
                      <span className="text-[11px] font-bold mb-0.5" style={{ color: b.col }}>{b.v}</span>
                      <div className="w-6 rounded-t-md qp-barra" style={{ height: `${(b.v / maxCanal) * 82}%`, minHeight: b.v ? 3 : 0, background: b.col }} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {canalesGraf.map(c => (
                <button key={c.canal} onClick={() => setCanal(c.canal as Canal)} className="text-left rounded-xl p-2 hover:bg-[#F6F8F8]">
                  <span className="text-base">{ICONO_CANAL[c.canal]}</span>
                  <p className="text-[11px] font-bold text-[#0D0D0D] leading-tight">{c.label}</p>
                  <p className="text-[10.5px] text-[#6B6B6B]">{c.total} pedidos</p>
                  <p className="text-[10.5px] text-[#0E9C92] font-semibold">{c.prendas ?? 0} prendas</p>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Fuente publicitaria · Canal · Estado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 mb-5">
          <section className={`${tarjeta} p-4`}>
            <h2 className="text-[15px] font-extrabold text-[#0D0D0D]">📣 Rendimiento por fuente publicitaria</h2>
            <p className="text-[11px] text-[#6B6B6B] mb-3">Atribución real por UTM del pedido.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr className="text-[10px] uppercase text-[#9A9A9A] border-b border-[#EEE]">
                  <th className="text-left py-1.5 font-semibold">Fuente</th>
                  <th className="text-right font-semibold">Pedidos</th>
                  <th className="text-right font-semibold">Prendas</th>
                  <th className="text-right font-semibold">Conf.</th>
                  <th className="text-left font-semibold pl-3">% Conf.</th>
                  <th className="text-right font-semibold">Valor</th>
                </tr></thead>
                <tbody>
                  {porFuente.map(f => (
                    <tr key={f.fuente} className="border-b border-[#F4F4F4] cursor-pointer hover:bg-[#FAFAFA]" onClick={() => setFuente(f.fuente)}>
                      <td className="py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {f.fuente === 'tiktok' ? <LogoTikTok /> : f.fuente === 'meta' ? <LogoFacebook /> : <span>{FUENTE_ICO[f.fuente] ?? ''}</span>}
                          {f.label}
                        </span>
                      </td>
                      <td className="text-right">{f.total}</td>
                      <td className="text-right text-[#0E9C92] font-semibold">{f.prendas ?? 0}</td>
                      <td className="text-right text-[#15803D] font-semibold">{f.confirmados}</td>
                      <td className="pl-3">
                        <span className="flex items-center gap-1.5">
                          <span className="w-9 text-right font-semibold" style={{ color: f.conversion >= 75 ? '#15803D' : f.conversion >= 55 ? '#B45309' : '#DC2626' }}>{f.conversion}%</span>
                          <span className="w-14 h-1.5 rounded-full bg-[#F0F0F0] overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${f.conversion}%`, background: f.conversion >= 75 ? '#15803D' : f.conversion >= 55 ? '#F59E0B' : '#DC2626' }} /></span>
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap">{pesos(f.valor)}</td>
                    </tr>
                  ))}
                  {porFuente.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-[#9A9A9A]">Sin datos en el período.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`${tarjeta} p-4`}>
            <h2 className="text-[15px] font-extrabold text-[#0D0D0D]">🏷️ Pedidos por canal de venta</h2>
            <p className="text-[11px] text-[#6B6B6B] mb-3">Origen del pedido (sin incluir Promociones).</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr className="text-[10px] uppercase text-[#9A9A9A] border-b border-[#EEE]">
                  <th className="text-left py-1.5 font-semibold">Canal</th>
                  <th className="text-right font-semibold">Pedidos</th>
                  <th className="text-right font-semibold">Prendas</th>
                  <th className="text-right font-semibold">Conf.</th>
                  <th className="text-right font-semibold">% Conf.</th>
                  <th className="text-right font-semibold">Valor</th>
                </tr></thead>
                <tbody>
                  {porCanal.map(c => (
                    <tr key={c.canal} className="border-b border-[#F4F4F4] cursor-pointer hover:bg-[#FAFAFA]"
                        onClick={() => setCanal((c.canal === 'sin_identificar' ? 'todas' : c.canal) as Canal)}>
                      <td className="py-2.5"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${CANAL_CHIP[c.canal] ?? ''}`}>{c.label}</span></td>
                      <td className="text-right">{c.total}</td>
                      <td className="text-right text-[#0E9C92] font-semibold">{c.prendas ?? 0}</td>
                      <td className="text-right text-[#15803D] font-semibold">{c.confirmados}</td>
                      <td className="text-right">{c.conversion}%</td>
                      <td className="text-right whitespace-nowrap">{pesos(c.valor)}</td>
                    </tr>
                  ))}
                  {porCanal.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-[#9A9A9A]">Sin datos en el período.</td></tr>}
                </tbody>
              </table>
            </div>
            {promoInfo.total > 0 && (
              <p className="text-[11px] text-[#9a6a00] mt-3 bg-[#fff8e6] border border-dashed border-[#f0d38a] rounded-lg px-3 py-2">
                🎟️ Promociones: {promoInfo.total} pedidos ({promoInfo.confirmados} confirmados) — <b>aparte</b>, no suman en estas estadísticas.
              </p>
            )}
          </section>

          <section className={`${tarjeta} p-4 lg:col-span-2 2xl:col-span-1`}>
            <h2 className="text-[15px] font-extrabold text-[#0D0D0D]">🍩 Estado de los pedidos</h2>
            <p className="text-[11px] text-[#6B6B6B] mb-3">{etiquetaRango}</p>
            <div className="flex items-center gap-5 flex-wrap">
              <Dona centro={String(resumenVista.total)} sub="Pedidos" partes={[
                { valor: resumenVista.confirmados, color: '#15803D' },
                { valor: resumenVista.pendientes, color: '#F59E0B' },
                { valor: resumenVista.cancelados, color: '#DC2626' },
              ]} />
              <div className="flex-1 min-w-[160px] space-y-2.5 text-[12px]">
                {[
                  ['Confirmados', resumenVista.confirmados, '#15803D'],
                  ['Por confirmar', resumenVista.pendientes, '#F59E0B'],
                  ['Cancelados', resumenVista.cancelados, '#DC2626'],
                ].map(([t, v, c]) => (
                  <div key={t as string} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c as string }} />
                    <span className="flex-1 text-[#4B5563]">{t}</span>
                    <b className="w-8 text-right">{v as number}</b>
                    <span className="w-10 text-right text-[#9A9A9A]">{resumenVista.total ? Math.round(((v as number) / resumenVista.total) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Barra de selección */}
        {seleccion.size > 0 && (
          <div className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-xl bg-[#0D0D0D] text-white shadow-lg flex-wrap">
            <span className="text-xs font-semibold">
              {seleccion.size} {seleccion.size === 1 ? 'pedido seleccionado' : 'pedidos seleccionados'}
              <span className="hidden md:inline text-white/50 font-normal ml-2">
                · Shift + clic para marcar un rango
              </span>
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setConfirmar('cancelar')}
                className="px-3 py-1.5 rounded-lg bg-[#EA580C] text-white text-xs font-semibold hover:bg-[#c2410c]"
              >✖️ Cancelar</button>
              <button
                onClick={() => setConfirmar('eliminar')}
                className="px-3 py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-semibold hover:bg-[#b91c1c]"
              >🗑️ Eliminar</button>
              <button
                onClick={() => setSeleccion(new Set())}
                className="px-3 py-1.5 rounded-lg border border-white/30 text-xs hover:bg-white/10"
              >Quitar selección</button>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="flex items-end justify-between gap-2 mb-2 flex-wrap">
          <div>
            <h2 className="text-[15px] font-extrabold text-[#0D0D0D]">🧾 Últimos pedidos</h2>
            <p className="text-[11px] text-[#6B6B6B]">{filtrados.length} pedidos · {filtrados.reduce((a, p) => a + (p.prendas ?? 1), 0)} prendas · {etiquetaRango}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-visible">
          {cargando ? (
            <div className="divide-y divide-[#F0F0F0]">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-[#FAFAFA] animate-pulse" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-[#6B6B6B] py-12 text-center px-6">
              {canal === 'embudos'
                ? 'Todavía no hay ventas desde tus embudos de QuinChat en este período.'
                : canal === 'funnelish'
                ? 'Todavía no hay ventas desde Funnelish en este período.'
                : canal === 'whatsapp'
                ? 'Todavía no hay ventas del bot de WhatsApp en este período.'
                : canal === 'promociones'
                ? 'Todavía no hay ventas de Promociones en este período.'
                : 'No hay ventas en este período.'}
            </p>
          ) : (
            <>
              {/* Encabezado de columnas */}
              <div className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-[#FAFAFA] border-b border-[#EEE] text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wide">
                <span className="w-5 shrink-0">
                  <input
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={() => setSeleccion(todosMarcados ? new Set() : new Set(filtrados.map(p => p.id)))}
                    className="w-4 h-4 accent-[#00A89D] cursor-pointer align-middle"
                  />
                </span>
                <span className="w-24 shrink-0">Fecha / hora</span>
                <span className="w-28 shrink-0">Estado</span>
                <span className="w-10 shrink-0" />
                <span className="flex-1 min-w-0">Cliente</span>
                <span className="flex-1 min-w-0">Producto</span>
                <span className="hidden lg:block w-28 shrink-0">Talla / color</span>
                <span className="w-36 shrink-0">Canal</span>
                <span className="hidden xl:block w-36 shrink-0">Campaña</span>
                <span className="w-14 text-center shrink-0">Prendas</span>
                <span className="w-24 text-right shrink-0">Valor</span>
                <span className="w-16 text-center shrink-0">Acciones</span>
              </div>

              <div className="divide-y divide-[#F4F4F4]">
                {filtrados.slice(0, visibles).map((p, indice) => {
                  const est   = estadoDe(p);
                  const total = aNumero(p.valor);
                  const marcado = seleccion.has(p.id);

                  return (
                    <div
                      key={p.id}
                      onClick={() => abrirDetalle(p)}
                      className={`group relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        marcado ? 'bg-[#00A89D]/[0.07]' : 'hover:bg-[#FAFAFA]'
                      }`}
                    >
                      {/* Franja de color según el estado */}
                      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: est.color }} />

                      <span className="w-5 shrink-0" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={marcado}
                          onClick={e => alternar(indice, (e as MouseEvent).shiftKey)}
                          onChange={() => { /* el clic ya lo maneja */ }}
                          className="w-4 h-4 accent-[#00A89D] cursor-pointer align-middle"
                        />
                      </span>

                      <span className="hidden md:block w-24 shrink-0 text-[11px] text-[#9A9A9A]">
                        {cuando(p.created_at)}
                      </span>

                      <span className="hidden md:block w-28 shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block"
                              style={{ color: est.color, background: est.fondo }}>{est.texto}</span>
                      </span>

                      {/* Miniatura del producto */}
                      <span className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-[#F2F2F2] flex items-center justify-center">
                        {p.foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imgOptim(p.foto, 96)} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-sm text-[#C9C9C9]">🛍️</span>
                        )}
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-[#0D0D0D] truncate">
                          {p.nombre || '—'}
                        </span>
                        <span className="md:hidden flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ color: est.color, background: est.fondo }}>{est.texto}</span>
                          <span className="text-[10px] text-[#9A9A9A]">{cuando(p.created_at)}</span>
                        </span>
                        <span className="md:hidden block text-[11px] text-[#6B6B6B] truncate mt-0.5">
                          {p.producto} · {p.talla || 'sin talla'}
                        </span>
                        {p.utm_campaign && (
                          <span className="md:hidden flex items-center gap-1 text-[10px] font-semibold text-[#6D28D9] truncate mt-0.5">
                            {p.plataforma === 'facebook' && <LogoFacebook />}
                            {p.plataforma === 'tiktok' && <LogoTikTok />}
                            {!p.plataforma && '🎯'}
                            <span className="truncate">{p.campana_nombre || p.utm_campaign}</span>
                          </span>
                        )}
                        {p.embudo_slug && (
                          <a
                            href={`https://pedido.klixmant.shop/${p.embudo_slug}`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="md:hidden block text-[10px] font-semibold text-[#00847A] truncate mt-0.5 hover:underline"
                          >🚀 {p.embudo_nombre || p.embudo_slug} ↗</a>
                        )}
                      </span>

                      <span className="hidden md:block flex-1 min-w-0">
                        <span className="block text-[12px] text-[#0D0D0D] truncate">{String(p.producto ?? '').split(' - ')[0]}</span>
                        <span className="lg:hidden block text-[11px] text-[#9A9A9A] truncate">{tallaColor(p)}</span>
                        {p.abono > 0 && (
                          <span className="block text-[10.5px] text-[#9A9A9A]">abono {p.abono_recibido ? '✅' : '⏳'}</span>
                        )}
                      </span>

                      <span className="hidden lg:block w-28 shrink-0 text-[11.5px] text-[#4B5563] truncate" title={tallaColor(p)}>
                        {tallaColor(p)}
                      </span>

                      {/* Canal + embudo del que vino (ver / editar) */}
                      <span className="hidden md:flex w-36 shrink-0 min-w-0 flex-col items-start gap-1">
                        <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${CANAL_CHIP[p.canal ?? ''] ?? 'bg-[#F2F2F2] text-[#6B6B6B]'}`}>
                          {p.canal === 'embudos' ? 'Embudos QuinChat' : p.canal === 'funnelish' ? 'Funnelish' : p.canal === 'whatsapp' ? 'WhatsApp (bot)' : p.canal === 'promociones' ? 'Promociones' : 'Sin identificar'}
                        </span>
                        {p.embudo_slug && (
                        <span className="flex items-center gap-1 max-w-full min-w-0">
                            <a
                              href={`https://pedido.klixmant.shop/${p.embudo_slug}`}
                              target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              title={`Ver en vista previa: ${p.embudo_nombre || p.embudo_slug}`}
                              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#00847A] bg-[#00A89D]/10 rounded-lg px-1.5 py-0.5 hover:bg-[#00A89D]/20 min-w-0 truncate"
                            >🚀 <span className="truncate">{p.embudo_nombre || p.embudo_slug}</span> ↗</a>
                            {onEditarEmbudo && (
                              <button
                                onClick={e => { e.stopPropagation(); onEditarEmbudo(p.embudo_slug!); }}
                                title={`Editar embudo: ${p.embudo_nombre || p.embudo_slug}`}
                                className="shrink-0 text-[11px] rounded-lg px-1.5 py-1 border border-[#E8E8E8] hover:bg-[#F5F5F5]"
                              >✏️</button>
                            )}
                        </span>
                        )}
                      </span>

                      <span className="hidden xl:flex w-36 shrink-0 flex-col gap-0.5 min-w-0">
                        <span className="flex items-center gap-1.5 min-w-0">
                          {p.plataforma === 'facebook' && <LogoFacebook />}
                          {p.plataforma === 'tiktok' && <LogoTikTok />}
                          {p.utm_campaign ? (
                            <span
                              className="truncate text-[11px] font-semibold text-[#6D28D9]"
                              title={`${p.campana_nombre || p.utm_campaign}${p.utm_source ? ` · ${p.utm_source}` : ''}`}
                            >{p.campana_nombre || p.utm_campaign}</span>
                          ) : (
                            <span className="text-[11px] text-[#C9C9C9]">Directo</span>
                          )}
                        </span>
                      </span>

                      <span className="hidden md:block w-14 text-center shrink-0">
                        <span className="inline-block min-w-[28px] px-1.5 py-0.5 rounded-full bg-[#3CC7BC]/15 text-[#0E7C74] text-[12px] font-extrabold">{p.prendas ?? 1}</span>
                      </span>

                      <span className="w-24 text-right shrink-0 text-sm font-bold text-[#0D0D0D]">
                        {pesos(total)}
                        <span className="md:hidden block text-[10px] font-semibold text-[#0E7C74]">{p.prendas ?? 1} {(p.prendas ?? 1) === 1 ? 'prenda' : 'prendas'}</span>
                      </span>

                      {/* WhatsApp: abre el chat dentro de QuinChat */}
                      <span className="hidden md:flex w-8 shrink-0 justify-center" onClick={e => e.stopPropagation()}>
                        {String(p.telefono ?? '').replace(/\D/g, '').length >= 10 && (
                          <button
                            onClick={() => {
                              const t = String(p.telefono ?? '').replace(/\D/g, '').slice(-10);
                              if (onAbrirChat) onAbrirChat(`57${t}`); else window.open(`https://wa.me/57${t}`, '_blank');
                            }}
                            title="Abrir el chat del cliente"
                            className="w-7 h-7 rounded-lg bg-[#25D366]/12 text-[#128C4B] hover:bg-[#25D366]/25 text-sm"
                          >💬</button>
                        )}
                      </span>

                      {/* Menú de la fila */}
                      <span className="w-8 shrink-0 relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setMenu(menu === p.id ? null : p.id)}
                          className="w-7 h-7 rounded-lg text-[#9A9A9A] hover:bg-[#EEE] hover:text-[#0D0D0D]"
                          title="Opciones"
                        >⋮</button>

                        {menu === p.id && (
                          <>
                            <span className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                            {/* En las últimas filas el menú se abre hacia arriba para que no quede tapado */}
                            <span className={`absolute right-0 z-20 w-44 bg-white rounded-xl border border-[#E8E8E8] shadow-xl overflow-hidden block ${
                              indice >= Math.min(visibles, filtrados.length) - 2 ? 'bottom-8' : 'top-8'
                            }`}>
                              <button
                                onClick={() => { setMenu(null); abrirDetalle(p); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5]"
                              >👁️ Ver detalle</button>
                              {String(p.estado).toLowerCase() === 'cancelado' ? (
                                <button
                                  onClick={() => ejecutar('restaurar', [p.id])}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5]"
                                >↩️ Reactivar pedido</button>
                              ) : (
                                <button
                                  onClick={() => ejecutar('cancelar', [p.id])}
                                  className="w-full text-left px-3 py-2 text-xs text-[#EA580C] hover:bg-[#EA580C]/10"
                                >✖️ Cancelar pedido</button>
                              )}
                              <button
                                onClick={() => { setSeleccion(new Set([p.id])); setMenu(null); setConfirmar('eliminar'); }}
                                className="w-full text-left px-3 py-2 text-xs text-[#DC2626] hover:bg-[#DC2626]/10 border-t border-[#F0F0F0]"
                              >🗑️ Eliminar de la lista</button>
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
              {filtrados.length > visibles && (
                <button
                  onClick={() => setVisibles(v => v + PASO_LISTA)}
                  className="w-full py-3 text-xs font-semibold text-[#00847A] hover:bg-[#00A89D]/5 border-t border-[#F0F0F0]"
                >▼ Ver más pedidos ({filtrados.length - visibles} restantes)</button>
              )}
            </>
          )}
        </div>

        {/* Confirmación */}
        {confirmar && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
               onClick={() => !trabajando && setConfirmar(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold mb-1">
                {confirmar === 'eliminar' ? '¿Eliminar definitivamente?' : '¿Cancelar estos pedidos?'}
              </h3>
              <p className="text-xs text-[#6B6B6B] leading-relaxed mb-4">
                {confirmar === 'eliminar'
                  ? `Se borrarán ${seleccion.size} ${seleccion.size === 1 ? 'pedido' : 'pedidos'} y dejarán de contar en las estadísticas. Esto no se puede deshacer.`
                  : `Quedarán marcados como cancelados y no sumarán a lo vendido. Los puedes reactivar después.`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmar(null)}
                  disabled={trabajando}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-sm hover:bg-[#F5F5F5] disabled:opacity-50"
                >Volver</button>
                <button
                  onClick={() => ejecutar(confirmar)}
                  disabled={trabajando}
                  className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 ${
                    confirmar === 'eliminar' ? 'bg-[#DC2626] hover:bg-[#b91c1c]' : 'bg-[#EA580C] hover:bg-[#c2410c]'
                  }`}
                >{trabajando ? 'Un momento…' : confirmar === 'eliminar' ? 'Sí, eliminar' : 'Sí, cancelar'}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ventana con todo el detalle del pedido */}
      {detalle && (() => {
        const est   = estadoDe(detalle);
        const total = aNumero(detalle.valor);
        const abono = Number(detalle.abono ?? 0);
        const tel10 = String(detalle.telefono ?? '').replace(/\D/g, '').slice(-10);
        // La selección viene junta: "AZUL RED BULL / ROJO RED BULL / M HOMBRE"
        const partes = String(detalle.talla ?? '').split('/').map(s => s.trim()).filter(Boolean);

        const Dato = ({ t, v }: { t: string; v: any }) => (
          <div className="flex gap-2 py-1.5 border-b border-[#F5F5F5] last:border-0">
            <span className="text-[11px] text-[#6B6B6B] w-24 shrink-0">{t}</span>
            <span className="text-[12px] text-[#0D0D0D] flex-1 break-words">{v || '—'}</span>
          </div>
        );

        return (
          <div
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4"
            onClick={() => setDetalle(null)}
          >
            <div
              className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Encabezado */}
              <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-[#E8E8E8] shrink-0">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#0D0D0D] truncate">{detalle.nombre || '—'}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: est.color, background: est.fondo }}>{est.texto}</span>
                    <span className="text-[10px] text-[#9A9A9A]">{cuando(detalle.created_at)}</span>
                  </div>
                </div>
                <button onClick={() => setDetalle(null)} className="text-[#6B6B6B] hover:text-[#0D0D0D] text-lg w-8 h-8 shrink-0">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {/* Producto */}
                <div className="mb-4">
                  <p className="text-[11px] font-bold text-[#6B6B6B] uppercase mb-2">Producto</p>

                  {cargandoDet ? (
                    <div className="h-24 rounded-xl bg-[#F5F5F5] animate-pulse" />
                  ) : fotos.length > 0 ? (
                    <div className="flex gap-2 mb-2.5 overflow-x-auto">
                      {fotos.map((f, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={imgOptim(f, 300)} alt="" className="w-24 h-24 rounded-xl object-cover border border-[#E8E8E8] shrink-0" />
                      ))}
                    </div>
                  ) : null}

                  <p className="text-sm font-semibold text-[#0D0D0D] leading-snug">{detalle.producto}</p>

                  {partes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {partes.map((t, i) => (
                        <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#00A89D]/10 text-[#00847A]">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cobro */}
                <div className="mb-4 rounded-xl border border-[#E8E8E8] overflow-hidden">
                  <div className="flex justify-between px-3 py-2 text-[12px] border-b border-[#F5F5F5]">
                    <span className="text-[#6B6B6B]">Total</span>
                    <span className="font-semibold">{pesos(total)}</span>
                  </div>
                  {abono > 0 && (
                    <div className="flex justify-between px-3 py-2 text-[12px] border-b border-[#F5F5F5]">
                      <span className="text-[#6B6B6B]">
                        Abono {detalle.abono_recibido ? '✅ recibido' : '⏳ pendiente'}
                      </span>
                      <span className="font-semibold text-[#EA580C]">− {pesos(abono)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-3 py-2.5 bg-[#FAFAFA]">
                    <span className="text-[12px] font-bold">COBRAR</span>
                    <span className="text-sm font-bold text-[#15803D]">{pesos(total - abono)}</span>
                  </div>
                </div>

                {/* Envío */}
                <p className="text-[11px] font-bold text-[#6B6B6B] uppercase mb-1">Datos de envío</p>
                <div className="mb-4">
                  <Dato t="Teléfono"    v={detalle.telefono} />
                  <Dato t="Dirección"   v={detalle.direccion} />
                  <Dato t="Ciudad"      v={`${detalle.ciudad ?? ''} — ${detalle.departamento ?? ''}`} />
                  <Dato t="Correo"      v={detalle.correo} />
                </div>

                {/* Origen */}
                {(detalle.utm_campaign || detalle.utm_source) && (
                  <>
                    <p className="text-[11px] font-bold text-[#6B6B6B] uppercase mb-1">De dónde vino</p>
                    <div className="mb-2">
                      <Dato t="Campaña"  v={detalle.utm_campaign} />
                      <Dato t="Fuente"   v={detalle.utm_source} />
                    </div>
                  </>
                )}

                <p className="text-[10px] text-[#C9C9C9] mt-3">Referencia: {detalle.referencia}</p>
              </div>

              {/* Acciones */}
              <div className="px-5 py-3 border-t border-[#E8E8E8] shrink-0 flex gap-2">
                <button
                  onClick={() => {
                    setDetalle(null);
                    // El chat vive en el panel: no hace falta salir a WhatsApp
                    if (onAbrirChat) onAbrirChat(`57${tel10}`);
                    else window.open(`https://wa.me/57${tel10}`, '_blank');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold text-center hover:bg-[#00847A]"
                >💬 Abrir el chat</button>
                <button
                  onClick={() => { navigator.clipboard?.writeText(
                    `${detalle.nombre}\n${detalle.telefono}\n${detalle.direccion}\n${detalle.ciudad} — ${detalle.departamento}\n${detalle.producto}\n${detalle.talla}\nCobrar: ${pesos(total - abono)}`
                  ); }}
                  title="Copiar los datos del pedido"
                  className="px-4 py-2.5 rounded-xl border border-[#E8E8E8] text-sm hover:bg-[#F5F5F5]"
                >📋</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

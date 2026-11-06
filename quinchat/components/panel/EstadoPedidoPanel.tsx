'use client';

import { useCallback, useEffect, useState } from 'react';

type Grupo = 'generada' | 'transito' | 'oficina' | 'entregada' | 'devuelta' | 'novedad' | 'anulada';
interface Guia {
  id_effi: string; guia: string | null; transportadora: string | null; estado: string | null; estado_efficommerce: string | null;
  telefono: string | null; nombre: string | null; ciudad: string | null; departamento: string | null;
  valor_recaudo: number | null; fecha_trans: string | null; fecha_estado_final: string | null; url_guia: string | null; grupo: Grupo;
}

const GRUPOS: { k: Grupo | 'todas'; t: string; i: string; c: string }[] = [
  { k: 'todas',     t: 'Todas',        i: '📦', c: '#0D0D0D' },
  { k: 'generada',  t: 'Generadas',    i: '🧾', c: '#6B7280' },
  { k: 'transito',  t: 'En tránsito',  i: '🚚', c: '#2F80ED' },
  { k: 'oficina',   t: 'En oficina',   i: '🏢', c: '#CA8A04' },
  { k: 'entregada', t: 'Entregadas',   i: '✅', c: '#15803D' },
  { k: 'devuelta',  t: 'Devueltas',    i: '↩️', c: '#DC2626' },
  { k: 'novedad',   t: 'Novedad',      i: '⚠️', c: '#EA580C' },
  { k: 'anulada',   t: 'Anuladas',     i: '🚫', c: '#9A9A9A' },
];
const pesos = (n: number | null) => (n ? `$${Math.round(n).toLocaleString('es-CO')}` : '—');
const fecha = (s: string | null) => (s ? new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—');
const hoy = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
const haceDias = (d: number) => new Date(Date.now() - 5 * 3600_000 - d * 86400_000).toISOString().slice(0, 10);

/**
 * ESTADO DE PEDIDO: guías de Effi agrupadas (generadas, en tránsito, en oficina,
 * entregadas, devueltas…) + interruptor del descuento de $15.000 por entrega.
 * Los datos salen de la última «Sincronización con Effi».
 */
export default function EstadoPedidoPanel({ onAbrirChat }: { onAbrirChat?: (id: string) => void }) {
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState<{ conteo: Record<Grupo, number>; guias: Guia[]; total: number; ultimaSync: any } | null>(null);
  const [filtro, setFiltro] = useState<Grupo | 'todas'>('todas');
  const [busca, setBusca] = useState('');
  const [cargando, setCargando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [desc, setDesc] = useState<any>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`/api/pedidos/estado-guias?desde=${haceDias(dias)}&hasta=${hoy()}`, { cache: 'no-store' });
      if (r.ok) setDatos(await r.json());
    } finally { setCargando(false); }
  }, [dias]);
  const cargarDesc = useCallback(() => {
    fetch('/api/pedidos/descuento-entrega', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => d && setDesc(d)).catch(() => {});
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarDesc(); }, [cargarDesc]);

  async function sincronizar() {
    setSincronizando(true);
    try { await fetch('/api/seguimiento/effi/sync', { method: 'POST' }); await cargar(); cargarDesc(); }
    finally { setSincronizando(false); }
  }
  async function alternarDescuento() {
    if (!desc) return;
    const r = await fetch('/api/pedidos/descuento-entrega', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !desc.activo }),
    });
    if (r.ok) cargarDesc();
  }

  const lista = (datos?.guias ?? []).filter(g => {
    if (filtro !== 'todas' && g.grupo !== filtro) return false;
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    const dig = q.replace(/\D/g, '');
    return [g.nombre, g.ciudad, g.guia, g.estado].some(x => String(x ?? '').toLowerCase().includes(q))
      || (dig.length >= 6 && String(g.telefono ?? '').includes(dig));
  });
  const tarjeta = 'bg-white rounded-2xl border border-[#EDEFEF] shadow-[0_1px_3px_rgba(16,24,40,.04)]';
  const plantillaOk = desc?.plantillaEstado === 'APPROVED' && (!desc?.pideFoto || !!desc?.foto);
  const [subiendo, setSubiendo] = useState(false);
  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !desc) return;
    setSubiendo(true);
    try {
      const base64 = await new Promise<string>((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = mal; r.readAsDataURL(f); });
      await fetch('/api/plantillas-wa/imagen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: desc.plantilla, imagenBase64: base64, imagenMime: f.type || 'image/jpeg' }),
      });
      cargarDesc();
    } finally { setSubiendo(false); e.target.value = ''; }
  }

  return (
    <div className="space-y-4">
      {/* Encabezado: rango + sincronizar */}
      <div className={`${tarjeta} px-4 py-3 flex items-center gap-2 flex-wrap`}>
        <span className="text-[11px] font-bold text-[#6B6B6B]">Guías creadas en:</span>
        {[7, 15, 30, 60].map(d => (
          <button key={d} onClick={() => setDias(d)}
            className={`px-3 py-1.5 rounded-lg text-xs border ${dias === d ? 'bg-[#00A89D] text-white border-[#00A89D] font-semibold' : 'bg-white border-[#E8E8E8] hover:border-[#00A89D]'}`}>
            {d} días
          </button>
        ))}
        <button onClick={sincronizar} disabled={sincronizando}
          className="ml-auto px-3 py-1.5 rounded-lg border-2 border-[#00A89D] text-[#00847A] text-xs font-semibold hover:bg-[#00A89D]/10 disabled:opacity-60">
          {sincronizando ? '⏳ Sincronizando…' : '🔄 Sincronizar con Effi'}
        </button>
        {datos?.ultimaSync?.inicio && (
          <span className="w-full text-[10px] text-[#9A9A9A]">
            Última sincronización: {new Date(datos.ultimaSync.inicio).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Contadores por estado */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        {GRUPOS.map(g => {
          const n = g.k === 'todas' ? (datos?.total ?? 0) : (datos?.conteo?.[g.k] ?? 0);
          return (
            <button key={g.k} onClick={() => setFiltro(g.k)}
              className={`${tarjeta} p-3 text-left transition-all ${filtro === g.k ? 'ring-2 ring-[#00A89D]/40 border-[#00A89D]' : 'hover:border-[#CCC]'}`}>
              <p className="text-[10px] text-[#9A9A9A] uppercase font-bold">{g.i} {g.t}</p>
              <p className="text-2xl font-extrabold" style={{ color: g.c }}>{n}</p>
            </button>
          );
        })}
      </div>

      {/* Descuento por entrega */}
      {desc && (
        <div className={`${tarjeta} px-4 py-3 flex items-center gap-3 flex-wrap`}>
          <span className="text-sm font-bold text-[#0D0D0D]">🎁 Descuento de $15.000 por entrega</span>
          <button onClick={alternarDescuento} disabled={!plantillaOk && !desc.activo}
            title={plantillaOk ? '' : `La plantilla «${desc.plantilla}» todavía no está aprobada (${desc.plantillaEstado})`}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50 ${desc.activo ? 'bg-[#15803D] text-white border-[#15803D]' : 'bg-white text-[#6B6B6B] border-[#E8E8E8] hover:bg-[#F5F5F5]'}`}>
            {desc.activo ? 'ENCENDIDO' : 'APAGADO'}
          </button>
          <span className="text-[11px] text-[#6B6B6B]">
            Plantilla <b>{desc.plantilla}</b>: {plantillaOk ? '✅ aprobada' : `⚠️ ${desc.plantillaEstado === 'no existe' ? 'falta crearla' : desc.plantillaEstado}`}
            {' · '}{desc.enviados} enviados
          </span>
          {desc.pideFoto && (
            <span className="flex items-center gap-2 text-[11px] text-[#6B6B6B]">
              {desc.foto
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={desc.foto} alt="Foto de la plantilla" className="w-10 h-10 rounded-lg object-cover border border-[#E8E8E8]" />
                : <span className="text-[#DC2626] font-semibold">⚠️ Falta la foto</span>}
              <label className="px-2.5 py-1 rounded-lg border border-[#E8E8E8] cursor-pointer hover:bg-[#F5F5F5] font-semibold">
                {subiendo ? 'Subiendo…' : desc.foto ? 'Cambiar foto' : 'Subir foto'}
                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={subirFoto} />
              </label>
            </span>
          )}
          <span className="w-full text-[10px] text-[#9A9A9A]">
            Al sincronizar con Effi, a cada guía que quede ENTREGADA (desde que lo enciendas) le llega la plantilla una sola vez;
            máximo un descuento por cliente cada 30 días y nunca a quien respondió SALIR. Su chat queda con la etiqueta «BONO».
          </span>
        </div>
      )}

      {/* Lista */}
      <div className={`${tarjeta} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-[#F0F0F0] flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-[#0D0D0D]">{GRUPOS.find(g => g.k === filtro)?.i} {GRUPOS.find(g => g.k === filtro)?.t}</span>
          <span className="text-[11px] text-[#9A9A9A]">{lista.length} guías</span>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔎 Buscar nombre, teléfono, ciudad, guía…"
            className="ml-auto px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs w-full sm:w-72 focus:outline-none focus:border-[#00A89D]" />
        </div>
        {cargando ? (
          <p className="text-sm text-[#6B6B6B] py-10 text-center">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-[#6B6B6B] py-10 text-center">No hay guías en este estado.</p>
        ) : (
          <div className="divide-y divide-[#F3F3F3]">
            {lista.slice(0, 300).map(g => {
              const gr = GRUPOS.find(x => x.k === g.grupo)!;
              return (
                <div key={g.id_effi} className="px-4 py-2.5 flex items-center gap-3 flex-wrap text-xs">
                  <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] shrink-0" style={{ color: gr.c, background: `${gr.c}14` }}>{gr.i} {gr.t}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#0D0D0D] truncate">{g.nombre || 'Sin nombre'} <span className="font-mono font-normal text-[#00847A]">{g.telefono}</span></p>
                    <p className="text-[11px] text-[#6B6B6B] truncate">
                      {g.ciudad}{g.departamento ? `, ${g.departamento}` : ''} · {g.transportadora || '—'} · Guía {g.guia || '—'} · {g.estado || g.estado_efficommerce}
                    </p>
                  </div>
                  <span className="text-[11px] text-[#6B6B6B] shrink-0">{fecha(g.fecha_trans)}</span>
                  <span className="text-[11px] font-semibold text-[#0D0D0D] shrink-0 w-20 text-right">{pesos(g.valor_recaudo)}</span>
                  {g.telefono && onAbrirChat && (
                    <button onClick={() => onAbrirChat(`57${g.telefono}`)}
                      className="px-2.5 py-1 rounded-lg bg-[#00A89D] text-white text-[11px] font-semibold hover:bg-[#00847A] shrink-0">💬 Chat</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

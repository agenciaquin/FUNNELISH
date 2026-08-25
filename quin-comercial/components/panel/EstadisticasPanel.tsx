'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { ETIQUETAS_FIJAS } from '@/lib/panel/types';
import type { Conversation } from '@/lib/panel/types';

interface Barra {
  nombre: string;
  color: string;
  cantidad: number;
}

function hoyISO() { return new Date().toISOString().slice(0, 10); }
function haceDiasISO(d: number) {
  const f = new Date(); f.setDate(f.getDate() - d);
  return f.toISOString().slice(0, 10);
}
const aNumero = (v: any) => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;

export default function EstadisticasPanel() {
  const [convs, setConvs]     = useState<Conversation[]>([]);
  const [ventas, setVentas]   = useState<{ valor: string; confirmado_at: string; estado: string | null }[]>([]);
  // Filtro de línea: todos | funnel | ventas (WhatsApp)
  const [lineaFiltro, setLineaFiltro] = useState<'todos' | 'funnel' | 'ventas'>('todos');
  const [pedidos, setPedidos] = useState<{ created_at: string; confirmado: boolean; estado: string | null }[]>([]);
  const [cargando, setCargando] = useState(true);

  // Rango de fechas: por defecto los últimos 7 días
  const [desde, setDesde] = useState(haceDiasISO(6));
  const [hasta, setHasta] = useState(hoyISO());
  const [todoElTiempo, setTodoElTiempo] = useState(false);

  const supabase = createBrowserSupabaseClient();

  const cargar = useCallback(async () => {
    // Conversaciones: se filtran por su última actividad
    let q = supabase.from('conversations').select('*');
    if (!todoElTiempo) {
      q = q.gte('last_message_time', `${desde}T00:00:00`)
           .lte('last_message_time', `${hasta}T23:59:59`);
    }
    const { data } = await q;
    setConvs(data ?? []);

    // Ventas confirmadas: se cuentan por el día en que se confirmaron
    let v = supabase
      .from('clientes_funnelish')
      .select('valor, confirmado_at, estado')
      .eq('confirmado', true)
      .not('confirmado_at', 'is', null);
    if (!todoElTiempo) {
      v = v.gte('confirmado_at', `${desde}T00:00:00`)
           .lte('confirmado_at', `${hasta}T23:59:59`);
    }
    const { data: dv } = await v;
    setVentas(dv ?? []);

    // Todos los pedidos del período (por el día en que entraron): sirve para
    // el gráfico diario de confirmadas / pendientes / canceladas.
    let p = supabase
      .from('clientes_funnelish')
      .select('created_at, confirmado, estado');
    if (!todoElTiempo) {
      p = p.gte('created_at', `${desde}T00:00:00`)
           .lte('created_at', `${hasta}T23:59:59`);
    }
    const { data: dp } = await p;
    setPedidos(dp ?? []);

    setCargando(false);
  }, [desde, hasta, todoElTiempo]);

  useEffect(() => {
    cargar();
    const ch = supabase
      .channel('estadisticas-conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => cargar())
      .subscribe();
    const t = setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [cargar]);

  // ── Filtro por línea (Funnel vs WhatsApp) ──────────────────────────────────
  // Conversaciones: por su campo `linea`. Pedidos: los de WhatsApp tienen el
  // estado empezando en "wa_" (bot de ventas o venta manual); el resto es Funnel.
  const esWA = (estado: any) => String(estado ?? '').toLowerCase().startsWith('wa');
  const convsF = lineaFiltro === 'todos'
    ? convs
    : convs.filter(c => lineaFiltro === 'ventas' ? (c as any).linea === 'ventas' : (c as any).linea !== 'ventas');
  const ventasF = lineaFiltro === 'todos'
    ? ventas
    : ventas.filter(v => lineaFiltro === 'ventas' ? esWA(v.estado) : !esWA(v.estado));
  const pedidosF = lineaFiltro === 'todos'
    ? pedidos
    : pedidos.filter(p => lineaFiltro === 'ventas' ? esWA(p.estado) : !esWA(p.estado));

  // Una conversación puede tener varias etiquetas: cuenta en todas las que tenga.
  const barras: Barra[] = ETIQUETAS_FIJAS.map(e => ({
    nombre: e.nombre,
    color: e.color,
    cantidad: convsF.filter(c => (c.label ?? '').toUpperCase().includes(e.nombre.toUpperCase())).length,
  }));

  const sinEtiqueta = convsF.filter(c => !c.label || c.label.trim() === '').length;
  if (sinEtiqueta > 0) barras.push({ nombre: 'SIN ETIQUETA', color: '#94A3B8', cantidad: sinEtiqueta });

  const maximo    = Math.max(1, ...barras.map(b => b.cantidad));
  const total     = convsF.length;
  const noLeidos  = convsF.filter(c => (c.unread_count ?? 0) > 0).length;

  // Las ventas se cuentan por su fecha de confirmación, no por la etiqueta
  const confirmadas = ventasF.length;
  const facturado   = ventasF.reduce((s, v) => s + aNumero(v.valor), 0);
  const pendConf    = barras.find(b => b.nombre === 'PENDIENTE POR CONFIRMACIÓN')?.cantidad ?? 0;
  const tasa = confirmadas + pendConf > 0
    ? Math.round((confirmadas / (confirmadas + pendConf)) * 100) : 0;

  const tarjetas = [
    { titulo: 'Conversaciones',    valor: String(total),       color: '#00847A', icono: '💬' },
    { titulo: 'Ventas confirmadas', valor: String(confirmadas), color: '#15803D', icono: '✅' },
    { titulo: 'Por confirmar',     valor: String(pendConf),    color: '#8B5CF6', icono: '⏳' },
    { titulo: 'Vendido',           valor: `$${facturado.toLocaleString('es-CO')}`, color: '#0D8A3E', icono: '💰' },
    { titulo: 'Sin leer',          valor: String(noLeidos),    color: '#38BDF8', icono: '🔔' },
  ];

  // Ventas por día, para ver cómo se movió la semana
  const porDia = (() => {
    const m = new Map<string, number>();
    for (const v of ventasF) {
      const dia = String(v.confirmado_at ?? '').slice(0, 10);
      if (dia) m.set(dia, (m.get(dia) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  })();
  const maxDia = Math.max(1, ...porDia.map(([, n]) => n));

  // Confirmadas / Pendientes / Canceladas por día.
  // Todo lo que no esté confirmado ni cancelado cuenta como pendiente.
  const porDiaEstado = (() => {
    const m = new Map<string, { conf: number; pend: number; canc: number }>();
    for (const p of pedidosF) {
      const dia = String(p.created_at ?? '').slice(0, 10);
      if (!dia) continue;
      if (!m.has(dia)) m.set(dia, { conf: 0, pend: 0, canc: 0 });
      const b = m.get(dia)!;
      const cancelado = String(p.estado ?? '').toLowerCase() === 'cancelado';
      if (p.confirmado)      b.conf++;
      else if (cancelado)    b.canc++;
      else                   b.pend++;   // el resto de etiquetas se suma aquí
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  })();
  const maxEstado = Math.max(1, ...porDiaEstado.map(([, b]) => Math.max(b.conf, b.pend, b.canc)));
  const totEstado = porDiaEstado.reduce((s, [, b]) => ({
    conf: s.conf + b.conf, pend: s.pend + b.pend, canc: s.canc + b.canc,
  }), { conf: 0, pend: 0, canc: 0 });

  const chip = (activo: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs border transition-colors ${
      activo ? 'bg-[#00A89D] text-white border-[#00A89D] font-semibold'
             : 'bg-white border-[#E8E8E8] hover:border-[#00A89D]'
    }`;

  const rango = (dias: number) => {
    setTodoElTiempo(false);
    setDesde(haceDiasISO(dias));
    setHasta(hoyISO());
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">

        <header className="mb-6 pl-10 md:pl-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">Estadísticas</h1>
          <p className="text-xs text-[#6B6B6B] mt-1">
            Estado de tus conversaciones en tiempo real
          </p>
        </header>

        {/* Filtro por línea: separa Funnel de WhatsApp */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button onClick={() => setLineaFiltro('todos')}  className={chip(lineaFiltro === 'todos')}>📊 Todas</button>
          <button onClick={() => setLineaFiltro('funnel')} className={chip(lineaFiltro === 'funnel')}>🚀 Ventas Funnel</button>
          <button onClick={() => setLineaFiltro('ventas')} className={chip(lineaFiltro === 'ventas')}>💬 Ventas WhatsApp</button>
        </div>

        {/* Filtro de fechas */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button onClick={() => rango(0)}  className={chip(!todoElTiempo && desde === haceDiasISO(0)  && hasta === hoyISO())}>Hoy</button>
          <button onClick={() => rango(6)}  className={chip(!todoElTiempo && desde === haceDiasISO(6)  && hasta === hoyISO())}>7 días</button>
          <button onClick={() => rango(29)} className={chip(!todoElTiempo && desde === haceDiasISO(29) && hasta === hoyISO())}>30 días</button>
          <button onClick={() => setTodoElTiempo(true)} className={chip(todoElTiempo)}>Todo</button>

          <span className="w-px h-5 bg-[#E8E8E8] mx-1" />

          <input
            type="date" value={desde}
            onChange={e => { setDesde(e.target.value); setTodoElTiempo(false); }}
            className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white"
          />
          <span className="text-xs text-[#6B6B6B]">a</span>
          <input
            type="date" value={hasta}
            onChange={e => { setHasta(e.target.value); setTodoElTiempo(false); }}
            className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white"
          />
        </div>

        {cargando ? (
          <div className="text-sm text-[#6B6B6B] py-10 text-center">Cargando…</div>
        ) : (
          <>
            {/* Tarjetas resumen */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              {tarjetas.map(t => (
                <div key={t.titulo} className="bg-white rounded-2xl border border-[#E8E8E8] p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{t.icono}</span>
                    <span className="text-[11px] text-[#6B6B6B] font-medium truncate">{t.titulo}</span>
                  </div>
                  <div className="text-xl font-bold" style={{ color: t.color }}>{t.valor}</div>
                </div>
              ))}
            </div>

            {/* Pedidos por día: confirmadas / pendientes / canceladas */}
            {porDiaEstado.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 shadow-sm mb-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="text-sm font-semibold text-[#0D0D0D]">Pedidos por día</h2>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#15803D]" />
                      Confirmadas <b className="text-[#15803D]">{totEstado.conf}</b>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#8B5CF6]" />
                      Pendientes <b className="text-[#8B5CF6]">{totEstado.pend}</b>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#DC2626]" />
                      Canceladas <b className="text-[#DC2626]">{totEstado.canc}</b>
                    </span>
                  </div>
                </div>

                <div className="flex items-end gap-3 overflow-x-auto pb-1">
                  {(() => {
                    // Altura real en píxeles, proporcional al valor (así cada barra
                    // se ve distinta según su cantidad, no todas iguales).
                    const MAX_PX = 140;
                    const altoPx = (n: number) => (n <= 0 ? 0 : Math.max(4, Math.round((n / maxEstado) * MAX_PX)));
                    const Col = ({ n, color }: { n: number; color: string }) => (
                      <div className="flex-1 flex flex-col items-center justify-end gap-0.5 min-w-0">
                        {n > 0 && <span className="text-[10px] font-bold" style={{ color }}>{n}</span>}
                        <div
                          className="w-full rounded-t transition-all duration-700"
                          style={{ height: `${altoPx(n)}px`, background: color }}
                          title={`${n}`}
                        />
                      </div>
                    );
                    return porDiaEstado.map(([dia, b]) => (
                      <div key={dia} className="flex-1 min-w-[52px] flex flex-col items-center gap-1">
                        {/* base a la altura máxima + 20px para las etiquetas de número */}
                        <div className="flex items-end gap-0.5 w-full" style={{ height: MAX_PX + 20 }}>
                          <Col n={b.conf} color="#15803D" />
                          <Col n={b.pend} color="#8B5CF6" />
                          <Col n={b.canc} color="#DC2626" />
                        </div>
                        <span className="text-[9px] text-[#6B6B6B] truncate w-full text-center">
                          {new Date(`${dia}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* Tasa de cierre */}
            <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 shadow-sm mb-8">
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-sm font-semibold text-[#0D0D0D]">Tasa de cierre</h2>
                <span className="text-2xl font-bold text-[#00847A]">{tasa}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-[#F1F1F1] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${tasa}%`, background: 'linear-gradient(90deg,#00B5A6,#00847A)' }}
                />
              </div>
              <p className="text-[11px] text-[#6B6B6B] mt-2">
                {confirmadas} confirmadas de {confirmadas + pendConf} pedidos enviados
              </p>
            </div>

            {/* Barras por etiqueta */}
            <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[#0D0D0D] mb-5">Conversaciones por etiqueta</h2>

              <div className="space-y-4">
                {barras.map(b => {
                  const pct = Math.round((b.cantidad / maximo) * 100);
                  return (
                    <div key={b.nombre}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                          <span className="text-xs font-medium text-[#0D0D0D] truncate">{b.nombre}</span>
                        </div>
                        <span className="text-xs font-bold shrink-0 ml-2" style={{ color: b.color }}>
                          {b.cantidad}
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-[#F5F5F5] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${b.cantidad === 0 ? 0 : Math.max(pct, 4)}%`, background: b.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {barras.every(b => b.cantidad === 0) && (
                <p className="text-xs text-[#6B6B6B] text-center py-6">Aún no hay conversaciones etiquetadas.</p>
              )}
            </div>

            <p className="text-[10px] text-[#9A9A9A] text-center mt-6">
              Una conversación con varias etiquetas cuenta en cada una.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

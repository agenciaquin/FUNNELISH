'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface Pedido {
  ciudad: string; departamento: string; valor: string;
  confirmado: boolean; estado: string; created_at: string;
}

interface Fila {
  lugar: string;
  total: number; confirmados: number; cancelados: number; pendientes: number;
  tasa: number;            // % confirmado sobre resueltos
  vendido: number;         // dinero confirmado
  perdido: number;         // dinero de los cancelados
}

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const aNumero = (v: any) => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;

function hoyISO() { return new Date().toISOString().slice(0, 10); }
function haceDiasISO(d: number) {
  const f = new Date(); f.setDate(f.getDate() - d);
  return f.toISOString().slice(0, 10);
}

/** Normaliza nombres para que "BUCARAMANGA" y "Bucaramanga " sean lo mismo. */
function limpiar(s: string): string {
  return String(s ?? '—')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim() || '—';
}

export default function MunicipiosPanel() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [desde, setDesde] = useState(haceDiasISO(29));
  const [hasta, setHasta] = useState(hoyISO());
  const [porDepto, setPorDepto] = useState(false);
  const [minimo, setMinimo]     = useState(3);
  const [orden, setOrden]       = useState<'peores' | 'volumen'>('peores');

  const supabase = createBrowserSupabaseClient();

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await supabase
        .from('clientes_funnelish')
        .select('ciudad, departamento, valor, confirmado, estado, created_at')
        .gte('created_at', `${desde}T00:00:00`)
        .lte('created_at', `${hasta}T23:59:59`)
        .not('estado', 'in', '("duplicado")')
        .limit(3000);
      setPedidos(data ?? []);
    } finally { setCargando(false); }
  }, [desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Agrupar ────────────────────────────────────────────────────────────────
  const mapa = new Map<string, Fila>();
  for (const p of pedidos) {
    const lugar = limpiar(porDepto ? p.departamento : p.ciudad);
    const f = mapa.get(lugar) ?? {
      lugar, total: 0, confirmados: 0, cancelados: 0, pendientes: 0,
      tasa: 0, vendido: 0, perdido: 0,
    };
    f.total++;
    const valor = aNumero(p.valor);
    if (p.confirmado) { f.confirmados++; f.vendido += valor; }
    else if (String(p.estado).toLowerCase() === 'cancelado') { f.cancelados++; f.perdido += valor; }
    else f.pendientes++;
    mapa.set(lugar, f);
  }

  const todas = [...mapa.values()].map(f => {
    const resueltos = f.confirmados + f.cancelados;
    f.tasa = resueltos > 0 ? Math.round((f.confirmados / resueltos) * 100) : 0;
    return f;
  });

  // Promedio general, para saber quién está por debajo de verdad
  const totConf = todas.reduce((s, f) => s + f.confirmados, 0);
  const totCanc = todas.reduce((s, f) => s + f.cancelados, 0);
  const promedio = totConf + totCanc > 0 ? Math.round((totConf / (totConf + totCanc)) * 100) : 0;

  // Con pocos pedidos no hay conclusión posible: un 0% con 1 pedido no dice nada
  const conSuficientes = todas.filter(f => f.confirmados + f.cancelados >= minimo);
  const filas = [...conSuficientes].sort((a, b) =>
    orden === 'peores' ? a.tasa - b.tasa || b.total - a.total : b.total - a.total
  );
  const pocosDatos = todas.length - conSuficientes.length;

  const chip = (activo: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs border transition-colors ${
      activo ? 'bg-[#00A89D] text-white border-[#00A89D] font-semibold'
             : 'bg-white border-[#E8E8E8] hover:border-[#00A89D]'
    }`;

  const colorTasa = (t: number) =>
    t >= promedio + 10 ? '#15803D' : t >= promedio - 10 ? '#EA580C' : '#DC2626';

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">

        <header className="mb-4 pl-10 md:pl-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">Municipios</h1>
          <p className="text-xs text-[#6B6B6B] mt-1">
            Dónde te confirman y dónde te cancelan. Sirve para decidir a qué zonas seguir pautando.
          </p>
        </header>

        {/* Filtros */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button onClick={() => { setDesde(haceDiasISO(6)); setHasta(hoyISO()); }}  className={chip(desde === haceDiasISO(6))}>7 días</button>
          <button onClick={() => { setDesde(haceDiasISO(29)); setHasta(hoyISO()); }} className={chip(desde === haceDiasISO(29))}>30 días</button>
          <button onClick={() => { setDesde(haceDiasISO(89)); setHasta(hoyISO()); }} className={chip(desde === haceDiasISO(89))}>90 días</button>

          <span className="w-px h-5 bg-[#E8E8E8] mx-1" />

          <button onClick={() => setPorDepto(false)} className={chip(!porDepto)}>Por municipio</button>
          <button onClick={() => setPorDepto(true)}  className={chip(porDepto)}>Por departamento</button>

          <span className="w-px h-5 bg-[#E8E8E8] mx-1" />

          <button onClick={() => setOrden('peores')}  className={chip(orden === 'peores')}>Peores primero</button>
          <button onClick={() => setOrden('volumen')} className={chip(orden === 'volumen')}>Más pedidos</button>
        </div>

        {/* Promedio general */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-4 shadow-sm mb-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-[11px] text-[#6B6B6B]">Tu promedio general de confirmación</p>
            <p className="text-2xl font-bold text-[#00847A]">{promedio}%</p>
          </div>
          <p className="text-[11px] text-[#6B6B6B] max-w-xs leading-snug">
            Los lugares en <span className="text-[#DC2626] font-semibold">rojo</span> están
            claramente por debajo de tu promedio. Ahí es donde estás perdiendo plata.
          </p>
        </div>

        {/* Mínimo de pedidos */}
        <div className="flex items-center gap-2 mb-4 text-xs text-[#6B6B6B] flex-wrap">
          <span>Mostrar solo lugares con al menos</span>
          {[1, 3, 5, 10].map(n => (
            <button key={n} onClick={() => setMinimo(n)} className={chip(minimo === n)}>{n}</button>
          ))}
          <span>pedidos resueltos</span>
          {pocosDatos > 0 && (
            <span className="text-[11px] text-[#9A9A9A]">
              · {pocosDatos} {pocosDatos === 1 ? 'lugar oculto' : 'lugares ocultos'} por tener muy pocos
            </span>
          )}
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-hidden">
          {cargando ? (
            <p className="text-sm text-[#6B6B6B] py-12 text-center">Cargando…</p>
          ) : filas.length === 0 ? (
            <p className="text-sm text-[#6B6B6B] py-12 text-center px-6">
              No hay suficientes pedidos resueltos en este período. Baja el mínimo o amplía las fechas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#E8E8E8] text-[#6B6B6B]">
                  <tr>
                    <th className="text-left  px-4 py-2.5 font-semibold">{porDepto ? 'Departamento' : 'Municipio'}</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Pedidos</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Conf.</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Canc.</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Pend.</th>
                    <th className="text-left  px-4 py-2.5 font-semibold w-[150px]">Confirmación</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Perdido</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(f => (
                    <tr key={f.lugar} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                      <td className="px-4 py-2.5 font-medium text-[#0D0D0D]">{f.lugar}</td>
                      <td className="px-3 py-2.5 text-right">{f.total}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#15803D]">{f.confirmados}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#DC2626]">{f.cancelados}</td>
                      <td className="px-3 py-2.5 text-right text-[#EA580C]">{f.pendientes}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-[#F0F0F0] overflow-hidden min-w-[50px]">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${f.tasa}%`, background: colorTasa(f.tasa) }}
                            />
                          </div>
                          <span className="font-bold shrink-0 w-9 text-right" style={{ color: colorTasa(f.tasa) }}>
                            {f.tasa}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#DC2626]">
                        {f.perdido > 0 ? pesos(f.perdido) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[10px] text-[#9A9A9A] mt-4 leading-relaxed">
          La confirmación se calcula sobre pedidos ya resueltos (confirmados más cancelados);
          los que siguen pendientes no cuentan, porque todavía pueden confirmar.
          &quot;Perdido&quot; es el dinero de los pedidos cancelados en ese lugar.
        </p>
      </div>
    </div>
  );
}

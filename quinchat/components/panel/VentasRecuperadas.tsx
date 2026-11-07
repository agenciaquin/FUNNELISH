'use client';

import { useEffect, useState } from 'react';

/**
 * VENTAS RECUPERADAS: pedidos que llegaron DESPUÉS de una plantilla automática.
 *  🛒 Carrito abandonado (pedido ≤ 7 días después de la plantilla de carrito)
 *  🎁 Descuento $15.000 (pedido ≤ 30 días después de la plantilla de descuento)
 * Datos: GET /api/pedidos/recuperadas (solo lectura).
 */
interface Venta {
  tipo: 'carrito' | 'descuento'; telefono: string; nombre: string | null; producto: string | null; talla: string | null;
  valor: number; confirmado: boolean; estado: string | null; pedido_at: string; enviado_at: string; origen: string | null; horas: number;
  marcado?: boolean;   // contado por la etiqueta «COMPRO EN DESCUENTO»
}
interface Bloque { enviados: number; ventas: number; confirmadas: number; valor: number; lista: Venta[] }
interface Datos { carrito: Bloque; descuento: Bloque; reglas: { dias_carrito: number; dias_descuento: number } }

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const fecha = (iso: string) => new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
const tardo = (h: number) => (h < 1 ? 'menos de 1 h' : h < 48 ? `${h} h` : `${Math.round(h / 24)} días`);
const tasa = (b?: Bloque) => (b && b.enviados ? Math.round((b.ventas / b.enviados) * 100) : 0);

export default function VentasRecuperadas({ onClose, onAbrirChat }: { onClose: () => void; onAbrirChat?: (id: string) => void }) {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'carrito' | 'descuento'>('todas');

  useEffect(() => {
    fetch('/api/pedidos/recuperadas', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (j.error) setError(j.error); else setD(j); })
      .catch(() => setError('No se pudo cargar.'));
  }, []);

  const lista = !d ? [] : [
    ...(filtro !== 'descuento' ? d.carrito.lista : []),
    ...(filtro !== 'carrito' ? d.descuento.lista : []),
  ].sort((a, b) => Date.parse(b.pedido_at) - Date.parse(a.pedido_at));

  const Tarjeta = ({ k, icono, titulo, b, color, nota }: { k: 'carrito' | 'descuento'; icono: string; titulo: string; b?: Bloque; color: string; nota: string }) => (
    <button onClick={() => setFiltro(f => (f === k ? 'todas' : k))}
      className={`flex-1 min-w-[260px] text-left rounded-2xl p-4 shadow-lg border-2 transition-transform hover:-translate-y-0.5 ${filtro === k ? 'ring-2 ring-offset-2' : ''}`}
      style={{ background: color, borderColor: color, color: '#fff' }}>
      <p className="text-sm font-semibold opacity-90">{icono} {titulo}</p>
      <p className="text-4xl font-extrabold leading-tight mt-1">{b?.ventas ?? '…'}</p>
      <p className="text-xs opacity-90">ventas salvadas · {pesos(b?.valor ?? 0)} confirmado</p>
      <p className="text-[11px] opacity-80 mt-2">{b ? `${b.confirmadas} confirmadas · ${b.enviados} plantillas enviadas · ${tasa(b)}% compró` : ''}</p>
      <p className="text-[10px] opacity-70 mt-1">{nota}</p>
    </button>
  );

  return (
    <div className="h-full overflow-y-auto bg-[#F7F7F5]">
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onClose} className="h-9 px-3 rounded-xl bg-white border border-[#E8E8E8] text-sm font-semibold hover:bg-[#F0F0F0]">← Volver</button>
          <div>
            <h1 className="text-2xl font-extrabold text-[#0D0D0D]">💚 Ventas recuperadas</h1>
            <p className="text-xs text-[#6B6B6B]">Pedidos que llegaron después de una plantilla automática. Toca una tarjeta para filtrar.</p>
          </div>
        </div>

        {/* Los dos contadores "flotantes" */}
        <div className="sticky top-0 z-10 pb-4 bg-[#F7F7F5] flex flex-wrap gap-3">
          <Tarjeta k="carrito" icono="🛒" titulo="Carritos recuperados" b={d?.carrito} color="#D97706"
            nota={`Pedido hasta ${d?.reglas.dias_carrito ?? 7} días después de la plantilla de carrito abandonado`} />
          <Tarjeta k="descuento" icono="🎁" titulo="Ventas con descuento $15.000" b={d?.descuento} color="#00A89D"
            nota={`Pedido hasta ${d?.reglas.dias_descuento ?? 30} días después de la plantilla de descuento, o chat con la etiqueta COMPRO EN DESCUENTO`} />
        </div>

        {error && <p className="text-sm text-red-600 mb-3">⚠️ {error}</p>}
        {!d && !error && <p className="text-sm text-[#6B6B6B]">Cargando…</p>}

        {d && (
          <div className="bg-white rounded-2xl border border-[#EDEDED] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#F0F0F0] flex items-center justify-between">
              <p className="text-sm font-bold">
                {filtro === 'todas' ? 'Todas las ventas recuperadas' : filtro === 'carrito' ? '🛒 Carritos recuperados' : '🎁 Ventas con descuento'} · {lista.length}
              </p>
              {filtro !== 'todas' && <button onClick={() => setFiltro('todas')} className="text-xs text-[#00847A] font-semibold">Ver todas</button>}
            </div>
            {lista.length === 0 ? (
              <p className="p-6 text-sm text-[#6B6B6B] text-center">Todavía no hay ventas recuperadas aquí. Aparecen solas cuando un cliente que recibió la plantilla hace su pedido.</p>
            ) : lista.map(v => (
              <div key={`${v.tipo}-${v.telefono}-${v.pedido_at}`} className="px-4 py-3 border-b border-[#F5F5F5] flex items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.tipo === 'carrito' ? 'bg-[#D97706]/15 text-[#B45309]' : 'bg-[#00A89D]/15 text-[#00847A]'}`}>
                  {v.tipo === 'carrito' ? '🛒 CARRITO' : '🎁 DESCUENTO'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{v.nombre || v.telefono} <span className="text-[#6B6B6B] font-normal">· {v.telefono}</span></p>
                  <p className="text-xs text-[#6B6B6B] truncate">{v.producto}{v.talla ? ` · ${v.talla}` : ''}</p>
                  {v.marcado
                    ? <p className="text-[10px] text-[#00847A] font-semibold">🏷️ Marcado con la etiqueta COMPRO EN DESCUENTO · pedido {fecha(v.pedido_at)}</p>
                    : <p className="text-[10px] text-[#9A9A9A]">Plantilla {fecha(v.enviado_at)} → pedido {fecha(v.pedido_at)} (en {tardo(v.horas)})</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{pesos(v.valor)}</p>
                  <p className={`text-[10px] font-semibold ${v.confirmado ? 'text-[#15803D]' : 'text-[#B45309]'}`}>{v.confirmado ? '✅ Confirmado' : '⏳ Por confirmar'}</p>
                </div>
                {onAbrirChat && (
                  <button onClick={() => onAbrirChat(`57${v.telefono}`)} className="h-8 px-3 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:opacity-90">💬 Chat</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

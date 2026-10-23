'use client';

import { useEffect, useState } from 'react';
import type { Conversation, Etiqueta } from '@/lib/panel/types';
import { ETIQUETAS_FIJAS } from '@/lib/panel/types';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { canalDePedido, fuenteDePedido, CANAL_LABEL, FUENTE_LABEL, FUENTE_ICONO } from '@/lib/clasificacion-pedidos';
import { imgOptim } from '@/lib/funnels';

/**
 * Columna derecha: Información del cliente (SOLO LECTURA).
 * Reutiliza datos ya existentes (conversación + último pedido por teléfono).
 * No modifica nada: no toca el bot, ni etiquetas, ni la base.
 */

const pesos = (v: any) => {
  const n = Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;
  return n ? `$${n.toLocaleString('es-CO')}` : '—';
};

interface Pedido {
  id: string; referencia: string; producto: string; talla: string; valor: string;
  correo: string | null; confirmado: boolean; estado: string;
  utm_source: string | null; utm_campaign: string | null; referrer: string | null;
  foto_producto: string | null; created_at: string;
}

export default function ClienteInfo({ conversation, onClose }: { conversation: Conversation; onClose: () => void }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cargando, setCargando] = useState(true);
  const supabase = createBrowserSupabaseClient();

  const tel10 = String(conversation.id ?? '').replace(/\D/g, '').slice(-10);
  const initial = (conversation.contact_name || '?').charAt(0).toUpperCase();

  useEffect(() => {
    let cancelado = false;
    setCargando(true); setPedido(null);
    (async () => {
      try {
        const { data } = await supabase
          .from('clientes_funnelish')
          .select('id, referencia, producto, talla, valor, correo, confirmado, estado, utm_source, utm_campaign, referrer, foto_producto, created_at')
          .ilike('telefono', `%${tel10}`)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!cancelado) setPedido((data?.[0] as any) ?? null);
      } catch { if (!cancelado) setPedido(null); }
      finally { if (!cancelado) setCargando(false); }
    })();
    return () => { cancelado = true; };
  }, [tel10, supabase]);

  const esChatbot = conversation.linea === 'ventas';
  const origenLabel = esChatbot ? 'Chatbot' : 'Embudo';
  const labels = (conversation.label ?? '').split('|').map(s => s.trim()).filter(Boolean);
  const colorEtq = (n: string) => (ETIQUETAS_FIJAS as Etiqueta[]).find(e => e.nombre === n)?.color ?? '#6B7280';

  const canal  = pedido ? canalDePedido(pedido.referencia) : null;
  const fuente = pedido ? fuenteDePedido(pedido.utm_source, pedido.utm_campaign, pedido.referrer) : null;
  const foto   = pedido?.foto_producto && pedido.foto_producto.startsWith('http') ? pedido.foto_producto : null;
  const estadoPedido = pedido
    ? (pedido.confirmado ? 'Confirmado' : String(pedido.estado).toLowerCase() === 'cancelado' ? 'Cancelado' : 'Por confirmar')
    : null;
  const estadoColor = estadoPedido === 'Confirmado' ? '#15803D' : estadoPedido === 'Cancelado' ? '#DC2626' : '#EA580C';

  const Vacio = () => <span className="text-[12px] text-[#9A9A9A] italic">Sin información disponible</span>;

  return (
    <div className="w-full md:w-[320px] shrink-0 h-full overflow-y-auto bg-white border-l border-[#E8E8E8]">
      {/* Encabezado */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E8]">
        <span className="font-bold text-[13.5px] flex items-center gap-1.5">👤 Información del cliente</span>
        <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#0D0D0D] text-sm" title="Cerrar ficha">✕</button>
      </div>

      {/* Perfil */}
      <div className="text-center px-4 pt-5 pb-3">
        <div className="w-[72px] h-[72px] rounded-full mx-auto mb-2 grid place-items-center text-white font-extrabold text-[26px] bg-[#00A89D]">{initial}</div>
        <div className="font-bold text-[15px]">{conversation.contact_name || '—'}</div>
        <div className="text-[12px] text-[#6B6B6B] mt-0.5">+{conversation.id}</div>
        <div className="text-[12px] text-[#6B6B6B]">{pedido?.correo || <span className="text-[#9A9A9A] italic">Sin correo</span>}</div>
      </div>

      {/* Etiquetas */}
      <div className="px-4 py-3 border-t border-[#E8E8E8]">
        <div className="text-[10px] font-bold uppercase text-[#9A9A9A] tracking-wide mb-2">🏷️ Etiquetas</div>
        {labels.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {labels.map(n => (
              <span key={n} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: colorEtq(n), background: colorEtq(n) + '18' }}>{n}</span>
            ))}
          </div>
        ) : <Vacio />}
      </div>

      {/* Estado de la conversación */}
      <div className="px-4 py-3 border-t border-[#E8E8E8]">
        <div className="text-[10px] font-bold uppercase text-[#9A9A9A] tracking-wide mb-2">💬 Estado de la conversación</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: '#2f80ed', background: '#eef4ff' }}>{origenLabel}</span>
        </div>
        <div className="flex justify-between text-[12.5px]">
          <span className="text-[#6B6B6B]">Bot en este chat</span>
          <span className="font-bold" style={{ color: conversation.bot_enabled ? '#00847A' : '#DC2626' }}>
            ● {conversation.bot_enabled ? 'Activo' : 'Pausado'}
          </span>
        </div>
      </div>

      {/* Pedido relacionado */}
      <div className="px-4 py-3 border-t border-[#E8E8E8]">
        <div className="text-[10px] font-bold uppercase text-[#9A9A9A] tracking-wide mb-2">📦 Pedido relacionado</div>
        {cargando ? (
          <div className="h-16 rounded-xl bg-[#F5F5F5] animate-pulse" />
        ) : pedido ? (
          <div className="border border-[#E8E8E8] rounded-xl overflow-hidden">
            <div className="flex gap-2.5 p-2.5">
              <div className="w-[52px] h-[52px] rounded-lg bg-[#F2F2F2] grid place-items-center text-xl shrink-0 overflow-hidden">
                {foto
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={imgOptim(foto, 120)} alt="" className="w-full h-full object-cover" />
                  : '🧥'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: estadoColor, background: estadoColor + '18' }}>{estadoPedido}</span>
                </div>
                <div className="text-[12.5px] truncate">{pedido.producto || '—'}</div>
                <div className="text-[11px] text-[#6B6B6B] truncate">{pedido.talla || 'sin talla'} · <b>{pesos(pedido.valor)}</b></div>
              </div>
            </div>
          </div>
        ) : <Vacio />}
      </div>

      {/* De dónde llegó */}
      <div className="px-4 py-3 border-t border-[#E8E8E8]">
        <div className="text-[10px] font-bold uppercase text-[#9A9A9A] tracking-wide mb-2">🎯 De dónde llegó</div>
        {pedido ? (
          <>
            <div className="flex justify-between text-[12.5px] py-0.5"><span className="text-[#6B6B6B]">Canal</span><span>{canal ? CANAL_LABEL[canal] : '—'}</span></div>
            <div className="flex justify-between text-[12.5px] py-0.5"><span className="text-[#6B6B6B]">Campaña</span><span className="truncate max-w-[160px] text-right">{pedido.utm_campaign || <span className="text-[#9A9A9A] italic">—</span>}</span></div>
            <div className="flex justify-between text-[12.5px] py-0.5"><span className="text-[#6B6B6B]">Plataforma</span><span>{fuente ? `${FUENTE_ICONO[fuente]} ${FUENTE_LABEL[fuente]}` : '—'}</span></div>
          </>
        ) : <Vacio />}
      </div>
    </div>
  );
}

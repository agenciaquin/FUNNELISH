'use client';

import { useState, useEffect, useCallback } from 'react';

interface Carrito {
  id: string;
  slug: string;
  nombre: string | null;
  telefono: string;
  producto: string | null;
  talla: string | null;
  valor: number | null;
  created_at: string;
}

const pesos = (n: number | null) => (n ? `$${Math.round(n).toLocaleString('es-CO')}` : '—');

function cuandoFue(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export default function CarritosAbandonados({ onClose }: { onClose: () => void }) {
  const [carritos, setCarritos] = useState<Carrito[]>([]);
  const [loading, setLoading]   = useState(true);
  const [verRecuperados, setVerRecuperados] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [diag, setDiag] = useState<{ totalTabla: number; permiso: boolean } | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/funnels/carrito${verRecuperados ? '?recuperados=1' : ''}`, { cache: 'no-store' });
      const d = await r.json();
      setCarritos(d.carritos ?? []);
      setDiag({ totalTabla: d.totalTabla ?? 0, permiso: d.permiso !== false });
    } catch { setCarritos([]); }
    finally { setLoading(false); }
  }, [verRecuperados]);

  useEffect(() => { cargar(); }, [cargar]);

  async function marcar(id: string, recuperado: boolean) {
    setMarcando(id);
    try {
      await fetch('/api/funnels/carrito', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, recuperado }),
      });
      setCarritos(cs => cs.filter(c => c.id !== id));
    } catch { /* ignorar */ }
    finally { setMarcando(null); }
  }

  const totalValor = carritos.reduce((s, c) => s + (c.valor ?? 0), 0);

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
        {/* Volver a la lista de embudos */}
        <button onClick={onClose} className="text-xs text-[#00A89D] font-semibold hover:underline mb-3 pl-10 md:pl-0">
          ← Volver
        </button>

        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#E8E8E8]">
            <h3 className="text-base font-bold text-[#0D0D0D]">🛒 Carritos abandonados</h3>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">
              Clientes que escribieron su nombre y WhatsApp pero no completaron la compra. ¡Escríbeles para recuperar la venta!
            </p>
          </div>

          {/* Filtro + resumen */}
          <div className="px-6 pt-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2">
              <button onClick={() => setVerRecuperados(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!verRecuperados ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A] font-semibold' : 'border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5]'}`}>
                Por recuperar
              </button>
              <button onClick={() => setVerRecuperados(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${verRecuperados ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A] font-semibold' : 'border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5]'}`}>
                Recuperados
              </button>
            </div>
            {!verRecuperados && carritos.length > 0 && (
              <span className="text-[11px] text-[#6B6B6B]">
                <b className="text-[#0D0D0D]">{carritos.length}</b> carritos · <b className="text-[#00847A]">{pesos(totalValor)}</b> por recuperar
              </span>
            )}
          </div>

          {/* Lista */}
          <div className="px-6 py-4">
            {loading ? (
              <div className="text-center text-[#9A9A9A] text-sm py-10">Cargando…</div>
            ) : carritos.length === 0 ? (
              <div className="text-center text-[#9A9A9A] text-sm py-10">
                {verRecuperados ? 'Aún no has marcado carritos como recuperados.' : '🎉 No hay carritos abandonados. ¡Todos completaron su compra!'}
                {!verRecuperados && diag && (
                  <div className="mt-3 text-[11px] text-[#B45309] bg-[#FEF3C7] rounded-lg px-3 py-2 inline-block">
                    {!diag.permiso
                      ? '⚠️ Falta el permiso de la tabla. Corre en Supabase: grant all on table carritos_abandonados to service_role;'
                      : diag.totalTabla === 0
                        ? 'La tabla aún no tiene ningún registro. Los carritos empiezan a guardarse desde AHORA (los de antes del arreglo no se guardaron). Haz una prueba: escribe nombre + WhatsApp en un embudo sin comprar.'
                        : `Hay ${diag.totalTabla} registro(s) en total, pero todos ya compraron (pedido confirmado) o se recuperaron.`}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {carritos.map(c => {
                  const tel = c.telefono.replace(/\D/g, '').replace(/^57/, '');
                  const msg = encodeURIComponent(`¡Hola ${c.nombre?.split(' ')[0] ?? ''}! 😊 Vi que estabas por pedir ${c.producto ?? 'tu buzo'}${c.talla ? ` (${c.talla})` : ''}. ¿Te ayudo a completarlo? 🚚`);
                  return (
                    <div key={c.id} className="rounded-xl border border-[#EFEFEF] p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#0D0D0D] truncate">{c.nombre || 'Sin nombre'}</span>
                          <span className="text-[10px] text-[#9A9A9A] shrink-0">· {cuandoFue(c.created_at)}</span>
                        </div>
                        <div className="text-[12px] text-[#6B6B6B] truncate">
                          {c.producto || '—'}{c.talla ? ` · ${c.talla}` : ''} · {pesos(c.valor)}
                        </div>
                        <div className="text-[12px] text-[#00847A] font-mono">{tel}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a href={`https://wa.me/57${tel}?text=${msg}`} target="_blank" rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold hover:opacity-90">
                          WhatsApp
                        </a>
                        <a href={`tel:+57${tel}`}
                          className="px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs font-medium hover:bg-[#F5F5F5]">
                          📞
                        </a>
                        <button onClick={() => marcar(c.id, !verRecuperados)} disabled={marcando === c.id}
                          title={verRecuperados ? 'Reabrir' : 'Marcar como recuperado'}
                          className="px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs font-medium hover:bg-[#F5F5F5] disabled:opacity-50">
                          {marcando === c.id ? '…' : verRecuperados ? '↩' : '✓'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

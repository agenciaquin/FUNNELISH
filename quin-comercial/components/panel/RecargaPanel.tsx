'use client';

import { useState, useEffect } from 'react';

interface Paquete { conversaciones: number; precio: number }
interface Recarga { id: string; cantidad: number; monto: number; estado: string; creado_at: string; aprobada_at: string | null }

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const fecha = (s: string) => { const d = new Date(s); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };

export default function RecargaPanel() {
  const [creditos, setCreditos] = useState(0);
  const [conversaciones, setConversaciones] = useState(0);
  const [diasPrueba, setDiasPrueba] = useState(0);
  const [tope, setTope] = useState(0);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [historial, setHistorial] = useState<Recarga[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagando, setPagando] = useState(false);
  const [pasarelaLista, setPasarelaLista] = useState(true);
  const [falta, setFalta] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function cargar() {
    setLoading(true);
    try {
      const r = await fetch('/api/recargas');
      const d = await r.json();
      if (r.ok) {
        setCreditos(d.creditos ?? 0);
        setConversaciones(d.conversaciones ?? 0);
        setDiasPrueba(d.diasPrueba ?? 0);
        setTope(d.creditos_tope ?? 0);
        setPaquetes(d.paquetes ?? []);
        setHistorial(d.historial ?? []);
        setPasarelaLista(!!d.pasarelaLista);
        setFalta(!!d.faltaMigracion);
        if ((d.paquetes ?? []).length && sel === null) setSel(d.paquetes[0].conversaciones);
      }
    } finally { setLoading(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  // Al volver de Mercado Pago (?recarga=success|pending|failure).
  // En "success" confirmamos el pago directo con MP (a prueba de fallos, sin
  // depender del webhook) y refrescamos el saldo.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get('recarga');
    if (p === 'success') {
      setMsg({ ok: true, text: 'Confirmando tu pago…' });
      const payment_id = sp.get('payment_id') || sp.get('collection_id') || '';
      const external_reference = sp.get('external_reference') || '';
      (async () => {
        try {
          const r = await fetch('/api/recargas/confirmar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_id, external_reference }),
          });
          const d = await r.json();
          if (r.ok && d.acreditado) {
            setMsg({ ok: true, text: `¡Listo! Se sumaron ${(d.cantidad ?? 0).toLocaleString('es-CO')} conversaciones a tu saldo.` });
          } else if (r.ok && d.estado && d.estado !== 'approved' && d.estado !== 'no_encontrado') {
            setMsg({ ok: true, text: 'Tu pago quedó pendiente. Cuando se apruebe, el crédito se suma solo.' });
          } else {
            setMsg({ ok: true, text: '¡Pago recibido! Tu crédito se suma en unos segundos. Refresca si no lo ves.' });
          }
        } catch {
          setMsg({ ok: true, text: '¡Pago recibido! Si no ves el crédito, refresca en unos segundos.' });
        } finally {
          cargar();
        }
      })();
    }
    else if (p === 'pending') setMsg({ ok: true, text: 'Tu pago quedó pendiente. Cuando se apruebe, el crédito se suma solo.' });
    else if (p === 'failure') setMsg({ ok: false, text: 'El pago no se completó. Puedes intentar de nuevo.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pagar() {
    if (sel == null || pagando) return;
    setPagando(true);
    setMsg(null);
    try {
      const r = await fetch('/api/recargas/crear', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversaciones: sel }),
      });
      const d = await r.json();
      if (r.ok && d.init_point) { window.location.href = d.init_point; return; }
      setMsg({ ok: false, text: d.error ?? 'No se pudo iniciar el pago' });
    } catch { setMsg({ ok: false, text: 'Error de conexión' }); }
    finally { setPagando(false); }
  }

  const pct = tope > 0 ? Math.max(0, Math.min(100, (creditos / tope) * 100)) : (creditos > 0 ? 100 : 0);
  const bajo = tope > 0 && creditos / tope <= 0.15;

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-[#0D0D0D] font-bold text-lg">Recarga de conversaciones</h1>
        <p className="text-xs text-[#6B6B6B] mt-0.5 mb-5">Compra conversaciones para que tu bot siga atendiendo. Cada conversación es un chat con un cliente.</p>

        {diasPrueba > 0 && (
          <div className="mb-4 text-sm rounded-xl px-4 py-3 bg-[#00A89D]/10 border border-[#00A89D]/30 text-[#0D0D0D]">
            🎁 <b>Prueba gratis activa</b> — te quedan <b>{diasPrueba} día{diasPrueba === 1 ? '' : 's'}</b>. Durante la prueba el bot responde con la IA de la agencia sin gastar créditos. Al terminar, usa tus propias llaves o tus créditos.
          </div>
        )}
        {msg && (
          <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
            {msg.text}
          </div>
        )}
        {falta && (
          <div className="mb-4 text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200">
            Falta un paso técnico en la base de datos. Avísale a tu administrador.
          </div>
        )}
        {!pasarelaLista && (
          <div className="mb-4 text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200">
            La pasarela de pago aún no está configurada. El administrador debe conectar Mercado Pago.
          </div>
        )}

        {/* Conversaciones que ha atendido el bot en esta sesión/empresa */}
        <div className="rounded-2xl border border-[#00A89D]/25 bg-[#00A89D]/[0.06] p-5 shadow-sm mb-4">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-[#00847A] font-semibold">Conversaciones que llevas</span>
              <p className="text-[11px] text-[#6B6B6B] mt-0.5">Chats distintos que tu bot ha atendido en total.</p>
            </div>
            <span className="text-3xl font-bold text-[#00847A]">{conversaciones.toLocaleString('es-CO')}<span className="text-sm font-normal text-[#6B6B6B]"> chats</span></span>
          </div>
        </div>

        {/* Barra de cuota */}
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-sm mb-5">
          <div className="flex items-end justify-between mb-2">
            <span className="text-sm text-[#6B6B6B]">Tu saldo actual</span>
            <span className="text-2xl font-bold text-[#0D0D0D]">{creditos.toLocaleString('es-CO')}<span className="text-sm font-normal text-[#9A9A9A]"> conversaciones</span></span>
          </div>
          <div className="h-3 rounded-full bg-[#F0F0F0] overflow-hidden">
            <div className={`h-full rounded-full transition-all ${bajo ? 'bg-amber-400' : 'bg-[#00A89D]'}`} style={{ width: `${pct}%` }} />
          </div>
          {tope > 0 && <div className="text-[11px] text-[#9A9A9A] mt-1.5 text-right">{creditos.toLocaleString('es-CO')} / {tope.toLocaleString('es-CO')}</div>}
          {bajo && <div className="text-[12px] text-amber-700 mt-2">⚠️ Te queda poco crédito. Recarga para que el bot no deje de responder.</div>}
        </div>

        {/* Paquetes */}
        <h2 className="text-sm font-semibold text-[#0D0D0D] mb-3">Elige cuánto recargar</h2>
        {loading ? (
          <div className="text-[#9A9A9A] text-sm">Cargando…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {paquetes.map(p => {
                const activo = sel === p.conversaciones;
                return (
                  <button
                    key={p.conversaciones}
                    onClick={() => setSel(p.conversaciones)}
                    className={`rounded-2xl border p-4 text-left transition-all ${activo ? 'border-[#00A89D] bg-[#00A89D]/[0.06] ring-1 ring-[#00A89D]' : 'border-[#E8E8E8] bg-white hover:border-[#00A89D]/40'}`}
                  >
                    <div className="text-lg font-bold text-[#0D0D0D]">{p.conversaciones.toLocaleString('es-CO')}</div>
                    <div className="text-[11px] text-[#9A9A9A] mb-2">conversaciones</div>
                    <div className="text-sm font-semibold text-[#00847A]">{pesos(p.precio)}</div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={pagar}
              disabled={pagando || sel == null || !pasarelaLista}
              className="w-full md:w-auto px-8 py-3 rounded-xl text-sm font-bold bg-[#00A89D] text-white hover:bg-[#00847A] active:scale-95 disabled:opacity-40 transition-all"
            >
              {pagando ? 'Redirigiendo a Mercado Pago…' : sel ? `Pagar ${pesos(paquetes.find(p => p.conversaciones === sel)?.precio ?? 0)}` : 'Pagar'}
            </button>
            <p className="text-[11px] text-[#9A9A9A] mt-2">Pago seguro con Mercado Pago (tarjeta, PSE, Nequi o Efecty). Precios sujetos a cambios.</p>
          </>
        )}

        {/* Historial */}
        {historial.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-[#0D0D0D] mb-3">Historial de recargas</h2>
            <div className="rounded-2xl border border-[#E8E8E8] overflow-hidden bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-[#F5F5F5] text-[#6B6B6B] text-xs">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Fecha</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Conversaciones</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Monto</th>
                    <th className="text-center px-4 py-2.5 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map(h => (
                    <tr key={h.id} className="border-t border-[#F0F0F0] text-[#3A3A3A]">
                      <td className="px-4 py-2.5 text-[#9A9A9A]">{fecha(h.creado_at)}</td>
                      <td className="px-4 py-2.5 font-medium">+{h.cantidad.toLocaleString('es-CO')}</td>
                      <td className="px-4 py-2.5">{pesos(h.monto)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {h.estado === 'aprobada'
                          ? <span className="text-emerald-600 font-medium">aprobada</span>
                          : h.estado === 'pendiente'
                          ? <span className="text-amber-600">pendiente</span>
                          : <span className="text-[#9A9A9A]">{h.estado}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

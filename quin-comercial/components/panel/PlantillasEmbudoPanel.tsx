'use client';

import { useState, useEffect } from 'react';

interface Plantilla {
  id: string;
  slug: string;
  producto: string;
  precio: number;
  imagenes: string[] | null;
  es_plantilla?: boolean;
}
interface MiEmbudo { id: string; slug: string; producto: string; es_plantilla: boolean }

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

/**
 * Plantillas de embudo.
 *  - Cliente: ve las plantillas y las CLONA a sus embudos ("Usar esta plantilla").
 *  - Admin: además marca cuáles de sus embudos son plantilla (visibles para todos).
 */
export default function PlantillasEmbudoPanel() {
  const [esAdmin, setEsAdmin] = useState(false);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [misEmbudos, setMisEmbudos] = useState<MiEmbudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [falta, setFalta] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [usando, setUsando] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    try {
      const r = await fetch('/api/plantillas-embudo');
      const d = await r.json();
      if (r.ok) {
        setEsAdmin(!!d.esAdmin);
        setPlantillas(d.plantillas ?? []);
        setMisEmbudos(d.misEmbudos ?? []);
        setFalta(!!d.faltaMigracion);
      }
    } finally { setLoading(false); }
  }
  useEffect(() => { cargar(); }, []);

  async function usar(p: Plantilla) {
    if (usando) return;
    setUsando(p.id);
    setMsg(null);
    try {
      const r = await fetch('/api/plantillas-embudo/usar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id }),
      });
      const d = await r.json();
      if (r.ok) setMsg({ ok: true, text: `Listo ✓ Se agregó "${p.producto}" a tus Embudos. Ábrela en la pestaña Embudos para editarla con tus datos.` });
      else setMsg({ ok: false, text: d.error ?? 'No se pudo usar la plantilla' });
    } catch { setMsg({ ok: false, text: 'Error de conexión' }); }
    finally { setUsando(null); }
  }

  async function marcar(e: MiEmbudo, valor: boolean) {
    setMisEmbudos(prev => prev.map(x => x.id === e.id ? { ...x, es_plantilla: valor } : x));
    try {
      const r = await fetch('/api/plantillas-embudo/marcar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: e.id, es_plantilla: valor }),
      });
      if (!r.ok) throw new Error();
      cargar();
    } catch {
      setMisEmbudos(prev => prev.map(x => x.id === e.id ? { ...x, es_plantilla: !valor } : x));
      setMsg({ ok: false, text: 'No se pudo cambiar. Intenta de nuevo.' });
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-[#0D0D0D] font-bold text-lg">Plantillas de embudo</h1>
        <p className="text-xs text-[#6B6B6B] mb-5">
          {esAdmin
            ? 'Elige plantillas listas para usarlas, y marca cuáles de tus embudos quieres ofrecer como plantilla a tus clientes.'
            : 'Elige una plantilla lista y úsala: se copia a tus Embudos para que la edites con tu producto, precios y píxeles.'}
        </p>

        {falta && (
          <div className="mb-4 text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200">
            Falta un paso técnico en la base de datos (columna <code>es_plantilla</code>). Avísale a tu administrador.
          </div>
        )}
        {msg && (
          <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="text-[#9A9A9A] text-sm">Cargando…</div>
        ) : (
          <>
            <h2 className="text-[#0D0D0D] text-sm font-semibold mb-3">Plantillas disponibles</h2>
            {plantillas.length === 0 ? (
              <div className="text-[#9A9A9A] text-sm mb-8">Aún no hay plantillas.{esAdmin ? ' Marca un embudo tuyo abajo para convertirlo en plantilla.' : ''}</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {plantillas.map(p => (
                  <div key={p.id} className="rounded-2xl border border-[#E8E8E8] bg-white overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
                    <div className="aspect-[4/3] bg-[#F2F1EE] flex items-center justify-center overflow-hidden">
                      {p.imagenes && p.imagenes[0]
                        ? <img src={p.imagenes[0]} alt={p.producto} className="w-full h-full object-cover" />
                        : <span className="text-3xl">🧩</span>}
                    </div>
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div className="text-sm text-[#0D0D0D] font-medium leading-tight line-clamp-2">{p.producto}</div>
                      <div className="text-xs font-semibold text-[#007A72]">{pesos(p.precio)}</div>
                      <button
                        onClick={() => usar(p)}
                        disabled={usando === p.id}
                        className="mt-auto px-3 py-2 rounded-lg text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#00847A] disabled:opacity-50 transition-all"
                      >
                        {usando === p.id ? 'Copiando…' : 'Usar esta plantilla'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {esAdmin && (
              <>
                <h2 className="text-[#0D0D0D] text-sm font-semibold mb-3">Mis embudos — marca cuáles son plantilla</h2>
                {misEmbudos.length === 0 ? (
                  <div className="text-[#9A9A9A] text-sm">No tienes embudos todavía. Créalos en la pestaña Embudos.</div>
                ) : (
                  <div className="rounded-2xl border border-[#E8E8E8] overflow-hidden bg-white shadow-sm">
                    {misEmbudos.map(e => (
                      <div key={e.id} className="flex items-center justify-between px-4 py-2.5 border-t border-[#F0F0F0] first:border-t-0">
                        <div className="min-w-0">
                          <div className="text-sm text-[#0D0D0D] truncate">{e.producto}</div>
                          <div className="text-[11px] text-[#9A9A9A] font-mono">/{e.slug}</div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer shrink-0">
                          <span className="text-xs text-[#6B6B6B]">Plantilla</span>
                          <input
                            type="checkbox"
                            checked={e.es_plantilla}
                            onChange={ev => marcar(e, ev.target.checked)}
                            className="w-4 h-4 accent-[#00A89D]"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

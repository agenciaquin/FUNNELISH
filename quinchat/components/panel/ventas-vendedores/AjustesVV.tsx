'use client';

import { useEffect, useState } from 'react';

/** Interruptor del módulo + números de prueba + copia del catálogo. */
export default function AjustesVV({ onCerrar }: { onCerrar: () => void }) {
  const [a, setA] = useState<{ activo: boolean; numeros_prueba: string[]; todos_vendedores: boolean; envio_effi: string } | null>(null);
  const [vendedores, setVendedores] = useState<{ tel: string; nombre: string }[]>([]);
  const [nums, setNums] = useState('');
  const [cat, setCat] = useState<any>(null);
  const [sync, setSync] = useState<'no' | 'corriendo'>('no');
  const [msg, setMsg] = useState('');

  const cargarCat = () => fetch('/api/ventas-vendedores/catalogo', { cache: 'no-store' }).then(r => r.json()).then(setCat).catch(() => {});
  useEffect(() => {
    fetch('/api/ventas-vendedores/ajustes', { cache: 'no-store' }).then(r => r.json()).then(j => {
      setA(j.ajustes); setVendedores(j.vendedores ?? []); setNums((j.ajustes?.numeros_prueba ?? []).map((n: string) => n.replace(/^57/, '')).join(', '));
    });
    cargarCat();
  }, []);

  const guardar = async (parcial: Record<string, unknown>) => {
    const r = await fetch('/api/ventas-vendedores/ajustes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parcial) });
    const j = await r.json();
    setA(j.ajustes);
    const lista = (j.ajustes?.numeros_prueba ?? []).map((n: string) => n.replace(/^57/, ''));
    setNums(lista.join(', '));
    setMsg(`Guardado ✓ · Módulo ${j.ajustes?.activo ? 'ENCENDIDO' : 'apagado'} · Números de prueba: ${lista.length ? lista.join(', ') : 'ninguno'}`);
  };
  const actualizarCatalogo = async () => {
    setSync('corriendo'); setMsg('');
    try {
      const r = await fetch('/api/ventas-vendedores/catalogo', { method: 'POST' });
      const j = await r.json();
      setMsg(j.ok ? `Catálogo actualizado: ${j.productos} productos (${j.nuevos} nuevos, ${j.cambiados} cambiados, ${j.inactivados} retirados).` : `No se actualizó: ${j.error}`);
    } catch { setMsg('No se pudo actualizar el catálogo.'); }
    setSync('no'); cargarCat();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[16px] font-extrabold">Ajustes · Ventas Vendedores</h3>
          <button onClick={onCerrar} className="w-8 h-8 rounded-lg hover:bg-[#F1F1EF]">✕</button>
        </div>
        {!a ? <p className="text-sm text-[#8B8B86]">Cargando…</p> : (
          <div className="space-y-4 text-[13px]">
            <div className={`rounded-xl p-3 flex items-center justify-between gap-3 ${a.activo ? 'bg-[#E0F3E8]' : 'bg-[#F1F1EF]'}`}>
              <div>
                <p className="font-bold">{a.activo ? 'Módulo ENCENDIDO' : 'Módulo APAGADO'}</p>
                <p className="text-[12px] text-[#5E5E5A]">Apagado, el WhatsApp de vendedores y clientes funciona exactamente como antes.</p>
              </div>
              <button onClick={() => guardar({ activo: !a.activo })} className={`h-9 px-4 rounded-xl font-bold text-white ${a.activo ? 'bg-[#B42318]' : 'bg-[#14804A]'}`}>
                {a.activo ? 'Apagar' : 'Encender'}
              </button>
            </div>

            <label className="block">
              <span className="font-semibold">Números de prueba</span>
              <span className="block text-[12px] text-[#5E5E5A] mb-1">Celulares (10 dígitos, separados por coma) que pueden mandar ventas al bot aunque no estén en la lista de vendedores.</span>
              <div className="flex gap-2">
                <input value={nums} onChange={e => setNums(e.target.value)} placeholder="3001234567, 3109876543" className="flex-1 h-10 px-3 rounded-xl border border-[#E7E6E1] font-mono" />
                <button onClick={() => guardar({ numeros_prueba: nums.split(/[,\s]+/).map(n => n.replace(/\D/g, '')).filter(n => n.length >= 10).map(n => `57${n.slice(-10)}`) })} className="h-10 px-3 rounded-xl bg-[#141414] text-white font-bold">Guardar</button>
              </div>
              {a.numeros_prueba.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {a.numeros_prueba.map(n => <span key={n} className="text-[11.5px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#E0F3E8] text-[#14804A]">✓ {n.replace(/^57/, '')}</span>)}
                </div>
              )}
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={a.todos_vendedores} onChange={e => guardar({ todos_vendedores: e.target.checked })} className="mt-1 accent-[#A5791F]" />
              <span><b>Todos los vendedores del equipo</b> ({vendedores.length}) pueden mandar ventas. Si está apagado, solo los números de prueba.</span>
            </label>

            <div className="rounded-xl border border-[#E7E6E1] p-3">
              <p className="font-semibold">Subida a Effi</p>
              <p className="text-[12px] text-[#5E5E5A]">Modo actual: <b>{a.envio_effi === 'real' ? 'real' : 'simulación'}</b>. En simulación la solicitud se arma y se guarda, pero no se envía. El envío real necesita la documentación y las credenciales de la API de Effi.</p>
            </div>

            <div className="rounded-xl border border-[#E7E6E1] p-3">
              <p className="font-semibold">Catálogo Klixmant (copia local)</p>
              <p className="text-[12px] text-[#5E5E5A]">
                {cat ? `${cat.productos} productos activos · ${cat.variantes} variantes · última copia buena: ${cat.ultimaOk ? new Date(cat.ultimaOk).toLocaleString('es-CO') : 'nunca'}` : '…'}
              </p>
              {cat?.ultima && cat.ultima.ok === false && <p className="text-[12px] text-[#B42318] mt-1">Último intento falló: {cat.ultima.error}</p>}
              <button disabled={sync === 'corriendo'} onClick={actualizarCatalogo} className="mt-2 h-9 px-3 rounded-xl bg-[#A5791F] text-white font-bold disabled:opacity-60">
                {sync === 'corriendo' ? 'Actualizando… (puede tardar 1 min)' : '⟳ Actualizar catálogo'}
              </button>
            </div>
            {msg && <p className="text-[12.5px] text-[#14804A]">{msg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

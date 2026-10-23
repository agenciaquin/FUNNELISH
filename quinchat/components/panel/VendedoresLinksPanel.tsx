'use client';

import { useEffect, useState } from 'react';

interface Vendedor {
  id: string;
  nombre: string;
  celular: string;
  codigo: string;
  activo: boolean;
  creado_at?: string;
}

const BASE = 'https://pedido.klixmant.shop/promos';
const linkDe = (v: Vendedor) => `${BASE}?v=${v.codigo}`;

/**
 * Links de vendedores para el catálogo de Promociones.
 * Cada vendedor tiene su propio link: al abrirlo, el catálogo muestra SOLO
 * "COMPRAR POR WHATSAPP" y ese botón lleva al WhatsApp de ese vendedor.
 * Un solo catálogo para todos; 10 (o los que sean) links distintos.
 */
export default function VendedoresLinksPanel() {
  const [lista, setLista] = useState<Vendedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  function cargar() {
    setCargando(true);
    fetch('/api/vendedores-promo')
      .then(r => r.json())
      .then(d => setLista(d.vendedores ?? []))
      .catch(() => setAviso('No se pudieron cargar los vendedores.'))
      .finally(() => setCargando(false));
  }
  useEffect(() => { cargar(); }, []);

  async function agregar() {
    setAviso(null);
    if (!nombre.trim()) { setAviso('Escribe el nombre del vendedor.'); return; }
    const tel = celular.replace(/\D/g, '').slice(-10);
    if (!/^3\d{9}$/.test(tel)) { setAviso('El celular debe tener 10 dígitos y empezar por 3.'); return; }
    setGuardando(true);
    try {
      const res = await fetch('/api/vendedores-promo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), celular: tel }),
      });
      const d = await res.json();
      if (!res.ok) { setAviso(d.error || 'No se pudo guardar.'); return; }
      setNombre(''); setCelular('');
      cargar();
    } catch { setAviso('Error de conexión.'); }
    finally { setGuardando(false); }
  }

  async function eliminar(v: Vendedor) {
    if (!confirm(`¿Eliminar a "${v.nombre}"? Su link dejará de funcionar.`)) return;
    await fetch(`/api/vendedores-promo?id=${v.id}`, { method: 'DELETE' });
    cargar();
  }

  async function toggleActivo(v: Vendedor) {
    await fetch('/api/vendedores-promo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: v.id, nombre: v.nombre, celular: v.celular, activo: !v.activo }),
    });
    cargar();
  }

  function copiar(v: Vendedor) {
    const link = linkDe(v);
    navigator.clipboard?.writeText(link);
    setCopiado(v.id);
    setTimeout(() => setCopiado(c => (c === v.id ? null : c)), 1800);
  }

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto bg-[#FAF9F6]">
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-6 max-w-4xl mx-auto pb-24">
        <header className="mb-4 pl-10 md:pl-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">🔗 Links de vendedores</h1>
          <p className="text-xs text-[#6B6B6B] mt-1">
            Un solo catálogo de promociones para todos. Cada vendedor tiene su propio link:
            al abrirlo, el cliente solo ve <b>COMPRAR POR WHATSAPP</b> y ese botón lo lleva
            directo al WhatsApp de ese vendedor.
          </p>
        </header>

        {/* Alta de vendedor */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-4 mb-4">
          <div className="text-[12px] font-bold text-[#0D0D0D] mb-2">➕ Agregar vendedor</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Nombre del vendedor"
              className="flex-1 px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm focus:outline-none focus:border-[#00A89D]"
            />
            <input
              value={celular} onChange={e => setCelular(e.target.value)}
              placeholder="Celular WhatsApp (10 dígitos)" inputMode="numeric"
              className="flex-1 px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm focus:outline-none focus:border-[#00A89D]"
            />
            <button
              onClick={agregar} disabled={guardando}
              className="px-4 py-2 rounded-lg bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A] disabled:opacity-50 whitespace-nowrap"
            >{guardando ? 'Guardando…' : 'Agregar'}</button>
          </div>
          {aviso && <p className="text-[12px] text-[#C0392B] font-semibold mt-2">⚠️ {aviso}</p>}
        </div>

        {/* Lista */}
        {cargando ? (
          <p className="text-sm text-[#6B6B6B] py-6 text-center">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-[#6B6B6B] py-6 text-center">Aún no has agregado vendedores. Agrega el primero arriba 👆</p>
        ) : (
          <div className="flex flex-col gap-2">
            {lista.map(v => (
              <div key={v.id} className={`bg-white rounded-2xl border border-[#E8E8E8] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 ${v.activo ? '' : 'opacity-60'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold text-[#0D0D0D]">{v.nombre}</span>
                    {!v.activo && <span className="text-[10px] font-bold text-[#C0392B] bg-[#FDECEA] px-2 py-0.5 rounded-full">Inactivo</span>}
                  </div>
                  <div className="text-[12px] text-[#6B6B6B]">📱 {v.celular}</div>
                  <a href={linkDe(v)} target="_blank" rel="noreferrer" className="text-[12px] text-[#00847A] font-semibold underline break-all">{linkDe(v)}</a>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <button
                    onClick={() => copiar(v)}
                    className="px-3 py-2 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A] whitespace-nowrap"
                  >{copiado === v.id ? '✓ Copiado' : '📋 Copiar link'}</button>
                  <a
                    href={`https://wa.me/57${v.celular}?text=${encodeURIComponent('¡Hola! Este es tu catálogo de promociones: ' + linkDe(v))}`}
                    target="_blank" rel="noreferrer"
                    className="px-3 py-2 rounded-lg bg-[#25D366] text-white text-xs font-semibold hover:brightness-105 whitespace-nowrap"
                    title="Enviarle el link por WhatsApp"
                  >Enviar</a>
                  <button
                    onClick={() => toggleActivo(v)}
                    className="px-3 py-2 rounded-lg border border-[#E0E0E0] text-[#6B6B6B] text-xs font-semibold hover:bg-[#F4F4F4] whitespace-nowrap"
                  >{v.activo ? 'Desactivar' : 'Activar'}</button>
                  <button
                    onClick={() => eliminar(v)}
                    className="px-2.5 py-2 rounded-lg border border-[#F0D0D0] text-[#C0392B] text-xs font-semibold hover:bg-[#FDECEA]"
                    title="Eliminar"
                  >🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { identificarCatalogos, type CatalogoKlixmant } from '@/lib/klixmant-identificar';

// Vista previa de los catálogos de Klixmant. Solo lee: las casillas no se guardan todavía.
export default function KlixmantPreview({ onClose }: { onClose: () => void }) {
  const [datos, setDatos] = useState<{ catalogos: CatalogoKlixmant[]; categorias: string[]; muestra: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activas, setActivas] = useState<Set<string>>(new Set());
  const [texto, setTexto] = useState('');

  useEffect(() => {
    fetch('/api/klixmant/catalogos')
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
        setDatos(d);
        setActivas(new Set(d.categorias));
      })
      .catch(e => setError(e.message));
  }, []);

  const candidatos = useMemo(
    () => (datos && texto.trim() ? identificarCatalogos(texto, datos.catalogos, activas) : []),
    [datos, texto, activas],
  );

  const alternar = (cat: string) => setActivas(prev => {
    const s = new Set(prev);
    s.has(cat) ? s.delete(cat) : s.add(cat);
    return s;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="font-bold text-[#1A1A1A]">Catálogos de Klixmant</h2>
            <p className="text-xs text-[#6B6B6B]">
              Vista previa · no guarda nada
              {datos?.muestra && <span className="ml-2 text-[#B45309] font-semibold">· MUESTRA (falta la llave de la API)</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-2xl text-[#6B6B6B] hover:text-[#1A1A1A]" aria-label="Cerrar">×</button>
        </div>

        {error && <p className="px-6 py-4 text-sm text-[#DC2626]">❌ {error}</p>}
        {!datos && !error && <p className="px-6 py-4 text-sm text-[#6B6B6B]">Cargando…</p>}

        {datos && (
          <div className="p-6 space-y-6">
            <section>
              <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Lo que escribe el cliente</label>
              <input
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder="Ej: hola, quiero el buzo new york en negro"
                className="w-full px-4 py-2.5 border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:border-[#00A89D]"
              />
              {texto.trim() && (
                <div className="mt-3 text-sm">
                  {candidatos.length === 0 ? (
                    <p className="text-[#6B6B6B]">No reconoce ningún catálogo: el bot seguiría como hoy.</p>
                  ) : (
                    <ul className="space-y-1">
                      {candidatos.map((c, i) => (
                        <li key={c.catalogo.id} className={i === 0 ? 'font-semibold text-[#00847A]' : 'text-[#1A1A1A]'}>
                          #{c.catalogo.id} · {c.catalogo.nombre} · {c.catalogo.categoria}
                          {c.colores.length > 0 && <span> · color: {c.colores.join(', ')}</span>}
                        </li>
                      ))}
                      {candidatos.length > 1 && candidatos[0].puntos === candidatos[1].puntos && (
                        <li className="text-xs text-[#B45309]">Empate: el bot tendría que preguntar el color.</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {datos.categorias.map(cat => {
              const lista = datos.catalogos.filter(c => c.categoria === cat);
              return (
                <section key={cat}>
                  <label className="flex items-center gap-2 font-semibold text-sm text-[#1A1A1A] mb-2">
                    <input type="checkbox" checked={activas.has(cat)} onChange={() => alternar(cat)} />
                    {cat} <span className="text-[#6B6B6B] font-normal">({lista.length})</span>
                  </label>
                  <ul className={`grid sm:grid-cols-2 gap-1 text-xs ${activas.has(cat) ? '' : 'opacity-40'}`}>
                    {lista.map(c => (
                      <li key={c.id} className="px-3 py-1.5 bg-[#F7F7F7] rounded-lg">
                        <span className="text-[#6B6B6B]">#{c.id}</span> {c.nombre}
                        <span className="text-[#6B6B6B]"> · {c.colores.join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

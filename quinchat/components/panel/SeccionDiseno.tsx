'use client';

import { useEffect, useState } from 'react';
import EditorBloques from './EditorBloques';
import { layoutPorDefecto, type LayoutEmbudo } from '@/lib/bloques';

interface Plantilla {
  id: string;
  nombre: string;
  categoria: string | null;
  tipo: 'diseno' | 'completa';
  layout: LayoutEmbudo | null;
  datos: any | null;
}

/**
 * Sección "Diseño de la página" dentro del editor de embudo:
 * editor libre de bloques + usar una plantilla + guardar como plantilla.
 */
export default function SeccionDiseno({
  actual, set, setActual, setAviso,
}: {
  actual: any;
  set: (campo: any, valor: any) => void;
  setActual: (fn: any) => void;
  setAviso: (s: any) => void;
}) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [guardarOpen, setGuardarOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = () =>
    fetch('/api/funnels/plantillas', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setPlantillas(d.plantillas ?? []))
      .catch(() => {});

  useEffect(() => { cargar(); }, []);

  function usarPlantilla(id: string) {
    const p = plantillas.find(x => x.id === id);
    if (!p) return;
    if (p.tipo === 'completa' && p.datos) {
      if (!confirm(`Usar la plantilla "${p.nombre}" reemplazará el contenido de este embudo (fotos, precio, textos). Se conserva la dirección. ¿Seguir?`)) return;
      setActual((a: any) => ({ ...a, ...p.datos, slug: a.slug, activo: a.activo }));
      setAviso(`✅ Se aplicó la plantilla "${p.nombre}". Revisa y guarda.`);
    } else {
      set('layout', p.layout ?? null);
      setAviso(`✅ Diseño "${p.nombre}" aplicado. Revisa y guarda.`);
    }
  }

  async function guardarComo(tipo: 'diseno' | 'completa') {
    const nom = nombre.trim();
    if (!nom) { alert('Escribe un nombre para la plantilla.'); return; }
    setOcupado(true);
    try {
      const layout: LayoutEmbudo = actual.layout ?? { bloques: layoutPorDefecto() };
      const body = tipo === 'completa'
        ? { nombre: nom, tipo, layout, datos: { ...actual, slug: undefined } }
        : { nombre: nom, tipo, layout };
      const r = await fetch('/api/funnels/plantillas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'No se pudo guardar la plantilla.'); return; }
      setAviso(`✅ Plantilla "${nom}" guardada. Ya puedes usarla en otros embudos.`);
      setGuardarOpen(false); setNombre('');
      cargar();
    } finally { setOcupado(false); }
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-bold">🧩 Diseño de la página <span className="text-[11px] font-normal text-[#9A9A9A]">(bloques)</span></h2>
          <p className="text-[11px] text-[#6B6B6B] mt-1">Ordena, prende o apaga cada bloque. Puedes partir de una plantilla.</p>
        </div>
        <div className="flex items-center gap-2">
          {plantillas.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) { usarPlantilla(e.target.value); e.target.value = ''; } }}
              className="px-2.5 py-2 rounded-lg border border-[#E8E8E8] text-xs bg-white"
              title="Usar una plantilla como base"
            >
              <option value="">📋 Usar plantilla…</option>
              {plantillas.map(p => (
                <option key={p.id} value={p.id}>
                  {p.tipo === 'completa' ? '📦' : '🎨'} {p.nombre}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setGuardarOpen(v => !v)}
            className="px-3 py-2 rounded-lg border border-[#00A89D]/40 text-[#00847A] text-xs font-semibold hover:bg-[#00A89D]/10"
          >💾 Guardar como plantilla</button>
        </div>
      </div>

      {guardarOpen && (
        <div className="rounded-xl border border-[#00A89D]/30 bg-[#00A89D]/5 p-3 space-y-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la plantilla (ej: Deportivo F1)"
            className="w-full px-3 py-2 rounded-lg border border-[#E8E8E8] text-sm focus:outline-none focus:border-[#00A89D]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => guardarComo('diseno')}
              disabled={ocupado}
              className="flex-1 py-2 rounded-lg bg-white border border-[#00A89D]/40 text-[#00847A] text-xs font-semibold hover:bg-[#00A89D]/10 disabled:opacity-50"
              title="Guarda solo el diseño (bloques/orden) para reusar en cualquier producto"
            >🎨 Solo diseño</button>
            <button
              onClick={() => guardarComo('completa')}
              disabled={ocupado}
              className="flex-1 py-2 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A] disabled:opacity-50"
              title="Guarda el embudo completo (con fotos y precio) para duplicarlo"
            >📦 Embudo completo</button>
          </div>
          <p className="text-[10px] text-[#6B6B6B] leading-snug">
            <b>Solo diseño</b>: reutilizas el orden de bloques en otros productos.
            <b> Embudo completo</b>: guardas todo (fotos, precio, textos) para duplicarlo tal cual.
          </p>
        </div>
      )}

      <EditorBloques
        value={actual.layout ?? null}
        onChange={(l) => set('layout', l)}
      />
    </section>
  );
}

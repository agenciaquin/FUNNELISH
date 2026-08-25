'use client';

import { useEffect, useState, useCallback } from 'react';
import EditorBloques from './EditorBloques';
import { layoutPorDefecto, type LayoutEmbudo } from '@/lib/bloques';

interface Plantilla {
  id: string;
  nombre: string;
  categoria: string | null;
  tipo: 'diseno' | 'completa';
  layout: LayoutEmbudo | null;
  datos: any | null;
  creado_at: string;
}

type Editando =
  | { modo: 'nuevo'; nombre: string; categoria: string; layout: LayoutEmbudo | null }
  | { modo: 'editar'; id: string; nombre: string; categoria: string; layout: LayoutEmbudo | null; tipo: 'diseno' | 'completa'; datos: any | null }
  | null;

/** Panel de PLANTILLAS DE EMBUDO (diseños reutilizables de la página de venta). */
export default function PlantillasEmbudoPanel({ onClose, onUsar }: { onClose: () => void; onUsar: (p: Plantilla) => void }) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [edit, setEdit] = useState<Editando>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch('/api/funnels/plantillas', { cache: 'no-store' });
      const d = await r.json();
      setPlantillas(d.plantillas ?? []);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardar() {
    if (!edit) return;
    if (!edit.nombre.trim()) { alert('Escribe un nombre para la plantilla.'); return; }
    setGuardando(true);
    try {
      const esNuevo = edit.modo === 'nuevo';
      const body: any = {
        nombre: edit.nombre.trim(),
        categoria: edit.categoria.trim() || null,
        layout: edit.layout ?? { bloques: layoutPorDefecto() },
      };
      if (esNuevo) body.tipo = 'diseno';
      else { body.id = (edit as any).id; body.tipo = (edit as any).tipo; }

      const r = await fetch('/api/funnels/plantillas', {
        method: esNuevo ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'No se pudo guardar.'); return; }
      setEdit(null);
      await cargar();
    } finally { setGuardando(false); }
  }

  async function borrar(p: Plantilla) {
    if (!confirm(`¿Borrar la plantilla "${p.nombre}"?`)) return;
    await fetch(`/api/funnels/plantillas?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
    await cargar();
  }

  async function duplicar(p: Plantilla) {
    setGuardando(true);
    try {
      await fetch('/api/funnels/plantillas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: `${p.nombre} (copia)`, categoria: p.categoria, tipo: p.tipo, layout: p.layout, datos: p.datos }),
      });
      await cargar();
    } finally { setGuardando(false); }
  }

  // ── Editor de una plantilla ────────────────────────────────────────────────
  if (edit) {
    return (
      <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
          <button onClick={() => setEdit(null)} className="text-xs text-[#00A89D] font-semibold hover:underline mb-4">← Volver a plantillas</button>
          <h1 className="text-lg font-bold mb-4">{edit.modo === 'nuevo' ? 'Nueva plantilla de diseño' : 'Editar plantilla'}</h1>

          <div className="space-y-4">
            <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Nombre</label>
                <input
                  value={edit.nombre}
                  onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
                  placeholder="Deportivo F1"
                  className="w-full px-3 py-2 rounded-lg border border-[#E8E8E8] text-sm focus:outline-none focus:border-[#00A89D]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Categoría <span className="text-[#9A9A9A] font-normal">(opcional)</span></label>
                <input
                  value={edit.categoria}
                  onChange={(e) => setEdit({ ...edit, categoria: e.target.value })}
                  placeholder="Deportes, Streetwear, Moteros…"
                  className="w-full px-3 py-2 rounded-lg border border-[#E8E8E8] text-sm focus:outline-none focus:border-[#00A89D]"
                />
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4 space-y-3">
              <h2 className="text-sm font-bold">🧩 Bloques de la página</h2>
              {edit.modo === 'editar' && (edit as any).tipo === 'completa' && (
                <p className="text-[11px] text-[#B45309] bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-2">
                  Esta es una plantilla de <b>embudo completo</b>: aquí editas su diseño; el contenido (fotos/precio) se aplica al usarla en un embudo nuevo.
                </p>
              )}
              <EditorBloques
                value={edit.layout}
                onChange={(l) => setEdit({ ...edit, layout: l })}
              />
            </section>

            <div className="flex gap-2 pb-8">
              <button onClick={() => setEdit(null)} className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-sm text-[#6B6B6B] hover:bg-[#F5F5F5]">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="flex-1 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A] disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar plantilla'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Lista de plantillas ────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
        <header className="flex items-start justify-between gap-3 mb-5 flex-wrap">
          <div>
            <button onClick={onClose} className="text-xs text-[#00A89D] font-semibold hover:underline mb-1">← Volver a embudos</button>
            <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">Plantillas</h1>
            <p className="text-xs text-[#6B6B6B] mt-1">Diseños reutilizables para tus páginas de venta.</p>
          </div>
          <button
            onClick={() => setEdit({ modo: 'nuevo', nombre: '', categoria: '', layout: { bloques: layoutPorDefecto() } })}
            className="px-4 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A]"
          >+ Nueva plantilla</button>
        </header>

        {cargando ? (
          <p className="text-sm text-[#6B6B6B] py-10 text-center">Cargando…</p>
        ) : plantillas.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-sm text-[#6B6B6B] mb-3">Aún no tienes plantillas.</p>
            <p className="text-xs text-[#9A9A9A] leading-relaxed max-w-md mx-auto">
              Crea una aquí, o desde el editor de un embudo usa <b>“Guardar como plantilla”</b> para reutilizar un diseño que te gustó.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {plantillas.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-[#E8E8E8] p-4 shadow-sm flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-[#00A89D]/10 flex items-center justify-center text-lg shrink-0">
                  {p.tipo === 'completa' ? '📦' : '🎨'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate">{p.nombre}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-[#00847A] bg-[#00A89D]/10">
                      {p.tipo === 'completa' ? 'Embudo completo' : 'Diseño'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6B6B6B] truncate">
                    {p.categoria ? `${p.categoria} · ` : ''}{p.layout?.bloques?.length ?? 0} bloques
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onUsar(p)}
                    className="px-3 py-1.5 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A]"
                    title="Crear un embudo nuevo con esta plantilla"
                  >➕ Usar</button>
                  <button
                    onClick={() => setEdit({ modo: 'editar', id: p.id, nombre: p.nombre, categoria: p.categoria ?? '', layout: p.layout, tipo: p.tipo, datos: p.datos })}
                    className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs hover:bg-[#F5F5F5]"
                  >Editar</button>
                  <button
                    onClick={() => duplicar(p)}
                    disabled={guardando}
                    className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs hover:bg-[#F5F5F5] disabled:opacity-50"
                  >⧉ Duplicar</button>
                  <button onClick={() => borrar(p)} className="w-8 h-8 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2]">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

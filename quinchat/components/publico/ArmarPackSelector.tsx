'use client';

import { useState, useEffect } from 'react';
import { normalizarOpciones } from '@/lib/funnels';
import type { ArmarPackConfig } from '@/lib/funnels';

export interface PackSalida {
  completo: boolean;
  buzos: { escuderia: string; color: string; talla: string; foto: string | null }[];
  seleccion: string;   // "RED BULL NEGRO L + MCLAREN BLANCO M"
  producto: string;    // "PACK X2 — RED BULL + MCLAREN"
  fotos: string[];     // fotos reales de cada color (para el collage)
}

/**
 * Constructor "ARMA TU PACK": el cliente elige, por cada buzo, escudería → color
 * → talla, en cascada (una decisión a la vez). Fácil e intuitivo: no se muestra
 * el color hasta elegir la escudería, ni la talla hasta elegir el color.
 */
export default function ArmarPackSelector({
  config, acento, onChange,
}: {
  config: ArmarPackConfig;
  acento: { boton: string; texto: string };
  onChange: (s: PackSalida) => void;
}) {
  const unidades = Math.max(1, config.unidades || 2);
  const tallas = config.tallas ?? [];
  // Etiquetas editables (no siempre es "escudería"/"buzo": puede ser marca, equipo, pareja…)
  const catLabel = (config.labelCategoria ?? '').trim() || 'escudería';
  const prendaLabel = (config.labelPrenda ?? '').trim() || 'buzo';
  const PRENDA = prendaLabel.toUpperCase();
  const [buzos, setBuzos] = useState(
    Array.from({ length: unidades }, () => ({ escuderia: '', color: '', talla: '' })),
  );
  // Qué miniatura está agrandada temporalmente (al tocarla)
  const [zoomBuzo, setZoomBuzo] = useState<number | null>(null);
  const verGrande = (i: number, ms = 1000) => {
    setZoomBuzo(i);
    setTimeout(() => setZoomBuzo(z => (z === i ? null : z)), ms);
  };

  const coloresDe = (escuderia: string) =>
    normalizarOpciones(config.categorias.find(c => c.nombre === escuderia)?.colores ?? []);
  const fotoDe = (escuderia: string, color: string): string | null =>
    coloresDe(escuderia).find(o => o.valor === color)?.imagen ?? null;

  // Colores que TODAS las escuderías seleccionadas COMPARTEN (se muestran de una).
  // Al elegir una escudería se le suman sus colores adicionales.
  const coloresCompartidos = (() => {
    const cats = config.categorias.map(c => normalizarOpciones(c.colores));
    if (cats.length === 0) return [];
    return cats[0].filter(o =>
      cats.every(cat => cat.some(x => x.valor.toUpperCase() === o.valor.toUpperCase())),
    );
  })();
  // Opciones de color de un buzo: si ya eligió escudería → todos los colores de esa
  // escudería (compartidos + sus extras); si no → solo los compartidos.
  const opcionesColor = (escuderia: string) => escuderia ? coloresDe(escuderia) : coloresCompartidos;

  // Palabras COMUNES a todas las categorías (ej. "BUZO MOTO … REFLECTIVO").
  // Las que NO son comunes son la MARCA distintiva → se resaltan en un badge.
  const palabrasComunes = (() => {
    const listas = config.categorias.map(c => String(c.nombre ?? '').toUpperCase().split(/\s+/).filter(Boolean));
    if (listas.length <= 1) return new Set<string>();
    return new Set(listas[0].filter(w => listas.every(l => l.includes(w))));
  })();
  /** Muestra el nombre con la MARCA resaltada en un badge. */
  const nombreConMarca = (nombre: string, activo: boolean) => {
    const palabras = String(nombre ?? '').split(/\s+/).filter(Boolean);
    return (
      <span className="leading-tight">
        {palabras.map((w, wi) => palabrasComunes.has(w.toUpperCase())
          ? <span key={wi}>{w}{' '}</span>
          : (
            <span key={wi}>
              <span
                className="inline-block font-extrabold rounded px-1"
                style={activo ? { background: '#fff', color: acento.texto } : { background: '#F97316', color: '#fff' }}
              >{w}</span>{' '}
            </span>
          ))}
      </span>
    );
  };

  const set = (i: number, patch: Partial<{ escuderia: string; color: string; talla: string }>) => {
    setBuzos(prev => prev.map((b, idx) => {
      if (idx !== i) return b;
      const next = { ...b, ...patch };
      // Al cambiar de escudería, conserva el color si la nueva también lo tiene
      if (patch.escuderia !== undefined && patch.escuderia !== b.escuderia) {
        const tiene = coloresDe(patch.escuderia).some(o => o.valor.toUpperCase() === (b.color ?? '').toUpperCase());
        if (!tiene) next.color = '';
      }
      return next;
    }));
  };

  useEffect(() => {
    const completos = buzos.map(b => ({ ...b, foto: fotoDe(b.escuderia, b.color) }));
    const completo = buzos.every(b => b.escuderia && b.color && b.talla);
    const seleccion = completos.map(b => `${b.escuderia} ${b.color} ${b.talla}`.trim()).filter(Boolean).join(' + ');
    const escuderias = [...new Set(buzos.map(b => b.escuderia).filter(Boolean))];
    const producto = unidades === 1
      ? (completos[0]?.escuderia ? `${completos[0].escuderia}${completos[0].color ? ` - ${completos[0].color}` : ''}` : `ARMA TU ${PRENDA}`)
      : `PACK X${unidades} — ${escuderias.join(' + ') || 'ARMA TU PACK'}`;
    const fotos = completos.map(b => b.foto).filter((f): f is string => !!f && f.startsWith('http'));
    onChange({ completo, buzos: completos, seleccion, producto, fotos });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buzos]);

  const Chip = ({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      style={activo ? { borderColor: acento.boton, background: acento.boton, color: '#fff' } : {}}
      className={`px-2 py-1 rounded-lg border-2 text-[10.5px] leading-tight font-semibold text-center break-words transition-all ${activo ? '' : 'border-[#E0E0E0] text-[#333] bg-white hover:border-[#BDBDBD]'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="px-3 space-y-2.5">
      <style>{`
        @keyframes quinLatido { 0%,100%{transform:scale(1)} 50%{transform:scale(1.035)} }
        .quin-latido { animation: quinLatido 1.1s ease-in-out infinite; }
        @keyframes quinPop { 0%{transform:scale(1)} 45%{transform:scale(2.6)} 100%{transform:scale(1)} }
        .quin-pop { animation: quinPop 0.6s ease; }
      `}</style>
      <p className="text-center text-[11.5px] text-[#6B6B6B]">
        🧩 Arma tu {unidades > 1 ? `pack de ${unidades}` : prendaLabel}: completa <b>{catLabel}, color y talla</b>{unidades > 1 ? ` de cada ${prendaLabel}` : ''}.
      </p>
      {buzos.map((b, i) => {
        const listo = b.escuderia && b.color && b.talla;
        // Paso actual del buzo: 1=escudería, 2=color, 3=talla, 4=listo
        const paso = !b.escuderia ? 1 : !b.color ? 2 : !b.talla ? 3 : 4;
        // Marcador animado: el paso ACTUAL rebota (👉) para guiar al cliente
        const marca = (n: number) => (
          <span className={`inline-block ${paso === n ? 'animate-bounce' : ''}`}>
            {paso > n ? '✅' : paso === n ? '👉' : `${n}️⃣`}
          </span>
        );
        return (
          <div
            key={i}
            data-campo={`buzo-${i}`}
            className="rounded-xl border-2"
            style={{ borderColor: listo ? acento.boton : '#3DC12A' }}
          >
            {/* Banner: Paso X de N · ELIGE BUZO X */}
            <div className="bg-[#0D0D0D] text-white rounded-t-lg px-3 py-1.5 flex items-center justify-center gap-2">
              {unidades > 1 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20">Paso {i + 1} de {unidades}</span>}
              <span className="font-extrabold text-[13px] tracking-wide">{unidades > 1 ? `ELIGE ${PRENDA} ${i + 1}` : `ELIGE TU ${PRENDA}`}</span>
            </div>

            <div className="p-2 space-y-2">
              {/* Escudería: fila completa arriba (respira mejor en móvil) */}
              <div className={`rounded-lg p-1.5 -m-1.5 ${paso === 1 ? 'ring-2 ring-offset-1' : ''}`} style={paso === 1 ? { ['--tw-ring-color' as any]: acento.boton } : {}}>
                <p className="text-center text-[12px] font-extrabold mb-1.5" style={{ color: acento.texto }}>{marca(1)} Elige la {catLabel}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {config.categorias.map(c => (
                    <Chip key={c.nombre} activo={b.escuderia === c.nombre} onClick={() => set(i, { escuderia: c.nombre })}>
                      {nombreConMarca(c.nombre, b.escuderia === c.nombre)}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Color y talla: DESPLEGABLES (2 columnas) */}
              <div className="grid grid-cols-2 gap-2">
                {/* Color: desplegable con los colores compartidos + extras de la escudería */}
                <div className={`rounded-lg p-1 ${paso === 2 ? 'ring-2 ring-offset-1 quin-latido' : ''}`} style={paso === 2 ? { ['--tw-ring-color' as any]: acento.boton } : {}}>
                  <p className="text-center text-[12px] font-extrabold mb-1" style={{ color: acento.texto }}>{marca(2)} Elige el color</p>
                  <div className="flex items-center gap-1.5">
                    {(() => { const f = fotoDe(b.escuderia, b.color); return f ? (
                      <button
                        type="button"
                        onClick={() => verGrande(i)}
                        className="shrink-0 relative"
                        style={{
                          transition: 'transform .25s ease',
                          transform: zoomBuzo === i ? 'scale(5)' : 'scale(1)',
                          zIndex: zoomBuzo === i ? 50 : undefined,
                        }}
                        title="Toca para ver el color en grande"
                      >
                        {/* key = color → al cambiar de color, la foto "salta" (pop) */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img key={`${b.escuderia}-${b.color}`} src={f} alt="" className="w-8 h-8 object-cover rounded quin-pop" loading="lazy" />
                      </button>
                    ) : (
                      <span className="w-8 h-8 rounded bg-[#F2F2F2] shrink-0 flex items-center justify-center text-[12px] text-[#CCC]">🎨</span>
                    ); })()}
                    <select
                      value={b.color}
                      onChange={e => set(i, { color: e.target.value })}
                      className="flex-1 min-w-0 px-1.5 py-1.5 rounded-lg border-2 border-[#E0E0E0] text-[12px] font-semibold bg-white focus:outline-none"
                      style={b.color ? { borderColor: acento.boton } : {}}
                    >
                      <option value="">— Elige color —</option>
                      {opcionesColor(b.escuderia).map(o => (
                        <option key={o.valor} value={o.valor}>{o.valor}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Talla: desplegable */}
                <div className={`rounded-lg p-1 ${paso === 3 ? 'ring-2 ring-offset-1 quin-latido' : ''}`} style={paso === 3 ? { ['--tw-ring-color' as any]: acento.boton } : {}}>
                  <p className="text-center text-[12px] font-extrabold mb-1" style={{ color: acento.texto }}>{marca(3)} Elige la talla</p>
                  <select
                    value={b.talla}
                    onChange={e => set(i, { talla: e.target.value })}
                    className="w-full min-w-0 px-1.5 py-1.5 rounded-lg border-2 border-[#E0E0E0] text-[12px] font-semibold bg-white focus:outline-none"
                    style={b.talla ? { borderColor: acento.boton } : {}}
                  >
                    <option value="">— Elige talla —</option>
                    {tallas.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Guía didáctica: qué paso sigue */}
            <div className="px-2 pb-1.5">
              {paso === 1 && <p className="text-center text-[12px] font-bold" style={{ color: acento.texto }}>👇 Empieza eligiendo la <b>{catLabel}</b></p>}
              {paso === 2 && <p className="text-center text-[12px] font-bold" style={{ color: acento.texto }}>👉 ¡Bien! Ahora elige el <b>color</b></p>}
              {paso === 3 && <p className="text-center text-[12px] font-bold" style={{ color: acento.texto }}>👉 Ya casi: elige la <b>talla</b></p>}
              {paso === 4 && (
                <p className="text-center text-[12px] font-bold text-white rounded-md py-1" style={{ background: acento.boton }}>
                  ✅ {b.escuderia} · {b.color} · {b.talla} — ¡Buzo {i + 1} listo!
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Cuando TODO está completo: letrero + flecha llevando a los datos de envío */}
      {buzos.every(b => b.escuderia && b.color && b.talla) && (
        <div className="text-center">
          <p className="inline-block text-[13px] font-extrabold text-white rounded-lg py-2 px-4" style={{ background: acento.boton }}>
            ✅ ¡Todo listo! Ingresa abajo tus datos de envío
          </p>
          <div className="text-4xl leading-none animate-bounce" style={{ color: acento.boton }}>👇</div>
        </div>
      )}
    </div>
  );
}

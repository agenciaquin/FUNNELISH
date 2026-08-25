'use client';

import { useState } from 'react';

interface Opcion { valor: string; imagen?: string; familia?: string }
const uidColor = (c: Opcion) => `${(c.familia ?? '').toLowerCase()}::${c.valor.toLowerCase()}`;
interface Selector { etiqueta: string; grupo?: string; opciones: (string | Opcion)[] }

const norm = (ops: (string | Opcion)[]): Opcion[] =>
  (ops ?? []).map(o => (typeof o === 'string' ? { valor: o } : o)).filter(o => o?.valor);

export const TALLAS_DAMA   = ['S DAMA', 'M DAMA', 'L DAMA', 'XL DAMA', 'XXL DAMA', 'XXXL DAMA'];
export const TALLAS_HOMBRE = ['S HOMBRE', 'M HOMBRE', 'L HOMBRE', 'XL HOMBRE', 'XXL HOMBRE', 'XXXL HOMBRE'];

export function selectoresPareja(): Selector[] {
  return [
    { grupo: 'DAMA',      etiqueta: 'COLOR', opciones: [] },
    { grupo: 'DAMA',      etiqueta: 'TALLA', opciones: TALLAS_DAMA.map(valor => ({ valor })) },
    { grupo: 'CABALLERO', etiqueta: 'COLOR', opciones: [] },
    { grupo: 'CABALLERO', etiqueta: 'TALLA', opciones: TALLAS_HOMBRE.map(valor => ({ valor })) },
  ];
}

export const TALLAS_POLO = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export function selectoresPolos(unidades = 2): Selector[] {
  const out: Selector[] = [];
  for (let n = 1; n <= unidades; n++) {
    out.push({ grupo: `POLO ${n}`, etiqueta: 'COLOR', opciones: [] });
    out.push({ grupo: `POLO ${n}`, etiqueta: 'TALLA', opciones: TALLAS_POLO.map(valor => ({ valor })) });
  }
  return out;
}

export default function EditorPareja({
  selectores, onChange, coloresCatalogo, titulo,
}: {
  selectores: Selector[];
  onChange: (s: Selector[]) => void;
  coloresCatalogo: Opcion[];
  titulo?: string;
}) {
  const [impGrupo, setImpGrupo] = useState<string | null>(null);
  const [impSel, setImpSel]     = useState<Set<string>>(new Set());
  const [impBusca, setImpBusca] = useState('');
  const [nuevoColor, setNuevoColor] = useState<Record<string, string>>({});
  const [nuevaTalla, setNuevaTalla] = useState<Record<string, string>>({});
  const [impTodos, setImpTodos] = useState(false);

  const grupos = [...new Set(selectores.map(s => (s.grupo ?? '').trim()).filter(Boolean))];
  const esPolos = grupos.some(g => /polo/i.test(g));

  const sel = (grupo: string, tipo: 'COLOR' | 'TALLA') =>
    selectores.find(s => (s.grupo ?? '') === grupo && new RegExp(tipo, 'i').test(s.etiqueta));

  const conOpciones = (sels: Selector[], grupo: string, tipo: 'COLOR' | 'TALLA', ops: Opcion[]): Selector[] => {
    let encontrado = false;
    const next = sels.map(s => {
      if ((s.grupo ?? '') === grupo && new RegExp(tipo, 'i').test(s.etiqueta)) { encontrado = true; return { ...s, opciones: ops }; }
      return s;
    });
    if (!encontrado) next.push({ grupo, etiqueta: tipo, opciones: ops });
    return next;
  };

  const setOpciones = (grupo: string, tipo: 'COLOR' | 'TALLA', ops: Opcion[]) =>
    onChange(conOpciones(selectores, grupo, tipo, ops));

  const agregarPolo = () => {
    const nums = grupos.map(g => parseInt((g.match(/\d+/) || ['0'])[0], 10)).filter(n => n > 0);
    const n = (nums.length ? Math.max(...nums) : grupos.length) + 1;
    const nuevo = `POLO ${n}`;
    const ultimaTalla = norm(sel(grupos[grupos.length - 1], 'TALLA')?.opciones ?? []);
    onChange([
      ...selectores,
      { grupo: nuevo, etiqueta: 'COLOR', opciones: [] },
      { grupo: nuevo, etiqueta: 'TALLA', opciones: ultimaTalla.length ? ultimaTalla : TALLAS_POLO.map(valor => ({ valor })) },
    ]);
  };

  const quitarGrupo = (grupo: string) => onChange(selectores.filter(s => (s.grupo ?? '') !== grupo));

  const renombrarGrupo = (viejo: string, nuevo: string) =>
    onChange(selectores.map(s => ((s.grupo ?? '') === viejo ? { ...s, grupo: nuevo } : s)));

  const agregarColor = (grupo: string, valor: string, imagen?: string) => {
    const v = valor.trim(); if (!v) return;
    const ops = norm(sel(grupo, 'COLOR')?.opciones ?? []);
    if (ops.some(o => o.valor.toLowerCase() === v.toLowerCase())) return;
    setOpciones(grupo, 'COLOR', [...ops, { valor: v, ...(imagen ? { imagen } : {}) }]);
  };

  const confirmarImport = (grupo: string) => {
    const destinos = impTodos ? grupos : [grupo];
    let next = selectores;
    for (const gr of destinos) {
      const ops = norm(next.find(s => (s.grupo ?? '') === gr && /color/i.test(s.etiqueta))?.opciones ?? []);
      const vistos = new Set(ops.map(o => o.valor.toLowerCase()));
      const nuevos: Opcion[] = [];
      for (const c of coloresCatalogo) {
        if (!impSel.has(uidColor(c))) continue;
        const k = c.valor.toLowerCase();
        if (vistos.has(k)) continue;
        vistos.add(k);
        nuevos.push({ valor: c.valor, imagen: c.imagen });
      }
      next = conOpciones(next, gr, 'COLOR', [...ops, ...nuevos]);
    }
    onChange(next);
    setImpGrupo(null); setImpSel(new Set()); setImpBusca(''); setImpTodos(false);
  };

  const chip = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#E0E0E0] text-[11px] bg-white';
  const mini = 'px-2 py-1.5 rounded-md border border-[#E8E8E8] text-xs focus:outline-none focus:border-[#00A89D]';

  return (
    <div className="mt-2 rounded-xl border-2 border-[#EC4899]/40 bg-[#EC4899]/5 p-3 space-y-3">
      <p className="text-[12px] font-bold text-[#9D174D]">{titulo ?? '👫 Producto PAREJA · cada lado con sus colores y tallas'}</p>

      {grupos.map((grupo, gi) => {
        const colores = norm(sel(grupo, 'COLOR')?.opciones ?? []);
        const tallas  = norm(sel(grupo, 'TALLA')?.opciones ?? []);
        const esDama  = /dama|mujer/i.test(grupo);
        const esCab   = /caballero|hombre/i.test(grupo);
        return (
          <div key={gi} className="rounded-lg border border-[#EFEFEF] bg-white p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">{esDama ? '👩' : esCab ? '👨' : '🎽'}</span>
              <input
                key={grupo}
                defaultValue={grupo}
                onBlur={e => { const nv = e.target.value.toUpperCase().trim(); if (nv && nv !== grupo) renombrarGrupo(grupo, nv); }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className={`${mini} font-bold flex-1`}
              />
              {esPolos && grupos.length > 1 && (
                <button onClick={() => quitarGrupo(grupo)} className="text-[11px] text-[#DC2626] px-2 py-1 rounded hover:bg-[#FEE2E2] shrink-0">✕ Quitar</button>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[#6B6B6B] uppercase">Colores</span>
                <button onClick={() => { setImpGrupo(grupo); setImpSel(new Set()); setImpBusca(''); }} className="text-[11px] text-[#00847A] font-semibold hover:underline">📥 Importar del catálogo</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {colores.map((o, k) => (
                  <span key={k} className={chip}>
                    {o.imagen && <img src={o.imagen} alt="" className="w-4 h-4 rounded object-cover" />}
                    {o.valor}
                    <button onClick={() => setOpciones(grupo, 'COLOR', colores.filter((_, j) => j !== k))} className="text-[#DC2626] ml-0.5">✕</button>
                  </span>
                ))}
                {colores.length === 0 && <span className="text-[11px] text-[#C2410C]">Sin colores — impórtalos del catálogo o agrégalos ⤵</span>}
              </div>
              <div className="flex gap-1.5 mt-1.5">
                <input value={nuevoColor[grupo] ?? ''} onChange={e => setNuevoColor(p => ({ ...p, [grupo]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { agregarColor(grupo, nuevoColor[grupo] ?? ''); setNuevoColor(p => ({ ...p, [grupo]: '' })); } }}
                  placeholder="Agregar color a mano…" className={`${mini} flex-1`} />
                <button onClick={() => { agregarColor(grupo, nuevoColor[grupo] ?? ''); setNuevoColor(p => ({ ...p, [grupo]: '' })); }} className="px-2.5 py-1.5 rounded-md bg-[#00A89D] text-white text-xs font-semibold">+</button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-[#6B6B6B] uppercase">Tallas</span>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button onClick={() => { const ex = new Set(tallas.map(t => t.valor.toLowerCase())); setOpciones(grupo, 'TALLA', [...tallas, ...TALLAS_HOMBRE.filter(t => !ex.has(t.toLowerCase())).map(valor => ({ valor }))]); }} className="text-[11px] text-[#075985] font-semibold hover:underline">＋ Hombre</button>
                  <button onClick={() => { const ex = new Set(tallas.map(t => t.valor.toLowerCase())); setOpciones(grupo, 'TALLA', [...tallas, ...TALLAS_DAMA.filter(t => !ex.has(t.toLowerCase())).map(valor => ({ valor }))]); }} className="text-[11px] text-[#9D174D] font-semibold hover:underline">＋ Dama</button>
                  <button onClick={() => setOpciones(grupo, 'TALLA', tallas.filter(o => !/dama|mujer/i.test(o.valor)))} className="text-[11px] text-[#DC2626] font-semibold hover:underline">− Dama</button>
                  <button onClick={() => setOpciones(grupo, 'TALLA', tallas.filter(o => !/hombre/i.test(o.valor)))} className="text-[11px] text-[#DC2626] font-semibold hover:underline">− Hombre</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tallas.map((o, k) => (
                  <span key={k} className={chip}>
                    {o.valor}
                    <button onClick={() => setOpciones(grupo, 'TALLA', tallas.filter((_, j) => j !== k))} className="text-[#DC2626] ml-0.5">✕</button>
                  </span>
                ))}
                {tallas.length === 0 && <span className="text-[11px] text-[#9A9A9A]">Sin tallas</span>}
              </div>
              <div className="flex gap-1.5 mt-1.5">
                <input value={nuevaTalla[grupo] ?? ''} onChange={e => setNuevaTalla(p => ({ ...p, [grupo]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { const v = (nuevaTalla[grupo] ?? '').trim(); if (v && !tallas.some(t => t.valor.toLowerCase() === v.toLowerCase())) setOpciones(grupo, 'TALLA', [...tallas, { valor: v }]); setNuevaTalla(p => ({ ...p, [grupo]: '' })); } }}
                  placeholder="Agregar talla a mano…" className={`${mini} flex-1`} />
              </div>
            </div>

            {impGrupo === grupo && (
              <div className="rounded-lg border-2 border-[#00A89D] bg-white p-2.5">
                <p className="text-[12px] font-bold text-[#00847A] mb-1">Marca los colores para {grupo}</p>
                <input value={impBusca} onChange={e => setImpBusca(e.target.value)} placeholder="🔍 Buscar color o catálogo…" className={`${mini} w-full mb-2`} />
                <div className="max-h-52 overflow-y-auto border border-[#EEE] rounded divide-y divide-[#F4F4F4]">
                  {coloresCatalogo
                    .filter(c => { const q = impBusca.toLowerCase(); return c.valor.toLowerCase().includes(q) || (c.familia ?? '').toLowerCase().includes(q); })
                    .map((c, k) => { const id = uidColor(c); return (
                      <label key={`${id}-${k}`} className="flex items-center gap-2 px-2 py-1.5 text-[12px] cursor-pointer hover:bg-[#FAFAFA]">
                        <input type="checkbox" className="accent-[#00A89D]" checked={impSel.has(id)}
                          onChange={() => setImpSel(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; })} />
                        {c.imagen && <img src={c.imagen} alt="" className="w-6 h-6 rounded object-cover" />}
                        <span className="flex-1 leading-tight">{c.valor}{c.familia && <span className="block text-[10px] text-[#9A9A9A]">{c.familia}</span>}</span>
                      </label>
                    );})}
                  {coloresCatalogo.length === 0 && <p className="text-[11px] text-[#C2410C] px-2 py-3">No hay colores en Catálogos. Créalos primero en Herramientas → Catálogos.</p>}
                </div>
                {grupos.length > 1 && (
                  <label className="flex items-center gap-2 text-[11px] mt-2 cursor-pointer font-semibold text-[#075985]">
                    <input type="checkbox" className="accent-[#0EA5E9]" checked={impTodos} onChange={e => setImpTodos(e.target.checked)} />
                    Agregar estos colores a TODAS las variables ({grupos.length})
                  </label>
                )}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => confirmarImport(grupo)} className="px-3 py-1.5 rounded-lg bg-[#00A89D] text-white text-[11px] font-semibold">✅ {impTodos ? `Agregar a TODAS (${impSel.size})` : `Agregar a ${grupo} (${impSel.size})`}</button>
                  <button onClick={() => { setImpGrupo(null); setImpSel(new Set()); setImpTodos(false); }} className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-[11px]">Cancelar</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {esPolos && (
        <button onClick={agregarPolo} className="w-full py-2.5 rounded-lg border-2 border-dashed border-[#0EA5E9]/60 text-[#075985] text-[12px] font-semibold hover:bg-[#0EA5E9]/5">➕ Agregar otra variable (pasa a pack x{grupos.length + 1})</button>
      )}
    </div>
  );
}

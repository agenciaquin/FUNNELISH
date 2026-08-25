# Copiar la función "VARIABLES POLOS" (pack x2 / x3 con color + talla) a este proyecto

Pega este mensaje completo en el chat del proyecto **quinchat comercial**. Es una guía para implementar la función tal cual está en el proyecto personal.

## Qué hace
En **Embudos → Productos del checkout**, un producto puede volverse un **pack de polos** (x2, x3, x4…) donde el cliente elige **color + talla de cada polo**. Los colores se **importan del catálogo** (con foto y familia). En la página, cada polo se ve con **foto grande a la izquierda y desplegables de color/talla a la derecha**, con una pilla ✅ blanca que muestra lo elegido, y el pack x2 lleva el badge rojo "🔥 MÁS VENDIDO". En la página de gracias se muestran **1, 2 o 3 fotos** según el pack.

Los archivos a tocar: `lib/funnels.ts`, `components/panel/EditorPareja.tsx` (reemplazar completo), `components/panel/EmbudosPanel.tsx`, `components/publico/FormularioPedido.tsx`, `components/publico/ResumenGracias.tsx`. Al final corre `npx tsc --noEmit`.

---

## 1) `lib/funnels.ts` — marcar el estilo del producto
En la interfaz `VarianteFunnel`, agrega el campo `estilo` (a prueba de renombrado):

```ts
  esPack?: boolean;
  armarPack?: ArmarPackConfig;
  estilo?: string; // 'polos' → editor y checkout de VARIABLES POLOS
```

---

## 2) `components/panel/EditorPareja.tsx` — REEMPLAZA todo el archivo por esto

```tsx
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
```

---

## 3) `components/panel/EmbudosPanel.tsx`

**3.1** En el `import` de EditorPareja agrega `selectoresPolos`:
```tsx
import EditorPareja, { selectoresPareja, selectoresPolos } from './EditorPareja';
```

**3.2** En la interfaz local `Variante`, agrega `estilo?: string;`.

**3.3** Reemplaza el cálculo de `coloresCatalogo` para que incluya la **familia** (no dedupe entre catálogos, solo duplicados exactos):
```tsx
  const coloresCatalogo = (() => {
    const vistos = new Set<string>();
    const out: { valor: string; imagen?: string; familia?: string }[] = [];
    for (const c of catalogosFull) {
      const familia = String((c as any).familia ?? '').trim();
      for (const x of ((c as any).catalogo_colores ?? [])) {
        const valor = String(x.color ?? '').trim();
        if (!valor) continue;
        const k = `${familia.toLowerCase()}::${valor.toLowerCase()}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        out.push({ valor, imagen: x.url_imagen || undefined, familia });
      }
    }
    return out;
  })();
```

**3.4** Donde se calcula `esPareja` dentro del `.map` de variantes, agrega debajo:
```tsx
              const esPolos  = v.estilo === 'polos' || (v.selectores ?? []).some(s => /polo\s*\d/i.test(s.grupo || ''));
```

**3.5** Junto al botón "👫 Pareja (Dama + Caballero)" agrega DOS botones:
```tsx
                    <button
                      onClick={() => { if ((v.selectores?.length ?? 0) > 0 && !confirm('Esto reemplaza las opciones por VARIABLES POLOS (2 polos con color y talla). ¿Seguir?')) return; cambiar({ nombre: v.nombre || 'PACK X2 POLOS', selectores: selectoresPolos(2), armarPack: undefined, estilo: 'polos' }); }}
                      className="px-3 py-1.5 rounded-lg border border-[#0EA5E9]/50 text-[11px] text-[#075985] bg-[#0EA5E9]/5 hover:bg-[#0EA5E9]/10 font-semibold"
                    >🎽 Variables Polos (pack x2)</button>
                    <button
                      onClick={() => { if ((v.selectores?.length ?? 0) > 0 && !confirm('Esto reemplaza las opciones por VARIABLES POLOS x3. ¿Seguir?')) return; cambiar({ nombre: v.nombre || 'PACK X3 POLOS', selectores: selectoresPolos(3), armarPack: undefined, estilo: 'polos' }); }}
                      className="px-3 py-1.5 rounded-lg border border-[#0EA5E9]/50 text-[11px] text-[#075985] bg-[#0EA5E9]/5 hover:bg-[#0EA5E9]/10 font-semibold"
                    >🎽 Variables Polos (pack x3)</button>
```

**3.6** En el bloque "Qué debe elegir el cliente" (el editor de selectores en crudo), agrega `!esPolos` a su condición para OCULTARLO en polos:
```tsx
                  {!esPolos && (/pack/i.test(v.nombre || '') || selectores.some(s => /buzo|prenda|elige/i.test(s.grupo || ''))) &&
```

**3.7** Donde se renderiza `<EditorPareja ... />`, cámbialo para que también salga en polos, con título propio:
```tsx
                  {(esPareja || esPolos) && (
                    <EditorPareja
                      selectores={selectores}
                      coloresCatalogo={coloresCatalogo}
                      onChange={(s) => cambiar({ selectores: s })}
                      titulo={esPolos ? '🎽 VARIABLES POLOS · cada polo con su color y talla' : undefined}
                    />
                  )}
```

---

## 4) `components/publico/FormularioPedido.tsx`

**4.1** Junto a `const esPareja = ...`, agrega:
```tsx
  const esPolos = variante.estilo === 'polos' || grupos.some(g => /polo\s*\d/i.test(g.titulo || ''));
  const usaDropdown = esPareja || esPolos;
```

**4.2** Auto-elegir selectores de una sola opción (color único no bloquea) — agrega este `useEffect`:
```tsx
  useEffect(() => {
    setElecciones(prev => {
      const next = [...prev];
      let cambio = false;
      selectores.forEach((s, i) => {
        const ops = normalizarOpciones(s.opciones);
        if (!next[i] && ops.length === 1) { next[i] = ops[0].valor; cambio = true; }
      });
      return cambio ? next : prev;
    });
  }, [selectores]);
```

**4.3** En la validación de selectores, no exigir los que no tienen opciones:
```tsx
      selectores.forEach((s, i) => {
        const ops = normalizarOpciones(s.opciones);
        if (ops.length > 0 && !elecciones[i]) e.talla = `Elige ${s.etiqueta.toLowerCase()}`;
      });
```

**4.4** En el memo de `selectores`, antes del `return sels;`, quita los selectores vacíos:
```tsx
    sels = sels.filter(s => normalizarOpciones(s.opciones).length > 0);
    if (sels.length === 0) sels = [{ etiqueta: 'TALLA', opciones: (funnel.tallas.length > 0 ? funnel.tallas : []) }];
```

**4.5** En el `.map` de variantes, detecta el pack x2 y ponle el badge + que solo él palpite:
```tsx
          const esPackX2 = (v.armarPack?.unidades === 2)
            || /(^|\s)(pack\s*x?\s*2|x2|dos\s+prendas)/i.test(v.nombre || '')
            || new Set((v.selectores ?? []).map(s => s.grupo?.trim()).filter(Boolean)).size === 2;
          const palpita = sinElegir && esPackX2;
```
El contenedor de la variante lleva `relative` y `${palpita ? 'ring-2 ring-offset-2 animate-pulse' : ''}`, y adentro:
```tsx
              {esPackX2 && (
                <span className="absolute -top-2.5 right-2 z-10 bg-[#C1121F] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">🔥 MÁS VENDIDO</span>
              )}
```

**4.6** El render de cada grupo (color/talla) debe usar `usaDropdown` (no `esPareja`), y para polos el layout de foto grande + desplegables + pilla ✅. Usa el gate `{usaDropdown && (` y dentro de cada grupo, cuando `esPolos`, renderiza:
```tsx
                            <div className="text-white px-3 py-2 flex items-center justify-center gap-2 font-extrabold text-sm tracking-wide" style={{ background: tono }}>
                              <span>{esDama ? '👩 ' : esCab ? '👨 ' : '🎽 '}{g.titulo}</span>
                              {esPolos && idxColor != null && elecciones[idxColor] && (
                                <span className="bg-white text-[#0D8A3E] text-[11px] font-extrabold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                                  ✅ {elecciones[idxColor]}{idxTalla != null && elecciones[idxTalla] ? ` · TALLA ${elecciones[idxTalla]}` : ''}
                                </span>
                              )}
                            </div>
                            {esPolos ? (
                              <div className="p-3 flex items-stretch gap-3">
                                <div className="w-[36%] shrink-0">
                                  {colorSel?.imagen ? (
                                    <img src={colorSel.imagen} alt="" className="w-full h-full object-cover rounded-lg border border-[#E0E0E0]" loading="lazy" />
                                  ) : (
                                    <div className="w-full h-full min-h-[110px] rounded-lg bg-[#F2F2F2] flex items-center justify-center text-3xl text-[#CCC]">🎽</div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-2.5">
                                  {idxColor != null && (
                                    <div>
                                      <p className="text-[12px] font-extrabold mb-1" style={{ color: acento.texto }}>{marcaColor} Elige el color</p>
                                      <select value={elecciones[idxColor] || ''} onChange={e => setSel(idxColor, e.target.value)}
                                        className="w-full px-2 py-2.5 rounded-lg border-2 text-[13px] font-semibold bg-white focus:outline-none"
                                        style={{ borderColor: elecciones[idxColor] ? tono : '#E0E0E0' }}>
                                        <option value="">— Elige color —</option>
                                        {normalizarOpciones(selectores[idxColor].opciones).map(o => (<option key={o.valor} value={o.valor}>{o.valor}</option>))}
                                      </select>
                                    </div>
                                  )}
                                  {idxTalla != null && (
                                    <div>
                                      <p className="text-[12px] font-extrabold mb-1" style={{ color: acento.texto }}>{marcaTalla} Elige la talla</p>
                                      <select value={elecciones[idxTalla] || ''} onChange={e => setSel(idxTalla, e.target.value)}
                                        className="w-full px-2 py-2.5 rounded-lg border-2 text-[13px] font-semibold bg-white focus:outline-none"
                                        style={{ borderColor: elecciones[idxTalla] ? tono : '#E0E0E0' }}>
                                        <option value="">— Elige talla —</option>
                                        {normalizarOpciones(selectores[idxTalla].opciones).map(o => (<option key={o.valor} value={o.valor}>{o.valor}</option>))}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : ( /* aquí queda el render de PAREJA de siempre (grid 2 columnas + guía + confirmación) */ )}
```
Nota: `tono` para polos usa el color de acento: `const tono = esDama ? '#EC4899' : esCab ? '#1E3A8A' : acento.boton;`. Y el gate del render por chips (el que no es dropdown) debe ser `{!usaDropdown && grupos.map(...)}`.

**4.7** Al enviar el pedido, incluye las fotos del pack en el collage y en el resumen:
```tsx
    const imagenesPack = usaPack ? pack!.fotos : (usaDropdown && fotosColores.length > 1 ? fotosColores : undefined);
    // ...y en el sessionStorage del resumen:
    sessionStorage.setItem('quin_ultimo_pedido', JSON.stringify({
      producto: nombreProducto, seleccion: seleccionFinal, valor: variante.precio,
      foto: fotoPedido, imagenes: imagenesPack, nombre: datos.nombre, referencia,
    }));
```

---

## 5) `components/publico/ResumenGracias.tsx` — mostrar 1/2/3 fotos
En la interfaz `Pedido` agrega `imagenes?: string[];`. Y reemplaza el bloque de la foto por:
```tsx
            {(() => {
              const fotos = (p.imagenes && p.imagenes.length > 0) ? p.imagenes : (p.foto ? [p.foto] : []);
              if (fotos.length === 0) return null;
              return (
                <div className="flex flex-col gap-1 shrink-0">
                  {fotos.slice(0, 3).map((f, i) => (
                    <img key={i} src={f} alt="" className={`${fotos.length > 1 ? 'w-14 h-14' : 'w-16 h-16'} rounded-lg object-cover border border-[#E8E8E8]`} />
                  ))}
                </div>
              );
            })()}
```

---

## 6) Verificar
Corre `npx tsc --noEmit` (filtrando jimp/xlsx si aplica) y despliega. Prueba: en un producto del checkout dale "🎽 Variables Polos (pack x2)", importa colores del catálogo (con la casilla "a todas las variables"), y revisa la página: cada polo con foto grande + desplegables de color/talla, pilla ✅, badge "MÁS VENDIDO" en el x2, y en gracias 2/3 fotos.
```

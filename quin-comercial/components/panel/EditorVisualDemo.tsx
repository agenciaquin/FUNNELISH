'use client';

import { useState } from 'react';
import { acentoDe, esVideo } from '@/lib/funnels';

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const nid = () => 'b-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);

type Tipo = 'texto' | 'video' | 'foto' | 'collage' | 'boton' | 'contador'
  | 'espaciador' | 'separador' | 'beneficios' | 'garantia' | 'confianza' | 'testimonios' | 'faq';
type Ancla = 'titular' | 'portada' | 'comprar' | 'precio';
interface Bloque {
  id: string; tipo: Tipo; ancla?: Ancla;
  url?: string; urls?: string[];
  titulo?: string; cuerpo?: string; centrado?: boolean;
  texto?: string; accion?: 'comprar' | 'url'; horas?: number;
  altura?: number; items?: any[];
}
interface Draft {
  producto: string; titulo: string; frases: string[];
  precio: number; precio_antes: number | null;
  imagenes: string[]; horas_contador: number; color: string | null;
}

// Paleta de elementos (estructura premium de embudo), agrupada como Funnelish.
const PALETA: { grupo: string; items: { tipo: Tipo; label: string; icono: string }[] }[] = [
  { grupo: 'Diseño', items: [
    { tipo: 'espaciador', label: 'Espacio', icono: '↕️' },
    { tipo: 'separador', label: 'Separador', icono: '➖' },
  ] },
  { grupo: 'Texto', items: [
    { tipo: 'texto', label: 'Texto', icono: '📝' },
    { tipo: 'beneficios', label: 'Beneficios', icono: '✅' },
  ] },
  { grupo: 'Medios', items: [
    { tipo: 'foto', label: 'Foto', icono: '📷' },
    { tipo: 'video', label: 'Video', icono: '🎬' },
    { tipo: 'collage', label: 'Collage', icono: '🖼️' },
  ] },
  { grupo: 'Venta', items: [
    { tipo: 'boton', label: 'Botón', icono: '🔘' },
    { tipo: 'contador', label: 'Contador', icono: '⏱️' },
    { tipo: 'confianza', label: 'Confianza', icono: '🛡️' },
    { tipo: 'garantia', label: 'Garantía', icono: '🏅' },
  ] },
  { grupo: 'Prueba social', items: [
    { tipo: 'testimonios', label: 'Testimonios', icono: '💬' },
    { tipo: 'faq', label: 'Preguntas', icono: '❓' },
  ] },
];
const OPCIONES = PALETA.flatMap(g => g.items);

export default function EditorVisualDemo({
  d, onCampo, subir, bloques, onBloques,
}: {
  d: Draft;
  onCampo: (campo: string, valor: any) => void;
  subir: (f: File) => Promise<string | null>;
  bloques: Bloque[];
  onBloques: (bs: Bloque[]) => void;
}) {
  const [edit, setEdit] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  // Paleta lateral: elemento seleccionado para insertar al tocar (tap) y el que
  // se está arrastrando (drag); overMas resalta el punto "+" bajo el cursor.
  const [pendingTipo, setPendingTipo] = useState<Tipo | null>(null);
  const [dragTipo, setDragTipo] = useState<Tipo | null>(null);
  const [overMas, setOverMas] = useState<string | null>(null);
  const acento = acentoDe(d.color);
  const bs = bloques ?? [];

  const nuevo = (tipo: Tipo): Bloque => {
    const b: Bloque = { id: nid(), tipo };
    if (tipo === 'texto') b.cuerpo = 'Escribe aquí tu texto…';
    if (tipo === 'boton') { b.texto = 'COMPRAR AHORA'; b.accion = 'comprar'; }
    if (tipo === 'collage') b.urls = [];
    if (tipo === 'contador') b.horas = 10;
    if (tipo === 'espaciador') b.altura = 24;
    if (tipo === 'beneficios') { b.titulo = 'POR QUÉ COMPRARLO'; b.items = ['Material de alta calidad', 'Envío rápido y seguro', 'Garantía de satisfacción']; }
    if (tipo === 'garantia') { b.titulo = 'COMPRA SIN RIESGO'; b.cuerpo = 'Si no te gusta, te devolvemos tu dinero. Sin preguntas.'; }
    if (tipo === 'confianza') b.items = ['🚚 Envío gratis', '💵 Pago contra entrega', '🔒 Compra 100% segura'];
    if (tipo === 'testimonios') b.items = [{ nombre: 'María G.', texto: '¡Excelente calidad, llegó rapidísimo!' }, { nombre: 'Carlos R.', texto: 'Tal cual la foto, muy recomendado 👌' }];
    if (tipo === 'faq') b.items = [{ pregunta: '¿Cómo pago?', respuesta: 'Pagas en efectivo cuando recibes el pedido en tu casa.' }, { pregunta: '¿Cuánto demora el envío?', respuesta: 'De 3 a 6 días hábiles en toda Colombia.' }];
    return b;
  };
  const insertar = (ancla: Ancla, pAncla: number, tipo: Tipo) => {
    const g = bs.map((b, gi) => ({ b, gi })).filter(x => (x.b.ancla ?? 'portada') === ancla);
    const globalIdx = pAncla < g.length ? g[pAncla].gi : (g.length ? g[g.length - 1].gi + 1 : bs.length);
    const nb = nuevo(tipo); nb.ancla = ancla;
    const arr = [...bs]; arr.splice(globalIdx, 0, nb); onBloques(arr); setMenu(null); setEdit(nb.id);
  };
  const editarB = (id: string, patch: Partial<Bloque>) => onBloques(bs.map(b => (b.id === id ? { ...b, ...patch } : b)));
  const borrarB = (id: string) => { onBloques(bs.filter(b => b.id !== id)); if (edit === id) setEdit(null); };
  const dupB = (id: string) => { const i = bs.findIndex(b => b.id === id); if (i < 0) return; const c = { ...bs[i], id: nid() }; const a = [...bs]; a.splice(i + 1, 0, c); onBloques(a); };
  // Subir/bajar un bloque DENTRO de su misma sección (ancla): intercambia su
  // posición global con la del bloque vecino de la misma sección.
  const moverB = (id: string, dir: -1 | 1) => {
    const b0 = bs.find(x => x.id === id); if (!b0) return;
    const ancla = b0.ancla ?? 'portada';
    const grupo = bs.map((b, gi) => ({ b, gi })).filter(x => (x.b.ancla ?? 'portada') === ancla);
    const p = grupo.findIndex(x => x.b.id === id);
    const q = p + dir;
    if (p < 0 || q < 0 || q >= grupo.length) return;
    const arr = [...bs];
    const gi1 = grupo[p].gi, gi2 = grupo[q].gi;
    [arr[gi1], arr[gi2]] = [arr[gi2], arr[gi1]];
    onBloques(arr);
  };
  // Arrastrar y soltar: mueve el bloque arrastrado justo antes del bloque
  // destino, adoptando su sección — así puedes moverlo dentro o entre secciones.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const soltarEn = (targetId: string) => {
    if (dragId && dragId !== targetId) {
      const from = bs.findIndex(b => b.id === dragId);
      const target = bs.find(b => b.id === targetId);
      if (from >= 0 && target) {
        const arr = [...bs];
        const [moved] = arr.splice(from, 1);
        moved.ancla = target.ancla ?? 'portada';
        const insertAt = arr.findIndex(b => b.id === targetId);
        arr.splice(insertAt < 0 ? arr.length : insertAt, 0, moved);
        onBloques(arr);
      }
    }
    setDragId(null); setOverId(null);
  };
  const subirB = async (id: string, f: File) => { setSubiendo(id); try { const url = await subir(f); if (url) editarB(id, { url }); } finally { setSubiendo(null); } };
  const subirCollage = async (id: string, f: File) => { setSubiendo(id); try { const url = await subir(f); if (url) { const b = bs.find(x => x.id === id); editarB(id, { urls: [...((b?.urls) ?? []), url] }); } } finally { setSubiendo(null); } };
  const subirPortada = async (f: File) => { setSubiendo('portada'); try { const url = await subir(f); if (url) onCampo('imagenes', [url, ...(d.imagenes ?? []).slice(0, 5)]); } finally { setSubiendo(null); } };
  // Campos fijos de la página que ahora también se editan DENTRO del teléfono
  // (banner de clientes, foto de detalle, características…). `d` trae todos los
  // datos del embudo aunque el tipo Draft no los declare, así que se leen aquí.
  const dd = d as any;
  const subirCampo = async (campo: string, f: File) => { setSubiendo(campo); try { const url = await subir(f); if (url) onCampo(campo, url); } finally { setSubiendo(null); } };

  // Packs / productos del checkout: se editan también en el teléfono (nombre y
  // precio). Las tallas/fotos y la edición masiva siguen en el editor por bloques.
  const vars: any[] = dd.variantes ?? [];
  const setVars = (nv: any[]) => onCampo('variantes', nv);
  const addVar = () => setVars([...vars, { id: 'v' + Date.now().toString(36), nombre: '', precio: dd.precio ?? 0, precioAntes: dd.precio_antes ?? undefined, selectores: [{ etiqueta: 'TALLA', opciones: dd.tallas ?? [] }] }]);
  const editVar = (id: string, patch: any) => setVars(vars.map(v => (v.id === id ? { ...v, ...patch } : v)));
  const delVar = (id: string) => setVars(vars.filter(v => v.id !== id));

  const inp = 'w-full text-sm border border-[#E8E8E8] rounded px-2 py-1';

  const Mas = ({ mkey, onPick }: { mkey: string; onPick: (t: Tipo) => void }) => {
    const activoInsert = !!pendingTipo || !!dragTipo;
    const resaltado = overMas === mkey;
    return (
      <div
        onDragOver={e => { if (dragTipo) { e.preventDefault(); setOverMas(mkey); } }}
        onDragLeave={() => setOverMas(o => (o === mkey ? null : o))}
        onDrop={() => { if (dragTipo) { onPick(dragTipo); setDragTipo(null); setOverMas(null); } }}
        className={`relative flex justify-center transition-all ${activoInsert ? 'py-2 bg-[#00A89D]/[0.06]' : 'py-1'} ${resaltado ? 'ring-2 ring-[#00A89D] rounded-lg' : ''}`}
      >
        <button type="button"
          onClick={() => {
            if (pendingTipo) { onPick(pendingTipo); setPendingTipo(null); }
            else setMenu(menu === mkey ? null : mkey);
          }}
          className={`w-7 h-7 rounded-full text-white text-lg leading-none flex items-center justify-center shadow z-10 ${activoInsert ? 'bg-[#00847A] scale-110' : 'bg-[#00A89D] hover:bg-[#00847A]'}`}
          title={activoInsert ? 'Insertar aquí' : 'Agregar bloque aquí'}
        >+</button>
        {activoInsert && !resaltado && <span className="absolute inset-x-0 -bottom-0.5 text-center text-[9px] text-[#00847A] font-semibold pointer-events-none">soltar / tocar aquí</span>}
        {menu === mkey && (
          <div className="absolute top-8 z-30 bg-white border border-[#E8E8E8] rounded-xl shadow-lg p-1 grid grid-cols-3 gap-1 w-56">
            {OPCIONES.map(o => (
              <button key={o.tipo} type="button" onClick={() => { onPick(o.tipo); setMenu(null); }}
                className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg hover:bg-[#F5F5F5] text-[11px]">
                <span className="text-base">{o.icono}</span>{o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const Zona = ({ ancla }: { ancla: Ancla }) => {
    const items = bs.map((b, gi) => ({ b, gi })).filter(x => (x.b.ancla ?? 'portada') === ancla);
    return (
      <>
        <Mas mkey={ancla + '#0'} onPick={t => insertar(ancla, 0, t)} />
        {items.map((x, p) => (
          <div key={x.b.id}>
            <div
              onDragOver={e => { e.preventDefault(); if (dragId && dragId !== x.b.id) setOverId(x.b.id); }}
              onDragLeave={() => setOverId(o => (o === x.b.id ? null : o))}
              onDrop={() => soltarEn(x.b.id)}
              className={`relative transition-all ${edit === x.b.id ? 'ring-2 ring-[#00A89D] ring-inset' : ''} ${dragId === x.b.id ? 'opacity-40' : ''} ${overId === x.b.id ? 'border-t-4 border-[#00A89D]' : 'border-t-4 border-transparent'}`}
            >
              <div className="absolute -top-2 right-2 z-10 flex items-center gap-0.5 bg-white border border-[#E8E8E8] rounded-lg px-1 py-0.5 shadow-sm">
                <span
                  draggable
                  onDragStart={() => { setDragId(x.b.id); setEdit(null); }}
                  onDragEnd={() => { setDragId(null); setOverId(null); }}
                  className="text-xs px-0.5 cursor-grab active:cursor-grabbing text-[#9A9A9A] select-none"
                  title="Arrastra para mover el bloque"
                >⠿</span>
                <button onClick={e => { e.stopPropagation(); moverB(x.b.id, -1); }} disabled={p === 0} className="text-xs px-0.5 disabled:opacity-25" title="Subir">↑</button>
                <button onClick={e => { e.stopPropagation(); moverB(x.b.id, 1); }} disabled={p === items.length - 1} className="text-xs px-0.5 disabled:opacity-25" title="Bajar">↓</button>
                <button onClick={e => { e.stopPropagation(); dupB(x.b.id); }} className="text-xs px-0.5" title="Duplicar">⧉</button>
                <button onClick={e => { e.stopPropagation(); borrarB(x.b.id); }} className="text-xs px-0.5 text-[#DC2626]" title="Borrar">🗑</button>
              </div>
              <div onClick={() => setEdit(x.b.id)} className="cursor-pointer">{vista(x.b)}</div>
              {edit === x.b.id && <div className="p-3 bg-[#F7F7F5] border-y border-[#E8E8E8]" onClick={e => e.stopPropagation()}>{editor(x.b)}</div>}
            </div>
            <Mas mkey={ancla + '#' + (p + 1)} onPick={t => insertar(ancla, p + 1, t)} />
          </div>
        ))}
      </>
    );
  };

  const Editable = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <div onClick={() => setEdit(k)}
      className={`relative cursor-pointer group ${edit === k ? 'ring-2 ring-[#00A89D] ring-inset' : 'hover:ring-2 hover:ring-[#00A89D]/40 hover:ring-inset'}`}>
      {edit !== k && <span className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 text-[9px] bg-[#00A89D] text-white px-1.5 py-0.5 rounded-full pointer-events-none">✏️</span>}
      {children}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-[#6B6B6B] text-center">Arrastra un elemento de la izquierda al teléfono, o tócalo y luego toca un <b className="text-[#00A89D]">+</b>. Toca cualquier parte para editarla; mueve bloques con <b>⠿</b> o las flechas <b>↑↓</b>.</p>

      <div className="flex gap-3 items-start justify-center">
        {/* Paleta lateral fija de elementos (estructura premium de embudo) */}
        <div className="w-36 shrink-0 sticky top-2 max-h-[80vh] overflow-y-auto bg-white border border-[#E8E8E8] rounded-2xl p-2">
          <p className="text-[10px] font-bold text-[#6B6B6B] px-1 mb-1">ELEMENTOS</p>
          {PALETA.map(g => (
            <div key={g.grupo} className="mb-2">
              <p className="text-[9px] uppercase tracking-wide text-[#9A9A9A] px-1 mb-0.5">{g.grupo}</p>
              <div className="grid grid-cols-2 gap-1">
                {g.items.map(o => (
                  <button key={o.tipo} type="button"
                    draggable
                    onDragStart={() => { setDragTipo(o.tipo); setEdit(null); }}
                    onDragEnd={() => { setDragTipo(null); setOverMas(null); }}
                    onClick={() => setPendingTipo(pendingTipo === o.tipo ? null : o.tipo)}
                    className={`flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg text-[10px] border cursor-grab active:cursor-grabbing ${pendingTipo === o.tipo ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A] font-semibold' : 'border-[#EEE] hover:bg-[#F5F5F5]'}`}
                    title={`Arrastra o toca para agregar: ${o.label}`}
                  >
                    <span className="text-base">{o.icono}</span>{o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {pendingTipo && (
            <div className="mt-1 text-[10px] text-[#00847A] bg-[#00A89D]/10 rounded-lg p-2">
              Toca un <b>+</b> en el teléfono para poner el elemento.
              <button onClick={() => setPendingTipo(null)} className="block mt-1 text-[#DC2626] font-semibold">Cancelar</button>
            </div>
          )}
        </div>

      <div className="w-full max-w-[380px] rounded-[2rem] border-[6px] border-[#1A1A1A] bg-[#1A1A1A] shadow-xl overflow-hidden">
        <div className="bg-white">

          {/* Banner de clientes — lo primero de la página */}
          <Editable k="clientes">
            {dd.imagen_clientes
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={dd.imagen_clientes} alt="Banner de clientes" className="w-full object-cover" />
              : <div className="w-full h-16 bg-[#F2F1EE] flex items-center justify-center text-[11px] text-[#9A9A9A]">🖼️ Banner de clientes — toca para subir (opcional)</div>}
          </Editable>
          {edit === 'clientes' && (
            <div className="p-3 bg-[#F7F7F5] border-y border-[#E8E8E8] flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
              <label className="text-[11px] px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white cursor-pointer">
                {subiendo === 'clientes' ? 'Subiendo…' : (dd.imagen_clientes ? 'Cambiar' : 'Subir banner')}
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirCampo('imagen_clientes', f); e.target.value = ''; }} />
              </label>
              {dd.imagen_clientes && <button onClick={() => onCampo('imagen_clientes', null)} className="text-[11px] px-3 py-1.5 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2]">Quitar</button>}
              <button onClick={() => setEdit(null)} className="text-[11px] px-3 py-1.5 rounded-lg bg-[#00A89D] text-white font-semibold">Listo</button>
            </div>
          )}

          {/* Titular */}
          <Editable k="titulo">
            <div className="bg-[#FFF3CD] text-center py-2 px-3 font-extrabold text-[#0D0D0D] text-sm">
              {d.titulo || d.frases?.[0] || '🔥 ÚLTIMAS UNIDADES 🔥'}
            </div>
          </Editable>
          {edit === 'titulo' && (
            <div className="p-3 bg-[#F7F7F5] border-y border-[#E8E8E8]" onClick={e => e.stopPropagation()}>
              <textarea autoFocus value={d.titulo} onChange={e => onCampo('titulo', e.target.value)} rows={2} className={inp} />
              <button onClick={() => setEdit(null)} className="mt-1 text-[11px] px-3 py-1 rounded-lg bg-[#00A89D] text-white font-semibold">Listo</button>
            </div>
          )}
          <Zona ancla="titular" />

          {/* Portada */}
          <Editable k="portada">
            {d.imagenes && d.imagenes[0]
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={d.imagenes[0]} alt={d.producto} className="w-full aspect-square object-cover" />
              : <div className="w-full aspect-square bg-[#F2F1EE] flex items-center justify-center text-4xl">📷</div>}
          </Editable>
          {edit === 'portada' && (
            <div className="p-3 bg-[#F7F7F5] border-y border-[#E8E8E8] flex gap-2" onClick={e => e.stopPropagation()}>
              <label className="text-[11px] px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white cursor-pointer">
                {subiendo === 'portada' ? 'Subiendo…' : 'Subir foto'}
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirPortada(f); e.target.value = ''; }} />
              </label>
              <button onClick={() => setEdit(null)} className="text-[11px] px-3 py-1.5 rounded-lg bg-[#00A89D] text-white font-semibold">Listo</button>
            </div>
          )}
          <Zona ancla="portada" />

          {/* Botón comprar */}
          <div className="px-3 py-3">
            <div style={{ background: acento.boton }} className="rounded-full text-white text-center font-extrabold py-3 text-lg leading-tight">
              COMPRAR<br /><span className="text-sm">CONTRA ENTREGA →</span>
            </div>
          </div>
          <Zona ancla="comprar" />

          {/* Precio */}
          <Editable k="precio">
            <div className="text-center py-2">
              {d.precio_antes ? <p className="text-[#C1121F] text-base font-bold italic line-through">Antes {pesos(d.precio_antes)}</p> : null}
              <p className="text-2xl font-extrabold">HOY 🔥 <span style={{ color: acento.texto }}>{pesos(d.precio)}</span> 🔥</p>
            </div>
          </Editable>
          {edit === 'precio' && (
            <div className="p-3 bg-[#F7F7F5] border-y border-[#E8E8E8] space-y-2" onClick={e => e.stopPropagation()}>
              <input type="number" value={d.precio_antes ?? ''} onChange={e => onCampo('precio_antes', e.target.value ? Number(e.target.value) : null)} placeholder="Precio antes" className={inp} />
              <input type="number" value={d.precio} onChange={e => onCampo('precio', Number(e.target.value))} placeholder="Precio hoy" className={inp} />
              <button onClick={() => setEdit(null)} className="text-[11px] px-3 py-1 rounded-lg bg-[#00A89D] text-white font-semibold">Listo</button>
            </div>
          )}
          <Zona ancla="precio" />

          {/* Últimas unidades */}
          <p className="text-center font-extrabold text-lg text-[#C1121F] py-2">⚠️ ÚLTIMAS UNIDADES</p>

          {/* Foto de detalle */}
          <Editable k="detalle">
            {dd.imagen_detalle
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={dd.imagen_detalle} alt="Foto de detalle" className="w-full object-cover" />
              : <div className="w-full h-16 bg-[#F2F1EE] flex items-center justify-center text-[11px] text-[#9A9A9A]">📷 Foto de detalle — toca para subir (opcional)</div>}
          </Editable>
          {edit === 'detalle' && (
            <div className="p-3 bg-[#F7F7F5] border-y border-[#E8E8E8] flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
              <label className="text-[11px] px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white cursor-pointer">
                {subiendo === 'detalle' ? 'Subiendo…' : (dd.imagen_detalle ? 'Cambiar' : 'Subir foto')}
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirCampo('imagen_detalle', f); e.target.value = ''; }} />
              </label>
              {dd.imagen_detalle && <button onClick={() => onCampo('imagen_detalle', null)} className="text-[11px] px-3 py-1.5 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2]">Quitar</button>}
              <button onClick={() => setEdit(null)} className="text-[11px] px-3 py-1.5 rounded-lg bg-[#00A89D] text-white font-semibold">Listo</button>
            </div>
          )}

          {/* Características */}
          <Editable k="caracteristicas">
            <div className="px-3 py-2">
              <div className="font-extrabold text-xs mb-1" style={{ color: acento.texto }}>CARACTERÍSTICAS:</div>
              {(dd.caracteristicas ?? []).length
                ? <ul className="space-y-0.5">{(dd.caracteristicas as string[]).map((c, k) => <li key={k} className="text-[12px] font-semibold">✅ {c}</li>)}</ul>
                : <div className="text-[11px] text-[#9A9A9A]">Toca para escribir las características (una por línea).</div>}
            </div>
          </Editable>
          {edit === 'caracteristicas' && (
            <div className="p-3 bg-[#F7F7F5] border-y border-[#E8E8E8]" onClick={e => e.stopPropagation()}>
              <textarea
                autoFocus rows={4} className={inp}
                value={(dd.caracteristicas ?? []).join('\n')}
                onChange={e => onCampo('caracteristicas', e.target.value.split('\n'))}
                placeholder={'Una característica por línea…\nMaterial premium\nEnvío gratis'}
              />
              <button onClick={() => onCampo('caracteristicas', (dd.caracteristicas ?? []).filter((c: string) => c.trim()))} className="mt-1 text-[11px] px-3 py-1 rounded-lg bg-[#00A89D] text-white font-semibold">Listo</button>
            </div>
          )}

          {/* Packs / productos del checkout */}
          <div className="px-3 py-3 border-t border-[#EEE]">
            <div className="text-[11px] font-extrabold text-center mb-2" style={{ color: acento.texto }}>ELIGE TU OPCIÓN 👇</div>
            {vars.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-[#C9C9C9] p-3 text-center text-[11px] text-[#9A9A9A]">
                Un solo producto con el precio de arriba.
                <button onClick={addVar} className="block mx-auto mt-1 text-[#00A89D] font-semibold">+ Agregar packs (Unidad, x2, x3…)</button>
              </div>
            ) : (
              <div className="space-y-2">
                {vars.map((v) => (
                  <div key={v.id} className="rounded-xl border border-[#E8E8E8] p-2">
                    {edit === v.id ? (
                      <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                        <input value={v.nombre ?? ''} onChange={e => editVar(v.id, { nombre: e.target.value })} placeholder="Nombre (ej. 1 Buzo · Pack x2)" className={inp} />
                        <div className="grid grid-cols-2 gap-1.5">
                          <input type="number" value={v.precio ?? ''} onChange={e => editVar(v.id, { precio: Number(e.target.value) })} placeholder="Precio" className={inp} />
                          <input type="number" value={v.precioAntes ?? ''} onChange={e => editVar(v.id, { precioAntes: e.target.value ? Number(e.target.value) : undefined })} placeholder="Antes (opcional)" className={inp} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEdit(null)} className="text-[11px] px-3 py-1 rounded-lg bg-[#00A89D] text-white font-semibold">Listo</button>
                          <button onClick={() => delVar(v.id)} className="text-[11px] px-3 py-1 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2]">Eliminar</button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => setEdit(v.id)} className="cursor-pointer flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold">{v.nombre || 'Producto sin nombre'}</span>
                        <span className="text-[13px] font-extrabold" style={{ color: acento.texto }}>{pesos(v.precio)}</span>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={addVar} className="w-full text-[11px] text-[#00A89D] font-semibold border border-dashed border-[#00A89D]/40 rounded-lg py-1.5 hover:bg-[#00A89D]/5">+ Agregar otro pack</button>
              </div>
            )}
            <p className="text-[9px] text-[#9A9A9A] text-center mt-2">Para tallas y fotos de cada pack, usa 🧱 Editor por bloques.</p>
          </div>

          <p className="text-center text-xl py-2">⭐⭐⭐⭐⭐</p>

          {/* Miniatura flotante (aparece flotando sobre la página) */}
          <div className="px-3 pb-3">
            <div onClick={() => setEdit('miniatura')} className={`cursor-pointer flex items-center gap-2 rounded-xl border p-2 ${edit === 'miniatura' ? 'ring-2 ring-[#00A89D] ring-inset border-transparent' : 'border-[#EEE] hover:border-[#00A89D]/40'}`}>
              {dd.miniatura_url ? (
                esVideo(dd.miniatura_url)
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  ? <video src={dd.miniatura_url} muted className="w-10 h-10 rounded-full object-cover shrink-0" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={dd.miniatura_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <span className="w-10 h-10 rounded-full bg-[#F2F1EE] flex items-center justify-center shrink-0">🎈</span>
              )}
              <span className="text-[11px] text-[#6B6B6B]">Miniatura flotante {dd.miniatura_url ? '' : '(opcional)'} — aparece flotando sobre la página. Toca para {dd.miniatura_url ? 'cambiar' : 'subir'}.</span>
            </div>
            {edit === 'miniatura' && (
              <div className="p-2 mt-1 bg-[#F7F7F5] border-y border-[#E8E8E8] flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                <label className="text-[11px] px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white cursor-pointer">
                  {subiendo === 'miniatura_url' ? 'Subiendo…' : '📷 Foto'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirCampo('miniatura_url', f); e.target.value = ''; }} />
                </label>
                <label className="text-[11px] px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white cursor-pointer">
                  {subiendo === 'miniatura_url' ? 'Subiendo…' : '🎬 Video'}
                  <input type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirCampo('miniatura_url', f); e.target.value = ''; }} />
                </label>
                {dd.miniatura_url && <button onClick={() => onCampo('miniatura_url', null)} className="text-[11px] px-3 py-1.5 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2]">Quitar</button>}
                <button onClick={() => setEdit(null)} className="text-[11px] px-3 py-1.5 rounded-lg bg-[#00A89D] text-white font-semibold">Listo</button>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );

  function vista(b: Bloque) {
    if (b.tipo === 'foto') return b.url
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={b.url} alt="" className="w-full max-h-56 object-cover" />
      : <Vacio icono="📷" label="Foto — toca para subir" />;
    if (b.tipo === 'video') return b.url
      ? <video src={b.url} className="w-full max-h-56 bg-black" />
      : <Vacio icono="🎬" label="Video — toca para subir" />;
    if (b.tipo === 'collage') return (b.urls && b.urls.length)
      ? <div className="grid grid-cols-2 gap-1 p-1">{b.urls.map((u, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={k} src={u} alt="" className="w-full aspect-square object-cover rounded" />))}</div>
      : <Vacio icono="🖼️" label="Collage — toca para agregar fotos" />;
    if (b.tipo === 'texto') return (
      <div className={`px-3 py-2 ${b.centrado ? 'text-center' : ''}`}>
        {b.titulo && <div className="font-bold text-sm">{b.titulo}</div>}
        <div className="text-sm whitespace-pre-line text-[#3A3A3A]">{b.cuerpo || 'Texto…'}</div>
      </div>
    );
    if (b.tipo === 'contador') return (
      <div className="flex justify-center gap-4 py-3 text-center">
        {[['09', 'HORAS'], ['59', 'MIN'], ['50', 'SEG']].map(([n, l]) => (
          <div key={l}><div className="text-2xl font-extrabold text-[#C1121F]">{n}</div><div className="text-[9px] text-[#9A9A9A]">{l}</div></div>
        ))}
      </div>
    );
    if (b.tipo === 'espaciador') return <div style={{ height: (b.altura ?? 24) }} className="bg-[repeating-linear-gradient(45deg,#F5F5F5,#F5F5F5_6px,#EDEDED_6px,#EDEDED_12px)]" />;
    if (b.tipo === 'separador') return <div className="mx-4 my-2 border-t border-[#DADADA]" />;
    if (b.tipo === 'beneficios') return (
      <div className="px-4 py-2">
        {b.titulo && <div className="font-extrabold text-sm mb-1" style={{ color: acento.texto }}>{b.titulo}</div>}
        <ul className="space-y-0.5">{((b.items as string[]) ?? []).map((it, k) => <li key={k} className="text-[13px] font-semibold">✅ {it}</li>)}</ul>
      </div>
    );
    if (b.tipo === 'garantia') return (
      <div className="mx-3 my-2 rounded-xl border-2 border-[#0D8A3E]/30 bg-[#0D8A3E]/[0.06] p-3 text-center">
        <div className="text-2xl">🏅</div>
        <div className="font-extrabold text-sm text-[#0D8A3E]">{b.titulo || 'COMPRA SIN RIESGO'}</div>
        {b.cuerpo && <div className="text-[12px] text-[#3A3A3A] mt-0.5">{b.cuerpo}</div>}
      </div>
    );
    if (b.tipo === 'confianza') return (
      <div className="flex flex-wrap justify-center gap-2 px-3 py-2">
        {((b.items as string[]) ?? []).map((it, k) => <span key={k} className="text-[11px] font-semibold bg-[#F2F1EE] rounded-full px-2.5 py-1">{it}</span>)}
      </div>
    );
    if (b.tipo === 'testimonios') return (
      <div className="px-3 py-2 space-y-2">
        {((b.items as any[]) ?? []).map((t, k) => (
          <div key={k} className="rounded-xl bg-[#FAFAF8] border border-[#EEE] p-2.5">
            <div className="text-[11px] text-[#F5A623]">★★★★★</div>
            <div className="text-[12px] text-[#3A3A3A] italic">"{t.texto}"</div>
            <div className="text-[11px] font-bold mt-0.5">— {t.nombre}</div>
          </div>
        ))}
      </div>
    );
    if (b.tipo === 'faq') return (
      <div className="px-3 py-2 space-y-1">
        {((b.items as any[]) ?? []).map((f, k) => (
          <div key={k} className="rounded-lg border border-[#EEE] p-2">
            <div className="text-[12px] font-bold">❓ {f.pregunta}</div>
            <div className="text-[11px] text-[#6B6B6B] mt-0.5">{f.respuesta}</div>
          </div>
        ))}
      </div>
    );
    return <div className="px-3 py-2"><div className="bg-[#00A89D] text-white text-center font-bold rounded-full py-2 text-sm">{b.texto || 'COMPRAR'}</div></div>;
  }

  function editor(b: Bloque) {
    if (b.tipo === 'foto' || b.tipo === 'video') return (
      <div className="flex gap-2">
        <label className="text-[11px] px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white cursor-pointer shrink-0">
          {subiendo === b.id ? 'Subiendo…' : (b.url ? 'Cambiar' : 'Subir ' + b.tipo)}
          <input type="file" accept={b.tipo === 'foto' ? 'image/*' : 'video/*'} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirB(b.id, f); e.target.value = ''; }} />
        </label>
        <input value={b.url ?? ''} onChange={e => editarB(b.id, { url: e.target.value })} placeholder="o pega enlace" className={inp} />
      </div>
    );
    if (b.tipo === 'collage') return (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1">
          {(b.urls ?? []).map((u, k) => (
            <div key={k} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="w-full aspect-square object-cover rounded" />
              <button onClick={() => editarB(b.id, { urls: (b.urls ?? []).filter((_, j) => j !== k) })} className="absolute -top-1 -right-1 bg-[#DC2626] text-white rounded-full w-4 h-4 text-[10px] leading-none">×</button>
            </div>
          ))}
        </div>
        <label className="text-[11px] px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white cursor-pointer inline-block">
          {subiendo === b.id ? 'Subiendo…' : '+ Agregar foto'}
          <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirCollage(b.id, f); e.target.value = ''; }} />
        </label>
      </div>
    );
    if (b.tipo === 'texto') return (
      <div className="space-y-2">
        <input value={b.titulo ?? ''} onChange={e => editarB(b.id, { titulo: e.target.value })} placeholder="Título (opcional)" className={inp} />
        <textarea value={b.cuerpo ?? ''} onChange={e => editarB(b.id, { cuerpo: e.target.value })} rows={3} placeholder="Texto…" className={inp} />
        <label className="flex items-center gap-2 text-[11px] text-[#6B6B6B]"><input type="checkbox" checked={!!b.centrado} onChange={e => editarB(b.id, { centrado: e.target.checked })} /> Centrar</label>
      </div>
    );
    if (b.tipo === 'contador') return (
      <div>
        <label className="text-[11px] font-semibold text-[#6B6B6B]">Horas de la cuenta regresiva</label>
        <input type="number" value={b.horas ?? 10} onChange={e => editarB(b.id, { horas: Number(e.target.value) })} className={inp} />
      </div>
    );
    if (b.tipo === 'espaciador') return (
      <div>
        <label className="text-[11px] font-semibold text-[#6B6B6B]">Altura del espacio (px)</label>
        <input type="number" value={b.altura ?? 24} onChange={e => editarB(b.id, { altura: Number(e.target.value) })} className={inp} />
      </div>
    );
    if (b.tipo === 'separador') return <p className="text-[11px] text-[#6B6B6B]">Es una línea divisoria. No tiene ajustes.</p>;
    if (b.tipo === 'beneficios' || b.tipo === 'confianza') return (
      <div className="space-y-2">
        {b.tipo === 'beneficios' && <input value={b.titulo ?? ''} onChange={e => editarB(b.id, { titulo: e.target.value })} placeholder="Título (opcional)" className={inp} />}
        <textarea
          rows={4} className={inp}
          value={((b.items as string[]) ?? []).join('\n')}
          onChange={e => editarB(b.id, { items: e.target.value.split('\n') })}
          placeholder={b.tipo === 'confianza' ? '🚚 Envío gratis\n💵 Pago contra entrega' : 'Una por línea…\nMaterial premium\nEnvío rápido'}
        />
        <p className="text-[10px] text-[#9A9A9A]">Una línea por {b.tipo === 'confianza' ? 'insignia' : 'beneficio'}.</p>
      </div>
    );
    if (b.tipo === 'garantia') return (
      <div className="space-y-2">
        <input value={b.titulo ?? ''} onChange={e => editarB(b.id, { titulo: e.target.value })} placeholder="Título (ej. COMPRA SIN RIESGO)" className={inp} />
        <textarea value={b.cuerpo ?? ''} onChange={e => editarB(b.id, { cuerpo: e.target.value })} rows={2} placeholder="Texto de la garantía…" className={inp} />
      </div>
    );
    if (b.tipo === 'testimonios' || b.tipo === 'faq') {
      const items: any[] = (b.items as any[]) ?? [];
      const upd = (nv: any[]) => editarB(b.id, { items: nv });
      const esTest = b.tipo === 'testimonios';
      return (
        <div className="space-y-2">
          {items.map((it, k) => (
            <div key={k} className="rounded-lg border border-[#E8E8E8] p-2 space-y-1">
              <input value={esTest ? it.nombre : it.pregunta} onChange={e => upd(items.map((x, j) => j === k ? { ...x, [esTest ? 'nombre' : 'pregunta']: e.target.value } : x))} placeholder={esTest ? 'Nombre' : 'Pregunta'} className={inp} />
              <textarea value={esTest ? it.texto : it.respuesta} onChange={e => upd(items.map((x, j) => j === k ? { ...x, [esTest ? 'texto' : 'respuesta']: e.target.value } : x))} rows={2} placeholder={esTest ? 'Comentario del cliente' : 'Respuesta'} className={inp} />
              <button onClick={() => upd(items.filter((_, j) => j !== k))} className="text-[11px] text-[#DC2626]">Eliminar</button>
            </div>
          ))}
          <button onClick={() => upd([...items, esTest ? { nombre: '', texto: '' } : { pregunta: '', respuesta: '' }])} className="text-[11px] text-[#00A89D] font-semibold">+ Agregar {esTest ? 'testimonio' : 'pregunta'}</button>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <input value={b.texto ?? ''} onChange={e => editarB(b.id, { texto: e.target.value })} placeholder="Texto del botón" className={inp} />
        <select value={b.accion ?? 'comprar'} onChange={e => editarB(b.id, { accion: e.target.value as ('comprar' | 'url') })} className={inp}>
          <option value="comprar">Ir a comprar</option><option value="url">Abrir enlace</option>
        </select>
        {b.accion === 'url' && <input value={b.url ?? ''} onChange={e => editarB(b.id, { url: e.target.value })} placeholder="https://…" className={inp} />}
      </div>
    );
  }
}

function Vacio({ icono, label }: { icono: string; label: string }) {
  return <div className="flex items-center justify-center gap-2 h-20 text-xs text-[#9A9A9A] bg-[#F5F5F5]">{icono} {label}</div>;
}

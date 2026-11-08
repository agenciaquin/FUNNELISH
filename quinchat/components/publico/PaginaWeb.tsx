'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ConfigPagina, DatosPagina, CatalogoWeb } from '@/lib/mi-pagina';
import { BASE_TIENDA, pesosCOP } from '@/lib/mi-pagina';

/**
 * Página pública de «Mi Página». La misma pieza se usa:
 *  · en /web/<slug> (lo publicado), y
 *  · dentro del panel como vista previa (preview = true): escucha la config que le manda el editor
 *    por postMessage y se redibuja al instante, sin guardar.
 */
export default function PaginaWeb({ config: inicial, datos, preview = false }: {
  config: ConfigPagina; datos: DatosPagina; preview?: boolean;
}) {
  const [config, setConfig] = useState(inicial);
  const [filtro, setFiltro] = useState('Todos');
  const [abierto, setAbierto] = useState<CatalogoWeb | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!preview) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.tipo === 'mi-pagina-config' && e.data.config) setConfig(e.data.config);
    };
    window.addEventListener('message', onMsg);
    window.parent?.postMessage({ tipo: 'mi-pagina-lista' }, window.location.origin);
    return () => window.removeEventListener('message', onMsg);
  }, [preview]);

  const color = /^#[0-9a-f]{6}$/i.test(config.marca.color) ? config.marca.color : '#00A895';
  const oscuro = mezclar(color, '#06201F', 0.72);

  // Catálogos elegidos, en el orden del editor, con su grupo y su embudo
  const porId = useMemo(() => new Map(datos.catalogos.map(c => [c.id, c])), [datos]);
  const elegidos = useMemo(() => config.catalogos
    .filter(s => s.visible && porId.has(s.id))
    .map(s => {
      const c = porId.get(s.id)!;
      return { ...c, grupo: s.grupo || 'Buzos', portada: s.portada || c.portada, embudo: (s.embudo && datos.embudos[s.embudo]) || null };
    })
    .filter(c => c.productos.length > 0), [config.catalogos, porId, datos.embudos]);
  const grupos = useMemo(() => ['Todos', ...new Set(elegidos.map(c => c.grupo))], [elegidos]);
  const visibles = filtro === 'Todos' ? elegidos : elegidos.filter(c => c.grupo === filtro);

  const wa = String(config.contacto.whatsapp ?? '').replace(/\D/g, '');
  const waNum = wa.length === 10 ? `57${wa}` : wa;
  const linkWa = (texto: string) => waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(texto)}` : null;
  const linkCompra = (c: { embudo: CatalogoWeb['embudo']; familia: string }, colorTxt?: string) => {
    const slug = c.embudo?.slug;
    if (slug) return `${BASE_TIENDA}/${slug}`;
    return linkWa(`Hola 👋 quiero el ${c.familia}${colorTxt ? ` color ${colorTxt}` : ''}`);
  };

  const nuevos = useMemo(() => elegidos
    .flatMap(c => c.productos.map(p => ({ ...p, cat: c })))
    .sort((a, b) => b.creado.localeCompare(a.creado))
    .slice(0, config.nuevos_cantidad), [elegidos, config.nuevos_cantidad]);

  const secciones = config.secciones.filter(s => s.visible);
  const hay = (t: string) => secciones.some(s => s.tipo === t);
  const ir = (id: string) => { setMenu(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#111] font-sans">
      {/* Encabezado */}
      <header className="sticky top-0 z-30 text-white shadow-md" style={{ background: oscuro }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => ir('inicio')} className="flex items-center gap-2 min-w-0">
            {config.marca.logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={config.marca.logo} alt={config.marca.nombre} className="h-10 w-auto max-w-[140px] object-contain" />
              : <span className="text-lg font-extrabold tracking-tight truncate">{config.marca.nombre}</span>}
          </button>
          <nav className="hidden md:flex items-center gap-6 ml-auto text-sm font-medium text-white/85">
            <button onClick={() => ir('inicio')} className="hover:text-white">Inicio</button>
            {hay('catalogos') && <button onClick={() => ir('catalogos')} className="hover:text-white">Catálogos</button>}
            {hay('promociones') && datos.promociones.length > 0 && <button onClick={() => ir('promociones')} className="hover:text-white">Promociones</button>}
            {hay('opiniones') && config.opiniones.length > 0 && <button onClick={() => ir('opiniones')} className="hover:text-white">Opiniones</button>}
            {hay('contacto') && <button onClick={() => ir('contacto')} className="hover:text-white">Contacto</button>}
          </nav>
          <button onClick={() => setMenu(m => !m)} className="md:hidden ml-auto w-10 h-10 rounded-lg hover:bg-white/10 text-xl" aria-label="Menú">☰</button>
        </div>
        {menu && (
          <div className="md:hidden border-t border-white/10 px-4 py-2 flex flex-col text-sm">
            {[['inicio', 'Inicio', true], ['catalogos', 'Catálogos', hay('catalogos')], ['promociones', 'Promociones', hay('promociones') && datos.promociones.length > 0],
              ['opiniones', 'Opiniones', hay('opiniones') && config.opiniones.length > 0], ['contacto', 'Contacto', hay('contacto')]]
              .filter(x => x[2]).map(([id, t]) => <button key={String(id)} onClick={() => ir(String(id))} className="text-left py-2">{t}</button>)}
          </div>
        )}
      </header>
      <div id="inicio" />

      {secciones.map(s => {
        switch (s.tipo) {
          case 'banner': return (
            <section key={s.id} className="relative overflow-hidden text-white" style={{ background: `linear-gradient(120deg, ${oscuro} 0%, ${color} 140%)` }}>
              <div className="max-w-6xl mx-auto px-4 py-10 md:py-16 grid md:grid-cols-2 gap-6 items-center">
                <div>
                  <h1 className="text-3xl md:text-5xl font-extrabold italic leading-tight">{config.banner.titulo}</h1>
                  {config.banner.subtitulo && <p className="mt-2 text-white/85 md:text-lg">{config.banner.subtitulo}</p>}
                  {config.banner.boton && hay('catalogos') && (
                    <button onClick={() => ir('catalogos')} className="mt-5 px-5 py-2.5 rounded-full bg-white text-[#111] text-sm font-bold shadow hover:scale-[1.02] transition">
                      {config.banner.boton} →
                    </button>
                  )}
                </div>
                {config.banner.imagen && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={config.banner.imagen} alt="" className="w-full max-h-[340px] object-contain drop-shadow-2xl" />
                )}
              </div>
            </section>
          );

          case 'catalogos': return elegidos.length === 0 ? null : (
            <section key={s.id} id="catalogos" className="max-w-6xl mx-auto px-4 py-10">
              <Titulo texto={s.titulo || 'Catálogos'} color={color} />
              {grupos.length > 2 && (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
                  {grupos.map(g => (
                    <button key={g} onClick={() => setFiltro(g)}
                      className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition ${filtro === g ? 'text-white border-transparent' : 'bg-white text-[#333] border-[#E5E5E5]'}`}
                      style={filtro === g ? { background: color } : undefined}>{g}</button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
                {visibles.map(c => (
                  <article key={c.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#EEE] flex flex-col">
                    <button onClick={() => setAbierto(c)} className="aspect-square bg-[#F1F1EF] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {c.portada && <img src={c.portada} alt={c.familia} loading="lazy" className="w-full h-full object-contain hover:scale-105 transition" />}
                    </button>
                    <div className="p-3 flex-1 flex flex-col">
                      <h3 className="text-sm font-bold leading-tight">{c.familia}</h3>
                      <p className="text-[11px] text-[#777] mt-0.5">{c.productos.length} {c.productos.length === 1 ? 'color' : 'colores'}</p>
                      <div className="flex gap-1 mt-2">
                        {c.productos.slice(0, 5).map(p => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={p.id} src={p.foto} alt={p.color} title={p.color} loading="lazy" className="w-7 h-7 rounded-md object-cover border border-[#EEE]" />
                        ))}
                      </div>
                      {c.embudo?.precio != null && (
                        <p className="mt-2 text-sm font-extrabold" style={{ color }}>
                          {pesosCOP(c.embudo.precio)}
                          {c.embudo.precio_antes ? <span className="ml-1 text-[11px] text-[#999] line-through font-normal">{pesosCOP(c.embudo.precio_antes)}</span> : null}
                        </p>
                      )}
                      <div className="mt-auto pt-3 flex gap-1.5">
                        <button onClick={() => setAbierto(c)} className="flex-1 px-2 py-2 rounded-xl border border-[#E5E5E5] text-xs font-semibold">Ver colores</button>
                        <Comprar href={linkCompra(c)} color={color} embudo={!!c.embudo} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );

          case 'nuevos': return nuevos.length === 0 ? null : (
            <section key={s.id} className="max-w-6xl mx-auto px-4 py-10">
              <Titulo texto={s.titulo || 'Nuevos ingresos'} color={color} />
              <div className="flex gap-3 overflow-x-auto pb-3 snap-x">
                {nuevos.map(p => (
                  <article key={p.id} className="snap-start shrink-0 w-40 md:w-52 bg-white rounded-2xl overflow-hidden border border-[#EEE] shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.foto} alt={p.color} loading="lazy" className="w-full aspect-square object-contain bg-[#F1F1EF]" />
                    <div className="p-2.5">
                      <p className="text-xs font-bold leading-tight line-clamp-2">{p.cat.familia}</p>
                      <p className="text-[11px] text-[#777]">{p.color}</p>
                      {p.cat.embudo?.precio != null && <p className="text-sm font-extrabold mt-1" style={{ color }}>{pesosCOP(p.cat.embudo.precio)}</p>}
                      <div className="mt-2"><Comprar href={linkCompra(p.cat, p.color)} color={color} embudo={!!p.cat.embudo} ancho /></div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );

          case 'promociones': return datos.promociones.length === 0 ? null : (
            <section key={s.id} id="promociones" className="max-w-6xl mx-auto px-4 py-10">
              <Titulo texto={s.titulo || 'Promociones'} color={color} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
                {datos.promociones.map(p => (
                  <a key={p.id} href={`${BASE_TIENDA}/promos/${p.id}`} className="bg-white rounded-2xl overflow-hidden border border-[#EEE] shadow-sm block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.foto && <img src={p.foto} alt={p.nombre} loading="lazy" className="w-full aspect-square object-contain bg-[#F1F1EF]" />}
                    <div className="p-3">
                      <p className="text-sm font-bold leading-tight">{p.nombre}</p>
                      <p className="mt-1 text-sm font-extrabold" style={{ color }}>
                        {pesosCOP(p.precio)}
                        {p.precio_antes ? <span className="ml-1 text-[11px] text-[#999] line-through font-normal">{pesosCOP(p.precio_antes)}</span> : null}
                      </p>
                      <span className="mt-2 inline-block text-xs font-bold text-white px-3 py-1.5 rounded-lg" style={{ background: color }}>🔥 Ver promo</span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          );

          case 'opiniones': return config.opiniones.length === 0 ? null : (
            <section key={s.id} id="opiniones" className="max-w-6xl mx-auto px-4 py-10">
              <Titulo texto={s.titulo || 'Opiniones'} color={color} />
              <div className="grid md:grid-cols-3 gap-4">
                {config.opiniones.filter(o => o.texto.trim()).map((o, i) => (
                  <blockquote key={i} className="bg-white rounded-2xl p-4 border border-[#EEE] shadow-sm">
                    <p className="text-[#F5B301] text-sm">{'★'.repeat(Math.max(1, Math.min(5, o.estrellas || 5)))}</p>
                    <p className="text-sm mt-2 text-[#333]">“{o.texto}”</p>
                    {o.foto && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.foto} alt="" loading="lazy" className="mt-3 w-full max-h-48 object-cover rounded-xl" />
                    )}
                    <footer className="text-xs font-bold mt-3">{o.nombre}</footer>
                  </blockquote>
                ))}
              </div>
            </section>
          );

          case 'texto': return !(s.titulo || s.texto) ? null : (
            <section key={s.id} className="max-w-3xl mx-auto px-4 py-10 text-center">
              {s.titulo && <h2 className="text-2xl font-extrabold">{s.titulo}</h2>}
              {s.texto && <p className="mt-3 text-[#444] whitespace-pre-line">{s.texto}</p>}
            </section>
          );

          case 'contacto': return (
            <section key={s.id} id="contacto" className="text-white" style={{ background: oscuro }}>
              <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-6 items-center">
                <div>
                  <h2 className="text-2xl font-extrabold">{s.titulo || 'Contacto'}</h2>
                  {config.contacto.texto && <p className="mt-2 text-white/80">{config.contacto.texto}</p>}
                </div>
                <div className="flex flex-wrap gap-3 md:justify-end">
                  {linkWa('Hola 👋 vengo de su página') && (
                    <a href={linkWa('Hola 👋 vengo de su página')!} target="_blank" rel="noreferrer" className="px-5 py-3 rounded-full bg-[#25D366] text-white font-bold text-sm">WhatsApp</a>
                  )}
                  {config.contacto.instagram && (
                    <a href={`https://instagram.com/${config.contacto.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer" className="px-5 py-3 rounded-full bg-white/10 border border-white/20 font-bold text-sm">Instagram</a>
                  )}
                </div>
              </div>
            </section>
          );
          default: return null;
        }
      })}

      <footer className="text-center text-[11px] text-[#999] py-6">© {new Date().getFullYear()} {config.marca.nombre}{config.marca.eslogan ? ` · ${config.marca.eslogan}` : ''}</footer>

      {/* Colores de un catálogo */}
      {abierto && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-6" onClick={() => setAbierto(null)}>
          <div className="bg-white w-full md:max-w-3xl max-h-[88vh] overflow-y-auto rounded-t-3xl md:rounded-3xl p-4 md:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-extrabold">{abierto.familia}</h3>
                {abierto.embudo?.precio != null && <p className="text-sm font-bold" style={{ color }}>{pesosCOP(abierto.embudo.precio)}</p>}
              </div>
              <button onClick={() => setAbierto(null)} className="w-9 h-9 rounded-full bg-[#F1F1EF] text-lg">×</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {abierto.productos.map(p => (
                <div key={p.id} className="rounded-2xl border border-[#EEE] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.foto} alt={p.color} loading="lazy" className="w-full aspect-square object-contain bg-[#F1F1EF]" />
                  <div className="p-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">{p.color}</span>
                    <Comprar href={linkCompra(abierto, p.color)} color={color} embudo={!!abierto.embudo} mini />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante de WhatsApp */}
      {waNum && (
        <a href={linkWa('Hola 👋 vengo de su página')!} target="_blank" rel="noreferrer" aria-label="WhatsApp"
          className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-[#25D366] text-white text-2xl flex items-center justify-center shadow-xl">💬</a>
      )}
    </div>
  );
}

function Titulo({ texto, color }: { texto: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="w-1.5 h-7 rounded-full" style={{ background: color }} />
      <h2 className="text-xl md:text-2xl font-extrabold">{texto}</h2>
    </div>
  );
}

function Comprar({ href, color, embudo, mini, ancho }: { href: string | null; color: string; embudo: boolean; mini?: boolean; ancho?: boolean }) {
  if (!href) return null;
  return (
    <a href={href} target={embudo ? undefined : '_blank'} rel="noreferrer"
      className={`${ancho ? 'block text-center w-full' : mini ? '' : 'flex-1 text-center'} ${mini ? 'px-2.5 py-1.5 text-[11px]' : 'px-2 py-2 text-xs'} rounded-xl font-bold text-white shrink-0`}
      style={{ background: embudo ? color : '#25D366' }}>
      {embudo ? 'Comprar' : 'Lo quiero'}
    </a>
  );
}

/** Mezcla dos colores hex (p = peso del segundo). */
function mezclar(a: string, b: string, p: number): string {
  const h = (x: string) => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
  const [r1, g1, b1] = h(a), [r2, g2, b2] = h(b);
  const m = (x: number, y: number) => Math.round(x * (1 - p) + y * p).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

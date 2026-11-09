'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ConfigPagina, DatosPagina, CatalogoWeb, EmbudoWeb } from '@/lib/mi-pagina';
import { BASE_TIENDA, pesosCOP, grupoSugerido, nombreBonito, enlaceEmbudo } from '@/lib/mi-pagina';
import Pixeles from '@/components/publico/Pixeles';

/**
 * Página pública de «Mi Página» (tienda hecha con los embudos). La misma pieza se usa:
 *  · en /web/<slug> (lo publicado), y
 *  · dentro del panel como vista previa (preview = true): escucha la config que le manda el editor
 *    por postMessage y se redibuja al instante, sin guardar.
 * «Ver producto» abre el embudo tal cual (pedido.klixmant.shop/<slug>): no se toca su lógica.
 */
export default function PaginaWeb({ config: inicial, datos, preview = false }: {
  config: ConfigPagina; datos: DatosPagina; preview?: boolean;
}) {
  const [config, setConfig] = useState(inicial);
  const [filtro, setFiltro] = useState('Todos');
  const [abierto, setAbierto] = useState<(CatalogoWeb & { embudo: EmbudoWeb | null }) | null>(null);
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
  const oscuro = mezclar(color, '#041716', 0.78);

  // Embudos en la tienda, en el orden del editor
  const productos = useMemo(() => config.productos
    .filter(p => p.visible && !p.quitado && datos.embudos[p.slug])
    .map(p => { const e = datos.embudos[p.slug]; return { ...e, foto: p.foto || e.foto, grupo: grupoSugerido(e.producto) }; }),
  [config.productos, datos.embudos]);
  const grupos = useMemo(() => ['Todos', ...new Set(productos.map(p => p.grupo))], [productos]);
  const visibles = filtro === 'Todos' ? productos : productos.filter(p => p.grupo === filtro);

  // Catálogos (sección opcional)
  const porId = useMemo(() => new Map(datos.catalogos.map(c => [c.id, c])), [datos.catalogos]);
  const catalogos = useMemo(() => config.catalogos
    .filter(s => s.visible && porId.has(s.id))
    .map(s => { const c = porId.get(s.id)!; return { ...c, portada: s.portada || c.portada, embudo: (s.embudo && datos.embudos[s.embudo]) || null }; })
    .filter(c => c.productos.length > 0), [config.catalogos, porId, datos.embudos]);
  const nuevos = useMemo(() => catalogos
    .flatMap(c => c.productos.map(p => ({ ...p, cat: c })))
    .sort((a, b) => b.creado.localeCompare(a.creado))
    .slice(0, config.nuevos_cantidad), [catalogos, config.nuevos_cantidad]);

  const wa = String(config.contacto.whatsapp ?? '').replace(/\D/g, '');
  const waNum = wa.length === 10 ? `57${wa}` : wa;
  const linkWa = (texto: string) => waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(texto)}` : null;
  const linkCat = (c: { embudo: EmbudoWeb | null; familia: string }, colorTxt?: string) =>
    c.embudo ? enlaceEmbudo(c.embudo.slug) : linkWa(`Hola 👋 quiero el ${c.familia}${colorTxt ? ` color ${colorTxt}` : ''}`);

  const secciones = config.secciones.filter(s => s.visible);
  const hay = (t: string) => secciones.some(s => s.tipo === t);
  const ir = (id: string, g?: string) => { setMenu(false); if (g) setFiltro(g); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };
  const navGrupos = hay('productos') ? grupos.filter(g => g !== 'Todos').slice(0, 5) : [];

  return (
    <div className="min-h-screen bg-[#F6F7F6] text-[#111] font-sans overflow-x-hidden">
      {/* Píxel de Meta de la página (visitas). No en la vista previa del panel. */}
      {!preview && /^\d{8,20}$/.test(String(config.marca.pixel_meta ?? '')) && <Pixeles meta={config.marca.pixel_meta} />}
      {/* Encabezado */}
      <header className="sticky top-0 z-30 text-white shadow-md" style={{ background: oscuro }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <button onClick={() => ir('inicio')} className="flex items-center gap-3 min-w-0">
            {config.marca.logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={config.marca.logo} alt={config.marca.nombre} className="h-10 w-auto max-w-[120px] object-contain" />
              : <span className="text-xl font-extrabold tracking-tight truncate">{config.marca.nombre}</span>}
            {config.marca.eslogan && <span className="hidden sm:block text-sm font-semibold text-white/90 truncate">{config.marca.eslogan}</span>}
          </button>
          <nav className="hidden md:flex items-center gap-5 ml-auto text-[13px] font-semibold text-white/85">
            <button onClick={() => ir('inicio')} className="hover:text-white">Inicio</button>
            {navGrupos.map(g => <button key={g} onClick={() => ir('productos', g)} className="hover:text-white">{g}</button>)}
            {hay('promociones') && datos.promociones.length > 0 && <button onClick={() => ir('promociones')} className="hover:text-white">Promociones</button>}
            {hay('contacto') && <button onClick={() => ir('contacto')} className="hover:text-white">Contacto</button>}
          </nav>
          <button onClick={() => setMenu(m => !m)} className="md:hidden ml-auto w-10 h-10 rounded-lg hover:bg-white/10 text-xl" aria-label="Menú">☰</button>
        </div>
        {menu && (
          <div className="md:hidden border-t border-white/10 px-4 py-2 flex flex-col text-sm">
            <button onClick={() => ir('inicio')} className="text-left py-2">Inicio</button>
            {navGrupos.map(g => <button key={g} onClick={() => ir('productos', g)} className="text-left py-2">{g}</button>)}
            {hay('contacto') && <button onClick={() => ir('contacto')} className="text-left py-2">Contacto</button>}
          </div>
        )}
      </header>
      <div id="inicio" />

      {secciones.map(s => {
        switch (s.tipo) {
          case 'banner': {
            // Portada armada con los productos que elige el dueño (máx. 3); si no eligió, los 3 primeros
            const elegidos = (config.banner.productos ?? []).map(sl => productos.find(p => p.slug === sl)).filter(Boolean) as typeof productos;
            const fotosPortada = (elegidos.length ? elegidos : productos).map(p => p.foto).filter(Boolean).slice(0, 3) as string[];
            return <Portada key={s.id} config={config} color={color} oscuro={oscuro} fotos={fotosPortada} onVer={() => ir('productos')} />;
          }

          case 'productos': return productos.length === 0 ? null : (
            <section key={s.id} id="productos" className="max-w-6xl mx-auto px-4 py-10">
              <h2 className="text-center text-2xl md:text-3xl font-extrabold mb-5">
                <span className="text-[#C9CFCD] mr-3">—</span>{s.titulo || 'Nuestros Productos'}<span className="text-[#C9CFCD] ml-3">—</span>
              </h2>
              {grupos.length > 2 && (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4 justify-start md:justify-center -mx-1 px-1">
                  {grupos.map(g => (
                    <button key={g} onClick={() => setFiltro(g)}
                      className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition ${filtro === g ? 'text-white border-transparent' : 'bg-white text-[#333] border-[#E5E5E5]'}`}
                      style={filtro === g ? { background: color } : undefined}>{g}</button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
                {visibles.map(p => (
                  <article key={p.slug} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#ECEEED] flex flex-col hover:shadow-lg transition">
                    <a href={enlaceEmbudo(p.slug)} className="block aspect-square bg-[#EEF1F0] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.foto && <img src={p.foto} alt={p.producto} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition duration-300" />}
                    </a>
                    <div className="p-3 flex-1 flex flex-col">
                      <h3 className="text-sm md:text-[15px] font-bold leading-tight">{nombreBonito(p.producto)}</h3>
                      <p className="mt-1.5 text-base md:text-lg font-extrabold text-[#C62828]">
                        {pesosCOP(p.precio)}
                        {p.precio_antes && p.precio && p.precio_antes > p.precio
                          ? <span className="ml-1.5 text-[11px] text-[#9A9A9A] line-through font-normal">{pesosCOP(p.precio_antes)}</span> : null}
                      </p>
                      <a href={enlaceEmbudo(p.slug)} className="mt-auto pt-3">
                        <span className="block text-center px-2 py-2.5 rounded-xl text-white text-[13px] font-bold" style={{ background: color }}>🛒 Ver producto</span>
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );

          case 'catalogos': return catalogos.length === 0 ? null : (
            <section key={s.id} className="max-w-6xl mx-auto px-4 py-10">
              <Titulo texto={s.titulo || 'Catálogos'} color={color} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
                {catalogos.map(c => (
                  <article key={c.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#EEE] flex flex-col">
                    <button onClick={() => setAbierto(c)} className="aspect-square bg-[#F1F1EF] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {c.portada && <img src={c.portada} alt={c.familia} loading="lazy" className="w-full h-full object-contain" />}
                    </button>
                    <div className="p-3 flex-1 flex flex-col">
                      <h3 className="text-sm font-bold leading-tight">{c.familia}</h3>
                      <p className="text-[11px] text-[#777]">{c.productos.length} colores</p>
                      {c.embudo?.precio != null && <p className="mt-1 text-sm font-extrabold text-[#C62828]">{pesosCOP(c.embudo.precio)}</p>}
                      <div className="mt-auto pt-3 flex gap-1.5">
                        <button onClick={() => setAbierto(c)} className="flex-1 px-2 py-2 rounded-xl border border-[#E5E5E5] text-xs font-semibold">Ver colores</button>
                        <Comprar href={linkCat(c)} color={color} embudo={!!c.embudo} />
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
                      <div className="mt-2"><Comprar href={linkCat(p.cat, p.color)} color={color} embudo={!!p.cat.embudo} ancho /></div>
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
                      <p className="mt-1 text-sm font-extrabold text-[#C62828]">{pesosCOP(p.precio)}</p>
                      <span className="mt-2 inline-block text-xs font-bold text-white px-3 py-1.5 rounded-lg" style={{ background: color }}>🔥 Ver promo</span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          );

          case 'opiniones': return config.opiniones.filter(o => o.texto.trim()).length === 0 ? null : (
            <section key={s.id} className="max-w-6xl mx-auto px-4 py-10">
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
            <section key={s.id} id="contacto" className="text-white mt-6" style={{ background: oscuro }}>
              <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-6 items-center">
                <div>
                  <h2 className="text-2xl font-extrabold">{s.titulo || 'Contacto'}</h2>
                  {config.contacto.texto && <p className="mt-2 text-white/80">{config.contacto.texto}</p>}
                </div>
                <div className="flex flex-wrap gap-3 md:justify-end">
                  {waNum && <a href={linkWa('Hola 👋 vengo de su página')!} target="_blank" rel="noreferrer" className="px-5 py-3 rounded-full bg-[#25D366] text-white font-bold text-sm">WhatsApp</a>}
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

      <footer className="text-center text-[11px] text-[#999] py-6">© {new Date().getFullYear()} {config.marca.nombre}</footer>

      {abierto && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-6" onClick={() => setAbierto(null)}>
          <div className="bg-white w-full md:max-w-3xl max-h-[88vh] overflow-y-auto rounded-t-3xl md:rounded-3xl p-4 md:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-lg font-extrabold">{abierto.familia}</h3>
              <button onClick={() => setAbierto(null)} className="w-9 h-9 rounded-full bg-[#F1F1EF] text-lg">×</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {abierto.productos.map(p => (
                <div key={p.id} className="rounded-2xl border border-[#EEE] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.foto} alt={p.color} loading="lazy" className="w-full aspect-square object-contain bg-[#F1F1EF]" />
                  <div className="p-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">{p.color}</span>
                    <Comprar href={linkCat(abierto, p.color)} color={color} embudo={!!abierto.embudo} mini />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {waNum && (
        <a href={linkWa('Hola 👋 vengo de su página')!} target="_blank" rel="noreferrer" aria-label="WhatsApp"
          className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-[#25D366] text-white text-2xl flex items-center justify-center shadow-xl">💬</a>
      )}
    </div>
  );
}

/** Portada: la foto que suba el dueño, o una por defecto armada con las fotos reales de sus embudos. */
function Portada({ config, color, oscuro, fotos, onVer }: { config: ConfigPagina; color: string; oscuro: string; fotos: string[]; onVer: () => void }) {
  const b = config.banner;
  const iconos = ['👕', '🏅', '🚚', '⭐'];
  const textos = (
    <div className="relative z-10">
      <h1 className="text-[34px] leading-[0.95] md:text-6xl font-black italic uppercase drop-shadow-lg">
        {b.titulo}{b.titulo2 && <><br /><span style={{ color: mezclar(color, '#FFFFFF', 0.35) }}>{b.titulo2}</span></>}
      </h1>
      {b.subtitulo && <p className="mt-3 text-white/90 md:text-lg">{b.subtitulo}</p>}
      {b.beneficios.filter(Boolean).length > 0 && (
        <div className="mt-5 flex gap-5 md:gap-8">
          {b.beneficios.filter(Boolean).slice(0, 4).map((t, i) => (
            <div key={i} className="text-center w-16 md:w-20">
              <div className="text-xl md:text-2xl">{iconos[i]}</div>
              <p className="text-[10px] md:text-xs font-bold leading-tight mt-1">{t}</p>
            </div>
          ))}
        </div>
      )}
      {b.boton && (
        <button onClick={onVer} className="mt-6 px-6 py-3 rounded-full bg-white text-[#111] text-sm font-extrabold shadow-lg hover:scale-[1.03] transition">{b.boton} →</button>
      )}
    </div>
  );
  // Sin textos (lo normal desde 08-nov-2026): solo las fotos, en una franja baja para que en el
  // celular se vean enseguida los productos y catálogos.
  const conTextos = b.mostrar_textos === true;
  if (b.imagen && !conTextos) {
    return (
      <section className="relative overflow-hidden" style={{ background: oscuro }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={b.imagen} alt="" className="w-full h-36 md:h-72 object-cover" />
      </section>
    );
  }
  if (b.imagen) {
    return (
      <section className="relative overflow-hidden text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={b.imagen} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${oscuro}E6 0%, ${oscuro}80 45%, transparent 75%)` }} />
        <div className="relative max-w-6xl mx-auto px-5 py-12 md:py-24">{textos}</div>
      </section>
    );
  }
  // Orden del abanico: el 1.º elegido va al centro y adelante; el 2.º a la izquierda; el 3.º a la derecha
  const abanico = fotos.length === 3 ? [fotos[1], fotos[0], fotos[2]] : fotos.length === 2 ? [fotos[1], fotos[0]] : fotos;
  const centro = fotos.length === 3 ? 1 : fotos.length === 2 ? 1 : 0;
  const fondo = { background: `radial-gradient(circle at 50% 40%, ${mezclar(color, '#041716', 0.35)} 0%, ${oscuro} 70%)` };
  if (!conTextos) {
    if (!abanico.length) return null;
    return (
      <section className="relative overflow-hidden" style={fondo}>
        <div className="max-w-[300px] md:max-w-[560px] mx-auto px-2 py-3 md:py-8 flex items-center justify-center">
          {abanico.map((f, i) => {
            const esCentro = i === centro;
            const lado = i < centro ? -1 : i > centro ? 1 : 0;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${f}-${i}`} src={f} alt=""
                className={`rounded-xl md:rounded-2xl shadow-2xl object-cover border-2 md:border-4 border-white/10 aspect-square relative ${esCentro ? 'w-[44%] z-20' : 'w-[33%] z-10 opacity-95'}`}
                style={{ marginLeft: i === 0 ? 0 : '-8%', transform: `rotate(${lado * 7}deg) ${esCentro ? 'scale(1.04)' : 'translateY(5%)'}` }} />
            );
          })}
        </div>
      </section>
    );
  }
  return (
    <section className="relative overflow-hidden text-white" style={{ background: `radial-gradient(circle at 70% 35%, ${mezclar(color, '#041716', 0.35)} 0%, ${oscuro} 62%)` }}>
      <div className="max-w-6xl mx-auto px-4 md:px-5 pt-6 pb-8 md:py-16 grid md:grid-cols-2 gap-5 md:gap-6 items-center">
        <div className="text-center md:text-left [&_.flex]:justify-center md:[&_.flex]:justify-start">{textos}</div>
        {abanico.length > 0 && (
          <div className="order-first md:order-none flex items-center justify-center py-2 md:py-0">
            {abanico.map((f, i) => {
              const esCentro = i === centro;
              const lado = i < centro ? -1 : i > centro ? 1 : 0;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${f}-${i}`} src={f} alt=""
                  className={`rounded-2xl shadow-2xl object-cover border-4 border-white/10 aspect-square ${esCentro ? 'w-[46%] md:w-[48%] relative z-20' : 'w-[34%] md:w-[36%] relative z-10 opacity-95'}`}
                  style={{ marginLeft: i === 0 ? 0 : '-9%', transform: `rotate(${lado * 7}deg) ${esCentro ? 'scale(1.04)' : 'translateY(6%)'}` }} />
              );
            })}
          </div>
        )}
      </div>
    </section>
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

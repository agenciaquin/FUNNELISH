import Link from 'next/link';
import { pesos, acentoDe, esVideo as esVideoUrl, type Funnel } from '@/lib/funnels';
import type { BloqueLayout } from '@/lib/funnel-layout';
import { TIPOS_ESTRUCTURALES } from '@/lib/funnel-layout';
import { estiloEspacio, tieneEspacio, estiloTexto, botonVariante, claseAnim } from '@/lib/bloque-estilo';
import Galeria from './Galeria';
import Contador from './Contador';
import FrasesRotativas from './FrasesRotativas';
import VideoPortada from './VideoPortada';
import Medio from './Medio';
import Bloques from './Bloques';
import PersonasComprando from './PersonasComprando';
import MiniaturaFlotante from './MiniaturaFlotante';
import MusicaFondo from './MusicaFondo';
import FormularioPedido from './FormularioPedido';
import NotifVentas from './NotifVentas';

/**
 * Dibuja la página del embudo desde su LAYOUT (lista ordenada de bloques).
 * Los bloques estructurales leen los campos del embudo; los de contenido se
 * delegan al componente Bloques (que ya sabe dibujar texto, foto, testimonios…).
 * Los elementos flotantes (personas comprando, miniatura, música, pie) van
 * siempre al final, igual que en la página clásica.
 */
export default function LayoutRender({
  f, layout, irAPedido, utms = {},
}: {
  f: Funnel;
  layout: BloqueLayout[];
  irAPedido: string;
  utms?: Record<string, string>;
}) {
  const acento = acentoDe(f.color);

  const Boton = (key: string) => (
    <Link
      key={key}
      href={irAPedido}
      style={{ background: acento.boton }}
      className="boton-compra relative overflow-hidden block mx-3 my-4 rounded-full hover:opacity-90 text-white text-center font-extrabold text-xl leading-tight py-4 transition-opacity"
    >
      COMPRAR<br /><span className="text-lg">CONTRA ENTREGA →</span>
    </Link>
  );

  const estructural = (b: BloqueLayout) => {
    switch (b.tipo) {
      case 'banner_clientes':
        return f.imagen_clientes ? <Medio key={b.id} url={f.imagen_clientes} alt="Nuestros clientes" className="w-full" /> : null;
      case 'titular':
        return <FrasesRotativas key={b.id} frases={f.frases.length > 0 ? f.frases : [f.titulo]} />;
      case 'galeria': {
        const p = b.props ?? {};
        const modo = p.modo === 'individual' ? 'individual' : 'carrusel';
        const ancho = Number(p.ancho) > 0 ? Number(p.ancho) : 100;
        const h = Number(p.h) || 0;
        const anim = claseAnim(p.anim);
        // Medio individual del bloque: se renderiza directo para respetar alto + recorte.
        const inner = (modo === 'individual' && p.url)
          ? (esVideoUrl(p.url)
            ? <video src={p.url} className="w-full object-cover" style={{ height: h > 0 ? h : undefined }} autoPlay muted loop playsInline />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={p.url} alt={f.producto} className="w-full object-cover" style={{ height: h > 0 ? h : undefined }} />)
          : (f.video_url
            ? <VideoPortada url={f.video_url} poster={f.imagenes[0]} />
            : <Galeria imagenes={f.imagenes} alt={f.producto} />);
        // Sin ajustes → se comporta como antes (sin div extra).
        if (!anim && ancho >= 100 && h <= 0) return <div key={b.id} style={{ display: 'contents' }}>{inner}</div>;
        return (
          <div key={b.id} className={anim} style={{ maxWidth: ancho < 100 ? `${ancho}%` : undefined, margin: ancho < 100 ? '0 auto' : undefined, height: h > 0 ? h : undefined, overflow: h > 0 ? 'hidden' : undefined }}>
            {inner}
          </div>
        );
      }
      case 'gatillos': {
        const p = b.props ?? {};
        const barra = p.barra == null ? 31 : Math.max(0, Math.min(100, Number(p.barra) || 0));
        const anchoB = Number(p.ancho) > 0 ? Number(p.ancho) : 100;
        const forma = botonVariante(p.botonForma || 'redondeado', p.botonColor || '#1E9E5A');
        const sellos: string[] = Array.isArray(p.sellos) ? p.sellos.filter(Boolean) : [];
        const tamOf = Number(p.tamOferta) > 0 ? Number(p.tamOferta) : 12;
        const tamPr = Number(p.tamPrecio) > 0 ? Number(p.tamPrecio) : 28;
        return (
          <div key={b.id} className={claseAnim(p.anim)} style={{ maxWidth: anchoB < 100 ? `${anchoB}%` : undefined, margin: anchoB < 100 ? '0 auto' : undefined }}>
            <div className="mx-3 my-3 rounded-2xl border-2 p-3.5" style={{ borderColor: '#EAE7E0' }}>
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <div className="font-extrabold leading-tight" style={estiloTexto({ font: p.tituloFont, color: p.tituloColor, size: p.tituloSize }, { color: '#C1121F', size: 20 })}>{p.titulo || 'OFERTA LIMITADA'}</div>
                  {p.mensaje && <div className="mt-1 font-semibold" style={estiloTexto({ color: p.mensajeColor, size: p.mensajeSize }, { color: '#0D0D0D', size: 13 })}>{p.mensaje}</div>}
                  <div className="mt-2 h-2.5 rounded-full bg-[#EEEEEE] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${barra}%`, background: p.barraColor || '#C1121F' }} /></div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#6B6B6B]" style={{ fontSize: tamOf }}>{p.etiquetaNormal || 'PRECIO NORMAL'}</div>
                  {f.precio_antes ? <div className="line-through font-extrabold text-[#C1121F]" style={{ fontSize: tamOf + 3 }}>{pesos(f.precio_antes)}</div> : null}
                  <div className="font-bold text-[#0D0D0D] mt-1" style={{ fontSize: tamOf }}>{p.etiquetaOferta || 'OFERTA LIMITADA'}</div>
                  <div className="font-extrabold leading-none" style={{ fontSize: tamPr, color: p.precioColor || '#C1121F' }}>{pesos(f.precio)}</div>
                </div>
              </div>
              {p.instruccion && <p className="text-center mt-3" style={estiloTexto({ color: p.instruccionColor, size: p.instruccionSize }, { color: '#6B6B6B', size: 13 })}>{p.instruccion}</p>}
              <a href={irAPedido} className={`block mt-3.5 hover:opacity-90 transition-opacity ${forma.className}`} style={{ ...forma.style, width: `${Number(p.botonAncho) > 0 ? Number(p.botonAncho) : 100}%`, margin: '0 auto', paddingTop: 15, paddingBottom: 15 }}>
                <span className="flex items-center justify-center gap-2" style={{ fontSize: Number(p.botonLetra) > 0 ? Number(p.botonLetra) : 18 }}>{p.botonTexto || 'CLIC AQUI PARA COMPRAR'} <span>→</span></span>
              </a>
              {sellos.length > 0 && <div className="flex flex-wrap justify-center gap-2 mt-3">{sellos.map((s, k) => <span key={k} className="text-[12px] font-semibold bg-[#F2F1EE] rounded-full px-3 py-1">{s}</span>)}</div>}
            </div>
          </div>
        );
      }
      case 'boton_comprar':
        return Boton(b.id);
      case 'precio': {
        const p = b.props ?? {};
        const lblAntes = p.labelAntes ?? 'Antes';
        const lblHoy = p.labelHoy ?? 'HOY 🔥';
        return (
          <div key={b.id} className="text-center py-2">
            {f.precio_antes && <p className="text-xl font-bold italic line-through" style={{ color: p.colorAntes || '#C1121F' }}>{lblAntes} {pesos(f.precio_antes)}</p>}
            <p className="text-[26px] font-extrabold leading-tight">{lblHoy} <span style={{ color: p.colorHoy || acento.texto }}>{pesos(f.precio)}</span></p>
          </div>
        );
      }
      case 'contador_pagina':
        return <Contador key={b.id} horas={f.horas_contador} />;
      case 'ultimas_unidades': {
        const p = b.props ?? {};
        return <p key={b.id} className="text-center font-extrabold text-2xl py-4" style={{ color: p.color || '#C1121F' }}>{p.texto || '⚠️ ÚLTIMAS UNIDADES'}</p>;
      }
      case 'detalle':
        return f.imagen_detalle ? <Medio key={b.id} url={f.imagen_detalle} alt={f.producto} className="w-full" /> : null;
      case 'caracteristicas':
        return (f.caracteristicas?.length ? (
          <div key={b.id} className="px-4 py-4">
            <h2 className="font-extrabold mb-2" style={{ color: acento.texto }}>CARACTERÍSTICAS DEL PRODUCTO:</h2>
            <ul className="space-y-1.5">{f.caracteristicas.map((c, i) => <li key={i} className="text-[15px] font-semibold">✅ {c}</li>)}</ul>
          </div>
        ) : null);
      case 'estrellas': {
        const p = b.props ?? {};
        const size = Number(p.size) > 0 ? Number(p.size) : 26;
        // Si eligen color, se usan estrellas ★ (respetan color); si no, el emoji ⭐.
        return <p key={b.id} className="text-center py-1" style={{ fontSize: size, color: p.color || undefined, letterSpacing: p.color ? 3 : undefined }}>{p.color ? '★★★★★' : '⭐⭐⭐⭐⭐'}</p>;
      }
      default:
        return null;
    }
  };

  return (
    <>
      {layout.filter(b => b.visible !== false).map(b => {
        const contenido = (b.tipo === 'checkout' || b.tipo === 'checkout_pro')
          ? <div id="checkout"><FormularioPedido funnel={f} utms={utms} config={b.props} /></div>
          : TIPOS_ESTRUCTURALES.has(b.tipo)
            ? estructural(b)
            : <Bloques bloques={[b as any]} acento={acento} irAPedido={irAPedido} />;
        // Solo se envuelve si el bloque define espacio (los viejos quedan igual).
        return tieneEspacio(b.props)
          ? <div key={b.id} style={estiloEspacio(b.props)}>{contenido}</div>
          : <div key={b.id} style={{ display: 'contents' }}>{contenido}</div>;
      })}

      <footer className="text-center text-[11px] text-[#9A9A9A] py-6 px-4 pb-20">
        Klixmant SAS · Pago contra entrega en toda Colombia
      </footer>

      {/* "Ventas en vivo": flotante, se saca del flujo (uno por bloque ventas). */}
      {layout.filter(b => b.tipo === 'ventas').map(b => (
        <NotifVentas key={b.id} props={b.props} />
      ))}

      {/* Botones flotantes: fijos abajo, siempre a la vista para comprar. */}
      {(() => {
        const flot = layout.filter(b => b.visible !== false && b.tipo === 'boton' && b.props?.flotante);
        if (!flot.length) return null;
        return (
          <div className="fixed bottom-0 inset-x-0 z-40 px-3 pt-6 pb-3 bg-gradient-to-t from-white via-white/95 to-transparent">
            <div className="max-w-[520px] mx-auto flex flex-col gap-2">
              {flot.map(b => {
                const a = b as any;
                const p = b.props ?? {};
                const externo = a.accion === 'url' && !!a.url;
                const href = externo ? (a.url as string) : irAPedido;
                const v = botonVariante(p.variante, p.bg || acento.boton);
                const escala = Number(p.escala) > 0 ? Number(p.escala) / 100 : 1;
                const colTxt = (v.style as any).color || '#FFFFFF';
                const pad = Math.round(13 * escala);
                return (
                  <a key={b.id} href={href} {...(externo ? { target: '_blank', rel: 'noreferrer' } : {})}
                    style={{ ...v.style, paddingTop: pad, paddingBottom: pad }}
                    className={`block hover:opacity-90 ${v.className}`}>
                    <span style={estiloTexto(p, { color: colTxt, size: Math.round(17 * escala) })}>{a.texto || 'COMPRAR'}</span>
                  </a>
                );
              })}
            </div>
          </div>
        );
      })()}

      <PersonasComprando base={f.personas_comprando} />
      {f.miniatura_url && <MiniaturaFlotante url={f.miniatura_url} />}
      {f.audio_url && <MusicaFondo url={f.audio_url} />}
    </>
  );
}

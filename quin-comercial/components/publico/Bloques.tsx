import Medio from './Medio';
import Contador from './Contador';
import BotonMasVendido from './BotonMasVendido';
import BarraStockAnimada from './BarraStockAnimada';
import Resenas from './Resenas';
import CarruselImagenes from './CarruselImagenes';
import { estiloTexto, botonVariante, claseAnim } from '@/lib/bloque-estilo';

interface Bloque {
  id: string;
  tipo: 'foto' | 'video' | 'texto' | 'boton' | string;
  url?: string;
  titulo?: string;
  cuerpo?: string;
  centrado?: boolean;
  texto?: string;
  accion?: 'comprar' | 'url' | string;
  urls?: string[];
  horas?: number;
  altura?: number;
  items?: any[];
  ancla?: string;
  props?: Record<string, any>;
}

/**
 * Bloques de contenido (constructor tipo Funnelish, simple).
 * Se muestran ARRIBA del producto. La pila es vertical: siempre se ve bien en
 * celular. El botón "comprar" lleva a la página de pedido; el botón "url" abre
 * un enlace externo.
 */
export default function Bloques({
  bloques, acento, irAPedido, soloAncla,
}: {
  bloques: Bloque[];
  acento: { boton: string; texto: string };
  irAPedido: string;
  soloAncla?: string;
}) {
  const lista = (bloques ?? []).filter(b => (soloAncla ? (b.ancla || 'portada') === soloAncla : true));
  if (lista.length === 0) return null;
  return (
    <div>
      {lista.map(b => {
        if (b.tipo === 'video' && b.url) {
          return <Medio key={b.id} url={b.url} alt="" className="w-full" />;
        }
        if (b.tipo === 'foto' && b.url) {
          const p = b.props ?? {};
          const h = Number(p.h) || 0;
          const ancho = Number(p.ancho) > 0 ? Number(p.ancho) : 100;
          const ajuste = p.ajuste === 'cover' ? 'cover' : 'contain';
          const rad = Number(p.redondeado) || 0;
          const raw = String(p.link || '').trim();
          const ext = /^https?:/i.test(raw);
          const href = raw ? (ext ? raw : `https://${raw}`) : '';
          const fullBleed = ancho >= 100;
          // eslint-disable-next-line @next/next/no-img-element
          const img = <img src={b.url} alt="" className="w-full block" style={{ height: h > 0 ? h : undefined, objectFit: h > 0 ? (ajuste as any) : undefined, borderRadius: rad }} />;
          return (
            <div key={b.id} className={`${fullBleed ? '' : 'px-3 py-2'} ${claseAnim(p.anim)}`}>
              <div className="relative mx-auto overflow-hidden" style={{ width: fullBleed ? undefined : `${ancho}%`, borderRadius: rad }}>
                {href ? <a href={href} target="_blank" rel="noreferrer">{img}</a> : img}
                {p.masVendido && <div className="absolute top-2 left-2 text-[12px] font-extrabold rounded-full px-2.5 py-1 shadow" style={{ background: p.mvColor || '#C1121F', color: p.mvColorTexto || '#fff' }}>{p.mvTexto || '🔥 MÁS VENDIDO'}</div>}
              </div>
            </div>
          );
        }
        if (b.tipo === 'texto') {
          const p = b.props ?? {};
          return (
            <div key={b.id} className={`px-4 py-3 ${b.centrado ? 'text-center' : ''}`} style={p.bg ? { background: p.bg } : undefined}>
              {b.titulo && (
                <h2 className="font-extrabold text-lg mb-1" style={{ color: acento.texto }}>{b.titulo}</h2>
              )}
              {b.cuerpo && <p className={`text-[15px] whitespace-pre-line leading-snug ${p.bold ? 'font-extrabold' : 'font-semibold'}`} style={estiloTexto(b.props)}>{b.cuerpo}</p>}
            </div>
          );
        }
        if (b.tipo === 'collage' && b.urls && b.urls.length) {
          return (
            <div key={b.id} className="grid grid-cols-2 gap-1 p-1">
              {b.urls.filter(Boolean).map((u, k) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={k} src={u} alt="" className="w-full aspect-square object-cover rounded" />
              ))}
            </div>
          );
        }
        if (b.tipo === 'contador') {
          return <Contador key={b.id} horas={b.horas ?? 10} />;
        }
        // ── Bloques nuevos (aditivos) ──
        if (b.tipo === 'mas_vendido') {
          return <BotonMasVendido key={b.id} props={b.props} />;
        }
        if (b.tipo === 'stock') {
          return <BarraStockAnimada key={b.id} props={b.props} />;
        }
        if (b.tipo === 'ventas') {
          // Flotante: no va en el flujo; lo dibuja LayoutRender aparte.
          return null;
        }
        if (b.tipo === 'gatillos') {
          const p = b.props ?? {};
          const estilo = p.estilo || 'tarjeta';
          const color = p.color || '#C1121F';
          const icono = p.icono ?? '✅';
          const lineas = ((p.lineas as string[]) ?? []).filter(Boolean);
          const franja = estilo === 'franja';
          const limpio = estilo === 'limpio';
          const anim = claseAnim(p.anim);
          const tituloStyle = estiloTexto(
            { font: p.tituloFont, color: p.tituloColor, size: p.tituloSize },
            { color: franja ? '#FFFFFF' : color, size: 17 },
          );
          const caja = limpio
            ? { background: 'transparent' }
            : franja
              ? { background: color }
              : { background: p.bg || '#FFF3CD', border: `2px solid ${color}` };
          return (
            <div key={b.id} className={`mx-3 my-3 rounded-2xl p-4 text-center ${anim}`} style={caja}>
              <div className="font-extrabold leading-tight" style={tituloStyle}>{p.titulo || '🔥 OFERTA POR TIEMPO LIMITADO'}</div>
              {lineas.length > 0 && (
                <ul className="mt-2 space-y-1.5 inline-block text-left">
                  {lineas.map((l, k) => (
                    <li key={k} className="text-[14px] font-semibold flex items-start gap-1.5" style={franja ? { color: '#FFFFFF' } : undefined}>
                      <span className="shrink-0">{icono}</span><span>{l}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }
        if (b.tipo === 'carrusel') {
          return <CarruselImagenes key={b.id} props={b.props} />;
        }
        if (b.tipo === 'encabezado') {
          const p = b.props ?? {};
          return <div key={b.id} className="px-4 py-3" style={{ textAlign: p.align || 'center' }}><span className={p.bold !== false ? 'font-extrabold' : 'font-semibold'} style={estiloTexto(p, { size: Number(p.size) || 26 })}>{p.texto || ''}</span></div>;
        }
        if (b.tipo === 'enlace') {
          const p = b.props ?? {};
          const raw = String(p.url || '').trim();
          const ext = /^https?:/i.test(raw);
          const href = raw ? (ext ? raw : `https://${raw}`) : irAPedido;
          return <div key={b.id} className="px-4 py-2" style={{ textAlign: p.align || 'center' }}><a href={href} {...(ext ? { target: '_blank', rel: 'noreferrer' } : {})} className="underline font-semibold" style={{ color: p.color || '#00A89D', fontSize: Number(p.size) || 15 }}>{b.texto || 'Ver más'}</a></div>;
        }
        if (b.tipo === 'social') {
          const p = b.props ?? {};
          const items = (b.props?.items as any[]) ?? [];
          const ICON: Record<string, string> = { whatsapp: '🟢', instagram: '📸', facebook: '👍', tiktok: '🎵', youtube: '▶️', web: '🌐' };
          const align = p.align === 'izq' ? 'flex-start' : p.align === 'der' ? 'flex-end' : 'center';
          const size = Number(p.size) || 30;
          const href = (s: any) => {
            const u = String(s.url || '').trim();
            if (!u) return '#';
            if (s.red === 'whatsapp') { const num = u.replace(/\D/g, ''); if (num) return `https://wa.me/${num}`; }
            return /^https?:/i.test(u) ? u : `https://${u}`;
          };
          const vis = items.filter((s: any) => String(s.url || '').trim());
          if (!vis.length) return null;
          return <div key={b.id} className="px-4 py-3 flex gap-5" style={{ justifyContent: align }}>{vis.map((s: any, k: number) => <a key={k} href={href(s)} target="_blank" rel="noreferrer" style={{ fontSize: size }} className="hover:opacity-80 transition-opacity">{ICON[s.red] || '🌐'}</a>)}</div>;
        }
        if (b.tipo === 'html') {
          const p = b.props ?? {};
          return <div key={b.id} className="px-4 py-2" dangerouslySetInnerHTML={{ __html: String(p.html || '') }} />;
        }
        if (b.tipo === 'espaciador') {
          return <div key={b.id} style={{ height: (b.altura ?? 24) }} />;
        }
        if (b.tipo === 'separador') {
          return <div key={b.id} className="mx-4 my-3 border-t border-[#E0E0E0]" />;
        }
        if (b.tipo === 'beneficios') {
          return (
            <div key={b.id} className="px-4 py-3">
              {b.titulo && <h2 className="font-extrabold text-lg mb-1.5" style={{ color: acento.texto }}>{b.titulo}</h2>}
              <ul className="space-y-1">
                {((b.items as string[]) ?? []).filter(Boolean).map((it, k) => (
                  <li key={k} className="text-[15px] font-semibold">✅ {it}</li>
                ))}
              </ul>
            </div>
          );
        }
        if (b.tipo === 'garantia') {
          return (
            <div key={b.id} className="mx-3 my-3 rounded-2xl border-2 border-[#0D8A3E]/30 bg-[#0D8A3E]/[0.06] p-4 text-center">
              <div className="text-3xl">🏅</div>
              <div className="font-extrabold text-base text-[#0D8A3E]">{b.titulo || 'COMPRA SIN RIESGO'}</div>
              {b.cuerpo && <div className="text-[14px] text-[#3A3A3A] mt-1">{b.cuerpo}</div>}
            </div>
          );
        }
        if (b.tipo === 'confianza') {
          return (
            <div key={b.id} className="flex flex-wrap justify-center gap-2 px-3 py-3">
              {((b.items as string[]) ?? []).filter(Boolean).map((it, k) => (
                <span key={k} className="text-[13px] font-semibold bg-[#F2F1EE] rounded-full px-3 py-1.5">{it}</span>
              ))}
            </div>
          );
        }
        if (b.tipo === 'testimonios') {
          return <Resenas key={b.id} b={b} acento={acento} irAPedido={irAPedido} />;
        }
        if (b.tipo === 'faq') {
          return (
            <div key={b.id} className="px-3 py-3 space-y-2">
              {((b.items as any[]) ?? []).map((f, k) => (
                <details key={k} className="rounded-xl border border-[#EEE] p-3">
                  <summary className="text-[15px] font-bold cursor-pointer">❓ {f.pregunta}</summary>
                  <div className="text-[14px] text-[#6B6B6B] mt-1.5">{f.respuesta}</div>
                </details>
              ))}
            </div>
          );
        }
        if (b.tipo === 'boton') {
          const p = b.props ?? {};
          // Los botones flotantes los dibuja LayoutRender fijos abajo (aquí no van).
          if (p.flotante) return null;
          const externo = b.accion === 'url' && !!b.url;
          const href = externo ? (b.url as string) : irAPedido;
          const v = botonVariante(p.variante, p.bg || acento.boton);
          const escala = Number(p.escala) > 0 ? Number(p.escala) / 100 : 1;
          const colTxt = (v.style as any).color || '#FFFFFF';
          const pad = Math.round(14 * escala);
          const anchoB = Number(p.ancho) > 0 ? Number(p.ancho) : 100;
          const boton = (
            <a
              href={href}
              {...(externo ? { target: '_blank', rel: 'noreferrer' } : {})}
              style={{ ...v.style, paddingTop: pad, paddingBottom: pad }}
              className={`hover:opacity-90 ${v.className} ${p.compacto ? 'mx-auto w-fit px-10 block' : 'block'}`}
            >
              <span style={estiloTexto(b.props, { color: colTxt, size: Math.round(18 * escala) })}>{b.texto || 'COMPRAR'}</span>
            </a>
          );
          return (
            <div key={b.id} className={`my-3 mx-3 ${claseAnim(p.anim)}`} style={{ maxWidth: anchoB < 100 ? `${anchoB}%` : undefined, marginLeft: anchoB < 100 ? 'auto' : undefined, marginRight: anchoB < 100 ? 'auto' : undefined }}>
              {boton}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

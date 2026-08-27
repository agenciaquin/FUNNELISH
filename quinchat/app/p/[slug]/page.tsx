import { notFound } from 'next/navigation';
import type { ReactNode, ReactElement } from 'react';
import Link from 'next/link';
import { obtenerFunnel, pesos, acentoDe, type Funnel } from '@/lib/funnels';
import { bloquesARenderizar, estiloBloque, botonVariante, type Bloque } from '@/lib/bloques';
import Galeria from '@/components/publico/Galeria';
import Contador from '@/components/publico/Contador';
import Pixeles from '@/components/publico/Pixeles';
import FrasesRotativas from '@/components/publico/FrasesRotativas';
import PersonasComprando from '@/components/publico/PersonasComprando';
import MusicaFondo from '@/components/publico/MusicaFondo';
import VideoPortada from '@/components/publico/VideoPortada';
import Medio from '@/components/publico/Medio';
import MiniaturaFlotante from '@/components/publico/MiniaturaFlotante';
import TemaSpiderman from '@/components/publico/TemaSpiderman';
import SpidermanJala from '@/components/publico/SpidermanJala';
import FunnelTracker from '@/components/publico/FunnelTracker';
import FormularioPedido from '@/components/publico/FormularioPedido';
import CheckoutPro from '@/components/publico/CheckoutPro';
import BotonBajarCheckout from '@/components/publico/BotonBajarCheckout';
import Testimonios from '@/components/publico/Testimonios';
import Gatillos from '@/components/publico/Gatillos';
import Stock from '@/components/publico/Stock';
import ResenaGatillo from '@/components/publico/ResenaGatillo';
import MasVendidoFlotante from '@/components/publico/MasVendidoFlotante';
import NotifVentas from '@/components/publico/NotifVentas';

// Embudos con temática especial (decoración solo en ESE embudo, por su slug).
const TEMA_SPIDERMAN = new Set(['spiderman', 'spider-man', 'spiderman-buzo']);

// Se arma en cada visita: necesita leer los UTM de la campaña que trajo al cliente
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await obtenerFunnel(slug);
  return {
    title: f?.producto ?? 'Klixmant',
    description: f?.titulo ?? 'Compra contra entrega en toda Colombia',
  };
}

export default async function PaginaVenta({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const f = await obtenerFunnel(slug);
  if (!f) notFound();

  // El paso 'landing' ahora se registra en el navegador (FunnelTracker): una vez
  // por sesión y solo humanos, para no inflar el conteo con bots ni recargas.

  // Los UTM viajan a la página de pedido para no perder de qué campaña vino
  const utms = new URLSearchParams();
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ttclid', 'fbclid']) {
    const v = query[k];
    if (typeof v === 'string' && v) utms.set(k, v);
  }
  // Enlace corto: /nacional/pedido en vez de /p/nacional/pedido
  const irAPedido = `/${slug}/pedido${utms.toString() ? `?${utms}` : ''}`;

  // Color de acento: morado, verde, lo que tenga este embudo
  const acento = acentoDe(f.color);

  const esSpiderman = TEMA_SPIDERMAN.has(slug.toLowerCase());

  // Diseño por bloques: el del embudo si lo tiene, o el orden de siempre.
  let bloques = bloquesARenderizar(f.layout);

  // Orden a la medida SOLO para este embudo (botones compactos y la foto de
  // detalle entre los dos botones). Solo si aún NO organizaste a mano (si guardas
  // un orden propio arrastrando en el panel, ESE manda). No afecta a otros embudos.
  if (slug === 'f1-escuderia-tk' && !f.layout) {
    bloques = [
      { id: 'f1_banner',   tipo: 'banner',           visible: true },
      { id: 'f1_titular',  tipo: 'titular',          visible: true },
      { id: 'f1_portada',  tipo: 'portada',          visible: true },
      { id: 'f1_btn1',     tipo: 'boton',            visible: true, props: { compacto: true } },
      { id: 'f1_detalle',  tipo: 'imagen',           visible: true, props: { url: f.imagen_detalle } },
      { id: 'f1_btn2',     tipo: 'boton',            visible: true, props: { compacto: true } },
      { id: 'f1_precio',   tipo: 'precio',           visible: true },
      { id: 'f1_contador', tipo: 'contador',         visible: true },
      { id: 'f1_ultimas',  tipo: 'ultimas_unidades', visible: true, props: { soloTexto: true } },
      { id: 'f1_carac',    tipo: 'caracteristicas',  visible: true },
      { id: 'f1_estrellas',tipo: 'estrellas',        visible: true },
      { id: 'f1_btn3',     tipo: 'boton',            visible: true, props: { compacto: true } },
    ];
  }
  const utmsObj = Object.fromEntries(utms.entries()) as Record<string, string>;
  // Si la página trae el checkout embebido, el botón baja hasta él (una sola pantalla).
  const tieneCheckout = bloques.some(b => (b.tipo === 'checkout' || b.tipo === 'checkout_pro') && b.visible !== false);

  const Boton = ({ compacto = false, bg, estilo, anim = '', label, variante, flotante = false }: {
    compacto?: boolean; bg?: string; estilo?: Record<string, string | number>; anim?: string; label?: string; variante?: string; flotante?: boolean;
  } = {}) => {
    if (tieneCheckout) return <BotonBajarCheckout slug={slug} color={bg || acento.boton} />;
    const v = botonVariante(variante, bg || acento.boton);
    const margen = flotante ? 'my-0' : compacto ? 'mx-4 my-2' : 'mx-3 my-2';
    return (
      <Link
        href={irAPedido}
        style={{ ...v.estilo, ...(estilo ?? {}) }}
        className={`boton-compra relative overflow-hidden block hover:opacity-90 text-white text-center font-extrabold transition-opacity ${v.clase} ${margen} ${compacto || flotante ? 'text-base py-3' : 'text-xl leading-tight py-4'} ${anim}`}
      >
        {label ? label : compacto || flotante ? 'COMPRAR CONTRA ENTREGA →' : (<>COMPRAR<br /><span className="text-lg">CONTRA ENTREGA →</span></>)}
      </Link>
    );
  };

  // Bloques marcados como flotantes (botón o stock): se muestran fijos abajo.
  const botonesFlotantes = bloques.filter(b => b.visible !== false && b.props?.flotante && (b.tipo === 'boton' || b.tipo === 'stock'));

  // Sello flotante "MÁS VENDIDO": el primer bloque visible de ese tipo. Su prop
  // `modelo` es el producto estrella que se preselecciona al tocarlo.
  const bloqueMasVendido = bloques.find(b => b.tipo === 'mas_vendido' && b.visible !== false);
  const modeloMasVendido = (bloqueMasVendido?.props?.modelo as string) || '';

  // Enlace de los botones intercalados: baja al checkout si está en la página,
  // o va a la página de pedido si no.
  const hrefCompra = tieneCheckout ? '#checkout' : irAPedido;

  // Aviso flotante "Ventas en vivo": primer bloque visible de ese tipo.
  const bloqueVentas = bloques.find(b => b.tipo === 'ventas' && b.visible !== false);

  // Reseña "gatillo": la que aparece como aviso flotante a los segundos.
  let resenaGatillo: any = null;
  let resenaGatilloProps: any = null;
  for (const b of bloques) {
    if (b.tipo === 'testimonios' && b.visible !== false) {
      const items = Array.isArray(b.props?.items) ? b.props!.items : [];
      const g = items.find((it: any) => it?.gatillo);
      if (g) { resenaGatillo = g; resenaGatilloProps = b.props || {}; break; }
    }
  }

  let spidermanPuesto = false; // el muñeco cuelga tras el primer botón

  return (
    <main className="min-h-screen bg-white max-w-lg mx-auto scroll-smooth">
      <Pixeles meta={f.pixel_meta} tiktok={f.pixel_tiktok} evento="ViewContent"
        datos={{ contentId: f.slug, producto: f.producto, valor: f.precio }} />
      <FunnelTracker slug={slug} />

      {/* Temática Spider-Man — SOLO en este embudo (por su slug). No afecta a los demás. */}
      {esSpiderman && <TemaSpiderman />}

      {bloques.map((b) => {
        if (b.visible === false) return null;
        if (b.props?.flotante && (b.tipo === 'boton' || b.tipo === 'stock')) return null; // va fijo abajo
        if (b.tipo === 'mas_vendido') return null; // sello flotante, se muestra aparte
        if (b.tipo === 'ventas') return null; // aviso flotante, se muestra aparte
        const contenido = renderBloque(b, f, acento, Boton, utmsObj, modeloMasVendido, hrefCompra);
        if (contenido == null) return null;
        // El Spider-Man colgando va justo debajo del primer botón (solo ese embudo)
        const ponerSpiderman = esSpiderman && b.tipo === 'boton' && !spidermanPuesto;
        if (ponerSpiderman) spidermanPuesto = true;
        return (
          <div key={b.id} style={{
            marginTop: Number(b.props?.mt) || undefined,
            marginBottom: Number(b.props?.mb) || undefined,
            width: Number(b.props?.w) && Number(b.props?.w) < 100 ? `${Number(b.props?.w)}%` : undefined,
            marginLeft: Number(b.props?.w) && Number(b.props?.w) < 100 ? 'auto' : undefined,
            marginRight: Number(b.props?.w) && Number(b.props?.w) < 100 ? 'auto' : undefined,
          }}>
            {contenido}
            {ponerSpiderman && <SpidermanJala />}
          </div>
        );
      })}

      <footer className="text-center text-[11px] text-[#9A9A9A] py-6 px-4 pb-20">
        Klixmant SAS · Pago contra entrega en toda Colombia
      </footer>

      <PersonasComprando base={f.personas_comprando} />

      {/* Botón(es) flotante(s): barra fija abajo con CTA siempre visible */}
      {botonesFlotantes.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="max-w-lg mx-auto px-3 py-2 bg-white/95 backdrop-blur border-t border-[#E8E8E8]">
            {botonesFlotantes.map((b) => {
              if (b.tipo === 'stock') return <Stock key={b.id} props={b.props} flotante />;
              const { style, anim } = estiloBloque(b.props);
              return <Boton key={b.id} flotante bg={b.props?.bg} estilo={style} anim={anim}
                label={b.props?.label ? String(b.props.label) : undefined} variante={b.props?.variante} />;
            })}
          </div>
        </div>
      )}


      {/* Aviso "Nueva reseña agregada" (reseña gatillo) — editable desde el bloque de reseñas */}
      {resenaGatillo && (
        <ResenaGatillo
          nombre={resenaGatillo.nombre}
          foto={resenaGatillo.foto}
          texto={resenaGatilloProps?.avisoTexto}
          color={resenaGatilloProps?.avisoColor}
          colorTexto={resenaGatilloProps?.avisoColorTexto}
          posicion={resenaGatilloProps?.avisoPosicion}
          aparece={Number(resenaGatilloProps?.avisoAparece) || undefined}
          dura={Number(resenaGatilloProps?.avisoDura) || undefined}
        />
      )}

      {/* Aviso flotante "Ventas en vivo" (rota solo cada cierto tiempo) */}
      {bloqueVentas && <NotifVentas props={bloqueVentas.props} />}

      {/* Sello flotante "MÁS VENDIDO": baja al checkout y preselecciona el producto estrella */}
      {bloqueMasVendido && (
        <MasVendidoFlotante
          texto={bloqueMasVendido.props?.texto}
          emoji={bloqueMasVendido.props?.emoji}
          color={bloqueMasVendido.props?.color}
          colorTexto={bloqueMasVendido.props?.colorTexto}
          modelo={modeloMasVendido}
          posicion={bloqueMasVendido.props?.posicion}
          size={Number(bloqueMasVendido.props?.size) || undefined}
        />
      )}

      {/* Miniatura flotante (foto o video), solo si está configurada */}
      {f.miniatura_url && <MiniaturaFlotante url={f.miniatura_url} />}

      {/* Canción de fondo — solo si este embudo tiene una configurada */}
      {f.audio_url && <MusicaFondo url={f.audio_url} />}
    </main>
  );
}

/** Renderiza un bloque según su tipo. Devuelve null si ese bloque no aplica. */
function renderBloque(
  b: Bloque,
  f: Funnel,
  acento: { boton: string; texto: string },
  Boton: (props?: { compacto?: boolean; bg?: string; estilo?: Record<string, string | number>; anim?: string; label?: string; variante?: string; flotante?: boolean }) => ReactElement,
  utms: Record<string, string>,
  modeloMasVendido = '',
  hrefCompra = '#checkout',
): ReactNode {
  const p = b.props ?? {};
  switch (b.tipo) {
    case 'banner':
      if (p.modo === 'collage') {
        const fotos = (f.imagenes || []).filter(Boolean).slice(0, 4);
        return fotos.length ? (
          <div className="grid grid-cols-2 gap-0.5">
            {fotos.map((im, i) => <Medio key={i} url={im} alt={f.producto} className="w-full h-40 object-cover" />)}
          </div>
        ) : null;
      }
      {
        const src = (p.url as string) || f.imagen_clientes;
        return src
          ? (Number(p.h)
              ? <div style={{ height: Number(p.h) }} className="overflow-hidden"><Medio url={src} alt="Nuestros clientes" className="w-full h-full object-cover" /></div>
              : <Medio url={src} alt="Nuestros clientes" className="w-full" />)
          : null;
      }

    case 'titular': {
      const { style, anim } = estiloBloque(p);
      const contenido = <FrasesRotativas frases={f.frases.length > 0 ? f.frases : [f.titulo]} />;
      return (anim || Object.keys(style).length)
        ? <div className={anim} style={style}>{contenido}</div>
        : contenido;
    }

    case 'portada':
      if (p.modo === 'carrusel') {
        // Solo fotos que EXISTEN en la galería de este embudo (evita fotos viejas que
        // quedaron pegadas al duplicar). Si ninguna es válida, usa toda la galería.
        const galeria = (f.imagenes || []).filter(Boolean);
        const sel = (Array.isArray(p.fotos) ? p.fotos : []).filter((u: string) => galeria.includes(u));
        const elegidas = sel.length ? sel : galeria;
        if (elegidas.length) return <Galeria imagenes={elegidas} alt={f.producto} segundos={2} />;
      }
      if (p.modo === 'collage') {
        const fotos = (f.imagenes || []).filter(Boolean).slice(0, 4);
        if (fotos.length) return (
          <div className="grid grid-cols-2 gap-0.5">
            {fotos.map((im, i) => <Medio key={i} url={im} alt={f.producto} className="w-full h-48 object-cover" />)}
          </div>
        );
      }
      if (p.url) {
        return Number(p.h)
          ? <div style={{ height: Number(p.h) }} className="overflow-hidden"><Medio url={String(p.url)} alt={f.producto} className="w-full h-full object-cover" /></div>
          : <Medio url={String(p.url)} alt={f.producto} className="w-full" />;
      }
      return f.video_url
        ? <VideoPortada url={f.video_url} poster={f.imagenes[0]} />
        : <Galeria imagenes={f.imagenes} alt={f.producto} />;

    case 'boton': {
      const { style, anim } = estiloBloque(p);
      const escala = Number(p.escala) || 1;
      const baseF = p.compacto ? 16 : 20;
      const baseP = p.compacto ? 12 : 16;
      const estiloBtn = {
        paddingTop: Math.round(baseP * escala), paddingBottom: Math.round(baseP * escala),
        fontSize: (style.fontSize as any) ?? Math.round(baseF * escala),
        ...style,
      };
      return <Boton compacto={p.compacto === true} bg={p.bg} estilo={estiloBtn} anim={anim} label={p.label ? String(p.label) : undefined} variante={p.variante} />;
    }

    case 'precio': {
      const { style, anim } = estiloBloque(p);
      return (
        <div className={`text-center py-2 ${anim}`}>
          {f.precio_antes && (
            <p className="text-xl font-bold italic line-through" style={{ color: (p.colorAntes as string) || '#C1121F' }}>
              {p.labelAntes ?? 'Antes'} {pesos(f.precio_antes)}
            </p>
          )}
          <p className="text-[26px] font-extrabold leading-tight" style={style}>
            {p.labelHoy ?? 'HOY'} 🔥 <span style={{ color: (p.colorHoy as string) || (style.color as string) || acento.texto }}>{pesos(f.precio)}</span> 🔥
          </p>
        </div>
      );
    }

    case 'contador':
      return <Contador horas={f.horas_contador} />;

    case 'ultimas_unidades': {
      const fotosU = (f.imagenes || []).filter(Boolean).slice(0, 4);
      const srcDet = (p.url as string) || f.imagen_detalle;
      return (
        <>
          <div className="border-t border-[#E8E8E8] mx-3" />
          <p className="text-center font-extrabold text-2xl text-[#C1121F] py-4">
            ⚠️ ÚLTIMAS UNIDADES
          </p>
          {/* soloTexto: no repetir la foto de detalle (cuando ya se puso arriba) */}
          {!p.soloTexto && (p.modo === 'collage'
            ? (fotosU.length ? (
                <div className="grid grid-cols-2 gap-0.5">
                  {fotosU.map((im, i) => <Medio key={i} url={im} alt={f.producto} className="w-full h-40 object-cover" />)}
                </div>
              ) : null)
            : srcDet && (Number(p.h)
              ? <div style={{ height: Number(p.h) }} className="overflow-hidden"><Medio url={srcDet} alt={f.producto} className="w-full h-full object-cover" /></div>
              : <Medio url={srcDet} alt={f.producto} className="w-full" />))}
        </>
      );
    }

    case 'caracteristicas':
      return f.caracteristicas.length > 0 ? (
        <div className="px-4 py-4">
          <h2 className="font-extrabold mb-2" style={{ color: acento.texto }}>CARACTERÍSTICAS DEL PRODUCTO:</h2>
          <ul className="space-y-1.5">
            {f.caracteristicas.map((c, i) => (
              <li key={i} className="text-[15px] font-semibold">✅ {c}</li>
            ))}
          </ul>
        </div>
      ) : null;

    case 'estrellas': {
      const { style, anim } = estiloBloque(p);
      return <p className={`text-center text-2xl py-1 ${anim}`} style={style}>⭐⭐⭐⭐⭐</p>;
    }

    case 'testimonios': {
      const { anim } = estiloBloque(p);
      return <div className={anim}><Testimonios props={p} acento={acento.texto} href={hrefCompra} /></div>;
    }

    case 'gatillos': {
      const { anim } = estiloBloque(p);
      const q = new URLSearchParams(utms).toString();
      const hrefPedido = `/${f.slug}/pedido${q ? `?${q}` : ''}`;
      return <div className={anim}><Gatillos props={p} precio={f.precio} precioAntes={f.precio_antes} href={hrefPedido} acento={acento.texto} /></div>;
    }

    case 'stock': {
      const { anim } = estiloBloque(p);
      return <div className={anim}><Stock props={p} /></div>;
    }

    case 'texto': {
      const texto = String(p.texto ?? '').trim();
      if (!texto) return null;
      const { style, anim } = estiloBloque(p);
      return (
        <p
          className={`px-4 py-2 whitespace-pre-line ${anim}`}
          style={{ textAlign: 'center', fontSize: 16, fontWeight: p.bold !== false ? 800 : 400, color: '#0D0D0D', ...style }}
        >
          {texto}
        </p>
      );
    }

    case 'imagen': {
      if (p.modo === 'collage') {
        const fotos = (f.imagenes || []).filter(Boolean).slice(0, 4);
        return fotos.length ? (
          <div className="grid grid-cols-2 gap-0.5">
            {fotos.map((im, i) => <Medio key={i} url={im} alt={f.producto} className="w-full h-40 object-cover" />)}
          </div>
        ) : null;
      }
      return p.url
        ? (Number(p.h)
            ? <div style={{ height: Number(p.h) }} className="overflow-hidden"><Medio url={String(p.url)} alt={f.producto} className="w-full h-full object-cover" /></div>
            : <Medio url={String(p.url)} alt={f.producto} className="w-full" />)
        : null;
    }

    case 'espacio':
      return <div style={{ height: Number(p.alto) > 0 ? Number(p.alto) : 24 }} />;

    case 'checkout':
      return (
        <div id="checkout" className="pt-2 scroll-mt-2">
          {f.imagen_banner && <Medio url={f.imagen_banner} alt={f.producto} className="w-full" />}
          <FormularioPedido funnel={f} utms={utms} embebido />
        </div>
      );

    case 'checkout_pro':
      return (
        <div id="checkout" className="pt-2 scroll-mt-2">
          {f.imagen_banner && <Medio url={f.imagen_banner} alt={f.producto} className="w-full" />}
          <CheckoutPro funnel={f} utms={utms} embebido modeloMasVendido={modeloMasVendido} />
        </div>
      );

    default:
      return null;
  }
}

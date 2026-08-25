import { notFound } from 'next/navigation';
import type { ReactNode, ReactElement } from 'react';
import Link from 'next/link';
import { obtenerFunnel, pesos, acentoDe, type Funnel } from '@/lib/funnels';
import { bloquesARenderizar, type Bloque } from '@/lib/bloques';
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
  const bloques = bloquesARenderizar(f.layout);
  const utmsObj = Object.fromEntries(utms.entries()) as Record<string, string>;
  // Si la página trae el checkout embebido, el botón baja hasta él (una sola pantalla).
  const tieneCheckout = bloques.some(b => (b.tipo === 'checkout' || b.tipo === 'checkout_pro') && b.visible !== false);

  const Boton = () => tieneCheckout ? (
    <BotonBajarCheckout slug={slug} color={acento.boton} />
  ) : (
    <Link
      href={irAPedido}
      style={{ background: acento.boton }}
      className="boton-compra relative overflow-hidden block mx-3 my-4 rounded-full hover:opacity-90 text-white text-center font-extrabold text-xl leading-tight py-4 transition-opacity"
    >
      COMPRAR<br />
      <span className="text-lg">CONTRA ENTREGA →</span>
    </Link>
  );

  let spidermanPuesto = false; // el muñeco cuelga tras el primer botón

  return (
    <main className="min-h-screen bg-white max-w-lg mx-auto scroll-smooth">
      <Pixeles meta={f.pixel_meta} tiktok={f.pixel_tiktok} />
      <FunnelTracker slug={slug} />

      {/* Temática Spider-Man — SOLO en este embudo (por su slug). No afecta a los demás. */}
      {esSpiderman && <TemaSpiderman />}

      {bloques.map((b) => {
        if (b.visible === false) return null;
        const contenido = renderBloque(b, f, acento, Boton, utmsObj);
        if (contenido == null) return null;
        // El Spider-Man colgando va justo debajo del primer botón (solo ese embudo)
        const ponerSpiderman = esSpiderman && b.tipo === 'boton' && !spidermanPuesto;
        if (ponerSpiderman) spidermanPuesto = true;
        return (
          <div key={b.id}>
            {contenido}
            {ponerSpiderman && <SpidermanJala />}
          </div>
        );
      })}

      <footer className="text-center text-[11px] text-[#9A9A9A] py-6 px-4 pb-20">
        Klixmant SAS · Pago contra entrega en toda Colombia
      </footer>

      <PersonasComprando base={f.personas_comprando} />

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
  Boton: () => ReactElement,
  utms: Record<string, string>,
): ReactNode {
  const p = b.props ?? {};
  switch (b.tipo) {
    case 'banner':
      return f.imagen_clientes
        ? <Medio url={f.imagen_clientes} alt="Nuestros clientes" className="w-full" />
        : null;

    case 'titular':
      return <FrasesRotativas frases={f.frases.length > 0 ? f.frases : [f.titulo]} />;

    case 'portada':
      return f.video_url
        ? <VideoPortada url={f.video_url} poster={f.imagenes[0]} />
        : <Galeria imagenes={f.imagenes} alt={f.producto} />;

    case 'boton':
      return <Boton />;

    case 'precio':
      return (
        <div className="text-center py-2">
          {f.precio_antes && (
            <p className="text-[#C1121F] text-xl font-bold italic line-through">
              Antes {pesos(f.precio_antes)}
            </p>
          )}
          <p className="text-[26px] font-extrabold leading-tight">
            HOY 🔥 <span style={{ color: acento.texto }}>{pesos(f.precio)}</span> 🔥
          </p>
        </div>
      );

    case 'contador':
      return <Contador horas={f.horas_contador} />;

    case 'ultimas_unidades':
      return (
        <>
          <div className="border-t border-[#E8E8E8] mx-3" />
          <p className="text-center font-extrabold text-2xl text-[#C1121F] py-4">
            ⚠️ ÚLTIMAS UNIDADES
          </p>
          {f.imagen_detalle && (
            <Medio url={f.imagen_detalle} alt={f.producto} className="w-full" />
          )}
        </>
      );

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

    case 'estrellas':
      return <p className="text-center text-2xl py-1">⭐⭐⭐⭐⭐</p>;

    case 'texto': {
      const texto = String(p.texto ?? '').trim();
      if (!texto) return null;
      const align = p.align === 'left' ? 'left' : p.align === 'right' ? 'right' : 'center';
      const size = Number(p.size) > 0 ? Number(p.size) : 16;
      const bold = p.bold !== false;
      return (
        <p
          className="px-4 py-2 whitespace-pre-line"
          style={{ textAlign: align, fontSize: size, fontWeight: bold ? 800 : 400, color: p.color || '#0D0D0D' }}
        >
          {texto}
        </p>
      );
    }

    case 'imagen':
      return p.url
        ? <Medio url={String(p.url)} alt={f.producto} className="w-full" />
        : null;

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
          <CheckoutPro funnel={f} utms={utms} embebido />
        </div>
      );

    default:
      return null;
  }
}

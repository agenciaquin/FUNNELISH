import { notFound } from 'next/navigation';
import Link from 'next/link';
import { obtenerFunnel, pesos, acentoDe } from '@/lib/funnels';
import Galeria from '@/components/publico/Galeria';
import Contador from '@/components/publico/Contador';
import Pixeles from '@/components/publico/Pixeles';
import FrasesRotativas from '@/components/publico/FrasesRotativas';
import PersonasComprando from '@/components/publico/PersonasComprando';
import MusicaFondo from '@/components/publico/MusicaFondo';
import VideoPortada from '@/components/publico/VideoPortada';
import Medio from '@/components/publico/Medio';
import Bloques from '@/components/publico/Bloques';
import MiniaturaFlotante from '@/components/publico/MiniaturaFlotante';
import FunnelTracker from '@/components/publico/FunnelTracker';
import LayoutRender from '@/components/publico/LayoutRender';

// Se arma en cada visita: necesita leer los UTM de la campaña que trajo al cliente
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await obtenerFunnel(slug);
  return {
    title: f?.producto ?? 'Tienda',
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

  // Los UTM viajan a la página de pedido para no perder de qué campaña vino
  const utms = new URLSearchParams();
  const utmsObj: Record<string, string> = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ttclid', 'fbclid']) {
    const v = query[k];
    if (typeof v === 'string' && v) { utms.set(k, v); utmsObj[k] = v; }
  }
  // Enlace corto: /nacional/pedido en vez de /p/nacional/pedido
  const irAPedido = `/${slug}/pedido${utms.toString() ? `?${utms}` : ''}`;

  // Color de acento: morado, verde, lo que tenga este embudo
  const acento = acentoDe(f.color);

  // Editor "todo es un bloque": si este embudo publica la versión de bloques,
  // la página se dibuja desde esa lista. El dueño elige cuál se muestra con
  // "Elegir este embudo" (modo_publicado). Respaldo: si nunca eligió, se usa el
  // layout cuando existe (comportamiento anterior), si no la versión clásica.
  const layout = (f as any).layout;
  const modo = (f as any).modo_publicado; // 'cero' | 'plantilla' | null
  const usarLayout = Array.isArray(layout) && layout.length > 0 && modo !== 'plantilla';
  if (usarLayout) {
    return (
      <main className="min-h-screen bg-white max-w-lg mx-auto">
        <Pixeles meta={f.pixel_meta} tiktok={f.pixel_tiktok} evento="ViewContent"
          datos={{ contentId: f.slug, producto: f.producto, valor: f.precio }} />
        <FunnelTracker slug={slug} paso="landing" />
        <LayoutRender f={f} layout={layout} irAPedido={irAPedido} utms={utmsObj} />
      </main>
    );
  }

  const Boton = () => (
    <Link
      href={irAPedido}
      style={{ background: acento.boton }}
      className="boton-compra relative overflow-hidden block mx-3 my-4 rounded-full hover:opacity-90 text-white text-center font-extrabold text-xl leading-tight py-4 transition-opacity"
    >
      COMPRAR<br />
      <span className="text-lg">CONTRA ENTREGA →</span>
    </Link>
  );

  return (
    <main className="min-h-screen bg-white max-w-lg mx-auto">
      <Pixeles meta={f.pixel_meta} tiktok={f.pixel_tiktok} evento="ViewContent"
        datos={{ contentId: f.slug, producto: f.producto, valor: f.precio }} />
      <FunnelTracker slug={slug} paso="landing" />

      {/* Banner de clientes (foto o video) */}
      {f.imagen_clientes && (
        <Medio url={f.imagen_clientes} alt="Nuestros clientes" className="w-full" />
      )}

      {/* Titular — rota entre varias frases si están configuradas */}
      <FrasesRotativas frases={f.frases.length > 0 ? f.frases : [f.titulo]} />
      <Bloques bloques={f.bloques} acento={acento} irAPedido={irAPedido} soloAncla="titular" />

      {/* Portada: video con sonido si lo cargaste, si no la galería de fotos */}
      {f.video_url
        ? <VideoPortada url={f.video_url} poster={f.imagenes[0]} />
        : <Galeria imagenes={f.imagenes} alt={f.producto} />}
      <Bloques bloques={f.bloques} acento={acento} irAPedido={irAPedido} soloAncla="portada" />
      <Boton />
      <Bloques bloques={f.bloques} acento={acento} irAPedido={irAPedido} soloAncla="comprar" />

      {/* Precio */}
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
      <Bloques bloques={f.bloques} acento={acento} irAPedido={irAPedido} soloAncla="precio" />

      <Contador horas={f.horas_contador} />

      <div className="border-t border-[#E8E8E8] mx-3" />

      {/* Últimas unidades + foto de detalle */}
      <p className="text-center font-extrabold text-2xl text-[#C1121F] py-4">
        ⚠️ ÚLTIMAS UNIDADES
      </p>
      {f.imagen_detalle && (
        <Medio url={f.imagen_detalle} alt={f.producto} className="w-full" />
      )}

      {/* Características */}
      {f.caracteristicas.length > 0 && (
        <div className="px-4 py-4">
          <h2 className="font-extrabold mb-2" style={{ color: acento.texto }}>CARACTERÍSTICAS DEL PRODUCTO:</h2>
          <ul className="space-y-1.5">
            {f.caracteristicas.map((c, i) => (
              <li key={i} className="text-[15px] font-semibold">✅ {c}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-2xl py-1">⭐⭐⭐⭐⭐</p>

      {/* Segundo botón COMPRAR — se puede ocultar por embudo desde el editor */}
      {!f.ocultar_boton2 && <Boton />}

      <footer className="text-center text-[11px] text-[#9A9A9A] py-6 px-4 pb-20">
        {f.pie_empresa?.trim()
          ? `${f.pie_empresa.trim()} · Pago contra entrega en toda Colombia`
          : 'Pago contra entrega en toda Colombia'}
      </footer>

      <PersonasComprando base={f.personas_comprando} />

      {/* Miniatura flotante (foto o video), solo si está configurada */}
      {f.miniatura_url && <MiniaturaFlotante url={f.miniatura_url} />}

      {/* Canción de fondo — solo si este embudo tiene una configurada */}
      {f.audio_url && <MusicaFondo url={f.audio_url} />}
    </main>
  );
}

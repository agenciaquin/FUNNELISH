import { notFound } from 'next/navigation';
import { obtenerFunnel } from '@/lib/funnels';
import FormularioPedido from '@/components/publico/FormularioPedido';
import { registrarPasoServidor } from '@/lib/funnel-track';
import Pixeles from '@/components/publico/Pixeles';
import PersonasComprando from '@/components/publico/PersonasComprando';
import Medio from '@/components/publico/Medio';

// Igual que la página de venta: necesita los UTM que vienen en la dirección
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await obtenerFunnel(slug);
  return { title: `Pedido — ${f?.producto ?? 'Klixmant'}` };
}

export default async function PaginaPedido({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const f = await obtenerFunnel(slug);
  if (!f) notFound();

  // Paso 'pedido' (abrió el formulario) — registrado desde el servidor.
  await registrarPasoServidor(slug, 'pedido');

  const utms: Record<string, string> = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ttclid', 'fbclid']) {
    const v = query[k];
    if (typeof v === 'string' && v) utms[k] = v;
  }

  return (
    <main className="min-h-screen bg-white max-w-lg mx-auto">
      <Pixeles
        meta={f.pixel_meta}
        tiktok={f.pixel_tiktok}
        evento="InitiateCheckout"
        datos={{ valor: f.precio, producto: f.producto }}
      />

      {f.imagen_banner && (
        <Medio url={f.imagen_banner} alt={f.producto} className="w-full" />
      )}

      <FormularioPedido funnel={f} utms={utms} />

      <PersonasComprando base={f.personas_comprando} />
    </main>
  );
}

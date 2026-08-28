import { notFound } from 'next/navigation';
import { obtenerFunnel } from '@/lib/funnels';
import FormularioPedido from '@/components/publico/FormularioPedido';
import Pixeles from '@/components/publico/Pixeles';
import PersonasComprando from '@/components/publico/PersonasComprando';
import Medio from '@/components/publico/Medio';
import FunnelTracker from '@/components/publico/FunnelTracker';

// Igual que la página de venta: necesita los UTM que vienen en la dirección
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await obtenerFunnel(slug);
  return { title: `Pedido — ${f?.producto ?? 'Tienda'}` };
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

  const utms: Record<string, string> = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ttclid', 'fbclid']) {
    const v = query[k];
    if (typeof v === 'string' && v) utms[k] = v;
  }

  const bloqueCheckout = (Array.isArray((f as any).layout) ? (f as any).layout : [])
    .find((b: any) => b?.tipo === 'checkout' || b?.tipo === 'checkout_pro') ?? null;

  return (
    <main className="min-h-screen bg-white max-w-lg mx-auto">
      <Pixeles
        meta={f.pixel_meta}
        tiktok={f.pixel_tiktok}
        evento="InitiateCheckout"
        datos={{ valor: f.precio, producto: f.producto, contentId: f.slug }}
      />
      <FunnelTracker slug={slug} paso="pedido" />

      {f.imagen_banner && (
        <Medio url={f.imagen_banner} alt={f.producto} className="w-full" />
      )}

      {/* La configuración del checkout vive en su bloque dentro del layout: una
          sola fuente de verdad para la página y para esta dirección aparte. */}
      <FormularioPedido funnel={f} utms={utms} config={bloqueCheckout?.props as any} />

      <PersonasComprando base={f.personas_comprando} />
    </main>
  );
}

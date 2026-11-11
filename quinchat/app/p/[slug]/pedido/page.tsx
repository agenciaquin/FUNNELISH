import { notFound } from 'next/navigation';
import { obtenerFunnel } from '@/lib/funnels';
import FormularioPedido from '@/components/publico/FormularioPedido';
import { registrarPasoServidor } from '@/lib/funnel-track';
import Pixeles from '@/components/publico/Pixeles';
import PersonasComprando from '@/components/publico/PersonasComprando';
import Medio from '@/components/publico/Medio';
import { createServerSupabaseClient } from '@/lib/supabase';
import { validarDescuento, funnelConDescuento } from '@/lib/descuento-tienda';
import { pesos } from '@/lib/funnels';

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
  const f0 = await obtenerFunnel(slug);
  if (!f0) notFound();
  // Descuento del cliente: SOLO con su código válido (?d=…). Sin código, precio normal.
  const codigoD = typeof query.d === 'string' ? query.d : typeof query.descuento === 'string' ? query.descuento : '';
  const desc = codigoD ? await validarDescuento(createServerSupabaseClient(), codigoD) : null;
  const f = desc ? funnelConDescuento(f0, desc.monto) : f0;

  // Paso 'pedido' (abrió el formulario) — registrado desde el servidor.
  await registrarPasoServidor(slug, 'pedido');

  const utms: Record<string, string> = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ttclid', 'fbclid']) {
    const v = query[k];
    if (typeof v === 'string' && v) utms[k] = v;
  }
  if (desc) { utms.descuento = desc.codigo; utms.descuento_monto = String(desc.monto); }

  return (
    <main className="min-h-screen bg-white max-w-lg mx-auto">
      <Pixeles
        meta={f.pixel_meta}
        tiktok={f.pixel_tiktok}
        evento="InitiateCheckout"
        datos={{ valor: f.precio, producto: f.producto, contentId: f.slug }}
      />

      {f.imagen_banner && (
        <Medio url={f.imagen_banner} alt={f.producto} className="w-full" />
      )}

      {desc && (
        <div className="text-white text-center px-3 py-2 text-[13px] font-bold" style={{ background: '#C62828' }}>
          🎁 Tu descuento de {pesos(desc.monto)} ya está aplicado en el precio
        </div>
      )}
      <FormularioPedido funnel={f} utms={utms} />

      <PersonasComprando base={f.personas_comprando} />
    </main>
  );
}

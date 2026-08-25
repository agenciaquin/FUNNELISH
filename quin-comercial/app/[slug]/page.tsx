import { redirect } from 'next/navigation';

/**
 * En la tienda (pedido.klixmant.shop) esta ruta no llega a usarse: el middleware
 * ya reescribe /nacional hacia la página de venta manteniendo la dirección corta.
 * Queda como respaldo por si alguien entra por el dominio del panel.
 */
export const dynamic = 'force-dynamic';

export default async function RutaCorta({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/p/${slug}`);
}

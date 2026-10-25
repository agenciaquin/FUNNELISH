import { notFound } from 'next/navigation';
import { buscarLive } from '@/lib/live/datos-demo';
import { buscarLiveDB } from '@/lib/live/datos-supabase';
import { obtenerFunnel, type Funnel } from '@/lib/funnels';
import LiveShell from '@/components/live/LiveShell';

export const dynamic = 'force-dynamic';

// Ruta PÚBLICA (sin login) a la que llega la gente desde los anuncios de Meta y TikTok.
// Primero busca el live en la base (editor); si no existe ahí, cae a la maqueta.
export default async function LivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let live = await buscarLiveDB(slug).catch(() => null);
  if (!live) live = buscarLive(slug) ?? null;
  if (!live) notFound();

  // Si el live tiene un embudo asociado, se usa SU checkout (tal cual el embudo).
  let funnel: Funnel | null = null;
  if (live.embudoSlug) funnel = await obtenerFunnel(live.embudoSlug).catch(() => null);

  return <LiveShell live={live} funnel={funnel} />;
}

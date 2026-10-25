import { notFound } from 'next/navigation';
import { buscarLive } from '@/lib/live/datos-demo';
import LiveShell from '@/components/live/LiveShell';

// Ruta PÚBLICA (sin login) a la que llega la gente desde los anuncios de Meta y TikTok.
export default async function LivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const live = buscarLive(slug);
  if (!live) notFound();
  return <LiveShell live={live} />;
}

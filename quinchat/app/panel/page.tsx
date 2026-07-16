import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WhatsAppPanel from '@/components/panel/WhatsAppPanel';

export const metadata: Metadata = {
  title: 'Panel · QUINCHAT',
  description: 'Panel de WhatsApp KLIXMANT',
};

export default async function PanelPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <WhatsAppPanel
      userName={session.user?.name ?? ''}
    />
  );
}

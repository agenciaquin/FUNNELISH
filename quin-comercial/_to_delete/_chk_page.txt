import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WhatsAppPanel from '@/components/panel/WhatsAppPanel';
import { mintSupabaseToken } from '@/lib/supabase-token';

export const metadata: Metadata = {
  title: 'Panel · QUINCHAT',
  description: 'Panel de WhatsApp',
};

export default async function PanelPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  // Token de la empresa para el cliente del navegador (aísla lecturas, escrituras
  // y tiempo real por tenant vía RLS). Null si falta SUPABASE_JWT_SECRET.
  const sbToken = mintSupabaseToken((session as any).tenantId);

  return (
    <WhatsAppPanel
      userName={session.user?.name ?? ''}
      sbToken={sbToken}
      rol={(session as any).rol ?? ''}
    />
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ChatWindow from '@/components/quinchat/ChatWindow';
import LogoutButton from '@/components/LogoutButton';

export const metadata: Metadata = {
  title: 'Chat · QUINCHAT',
  description: 'Asistente de ventas KLIXMANT',
};

export default async function QuinchatPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0A]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1A1A] bg-[#080808]">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-gray-600 hover:text-brand-gold transition-colors text-sm"
            aria-label="Volver al inicio"
          >
            ←
          </Link>
          <span className="text-brand-gold font-black text-sm tracking-wider">
            QUIN<span className="text-white">CHAT</span>
          </span>
        </div>

        {/* Usuario + logout */}
        <div className="flex items-center gap-3">
          {session?.user?.name && (
            <span className="text-xs text-gray-500">
              👤 {session.user.name}
            </span>
          )}
          <LogoutButton />
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 min-h-0">
        <ChatWindow />
      </div>
    </div>
  );
}

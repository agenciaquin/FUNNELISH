import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import SessionProvider from '@/components/SessionProvider';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'QuinChat — Agencia Quin',
  description: 'Asistente de ventas automatizado — Agencia Quin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${montserrat.className} bg-[#FAF9F6] text-[#0D0D0D] antialiased`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

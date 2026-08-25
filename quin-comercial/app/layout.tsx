import type { Metadata, Viewport } from 'next';
import SessionProvider from '@/components/SessionProvider';
import PWARegister from '@/components/PWARegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'QuinChat — Agencia Quin',
  description: 'Asistente de ventas automatizado — Agencia Quin',
  manifest: '/manifest.json',
  applicationName: 'QuinChat',
  appleWebApp: {
    capable: true,
    title: 'QuinChat',
    statusBarStyle: 'black-translucent',
  },
  // El ?v= obliga a Chrome y Windows a bajar el ícono nuevo en vez del guardado
  icons: {
    icon: [
      { url: '/icon-192.png?v=3', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png?v=3', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png?v=3',
  },
};

export const viewport: Viewport = {
  themeColor: '#00847A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{ fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}
        className="bg-[#FAF9F6] text-[#0D0D0D] antialiased"
      >
        <PWARegister />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

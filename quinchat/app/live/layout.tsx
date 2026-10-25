import type { Metadata, Viewport } from 'next';

/**
 * QUIN LIVE SHOPPING — público, sin login ni identidad PWA de QuinChat.
 * (Mismo criterio que app/p/layout.tsx.)
 */
export const metadata: Metadata = {
  title: 'Presentación grabada · KLIXMANT',
  manifest: null,
  applicationName: null,
  appleWebApp: null,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-black text-white min-h-[100dvh]">{children}</div>;
}

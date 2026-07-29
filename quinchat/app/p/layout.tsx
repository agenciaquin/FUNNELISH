import type { Metadata } from 'next';

/**
 * Las páginas de venta heredan el diseño general, pero NO la identidad de la
 * aplicación del equipo. Sin manifiesto, el navegador deja de ofrecerle al
 * cliente "instalar / descargar QuinChat" cuando abre el enlace del producto.
 */
export const metadata: Metadata = {
  manifest: null,
  applicationName: null,
  appleWebApp: null,
};

export default function LayoutTienda({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

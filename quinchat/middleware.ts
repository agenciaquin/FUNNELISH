import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from 'next-auth/middleware';

/**
 * Dos sitios en un mismo proyecto:
 *
 *  · pedido.klixmant.shop  → tienda pública. Sin login, para que los clientes
 *    puedan comprar. Las direcciones cortas (/nacional) llevan a la página de
 *    venta correspondiente.
 *
 *  · el resto (el panel)   → protegido con inicio de sesión.
 */

const DOMINIOS_TIENDA = ['pedido.'];

const proteger = withAuth({ pages: { signIn: '/login' } });

export default function middleware(req: NextRequest, event: any) {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const esTienda = DOMINIOS_TIENDA.some(d => host.startsWith(d));
  const { pathname } = req.nextUrl;

  if (esTienda) {
    // La raíz de la tienda no muestra el panel: lleva al primer embudo activo
    if (pathname === '/' || pathname === '/panel') {
      return NextResponse.redirect(new URL('/tienda', req.url));
    }

    // Direcciones cortas: /nacional muestra la página de venta sin que el
    // cliente vea el /p/ en la barra del navegador.
    const interno = pathname.startsWith('/p/')
      || pathname.startsWith('/api/')
      || pathname.startsWith('/_next')
      || pathname === '/tienda'
      || pathname.includes('.');           // archivos: imágenes, iconos, etc.

    if (!interno) {
      const url = req.nextUrl.clone();
      url.pathname = `/p${pathname}`;
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

  // Rutas públicas del panel (webhooks, páginas de venta, archivos de la app)
  const publicas = [
    '/login', '/api/auth', '/api/whatsapp/webhook', '/api/whatsapp/confirmar',
    '/api/funnelish/webhook', '/api/cron/remarketing', '/api/cron/ventas-seguimiento', '/api/cron/mantener-chat', '/api/cron/vendedores', '/api/cron/objeciones', '/api/cron/apagar-vendidos', '/api/cron/seguimiento-ia', '/api/cron/meta-alertas', '/api/cron/capi', '/api/cron/registros-funnel', '/api/cron/promo-cierre', '/api/pedidos',
    '/p/', '/manifest.json', '/sw.js', '/icon-', '/apple-touch-icon',
    '/logo-agencia-quin', '/logo-quin-app', '/_next/', '/favicon.ico',
  ];
  if (publicas.some(p => pathname.startsWith(p))) return NextResponse.next();

  return (proteger as any)(req, event);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};

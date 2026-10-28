import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from 'next-auth/middleware';
import { ESCRITURA_LOCAL_ABIERTA, esHostLocal } from '@/lib/freno-local';

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

  // Freno local: se corta antes de ejecutar la ruta (incluye envíos a WhatsApp y Meta).
  // /api/auth queda fuera para poder iniciar sesión; no escribe en la base.
  if (esHostLocal(host) && !ESCRITURA_LOCAL_ABIERTA
      && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !pathname.startsWith('/api/auth')) {
    return NextResponse.json(
      { error: 'Local protegido: esta acción no se guarda en la base real.' },
      { status: 423 },
    );
  }

  // En la tienda, /api/* NO pasa libre: cae en la misma lista pública que el panel (C2).
  if (esTienda && !pathname.startsWith('/api/')) {
    // La raíz de la tienda no muestra el panel: lleva al primer embudo activo
    if (pathname === '/' || pathname === '/panel') {
      return NextResponse.redirect(new URL('/tienda', req.url));
    }

    // Direcciones cortas: /nacional muestra la página de venta sin que el
    // cliente vea el /p/ en la barra del navegador.
    const interno = pathname.startsWith('/p/')
      || pathname.startsWith('/live/')      // QUIN LIVE SHOPPING (público)
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
    '/api/funnelish/webhook', '/api/cron/remarketing', '/api/cron/ventas-seguimiento', '/api/cron/mantener-chat', '/api/cron/vendedores', '/api/cron/objeciones', '/api/cron/apagar-vendidos', '/api/cron/seguimiento-ia', '/api/cron/meta-alertas', '/api/cron/capi', '/api/cron/registros-funnel', '/api/cron/promo-cierre', '/api/cron/supervisor',
    '/api/live/',   // QUIN LIVE SHOPPING público (timeline, pedido, evento, pregunta). El editor va en /api/live-admin (protegido).
    '/p/', '/live/', '/live-demo/', '/manifest.json', '/sw.js', '/icon-', '/apple-touch-icon',
    '/logo-agencia-quin', '/logo-quin-app', '/_next/', '/favicon.ico',
  ];
  // Lo que la tienda llama desde el navegador. Comparación EXACTA: con startsWith,
  // '/api/pedidos' abría también /lista, /detalle y /accion (C1).
  const exactas = [
    '/api/pedidos', '/api/funnels/carrito', '/api/funnels/evento',
    '/api/promociones/vender', '/api/promociones/pedido', '/api/promociones/pedido-multi',
  ];
  if (exactas.includes(pathname) || publicas.some(p => pathname.startsWith(p))) return NextResponse.next();

  return (proteger as any)(req, event);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};

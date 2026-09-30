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

const proteger = withAuth({ pages: { signIn: '/login' } });

/**
 * Rutas de la API que se pueden llamar SIN sesión. Todo lo demás de /api/ pide
 * iniciar sesión, en la tienda y en el panel. Antes la tienda (cualquier dominio
 * que no fuera *.vercel.app) dejaba pasar la API entera.
 *
 *  · exactas: las que llama la página de venta y el alta de empresas.
 *    `/api/pedidos` NO abre `/api/pedidos/lista`, que devuelve datos de clientes.
 *  · prefijos: webhooks y crons. Se protegen solos (firma, consulta a Mercado
 *    Pago o `CRON_SECRET`).
 */
const API_PUBLICA_EXACTA = ['/api/pedidos', '/api/funnels/evento', '/api/funnels/carrito', '/api/registro'];
const API_PUBLICA_PREFIJO = [
  '/api/auth/', '/api/whatsapp/webhook', '/api/whatsapp/confirmar',
  '/api/funnelish/webhook', '/api/recargas/webhook', '/api/cron/',
];

function esApiPublica(pathname: string): boolean {
  const ruta = pathname.replace(/\/+$/, '');
  return API_PUBLICA_EXACTA.includes(ruta)
    || API_PUBLICA_PREFIJO.some(p => ruta === p.replace(/\/$/, '') || ruta.startsWith(p.endsWith('/') ? p : `${p}/`));
}

export default function middleware(req: NextRequest, event: any) {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  // El PANEL vive en el dominio de la app (…vercel.app) o en localhost. CUALQUIER
  // otro dominio (pedido.klixmant.shop, o el dominio propio del cliente como
  // www.mitienda.com) es una TIENDA: sirve los embudos con direcciones cortas.
  const esPanel = host.endsWith('.vercel.app') || host.startsWith('localhost') || host.startsWith('127.0.0.1') || host === '';
  const esTienda = !esPanel;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (esApiPublica(pathname)) return NextResponse.next();
    return (proteger as any)(req, event);
  }

  if (esTienda) {
    // La raíz de la tienda no muestra el panel: lleva al primer embudo activo
    if (pathname === '/' || pathname === '/panel') {
      return NextResponse.redirect(new URL('/tienda', req.url));
    }

    // Direcciones cortas: /nacional muestra la página de venta sin que el
    // cliente vea el /p/ en la barra del navegador.
    const interno = pathname.startsWith('/p/')
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
    '/login', '/registro', '/p/', '/manifest.json', '/sw.js', '/icon-', '/apple-touch-icon',
    '/logo-agencia-quin', '/logo-quin-app', '/_next/', '/favicon.ico',
  ];
  if (publicas.some(p => pathname.startsWith(p))) return NextResponse.next();

  return (proteger as any)(req, event);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};

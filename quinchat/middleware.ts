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

/**
 * Rutas de la API que se pueden llamar SIN sesión. Todo lo demás de /api/ pide
 * iniciar sesión, en la tienda y en el panel. Antes la tienda dejaba pasar la
 * API entera, y cualquiera podía mandar plantillas de WhatsApp de pago o usar la
 * IA sin entrar.
 *
 *  · exactas: las que llama la página de venta, y SOLO con el método que usa
 *    (la página solo hace POST). `/api/funnels/carrito` también tiene GET, PATCH
 *    y DELETE para el panel, con nombres y teléfonos: esos piden sesión.
 *    `/api/pedidos` NO abre `/api/pedidos/lista`, que devuelve datos de clientes.
 *    Las tres de promociones son las que llama la página pública /promos
 *    (comprar uno, comprar el carrito y "marcar vendido" con el link del
 *    vendedor). El resto de promociones (`/api/promociones` para crear y borrar,
 *    `/api/vendedores-promo` con los tokens) es del panel y pide sesión.
 *  · prefijos: webhooks y crons. Se protegen solos (firma o `CRON_SECRET`).
 */
const API_PUBLICA_EXACTA: Record<string, string[]> = {
  '/api/pedidos': ['POST'],
  '/api/funnels/evento': ['POST'],
  '/api/funnels/carrito': ['POST'],
  '/api/promociones/pedido': ['POST'],
  '/api/promociones/pedido-multi': ['POST'],
  '/api/promociones/vender': ['POST'],
};
const API_PUBLICA_PREFIJO = [
  '/api/auth/', '/api/whatsapp/webhook', '/api/whatsapp/confirmar',
  '/api/funnelish/webhook', '/api/cron/',
];

function esApiPublica(pathname: string, metodo: string): boolean {
  const ruta = pathname.replace(/\/+$/, '');
  return (API_PUBLICA_EXACTA[ruta]?.includes(metodo.toUpperCase()) ?? false)
    || API_PUBLICA_PREFIJO.some(p => ruta === p.replace(/\/$/, '') || ruta.startsWith(p.endsWith('/') ? p : `${p}/`));
}

export default function middleware(req: NextRequest, event: any) {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const esTienda = DOMINIOS_TIENDA.some(d => host.startsWith(d));
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (esApiPublica(pathname, req.method)) return NextResponse.next();
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
    '/login', '/p/', '/manifest.json', '/sw.js', '/icon-', '/apple-touch-icon',
    '/logo-agencia-quin', '/logo-quin-app', '/_next/', '/favicon.ico',
  ];
  if (publicas.some(p => pathname.startsWith(p))) return NextResponse.next();

  return (proteger as any)(req, event);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};

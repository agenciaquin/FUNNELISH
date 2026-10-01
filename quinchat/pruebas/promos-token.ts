/**
 * Fallo 12 del tablero: la página pública /promos NO manda al navegador el token
 * del vendedor `__principal__`, y "marcar vendido" del principal solo funciona
 * con su cookie httpOnly (lib/promo-principal.ts).
 *   npx tsx pruebas/promos-token.ts
 *
 * Qué se mira:
 *  · Las páginas REALES (`app/p/promos/page.tsx` y `[id]/page.tsx`) se llaman como
 *    funciones y se recorren las props que pasan a los componentes de cliente
 *    (PromosLista, PromoProducto). Esas props son lo que Next serializa al
 *    navegador: si el token no está ahí, no sale.
 *  · La ruta REAL `/api/promociones/vender`: el principal con el token en el
 *    cuerpo y sin cookie → 403; con la cookie → descuenta. El vendedor con su
 *    token sigue igual.
 *
 * Supabase = PostgREST falso local (no toca ninguna base). `next/headers` se
 * sustituye por uno que devuelve las cookies que fija la prueba.
 */
import { arrancarPostgrest } from './_postgrest-falso';
import { instalarNextHeaders } from './_sesion-falsa';

let fallos = 0, total = 0;
function caso(nombre: string, ok: boolean, extra = '') {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}${!ok && extra ? `  -> ${extra}` : ''}`);
}

const PRINCIPAL = 'tokenprincipal';
const ANA = 'tokenana';

/** Busca en el árbol devuelto por la página el elemento cuyo `type` es `comp`. */
function buscar(nodo: any, comp: any): any {
  if (!nodo || typeof nodo !== 'object') return null;
  if (Array.isArray(nodo)) {
    for (const n of nodo) { const r = buscar(n, comp); if (r) return r; }
    return null;
  }
  if (nodo.type === comp) return nodo;
  return buscar(nodo.props?.children, comp);
}

(async () => {
  const promo = () => ({
    id: 'p1', nombre: 'Camiseta', activo: true, orden: 0, creado_at: '2026-09-01T00:00:00Z',
    precio: 50000, tallas: ['M'], stock: { M: 5 }, colores: [], variantes: {},
  });
  const db = await arrancarPostgrest({
    promociones: [promo()],
    vendedores_promo: [
      { id: 'v0', nombre: 'Principal', celular: '3167648391', codigo: '__principal__', token: PRINCIPAL, activo: true },
      { id: 'v1', nombre: 'Ana', celular: '3001112233', codigo: 'ana', token: ANA, activo: true },
    ],
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
  instalarNextHeaders();

  // Cookies que verá `cookies()` de next/headers en las páginas.
  let cookiesPagina: { name: string; value: string }[] = [];
  const nh: any = require.cache[require.resolve('next/headers')]!.exports;
  nh.cookies = async () => ({ getAll: () => cookiesPagina, get: (n: string) => cookiesPagina.find(c => c.name === n) });

  const Catalogo = (await import('../app/p/promos/page')).default;
  const Ficha = (await import('../app/p/promos/[id]/page')).default;
  const PromosLista = (await import('../components/publico/PromosLista')).default;
  const PromoProducto = (await import('../components/publico/PromoProducto')).default;
  const vender = await import('../app/api/promociones/vender/route');
  const { COOKIE_PROMO_PRINCIPAL } = await import('../lib/promo-principal');
  const { NextRequest } = await import('next/server');

  try {
    // ── Catálogo /promos ─────────────────────────────────────────────────────
    {
      const arbol = await Catalogo({ searchParams: Promise.resolve({}) });
      const lista = buscar(arbol, PromosLista);
      caso('catálogo: pinta PromosLista', !!lista);
      const props = JSON.stringify(lista?.props ?? {});
      caso('catálogo sin ?v=: no manda el token del principal', !props.includes(PRINCIPAL), props.slice(0, 200));
      caso('catálogo sin ?v=: no manda ningún token', !props.includes(ANA) && !('adminToken' in (lista?.props ?? {})));
    }
    {
      const arbol = await Catalogo({ searchParams: Promise.resolve({ v: 'ana' }) });
      const props = JSON.stringify(buscar(arbol, PromosLista)?.props ?? {});
      caso('catálogo ?v=ana: no manda el token del principal', !props.includes(PRINCIPAL));
      caso('catálogo ?v=ana: el link de vendedor sigue llevando SU token', props.includes(ANA));
    }
    // ?v=__principal__: el principal NO es un vendedor (auditoría de integracion,
    // fallo 1). La fila de la prueba está activa y con celular, el peor caso. Se
    // mira el árbol ENTERO, no solo las props de PromosLista.
    const todo = (a: any) => JSON.stringify(a, (_k, v) => (typeof v === 'function' ? undefined : v));
    for (const v of ['__principal__', ' __principal__ ']) {
      const arbol = await Catalogo({ searchParams: Promise.resolve({ v }) });
      const lista = buscar(arbol, PromosLista)?.props ?? {};
      caso(`catálogo ?v=${JSON.stringify(v)}: el token del principal no sale`, !todo(arbol).includes(PRINCIPAL));
      caso(`catálogo ?v=${JSON.stringify(v)}: no entra en modo vendedor`, !lista.sellerCodigo && !lista.sellerWa && !lista.sellerToken);
    }

    // ── Ficha /promos/[id] ───────────────────────────────────────────────────
    const ficha = async (sp: Record<string, string>, cookie?: string) => {
      cookiesPagina = cookie ? [{ name: COOKIE_PROMO_PRINCIPAL, value: cookie }] : [];
      const arbol = await Ficha({ params: Promise.resolve({ id: 'p1' }), searchParams: Promise.resolve(sp) });
      return buscar(arbol, PromoProducto)?.props ?? {};
    };
    {
      const p = await ficha({});
      caso('ficha sin cookie: sin botón "marcar vendido"', p.canSell === false && !JSON.stringify(p).includes(PRINCIPAL));
    }
    {
      const p = await ficha({ k: PRINCIPAL });
      caso('ficha con ?k=<principal> en la URL (sin cookie): sin botón', p.canSell === false && !JSON.stringify(p).includes(PRINCIPAL));
    }
    {
      const p = await ficha({}, 'otro-token');
      caso('ficha con cookie equivocada: sin botón', p.canSell === false);
    }
    {
      const p = await ficha({}, PRINCIPAL);
      caso('ficha con la cookie del principal: con botón', p.canSell === true && p.ventaCodigo === '__principal__');
      caso('ficha con la cookie del principal: el token no va a la página', !JSON.stringify(p).includes(PRINCIPAL) && !p.ventaToken);
    }
    {
      const p = await ficha({ v: 'ana', k: ANA });
      caso('ficha de vendedor con su token: con botón (igual que antes)', p.canSell === true && p.ventaCodigo === 'ana');
    }
    {
      const p = await ficha({ v: '__principal__' });
      caso('ficha ?v=__principal__: ni modo vendedor ni token', !p.sellerCodigo && !p.sellerWa && p.canSell === false && !JSON.stringify(p).includes(PRINCIPAL));
    }
    {
      const p = await ficha({ v: '__principal__', k: PRINCIPAL });
      caso('ficha ?v=__principal__&k=<principal> sin cookie: sin botón', p.canSell === false && !JSON.stringify(p).includes(PRINCIPAL));
    }
    {
      const p = await ficha({ v: 'ana', k: PRINCIPAL }, PRINCIPAL);
      caso('ficha de vendedor con token ajeno: sin botón', p.canSell === false);
    }

    // ── /api/promociones/vender ──────────────────────────────────────────────
    const llamar = (cuerpo: any, cookie?: string) => vender.POST(new NextRequest('http://localhost:3000/api/promociones/vender', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie: `${COOKIE_PROMO_PRINCIPAL}=${cookie}` } : {}) },
      body: JSON.stringify(cuerpo),
    }));
    const stockM = () => db.tablas.promociones[0].stock.M;
    const base = { promoId: 'p1', color: '', talla: 'M' };
    {
      const antes = stockM();
      const r = await llamar({ ...base, codigo: '__principal__', token: PRINCIPAL });
      caso('vender principal con el token en el cuerpo y sin cookie -> 403', r.status === 403 && stockM() === antes, `status ${r.status}`);
    }
    {
      const antes = stockM();
      const r = await llamar({ ...base, codigo: '__principal__' }, 'otro-token');
      caso('vender principal con cookie equivocada -> 403', r.status === 403 && stockM() === antes, `status ${r.status}`);
    }
    {
      const antes = stockM();
      const r = await llamar({ ...base, codigo: '__principal__', token: null }, PRINCIPAL);
      caso('vender principal con su cookie -> descuenta 1', r.status === 200 && stockM() === antes - 1, `status ${r.status}, stock ${stockM()}`);
    }
    {
      const antes = stockM();
      const r = await llamar({ ...base, codigo: 'ana', token: ANA });
      caso('vender vendedor con su token -> descuenta 1 (igual que antes)', r.status === 200 && stockM() === antes - 1, `status ${r.status}`);
    }
    {
      const antes = stockM();
      const r = await llamar({ ...base, codigo: 'ana', token: PRINCIPAL }, PRINCIPAL);
      caso('vender vendedor con token ajeno -> 403', r.status === 403 && stockM() === antes, `status ${r.status}`);
    }
  } finally {
    await db.cerrar();
  }

  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });

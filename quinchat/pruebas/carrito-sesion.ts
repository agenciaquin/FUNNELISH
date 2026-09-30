/**
 * Defensa en la RUTA (además del middleware): `app/api/funnels/carrito` GET, PATCH
 * y DELETE, y `app/api/funnels/evento` GET, piden sesión aunque se llamen sin
 * pasar por el middleware. Se llaman los handlers REALES.
 *   npx tsx pruebas/carrito-sesion.ts
 *
 * Supabase = PostgREST falso local (no toca ninguna base). Sesión = JWT real de
 * next-auth firmado con NEXTAUTH_SECRET (pruebas/_sesion-falsa.ts).
 *
 * Control positivo: con sesión válida las mismas llamadas SÍ llegan a la base
 * (si no, el 401 podría venir de un fallo del arnés y no de la ruta).
 */
import { arrancarPostgrest } from './_postgrest-falso';
import { instalarNextHeaders, fijarSesion } from './_sesion-falsa';
import { encode } from 'next-auth/jwt';

let fallos = 0, total = 0;
function caso(nombre: string, ok: boolean, extra = '') {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}${!ok && extra ? `  -> ${extra}` : ''}`);
}

(async () => {
  const db = await arrancarPostgrest({
    carritos_abandonados: [{ id: 'k1', slug: 's', nombre: 'Ana', telefono: '3001234567', recuperado: false, created_at: '2026-09-01T00:00:00Z' }],
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
  instalarNextHeaders();

  const carrito = await import('../app/api/funnels/carrito/route');
  const evento = await import('../app/api/funnels/evento/route');
  const { NextRequest } = await import('next/server');
  const U = 'http://localhost:3000/api/funnels/carrito';
  const llamadas = () => ({
    GET: () => carrito.GET(new NextRequest(U)),
    PATCH: () => carrito.PATCH(new NextRequest(U, { method: 'PATCH', body: JSON.stringify({ id: 'k1', recuperado: true }) })),
    DELETE: () => carrito.DELETE(new NextRequest(`${U}?id=k1`, { method: 'DELETE' })),
    'GET evento': () => evento.GET(),
  });

  try {
    // ── Sin sesión ────────────────────────────────────────────────────────────
    await fijarSesion(null);
    for (const [n, f] of Object.entries(llamadas())) {
      db.peticiones.length = 0;
      const r = await f();
      caso(`${n} sin sesión -> 401`, r.status === 401, `status ${r.status}`);
      caso(`${n} sin sesión: no toca la base`, db.peticiones.length === 0, `${db.peticiones.length} peticiones`);
    }

    // ── Cookie firmada con OTRO secreto (sesión falsificada) ─────────────────
    {
      const falsa = await encode({ token: { name: 'x', email: 'x@x.co' }, secret: 'otro-secreto' });
      // se instala a mano la cookie falsa
      const mod: any = require.cache[require.resolve('next/headers')]!.exports;
      const cookiesOrig = mod.cookies;
      mod.cookies = async () => ({ getAll: () => [{ name: 'next-auth.session-token', value: falsa }], get: () => undefined });
      for (const [n, f] of Object.entries(llamadas())) {
        db.peticiones.length = 0;
        const r = await f();
        caso(`${n} con cookie firmada con otro secreto -> 401`, r.status === 401 && db.peticiones.length === 0, `status ${r.status}, ${db.peticiones.length} peticiones`);
      }
      mod.cookies = cookiesOrig;
    }

    // ── Control positivo: con sesión válida sí llega a la base ───────────────
    await fijarSesion({ name: 'Agencia Quin', email: 'agenciaquin43@gmail.com' });
    for (const [n, f] of Object.entries(llamadas())) {
      db.peticiones.length = 0;
      const r = await f();
      caso(`${n} con sesión -> no 401 y consulta la base`, r.status !== 401 && db.peticiones.length > 0, `status ${r.status}, ${db.peticiones.length} peticiones`);
    }

    // ── POST sigue siendo público (la página de venta) ───────────────────────
    await fijarSesion(null);
    db.peticiones.length = 0;
    const r = await carrito.POST(new NextRequest(U, { method: 'POST', body: JSON.stringify({ slug: 'prueba', telefono: '3001112233', nombre: 'Bo' }) }));
    caso('POST sin sesión -> 200 y guarda el carrito', r.status === 200 && db.peticiones.some(p => p.tabla === 'carritos_abandonados' && p.metodo === 'POST'), `status ${r.status}`);
  } finally {
    await db.cerrar();
  }

  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });

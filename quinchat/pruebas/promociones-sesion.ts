/**
 * Defensa en la RUTA (además del middleware): `app/api/promociones` (GET, POST,
 * DELETE) y `app/api/vendedores-promo` (GET, POST, DELETE) piden sesión aunque se
 * llamen sin pasar por el middleware. Son del panel: crean y borran promociones,
 * y el GET de vendedores devuelve sus tokens. Se llaman los handlers REALES.
 *   npx tsx pruebas/promociones-sesion.ts
 *
 * Supabase = PostgREST falso local (no toca ninguna base). Sesión = JWT real de
 * next-auth firmado con NEXTAUTH_SECRET (pruebas/_sesion-falsa.ts).
 *
 * Control positivo: con sesión válida las mismas llamadas SÍ llegan a la base
 * (si no, el 401 podría venir de un fallo del arnés y no de la ruta).
 */
import { arrancarPostgrest } from './_postgrest-falso';
import { instalarNextHeaders, fijarSesion } from './_sesion-falsa';

let fallos = 0, total = 0;
function caso(nombre: string, ok: boolean, extra = '') {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}${!ok && extra ? `  -> ${extra}` : ''}`);
}

(async () => {
  const db = await arrancarPostgrest({
    promociones: [{ id: 'p1', nombre: 'Camiseta', activo: true, orden: 0, creado_at: '2026-09-01T00:00:00Z' }],
    vendedores_promo: [
      { id: 'v1', nombre: 'Ana', celular: '3001112233', codigo: 'ana', token: 'tokenana', activo: true, creado_at: '2026-09-01T00:00:00Z' },
      { id: 'v0', nombre: 'Principal', celular: '3167648391', codigo: '__principal__', token: 'tokenprincipal', activo: true, creado_at: '2026-09-01T00:00:00Z' },
    ],
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
  instalarNextHeaders();

  const promos = await import('../app/api/promociones/route');
  const vend = await import('../app/api/vendedores-promo/route');
  const { NextRequest } = await import('next/server');
  const UP = 'http://localhost:3000/api/promociones';
  const UV = 'http://localhost:3000/api/vendedores-promo';
  const json = (u: string, b: any) => new NextRequest(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  const llamadas = () => ({
    'promociones GET': () => promos.GET(new NextRequest(UP)),
    'promociones GET ?admin=1': () => promos.GET(new NextRequest(`${UP}?admin=1`)),
    'promociones POST': () => promos.POST(json(UP, { id: 'p1', nombre: 'Camiseta', precio: 1, tallas: ['M'], stock: { M: 0 } })),
    'promociones DELETE': () => promos.DELETE(new NextRequest(`${UP}?id=p1`, { method: 'DELETE' })),
    'vendedores-promo GET': () => vend.GET(),
    'vendedores-promo POST': () => vend.POST(json(UV, { id: 'v1', nombre: 'Ana', celular: '3001112233' })),
    'vendedores-promo DELETE': () => vend.DELETE(new NextRequest(`${UV}?id=v1`, { method: 'DELETE' })),
  });

  try {
    // ── Sin sesión ────────────────────────────────────────────────────────────
    await fijarSesion(null);
    for (const [n, f] of Object.entries(llamadas())) {
      db.peticiones.length = 0;
      const r = await f();
      const cuerpo = await r.text();
      caso(`${n} sin sesión -> 401`, r.status === 401, `status ${r.status}`);
      caso(`${n} sin sesión: no toca la base`, db.peticiones.length === 0, `${db.peticiones.length} peticiones`);
      caso(`${n} sin sesión: no devuelve ningún token`, !/tokenana|tokenprincipal/.test(cuerpo), cuerpo.slice(0, 120));
    }

    // ── Control positivo: con sesión válida sí llega a la base ───────────────
    await fijarSesion({ name: 'Agencia Quin', email: 'agenciaquin43@gmail.com' });
    for (const [n, f] of Object.entries(llamadas())) {
      db.peticiones.length = 0;
      const r = await f();
      caso(`${n} con sesión -> no 401 y consulta la base`, r.status !== 401 && db.peticiones.length > 0, `status ${r.status}, ${db.peticiones.length} peticiones`);
    }
  } finally {
    await db.cerrar();
  }

  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });

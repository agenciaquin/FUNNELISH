/**
 * Token por cliente del webhook de Funnelish, más allá de pruebas/token-funnelish.ts:
 *   npx tsx pruebas/token-cliente-aislado.ts
 *
 * 1) Ruta REAL `app/api/funnelish/webhook/[tenant]` (POST):
 *    - el token de un cliente no abre la URL de otro (query y cabecera);
 *    - la clave general no abre ninguna URL de cliente (query y cabecera);
 *    - control positivo: con SU token pasa la comprobación y llega a buscar el
 *      cliente (404 porque en la base falsa está inactivo: no procesa nada).
 * 2) `pruebas/token-por-cliente.ts` (se ejecuta de verdad) no imprime la clave
 *    general ni en la salida normal ni en la de error, e imprime el token que
 *    comprueba la ruta.
 *
 * Supabase = PostgREST falso local. Sin WhatsApp ni IA configurados.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { arrancarPostgrest, de } from './_postgrest-falso';

let fallos = 0, total = 0;
function caso(nombre: string, ok: boolean, extra = '') {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}${!ok && extra ? `  -> ${extra}` : ''}`);
}

const CLAVE = 'CLAVE-GENERAL-muy-secreta-4f2a9c';
const RAIZ = join(__dirname, '..');

(async () => {
  const db = await arrancarPostgrest({
    tenants: [
      { id: 'ta', slug: 'cliente-a', activo: false, wa_access_token: null, wa_phone_number_id: null, wa_phone_number_id_ventas: null },
      { id: 'tb', slug: 'cliente-b', activo: false, wa_access_token: null, wa_phone_number_id: null, wa_phone_number_id_ventas: null },
    ],
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
  process.env.FUNNELISH_WEBHOOK_TOKEN = CLAVE;

  const { tokenFunnelishDeCliente } = await import('../lib/token-funnelish');
  const ruta = await import('../app/api/funnelish/webhook/[tenant]/route');
  const { NextRequest } = await import('next/server');
  const tokA = tokenFunnelishDeCliente('cliente-a');
  const tokB = tokenFunnelishDeCliente('cliente-b');
  const cuerpo = JSON.stringify({ event: 'refund' });
  const post = async (slug: string, token?: string, via: 'query' | 'cabecera' = 'query') => {
    db.peticiones.length = 0;
    const url = `https://x.test/api/funnelish/webhook/${slug}${token !== undefined && via === 'query' ? `?token=${token}` : ''}`;
    const h: Record<string, string> = token !== undefined && via === 'cabecera' ? { 'x-webhook-token': token } : {};
    const r = await ruta.POST(new NextRequest(url, { method: 'POST', body: cuerpo, headers: h }), { params: Promise.resolve({ tenant: slug }) });
    return { status: r.status, tocoBase: de(db, 'tenants').length > 0 };
  };

  try {
    // ── 1. Ruta real ──────────────────────────────────────────────────────────
    for (const via of ['query', 'cabecera'] as const) {
      let r = await post('cliente-b', tokA, via);
      caso(`[${via}] token de A en la URL de B -> 401 sin tocar la base`, r.status === 401 && !r.tocoBase, JSON.stringify(r));
      r = await post('cliente-a', tokB, via);
      caso(`[${via}] token de B en la URL de A -> 401`, r.status === 401 && !r.tocoBase, JSON.stringify(r));
      r = await post('cliente-a', CLAVE, via);
      caso(`[${via}] clave general en la URL de A -> 401`, r.status === 401 && !r.tocoBase, JSON.stringify(r));
      r = await post('cliente-a', tokA.toUpperCase(), via);
      caso(`[${via}] token de A en mayúsculas -> 401`, r.status === 401, JSON.stringify(r));
      r = await post('cliente-a', tokA.slice(0, 63), via);
      caso(`[${via}] token de A truncado -> 401`, r.status === 401, JSON.stringify(r));
      r = await post('cliente-a', tokA, via);
      // 404 solo sale DESPUÉS de pasar el token (la 2ª vez el cliente viene de la caché de 60 s de la ruta)
      caso(`[${via}] control: token de A en la URL de A pasa el token y busca el cliente (404 inactivo)`, r.status === 404 && (via === 'cabecera' || r.tocoBase), JSON.stringify(r));
    }
    {
      const r = await post('CLIENTE-A', tokA);
      console.log(`info  slug en mayúsculas en la URL ('CLIENTE-A') con el token de 'cliente-a' -> ${r.status} (el token se deriva del slug tal cual llega)`);
    }

    // ── 2. El script que reparte los tokens ──────────────────────────────────
    // Mismo node y mismos cargadores de tsx que esta prueba (tsx llega por npx, no está en node_modules)
    const correr = (args: string[], env: Record<string, string | undefined>) =>
      spawnSync(process.execPath, [...process.execArgv, 'pruebas/token-por-cliente.ts', ...args], { cwd: RAIZ, env: { ...process.env, ...env }, encoding: 'utf8' });

    let s = correr(['cliente-a', 'cliente-b'], { FUNNELISH_WEBHOOK_TOKEN: CLAVE, BASE: undefined });
    const salida = `${s.stdout}\n${s.stderr}`;
    caso('script: termina bien', s.status === 0, `status ${s.status} ${s.stderr}`);
    caso('script: NO imprime la clave general', !salida.includes(CLAVE));
    caso('script: imprime el token de A y el de B que acepta la ruta',
      s.stdout.includes(`/api/funnelish/webhook/cliente-a?token=${tokA}`) && s.stdout.includes(`/api/funnelish/webhook/cliente-b?token=${tokB}`), s.stdout);

    s = correr([], { FUNNELISH_WEBHOOK_TOKEN: CLAVE });
    caso('script sin slugs: falla y NO imprime la clave', s.status !== 0 && !`${s.stdout}${s.stderr}`.includes(CLAVE), `status ${s.status}`);
    s = correr(['cliente-a'], { FUNNELISH_WEBHOOK_TOKEN: '' });
    caso('script sin clave: falla (no calcula tokens con clave vacía)', s.status !== 0 && !/token=[0-9a-f]{64}/.test(s.stdout), `status ${s.status} ${s.stdout}`);
  } finally {
    await db.cerrar();
  }

  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });

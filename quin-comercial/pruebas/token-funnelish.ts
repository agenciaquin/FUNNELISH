/**
 * Token del webhook de Funnelish, con el código real.
 *   npx tsx pruebas/token-funnelish.ts
 *
 * 1) `lib/token-funnelish.ts` a secas.
 * 2) La ruta `app/api/funnelish/webhook/route.ts`: `POST` rechaza sin token y
 *    `procesarPedidoFunnelish` (lo que usa el checkout propio) NO lo pide. Se
 *    llama con `event: 'refund'`, que la función ignora antes de tocar nada.
 * También la ruta por cliente `[tenant]` rechaza sin token (no se prueba el caso
 * con token correcto: carga el cliente de la base).
 * 3) `app/api/pedidos/route.ts` llama a `procesarPedidoFunnelish`, no a `POST`.
 *
 * Sin variables de Supabase ni WhatsApp: nada de esto puede tener efecto real.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { tokenFunnelishValido } from '../lib/token-funnelish';

const RAIZ = join(__dirname, '..');
const URL_WH = 'https://x.test/api/funnelish/webhook';
const TOKEN = 'token-de-prueba-123';

let fallos = 0, total = 0;
function caso(nombre: string, ok: boolean, extra = '') {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}${extra ? ' · ' + extra : ''}`);
}

const pedir = (url: string, h: Record<string, string> = {}, cuerpo = '{"event":"refund"}') =>
  new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: cuerpo });

(async () => {
  const avisos: string[] = [];
  const warnOriginal = console.warn;
  console.warn = (...a: any[]) => { avisos.push(a.join(' ')); };

  // ── 1. Módulo ───────────────────────────────────────────────────────────────
  delete process.env.FUNNELISH_WEBHOOK_TOKEN;
  caso('sin variable: pasa', tokenFunnelishValido(pedir(URL_WH)) === true);
  caso('sin variable: avisa en el registro', avisos.some(a => a.includes('FUNNELISH_WEBHOOK_TOKEN')));
  process.env.FUNNELISH_WEBHOOK_TOKEN = '';
  caso('variable vacía: pasa (igual que sin variable)', tokenFunnelishValido(pedir(URL_WH)) === true);

  process.env.FUNNELISH_WEBHOOK_TOKEN = TOKEN;
  caso('token correcto por ?token= pasa', tokenFunnelishValido(pedir(`${URL_WH}?token=${TOKEN}`)) === true);
  caso('token correcto con &modo=agente pasa', tokenFunnelishValido(pedir(`${URL_WH}?modo=agente&token=${TOKEN}`)) === true);
  caso('token correcto por cabecera x-webhook-token pasa', tokenFunnelishValido(pedir(URL_WH, { 'x-webhook-token': TOKEN })) === true);
  caso('sin token se rechaza', tokenFunnelishValido(pedir(URL_WH)) === false);
  caso('token incorrecto (misma longitud) se rechaza', tokenFunnelishValido(pedir(`${URL_WH}?token=${TOKEN.slice(0, -1)}X`)) === false);
  caso('token incorrecto (otra longitud) se rechaza', tokenFunnelishValido(pedir(`${URL_WH}?token=corto`)) === false);
  caso('token vacío ?token= se rechaza', tokenFunnelishValido(pedir(`${URL_WH}?token=`)) === false);
  caso('prefijo del token se rechaza', tokenFunnelishValido(pedir(`${URL_WH}?token=${TOKEN}extra`)) === false);
  caso('cabecera incorrecta se rechaza', tokenFunnelishValido(pedir(URL_WH, { 'x-webhook-token': 'otro' })) === false);
  // Si llega ?token= vacío, `??` NO cae a la cabecera: se documenta el comportamiento.
  caso('?token= vacío + cabecera correcta: manda la query (rechaza)',
    tokenFunnelishValido(pedir(`${URL_WH}?token=`, { 'x-webhook-token': TOKEN })) === false);

  // ── 2. Ruta real ────────────────────────────────────────────────────────────
  const ruta = await import('../app/api/funnelish/webhook/route');
  const rutaTenant = await import('../app/api/funnelish/webhook/[tenant]/route');
  const params = { params: Promise.resolve({ tenant: 'prueba' }) };
  const t1 = await rutaTenant.POST(pedir('https://x.test/api/funnelish/webhook/prueba'), params);
  caso('POST /api/funnelish/webhook/[tenant] sin token -> 401 (antes de tocar la base)', t1.status === 401, `status ${t1.status}`);
  const t2 = await rutaTenant.POST(pedir('https://x.test/api/funnelish/webhook/prueba?token=malo'), params);
  caso('POST [tenant] con token malo -> 401', t2.status === 401, `status ${t2.status}`);
  const r1 = await ruta.POST(pedir(URL_WH));
  caso('POST /api/funnelish/webhook sin token -> 401', r1.status === 401, `status ${r1.status}`);
  const r2 = await ruta.POST(pedir(`${URL_WH}?token=malo`));
  caso('POST con token malo -> 401', r2.status === 401, `status ${r2.status}`);
  const r3 = await ruta.POST(pedir(`${URL_WH}?token=${TOKEN}`));
  const j3 = await r3.json().catch(() => ({}));
  caso('POST con token correcto llega a procesarPedidoFunnelish', r3.status === 200 && j3.status === 'ignored', `status ${r3.status} ${JSON.stringify(j3)}`);
  const r4 = await ruta.procesarPedidoFunnelish(pedir(URL_WH));
  const j4 = await r4.json().catch(() => ({}));
  caso('procesarPedidoFunnelish SIN token no lo pide (checkout propio)', r4.status === 200 && j4.status === 'ignored', `status ${r4.status} ${JSON.stringify(j4)}`);

  // ── 3. /api/pedidos usa procesarPedidoFunnelish, no POST ─────────────────────
  const src = readFileSync(join(RAIZ, 'app/api/pedidos/route.ts'), 'utf8');
  caso('/api/pedidos importa procesarPedidoFunnelish', /import\s*\{[^}]*\bprocesarPedidoFunnelish\b[^}]*\}\s*from\s*'@\/app\/api\/funnelish\/webhook\/route'/.test(src));
  caso('/api/pedidos no importa el POST del webhook', !/import\s*\{[^}]*\bPOST\b[^}]*\}\s*from\s*'@\/app\/api\/funnelish\/webhook\/route'/.test(src));
  caso('/api/pedidos no usa tokenFunnelishValido', !src.includes('tokenFunnelishValido'));

  console.warn = warnOriginal;
  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

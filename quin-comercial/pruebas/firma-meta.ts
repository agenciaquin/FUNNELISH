/**
 * Firma de Meta en quin-comercial, con el código real.
 *   npx tsx pruebas/firma-meta.ts
 *
 * 1) `lib/firma-meta.ts` (los mismos 6 casos que quinchat).
 * 2) `procesarEntrada` de `app/api/whatsapp/webhook/route.ts`, con
 *    WHATSAPP_APP_SECRET puesta y un cuerpo que no es JSON (sale antes de tocar
 *    nada): la línea propia exige firma; la ruta por cliente (`base.tenantId`,
 *    lo que pasa `webhook/[tenant]/route.ts`) no la comprueba.
 */
import { createHmac } from 'crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { leerAvisoDeMeta } from '../lib/firma-meta';

const SECRETO = 'secreto-de-prueba';
const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: 'wamid.1' }] } }] }] });
const firmar = (s: string) => 'sha256=' + createHmac('sha256', SECRETO).update(s, 'utf8').digest('hex');
const pedir = (h: Record<string, string>, b = cuerpo) => new Request('https://x/api/whatsapp/webhook', { method: 'POST', headers: h, body: b });

let fallos = 0, total = 0;
function marcar(ok: boolean, nombre: string) {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}`);
}
async function caso(nombre: string, esperado: boolean, r: Promise<{ valido: boolean }>) {
  marcar((await r).valido === esperado, nombre);
}

(async () => {
  // ── 1. Módulo ───────────────────────────────────────────────────────────────
  await caso('firma correcta pasa', true, leerAvisoDeMeta(pedir({ 'x-hub-signature-256': firmar(cuerpo) }), SECRETO));
  await caso('firma de otro cuerpo se rechaza', false, leerAvisoDeMeta(pedir({ 'x-hub-signature-256': firmar(cuerpo + ' ') }), SECRETO));
  await caso('sin firma se rechaza', false, leerAvisoDeMeta(pedir({}), SECRETO));
  await caso('firma basura se rechaza', false, leerAvisoDeMeta(pedir({ 'x-hub-signature-256': 'sha256=abc' }), SECRETO));
  await caso('sin secreto configurado pasa', true, leerAvisoDeMeta(pedir({}), ''));
  const r = await leerAvisoDeMeta(pedir({ 'x-hub-signature-256': firmar(cuerpo) }), SECRETO);
  marcar(r.valido && (r as any).body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id === 'wamid.1', 'el JSON llega intacto');

  // '' explícito (lo que pasa la ruta por cliente) no mira la variable ni avisa.
  process.env.WHATSAPP_APP_SECRET = SECRETO;
  const avisos: string[] = [];
  const warn = console.warn;
  console.warn = (...a: any[]) => { avisos.push(a.join(' ')); };
  await caso("con variable puesta, appSecret '' (cliente) pasa sin firma", true, leerAvisoDeMeta(pedir({}), ''));
  marcar(!avisos.some(a => a.includes('WHATSAPP_APP_SECRET')), "appSecret '' no avisa de variable ausente");
  await caso('con variable puesta y sin segundo argumento, exige firma', false, leerAvisoDeMeta(pedir({})));

  // ── 2. procesarEntrada real ─────────────────────────────────────────────────
  const { procesarEntrada } = await import('../app/api/whatsapp/webhook/route');
  const req = (h: Record<string, string> = {}) =>
    new NextRequest('https://x/api/whatsapp/webhook', { method: 'POST', headers: h, body: 'no-es-json' });

  const a = await procesarEntrada(req());
  marcar(a.status === 401, `línea propia sin firma -> 401 (status ${a.status})`);
  const b = await procesarEntrada(req({ 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) }));
  marcar(b.status === 401, `línea propia con firma incorrecta -> 401 (status ${b.status})`);
  const c = await procesarEntrada(req({ 'x-hub-signature-256': firmar('no-es-json') }));
  marcar(c.status === 200, `línea propia con firma correcta pasa (status ${c.status})`);
  const d = await procesarEntrada(req(), { tenantId: 'tenant-prueba' } as any);
  marcar(d.status === 200, `ruta por cliente (base.tenantId) sin firma pasa (status ${d.status})`);
  const e = await procesarEntrada(req(), {} as any);
  marcar(e.status === 401, `base sin tenantId se trata como línea propia -> 401 (status ${e.status})`);
  console.warn = warn;

  // ── 3. Lectura: [tenant] entrega base con tenantId ──────────────────────────
  const src = readFileSync(join(__dirname, '..', 'app/api/whatsapp/webhook/[tenant]/route.ts'), 'utf8');
  marcar(/tenantId:\s*t\.id/.test(src) && /return procesarEntrada\(req, base\)/.test(src),
    '[tenant]/route.ts llama a procesarEntrada(req, base) con tenantId: t.id');

  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

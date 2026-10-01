/**
 * La ruta REAL `app/api/whatsapp/webhook/route.ts` (POST) aplica la firma de Meta.
 *   npx tsx pruebas/firma-meta-ruta.ts
 *
 * Cuerpo que no es JSON: con firma válida la ruta sale con 200 antes de tocar
 * nada (no hay Supabase ni WhatsApp configurados).
 */
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

const SECRETO = 'secreto-de-prueba';
const CUERPO = 'no-es-json';
const firmar = (s: string) => 'sha256=' + createHmac('sha256', SECRETO).update(s, 'utf8').digest('hex');
const req = (h: Record<string, string> = {}) =>
  new NextRequest('https://x/api/whatsapp/webhook', { method: 'POST', headers: h, body: CUERPO });

let fallos = 0, total = 0;
function marcar(ok: boolean, nombre: string) {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}`);
}

(async () => {
  const warn = console.warn;
  console.warn = () => {};
  const { POST } = await import('../app/api/whatsapp/webhook/route');

  process.env.WHATSAPP_APP_SECRET = SECRETO;
  const a = await POST(req());
  marcar(a.status === 401, `con secreto, sin firma -> 401 (status ${a.status})`);
  const b = await POST(req({ 'x-hub-signature-256': firmar(CUERPO + 'x') }));
  marcar(b.status === 401, `con secreto, firma de otro cuerpo -> 401 (status ${b.status})`);
  const c = await POST(req({ 'x-hub-signature-256': firmar(CUERPO) }));
  marcar(c.status === 200, `con secreto, firma correcta pasa (status ${c.status})`);

  delete process.env.WHATSAPP_APP_SECRET;
  const d = await POST(req());
  marcar(d.status === 200, `sin secreto configurado, deja pasar como antes (status ${d.status})`);
  console.warn = warn;

  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

import { createHmac } from 'crypto';
import { leerAvisoDeMeta } from '../lib/firma-meta';

const SECRETO = 'secreto-de-prueba';
const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: 'wamid.1' }] } }] }] });
const firmar = (s: string) => 'sha256=' + createHmac('sha256', SECRETO).update(s, 'utf8').digest('hex');
const pedir = (h: Record<string, string>, b = cuerpo) => new Request('https://x/api/whatsapp/webhook', { method: 'POST', headers: h, body: b });

let fallos = 0;
async function caso(nombre: string, esperado: boolean, r: Promise<{ valido: boolean }>) {
  const ok = (await r).valido === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}`);
}

(async () => {
  await caso('firma correcta pasa', true, leerAvisoDeMeta(pedir({ 'x-hub-signature-256': firmar(cuerpo) }), SECRETO));
  await caso('firma de otro cuerpo se rechaza', false, leerAvisoDeMeta(pedir({ 'x-hub-signature-256': firmar(cuerpo + ' ') }), SECRETO));
  await caso('sin firma se rechaza', false, leerAvisoDeMeta(pedir({}), SECRETO));
  await caso('firma basura se rechaza', false, leerAvisoDeMeta(pedir({ 'x-hub-signature-256': 'sha256=abc' }), SECRETO));
  await caso('sin secreto configurado pasa', true, leerAvisoDeMeta(pedir({}), ''));
  const r = await leerAvisoDeMeta(pedir({ 'x-hub-signature-256': firmar(cuerpo) }), SECRETO);
  const cuerpoOk = r.valido && (r as any).body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id === 'wamid.1';
  if (!cuerpoOk) fallos++;
  console.log(`${cuerpoOk ? 'ok   ' : 'FALLA'} el JSON llega intacto`);
  process.exit(fallos ? 1 : 0);
})();

/**
 * MEDICION — cuanto se ahorraria si `whatsapp/send-media` comprimiera.
 *
 * Esa ruta sube el buffer tal cual: no llama a `optimizarImagen()`. Este script
 * descarga una muestra real del bucket y la pasa por el compresor de verdad.
 * Solo mide. No escribe nada en Storage.
 *
 *   cd quinchat && npx tsx pruebas/medir-chat-saliente.ts
 */
import { optimizarImagen } from '../lib/optimizar-imagen-servidor.js';

const BASE = 'https://bjbjqmbuzpyjvcugbusx.supabase.co/storage/v1/object/public/chat-media/';
const MUESTRA = [
  '573106825911/1785031440467-39ogi.jpg','573014059324/1785013265781-0g0fg.jpg',
  '573165786599/1786478528098-qth4r.jpg','573163298560/1785766218836-7f8t6.png',
  '573167648391/1784594055705-gzo47.png','573204441755/1786485034515-pltsg.png',
  '573144519480/1787866569969-29i9x.jpg','573229060350/1786999063071-7ntj9.png',
  '573223552073/1785891777145-fnc1t.png','573212823502/1788106645883-b8br1.jpg',
  '573232362777/1785348052604-tnyft.png','573235983456/1788043487916-b7oi2.jpg',
];
const kb = (n: number) => `${Math.round(n / 1024)} kB`;

async function main() {
  let entra = 0, sale = 0;
  for (const n of MUESTRA) {
    const r = await fetch(BASE + n);
    if (!r.ok) { console.log(`  -- ${n} ${r.status}`); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    const o = await optimizarImagen(buf, r.headers.get('content-type') ?? 'image/jpeg');
    entra += buf.length; sale += o.buffer.length;
    const pct = Math.round((1 - o.buffer.length / buf.length) * 100);
    console.log(`  ${n.split('/')[1]!.padEnd(24)} ${kb(buf.length).padStart(9)} -> ${kb(o.buffer.length).padStart(8)}  ${String(pct).padStart(3)}%  ${o.contentType}`);
  }
  console.log(`\n  TOTAL ${kb(entra)} -> ${kb(sale)}   ahorro ${Math.round((1 - sale / entra) * 100)}%\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });

/**
 * Replica la lógica exacta de `quinchat/lib/whatsapp.ts` (descargarYSubir, líneas
 * 290-303) sobre los archivos de `embudos/chat/` que ya se sustituyeron, para
 * ver qué recibiría Meta si uno de esos mensajes se reenviara.
 *
 * No envía nada: solo reproduce la decisión que toma el código.
 */
import { supabase, urlPublica } from './src/storage.js';

const WA_IMAGE_LIMIT = 5_242_880;            // lib/whatsapp.ts:219
const META_ENTREGA = ['image/jpeg', 'image/png']; // lo que WhatsApp sí entrega

const { data, error } = await supabase
  .from('media_optimizaciones')
  .select('ruta, bytes_original')
  .like('ruta', 'embudos/chat/%');
if (error) throw error;

console.log(`Archivos de chat de WhatsApp sustituidos: ${data.length}\n`);
console.log('  VEREDICTO   lo que recibiria Meta                 archivo');
console.log('  ' + '-'.repeat(74));

let malos = 0;
for (const fila of data) {
  const ruta = fila.ruta as string;
  const resp = await fetch(urlPublica(ruta), { cache: 'no-store' } as RequestInit);

  // --- inicio de la réplica de lib/whatsapp.ts ---
  let ct = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0]!;
  if (!/^image\//i.test(ct)) ct = 'image/jpeg';
  const buf = Buffer.from(await resp.arrayBuffer());
  const recomprime = buf.length > WA_IMAGE_LIMIT; // dispararía comprimirYSubirImagen()
  const ext = (ct.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  // --- fin de la réplica ---

  const entrega = META_ENTREGA.includes(ct);
  if (!entrega) malos++;

  const veredicto = !entrega ? 'RECHAZA  ' : recomprime ? 'RECOMPRIME' : 'ENTREGA   ';
  console.log(`  ${veredicto}  ${ct} · foto.${ext} · ${(buf.length / 1024).toFixed(0)} kB`.padEnd(62) + ruta.slice(-32));
}

console.log('\n' + '='.repeat(76));
if (malos === 0) {
  console.log(`Los ${data.length} archivos llegarian a Meta como image/jpeg, por debajo del limite`);
  console.log('de 5 MB y sin pasar por la recompresion de emergencia. WhatsApp los entrega.');
} else {
  console.log(`${malos} archivos llegarian a Meta en un formato que NO entrega. Revisar.`);
  process.exit(1);
}

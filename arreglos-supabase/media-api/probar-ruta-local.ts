/**
 * PRUEBA DE LA RUTA DE SUBIDA CONTRA UN NEXT LOCAL
 *
 * Levanta la duda que las pruebas anteriores no cubrían: el compresor estaba
 * probado por separado, pero **el cableado de la ruta** no. Que de verdad llame
 * a `optimizarImagen`, que suba el buffer comprimido y no el original, y que lo
 * etiquete con el content-type y la caché correctos.
 *
 * No despliega nada. Habla con un `next dev` en local.
 *
 * La cabecera `Host: pedido.localhost` hace que el middleware trate la petición
 * como si viniera de la tienda, que es la rama que no exige sesión.
 *
 * OJO: `fetch` de Node **no deja poner la cabecera `Host`** —está en la lista de
 * cabeceras prohibidas de la especificación— así que la subida se hace con curl.
 * Este script solo comprueba el resultado. La subida es:
 *
 *   curl -X POST -H "Host: pedido.localhost" \
 *        -F "file=@foto.png;type=image/png" -F "slug=_prueba-compresion" \
 *        http://127.0.0.1:3123/api/funnels/imagen
 *
 * RESULTADO DE LA ULTIMA EJECUCION (2026-08-29, antes de desplegar):
 *
 *   entrada   PNG 1920x1920 · 5.662 kB
 *   guardado  jpeg 1920x1920 · 446 kB   (-92,1%)
 *   image/jpeg · public, max-age=31536000
 *
 * Las seis comprobaciones pasaron y el archivo de prueba se borro del bucket.
 *
 * Sube UN archivo a `embudos/_prueba-compresion/` y lo borra al terminar. Es el
 * bucket real —no hay otro— pero en una ruta que ningún embudo referencia.
 *
 *   npx tsx probar-ruta-local.ts [puerto]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PUERTO = process.argv[2] ?? '3123';
const MUESTRAS = 'C:/Users/Tati/AppData/Local/Temp/claude/D--PROYECTO-IA-FUNNELISH/bfe59f9d-7b33-44a1-95f1-1274978b4051/scratchpad/muestras';

for (const linea of readFileSync(join(AQUI, '.env'), 'utf8').split('\n')) {
  const m = /^([A-Z_]+)=(.*)$/.exec(linea.trim());
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!;
}

const kb = (n: number) => `${(n / 1024).toFixed(0)} kB`;
let fallos = 0;
const mal = (m: string) => { fallos++; console.log(`  MAL  ${m}`); };
const bien = (m: string) => console.log(`  OK   ${m}`);

// Un PNG pesado: exactamente el caso que hasta hoy no se comprimía en absoluto.
const original = readFileSync(`${MUESTRAS}/media-1785019291539-uuq6e-ORIGINAL.png`);
const metaOrig = await sharp(original).metadata();
console.log(`\nEntrada:  PNG ${metaOrig.width}x${metaOrig.height} · ${kb(original.length)}\n`);

const form = new FormData();
form.append('file', new Blob([new Uint8Array(original)], { type: 'image/png' }), 'prueba.png');
form.append('slug', '_prueba-compresion');

const res = await fetch(`http://127.0.0.1:${PUERTO}/api/funnels/imagen`, {
  method: 'POST',
  headers: { Host: 'pedido.localhost' },
  body: form,
});

const cuerpo = await res.json().catch(() => null);
if (res.status !== 200 || !cuerpo?.url) {
  console.log(`  MAL  la ruta devolvio ${res.status}: ${JSON.stringify(cuerpo)?.slice(0, 300)}`);
  process.exit(1);
}
bien('la ruta responde 200 y devuelve una URL publica');

const r = await fetch(cuerpo.url as string, { cache: 'no-store' } as RequestInit);
const guardado = Buffer.from(await r.arrayBuffer());
const metaFinal = await sharp(guardado).metadata();
const ct = (r.headers.get('content-type') ?? '').split(';')[0];
const cache = r.headers.get('cache-control') ?? '';

console.log(`\nGuardado: ${metaFinal.format} ${metaFinal.width}x${metaFinal.height} · ${kb(guardado.length)}`);
console.log(`          ${ct} · ${cache}\n`);

ct === 'image/jpeg'
  ? bien('se sirve como image/jpeg — el formato que Meta si entrega')
  : mal(`content-type "${ct}", se esperaba image/jpeg`);

metaFinal.format === 'jpeg'
  ? bien('el archivo es JPEG de verdad, no solo la cabecera')
  : mal(`el archivo es ${metaFinal.format}`);

(cuerpo.url as string).endsWith('.jpg')
  ? bien('la URL termina en .jpg')
  : mal(`la URL no termina en .jpg: ${cuerpo.url}`);

metaFinal.width === metaOrig.width
  ? bien(`conserva la resolucion original (${metaFinal.width}px)`)
  : mal(`resolucion ${metaFinal.width}px, la original era ${metaOrig.width}px`);

guardado.length < original.length * 0.25
  ? bien(`comprimido al ${(100 * guardado.length / original.length).toFixed(1)}% del original`)
  : mal(`apenas se comprimio: ${kb(guardado.length)} de ${kb(original.length)}`);

/max-age=31536000/.test(cache)
  ? bien('cache de un ano')
  : mal(`cache "${cache}", se esperaba max-age=31536000`);

// Limpieza: no dejar rastro.
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ruta = decodeURIComponent((cuerpo.url as string).split('/chat-media/')[1]!);
const { error } = await supabase.storage.from('chat-media').remove([ruta]);
error ? mal(`no se pudo borrar el archivo de prueba: ${error.message}`) : bien(`archivo de prueba borrado`);

console.log(fallos === 0
  ? '\nLA RUTA FUNCIONA: comprime, etiqueta y cachea correctamente\n'
  : `\n${fallos} FALLOS\n`);
process.exit(fallos === 0 ? 0 : 1);

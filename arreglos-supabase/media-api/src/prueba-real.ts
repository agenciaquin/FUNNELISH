/**
 * Mide el ahorro real sobre archivos que ya están publicados.
 *
 *   npx tsx src/prueba-real.ts embudos/f1-escuderia-tk/1787525205501-fxc0p.png
 *
 * Descarga por la URL pública (no hace falta service_role), comprime en memoria
 * y enseña el resultado. No sube nada ni toca la base de datos.
 */
import { clasificar, optimizarImagen, optimizarVideo } from './optimizar.js';

const BASE = 'https://bjbjqmbuzpyjvcugbusx.supabase.co/storage/v1/object/public/chat-media';
const mb = (b: number) => (b / 1024 / 1024).toFixed(2).padStart(6);

async function main() {
  const rutas = process.argv.slice(2);
  if (rutas.length === 0) {
    console.error('Uso: npx tsx src/prueba-real.ts <ruta-en-el-bucket> [...]');
    process.exit(1);
  }

  let antes = 0;
  let despues = 0;

  for (const ruta of rutas) {
    const url = `${BASE}/${ruta.split('/').map(encodeURIComponent).join('/')}`;
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
      console.log(`ERROR ${respuesta.status}  ${ruta}`);
      continue;
    }

    const original = Buffer.from(await respuesta.arrayBuffer());
    const clase = clasificar(original, respuesta.headers.get('content-type') ?? undefined);
    if (clase === 'otro') {
      console.log(`OMITIDO (${clase})  ${ruta}`);
      continue;
    }

    const inicio = Date.now();
    const r = clase === 'imagen' ? await optimizarImagen(original) : await optimizarVideo(original);
    const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

    antes += r.bytesOriginal;
    despues += r.bytesFinal;

    console.log(
      `${clase.padEnd(6)} ${mb(r.bytesOriginal)} MB -> ${mb(r.bytesFinal)} MB  ${segundos}s  ${r.motivo}\n         ${ruta}`,
    );
  }

  if (antes > 0) {
    console.log(`\n${'-'.repeat(64)}`);
    console.log(`TOTAL  ${mb(antes)} MB -> ${mb(despues)} MB   ahorro ${(((antes - despues) / antes) * 100).toFixed(1)}%`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

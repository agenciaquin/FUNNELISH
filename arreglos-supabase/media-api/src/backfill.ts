/**
 * Reprocesa archivos que ya están en el bucket.
 *
 * Tres modos, de menos a más invasivo:
 *
 *   npm run backfill -- --prefijo embudos            estima (solo metadatos, no descarga nada)
 *   npm run backfill -- --prefijo embudos --simular  descarga y comprime de verdad, pero no sube
 *   npm run backfill -- --prefijo embudos --aplicar  respalda el original y lo sustituye
 *
 * El modo por defecto es el de estimación justamente porque no consume egress:
 * responde "cuánto ahorraría" sin descargar ni un byte.
 */
import { clasificar, optimizarImagen, optimizarVideo } from './optimizar.js';
import { anotar, yaProcesadas } from './registro.js';
import { PREFIJO_ORIGINALES, descargar, listarRecursivo, respaldar, subir } from './storage.js';

interface Opciones {
  prefijo: string;
  modo: 'estimar' | 'simular' | 'aplicar';
  limite: number;
  soloClase: 'imagen' | 'video' | null;
}

function leerArgumentos(argv: string[]): Opciones {
  const opciones: Opciones = { prefijo: '', modo: 'estimar', limite: Number.POSITIVE_INFINITY, soloClase: null };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--prefijo') opciones.prefijo = argv[++i] ?? '';
    else if (arg === '--simular') opciones.modo = 'simular';
    else if (arg === '--aplicar') opciones.modo = 'aplicar';
    else if (arg === '--limite') opciones.limite = Number.parseInt(argv[++i] ?? '0', 10);
    else if (arg === '--solo') {
      const valor = argv[++i];
      if (valor !== 'imagen' && valor !== 'video') throw new Error('--solo acepta "imagen" o "video".');
      opciones.soloClase = valor;
    }
  }

  return opciones;
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1).padStart(7);

async function principal() {
  const opciones = leerArgumentos(process.argv.slice(2));

  console.log(`\nPrefijo: "${opciones.prefijo || '(todo el bucket)'}"  ·  modo: ${opciones.modo}\n`);

  const objetos = (await listarRecursivo(opciones.prefijo))
    .filter((o) => !o.ruta.startsWith(PREFIJO_ORIGINALES))
    .sort((a, b) => b.bytes - a.bytes);

  const procesadas = opciones.modo === 'aplicar' ? await yaProcesadas() : new Set<string>();

  let bytesAntes = 0;
  let bytesDespues = 0;
  let tocados = 0;
  const fallidos: { ruta: string; motivo: string }[] = [];
  let saltados = 0;

  for (const objeto of objetos) {
    if (tocados >= opciones.limite) break;
    if (procesadas.has(objeto.ruta)) {
      saltados++;
      continue;
    }

    // La clasificación buena necesita los bytes; en modo estimación nos
    // conformamos con el mimetype de los metadatos.
    const claseDeclarada = objeto.contentType?.startsWith('video/')
      ? 'video'
      : objeto.contentType?.startsWith('image/')
        ? 'imagen'
        : 'otro';

    if (claseDeclarada === 'otro') continue;
    if (opciones.soloClase && claseDeclarada !== opciones.soloClase) continue;

    if (opciones.modo === 'estimar') {
      // Ratios observados sobre este bucket: las imágenes bajan en torno al 92%
      // pasando a JPEG a 1920px, los vídeos en torno al 83% a 1080p con CRF 23.
      const ratio = claseDeclarada === 'imagen' ? 0.08 : 0.15;
      bytesAntes += objeto.bytes;
      bytesDespues += Math.round(objeto.bytes * ratio);
      tocados++;
      continue;
    }

    // Un archivo problemático NO puede tumbar el lote entero. Se anota y se
    // sigue; al final se listan todos los que fallaron.
    //
    // El caso real que obligó a esto: el bucket tiene `embudos/VOLKSWAGEN/` y
    // `embudos/volkswagen/`, dos carpetas que solo se diferencian en el caso, y
    // el `list()` de Supabase devuelve los archivos de una bajo el nombre de la
    // otra. La ruta reconstruida no existe y la descarga falla.
    try {
      const original = await descargar(objeto.ruta);
      const clase = clasificar(original, objeto.contentType);
      if (clase === 'otro') continue;

      const resultado = clase === 'imagen' ? await optimizarImagen(original) : await optimizarVideo(original);

      bytesAntes += resultado.bytesOriginal;
      bytesDespues += resultado.bytesFinal;
      tocados++;

      const etiqueta = `${mb(resultado.bytesOriginal)} MB -> ${mb(resultado.bytesFinal)} MB`;
      console.log(`${resultado.buffer ? 'OK  ' : '--  '} ${etiqueta}  ${objeto.ruta}  (${resultado.motivo})`);

      if (opciones.modo === 'aplicar' && resultado.buffer) {
        await respaldar(objeto.ruta);
        await subir(objeto.ruta, resultado.buffer, resultado.contentType);
        await anotar({
          ruta: objeto.ruta,
          clase,
          bytesOriginal: resultado.bytesOriginal,
          bytesFinal: resultado.bytesFinal,
          contentType: resultado.contentType,
          respaldo: `${PREFIJO_ORIGINALES}/${objeto.ruta}`,
        });
      }
    } catch (error) {
      fallidos.push({ ruta: objeto.ruta, motivo: (error as Error).message });
      console.log(`ERR  ${' '.repeat(21)}  ${objeto.ruta}  (${(error as Error).message})`);
    }
  }

  const ahorro = bytesAntes > 0 ? ((bytesAntes - bytesDespues) / bytesAntes) * 100 : 0;

  console.log(`\n${'-'.repeat(60)}`);
  console.log(`Archivos considerados : ${tocados}${saltados > 0 ? ` (${saltados} ya procesados)` : ''}`);
  console.log(`Antes                 : ${mb(bytesAntes)} MB`);
  console.log(`Después               : ${mb(bytesDespues)} MB`);
  console.log(`Ahorro                : ${mb(bytesAntes - bytesDespues)} MB  (${ahorro.toFixed(1)}%)`);

  if (fallidos.length > 0) {
    console.log(`\nFALLARON ${fallidos.length} archivos (el resto se proceso igualmente):`);
    for (const f of fallidos.slice(0, 20)) console.log(`  · ${f.ruta}\n      ${f.motivo}`);
    if (fallidos.length > 20) console.log(`  ... y ${fallidos.length - 20} mas`);
    console.log('\nNinguno se ha modificado. Relanzar el backfill los volvera a intentar.');
  }

  if (opciones.modo === 'estimar') {
    console.log('\nSon proyecciones a partir de los metadatos. Lanza --simular para medirlo de verdad.');
  } else if (opciones.modo === 'simular') {
    console.log('\nNada se ha subido. Lanza --aplicar para sustituir los archivos.');
  } else {
    console.log(`\nOriginales respaldados en "${PREFIJO_ORIGINALES}/". Bórralos cuando hayas verificado.`);
  }
}

principal().catch((error) => {
  console.error(error);
  process.exit(1);
});

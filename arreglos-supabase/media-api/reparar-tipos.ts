/**
 * Repara objetos cuyo content-type quedó mal etiquetado (`text/plain`) tras una
 * restauración hecha antes de arreglar `restaurar()`.
 *
 * Detecta el tipo real por los bytes de cabecera y lo vuelve a subir con la
 * etiqueta correcta. No modifica el contenido: sube exactamente los mismos bytes.
 */
import { descargar, listarRecursivo, subir, tipoPorContenido, urlPublica } from './src/storage.js';

const PREFIJO = process.argv[2] ?? 'embudos';

const sospechosos = (await listarRecursivo(PREFIJO)).filter(
  (o) => !o.contentType || !/^(image|video|audio)\//.test(o.contentType),
);

console.log(`Objetos con content-type incorrecto bajo "${PREFIJO}": ${sospechosos.length}\n`);

let reparados = 0;
for (const o of sospechosos) {
  const buf = await descargar(o.ruta);
  const tipo = tipoPorContenido(buf);

  if (tipo === 'application/octet-stream') {
    console.log(`  --   ${o.ruta}  (${o.contentType ?? 'sin tipo'}) — no es media reconocible, se deja`);
    continue;
  }

  await subir(o.ruta, buf, tipo);
  reparados++;
  console.log(`  OK   ${o.ruta}`);
  console.log(`       ${o.contentType ?? 'sin tipo'}  ->  ${tipo}   (${(buf.length / 1048576).toFixed(2)} MB)`);
}

console.log(`\nReparados: ${reparados} de ${sospechosos.length}`);

// Comprobación real por HTTP de los que se tocaron.
if (reparados > 0) {
  console.log('\nVerificacion HTTP:');
  let mal = 0;
  for (const o of sospechosos.slice(0, reparados)) {
    const r = await fetch(urlPublica(o.ruta), { method: 'HEAD' } as RequestInit);
    const ct = r.headers.get('content-type') ?? '(ninguno)';
    const ok = /^(image|video|audio)\//.test(ct);
    if (!ok) mal++;
    console.log(`  ${ok ? 'OK ' : 'MAL'}  ${ct.padEnd(12)}  ${o.ruta.slice(-40)}`);
  }
  console.log(mal === 0 ? '\nTODOS SIRVEN CON SU TIPO CORRECTO' : `\n${mal} SIGUEN MAL`);
}

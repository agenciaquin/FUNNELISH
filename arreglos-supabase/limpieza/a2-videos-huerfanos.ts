/**
 * A2 · Vídeos huérfanos (`TABLERO-AGENTES.md` §4, `HALLAZGO-videos.md`).
 *
 *   npx tsx arreglos-supabase/limpieza/a2-videos-huerfanos.ts [--copias <dir>]                      simulacro
 *   npx tsx arreglos-supabase/limpieza/a2-videos-huerfanos.ts --ejecutar --tablas-revisadas <resultados-sql.txt>
 *   npx tsx arreglos-supabase/limpieza/a2-videos-huerfanos.ts --ejecutar --purgar --tablas-revisadas <resultados-sql.txt>
 *
 * En CADA ejecución vuelve a cruzar todos los vídeos de los tres buckets contra
 * todas las columnas de texto de todas las tablas (observación 6 bis: el cruce
 * vale el día que se hace, no una semana antes).
 *
 * Solo se propone lo que cumple las tres cosas:
 *   1. ninguna tabla lo nombra (las de registro de la pasada de agosto no cuentan);
 *   2. está en `embudos/` y NO en `embudos/chat/` (eso es historial de clientes);
 *   3. ningún texto contiene su ruta completa `bucket/ruta` (segunda comprobación,
 *      por ruta y no por nombre, ya decodificada: `%2F`, `%20`…).
 * Los vídeos sin dueño de las carpetas de chat se listan aparte y NO se proponen.
 *
 * Con `--ejecutar`:
 *   - se niega si alguna tabla no se pudo leer y no se pasa con `--tablas-revisadas`
 *     el fichero de resultados de `cruce-solo-lectura.sql` (de menos de 24 h);
 *   - baja la copia local de cada uno y comprueba que pesa lo que dice Storage;
 *   - lo MUEVE a `_borrar/<ruta>` (no lo borra): un anuncio de Meta o un mensaje
 *     ya enviado pueden apuntar a la URL sin dejar rastro en la base
 *     (`HALLAZGO-nadie-borra-del-bucket.md`, suposición B).
 * Con `--ejecutar --purgar`, borra de `_borrar/` SOLO lo que se movió hace 14
 * días o más (según el registro de ejecuciones), usando como respaldo la copia
 * local ya bajada (no vuelve a bajar nada). La marcha atrás de lo purgado la
 * hace `restaurar.ts --tarea a2` desde esa copia.
 */
import {
  ARGS, EJECUTAR, MB, bajar, cabecera, cargarReferencias, copiaLocal, dondeSeUsa, dondeSeUsaPorRuta,
  escribirStorage, exigirRevisionSql, fallar, guardarCsv, guardarJson, leerRegistro, listarBucket, listarTodo, pausaSiEjecuta, zonaDe,
} from './comun';

const PURGAR = ARGS.includes('--purgar');
const DIAS_ESPERA = 14;

async function main() {
  cabecera('A2 · Vídeos huérfanos');
  const [objetos, refs] = await Promise.all([listarTodo(), cargarReferencias()]);
  const videos = objetos.filter((o) => o.mime.startsWith('video/') && !o.ruta.startsWith('_originales/') && !o.ruta.startsWith('_borrar/'));

  const filas = videos.map((o) => {
    const { zona } = zonaDe(o);
    const usos = dondeSeUsa(refs, o.ruta);
    const porRuta = dondeSeUsaPorRuta(refs, o.bucket, o.ruta);
    const registro = dondeSeUsa(refs, o.ruta, true).filter((u) => !usos.includes(u));
    const propuesto = usos.length === 0 && porRuta.length === 0 && zona === 'embudos';
    const motivo = usos.length ? `en uso: ${usos.join(', ')}`
      : porRuta.length ? `en uso (por ruta): ${porRuta.join(', ')}`
      : zona === 'embudos/chat' ? 'sin dueño, pero es carpeta de chat: NO se propone (observación 6 bis)'
      : zona !== 'embudos' ? `sin dueño en zona de chat (${zona}): NO se propone`
      : 'huérfano: ninguna tabla lo nombra';
    return { bucket: o.bucket, ruta: o.ruta, zona, mb: MB(o.bytes), bytes: o.bytes, propuesto, motivo, solo_en_registro: registro.join(' | ') };
  }).sort((a, b) => Number(b.propuesto) - Number(a.propuesto) || b.bytes - a.bytes);

  const prop = filas.filter((f) => f.propuesto);
  const total = prop.reduce((s, f) => s + f.bytes, 0);
  console.log(`Vídeos en los buckets: ${videos.length}`);
  console.log(`Propuestos (huérfanos de embudos/): ${prop.length} · ${MB(total)} MB`);
  for (const f of prop) console.log(`  ${String(f.mb).padStart(6)} MB  ${f.ruta}`);
  console.log(`No propuestos: ${filas.length - prop.length}`);
  for (const f of filas.filter((x) => !x.propuesto)) console.log(`  ${String(f.mb).padStart(6)} MB  ${f.ruta}  — ${f.motivo}`);
  if (refs.ilegibles.length) {
    console.log(`\nAVISO: cruce incompleto, no se pudieron leer: ${refs.ilegibles.map((t) => t.tabla).join(', ')}`);
  }

  await guardarCsv('a2-videos.csv', filas.map(({ bytes: _b, ...f }) => f));
  await guardarJson('a2-resumen.json', {
    fecha: refs.fecha, tablasLeidas: refs.tablas.length - refs.ilegibles.length, tablasIlegibles: refs.ilegibles.map((t) => t.tabla),
    propuestos: prop.length, mbPropuestos: MB(total),
  });

  if (!EJECUTAR) return;

  // ------------------------------------------------------------ escritura (con visto bueno)
  await exigirRevisionSql(refs);
  await pausaSiEjecuta();

  if (PURGAR) {
    // Segunda fase: borra de `_borrar/` lo que se movió hace 14 días o más.
    const movidos = new Map<string, string>(); // ruta original -> fecha del movimiento
    for (const x of await leerRegistro()) {
      if (x.tipo === 'mover' && typeof x.destino === 'string' && x.destino.startsWith('_borrar/')) movidos.set(x.ruta, x.fecha);
    }
    const enEspera = (await listarBucket('chat-media')).filter((o) => o.ruta.startsWith('_borrar/'));
    for (const o of enEspera) {
      const ruta = o.ruta.slice('_borrar/'.length);
      const fecha = movidos.get(ruta);
      if (!fecha) { console.log(`SE QUEDA (no consta en el registro cuándo se movió): ${o.ruta}`); continue; }
      const dias = (Date.now() - Date.parse(fecha)) / 86_400_000;
      if (dias < DIAS_ESPERA) { console.log(`SE QUEDA (lleva ${dias.toFixed(1)} días; hacen falta ${DIAS_ESPERA}): ${o.ruta}`); continue; }
      // El respaldo es la copia que se bajó al moverlo (sin volver a bajar 226 MB).
      const copia = await copiaLocal({ bucket: o.bucket, ruta });
      if (!copia || copia.bytes !== o.bytes) { console.log(`SE QUEDA (no está su copia local o no cuadra): ${o.ruta}`); continue; }
      await escribirStorage({ tipo: 'borrar', bucket: o.bucket, ruta: o.ruta }, copia);
      console.log(`borrado ${o.ruta}`);
    }
    return;
  }
  for (const f of prop) {
    const copia = await bajar(f);
    if (copia.bytes !== f.bytes) throw new Error(`${f.ruta}: la copia pesa ${copia.bytes} y Storage dice ${f.bytes}. Parado.`);
    await escribirStorage({ tipo: 'mover', bucket: f.bucket, ruta: f.ruta, destino: `_borrar/${f.ruta}` }, copia);
    console.log(`movido a _borrar/: ${f.ruta}`);
  }
}

main().catch(fallar);

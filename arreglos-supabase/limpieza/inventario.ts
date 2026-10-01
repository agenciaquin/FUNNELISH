/**
 * Inventario de solo lectura: qué hay en los tres buckets de quinchat, por zona,
 * cuánto supera su tope y qué columnas de la base nombran archivos de Storage.
 * No escribe nada en Supabase, ni con ni sin `--ejecutar`.
 *
 *   npx tsx arreglos-supabase/limpieza/inventario.ts [--copias <carpeta fuera del repo>]
 *
 * Salidas: `inventario-zonas.csv` y `columnas-con-storage.csv` (aquí, con los
 * teléfonos enmascarados) y `inventario-objetos.json` (solo junto a las copias).
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { COPIAS, MB, cargarReferencias, dondeSeUsa, fallar, guardarCsv, listarTodo, zonaDe } from './comun';

const TOPE: Record<string, number> = { 'foto-web': 250, 'foto-whatsapp': 250, 'foto-entrante': 400 };

async function main() {
  console.log('Inventario (solo lectura)\n');
  const [objetos, refs] = await Promise.all([listarTodo(), cargarReferencias()]);
  console.log(`${objetos.length} objetos · ${refs.tablas.length} tablas leídas · ${refs.porNombre.size} nombres de archivo citados`);

  const zonas = new Map<string, Record<string, number>>();
  const filasObj: Record<string, unknown>[] = [];
  for (const o of objetos) {
    const { zona, tipo } = zonaDe(o);
    const clase = o.mime.startsWith('video/') ? 'video' : o.mime.startsWith('image/') ? 'imagen' : 'otro';
    const usos = dondeSeUsa(refs, o.ruta);
    const k = `${o.bucket}|${zona}|${clase}`;
    const z = zonas.get(k) ?? { archivos: 0, bytes: 0, enUso: 0, bytesEnUso: 0, sobreTope: 0, bytesSobreTope: 0 };
    z.archivos!++; z.bytes! += o.bytes;
    if (usos.length) { z.enUso!++; z.bytesEnUso! += o.bytes; }
    const tope = clase === 'imagen' ? (TOPE[tipo] ?? 250) * 1024 : clase === 'video' ? (zona === 'embudos' ? 4 : 10) * 1048576 : Infinity;
    if (o.bytes > tope) { z.sobreTope!++; z.bytesSobreTope! += o.bytes; }
    zonas.set(k, z);
    filasObj.push({ ...o, zona, tipo, clase, usos });
  }

  const filas = [...zonas.entries()].sort().map(([k, z]) => {
    const [bucket, zona, clase] = k.split('|');
    return { bucket, zona, clase, archivos: z.archivos, mb: MB(z.bytes!), en_uso: z.enUso, mb_en_uso: MB(z.bytesEnUso!),
      sobre_tope: z.sobreTope, mb_sobre_tope: MB(z.bytesSobreTope!) };
  });
  console.table(filas);
  await guardarCsv('inventario-zonas.csv', filas);
  await guardarCsv('columnas-con-storage.csv', refs.columnas.sort((a, b) => b.conStorage - a.conStorage)
    .map((c) => ({ columna: c.columna, filas_con_valor: c.filas, filas_con_url_de_storage: c.conStorage })));
  await mkdir(join(COPIAS, 'listas'), { recursive: true });
  await writeFile(join(COPIAS, 'listas', 'inventario-objetos.json'), JSON.stringify({ fecha: refs.fecha, objetos: filasObj }, null, 1));
  await guardarCsv('tablas-ilegibles.csv', refs.ilegibles.map((t) => ({ tabla: t.tabla, columnas: t.columnas, motivo: t.motivo })));
  if (refs.ilegibles.length) {
    console.log(`\nATENCIÓN: ${refs.ilegibles.length} tablas no se pudieron leer con service_role (el cruce no es completo):`);
    for (const t of refs.ilegibles) console.log(`  ${t.tabla} (${t.columnas.join(', ')})`);
  }
  console.log('\nColumnas con URLs de Storage:');
  for (const c of refs.columnas) console.log(`  ${c.columna.padEnd(40)} ${String(c.conStorage).padStart(6)} de ${c.filas}`);
}

main().catch(fallar);

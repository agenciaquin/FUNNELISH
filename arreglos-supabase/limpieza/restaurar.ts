/**
 * Marcha atrás de A1–A5: vuelve a poner en Storage la copia local del archivo
 * tal como estaba ANTES de tocarlo. Simulacro por defecto: dice qué haría.
 *
 *   npx tsx arreglos-supabase/limpieza/restaurar.ts --tarea a34 [--zona chat-saliente] [--ruta <ruta exacta>]
 *   npx tsx arreglos-supabase/limpieza/restaurar.ts --tarea a5  [--ruta <ruta>]
 *   npx tsx arreglos-supabase/limpieza/restaurar.ts --tarea a2  [--ruta <ruta>]   devuelve de `_borrar/` y recrea lo ya purgado
 *   npx tsx arreglos-supabase/limpieza/restaurar.ts --tarea a1  [--ruta <ruta>]   recrea en `_originales/` lo que A1 borró
 *   … y `--ejecutar` para hacerlo de verdad.
 *
 * Todo sale de las copias locales (`--copias`), nunca de lo que haya en Storage:
 *  - A3/A4 y A5: la lista es la de lo medido (`resultados/`), la copia es la del
 *    original medido (mismo sha256);
 *  - A1 y la purga de A2: lo borrado ya no está en Storage; la lista sale del
 *    registro de ejecuciones (que guarda la ruta relativa de la copia) y, por si
 *    faltara, de las copias que haya en disco.
 * Si el objeto existe, se actualiza (PUT); si se borró, se crea (POST).
 *
 * Se restaura con los bytes, el Content-Type y el `cacheControl` ORIGINALES. Con
 * `--cache-corta` se pone 1 día en vez del original: útil si se duda de que la
 * restauración sea la versión buena (el navegador no se la queda un año).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ARGS, COPIAS, EJECUTAR, argumento, bajarEnMemoria, cabecera, copiaLocal, copiaPorRel, copiasBajo, escribirStorage,
  existe, fallar, leerRegistro, listarBucket, pausaSiEjecuta, segundosDeCache, type Descarga,
} from './comun';
import { existsSync } from 'node:fs';

const TAREA = argumento('--tarea');
const ZONA = argumento('--zona');
const RUTA = argumento('--ruta');
const CACHE_CORTA = ARGS.includes('--cache-corta');

function tipoPorBytes(b: Buffer): string {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png';
  if (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (b.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
  if (b.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  return 'application/octet-stream';
}

/** Vuelve a poner `copia` en `bucket/ruta`: actualiza si existe, crea si se borró. */
async function devolver(bucket: string, ruta: string, copia: Descarga): Promise<void> {
  const datos = await readFile(copia.archivo);
  const estaba = await existe({ bucket, ruta });
  if (estaba && (await bajarEnMemoria({ bucket, ruta })).sha256 === copia.sha256) { console.log(`ya está como el original: ${ruta}`); return; }
  // El Content-Type que tenía (sin `; charset`), y si no se apuntó, el que dicen los bytes.
  const contentType = copia.contentType?.split(';')[0]!.trim() || tipoPorBytes(datos);
  const cache = CACHE_CORTA ? '86400' : segundosDeCache(copia.cacheControl);
  console.log(`${EJECUTAR ? 'restaurado' : 'restauraría'} ${bucket}/${ruta} (${Math.round(datos.length / 1024)} kB, ${contentType}, max-age=${cache}, ${estaba ? 'actualizar' : 'crear'})`);
  if (EJECUTAR) {
    await escribirStorage({ tipo: estaba ? 'sobrescribir' : 'crear', bucket, ruta, datos, contentType, cacheControl: cache }, copia);
  }
}

async function main() {
  cabecera(`Restaurar · ${TAREA ?? '?'}`);
  if (!['a1', 'a2', 'a34', 'a5'].includes(TAREA ?? '')) throw new Error('Falta --tarea a1|a2|a34|a5.');
  const registro = await leerRegistro();

  if (TAREA === 'a2') {
    // 1) Lo que sigue en `_borrar/` vuelve a su ruta (mismo nombre: los enlaces vuelven a funcionar).
    const enEspera = (await listarBucket('chat-media')).filter((o) => o.ruta.startsWith('_borrar/') && (!RUTA || o.ruta === `_borrar/${RUTA}`));
    console.log(`${enEspera.length} archivos en _borrar/`);
    await pausaSiEjecuta();
    for (const o of enEspera) {
      const destino = o.ruta.slice('_borrar/'.length);
      if (await existe({ bucket: o.bucket, ruta: destino })) { console.log(`SALTADO (ya hay un archivo en ${destino}): ${o.ruta}`); continue; }
      const copia = await copiaLocal({ bucket: o.bucket, ruta: destino });
      if (!copia) { console.log(`SALTADO (sin copia local; mover a mano): ${o.ruta}`); continue; }
      console.log(`${EJECUTAR ? 'devuelto' : 'devolvería'} ${o.ruta} -> ${destino}`);
      if (EJECUTAR) await escribirStorage({ tipo: 'mover', bucket: o.bucket, ruta: o.ruta, destino }, copia);
    }
    // 2) Lo ya purgado de `_borrar/`: se recrea en su ruta original desde la copia local.
    const purgados = registro.filter((x) => x.tipo === 'borrar' && String(x.ruta).startsWith('_borrar/')
      && (!RUTA || x.ruta === `_borrar/${RUTA}`));
    console.log(`${purgados.length} purgados en el registro`);
    for (const x of purgados) {
      const copia = await copiaPorRel(x.copia_rel);
      if (!copia || copia.sha256 !== x.copia_sha256) { console.log(`SIN COPIA LOCAL VÁLIDA (no se puede restaurar): ${x.ruta}`); continue; }
      await devolver(x.bucket, String(x.ruta).slice('_borrar/'.length), copia);
    }
    return;
  }

  if (TAREA === 'a1') {
    // Lo que A1 borró, según el registro; y, por si el registro faltara, cualquier copia de `_originales/` en disco.
    const porRuta = new Map<string, Descarga>();
    for (const x of registro.filter((r) => r.tipo === 'borrar' && String(r.ruta).startsWith('_originales/'))) {
      const c = await copiaPorRel(x.copia_rel);
      if (c && c.sha256 === x.copia_sha256) porRuta.set(x.ruta, c);
      else console.log(`SIN COPIA LOCAL VÁLIDA para ${x.ruta}`);
    }
    for (const c of await copiasBajo('chat-media/_originales')) {
      const ruta = c.rel.split('/').slice(1).join('/');
      if (!porRuta.has(ruta)) porRuta.set(ruta, c);
    }
    const lista = [...porRuta].filter(([r]) => !RUTA || r === RUTA);
    console.log(`${lista.length} originales con copia local`);
    await pausaSiEjecuta();
    for (const [ruta, copia] of lista) await devolver('chat-media', ruta, copia);
    return;
  }

  // a34 / a5: lo medido está en resultados/; la copia previa, la del original medido.
  type Medido = { bucket: string; ruta: string; zona?: string; sha256_hoy: string; incluida?: boolean; incluido?: boolean };
  let lista: Medido[] = [];
  if (TAREA === 'a34') {
    const f = join(COPIAS, 'resultados', 'a34.jsonl');
    if (existsSync(f)) {
      const vistos = new Set<string>();
      for (const l of (await readFile(f, 'utf8')).split('\n').filter(Boolean)) {
        const x = JSON.parse(l) as Medido;
        const k = `${x.bucket}/${x.ruta}`;
        if (vistos.has(k)) continue; // la primera medición es la del original
        vistos.add(k);
        if (x.incluida) lista.push(x);
      }
    }
  } else {
    const f = join(COPIAS, 'resultados', 'a5.json');
    if (existsSync(f)) lista = (JSON.parse(await readFile(f, 'utf8')) as Medido[]).filter((x) => x.incluido);
  }
  lista = lista.filter((x) => (!ZONA || x.zona === ZONA) && (!RUTA || x.ruta === RUTA));
  console.log(`${lista.length} archivos candidatos a restaurar`);
  await pausaSiEjecuta();
  for (const x of lista) {
    const copia = await copiaLocal(x, x.sha256_hoy);
    if (!copia) { console.log(`SIN COPIA LOCAL DEL ORIGINAL (no se puede restaurar): ${x.ruta}`); continue; }
    await devolver(x.bucket, x.ruta, copia);
  }
}

main().catch(fallar);

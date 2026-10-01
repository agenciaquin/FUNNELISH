/**
 * A3 / A4 · Recomprimir EN SU SITIO las imágenes que pasan de su tope
 * (`TABLERO-AGENTES.md` §4, `ESTRATEGIA-PESO.md` P22–P24, `LEY-DE-PESO.md` §2).
 *
 *   npx tsx arreglos-supabase/limpieza/a34-recomprimir-imagenes.ts [--copias <dir>] [--zona chat-saliente] [--limite 20]
 *   npx tsx arreglos-supabase/limpieza/a34-recomprimir-imagenes.ts --ejecutar --zona chat-saliente
 *
 * Mismo nombre, mismo bucket: ninguna URL de ninguna tabla cambia, así que
 * ninguna referencia se rompe. Lo que cambia es el contenido (y el
 * Content-Type si un PNG opaco pasa a JPEG, como en la pasada de agosto).
 *
 * Simulacro COMPLETO, no estimación: baja cada candidata, la comprime en local
 * con el compresor real por escalones (`lib/optimizar-imagen-servidor.ts` de la
 * rama `agente/P2-P4-ley-peso`, importado, no copiado) y mide peso y SSIM.
 *
 * Reglas:
 *  - Cada archivo se mide UNA vez, la primera, sobre su original, y la medición
 *    queda en `resultados/a34.jsonl` (solo crece). Relanzar el simulacro no
 *    vuelve a medir lo ya medido ni pisa su `salida/`: si no, tras la fase 1 se
 *    mediría (y se subiría) una segunda compresión de lo ya comprimido (F1).
 *  - Si existe `_originales/<ruta>`, se comprime DESDE ese original y el SSIM se
 *    mide contra él: nada de segunda pasada con pérdida (HALLAZGO-dos-compresores).
 *  - Fuera de la lista: SSIM < 0,95, o que no ahorre, o animada, o que el
 *    compresor falle. Las huérfanas entran, marcadas (ver `medir`).
 *  - Si el compresor no llega a SSIM 0,95, «rescate»: el escalón de la LEY más
 *    ligero que lo conserve (incluidos los de gráfico, q90 con croma 4:4:4).
 *
 * Con `--ejecutar --zona X` (solo con visto bueno, zona por zona):
 *  - no mide nada nuevo: sube exactamente la versión medida (`salida/`);
 *  - antes de cada archivo comprueba qué hay en Storage (sha256): en la fase 1
 *    tiene que estar el original medido; en la fase 2, la versión de la fase 1;
 *  - fase 1 con caché de 1 día; `--fijar-cache` (fase 2, tras la revisión a
 *    ojo) vuelve a subir los mismos bytes con el año de la LEY. Ver `ejecutar()`.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  ARGS, COPIAS, EJECUTAR, KB, MB, SSIM_MINIMO, argumento, bajar, bajarEnMemoria, cabecera, cargarCompresor, cargarReferencias,
  copiaLocal, dondeSeUsa, enCopias, enParalelo, escribirStorage, fallar, guardarCsv, guardarJson, listarTodo, pausaSiEjecuta,
  sharpDeLaApp, ssimImagen, zonaDe, type Objeto, type TipoArchivo,
} from './comun';

const SOLO_ZONA = argumento('--zona');
const LIMITE = Number(argumento('--limite') ?? Infinity);
const RESULTADOS = join(COPIAS, 'resultados', 'a34.jsonl');

/** Dónde vive la versión medida, RELATIVO a --copias (la carpeta se puede mover). */
const salidaRel = (o: { bucket: string; ruta: string }) => ['salida', o.bucket, ...o.ruta.split('/')].join('/');
/** Ruta absoluta de hoy de la versión medida (las mediciones antiguas no tenían `salida_rel`). */
const salidaDe = (r: { bucket: string; ruta: string; salida_rel?: string }) => enCopias(r.salida_rel ?? salidaRel(r));

/** Tipo real por los primeros bytes (el Content-Type declarado a veces miente). */
function tipoPorBytes(b: Buffer): string {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png';
  if (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (b.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
  if (b.subarray(4, 12).toString('ascii').includes('ftypheic') || b.subarray(4, 12).toString('ascii').includes('ftypmif1')) return 'image/heic';
  return 'application/octet-stream';
}

interface Resultado {
  bucket: string; ruta: string; zona: string; tipo: TipoArchivo; en_uso: boolean; usos: string;
  bytes_hoy: number; fuente: 'original' | 'actual'; bytes_fuente: number; cache_control_hoy: string;
  bytes_nuevo: number; escalon: string; content_type_hoy: string; content_type_nuevo: string;
  ssim_nuevo: number | null; ssim_hoy: number | null; cabe: boolean; incluida: boolean; motivo: string;
  sha256_hoy: string;
  /** Ruta absoluta de la versión medida, SOLO informativa. El código usa `salida_rel` (relativa a --copias). */
  salida: string; salida_rel?: string; estado?: string;
}

async function medir(o: Objeto, origenes: Set<string>, usos: string[], comp: Awaited<ReturnType<typeof cargarCompresor>>): Promise<Resultado> {
  const { zona, tipo } = zonaDe(o);
  const base = { bucket: o.bucket, ruta: o.ruta, zona, tipo, en_uso: usos.length > 0, usos: usos.join(' | '), bytes_hoy: o.bytes };
  const hoy = await bajar(o);
  const bufHoy = await readFile(hoy.archivo);
  const ctHoy = tipoPorBytes(bufHoy);

  // ¿Hay original de la pasada de agosto? Solo vale si es la misma imagen (mismas proporciones).
  let fuente: 'original' | 'actual' = 'actual';
  let bufFuente = bufHoy;
  const sharp = sharpDeLaApp();
  if (o.bucket === 'chat-media' && origenes.has(o.ruta)) {
    try {
      const orig = await bajar({ bucket: 'chat-media', ruta: `_originales/${o.ruta}` });
      const bufOrig = await readFile(orig.archivo);
      const [m1, m2] = await Promise.all([sharp(bufOrig, { failOn: 'none' }).metadata(), sharp(bufHoy, { failOn: 'none' }).metadata()]);
      const prop = (m: typeof m1) => (m.autoOrient?.width ?? m.width ?? 1) / (m.autoOrient?.height ?? m.height ?? 1);
      if (Math.abs(prop(m1) / prop(m2) - 1) < 0.02) { fuente = 'original'; bufFuente = bufOrig; }
    } catch { /* original ilegible: se usa el actual */ }
  }
  const ctFuente = tipoPorBytes(bufFuente);
  const vacio = {
    ...base, fuente, bytes_fuente: bufFuente.length, cache_control_hoy: hoy.cacheControl, content_type_hoy: o.mime || ctHoy,
    sha256_hoy: hoy.sha256, bytes_nuevo: o.bytes, escalon: '', content_type_nuevo: '', ssim_nuevo: null, ssim_hoy: null,
    cabe: false, incluida: false, salida: '',
  };

  const meta = await sharp(bufFuente, { failOn: 'none', animated: true }).metadata().catch(() => null);
  if (!meta) return { ...vacio, motivo: 'ilegible para sharp' };
  if ((meta.pages ?? 1) > 1) return { ...vacio, motivo: `animada (${meta.pages} fotogramas): el compresor la aplanaría` };
  if (ctFuente === 'image/gif' || ctFuente === 'image/heic') return { ...vacio, motivo: `formato ${ctFuente}: fuera del compresor` };

  let r = await comp.optimizarImagen(bufFuente, ctFuente, tipo);
  if (r.fallo) return { ...vacio, motivo: 'el compresor falló' };
  let s = await ssimImagen(bufFuente, r.buffer);
  let tipoFinal: TipoArchivo = tipo;
  // RESCATE. El compresor no mide el SSIM (en producción costaría CPU en cada
  // subida): baja escalones hasta caber. Con fotos grandes y con mucho detalle
  // (p. ej. 3264 px) el escalón que cabe ya baja de 0,95 — medido: 1600/q75 da
  // 233 kB y SSIM 0,93. Aquí la LEY manda calidad antes que tope (§1 punto 2 y
  // punto 4: «se guarda la mejor versión»), así que se prueban los mismos
  // escalones de `ley-peso.ts`, con los mismos ajustes de codificación que el
  // compresor, y se queda el MÁS LIGERO que conserve SSIM ≥ 0,95. Incluye los
  // escalones de gráfico con texto (q90, croma 4:4:4): en banners y capturas el
  // croma 4:2:0 ensucia las letras y es lo único que pasa de 0,95.
  if (s < SSIM_MINIMO && !r.contentType.includes('png')) {
    const escalones = [...(comp.PERFILES[tipo].escalones ?? []),
      ...(tipo === 'foto-entrante' ? [] : comp.PERFILES['grafico-texto'].escalones ?? [])];
    let mejor: { buf: Buffer; s: number; nombre: string } | null = null;
    for (const e of escalones) {
      const buf = await sharp(bufFuente, { failOn: 'none' }).rotate()
        .resize({ width: e.lado, height: e.lado, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: e.calidad, mozjpeg: true, chromaSubsampling: e.croma444 ? '4:4:4' : '4:2:0' }).toBuffer();
      if (mejor && buf.length >= mejor.buf.length) continue;
      const se = await ssimImagen(bufFuente, buf);
      if (se >= SSIM_MINIMO) mejor = { buf, s: se, nombre: `${e.lado}/q${e.calidad}${e.croma444 ? '/444' : ''}` };
    }
    if (mejor) {
      tipoFinal = mejor.nombre.endsWith('/444') ? 'grafico-texto' : tipo;
      r = { ...r, buffer: mejor.buf, contentType: 'image/jpeg', ext: 'jpg', optimizada: true, escalon: `rescate ${mejor.nombre}`,
        cumple: mejor.buf.length <= comp.PERFILES[tipoFinal].tope };
      s = mejor.s;
    }
  }
  const ssimHoy = fuente === 'original' ? await ssimImagen(bufFuente, bufHoy) : null;

  // Las huérfanas TAMBIÉN entran: recomprimir con el mismo nombre no rompe ni
  // los enlaces de fuera de la base (campañas ya enviadas, anuncios), y borrarlas
  // es otra decisión (A7). Se marcan con `en_uso: false` para separarlas.
  const ahorra = r.buffer.length < o.bytes;
  const incluida = s >= SSIM_MINIMO && ahorra;
  const motivo = s < SSIM_MINIMO ? `SSIM ${s.toFixed(3)} < 0,95`
    : !ahorra ? 'no ahorra'
    : r.cumple ? (tipoFinal === 'grafico-texto' ? 'cabe como gráfico con texto (400 kB)' : 'cabe')
    : r.escalon?.startsWith('rescate') ? 'no cabe sin bajar de SSIM 0,95: escalón más ligero que conserva la calidad'
    : 'ahorra pero no cabe en el tope ni en el último escalón';

  let salida = '';
  if (incluida) {
    salida = enCopias(salidaRel(o));
    await mkdir(dirname(salida), { recursive: true });
    await writeFile(salida, r.buffer);
  }
  return {
    ...vacio, tipo: tipoFinal, bytes_nuevo: r.buffer.length, escalon: r.escalon ?? (r.optimizada ? '?' : 'original sin tocar'),
    content_type_nuevo: r.contentType, ssim_nuevo: Math.round(s * 10000) / 10000,
    ssim_hoy: ssimHoy == null ? null : Math.round(ssimHoy * 10000) / 10000, cabe: r.cumple, incluida, motivo, salida,
    salida_rel: incluida ? salidaRel(o) : undefined,
  };
}

/**
 * Estado de un archivo ya medido, mirando SOLO el listado (peso) frente a la
 * medición guardada. La medición nunca se rehace: la fuente es siempre la copia
 * del original que se bajó la primera vez.
 */
function estadoDe(r: Resultado, bytesAhora: number | undefined): 'pendiente' | 'sustituida' | 'cambio-fuera' | 'no-existe' {
  if (bytesAhora == null) return 'no-existe';
  if (bytesAhora === r.bytes_hoy) return 'pendiente';
  if (r.incluida && bytesAhora === r.bytes_nuevo) return 'sustituida';
  return 'cambio-fuera';
}

async function main() {
  cabecera('A3 / A4 · Recomprimir imágenes por encima del tope');
  const comp = await cargarCompresor();
  await mkdir(dirname(RESULTADOS), { recursive: true });

  // Registro de mediciones: SOLO CRECE. Una medición por archivo (la primera,
  // hecha sobre el original). Relanzar el simulacro no vuelve a medir lo que ya
  // está aquí, ni pisa su `salida/`: así nunca se mide ni se sube una segunda
  // compresión sobre lo ya comprimido.
  const medidos = new Map<string, Resultado>();
  if (existsSync(RESULTADOS)) {
    for (const l of (await readFile(RESULTADOS, 'utf8')).split('\n').filter(Boolean)) {
      const x = JSON.parse(l) as Resultado;
      const k = `${x.bucket}/${x.ruta}`;
      if (!medidos.has(k)) medidos.set(k, x);
    }
  }
  // Con --ejecutar no se mide nada nuevo: se sube lo que el simulacro midió y se revisó.
  if (EJECUTAR) return ejecutar([...medidos.values()], comp.CACHE_UN_ANO);

  const [objetos, refs] = await Promise.all([listarTodo(), cargarReferencias()]);
  const origenes = new Set(objetos.filter((o) => o.ruta.startsWith('_originales/')).map((o) => o.ruta.slice('_originales/'.length)));
  const pesoAhora = new Map(objetos.map((o) => [`${o.bucket}/${o.ruta}`, o.bytes]));

  const nuevas = objetos.filter((o) => {
    if (!o.mime.startsWith('image/') || o.ruta.startsWith('_originales/') || o.ruta.startsWith('_borrar/')) return false;
    if (medidos.has(`${o.bucket}/${o.ruta}`)) return false; // ya medida: no se vuelve a medir
    const { zona, tipo } = zonaDe(o);
    if (SOLO_ZONA && zona !== SOLO_ZONA) return false;
    return o.bytes > comp.PERFILES[tipo].tope;
  }).sort((a, b) => b.bytes - a.bytes).slice(0, LIMITE);
  const previas = [...medidos.values()].filter((r) => !SOLO_ZONA || r.zona === SOLO_ZONA);
  console.log(`Ya medidas (no se vuelven a medir): ${previas.length} · nuevas candidatas: ${nuevas.length} · ${MB(nuevas.reduce((s, o) => s + o.bytes, 0))} MB`);

  let hechas = 0;
  const t0 = Date.now();
  const medidasHoy = await enParalelo(nuevas, 4, async (o) => {
    const usos = dondeSeUsa(refs, o.ruta);
    let r: Resultado;
    try { r = await medir(o, origenes, usos, comp); }
    catch (e) {
      const { zona, tipo } = zonaDe(o);
      r = { bucket: o.bucket, ruta: o.ruta, zona, tipo, en_uso: usos.length > 0, usos: usos.join(' | '), bytes_hoy: o.bytes,
        fuente: 'actual', bytes_fuente: o.bytes, cache_control_hoy: '', bytes_nuevo: o.bytes, escalon: '', content_type_hoy: o.mime,
        content_type_nuevo: '', ssim_nuevo: null, ssim_hoy: null, cabe: false, incluida: false,
        motivo: `error: ${(e as Error).message.slice(0, 120)}`, sha256_hoy: '', salida: '' };
    }
    // Los errores no se guardan: así se vuelven a intentar en la siguiente pasada.
    if (!r.motivo.startsWith('error')) await appendFile(RESULTADOS, JSON.stringify(r) + '\n');
    if (++hechas % 25 === 0) console.log(`  ${hechas}/${nuevas.length}  (${Math.round((Date.now() - t0) / 1000)} s)`);
    return r;
  });

  // El cruce y el estado son SIEMPRE los de hoy; la medición, la guardada.
  const resultados = [...previas, ...medidasHoy].map((r) => {
    const usos = dondeSeUsa(refs, r.ruta);
    return { ...r, en_uso: usos.length > 0, usos: usos.join(' | '), estado: estadoDe(r, pesoAhora.get(`${r.bucket}/${r.ruta}`)) };
  });
  const estados = new Map<string, number>();
  for (const r of resultados.filter((x) => x.incluida)) estados.set(r.estado, (estados.get(r.estado) ?? 0) + 1);
  console.log(`Estado de las incluidas: ${[...estados].map(([e, n]) => `${e} ${n}`).join(' · ') || '—'}`);
  const fuera = resultados.filter((r) => r.incluida && (r.estado === 'cambio-fuera' || r.estado === 'no-existe'));
  for (const r of fuera) console.log(`  AVISO ${r.estado}: ${r.ruta} (no se tocará)`);

  // ------------------------------------------------------------ resumen
  const porZona = new Map<string, Resultado[]>();
  for (const r of resultados) porZona.set(r.zona, [...(porZona.get(r.zona) ?? []), r]);
  const resumen = [...porZona.entries()].sort().map(([zona, rs]) => {
    const inc = rs.filter((r) => r.incluida);
    const ss = inc.map((r) => r.ssim_nuevo!).filter((x) => x != null);
    const exc = rs.filter((r) => !r.incluida);
    const motivos = new Map<string, number>();
    for (const r of exc) {
      const m = r.motivo.startsWith('SSIM') ? 'SSIM < 0,95' : r.motivo.startsWith('error') ? 'error' : r.motivo.split(':')[0]!;
      motivos.set(m, (motivos.get(m) ?? 0) + 1);
    }
    return {
      zona, candidatas: rs.length, incluidas: inc.length,
      mb_antes: MB(inc.reduce((s, r) => s + r.bytes_hoy, 0)), mb_despues: MB(inc.reduce((s, r) => s + r.bytes_nuevo, 0)),
      ahorro_mb: MB(inc.reduce((s, r) => s + r.bytes_hoy - r.bytes_nuevo, 0)),
      ssim_min: ss.length ? Math.min(...ss).toFixed(3) : '', ssim_medio: ss.length ? (ss.reduce((a, b) => a + b, 0) / ss.length).toFixed(3) : '',
      desde_original: inc.filter((r) => r.fuente === 'original').length,
      no_caben: inc.filter((r) => !r.cabe).length, graficos: inc.filter((r) => r.tipo === 'grafico-texto').length,
      huerfanas: inc.filter((r) => !r.en_uso).length, ahorro_mb_huerfanas: MB(inc.filter((r) => !r.en_uso).reduce((s, r) => s + r.bytes_hoy - r.bytes_nuevo, 0)),
      excluidas: exc.length, mb_excluidas: MB(exc.reduce((s, r) => s + r.bytes_hoy, 0)),
      motivos_exclusion: [...motivos.entries()].map(([m, n]) => `${m}: ${n}`).join(' | '),
      cache_1_ano: inc.filter((r) => r.cache_control_hoy.includes('31536000')).length,
    };
  });
  console.table(resumen.map(({ motivos_exclusion: _m, ...r }) => r));
  for (const r of resumen) if (r.motivos_exclusion) console.log(`  ${r.zona}: ${r.motivos_exclusion}`);

  if (!SOLO_ZONA && LIMITE === Infinity) {
    await guardarCsv('a34-resumen.csv', resumen);
    await guardarCsv('a34-imagenes.csv', resultados.map((r) => ({
      incluida: r.incluida, estado: r.estado, zona: r.zona, bucket: r.bucket, ruta: r.ruta, tipo: r.tipo, fuente: r.fuente,
      kb_hoy: KB(r.bytes_hoy), kb_nuevo: KB(r.bytes_nuevo), escalon: r.escalon, ssim_nuevo: r.ssim_nuevo, ssim_hoy: r.ssim_hoy,
      cabe: r.cabe, ct_hoy: r.content_type_hoy, ct_nuevo: r.content_type_nuevo, cache_hoy: r.cache_control_hoy, motivo: r.motivo, usos: r.usos,
    })));
    await guardarJson('a34-resumen.json', { fecha: refs.fecha, tablasIlegibles: refs.ilegibles.map((t) => t.tabla), resumen });
  }
}

/**
 * Escritura, con visto bueno y zona a zona. Trabaja SOLO sobre lo que midió el
 * simulacro (`resultados/a34.jsonl`): lo que no se midió y se revisó, no se sube.
 *
 * Dos fases, por la caché del navegador. Un archivo servido con 1 año de caché
 * se queda un año en el móvil del cliente AUNQUE luego se restaure el original.
 * Por eso:
 *   fase 1 (`--ejecutar --zona X`): se sube la versión nueva con caché de 1 día,
 *           SOLO si en Storage sigue el original (el sha256 medido). Lo que ya
 *           está en fase 1 no vuelve a entrar;
 *   fase 2 (`--ejecutar --zona X --fijar-cache`), tras la revisión a ojo: se
 *           vuelven a subir los MISMOS bytes con el año de la LEY, solo si en
 *           Storage está la versión de la fase 1.
 * Todo lo que se salta se dice, con su motivo.
 */
async function ejecutar(medidos: Resultado[], cacheUnAno: string): Promise<void> {
  if (!SOLO_ZONA) throw new Error('--ejecutar exige --zona: se aprueba y se ejecuta zona por zona.');
  const fijar = ARGS.includes('--fijar-cache');
  const lista = medidos.filter((r) => r.incluida && r.zona === SOLO_ZONA);
  console.log(`${fijar ? 'FASE 2 (fijar 1 año de caché)' : 'FASE 1 (caché de 1 día)'} · ${lista.length} archivos de ${SOLO_ZONA}`);
  await pausaSiEjecuta();
  let hechos = 0;
  for (const r of lista) {
    const salida = salidaDe(r);
    if (!existsSync(salida)) { console.log(`SALTADA (falta la versión medida en ${salida}): ${r.ruta}`); continue; }
    const datos = await readFile(salida);
    const shaNuevo = createHash('sha256').update(datos).digest('hex');
    // El respaldo es SIEMPRE la copia del original tal como estaba al medir (sin red).
    const respaldo = await copiaLocal(r, r.sha256_hoy);
    if (!respaldo) { console.log(`SALTADA (no está la copia local del original): ${r.ruta}`); continue; }
    // Comprobación fresca justo antes de escribir: qué hay AHORA en Storage.
    const ahora = await bajarEnMemoria(r);
    if (!fijar && ahora.sha256 === shaNuevo) { console.log(`ya en fase 1 (no se vuelve a subir): ${r.ruta}`); continue; }
    if (ahora.sha256 !== (fijar ? shaNuevo : r.sha256_hoy)) {
      console.log(`SALTADA (en Storage no está ${fijar ? 'la versión de la fase 1' : 'el original medido'}): ${r.ruta}`);
      continue;
    }
    await escribirStorage({ tipo: 'sobrescribir', bucket: r.bucket, ruta: r.ruta, datos, contentType: r.content_type_nuevo,
      cacheControl: fijar ? cacheUnAno : '86400' }, respaldo);
    hechos++;
    console.log(`${fijar ? 'caché fijada' : 'sustituida'} ${r.ruta}  ${KB(r.bytes_hoy)} -> ${KB(r.bytes_nuevo)} kB`);
  }
  console.log(`Escritos: ${hechos} de ${lista.length}`);
}

main().catch(fallar);

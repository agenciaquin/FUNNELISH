/**
 * A5 · Recomprimir EN SU SITIO los vídeos EN USO que pasan de su tope
 * (`TABLERO-AGENTES.md` §4, `ESTRATEGIA-PESO.md` P25 y P27, `LEY-DE-PESO.md` §2).
 *
 *   npx tsx arreglos-supabase/limpieza/a5-recomprimir-videos.ts [--copias <dir>] [--ffmpeg <ruta>]
 *   npx tsx arreglos-supabase/limpieza/a5-recomprimir-videos.ts --ejecutar [--d5] [--fijar-cache]
 *
 * Topes: vídeo de landing 4 MB **y** como mucho 2 Mb/s; vídeo de chat 10 MB.
 * Solo los vídeos que nombra alguna tabla (los huérfanos son A2: se borran, no
 * se comprimen). En cada ejecución, también con `--ejecutar`, se vuelve a cruzar.
 * Cada vídeo se mide una vez, sobre su original, y la medición queda en
 * `resultados/a5.json`, que solo crece (ver `leerMedidos`).
 *
 * Escalones (H.264, lado corto 720 sin agrandar, `+faststart`, AAC 96 kb/s si
 * hay audio: el reproductor de la landing tiene botón de sonido y WhatsApp
 * exige AAC):
 *   landing: CRF 26 → 24 → 22, siempre con `-maxrate 1800k` (con el audio queda
 *            por debajo de 2 Mb/s); el primero con SSIM ≥ 0,95 que cumpla peso y
 *            velocidad. Si ninguno, se queda fuera.
 *   chat:    CRF 26 → 28 (solo si 26 no cabe en 10 MB).
 * SSIM con `ffmpeg -lavfi ssim`, a la resolución de salida (como MEDICION-TOPES §2).
 *
 * `embudos/chat/` es historial de conversaciones de clientes: aunque se mida,
 * `--ejecutar` no lo toca sin `--d5` (decisión D5 de `ESTRATEGIA-PESO.md` §7).
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  ARGS, COPIAS, EJECUTAR, MB, SSIM_MINIMO, argumento, bajar, bajarEnMemoria, cabecera, cargarCompresor, copiaLocal, enCopias, fallar,
  cargarReferencias, dondeSeUsa, escribirStorage, guardarCsv, guardarJson, listarTodo, pausaSiEjecuta, zonaDe,
} from './comun';

const D5 = ARGS.includes('--d5');
const RESULTADOS = join(COPIAS, 'resultados', 'a5.json');
const FFMPEG = argumento('--ffmpeg') ?? process.env.FFMPEG_PATH
  ?? 'C:/Users/Tati/AppData/Local/Temp/claude/D--PROYECTO-IA-FUNNELISH/729bd79f-ccde-4f87-9305-376527c1bb11/scratchpad/medicion/node_modules/ffmpeg-static/ffmpeg.exe';

function ffmpeg(args: string[]): Promise<string> {
  return new Promise((ok, mal) => {
    const p = spawn(FFMPEG, ['-hide_banner', ...args]);
    let err = '';
    p.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    p.on('error', mal);
    p.on('close', (c: number) => (c === 0 ? ok(err) : mal(new Error(`ffmpeg ${c}: ${err.slice(-300)}`))));
  });
}

interface Info { duracion: number; ancho: number; alto: number; audio: boolean; codec: string }
function info(archivo: string): Info {
  const t = spawnSync(FFMPEG, ['-hide_banner', '-i', archivo], { encoding: 'utf8' }).stderr ?? '';
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(t);
  const v = /Stream #[^\n]*Video: (\w+)[^\n]*?, (\d{2,5})x(\d{2,5})/.exec(t);
  let ancho = v ? Number(v[2]) : 0, alto = v ? Number(v[3]) : 0;
  if (/rotation of -?90/.test(t)) [ancho, alto] = [alto, ancho];
  return { duracion: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0, ancho, alto,
    audio: /Stream #[^\n]*Audio:/.test(t), codec: v?.[1] ?? '?' };
}

async function ssimVideo(codificado: string, original: string, w: number, h: number): Promise<number | null> {
  const s = await ffmpeg(['-i', codificado, '-i', original, '-lavfi',
    `[1:v]scale=${w}:${h}:flags=bicubic,setsar=1[ref];[0:v]setsar=1[enc];[enc][ref]ssim`, '-f', 'null', '-']);
  const m = /SSIM Y:([\d.]+)/.exec(s);
  return m ? Number(m[1]) : null;
}

interface Paso { nombre: string; crf: number; maxrate?: string; dosPasadas?: string }
const PASOS_LANDING: Paso[] = [
  { nombre: 'CRF 26 ≤1,8M', crf: 26, maxrate: '1800k' },
  { nombre: 'CRF 24 ≤1,8M', crf: 24, maxrate: '1800k' },
  { nombre: 'CRF 22 ≤1,8M', crf: 22, maxrate: '1800k' },
  // Último recurso para vídeos con mucho movimiento: con el techo de 2 Mb/s el CRF
  // no llega a 0,95 (spiderman-tend: 0,946). Dos pasadas a 1,9 Mb/s reparten mejor
  // los bits: medido 3,45 MB, 1,97 Mb/s y SSIM 0,9505 (justo).
  { nombre: '2 pasadas 1,9M slow', crf: 0, dosPasadas: '1900k' },
];
const PASOS_CHAT: Paso[] = [{ nombre: 'CRF 26', crf: 26 }, { nombre: 'CRF 28', crf: 28 }];

/** Una medición guardada en `resultados/a5.json`. */
interface Medido {
  bucket: string; ruta: string; zona: string; uso: string; usos: string; bytes_hoy: number; sha256_hoy: string;
  mb_hoy: number; mbps_hoy: number; resolucion: string; segundos: number; codec: string;
  incluido: boolean; motivo: string; mb_nuevo: number | ''; bytes_nuevo?: number; paso: string; ssim: string; mbps_nuevo?: string;
  intentos?: string; fecha_medida?: string;
  /** Ruta absoluta de la versión medida, SOLO informativa. El código usa `salida_rel` (relativa a --copias). */
  salida: string; salida_rel?: string;
}

const salidaRel = (o: { bucket: string; ruta: string }) => ['salida', o.bucket, ...o.ruta.split('/')].join('/');
const salidaDe = (m: { bucket: string; ruta: string; salida_rel?: string }) => enCopias(m.salida_rel ?? salidaRel(m));

/**
 * `resultados/a5.json` es un REGISTRO QUE SOLO CRECE: una medición por vídeo, la
 * primera (sobre el original). Relanzar el simulacro no la quita ni la rehace
 * aunque el vídeo ya esté sustituido y hoy cumpla el tope; si no, la fase 2 y la
 * marcha atrás se quedaban sin lista (F2).
 */
async function leerMedidos(): Promise<Map<string, Medido>> {
  const m = new Map<string, Medido>();
  if (!existsSync(RESULTADOS)) return m;
  for (const x of JSON.parse(await readFile(RESULTADOS, 'utf8')) as Medido[]) {
    const k = `${x.bucket}/${x.ruta}`;
    // Mediciones del 30-09 (antes de este registro): sin `bytes_nuevo`; sale del archivo medido.
    if (x.incluido && x.bytes_nuevo == null && existsSync(salidaDe(x))) x.bytes_nuevo = (await stat(salidaDe(x))).size;
    if (!m.has(k)) m.set(k, x);
  }
  return m;
}

async function main() {
  cabecera('A5 · Recomprimir vídeos en uso');
  if (!existsSync(FFMPEG)) throw new Error(`No encuentro ffmpeg en ${FFMPEG} (usa --ffmpeg o FFMPEG_PATH).`);
  await mkdir(dirname(RESULTADOS), { recursive: true });
  const { PERFILES, CACHE_UN_ANO } = await cargarCompresor();
  const medidos = await leerMedidos();
  const [objetos, refs] = await Promise.all([listarTodo(), cargarReferencias()]);
  // Con --ejecutar no se mide nada nuevo, pero el cruce SÍ se rehace (ver `ejecutar`).
  if (EJECUTAR) return ejecutar([...medidos.values()], refs, CACHE_UN_ANO);

  const enUso = objetos.filter((o) => o.mime.startsWith('video/') && !o.ruta.startsWith('_originales/') && !o.ruta.startsWith('_borrar/'))
    .map((o) => ({ o, usos: dondeSeUsa(refs, o.ruta) })).filter((x) => x.usos.length > 0);
  const pesoAhora = new Map(objetos.map((o) => [`${o.bucket}/${o.ruta}`, o.bytes]));

  const filas: (Medido & { estado: string })[] = [];
  for (const { o, usos } of enUso) {
    const k = `${o.bucket}/${o.ruta}`;
    const previo = medidos.get(k);
    if (previo) {
      // Ya medido: no se vuelve a medir. Solo se dice en qué estado está.
      const estado = o.bytes === previo.bytes_hoy ? 'pendiente'
        : previo.incluido && o.bytes === previo.bytes_nuevo ? 'sustituido' : 'cambio-fuera';
      filas.push({ ...previo, usos: usos.join(' | '), estado });
      continue;
    }
    const { zona } = zonaDe(o);
    // De landing si lo nombra cualquier tabla que no sea el chat; si no, de chat.
    const deLanding = usos.some((u) => !u.startsWith('messages.'));
    const perfil = deLanding ? PERFILES['video-landing'] : PERFILES['video-chat'];
    const copia = await bajar(o);
    const i = info(copia.archivo);
    const bps = i.duracion ? (o.bytes * 8) / i.duracion : 0;
    const sobre = o.bytes > perfil.tope || (perfil.bitrateMax != null && bps > perfil.bitrateMax);
    const base = { bucket: o.bucket, zona, ruta: o.ruta, uso: deLanding ? 'landing' : 'chat', usos: usos.join(' | '), mb_hoy: MB(o.bytes),
      bytes_hoy: o.bytes, sha256_hoy: copia.sha256, mbps_hoy: Math.round(bps / 1e4) / 100, resolucion: `${i.ancho}x${i.alto}`,
      segundos: Math.round(i.duracion), codec: i.codec, fecha_medida: new Date().toISOString() };
    if (!sobre) {
      // No se guarda: si algún día pasa del tope, se medirá entonces.
      filas.push({ ...base, incluido: false, motivo: 'ya cumple el tope', mb_nuevo: '', paso: '', ssim: '', salida: '', estado: 'no-hace-falta' });
      continue;
    }

    const salida = enCopias(salidaRel(o));
    await mkdir(dirname(salida), { recursive: true });
    let elegido: { paso: string; bytes: number; ssim: number; bps: number } | null = null;
    const intentos: string[] = [];
    for (const p of deLanding ? PASOS_LANDING : PASOS_CHAT) {
      const tmp = `${salida}.${p.dosPasadas ? `2p${p.dosPasadas}` : p.crf}.mp4`;
      const escala = "scale='if(gte(iw,ih),-2,min(720,iw))':'if(gte(iw,ih),min(720,ih),-2)',fps=fps='min(source_fps,30)'";
      if (!existsSync(tmp) && p.dosPasadas) {
        const log = `${salida}.2p`;
        await ffmpeg(['-i', copia.archivo, '-an', '-vf', escala, '-c:v', 'libx264', '-preset', 'slow', '-b:v', p.dosPasadas,
          '-pass', '1', '-passlogfile', log, '-f', 'mp4', '-y', process.platform === 'win32' ? 'NUL' : '/dev/null']);
        await ffmpeg(['-i', copia.archivo, '-vf', escala, '-c:v', 'libx264', '-preset', 'slow', '-b:v', p.dosPasadas,
          '-pass', '2', '-passlogfile', log, '-profile:v', 'main', '-pix_fmt', 'yuv420p',
          ...(i.audio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']), '-movflags', '+faststart', '-y', tmp]);
      } else if (!existsSync(tmp)) {
        await ffmpeg(['-i', copia.archivo, '-vf', escala,
          '-c:v', 'libx264', '-preset', 'medium', '-crf', String(p.crf), ...(p.maxrate ? ['-maxrate', p.maxrate, '-bufsize', `${parseInt(p.maxrate) * 2}k`] : []),
          '-profile:v', 'main', '-pix_fmt', 'yuv420p', ...(i.audio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']),
          '-movflags', '+faststart', '-y', tmp]);
      }
      const bytes = (await stat(tmp)).size;
      const j = info(tmp);
      const s = await ssimVideo(tmp, copia.archivo, j.ancho, j.alto);
      const b = j.duracion ? (bytes * 8) / j.duracion : 0;
      intentos.push(`${p.nombre}: ${MB(bytes)} MB, ${(b / 1e6).toFixed(2)} Mb/s, SSIM ${s?.toFixed(3)}`);
      const cumple = bytes <= perfil.tope && (perfil.bitrateMax == null || b <= perfil.bitrateMax);
      if (s != null && s >= SSIM_MINIMO && cumple && bytes < o.bytes) { elegido = { paso: p.nombre, bytes, ssim: s, bps: b }; await copiar(tmp, salida); break; }
    }
    console.log(`${o.ruta}\n   ${intentos.join('\n   ')}`);
    const m: Medido = {
      ...base, incluido: !!elegido, motivo: elegido ? (zona === 'embudos/chat' ? 'cumple · necesita D5 (historial de clientes)' : 'cumple')
        : 'ningún escalón da SSIM ≥ 0,95 dentro del tope', mb_nuevo: elegido ? MB(elegido.bytes) : '', bytes_nuevo: elegido?.bytes,
      paso: elegido?.paso ?? '', ssim: elegido ? elegido.ssim.toFixed(3) : '', mbps_nuevo: elegido ? (elegido.bps / 1e6).toFixed(2) : '',
      intentos: intentos.join(' ; '), salida: elegido ? salida : '', salida_rel: elegido ? salidaRel(o) : undefined,
    };
    medidos.set(`${o.bucket}/${o.ruta}`, m);
    filas.push({ ...m, estado: 'pendiente' });
  }
  // Lo medido otro día que hoy no aparece como «en uso» se sigue listando: no se pierde.
  for (const m of medidos.values()) {
    if (!filas.some((f) => f.bucket === m.bucket && f.ruta === m.ruta)) {
      filas.push({ ...m, estado: pesoAhora.has(`${m.bucket}/${m.ruta}`) ? 'ya-no-en-uso' : 'no-existe' });
    }
  }
  console.table(filas.map((f) => ({ ruta: String(f.ruta).slice(-40), uso: f.uso, mb_hoy: f.mb_hoy, mb_nuevo: f.mb_nuevo, ssim: f.ssim, estado: f.estado, motivo: f.motivo })));
  const inc = filas.filter((f) => f.incluido);
  const resumen = {
    fecha: refs.fecha, tablasIlegibles: refs.ilegibles.map((t) => t.tabla),
    enUso: enUso.length, sobreTope: filas.filter((f) => f.motivo !== 'ya cumple el tope').length, incluidos: inc.length,
    mbAntes: MB(inc.reduce((s, f) => s + Number(f.mb_hoy) * 1048576, 0)), mbDespues: MB(inc.reduce((s, f) => s + Number(f.mb_nuevo) * 1048576, 0)),
  };
  console.log(resumen);
  await guardarCsv('a5-videos.csv', filas.map(({ sha256_hoy: _s, salida: _x, salida_rel: _r, bytes_hoy: _b, bytes_nuevo: _n, fecha_medida: _f, ...f }) => f));
  await guardarJson('a5-resumen.json', resumen);
  // Se escribe la unión de lo que había y lo nuevo: nunca se quita nada.
  await writeFile(RESULTADOS, JSON.stringify([...medidos.values()], null, 1));
}

/**
 * Escritura, con visto bueno. Sube SOLO lo que midió el simulacro
 * (`resultados/a5.json`), en dos fases de caché como A3/A4: fase 1 con 1 día,
 * solo si en Storage sigue el original; `--fijar-cache` (tras verlo en un
 * móvil) vuelve a subir los mismos bytes con 1 año, solo si está la versión de
 * la fase 1. El cruce se rehace: un vídeo que hoy no nombra ninguna tabla no se
 * toca (pasa a ser cosa de A2). Mejor de madrugada: un navegador que está a
 * mitad de un vídeo pide trozos (`Range`) y, si el archivo cambia entre dos
 * trozos, el vídeo se corta.
 */
async function ejecutar(medidos: Medido[], refs: Awaited<ReturnType<typeof cargarReferencias>>, cacheUnAno: string): Promise<void> {
  if (!medidos.length) throw new Error('No hay simulacro guardado (resultados/a5.json): lánzalo antes sin --ejecutar.');
  const fijar = ARGS.includes('--fijar-cache');
  const lista = medidos.filter((m) => m.incluido);
  console.log(`${fijar ? 'FASE 2 (fijar 1 año de caché)' : 'FASE 1 (caché de 1 día)'} · ${lista.length} vídeos`);
  await pausaSiEjecuta();
  let hechos = 0;
  for (const f of lista) {
    if (f.zona === 'embudos/chat' && !D5) { console.log(`SALTADO (falta --d5, historial de clientes): ${f.ruta}`); continue; }
    if (!dondeSeUsa(refs, f.ruta).length) { console.log(`SALTADO (hoy ninguna tabla lo nombra: es cosa de A2): ${f.ruta}`); continue; }
    const salida = salidaDe(f);
    if (!existsSync(salida)) { console.log(`SALTADO (falta la versión medida en ${salida}): ${f.ruta}`); continue; }
    const datos = await readFile(salida);
    const shaNuevo = createHash('sha256').update(datos).digest('hex');
    const respaldo = await copiaLocal(f, f.sha256_hoy);
    if (!respaldo) { console.log(`SALTADO (no está la copia local del original): ${f.ruta}`); continue; }
    const ahora = await bajarEnMemoria(f);
    if (!fijar && ahora.sha256 === shaNuevo) { console.log(`ya en fase 1 (no se vuelve a subir): ${f.ruta}`); continue; }
    if (ahora.sha256 !== (fijar ? shaNuevo : f.sha256_hoy)) {
      console.log(`SALTADO (en Storage no está ${fijar ? 'la versión de la fase 1' : 'el original medido'}): ${f.ruta}`);
      continue;
    }
    await escribirStorage({ tipo: 'sobrescribir', bucket: f.bucket, ruta: f.ruta, datos, contentType: 'video/mp4',
      cacheControl: fijar ? cacheUnAno : '86400' }, respaldo);
    hechos++;
    console.log(`${fijar ? 'caché fijada' : 'sustituido'} ${f.ruta}`);
  }
  console.log(`Escritos: ${hechos} de ${lista.length}`);
}

async function copiar(de: string, a: string) {
  await writeFile(a, await readFile(de));
}

main().catch(fallar);

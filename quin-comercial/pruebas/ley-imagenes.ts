/**
 * PRUEBA DE LA LEY DE IMÁGENES  (CLAUDE.md, "LEY · Toda imagen que se suba se comprime")
 *
 * Recorre TODO el código de la app (app/, lib/, components/, middleware.ts) y encuentra cada punto que
 * escribe archivos al almacenamiento (Supabase Storage o R2). Para cada uno decide si cumple la ley:
 *
 *   1. El cuerpo que se sube sale de `optimizarImagen` (lib/optimizar-imagen-servidor.ts), o el punto está
 *      dentro de un módulo de subida único permitido (p. ej. lib/subir-archivo.ts) que la use.
 *   2. Se sube con `cacheControl: CACHE_UN_ANO`.
 *   3. No hay subidas directas desde el navegador (URL firmada, PUT a R2, `.upload` con la clave anónima):
 *      "la garantía es el servidor".
 *
 * Además comprueba, importando el código REAL (no una copia):
 *   - que `lib/optimizar-imagen-servidor.ts` existe, exporta `optimizarImagen` y `CACHE_UN_ANO === '31536000'`
 *     (es la marca que se vigila en la base: metadata->>'cacheControl' = 'max-age=31536000');
 *   - que `next.config.ts` lleva `./node_modules/@img/**` en outputFileTracingIncludes (punto 6 de la ley).
 *
 * Es una prueba ESTÁTICA: lee archivos, no ejecuta rutas, no toca red ni bases.
 * El mismo archivo vive en quinchat/pruebas y quin-comercial/pruebas; se ubica por __dirname.
 *
 *   cd quinchat       && npx tsx pruebas/ley-imagenes.ts
 *   cd quin-comercial && npx tsx pruebas/ley-imagenes.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { pathToFileURL } from 'url';

// ════════════════════════════════════════════════════════════════════════════════════════════════
// CRITERIO CONFIGURABLE  — ajustar aquí cuando el punto único (DISENO-LEY-IMAGENES.md) quede decidido
// ════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Módulos de subida únicos. Un punto de subida DENTRO de uno de estos archivos cumple si el archivo importa
 * `optimizarImagen` y `CACHE_UN_ANO` del compresor (se permite que comprima solo si es imagen).
 * Las llamadas a sus funciones desde otros archivos no son puntos de subida: no se cuentan.
 */
const MODULOS_SUBIDA_PERMITIDOS: string[] = [
  'lib/subir-archivo.ts',
];

/**
 * Si es true, toda subida FUERA de MODULOS_SUBIDA_PERMITIDOS falla aunque comprima en línea.
 * Ponerlo en true cuando exista lib/subir-archivo.ts y la dirección decida que es el único camino.
 */
const EXIGIR_PUNTO_UNICO = false;

/**
 * Primitivas de transporte: archivos que IMPLEMENTAN la escritura (firmar un PUT a R2, etc.).
 * Sus escrituras internas no se cuentan como punto; se cuentan las LLAMADAS a sus funciones
 * (ver LLAMADAS_A_PRIMITIVAS), que es donde se decide qué bytes se suben.
 */
const PRIMITIVAS: string[] = [
  'lib/r2.ts',
];

/**
 * Excepciones justificadas: puntos que NO suben imágenes. Solo valen si el archivo sigue conteniendo
 * `guarda` (la validación de servidor que impide que entre una imagen). Si alguien quita la validación,
 * la excepción deja de aplicar y la prueba falla sola.
 * `contiene` (opcional) restringe la excepción a los puntos cuya línea incluya ese texto.
 */
const EXCEPCIONES: { archivo: string; contiene?: string; guarda: RegExp; motivo: string }[] = [
  {
    archivo: 'app/api/funnels/audio/route.ts',
    guarda: /if\s*\(\s*!file\.type\.startsWith\('audio\/'\)\s*\)/,
    motivo: 'solo audio: el servidor rechaza todo lo que no sea audio/* (400)',
  },
  {
    archivo: 'app/api/funnels/video/route.ts',
    guarda: /if\s*\(\s*!file\.type\.startsWith\('video\/'\)\s*\)/,
    motivo: 'solo vídeo: el servidor rechaza todo lo que no sea video/* (400); sharp no recodifica vídeo',
  },
];

/** Carpetas y archivos que se recorren (relativos a la raíz de la app). */
const RAICES = ['app', 'lib', 'components', 'middleware.ts'];
const EXCLUIR = new Set(['node_modules', '.next', 'pruebas', '_to_delete']);
const EXTENSIONES = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

// ════════════════════════════════════════════════════════════════════════════════════════════════

const RAIZ = join(__dirname, '..');
const APP = RAIZ.split(sep).pop();

type Tipo =
  | 'upload'              // supabase.storage.from(b).upload(ruta, cuerpo, opciones)
  | 'storage-update'      // supabase.storage.from(b).update(ruta, cuerpo, opciones) — reemplaza el archivo
  | 'storage-copy'        // .copy / .move dentro del storage
  | 'signed-upload-url'   // createSignedUploadUrl: el navegador subirá sin pasar por el servidor
  | 'upload-signed'       // uploadToSignedUrl: subida directa desde el navegador
  | 'r2-presign'          // r2PresignPut: URL para que otro suba a R2 sin pasar por el servidor
  | 'r2-subir'            // r2Subir(key, cuerpo, tipo): sube a R2 desde el servidor
  | 'put-binario'         // fetch(..., { method: 'PUT', body: <no JSON> }) — PUT de archivo a R2/S3
  | 's3-sdk'              // PutObjectCommand / Upload del SDK de AWS
  | 'storage-rest';       // fetch directo a /storage/v1/object

interface Punto { archivo: string; linea: number; tipo: Tipo; texto: string; args: string[] }

// ── Recorrido ───────────────────────────────────────────────────────────────────────────────────
function listar(dir: string, fuera: string[] = []): string[] {
  if (!existsSync(dir)) return fuera;
  if (statSync(dir).isFile()) { if (EXTENSIONES.test(dir)) fuera.push(dir); return fuera; }
  for (const n of readdirSync(dir)) {
    if (EXCLUIR.has(n)) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) listar(p, fuera);
    else if (EXTENSIONES.test(n)) fuera.push(p);
  }
  return fuera;
}

const rel = (abs: string) => relative(RAIZ, abs).split(sep).join('/');

/** Línea (1-based) de un índice del texto. */
function lineaDe(texto: string, idx: number): number {
  let n = 1;
  for (let i = 0; i < idx; i++) if (texto.charCodeAt(i) === 10) n++;
  return n;
}

/** ¿El índice cae dentro de un comentario // o de un bloque /* ... *\/ ? (aproximado, suficiente aquí) */
function enComentario(texto: string, idx: number): boolean {
  const ini = texto.lastIndexOf('\n', idx) + 1;
  const antes = texto.slice(ini, idx);
  if (/^\s*(\/\/|\*|\/\*)/.test(antes) || antes.includes('//')) return true;
  const abre = texto.lastIndexOf('/*', idx);
  return abre !== -1 && texto.lastIndexOf('*/', idx) < abre;
}

/** Parte los argumentos de la llamada cuyo '(' está en `abre`. Respeta anidación y cadenas. */
function argumentos(texto: string, abre: number): string[] {
  const args: string[] = [];
  let prof = 0, actual = '', cadena: string | null = null;
  for (let i = abre + 1; i < texto.length; i++) {
    const c = texto[i];
    if (cadena) { actual += c; if (c === '\\') { actual += texto[++i]; continue; } if (c === cadena) cadena = null; continue; }
    if (c === '"' || c === "'" || c === '`') { cadena = c; actual += c; continue; }
    if (c === '(' || c === '[' || c === '{') prof++;
    if (c === ')' || c === ']' || c === '}') {
      if (prof === 0) { if (actual.trim()) args.push(actual.trim()); return args; }
      prof--;
    }
    if (c === ',' && prof === 0) { args.push(actual.trim()); actual = ''; continue; }
    actual += c;
  }
  return args;
}

const DETECTORES: { tipo: Tipo; re: RegExp }[] = [
  { tipo: 'upload',            re: /\.upload\s*\(/g },
  { tipo: 'storage-update',    re: /storage\s*\.\s*from\s*\([^)]*\)\s*\.\s*update\s*\(/g },
  { tipo: 'storage-copy',      re: /storage\s*\.\s*from\s*\([^)]*\)\s*\.\s*(copy|move)\s*\(/g },
  { tipo: 'signed-upload-url', re: /\bcreateSignedUploadUrl\s*\(/g },
  { tipo: 'upload-signed',     re: /\.uploadToSignedUrl\s*\(/g },
  { tipo: 'r2-presign',        re: /\br2PresignPut\s*\(/g },
  { tipo: 'r2-subir',          re: /\br2Subir\s*\(/g },
  { tipo: 's3-sdk',            re: /\bnew\s+(PutObjectCommand|Upload|CreateMultipartUploadCommand|UploadPartCommand)\s*\(/g },
  // solo escritura REST (/object/<bucket>/...); las URLs públicas de LECTURA (/object/public/...) no cuentan
  { tipo: 'storage-rest',      re: /\/storage\/v1\/object\/(?!public\/|sign\/|authenticated\/|info\/|list\/)/g },
];

/** fetch(..., { method: 'PUT', ... body: X }) donde X no es JSON → escritura de un archivo. */
function putsBinarios(texto: string): { idx: number; cuerpo: string }[] {
  const out: { idx: number; cuerpo: string }[] = [];
  const re = /method\s*:\s*['"]PUT['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const abre = texto.lastIndexOf('{', m.index);
    const trozo = texto.slice(abre, m.index + 400);
    const b = /\bbody\s*:\s*([^,}\n]+)/.exec(trozo);
    if (!b) continue;
    const cuerpo = b[1].trim();
    if (/^JSON\.stringify/.test(cuerpo) || /^payload$|^body$/.test(cuerpo) && /JSON\.stringify/.test(texto.slice(abre - 400, abre))) continue;
    out.push({ idx: m.index, cuerpo });
  }
  return out;
}

// Funciones de "definición" que no son llamadas: `export function r2Subir(`, `async function r2PresignPut(`.
const esDefinicion = (texto: string, idx: number) => /function\s+$/.test(texto.slice(Math.max(0, idx - 20), idx));

function encontrarPuntos(): { puntos: Punto[]; primitivas: Punto[] } {
  const archivos = RAICES.flatMap(r => listar(join(RAIZ, r)));
  const puntos: Punto[] = [], primitivas: Punto[] = [];
  for (const abs of archivos) {
    const archivo = rel(abs);
    const texto = readFileSync(abs, 'utf8');
    const vistos = new Set<string>();
    const agregar = (tipo: Tipo, idx: number, args: string[]) => {
      if (enComentario(texto, idx) || esDefinicion(texto, idx)) return;
      const linea = lineaDe(texto, idx);
      const clave = `${linea}:${tipo}`;
      if (vistos.has(clave)) return;
      vistos.add(clave);
      const p: Punto = { archivo, linea, tipo, texto: texto.split('\n')[linea - 1].trim(), args };
      (PRIMITIVAS.includes(archivo) ? primitivas : puntos).push(p);
    };
    for (const d of DETECTORES) {
      d.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = d.re.exec(texto))) {
        const finMatch = m.index + m[0].length - 1;
        const args = texto[finMatch] === '(' ? argumentos(texto, finMatch) : [];
        // el punto se ancla en la línea del método (.upload), no en la del .from(...)
        const anclaRel = m[0].search(/\.(upload|update|copy|move)\s*\($/);
        agregar(d.tipo, anclaRel > 0 ? m.index + anclaRel : m.index, args);
      }
    }
    for (const p of putsBinarios(texto)) agregar('put-binario', p.idx, ['?', p.cuerpo]);
  }
  return { puntos, primitivas };
}

// ── Clasificación ───────────────────────────────────────────────────────────────────────────────
const RE_IMPORT_OPT = /import\s*\{[^}]*\boptimizarImagen\b[^}]*\}\s*from\s*['"][^'"]*optimizar-imagen-servidor(\.js|\.ts)?['"]/;
const RE_IMPORT_CACHE = /import\s*\{[^}]*\bCACHE_UN_ANO\b[^}]*\}\s*from\s*['"][^'"]*optimizar-imagen-servidor(\.js|\.ts)?['"]/;

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ¿El cuerpo que se sube sale de optimizarImagen? */
function cuerpoComprimido(texto: string, cuerpo: string | undefined): boolean {
  if (!cuerpo) return false;
  if (/optimizarImagen\s*\(/.test(cuerpo)) return true;
  const raiz = /^([A-Za-z_$][\w$]*)/.exec(cuerpo)?.[1];
  if (!raiz) return false;
  return new RegExp(`\\b${escapar(raiz)}\\s*=\\s*(await\\s+)?optimizarImagen\\s*\\(`).test(texto);
}

/** ¿Las opciones llevan cacheControl: CACHE_UN_ANO (en línea o en una variable)? */
function llevaCache(texto: string, opciones: string | undefined): boolean {
  if (!opciones) return false;
  if (/cacheControl\s*:\s*CACHE_UN_ANO\b/.test(opciones)) return true;
  const id = /^([A-Za-z_$][\w$]*)$/.exec(opciones.trim())?.[1];
  if (!id) return false;
  return new RegExp(`\\b${escapar(id)}\\b[^=\\n]*=\\s*\\{[^}]*cacheControl\\s*:\\s*CACHE_UN_ANO\\b`).test(texto);
}

function clasificar(p: Punto, texto: string): { ok: boolean; motivo: string } {
  const exc = EXCEPCIONES.find(e => e.archivo === p.archivo && (!e.contiene || p.texto.includes(e.contiene)));
  if (exc) {
    return exc.guarda.test(texto)
      ? { ok: true, motivo: `EXCEPCIÓN: ${exc.motivo}` }
      : { ok: false, motivo: `excepción declarada pero falta su guarda ${exc.guarda} → ya no está justificada` };
  }

  if (MODULOS_SUBIDA_PERMITIDOS.includes(p.archivo)) {
    const falta = [!RE_IMPORT_OPT.test(texto) && 'optimizarImagen', !RE_IMPORT_CACHE.test(texto) && 'CACHE_UN_ANO'].filter(Boolean);
    return falta.length ? { ok: false, motivo: `módulo de subida permitido pero no importa ${falta.join(' ni ')}` }
                        : { ok: true, motivo: 'dentro del módulo de subida único' };
  }

  const esCliente = p.archivo.startsWith('components/') || /^['"]use client['"]/m.test(texto);
  switch (p.tipo) {
    case 'signed-upload-url':
    case 'r2-presign':
      return { ok: false, motivo: 'URL firmada: el navegador sube sin pasar por el compresor del servidor (ley 2)' };
    case 'upload-signed':
    case 'put-binario':
      return { ok: false, motivo: 'subida directa desde el navegador, sin compresor del servidor ni CACHE_UN_ANO (ley 1-3)' };
    case 's3-sdk':
    case 'storage-rest':
      return { ok: false, motivo: 'escritura por vía no reconocida: pásala por el compresor o decláralo en la config' };
    case 'storage-copy':
      return { ok: false, motivo: 'copy/move en el storage: revisar a mano y declararlo en la config' };
  }

  // upload / storage-update / r2-subir: se decide por el cuerpo y las opciones
  if (esCliente) return { ok: false, motivo: 'subida desde el navegador con la clave anónima; nunca pasa por el servidor (ley 1-2)' };
  if (EXIGIR_PUNTO_UNICO) return { ok: false, motivo: `sube por fuera del punto único (${MODULOS_SUBIDA_PERMITIDOS.join(', ')})` };

  const fallos: string[] = [];
  const cuerpo = p.args[1];
  if (!RE_IMPORT_OPT.test(texto) || !cuerpoComprimido(texto, cuerpo)) {
    fallos.push(`el cuerpo (${cuerpo ?? '?'}) no sale de optimizarImagen`);
  }
  if (p.tipo === 'r2-subir') {
    if (!p.args.slice(3).some(a => /CACHE_UN_ANO/.test(a))) fallos.push('R2 sin Cache-Control de 1 año (r2Subir no recibe CACHE_UN_ANO)');
  } else if (!RE_IMPORT_CACHE.test(texto) || !llevaCache(texto, p.args[2])) {
    fallos.push('sin cacheControl: CACHE_UN_ANO');
  }
  return fallos.length ? { ok: false, motivo: fallos.join('; ') }
                       : { ok: true, motivo: 'comprime con optimizarImagen y sube con CACHE_UN_ANO' };
}

// ── Ejecución ───────────────────────────────────────────────────────────────────────────────────
let pasadas = 0, fallidas = 0;
function fila(ok: boolean, donde: string, tipo: string, motivo: string) {
  if (ok) pasadas++; else fallidas++;
  console.log(`  ${ok ? 'ok   ' : 'FALLA'} ${donde.padEnd(52)} ${tipo.padEnd(18)} ${motivo}`);
}

async function main() {
  console.log(`\nLEY DE IMÁGENES · ${APP}\n`);

  // 1. El compresor real existe y su marca de caché es la que se vigila en la base.
  console.log('Compresor y empaquetado (código real importado):');
  const rutaOpt = join(RAIZ, 'lib', 'optimizar-imagen-servidor.ts');
  if (!existsSync(rutaOpt)) {
    fila(false, 'lib/optimizar-imagen-servidor.ts', 'compresor', 'no existe: esta app no tiene compresor de servidor');
  } else {
    const mod: any = await import(pathToFileURL(rutaOpt).href);
    fila(typeof mod.optimizarImagen === 'function', 'lib/optimizar-imagen-servidor.ts', 'compresor',
      `exporta optimizarImagen: ${typeof mod.optimizarImagen}`);
    fila(mod.CACHE_UN_ANO === '31536000', 'lib/optimizar-imagen-servidor.ts', 'CACHE_UN_ANO',
      `valor ${JSON.stringify(mod.CACHE_UN_ANO)} (se espera "31536000" → max-age=31536000 en storage.objects)`);
  }
  const cfgMod: any = await import(pathToFileURL(join(RAIZ, 'next.config.ts')).href);
  const cfg = cfgMod.default?.default ?? cfgMod.default ?? cfgMod;
  const incl: string[] = cfg?.outputFileTracingIncludes?.['/api/**'] ?? [];
  fila(incl.includes('./node_modules/@img/**/*'), 'next.config.ts', 'tracing sharp',
    `outputFileTracingIncludes['/api/**'] = ${JSON.stringify(incl)} (ley 6: debe incluir ./node_modules/@img/**/*)`);

  // 2. Cada punto de escritura al almacenamiento.
  const { puntos, primitivas } = encontrarPuntos();
  const cache = new Map<string, string>();
  const leer = (a: string) => cache.get(a) ?? (cache.set(a, readFileSync(join(RAIZ, a), 'utf8')), cache.get(a)!);

  console.log(`\nPuntos que escriben al almacenamiento (${puntos.length}):`);
  puntos.sort((a, b) => a.archivo.localeCompare(b.archivo) || a.linea - b.linea);
  let cumplen = 0;
  for (const p of puntos) {
    const r = clasificar(p, leer(p.archivo));
    if (r.ok) cumplen++;
    fila(r.ok, `${p.archivo}:${p.linea}`, p.tipo, r.motivo);
  }

  if (primitivas.length) {
    console.log('\nPrimitivas de transporte (no cuentan; se revisan sus llamadas):');
    for (const p of primitivas) console.log(`  info  ${`${p.archivo}:${p.linea}`.padEnd(52)} ${p.tipo}`);
  }
  for (const m of MODULOS_SUBIDA_PERMITIDOS) if (!existsSync(join(RAIZ, m))) console.log(`  info  ${m.padEnd(52)} módulo permitido que aún no existe`);

  console.log(`\nPuntos de subida: ${cumplen}/${puntos.length} cumplen la ley.`);
  console.log(`Total: ${pasadas}/${pasadas + fallidas} ok${fallidas ? ` · ${fallidas} FALLA` : ''}\n`);
  if (fallidas) process.exit(1);
}

main().catch(e => { console.error('La prueba no pudo ejecutarse:', e); process.exit(1); });

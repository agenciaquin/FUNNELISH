/**
 * Piezas comunes de los scripts de limpieza del charco (A1–A5 de `TABLERO-AGENTES.md`).
 *
 * TODO SIMULACRO POR DEFECTO
 * --------------------------
 * Cada script lee, baja y mide, pero NO escribe nada en Supabase salvo que se le
 * pase `--ejecutar`. Y aun así, la única función que escribe (`escribirStorage`)
 * se niega si no hay antes una copia local verificada (sha256) del archivo que
 * va a cambiar. Leer no necesita permiso; escribir necesita el visto bueno de
 * dirección, por escrito, para ESA tarea (tablero §6.4).
 *
 * Por qué fetch a mano y no `@supabase/supabase-js`: así se ve exactamente qué
 * método HTTP sale. Las lecturas son GET a PostgREST y a Storage, más un POST a
 * la RPC `listar_objetos_storage`, que es de solo lectura (`sql/002_listar_objetos.sql`
 * de media-api). Cualquier otra cosa pasa por `escribirStorage`.
 *
 * Credenciales: las mismas que ya usa `media-api` (`arreglos-supabase/media-api/.env`,
 * clave service_role). No se copian a ningún sitio ni se imprimen.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------- argumentos

export const ARGS = process.argv.slice(2);
export const EJECUTAR = ARGS.includes('--ejecutar');
export function argumento(nombre: string): string | undefined {
  const i = ARGS.indexOf(nombre);
  return i >= 0 ? ARGS[i + 1] : undefined;
}

/** Raíz del repo (este archivo vive en `arreglos-supabase/limpieza/`). */
export const RAIZ_REPO = resolve(__dirname, '..', '..');
export const CARPETA_LIMPIEZA = __dirname;

/**
 * Dónde se guardan las copias bajadas. NUNCA dentro del repo: son fotos de
 * clientes y pesan un giga. Por defecto, la carpeta temporal del sistema.
 */
export const COPIAS = resolve(argumento('--copias') ?? process.env.LIMPIEZA_COPIAS ?? join(tmpdir(), 'funnelish-limpieza'));
if ((COPIAS + sep).toLowerCase().startsWith((RAIZ_REPO + sep).toLowerCase())) {
  throw new Error(`Las copias no pueden ir dentro del repo (${COPIAS}). Usa --copias con una carpeta de fuera.`);
}

// ---------------------------------------------------------------- credenciales

function leerEnv(): { url: string; clave: string } {
  let url = process.env.SUPABASE_URL ?? '';
  let clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const archivo = join(RAIZ_REPO, 'arreglos-supabase', 'media-api', '.env');
  if ((!url || !clave) && existsSync(archivo)) {
    for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(linea);
      if (!m) continue;
      if (m[1] === 'SUPABASE_URL' && !url) url = m[2]!;
      if (m[1] === 'SUPABASE_SERVICE_ROLE_KEY' && !clave) clave = m[2]!;
    }
  }
  if (!url || !clave) throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (ver arreglos-supabase/media-api/.env).');
  // Solo el proyecto de quinchat. quin-comercial es otra base a la que no tenemos acceso.
  if (!url.includes('bjbjqmbuzpyjvcugbusx')) throw new Error(`SUPABASE_URL no es el proyecto de quinchat: ${url}`);
  return { url: url.replace(/\/$/, ''), clave };
}
const ENV = leerEnv();
const cabeceras = () => ({ apikey: ENV.clave, Authorization: `Bearer ${ENV.clave}` });

// ---------------------------------------------------------------- lectura

/** GET a PostgREST. Solo lectura. */
async function getRest(ruta: string, extra: Record<string, string> = {}): Promise<Response> {
  const r = await fetch(`${ENV.url}/rest/v1/${ruta}`, { method: 'GET', headers: { ...cabeceras(), ...extra } });
  if (!r.ok) throw new Error(`GET ${ruta}: ${r.status} ${await r.text()}`);
  return r;
}

export interface Objeto { bucket: string; ruta: string; bytes: number; mime: string }

/**
 * Lista un bucket entero desde `storage.objects` (vía la RPC de solo lectura de
 * media-api). Paginado: PostgREST corta en 1 000 filas.
 */
export async function listarBucket(bucket: string): Promise<Objeto[]> {
  const todos: Objeto[] = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${ENV.url}/rest/v1/rpc/listar_objetos_storage?order=ruta&limit=1000&offset=${desde}`, {
      method: 'POST', // RPC `stable` y de solo lectura: un SELECT sobre storage.objects
      headers: { ...cabeceras(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_bucket: bucket, p_prefijo: '' }),
    });
    if (!r.ok) throw new Error(`listar ${bucket}: ${r.status} ${await r.text()}`);
    const filas = (await r.json()) as { ruta: string; bytes: number | string; content_type: string | null }[];
    for (const f of filas) todos.push({ bucket, ruta: f.ruta, bytes: Number(f.bytes ?? 0), mime: f.content_type ?? '' });
    if (filas.length < 1000) break;
  }
  return todos;
}

export const BUCKETS = ['chat-media', 'catalogo-imagenes', 'plantillas-images'] as const;

export async function listarTodo(): Promise<Objeto[]> {
  const res: Objeto[] = [];
  for (const b of BUCKETS) res.push(...(await listarBucket(b)));
  return res;
}

// ---------------------------------------------------------------- cruce de referencias

/**
 * Tablas cuya aparición NO cuenta como «en uso»: son el registro de la pasada
 * de agosto (`media_optimizaciones` guarda la ruta y su respaldo en
 * `_originales/`). Se informa de ellas aparte, pero no hacen que un archivo se
 * sirva.
 */
export const TABLAS_REGISTRO = new Set(['media_optimizaciones', 'media_optimizaciones_resumen']);

export interface Referencias {
  /** nombre de archivo (base, en minúsculas) → lista `tabla.columna` donde aparece. */
  porNombre: Map<string, Set<string>>;
  /** `bucket/ruta` completa (en minúsculas) → `tabla.columna`. Segunda comprobación, por ruta. */
  porRuta: Map<string, Set<string>>;
  /** Columnas de texto con alguna URL de Storage o nombre de bucket (para el informe). */
  columnas: { columna: string; filas: number; conStorage: number; conOriginales: number }[];
  tablas: string[];
  /**
   * Tablas que PostgREST lista pero `service_role` no puede leer (permiso
   * revocado). El cruce NO es completo mientras haya alguna: se dice, y los
   * scripts que borran se niegan a `--ejecutar`.
   */
  ilegibles: { tabla: string; columnas: string[]; motivo: string }[];
  fecha: string;
}

/** Nombres de archivo dentro de un texto: cualquier palabra con extensión de medio. */
const RE_ARCHIVO = /[A-Za-z0-9._~%\-]+\.(?:jpe?g|png|webp|gif|heic|heif|avif|svg|mp4|mov|m4v|webm|3gp|mkv|ogg|oga|opus|mp3|m4a|aac|amr|wav|pdf|bin)\b/gi;
const RE_STORAGE = /supabase\.co\/storage|chat-media|catalogo-imagenes|plantillas-images/i;
/** Ruta de Storage dentro de un texto ya decodificado: `chat-media/embudos/x/a.mp4`. */
const RE_RUTA = /(chat-media|catalogo-imagenes|plantillas-images)\/([^\s"'<>?#\\]+)/gi;

/**
 * Decodifica solo las secuencias `%XX` válidas, trozo a trozo. `decodeURIComponent`
 * sobre la celda entera falla con un `%` suelto («50% OFF») y entonces una ruta
 * escrita con `%2F` en la MISMA celda no se veía: salía un falso huérfano.
 */
export function decodificarTrozos(texto: string): string {
  return texto.replace(/(?:%[0-9A-Fa-f]{2})+/g, (m) => {
    try { return decodeURIComponent(m); } catch {
      // Secuencia UTF-8 rota: se decodifica byte a byte lo que sea ASCII.
      return m.replace(/%([0-7][0-9A-Fa-f])/g, (_x, h: string) => String.fromCharCode(parseInt(h, 16)));
    }
  });
}

/**
 * Lee TODAS las columnas de texto o JSON de TODAS las tablas que expone PostgREST
 * (el equivalente a recorrer `information_schema`: la lista sale del esquema
 * OpenAPI del propio servidor, no de una lista escrita a mano) y apunta cada
 * nombre de archivo que aparezca. Es la misma regla que la consulta SQL de
 * `HALLAZGO-videos.md` (coincidencia del nombre base en cualquier parte del
 * texto), pero sobre todas las tablas a la vez.
 *
 * Conservador a propósito: la coincidencia ignora mayúsculas y decodifica `%20`,
 * así que ante la duda un archivo cuenta como «en uso».
 */
export async function cargarReferencias(): Promise<Referencias> {
  const esquema = (await (await getRest('', { Accept: 'application/openapi+json' })).json()) as {
    definitions: Record<string, { properties?: Record<string, { format?: string; type?: string; description?: string }> }>;
  };
  const porNombre = new Map<string, Set<string>>();
  const porRuta = new Map<string, Set<string>>();
  const apuntar = (mapa: Map<string, Set<string>>, clave: string, donde: string) => {
    if (!mapa.has(clave)) mapa.set(clave, new Set());
    mapa.get(clave)!.add(donde);
  };
  const columnas: Referencias['columnas'] = [];
  const ilegibles: Referencias['ilegibles'] = [];
  const tablas = Object.keys(esquema.definitions).sort();

  for (const tabla of tablas) {
    const props = esquema.definitions[tabla]!.properties ?? {};
    const cols = Object.entries(props)
      .filter(([, p]) => /text|json|character|uuid\[\]|\[\]/.test(p.format ?? '') || p.type === 'array' || p.type === 'object')
      .map(([c]) => c);
    if (!cols.length) continue;
    const cuenta = new Map(cols.map((c) => [c, { filas: 0, conStorage: 0, conOriginales: 0 }]));
    // Paginar SIN orden puede saltarse filas (en `messages` hay 52 páginas y se
    // escriben mientras se lee). Se ordena por la clave primaria, que PostgREST
    // marca con `<pk/>`; si una tabla no la tiene, por todas sus columnas.
    const pk = Object.entries(props).filter(([, p]) => (p.description ?? '').includes('<pk/>')).map(([c]) => c);
    const orden = (pk.length ? pk : Object.keys(props)).join(',');

    for (let desde = 0; ; desde += 1000) {
      const sel = cols.map((c) => `"${c}"`).join(',');
      let filas: Record<string, unknown>[];
      try {
        const r = await getRest(`${encodeURIComponent(tabla)}?select=${encodeURIComponent(sel)}&order=${encodeURIComponent(orden)}&limit=1000&offset=${desde}`);
        filas = (await r.json()) as Record<string, unknown>[];
      } catch (e) {
        ilegibles.push({ tabla, columnas: cols, motivo: String((e as Error).message).slice(0, 160) });
        break;
      }
      for (const fila of filas) {
        for (const c of cols) {
          const v = fila[c];
          if (v == null) continue;
          const texto = typeof v === 'string' ? v : JSON.stringify(v);
          const k = cuenta.get(c)!;
          k.filas++;
          if (RE_STORAGE.test(texto)) k.conStorage++;
          if (texto.includes('_originales/')) k.conOriginales++;
          const plano = decodificarTrozos(texto);
          for (const t of [texto, plano]) {
            for (const m of t.matchAll(RE_ARCHIVO)) apuntar(porNombre, m[0].split('/').pop()!.toLowerCase(), `${tabla}.${c}`);
          }
          for (const m of plano.matchAll(RE_RUTA)) apuntar(porRuta, `${m[1]}/${m[2]}`.toLowerCase(), `${tabla}.${c}`);
        }
      }
      if (filas.length < 1000) break;
    }
    for (const [c, k] of cuenta) if (k.conStorage > 0 || k.conOriginales > 0) columnas.push({ columna: `${tabla}.${c}`, ...k });
  }
  return { porNombre, porRuta, columnas, tablas, ilegibles, fecha: new Date().toISOString() };
}

/** Dónde aparece un archivo por su NOMBRE (sin contar las tablas de registro, salvo que se pidan). */
export function dondeSeUsa(refs: Referencias, ruta: string, conRegistro = false): string[] {
  const base = ruta.split('/').pop()!.toLowerCase();
  const s = refs.porNombre.get(base);
  if (!s) return [];
  return [...s].filter((x) => conRegistro || !TABLAS_REGISTRO.has(x.split('.')[0]!)).sort();
}

/** Dónde aparece un archivo por su RUTA completa `bucket/ruta` (segunda comprobación de A2). */
export function dondeSeUsaPorRuta(refs: Referencias, bucket: string, ruta: string): string[] {
  const s = refs.porRuta.get(`${bucket}/${ruta}`.toLowerCase());
  return s ? [...s].filter((x) => !TABLAS_REGISTRO.has(x.split('.')[0]!)).sort() : [];
}

// ---------------------------------------------------------------- prueba del cruce SQL

/**
 * PRUEBA DEL CRUCE SQL (formato `cruce-limpieza-v1`)
 * --------------------------------------------------
 * El cruce por la API no llega a todo (dos tablas que `service_role` no lee,
 * otros esquemas). Lo que falta lo cubre una consulta SQL que GENERA EL PROPIO
 * SIMULACRO (`prueba-cruce-a2.sql`, `prueba-cruce-a1.sql`), con la lista exacta
 * de lo que se va a tocar: nadie escribe la lista a mano.
 *
 * Quien tenga el editor SQL de Supabase la ejecuta. Devuelve UNA fila y UNA
 * columna, `prueba`, con un JSON así (la fecha la pone la base, no el fichero):
 *
 *   {"formato": "cruce-limpieza-v1", "fecha": "2026-10-01T03:00:00Z",
 *    "consulta2": {"catalogo_categorias": 0, "catalogo_variables": 0},
 *    "consulta3": {"coincidencias": 0, "videos": ["embudos/…/a.mp4", …]},
 *    "consulta4": {"filas": 0}}
 *
 * Esa celda se guarda en un fichero (copiar el valor, o «Export > CSV»: las dos
 * formas valen) y se pasa con `--tablas-revisadas <fichero>`.
 *
 * Se exige, leyendo los VALORES:
 *  - el formato `cruce-limpieza-v1` y una sola prueba en el fichero;
 *  - `fecha` de hace menos de 24 h (y no en el futuro);
 *  - consulta 2: cada tabla ilegible presente y con 0;
 *  - A2 (`videos`): consulta 3 con 0 coincidencias, y lo que se va a tocar tiene
 *    que estar en su lista (lo que no esté, no se toca: ver `cubiertos`);
 *  - A1 (`originales`): consulta 4 con 0 filas.
 * Cualquier otro fichero se rechaza. No es una firma criptográfica: prueba que
 * los resultados dicen 0, no quién los produjo. El sha256 del fichero y la
 * fecha quedan en el registro de ejecuciones.
 */
export interface PruebaCruce {
  formato: 'cruce-limpieza-v1';
  fecha: string;
  consulta2: Record<string, number>;
  consulta3?: { coincidencias: number; videos: string[] };
  consulta4?: { filas: number };
}

/** Busca la prueba dentro del fichero: el JSON tal cual o dentro de una celda CSV (comillas dobladas). */
export function leerPruebaCruce(texto: string): PruebaCruce {
  const candidatos = new Set<string>();
  for (const t of [texto, texto.replace(/""/g, '"')]) {
    for (const m of t.matchAll(/\{[^{}]*"formato"\s*:\s*"cruce-limpieza-v1"(?:[^{}]|\{[^{}]*\})*\}/g)) candidatos.add(m[0]);
  }
  const pruebas = [...candidatos].map((c) => { try { return JSON.parse(c) as PruebaCruce; } catch { return null; } }).filter(Boolean) as PruebaCruce[];
  const distintas = new Set(pruebas.map((p) => JSON.stringify(p)));
  if (!distintas.size) throw new Error('El fichero no contiene una prueba «cruce-limpieza-v1» (la fila que devuelve prueba-cruce-*.sql).');
  if (distintas.size > 1) throw new Error('El fichero contiene más de una prueba: pasa solo la de hoy.');
  return pruebas[0]!;
}

export interface Exigencia {
  /** A2: rutas `embudos/…` que se van a mover o purgar. */
  videos?: string[];
  /** A1: exigir la consulta 4 (`_originales/`). */
  originales?: boolean;
}

/**
 * Valida la prueba del cruce SQL (ver arriba) y devuelve las rutas cubiertas por
 * la consulta 3. Lanza si no vale. Se exige SIEMPRE en A1 y A2, haya o no tablas
 * ilegibles: la consulta 3 también cubre los huecos del cruce por API.
 */
export async function exigirRevisionSql(refs: Pick<Referencias, 'ilegibles'>, exige: Exigencia = {}): Promise<Set<string>> {
  const fichero = argumento('--tablas-revisadas');
  if (!fichero || !existsSync(fichero)) {
    throw new Error('No se ejecuta: falta la prueba del cruce SQL. Ejecuta prueba-cruce-a1.sql / prueba-cruce-a2.sql (las genera el simulacro) y pasa el resultado con --tablas-revisadas <fichero>.');
  }
  const texto = await readFile(fichero, 'utf8');
  const p = leerPruebaCruce(texto);
  const fecha = Date.parse(p.fecha);
  if (!Number.isFinite(fecha)) throw new Error(`La prueba no tiene una fecha válida («${p.fecha}»).`);
  const horas = (Date.now() - fecha) / 3_600_000;
  if (horas > 24) throw new Error(`La prueba del cruce es de hace ${Math.round(horas)} h: el cruce vale el día que se hace. Vuelve a ejecutarlo.`);
  if (horas < -0.1) throw new Error(`La prueba del cruce tiene fecha futura (${p.fecha}).`);
  for (const t of refs.ilegibles.map((x) => x.tabla)) {
    const v = p.consulta2?.[t];
    if (v !== 0) throw new Error(`Consulta 2: ${t} ${v == null ? 'no aparece' : `da ${v}`}; tiene que dar 0. No se ejecuta.`);
  }
  const cubiertos = new Set((p.consulta3?.videos ?? []).map((r) => r.toLowerCase()));
  if (exige.videos) {
    if (!p.consulta3) throw new Error('A2 necesita la consulta 3 (vídeos) en la prueba.');
    if (p.consulta3.coincidencias !== 0) throw new Error(`Consulta 3: ${p.consulta3.coincidencias} coincidencias; algún vídeo sí está nombrado. No se ejecuta.`);
  }
  if (exige.originales) {
    if (!p.consulta4) throw new Error('A1 necesita la consulta 4 (_originales/) en la prueba.');
    if (p.consulta4.filas !== 0) throw new Error(`Consulta 4: ${p.consulta4.filas} filas nombran «_originales/». No se ejecuta.`);
  }
  await anotarRegistro({ tipo: 'prueba-sql', fichero: resolve(fichero), sha256: createHash('sha256').update(texto).digest('hex'),
    fecha_prueba: p.fecha, consulta2: p.consulta2, consulta3: p.consulta3 ? { coincidencias: p.consulta3.coincidencias, videos: p.consulta3.videos.length } : undefined,
    consulta4: p.consulta4 });
  console.log(`Prueba del cruce SQL aceptada: ${fichero} (fecha ${p.fecha}; ${cubiertos.size} vídeos cubiertos)`);
  return cubiertos;
}

const PATRON_ARCHIVO_SQL = String.raw`(supabase\.co/storage|chat-media|catalogo-imagenes|plantillas-images|\.(mp4|mov|webm|jpe?g|png|webp)\M)`;
const ESQUEMAS_FUERA = `'pg_catalog', 'information_schema', 'pg_toast', 'storage', 'auth', 'realtime', 'supabase_functions',
       'supabase_migrations', 'extensions', 'graphql', 'graphql_public', 'pgsodium', 'pgsodium_masks', 'vault', 'net', 'cron', 'pgbouncer'`;

/**
 * El SQL (solo SELECT) que produce la prueba. Lo escribe el simulacro con la
 * lista EXACTA de lo que propone, así la consulta 3 cubre lo que se va a mover.
 */
export function generarSqlPrueba(videos: string[], titulo: string): string {
  const lista = videos.map((v) => `'${v.replace(/'/g, "''")}'`).join(',\n    ');
  return `-- ${titulo}
-- GENERADO por el simulacro el ${new Date().toISOString()}. No editar a mano: relanzar el simulacro.
-- SOLO LECTURA (todo SELECT). Devuelve UNA fila con la columna «prueba»: guarda ese valor
-- (copiar la celda, o Export > CSV) en un fichero y pásalo con --tablas-revisadas <fichero>.
-- Formato «cruce-limpieza-v1»: ver exigirRevisionSql en comun.ts.
with videos(ruta) as (
  select unnest(array[
    ${lista || ''}
  ]::text[])
),
cols as (
  select table_schema, table_name, column_name
  from information_schema.columns
  where table_schema not in (${ESQUEMAS_FUERA})
    and data_type in ('text', 'character varying', 'character', 'json', 'jsonb', 'ARRAY', 'USER-DEFINED')
    and table_name not in ('media_optimizaciones', 'media_optimizaciones_resumen')
),
c2 as (
  select (select count(*) from catalogo_categorias t where to_jsonb(t)::text ~* '${PATRON_ARCHIVO_SQL}') as categorias,
         (select count(*) from catalogo_variables t where to_jsonb(t)::text ~* '${PATRON_ARCHIVO_SQL}') as variables
),
c3 as (
  select coalesce(sum((xpath('/row/n/text()', query_to_xml(format(
           'select count(*) as n from %I.%I where %I::text ilike %L',
           c.table_schema, c.table_name, c.column_name, '%' || regexp_replace(v.ruta, '^.*/', '') || '%'), false, true, '')))[1]::text::int), 0) as n
  from videos v cross join cols c
),
c4 as (
  select coalesce(sum((xpath('/row/n/text()', query_to_xml(format(
           'select count(*) as n from %I.%I where %I::text like %L',
           c.table_schema, c.table_name, c.column_name, '%\\_originales/%'), false, true, '')))[1]::text::int), 0) as n
  from cols c
)
select jsonb_build_object(
  'formato', 'cruce-limpieza-v1',
  'fecha', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'consulta2', jsonb_build_object('catalogo_categorias', c2.categorias, 'catalogo_variables', c2.variables),
  'consulta3', jsonb_build_object('coincidencias', c3.n, 'videos', (select coalesce(jsonb_agg(ruta order by ruta), '[]'::jsonb) from videos)),
  'consulta4', jsonb_build_object('filas', c4.n)
)::text as prueba
from c2, c3, c4;
`;
}

/** Escribe el SQL de la prueba junto a los scripts y junto a las copias. */
export async function guardarSqlPrueba(nombre: string, videos: string[], titulo: string): Promise<void> {
  const sql = generarSqlPrueba(videos, titulo);
  await mkdir(join(COPIAS, 'listas'), { recursive: true });
  await writeFile(join(COPIAS, 'listas', nombre), sql);
  await writeFile(join(CARPETA_LIMPIEZA, nombre), sql);
}

// ---------------------------------------------------------------- descargas

export function urlPublica(bucket: string, ruta: string): string {
  return `${ENV.url}/storage/v1/object/public/${bucket}/${ruta.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Una copia local. `rel` es la ruta RELATIVA a `--copias` y es la única que se
 * guarda: así la carpeta de copias se puede mover a un disco definitivo y todo
 * sigue funcionando con `--copias <nueva carpeta>`. `archivo` es la ruta
 * absoluta, calculada cada vez a partir de `COPIAS`.
 */
export interface Descarga { archivo: string; rel: string; bytes: number; sha256: string; cacheControl: string; contentType: string }

const absoluta = (rel: string) => join(COPIAS, ...rel.split('/'));
const relDe = (o: { bucket: string; ruta: string }) => [o.bucket, ...o.ruta.split('/')].join('/');

/** Lee un `.meta.json`. La ruta de la copia sale de DÓNDE está el meta, nunca de lo que diga dentro. */
async function leerMeta(metaAbs: string): Promise<Descarga | null> {
  if (!existsSync(metaAbs)) return null;
  const archivo = metaAbs.slice(0, -'.meta.json'.length);
  if (!existsSync(archivo)) return null;
  const m = JSON.parse(await readFile(metaAbs, 'utf8')) as Descarga;
  const rel = relative(COPIAS, archivo).split(sep).join('/');
  return { ...m, archivo, rel };
}

/** Ruta absoluta de un archivo dentro de las copias (p. ej. lo de `salida/`). */
export const enCopias = (rel: string) => absoluta(rel);

/**
 * La copia local de un objeto SIN tocar la red. Si se da `sha256`, solo vale la
 * copia con ese contenido (la canónica o una de las que se guardaron al lado).
 * Es lo que usan la ejecución y la marcha atrás: el respaldo es siempre lo que
 * se bajó al medir, nunca lo que haya hoy en Storage.
 */
export async function copiaLocal(o: { bucket: string; ruta: string }, sha256?: string): Promise<Descarga | null> {
  const canon = absoluta(relDe(o));
  const candidatos = [`${canon}.meta.json`];
  if (sha256) candidatos.push(`${canon}.${sha256.slice(0, 12)}.meta.json`);
  for (const c of candidatos) {
    const d = await leerMeta(c);
    if (d && (!sha256 || d.sha256 === sha256)) return d;
  }
  return null;
}

/** La copia apuntada en el registro de ejecuciones (`copia_rel`), sin red. */
export async function copiaPorRel(rel: string): Promise<Descarga | null> {
  return leerMeta(`${absoluta(rel)}.meta.json`);
}

/** Todas las copias canónicas bajo un prefijo de las copias (p. ej. `chat-media/_originales`), sin red. */
export async function copiasBajo(prefijoRel: string): Promise<Descarga[]> {
  const raiz = absoluta(prefijoRel);
  if (!existsSync(raiz)) return [];
  const res: Descarga[] = [];
  for (const f of (await readdir(raiz, { recursive: true })) as string[]) {
    if (!f.endsWith('.meta.json')) continue;
    const d = await leerMeta(join(raiz, f));
    // Solo la canónica (la del original): las de al lado llevan `.<sha12>` antes de `.meta.json`.
    if (d && !/\.[0-9a-f]{12}$/.test(d.archivo)) res.push(d);
  }
  return res;
}

/** Descarga en memoria, sin guardar nada (para comprobar que el archivo sigue igual). */
export async function bajarEnMemoria(o: { bucket: string; ruta: string }): Promise<{ buf: Buffer; sha256: string }> {
  const url = `${ENV.url}/storage/v1/object/authenticated/${o.bucket}/${o.ruta.split('/').map(encodeURIComponent).join('/')}`;
  const r = await fetch(url, { method: 'GET', headers: cabeceras() });
  if (!r.ok) throw new Error(`No se pudo bajar ${o.bucket}/${o.ruta}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { buf, sha256: createHash('sha256').update(buf).digest('hex') };
}

/** ¿Existe el objeto en Storage? Pide un solo byte (no gasta egress). */
export async function existe(o: { bucket: string; ruta: string }): Promise<boolean> {
  const url = `${ENV.url}/storage/v1/object/authenticated/${o.bucket}/${o.ruta.split('/').map(encodeURIComponent).join('/')}`;
  const r = await fetch(url, { method: 'GET', headers: { ...cabeceras(), Range: 'bytes=0-0' } });
  await r.arrayBuffer().catch(() => undefined);
  if (r.ok) return true;
  if (r.status === 404 || r.status === 400) return false;
  throw new Error(`No se pudo comprobar ${o.bucket}/${o.ruta}: ${r.status}`);
}

/**
 * Baja un objeto a `COPIAS/<bucket>/<ruta>` (si ya está y pesa lo mismo, no lo
 * vuelve a bajar: el egress cuenta). Es la copia de seguridad que exige
 * `escribirStorage` y, a la vez, la entrada del simulacro.
 *
 * Una copia NUNCA se pisa: si el archivo de Storage cambió (por ejemplo, porque
 * ya se recomprimió), la versión nueva se guarda al lado con su sha256 en el
 * nombre. Así una segunda pasada no puede sustituir el respaldo del original por
 * la versión comprimida.
 */
export async function bajar(o: { bucket: string; ruta: string; bytes?: number }): Promise<Descarga> {
  const canon = absoluta(relDe(o));
  const previa = await leerMeta(`${canon}.meta.json`);
  if (previa && (o.bytes == null || previa.bytes === o.bytes)) return previa;
  // Endpoint autenticado: funciona aunque el bucket no sea público y no deja copia en la CDN.
  const url = `${ENV.url}/storage/v1/object/authenticated/${o.bucket}/${o.ruta.split('/').map(encodeURIComponent).join('/')}`;
  let r: Response | null = null;
  for (let intento = 1; intento <= 3; intento++) {
    r = await fetch(url, { method: 'GET', headers: cabeceras() });
    if (r.ok) break;
    if (r.status === 404) break;
    await new Promise((ok) => setTimeout(ok, 1000 * intento));
  }
  if (!r || !r.ok) throw new Error(`No se pudo bajar ${o.bucket}/${o.ruta}: ${r?.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const sha256 = createHash('sha256').update(buf).digest('hex');
  // Nunca pisar una copia: si ya hay una (de otra versión), esta va al lado.
  const archivo = existsSync(canon) ? `${canon}.${sha256.slice(0, 12)}` : canon;
  await mkdir(dirname(archivo), { recursive: true });
  if (!existsSync(archivo)) await writeFile(archivo, buf, { flag: 'wx' });
  const d = {
    bytes: buf.length, sha256,
    cacheControl: r.headers.get('cache-control') ?? '', contentType: r.headers.get('content-type') ?? '',
  };
  await writeFile(`${archivo}.meta.json`, JSON.stringify(d, null, 2));
  return { ...d, archivo, rel: relative(COPIAS, archivo).split(sep).join('/') };
}

/** Cache-Control que sirve hoy la URL pública (lo que ve el navegador del cliente). */
export async function cacheControlPublico(bucket: string, ruta: string): Promise<string> {
  const r = await fetch(urlPublica(bucket, ruta), { method: 'GET', headers: { Range: 'bytes=0-0' } });
  await r.arrayBuffer().catch(() => undefined);
  return r.headers.get('cache-control') ?? '';
}

/** `public, max-age=3600` → `3600`. Lo que espera `escribirStorage`. */
export function segundosDeCache(cabecera: string, porDefecto = '3600'): string {
  return /max-age=(\d+)/.exec(cabecera)?.[1] ?? porDefecto;
}

/** Ejecuta `fn` sobre `items` con `n` en paralelo, conservando el orden del resultado. */
export async function enParalelo<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(items.length);
  let siguiente = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      res[i] = await fn(items[i]!, i);
    }
  }));
  return res;
}

// ---------------------------------------------------------------- registro de ejecuciones

/**
 * `COPIAS/resultados/ejecuciones.jsonl`: una línea por cada escritura hecha (y
 * por cada prueba de SQL aceptada). SOLO CRECE: ningún simulacro lo reescribe.
 * Es lo que permite deshacer lo borrado (A1, purga de A2) aunque ya no esté en
 * Storage, y saber qué está en fase 1 o en fase 2.
 */
export const REGISTRO = () => join(COPIAS, 'resultados', 'ejecuciones.jsonl');

export async function anotarRegistro(x: Record<string, unknown>): Promise<void> {
  await mkdir(join(COPIAS, 'resultados'), { recursive: true });
  await appendFile(REGISTRO(), JSON.stringify({ fecha: new Date().toISOString(), ...x }) + '\n');
}

export async function leerRegistro(): Promise<Record<string, any>[]> {
  if (!existsSync(REGISTRO())) return [];
  return (await readFile(REGISTRO(), 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// ---------------------------------------------------------------- escritura (solo con --ejecutar)

export type Escritura =
  | { tipo: 'sobrescribir'; bucket: string; ruta: string; datos: Buffer; contentType: string; cacheControl: string }
  | { tipo: 'crear'; bucket: string; ruta: string; datos: Buffer; contentType: string; cacheControl: string }
  | { tipo: 'mover'; bucket: string; ruta: string; destino: string }
  | { tipo: 'borrar'; bucket: string; ruta: string };

/**
 * La ÚNICA puerta de escritura de estos scripts.
 *
 * Antes de escribir se niega:
 *  - sin `--ejecutar`;
 *  - si la copia local que se le pasa no existe o su sha256 no coincide con el
 *    que se apuntó al bajarla. (Comparar con lo que hay HOY en Storage lo hace
 *    quien llama, porque solo él sabe qué espera encontrar: el original en la
 *    fase 1, la versión nueva en la fase 2.)
 *
 * Después de escribir COMPRUEBA el resultado y, si no cuadra, lanza:
 *  - sobrescribir / crear: vuelve a bajar el objeto y compara el sha256 con lo subido;
 *  - mover: el destino existe y el origen ya no;
 *  - borrar: el objeto ya no existe.
 * En el registro de ejecuciones (con la ruta RELATIVA de la copia) anota la
 * INTENCIÓN antes de escribir y el resultado (`hecho` o `fallo`) después, para
 * que una escritura hecha a medias también se pueda deshacer.
 *
 * `sobrescribir` usa PUT, que en Storage solo actualiza un objeto que existe: así
 * no se crea nada por error. `crear` usa POST sin `x-upsert`, que falla si ya
 * existe: es lo que usa la marcha atrás para devolver algo que se borró.
 */
export async function escribirStorage(e: Escritura, copia: Descarga): Promise<void> {
  if (!EJECUTAR) throw new Error('Simulacro: escribirStorage no se llama sin --ejecutar.');
  if (!existsSync(copia.archivo)) throw new Error(`Sin copia local de ${e.bucket}/${e.ruta}: no se escribe.`);
  const local = createHash('sha256').update(await readFile(copia.archivo)).digest('hex');
  if (local !== copia.sha256) throw new Error(`La copia local de ${e.ruta} no coincide con su sha256: no se escribe.`);
  const ruta = e.ruta.split('/').map(encodeURIComponent).join('/');
  // INTENCIÓN, antes de tocar nada: si la escritura se hace y luego algo falla
  // (la comprobación, la red, el proceso), queda constancia y `restaurar` lo
  // cubre igual. Después se anota el resultado: `hecho` o `fallo`.
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const shaNuevo = e.tipo === 'sobrescribir' || e.tipo === 'crear' ? createHash('sha256').update(e.datos).digest('hex') : undefined;
  const asiento = {
    id, tipo: e.tipo, bucket: e.bucket, ruta: e.ruta, destino: e.tipo === 'mover' ? e.destino : undefined,
    copia_rel: copia.rel, copia_sha256: copia.sha256, copia_content_type: copia.contentType, copia_cache_control: copia.cacheControl,
    sha256_nuevo: shaNuevo, cache: 'cacheControl' in e ? e.cacheControl : undefined,
  };
  await anotarRegistro({ ...asiento, fase: 'intencion' });
  try {
    await escribirYComprobar(e, ruta, shaNuevo);
  } catch (err) {
    await anotarRegistro({ ...asiento, fase: 'fallo', error: String((err as Error)?.message ?? err).slice(0, 300) });
    throw err;
  }
  await anotarRegistro({ ...asiento, fase: 'hecho' });
}

/** La petición de escritura y la comprobación posterior (ver `escribirStorage`). */
async function escribirYComprobar(e: Escritura, ruta: string, shaNuevo: string | undefined): Promise<void> {
  let r: Response;
  if (e.tipo === 'sobrescribir' || e.tipo === 'crear') {
    r = await fetch(`${ENV.url}/storage/v1/object/${e.bucket}/${ruta}`, {
      method: e.tipo === 'sobrescribir' ? 'PUT' : 'POST',
      headers: { ...cabeceras(), 'Content-Type': e.contentType, 'cache-control': `max-age=${e.cacheControl}`,
        'x-upsert': e.tipo === 'sobrescribir' ? 'true' : 'false' },
      body: new Uint8Array(e.datos),
    });
  } else if (e.tipo === 'mover') {
    r = await fetch(`${ENV.url}/storage/v1/object/move`, {
      method: 'POST',
      headers: { ...cabeceras(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucketId: e.bucket, sourceKey: e.ruta, destinationKey: e.destino }),
    });
  } else {
    r = await fetch(`${ENV.url}/storage/v1/object/${e.bucket}`, {
      method: 'DELETE',
      headers: { ...cabeceras(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [e.ruta] }),
    });
  }
  if (!r.ok) throw new Error(`${e.tipo} ${e.bucket}/${e.ruta}: ${r.status} ${await r.text()}`);
  await r.arrayBuffer().catch(() => undefined);

  // Comprobación DESPUÉS de escribir.
  if (e.tipo === 'sobrescribir' || e.tipo === 'crear') {
    const ahora = await bajarEnMemoria(e);
    if (ahora.sha256 !== shaNuevo) throw new Error(`Tras escribir ${e.ruta}, Storage no devuelve lo subido. PARADO: revisar a mano.`);
  } else if (e.tipo === 'mover') {
    if (!(await existe({ bucket: e.bucket, ruta: e.destino })) || (await existe(e))) {
      throw new Error(`Tras mover ${e.ruta} -> ${e.destino}, el resultado no cuadra. PARADO: revisar a mano.`);
    }
  } else if (await existe(e)) {
    throw new Error(`Tras borrar ${e.ruta}, sigue existiendo. PARADO: revisar a mano.`);
  }
}

/** Termina el proceso con código 1 sin cortar en seco (en Windows `process.exit` dentro de un fetch daba 3221226505). */
export function fallar(e: unknown): void {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}

// ---------------------------------------------------------------- compresor real y SSIM

/**
 * Carpeta de la app cuyo compresor se usa. Por defecto, el worktree de la rama
 * `agente/P2-P4-ley-peso` (compresor por escalones). Se importa el archivo REAL,
 * no una copia: si el compresor cambia, el simulacro cambia con él.
 */
export const APP_COMPRESOR = resolve(argumento('--compresor') ?? process.env.LIMPIEZA_COMPRESOR
  ?? 'C:/Users/Tati/AppData/Local/Temp/claude/D--PROYECTO-IA-FUNNELISH/729bd79f-ccde-4f87-9305-376527c1bb11/scratchpad/wt-peso/quinchat');

export type TipoArchivo = 'foto-web' | 'foto-whatsapp' | 'grafico-texto' | 'png-alfa' | 'foto-entrante'
  | 'video-landing' | 'video-chat' | 'svg' | 'gif' | 'documento';

export interface ImagenOptimizada {
  buffer: Buffer; contentType: string; ext: string; optimizada: boolean; tipo: TipoArchivo; tope: number;
  cumple: boolean; codigo?: string; mensaje?: string; escalon?: string; fallo?: boolean;
}

export async function cargarCompresor(): Promise<{
  optimizarImagen: (b: Buffer, ct: string, tipo?: TipoArchivo) => Promise<ImagenOptimizada>;
  PERFILES: Record<TipoArchivo, { tope: number; bitrateMax?: number; ladoMinimo?: number; escalones?: { lado: number; calidad: number; croma444?: boolean }[] }>;
  CACHE_UN_ANO: string;
}> {
  const f = join(APP_COMPRESOR, 'lib', 'optimizar-imagen-servidor.ts');
  const l = join(APP_COMPRESOR, 'lib', 'ley-peso.ts');
  if (!existsSync(f) || !existsSync(l)) throw new Error(`No encuentro el compresor por escalones en ${APP_COMPRESOR}/lib (usa --compresor).`);
  const comp = await import(pathToFileURL(f).href);
  const ley = await import(pathToFileURL(l).href);
  return { optimizarImagen: comp.optimizarImagen, CACHE_UN_ANO: comp.CACHE_UN_ANO, PERFILES: ley.PERFILES };
}

/** El mismo `sharp` que usa el compresor (el de la app), para que las cifras cuadren. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sharp vive en la app, no en esta carpeta: sin sus tipos aquí
export function sharpDeLaApp(): any {
  return createRequire(join(APP_COMPRESOR, 'package.json'))('sharp');
}

/** Lado al que se compara: la pantalla de un móvil medio (430 px CSS × 3), como en MEDICION-TOPES. */
export const PANTALLA = 1290;
export const SSIM_MINIMO = 0.95;

/**
 * SSIM en escala de grises a 1290 px, ventanas de 8×8 (Wang et al. 2004).
 * Misma fórmula que `quinchat/pruebas/medir-topes.ts` y `media-api/comparar-perfiles.ts`
 * (allí no se exporta, por eso se repite aquí), para que las cifras se puedan comparar.
 */
export async function ssimImagen(referencia: Buffer, candidata: Buffer): Promise<number> {
  const sharp = sharpDeLaApp();
  const a = async (buf: Buffer, destino?: { w: number; h: number }) => {
    const redim = destino
      ? { width: destino.w, height: destino.h, fit: 'fill' as const }
      : { width: PANTALLA, height: PANTALLA, fit: 'inside' as const };
    const { data, info } = await sharp(buf, { failOn: 'none' }).rotate().flatten({ background: '#ffffff' })
      .resize(redim).greyscale().raw().toBuffer({ resolveWithObject: true });
    return { datos: data, w: info.width, h: info.height };
  };
  const ref = await a(referencia);
  const can = await a(candidata, { w: ref.w, h: ref.h });
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, V = 8;
  let suma = 0, bloques = 0;
  for (let by = 0; by + V <= ref.h; by += V) {
    for (let bx = 0; bx + V <= ref.w; bx += V) {
      let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (let y = 0; y < V; y++) {
        for (let x = 0; x < V; x++) {
          const i = (by + y) * ref.w + bx + x;
          const va = ref.datos[i]!, vb = can.datos[i]!;
          sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb;
        }
      }
      const n = V * V, ma = sa / n, mb = sb / n;
      const va = saa / n - ma * ma, vb = sbb / n - mb * mb, cov = sab / n - ma * mb;
      suma += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      bloques++;
    }
  }
  return bloques ? suma / bloques : 1;
}

// ---------------------------------------------------------------- zonas y salidas

/** De la ruta se deduce la zona y, con ella, el tipo de la LEY (`LEY-DE-PESO.md` §2). */
export function zonaDe(o: { bucket: string; ruta: string }): { zona: string; tipo: TipoArchivo } {
  if (o.bucket === 'catalogo-imagenes') return { zona: 'catalogo-imagenes', tipo: 'foto-whatsapp' };
  if (o.bucket === 'plantillas-images') return { zona: 'plantillas-images', tipo: 'foto-whatsapp' };
  const r = o.ruta;
  if (r.startsWith('_originales/')) return { zona: '_originales', tipo: 'foto-web' };
  if (r.startsWith('embudos/chat/')) return { zona: 'embudos/chat', tipo: 'foto-whatsapp' };
  if (r.startsWith('embudos/')) return { zona: 'embudos', tipo: 'foto-web' };
  if (r.startsWith('entrantes/')) return { zona: 'entrantes', tipo: 'foto-entrante' };
  // `ventas/` = lo que manda el cliente a la línea de ventas (lib/quinchat/ventas.ts), no fotos del bot.
  if (r.startsWith('ventas/')) return { zona: 'ventas', tipo: 'foto-entrante' };
  if (r.startsWith('packs/')) return { zona: 'packs', tipo: 'foto-whatsapp' };
  // `catalogo/marcas/` = fotos con marca de agua que el bot manda por WhatsApp (lib/watermark.ts).
  if (r.startsWith('catalogo/')) return { zona: 'catalogo', tipo: 'foto-whatsapp' };
  // Carpeta = teléfono del cliente (a veces con sufijo, p. ej. `57…@funnel/`).
  if (/^\d{8,}(@[\w-]+)?\//.test(r)) return { zona: 'chat-saliente', tipo: 'foto-whatsapp' };
  return { zona: r.split('/')[0] ?? '(raíz)', tipo: 'foto-web' };
}

export const MB = (n: number) => Math.round((n / 1048576) * 10) / 10;
export const KB = (n: number) => Math.round(n / 1024);

/**
 * Las carpetas del chat se llaman como el teléfono del cliente (`573001234567/`).
 * En el repo (que acaba en GitHub) las listas van con el número enmascarado; la
 * lista completa, con la que trabaja `--ejecutar`, se guarda junto a las copias,
 * fuera del repo. Y en cada ejecución se vuelve a calcular de todos modos.
 */
export const enmascarar = (s: string) => s.replace(/\b(57\d{3})\d{5}(\d{2})\b/g, '$1·····$2');

async function guardarDoble(nombre: string, texto: string): Promise<void> {
  await mkdir(join(COPIAS, 'listas'), { recursive: true });
  await writeFile(join(COPIAS, 'listas', nombre), texto);
  await writeFile(join(CARPETA_LIMPIEZA, nombre), enmascarar(texto));
}

export async function guardarCsv(nombre: string, filas: Record<string, unknown>[]): Promise<void> {
  if (!filas.length) { await guardarDoble(nombre, ''); return; }
  const cols = Object.keys(filas[0]!);
  const esc = (v: unknown) => {
    const s = v == null ? '' : Array.isArray(v) ? v.join(' | ') : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  await guardarDoble(nombre, [cols.join(','), ...filas.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\n') + '\n');
}

export async function guardarJson(nombre: string, datos: unknown): Promise<void> {
  await guardarDoble(nombre, JSON.stringify(datos, null, 2) + '\n');
}

export function cabecera(titulo: string): void {
  console.log(`\n${titulo}\n${'='.repeat(titulo.length)}`);
  console.log(EJECUTAR
    ? '!! MODO EJECUTAR: este script VA A ESCRIBIR en Supabase. Ctrl+C en 10 s si no tienes el visto bueno.'
    : 'Modo SIMULACRO: no se escribe nada en Supabase (para escribir: --ejecutar, con visto bueno de dirección).');
  console.log(`Copias locales: ${COPIAS}\n`);
}

export async function pausaSiEjecuta(): Promise<void> {
  if (EJECUTAR) await new Promise((ok) => setTimeout(ok, 10_000));
}

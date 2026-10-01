/**
 * A1 · `_originales/` (`TABLERO-AGENTES.md` §4, `ESTRATEGIA-PESO.md` P26).
 *
 *   npx tsx arreglos-supabase/limpieza/a1-originales.ts [--copias <dir>]            lista y condición (simulacro)
 *   npx tsx arreglos-supabase/limpieza/a1-originales.ts --bajar-copia               además baja el giga a disco (solo lectura)
 *   npx tsx arreglos-supabase/limpieza/a1-originales.ts --ejecutar --a34-hecho --tablas-revisadas <resultados-sql.txt>
 *
 * `_originales/` es el respaldo de la pasada de compresión de agosto. Se borra
 * AL FINAL: con el tope de 250 kB hay fotos ya comprimidas que hay que volver a
 * comprimir, y hacerlo desde el original es la única forma de no perder calidad
 * dos veces (HALLAZGO-dos-compresores, «Dependencia»).
 *
 * Para cada archivo dice:
 *   - si su gemelo vivo existe todavía;
 *   - si A3/A4 lo usa como fuente (entonces espera a que A3/A4 esté hecho y verificado);
 *   - si alguna tabla apunta a `_originales/` (no debería: las URLs de la base
 *     apuntan al archivo vivo; `media_optimizaciones` es el registro de agosto y no cuenta).
 *
 * Con `--ejecutar --a34-hecho` solo borra si:
 *   - ninguna columna (fuera del registro) contiene `_originales/`;
 *   - hay copia local verificada (sha256) de ESE archivo;
 *   - si era fuente de A3/A4, el archivo vivo ya no es el que se midió (es decir,
 *     A3/A4 ya lo sustituyó).
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ARGS, COPIAS, EJECUTAR, MB, SSIM_MINIMO, TABLAS_REGISTRO, bajar, bajarEnMemoria, cabecera, cargarReferencias, enParalelo,
  escribirStorage, exigirRevisionSql, fallar, guardarCsv, guardarJson, listarTodo, pausaSiEjecuta, ssimImagen, zonaDe,
} from './comun';

const BAJAR = ARGS.includes('--bajar-copia') || EJECUTAR;
const A34_HECHO = ARGS.includes('--a34-hecho');

async function main() {
  cabecera('A1 · _originales/');
  const [objetos, refs] = await Promise.all([listarTodo(), cargarReferencias()]);
  const vivos = new Map(objetos.filter((o) => o.bucket === 'chat-media' && !o.ruta.startsWith('_originales/')).map((o) => [o.ruta, o]));
  const originales = objetos.filter((o) => o.bucket === 'chat-media' && o.ruta.startsWith('_originales/'));

  // Lo que A3/A4 midió y piensa recomprimir DESDE el original (resultado del simulacro).
  const fuenteA34 = new Map<string, { sha256_hoy: string }>();
  // Vivos que YA están por debajo de SSIM 0,95 frente a su original (la pasada de
  // agosto los degradó). Su original es la única forma de recuperar la calidad.
  const degradados = new Map<string, number>();
  const archivoA34 = join(COPIAS, 'resultados', 'a34.jsonl');
  const vistos = new Set<string>();
  if (existsSync(archivoA34)) {
    for (const l of (await readFile(archivoA34, 'utf8')).split('\n').filter(Boolean)) {
      const x = JSON.parse(l) as { ruta: string; fuente: string; incluida: boolean; sha256_hoy: string; ssim_hoy: number | null };
      if (vistos.has(x.ruta)) continue; // vale la primera medición (la del original)
      vistos.add(x.ruta);
      if (x.fuente === 'original' && x.incluida) fuenteA34.set(x.ruta, { sha256_hoy: x.sha256_hoy });
      if (x.fuente === 'original' && x.ssim_hoy != null && x.ssim_hoy < SSIM_MINIMO) degradados.set(x.ruta, x.ssim_hoy);
    }
  } else console.log('AVISO: no hay resultados de A3/A4 en las copias; lanza antes a34-recomprimir-imagenes.ts.');

  const apuntan = refs.columnas.filter((c) => c.conOriginales > 0 && !TABLAS_REGISTRO.has(c.columna.split('.')[0]!));
  if (apuntan.length) console.log(`ATENCIÓN: columnas que contienen «_originales/»: ${apuntan.map((c) => `${c.columna} (${c.conOriginales})`).join(', ')}`);

  const filas = originales.map((o) => {
    const ruta = o.ruta.slice('_originales/'.length);
    const vivo = vivos.get(ruta);
    const { zona } = zonaDe({ bucket: 'chat-media', ruta });
    const condicion = !vivo ? 'el archivo vivo ya no existe: el original es la única copia (decidir con A2/A7)'
      : degradados.has(ruta) ? 'CONSERVAR: el vivo ya está bajo SSIM 0,95 frente al original; decidir si se recupera'
      : fuenteA34.has(ruta) ? 'fuente de A3/A4: borrar DESPUÉS de recomprimir y verificar'
      : 'no hace falta: el vivo no se recomprime desde aquí (al ejecutar se mide su SSIM antes de borrar)';
    return { ruta: o.ruta, zona, clase: o.mime.split('/')[0], mb: MB(o.bytes), bytes: o.bytes, vivo_kb: vivo ? Math.round(vivo.bytes / 1024) : '',
      condicion, fuente_a34: fuenteA34.has(ruta), ssim_vivo: degradados.get(ruta)?.toFixed(3) ?? '' };
  });
  const grupos = new Map<string, { n: number; b: number }>();
  for (const f of filas) { const g = grupos.get(f.condicion) ?? { n: 0, b: 0 }; g.n++; g.b += f.bytes; grupos.set(f.condicion, g); }
  console.log(`_originales/: ${originales.length} archivos · ${MB(originales.reduce((s, o) => s + o.bytes, 0))} MB`);
  for (const [c, g] of grupos) console.log(`  ${String(g.n).padStart(4)} · ${String(MB(g.b)).padStart(7)} MB  ${c}`);
  const porZona = new Map<string, { n: number; b: number }>();
  for (const f of filas) { const g = porZona.get(f.zona) ?? { n: 0, b: 0 }; g.n++; g.b += f.bytes; porZona.set(f.zona, g); }
  for (const [z, g] of porZona) console.log(`     ${z.padEnd(16)} ${String(g.n).padStart(4)} · ${MB(g.b)} MB`);

  await guardarCsv('a1-originales.csv', filas.map(({ bytes: _b, ...f }) => f));
  await guardarJson('a1-resumen.json', {
    fecha: refs.fecha, archivos: originales.length, mb: MB(originales.reduce((s, o) => s + o.bytes, 0)),
    columnasQueApuntan: apuntan.map((c) => c.columna), tablasIlegibles: refs.ilegibles.map((t) => t.tabla),
    porCondicion: Object.fromEntries([...grupos].map(([c, g]) => [c, { archivos: g.n, mb: MB(g.b) }])),
    porZona: Object.fromEntries([...porZona].map(([z, g]) => [z, { archivos: g.n, mb: MB(g.b) }])),
  });

  if (!BAJAR) return;
  // Copia a disco (1 GB). Es lectura: no necesita visto bueno, pero sí espacio.
  let hechas = 0;
  const copias = await enParalelo(originales, 6, async (o) => {
    const c = await bajar(o);
    if (++hechas % 100 === 0) console.log(`  copia ${hechas}/${originales.length}`);
    return c;
  });
  const mal = copias.filter((c, i) => c.bytes !== originales[i]!.bytes);
  console.log(`Copia local: ${copias.length - mal.length}/${copias.length} con el peso correcto.`);

  if (!EJECUTAR) return;
  if (!A34_HECHO) throw new Error('A1 se ejecuta DESPUÉS de A3/A4: pasa --a34-hecho cuando estén hechos y verificados.');
  // Igual que A2: sin la prueba de que se ejecutó el SQL (tablas ilegibles y consulta 4), no se borra nada.
  await exigirRevisionSql(refs);
  if (apuntan.length) throw new Error('Alguna tabla contiene «_originales/». Revisar antes de borrar.');
  if (mal.length) throw new Error(`${mal.length} copias locales no cuadran. Parado.`);
  await pausaSiEjecuta();
  for (const [i, o] of originales.entries()) {
    const ruta = o.ruta.slice('_originales/'.length);
    if (degradados.has(ruta)) { console.log(`SE QUEDA (el vivo está bajo SSIM 0,95): ${o.ruta}`); continue; }
    const vivo = await bajarEnMemoria({ bucket: 'chat-media', ruta });
    const f = fuenteA34.get(ruta);
    if (f && vivo.sha256 === f.sha256_hoy) { console.log(`SE QUEDA (A3/A4 aún no lo sustituyó): ${o.ruta}`); continue; }
    // Último control antes de borrar el respaldo: el vivo tiene que parecerse al original.
    if (o.mime.startsWith('image/')) {
      const s = await ssimImagen(await readFile(copias[i]!.archivo), vivo.buf);
      if (s < SSIM_MINIMO) { console.log(`SE QUEDA (vivo con SSIM ${s.toFixed(3)} frente al original): ${o.ruta}`); continue; }
    }
    await escribirStorage({ tipo: 'borrar', bucket: 'chat-media', ruta: o.ruta }, copias[i]!);
    console.log(`borrado ${o.ruta}`);
  }
}

main().catch(fallar);

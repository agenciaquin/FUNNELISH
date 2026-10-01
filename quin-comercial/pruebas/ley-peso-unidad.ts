/**
 * PRUEBA DEL MÓDULO `lib/ley-peso.ts` (topes, escalones, veredicto).
 *
 * ARCHIVO IDÉNTICO EN `quinchat/pruebas/` Y `quin-comercial/pruebas/`. No usa
 * `sharp`: solo importa el módulo real, así que corre igual en las dos apps.
 *
 *   cd quinchat && npx tsx pruebas/ley-peso-unidad.ts
 *
 * Las cifras esperadas aquí están escritas a propósito POR SEPARADO del módulo
 * y copiadas de `LEY-DE-PESO.md` §2: si alguien cambia un tope en el módulo sin
 * pasar por dirección, esta prueba lo delata. Es la única excepción a «nadie
 * escribe las cifras a mano», y es para vigilarlas.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ESCALONES_FOTO, ESCALONES_GRAFICO, LADO_MINIMO_IMAGEN, PERFILES,
  cumpleTope, formatearPeso, mensajeSupera, topeDe, type TipoArchivo,
} from '../lib/ley-peso.js';

let pasadas = 0;
let fallidas = 0;
function comprobar(caso: string, condicion: boolean, detalle = '') {
  if (condicion) { pasadas++; console.log(`  ok    ${caso.padEnd(46)} ${detalle}`); }
  else { fallidas++; console.log(`  FALLA ${caso.padEnd(46)} ${detalle}`); }
}

const KB = 1024;
const MB = 1024 * KB;

console.log('\n  PRUEBA DEL MÓDULO ley-peso\n');
console.log(`  ${'-'.repeat(78)}`);

// 1 · Topes de la LEY §2.
const esperados: [TipoArchivo, number][] = [
  ['foto-web', 250 * KB], ['foto-whatsapp', 250 * KB], ['grafico-texto', 400 * KB], ['png-alfa', 250 * KB],
  ['foto-entrante', 400 * KB], ['video-landing', 4 * MB], ['video-chat', 10 * MB], ['svg', 50 * KB],
  ['gif', 1.5 * MB], ['documento', 5 * MB],
];
for (const [tipo, tope] of esperados) comprobar(`tope de ${tipo}`, topeDe(tipo) === tope, formatearPeso(tope));
comprobar('hay un perfil por cada tipo esperado', Object.keys(PERFILES).length === esperados.length, `${Object.keys(PERFILES).length}`);

// 2 · Escalones y suelo.
const e = ESCALONES_FOTO.map((x) => `${x.lado}/q${x.calidad}`).join(' ');
comprobar('escalones de foto en el orden de la ley', e === '1920/q85 1920/q80 1920/q75 1600/q75 1440/q75', e);
comprobar('escalones de gráfico: q90 con croma 4:4:4', ESCALONES_GRAFICO.every((x) => x.calidad === 90 && x.croma444 === true));
comprobar('suelo de 1440 px', LADO_MINIMO_IMAGEN === 1440);
comprobar('ningún escalón baja del suelo',
  [...ESCALONES_FOTO, ...ESCALONES_GRAFICO].every((x) => x.lado >= LADO_MINIMO_IMAGEN));
comprobar('vídeo de landing: 720p y 2 Mb/s', PERFILES['video-landing'].ladoMinimo === 720 && PERFILES['video-landing'].bitrateMax === 2_000_000);
comprobar('vídeo de chat: no baja de 480p', PERFILES['video-chat'].ladoMinimo === 480);

// 3 · Veredicto: el peso exacto cumple, un byte más no.
{
  const justo = cumpleTope('foto-web', 250 * KB);
  const pasado = cumpleTope('foto-web', 250 * KB + 1);
  comprobar('peso exacto = cumple', justo.cumple && !justo.codigo && !justo.mensaje);
  comprobar('un byte más = SUPERA_TOPE', !pasado.cumple && pasado.codigo === 'SUPERA_TOPE');
  comprobar('cero bytes cumple', cumpleTope('documento', 0).cumple);
  comprobar('un peso NaN no se da por bueno', !cumpleTope('foto-web', NaN).cumple);
  comprobar('un peso negativo no se da por bueno', !cumpleTope('foto-web', -1).cumple);
  comprobar('el gráfico admite 400 kB y la foto no', cumpleTope('grafico-texto', 300 * KB).cumple && !cumpleTope('foto-web', 300 * KB).cumple);
}

// 4 · Mensajes: llevan el peso y el tope.
{
  const m = mensajeSupera('foto-web', 612 * KB);
  comprobar('mensaje de foto lleva peso y tope', m.includes('612 kB') && m.includes('250 kB'), m);
  const v = mensajeSupera('video-chat', Math.round(12.4 * MB));
  comprobar('mensaje de vídeo en MB', v.includes('12,4 MB') && v.includes('10,0 MB') && v.startsWith('El vídeo'), v);
  comprobar('formatearPeso redondea kB', formatearPeso(1536) === '2 kB', formatearPeso(1536));
}

// 5 · Idéntico en las dos apps (byte a byte).
{
  const aqui = dirname(fileURLToPath(import.meta.url));
  const raiz = join(aqui, '..', '..');
  try {
    const q = readFileSync(join(raiz, 'quinchat', 'lib', 'ley-peso.ts'));
    const c = readFileSync(join(raiz, 'quin-comercial', 'lib', 'ley-peso.ts'));
    comprobar('lib/ley-peso.ts idéntico en quinchat y quin-comercial', q.equals(c), `${q.length} bytes`);
  } catch (err) {
    comprobar('lib/ley-peso.ts existe en las dos apps', false, String((err as Error).message));
  }
}

console.log(`  ${'-'.repeat(78)}`);
console.log(`\n  ${pasadas} pasadas · ${fallidas} fallidas\n`);
if (fallidas) process.exit(1);

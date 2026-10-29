// Prueba rápida: npx tsx lib/klixmant-identificar.check.ts
import assert from 'node:assert/strict';
import { identificarCatalogos, type CatalogoKlixmant } from './klixmant-identificar';

const cats: CatalogoKlixmant[] = [
  { id: 973, nombre: 'NEW YORK', categoria: 'EQUIPOS', colores: ['Negro', 'Beige', 'Blanco marfil'], tipos: ['Buzo'] },
  { id: 23, nombre: 'CUELLO ALTO BARCELONA', categoria: 'EQUIPOS', colores: ['Azul', 'Granate'], tipos: ['Buzo'] },
  { id: 31, nombre: 'CUELLO ALTO BARCELONA', categoria: 'EQUIPOS', colores: ['Negro'], tipos: ['Buzo'] },
  { id: 501, nombre: 'DUCATI', categoria: 'MOTOS', colores: ['Rojo'], tipos: ['Chaqueta'] },
];
const ids = (t: string, act?: string[]) => identificarCatalogos(t, cats, act && new Set(act)).map(c => c.catalogo.id);

assert.deepEqual(ids('hola quiero el buzo new york'), [973]);
assert.deepEqual(ids('el de Barcelona porfa').sort(), [23, 31]);       // mismo nombre: salen los dos
assert.deepEqual(ids('barcelona negro'), [31, 23]);                    // el color desempata
assert.deepEqual(ids('tienen el de la ducati?', ['EQUIPOS']), []);     // categoría apagada
assert.deepEqual(ids('quiero uno blanco marfil del new york'), [973]);
assert.deepEqual(ids('hola buenas tardes'), []);
assert.deepEqual(ids('cuello alto'), []);                              // palabras genéricas no bastan
assert.deepEqual(ids('quiero un buzo'), []);
// Nombres reales: varios catálogos comparten una palabra ("BUZO NACIONAL GARRA", "...REY DE COPAS").
const nac: CatalogoKlixmant[] = [
  { id: 169, nombre: 'BUZO NACIONAL GARRA', categoria: 'EQUIPOS', colores: ['Negro'], tipos: [] },
  { id: 67, nombre: 'BUZO NACIONAL REY DE COPAS', categoria: 'EQUIPOS', colores: ['Negro'], tipos: [] },
  { id: 320, nombre: 'BUZO PASIÓN DE UN PUEBLO', categoria: 'EQUIPOS', colores: [], tipos: [] },
];
assert.deepEqual(identificarCatalogos('tienen el de nacional?', nac).map(c => c.catalogo.id).sort((a, b) => a - b), [67, 169]);
assert.equal(identificarCatalogos('el nacional rey de copas', nac)[0].catalogo.id, 67);
console.log('ok');

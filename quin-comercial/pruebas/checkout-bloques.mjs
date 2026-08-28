// Pruebas del checkout por bloques. Se corren con:
//   node --experimental-strip-types pruebas/checkout-bloques.mjs
// Para probarlas EN ROJO: rompe a propósito una regla en lib/checkout-bloques.ts
// y vuelve a correr. Si sigue en verde, la prueba no sirve.
import {
  CAMPOS_PEDIDO, bloquesDesdeConfig, nuevoBloqueCk, normalizarBloquesCk,
  camposDelCheckout, extrasDelCheckout, problemasDelCheckout, resumenDelPedido,
} from '../lib/checkout-bloques.ts';

let fallos = 0;
function ok(nombre, cond, detalle) {
  if (cond) { console.log(`  ✓ ${nombre}`); return; }
  fallos++; console.log(`  ✗ ${nombre}${detalle ? `\n      → ${detalle}` : ''}`);
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ids = c => c.map(x => x.id);

console.log('\nSIN BLOQUES: el checkout se comporta como hoy');
{
  const c = camposDelCheckout(null);
  ok('pide los 8 datos, en el orden de hoy (depto antes de municipio)',
    igual(ids(c), [...CAMPOS_PEDIDO]), `dio ${JSON.stringify(ids(c))}`);
  ok('el correo es el único opcional', c.filter(x => !x.obligatorio).map(x => x.id).join() === 'correo');
  ok('respeta un campo renombrado en la config',
    camposDelCheckout(null, { camposFijos: { municipio: { label: 'CIUDAD' } } }).find(x => x.id === 'municipio').label === 'CIUDAD');
  ok('respeta el correo oculto en la config',
    !ids(camposDelCheckout(null, { camposFijos: { correo: { oculto: true } } })).includes('correo'));
  ok('ocultar el correo no borra los demás',
    camposDelCheckout(null, { camposFijos: { correo: { oculto: true } } }).length === 7);
  ok('los campos propios de la config se siguen pidiendo',
    extrasDelCheckout(null, { camposExtra: [{ id: 'x', label: 'Punto de referencia', tipo: 'texto' }] }).length === 1);
}

console.log('\nACTIVAR LOS BLOQUES NO CAMBIA NADA');
{
  const cfg = {
    bloqueProducto: true, variablesDesplegable: true,
    camposFijos: { municipio: { label: 'CIUDAD' }, correo: { oculto: true } },
    camposExtra: [{ id: 'ref', label: 'Punto de referencia', tipo: 'texto', requerido: true }],
  };
  const bs = bloquesDesdeConfig(cfg);
  const antes = camposDelCheckout(null, cfg), despues = camposDelCheckout(bs);
  ok('pide exactamente los mismos datos que antes', igual(ids(antes), ids(despues)),
    `antes ${JSON.stringify(ids(antes))} · después ${JSON.stringify(ids(despues))}`);
  ok('conserva el campo renombrado', despues.find(x => x.id === 'municipio').label === 'CIUDAD');
  ok('conserva el correo oculto', !ids(despues).includes('correo'));
  ok('conserva el campo propio, con su id',
    igual(extrasDelCheckout(bs).map(x => x.id), ['ref']));
  ok('conserva que el campo propio era obligatorio', extrasDelCheckout(bs)[0].requerido === true);
  ok('conserva el modo desplegable de color y talla',
    bs.find(b => b.tipo === 'variantes').props.desplegable === true);
  ok('conserva el bloque de producto arriba', bs.some(b => b.tipo === 'producto'));
  ok('sin bloque de producto en la config, no lo mete',
    !bloquesDesdeConfig({ bloqueProducto: false }).some(b => b.tipo === 'producto'));
  ok('trae color y talla, botón y resumen', ['variantes', 'boton', 'resumen'].every(t => bs.some(b => b.tipo === t)));
  ok('cada bloque tiene su propio id', new Set(bs.map(b => b.id)).size === bs.length);
  ok('sin config no se rompe', bloquesDesdeConfig(null).length > 0);
}

console.log('\nCON BLOQUES MANDA LO ARMADO');
{
  const bs = [nuevoBloqueCk('variantes'), nuevoBloqueCk('campo', 'whatsapp'), nuevoBloqueCk('campo', 'nombre'), nuevoBloqueCk('boton')];
  ok('solo pide los campos que están puestos', igual(ids(camposDelCheckout(bs)), ['whatsapp', 'nombre']));
  ok('manda el orden en que quedaron', camposDelCheckout(bs)[0].id === 'whatsapp');

  const oculto = [nuevoBloqueCk('campo', 'nombre'), { ...nuevoBloqueCk('campo', 'barrio'), visible: false }];
  ok('un campo oculto no se pide', igual(ids(camposDelCheckout(oculto)), ['nombre']));

  const ren = nuevoBloqueCk('campo', 'municipio'); ren.props.etiqueta = 'CIUDAD';
  ok('renombrar cambia la etiqueta', camposDelCheckout([ren])[0].label === 'CIUDAD');
  ok('renombrar NO cambia el dato del pedido', camposDelCheckout([ren])[0].id === 'municipio');
  const vacia = nuevoBloqueCk('campo', 'barrio'); vacia.props.etiqueta = '   ';
  ok('etiqueta en blanco cae a la de siempre', camposDelCheckout([vacia])[0].label === 'BARRIO');

  ok('un campo repetido se pide una sola vez',
    camposDelCheckout([nuevoBloqueCk('campo', 'nombre'), nuevoBloqueCk('campo', 'nombre')]).length === 1);

  const opc = nuevoBloqueCk('campo', 'direccion'); opc.props.obligatorio = false;
  ok('se puede dejar un campo opcional', camposDelCheckout([opc])[0].obligatorio === false);
  ok('el correo nace opcional', camposDelCheckout([nuevoBloqueCk('campo', 'correo')])[0].obligatorio === false);
  ok('la dirección nace obligatoria', camposDelCheckout([nuevoBloqueCk('campo', 'direccion')])[0].obligatorio === true);
  ok('un bloque viejo sin "obligatorio" cae en lo de siempre',
    camposDelCheckout([{ id: 'x', tipo: 'campo', props: { campo: 'direccion' } }])[0].obligatorio === true);

  const inv = nuevoBloqueCk('campo'); inv.props.campo = 'color_favorito';
  ok('un dato que el pedido no conoce se ignora', camposDelCheckout([inv]).length === 0);
}

console.log('\nCAMPOS PROPIOS');
{
  const e = nuevoBloqueCk('campo_extra');
  e.props = { ...e.props, label: 'Punto de referencia', tipoCampo: 'notas', requerido: true };
  const r = extrasDelCheckout([e])[0];
  ok('se pide con su nombre y su tipo', r.label === 'Punto de referencia' && r.tipo === 'notas');
  ok('se respeta que sea obligatorio', r.requerido === true);
  const sinNombre = nuevoBloqueCk('campo_extra'); sinNombre.props.label = '   ';
  ok('un campo propio sin nombre no se le muestra al cliente', extrasDelCheckout([sinNombre]).length === 0);
  ok('y se avisa en el panel', problemasDelCheckout([sinNombre]).some(t => t.includes('sin nombre')));
  const raro = nuevoBloqueCk('campo_extra'); raro.props = { ...raro.props, label: 'X', tipoCampo: 'inventado' };
  ok('un tipo raro cae a texto, no rompe', extrasDelCheckout([raro])[0].tipo === 'texto');
  const dup = nuevoBloqueCk('campo_extra'); dup.props = { ...dup.props, id: 'ref', label: 'A' };
  const dup2 = nuevoBloqueCk('campo_extra'); dup2.props = { ...dup2.props, id: 'ref', label: 'B' };
  ok('dos campos propios con el mismo id se piden una sola vez', extrasDelCheckout([dup, dup2]).length === 1);
}

console.log('\nAVISOS DE LO QUE FALTA');
{
  ok('sin bloques no hay nada que avisar', problemasDelCheckout(null).length === 0);
  ok('el checkout recién activado no tiene problemas', problemasDelCheckout(bloquesDesdeConfig({})).length === 0);
  const q = t => bloquesDesdeConfig({}).filter(b => b.tipo !== t);
  ok('avisa si se quedó sin botón', problemasDelCheckout(q('boton')).some(t => t.includes('botón')));
  ok('avisa si se quedó sin color y talla', problemasDelCheckout(q('variantes')).some(t => t.includes('color y talla')));
  const sinDir = bloquesDesdeConfig({}).filter(b => !(b.tipo === 'campo' && b.props.campo === 'direccion'));
  ok('avisa si se quedó sin dirección', problemasDelCheckout(sinDir).some(t => t.includes('direccion')));
}

console.log('\nLOS NÚMEROS DEL RESUMEN');
{
  const r = resumenDelPedido({ nombre: 'RED BULL', precio: 139900, precioAntes: 195000 });
  ok('el total es el precio del producto', r.total === 139900);
  ok('guarda el precio tachado', r.precioAntes === 195000);
  const env = resumenDelPedido({ nombre: 'X', precio: 100000 }, { textoEnvio: 'GRATIS' });
  ok('el texto del envío NO altera el total', env.total === 100000);
  ok('el texto del envío se muestra tal cual', env.envio === 'GRATIS');
  ok('sin texto de envío no se inventa una línea', resumenDelPedido({ precio: 1 }).envio === null);
  const sp = resumenDelPedido({ nombre: 'X', precio: null });
  ok('sin precio queda un hueco, no un cero', sp.total === null && sp.precio === null);
  ok('un precio corrupto no se convierte en número', resumenDelPedido({ precio: NaN }).total === null);
  ok('sin variante no se inventa nada', resumenDelPedido(null).total === null);
}

console.log('\nLEER LO GUARDADO');
{
  ok('lo que no es una lista no son bloques', normalizarBloquesCk({ a: 1 }) === null);
  ok('una lista vacía no son bloques', normalizarBloquesCk([]) === null);
  ok('la basura se descarta', normalizarBloquesCk([{ tipo: 'boton' }, null, 5, { sinTipo: 1 }]).length === 1);
  ok('a un bloque sin id se le pone uno', !!normalizarBloquesCk([{ tipo: 'boton' }])[0].id);
  ok('se conserva "oculto"', normalizarBloquesCk([{ tipo: 'boton', visible: false }])[0].visible === false);
}

console.log(fallos === 0 ? '\n✅ TODO EN VERDE\n' : `\n❌ ${fallos} prueba(s) en rojo\n`);
process.exit(fallos === 0 ? 0 : 1);

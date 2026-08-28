// Pruebas del checkout por bloques. Se corren con:
//   node --experimental-strip-types pruebas/checkout-bloques.mjs
// Para probarlas EN ROJO: rompe a propósito una regla en lib/checkout-bloques.ts
// y vuelve a correr. Si sigue en verde, la prueba no sirve.
import {
  CAMPOS_PEDIDO, bloquesPorDefecto, nuevoBloqueCk, normalizarBloquesCk,
  camposDelCheckout, problemasDelCheckout, resumenDelPedido,
} from '../lib/checkout-bloques.ts';

let fallos = 0;
function ok(nombre, condicion, detalle) {
  if (condicion) { console.log(`  ✓ ${nombre}`); return; }
  fallos++; console.log(`  ✗ ${nombre}${detalle ? `\n      → ${detalle}` : ''}`);
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\nCAMPOS QUE PIDE EL CHECKOUT');

// 1. Sin bloques = checkout fijo de siempre: los 8 datos, todos obligatorios.
{
  const c = camposDelCheckout(null);
  ok('sin bloques pide los 8 datos de siempre', igual(c.map(x => x.id), [...CAMPOS_PEDIDO]), `dio ${JSON.stringify(c.map(x => x.id))}`);
  ok('sin bloques el correo es el único opcional, igual que hoy',
    c.filter(x => !x.obligatorio).map(x => x.id).join() === 'correo');
  ok('lista vacía se trata como "sin bloques"', camposDelCheckout([]).length === 8);
}

// 2. Con bloques manda lo armado: orden, etiqueta y cuáles existen.
{
  const bs = [
    nuevoBloqueCk('variantes'),
    nuevoBloqueCk('campo', 'whatsapp'),
    nuevoBloqueCk('campo', 'nombre'),
    nuevoBloqueCk('boton'),
  ];
  const c = camposDelCheckout(bs);
  ok('solo pide los campos que existen', igual(c.map(x => x.id), ['whatsapp', 'nombre']), `dio ${JSON.stringify(c.map(x => x.id))}`);
  ok('respeta el orden en que están puestos', c[0].id === 'whatsapp');
}

// 3. Un campo oculto no se le pide al cliente.
{
  const bs = [nuevoBloqueCk('campo', 'nombre'), { ...nuevoBloqueCk('campo', 'correo'), visible: false }];
  ok('un campo oculto no se pide', igual(camposDelCheckout(bs).map(x => x.id), ['nombre']));
}

// 4. Renombrar el campo cambia la etiqueta, no el dato que se guarda.
{
  const b = nuevoBloqueCk('campo', 'municipio');
  b.props.etiqueta = 'CIUDAD';
  const c = camposDelCheckout([b])[0];
  ok('renombrar cambia la etiqueta', c.label === 'CIUDAD');
  ok('renombrar NO cambia el dato del pedido', c.id === 'municipio');
  const vacia = nuevoBloqueCk('campo', 'barrio'); vacia.props.etiqueta = '   ';
  ok('etiqueta en blanco cae a la de siempre', camposDelCheckout([vacia])[0].label === 'BARRIO');
}

// 5. Un campo repetido se pide una sola vez.
{
  const bs = [nuevoBloqueCk('campo', 'nombre'), nuevoBloqueCk('campo', 'nombre')];
  ok('un campo repetido se pide una sola vez', camposDelCheckout(bs).length === 1);
}

// 6. "Obligatorio" apagado se respeta.
{
  const b = nuevoBloqueCk('campo', 'correo'); b.props.obligatorio = false;
  ok('se puede dejar un campo opcional', camposDelCheckout([b])[0].obligatorio === false);
  ok('el correo nace opcional, como hoy', camposDelCheckout([nuevoBloqueCk('campo', 'correo')])[0].obligatorio === false);
  ok('la dirección nace obligatoria', camposDelCheckout([nuevoBloqueCk('campo', 'direccion')])[0].obligatorio === true);
  const viejo = { id: 'x', tipo: 'campo', props: { campo: 'direccion' } };
  ok('un bloque viejo sin "obligatorio" cae en lo de siempre', camposDelCheckout([viejo])[0].obligatorio === true);
}

// 7. Un campo inventado no entra: el pedido no sabría dónde guardarlo.
{
  const b = nuevoBloqueCk('campo'); b.props.campo = 'color_favorito';
  ok('un campo que el pedido no conoce se ignora', camposDelCheckout([b]).length === 0);
}

console.log('\nEL CHECKOUT DE SIEMPRE, ESCRITO COMO BLOQUES');
{
  const d = bloquesPorDefecto();
  ok('trae los 8 datos de siempre, en el mismo orden',
    igual(camposDelCheckout(d).map(x => x.id), [...CAMPOS_PEDIDO]));
  ok('exige lo mismo que hoy (todo menos el correo)',
    camposDelCheckout(d).filter(x => !x.obligatorio).map(x => x.id).join() === 'correo');
  ok('trae color y talla, botón y resumen',
    ['variantes', 'boton', 'resumen'].every(t => d.some(b => b.tipo === t)));
  ok('el botón dice lo mismo que hoy', d.find(b => b.tipo === 'boton').props.texto === 'COMPLETAR MI PEDIDO');
  ok('no le sobra ni le falta un bloque suelto', d.length === 8 + 7);
  ok('cada bloque tiene su propio id', new Set(d.map(b => b.id)).size === d.length);
}

console.log('\nAVISOS DE LO QUE FALTA (no se adivina: se dice en pantalla)');
{
  ok('sin bloques no hay nada que avisar', problemasDelCheckout(null).length === 0);
  ok('el checkout de siempre no tiene problemas', problemasDelCheckout(bloquesPorDefecto()).length === 0);
  const sinBoton = bloquesPorDefecto().filter(b => b.tipo !== 'boton');
  ok('avisa si se quedó sin botón', problemasDelCheckout(sinBoton).some(t => t.includes('botón')));
  const sinDir = bloquesPorDefecto().filter(b => !(b.tipo === 'campo' && b.props.campo === 'direccion'));
  ok('avisa si se quedó sin dirección', problemasDelCheckout(sinDir).some(t => t.includes('direccion')));
  const sinVar = bloquesPorDefecto().filter(b => b.tipo !== 'variantes');
  ok('avisa si se quedó sin color y talla', problemasDelCheckout(sinVar).some(t => t.includes('color y talla')));
}

console.log('\nLOS NÚMEROS DEL RESUMEN');
{
  const r = resumenDelPedido({ nombre: 'RED BULL', precio: 139900, precioAntes: 195000 });
  ok('el total es el precio del producto', r.total === 139900);
  ok('guarda el precio tachado', r.precioAntes === 195000);
  const conEnvio = resumenDelPedido({ nombre: 'X', precio: 100000 }, { textoEnvio: 'GRATIS' });
  ok('el texto del envío NO altera el total', conEnvio.total === 100000);
  ok('el texto del envío se muestra tal cual', conEnvio.envio === 'GRATIS');
  ok('sin texto de envío no se inventa una línea', resumenDelPedido({ precio: 1 }).envio === null);
  const sinPrecio = resumenDelPedido({ nombre: 'X', precio: null });
  ok('sin precio queda un hueco, no un cero', sinPrecio.total === null && sinPrecio.precio === null);
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

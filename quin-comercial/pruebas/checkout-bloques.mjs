// Pruebas del checkout por bloques. Se corren con:
//   node --experimental-strip-types pruebas/checkout-bloques.mjs
// Para probarlas EN ROJO: rompe a propósito una regla en lib/checkout-bloques.ts
// y vuelve a correr. Si sigue en verde, la prueba no sirve.
import {
  CAMPOS_PEDIDO, bloquesDesdeConfig, nuevoBloqueCk, normalizarBloquesCk,
  camposDelCheckout, extrasDelCheckout, problemasDelCheckout, resumenDelPedido,
  camposDelBloque, campoFijo, campoPropio,
} from '../lib/checkout-bloques.ts';

let fallos = 0;
function ok(nombre, cond, detalle) {
  if (cond) { console.log(`  ✓ ${nombre}`); return; }
  fallos++; console.log(`  ✗ ${nombre}${detalle ? `\n      → ${detalle}` : ''}`);
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ids = c => c.map(x => x.id);
const formDe = bs => bs.find(b => b.tipo === 'formulario');
/** Arma un checkout con los campos que se le pasen. */
const conCampos = (campos) => {
  const f = nuevoBloqueCk('formulario'); f.props = { campos };
  return [nuevoBloqueCk('variantes'), f, nuevoBloqueCk('boton')];
};

console.log('\nSIN BLOQUES: el checkout se comporta como hoy');
{
  const c = camposDelCheckout(null);
  ok('pide los 8 datos, en el orden de hoy (depto antes de municipio)', igual(ids(c), [...CAMPOS_PEDIDO]), JSON.stringify(ids(c)));
  ok('el correo es el único opcional', c.filter(x => !x.obligatorio).map(x => x.id).join() === 'correo');
  ok('respeta un campo renombrado en la config',
    camposDelCheckout(null, { camposFijos: { municipio: { label: 'CIUDAD' } } }).find(x => x.id === 'municipio').label === 'CIUDAD');
  ok('respeta el correo oculto en la config',
    !ids(camposDelCheckout(null, { camposFijos: { correo: { oculto: true } } })).includes('correo'));
  ok('los campos propios de la config se siguen pidiendo',
    extrasDelCheckout(null, { camposExtra: [{ id: 'x', label: 'Punto de referencia', tipo: 'texto' }] }).length === 1);
}

console.log('\nLOS DATOS VIVEN EN UN SOLO MÓDULO: EL FORMULARIO');
{
  const bs = bloquesDesdeConfig({});
  ok('hay UN bloque de formulario, no ocho campos sueltos',
    bs.filter(b => b.tipo === 'formulario').length === 1);
  ok('ningún dato queda suelto como bloque',
    !bs.some(b => b.tipo === 'campo' || b.tipo === 'campo_extra'));
  ok('el formulario trae los 8 datos adentro', camposDelBloque(formDe(bs)).length === 8);
  ok('y se piden los 8', igual(ids(camposDelCheckout(bs)), [...CAMPOS_PEDIDO]));
  ok('si se quita el formulario, se avisa', problemasDelCheckout(bs.filter(b => b.tipo !== 'formulario')).some(t => t.includes('formulario')));
  ok('sin formulario no se pide ningún dato', camposDelCheckout(bs.filter(b => b.tipo !== 'formulario')).length === 0);
}

console.log('\nACTIVAR LOS BLOQUES NO CAMBIA NADA');
{
  const cfg = {
    bloqueProducto: true, variablesDesplegable: true,
    camposFijos: { municipio: { label: 'CIUDAD' }, correo: { oculto: true } },
    camposExtra: [{ id: 'ref', label: 'Punto de referencia', tipo: 'texto', requerido: true }],
  };
  const bs = bloquesDesdeConfig(cfg);
  ok('pide exactamente los mismos datos que antes',
    igual(ids(camposDelCheckout(null, cfg)), ids(camposDelCheckout(bs))));
  ok('conserva el campo renombrado', camposDelCheckout(bs).find(x => x.id === 'municipio').label === 'CIUDAD');
  ok('conserva el correo oculto', !ids(camposDelCheckout(bs)).includes('correo'));
  ok('el correo oculto sigue DENTRO del formulario (se puede volver a mostrar)',
    camposDelBloque(formDe(bs)).some(c => c.campo === 'correo' && c.visible === false));
  ok('conserva el campo propio con su id', igual(extrasDelCheckout(bs).map(x => x.id), ['ref']));
  ok('conserva que el campo propio era obligatorio', extrasDelCheckout(bs)[0].requerido === true);
  ok('conserva el modo desplegable', bs.find(b => b.tipo === 'variantes').props.desplegable === true);
  ok('conserva el bloque de producto arriba', bs.some(b => b.tipo === 'producto'));
  ok('sin bloque de producto en la config, no lo mete', !bloquesDesdeConfig({ bloqueProducto: false }).some(b => b.tipo === 'producto'));
  ok('sin config no se rompe', bloquesDesdeConfig(null).length > 0);
}

console.log('\nEDITAR EL FORMULARIO');
{
  const soloDos = conCampos([campoFijo('whatsapp'), campoFijo('nombre')]);
  ok('solo pide los datos que quedaron', igual(ids(camposDelCheckout(soloDos)), ['whatsapp', 'nombre']));
  ok('manda el orden en que quedaron', camposDelCheckout(soloDos)[0].id === 'whatsapp');

  const ocultoC = campoFijo('barrio'); ocultoC.visible = false;
  ok('un dato oculto no se pide', igual(ids(camposDelCheckout(conCampos([campoFijo('nombre'), ocultoC]))), ['nombre']));

  const ren = campoFijo('whatsapp'); ren.label = 'CELULAR';
  const rb = conCampos([ren]);
  ok('renombrar cambia la etiqueta', camposDelCheckout(rb)[0].label === 'CELULAR');
  ok('renombrar NO cambia el dato del pedido', camposDelCheckout(rb)[0].id === 'whatsapp');
  const vacia = campoFijo('barrio'); vacia.label = '   ';
  ok('etiqueta en blanco cae a la de siempre', camposDelCheckout(conCampos([vacia]))[0].label === 'BARRIO');

  ok('un dato repetido se pide una sola vez', camposDelCheckout(conCampos([campoFijo('nombre'), campoFijo('nombre')])).length === 1);

  const opc = campoFijo('direccion'); opc.obligatorio = false;
  ok('se puede dejar un dato opcional', camposDelCheckout(conCampos([opc]))[0].obligatorio === false);
  ok('el correo nace opcional', campoFijo('correo').obligatorio === false);
  ok('la dirección nace obligatoria', campoFijo('direccion').obligatorio === true);
  ok('un campo viejo sin "obligatorio" cae en lo de siempre',
    camposDelCheckout(conCampos([{ key: 'direccion', campo: 'direccion', label: 'DIRECCIÓN' }]))[0].obligatorio === true);

  ok('un dato que el pedido no conoce se ignora',
    camposDelCheckout(conCampos([{ key: 'x', campo: 'color_favorito', label: 'X' }])).length === 0);
}

console.log('\nCAMPOS PROPIOS');
{
  const e = campoPropio(); e.label = 'Punto de referencia'; e.tipo = 'notas'; e.obligatorio = true;
  const r = extrasDelCheckout(conCampos([e]))[0];
  ok('se pide con su nombre y su tipo', r.label === 'Punto de referencia' && r.tipo === 'notas');
  ok('se respeta que sea obligatorio', r.requerido === true);
  ok('cada campo propio nace con su propio id', campoPropio().key !== campoPropio().key);
  const sn = campoPropio(); sn.label = '   ';
  ok('un campo propio sin nombre no se le muestra al cliente', extrasDelCheckout(conCampos([sn])).length === 0);
  ok('y se avisa en el panel', problemasDelCheckout(conCampos([sn])).some(t => t.includes('sin nombre')));
  const raro = campoPropio(); raro.label = 'X'; raro.tipo = 'inventado';
  ok('un tipo raro cae a texto, no rompe', extrasDelCheckout(conCampos([raro]))[0].tipo === 'texto');
  const d1 = campoPropio(); d1.key = 'ref'; d1.label = 'A';
  const d2 = campoPropio(); d2.key = 'ref'; d2.label = 'B';
  ok('dos campos propios con el mismo id se piden una sola vez', extrasDelCheckout(conCampos([d1, d2])).length === 1);
  ok('un campo propio oculto no se pide',
    extrasDelCheckout(conCampos([{ ...campoPropio(), label: 'X', visible: false }])).length === 0);
}

console.log('\nCOMPATIBILIDAD CON LA VERSIÓN ANTERIOR (campos sueltos)');
{
  const viejo = [
    { id: 'a', tipo: 'titulo', props: {} },
    { id: 'b', tipo: 'campo', props: { campo: 'nombre', etiqueta: 'TU NOMBRE', obligatorio: true } },
    { id: 'c', tipo: 'campo', props: { campo: 'correo' }, visible: false },
    { id: 'd', tipo: 'campo_extra', props: { id: 'ref', label: 'Referencia', tipoCampo: 'notas', requerido: true } },
    { id: 'e', tipo: 'boton', props: {} },
  ];
  const mig = normalizarBloquesCk(viejo);
  ok('los campos sueltos se juntan en un formulario', mig.filter(b => b.tipo === 'formulario').length === 1);
  ok('no queda ningún campo suelto', !mig.some(b => b.tipo === 'campo' || b.tipo === 'campo_extra'));
  ok('el formulario queda donde estaba el primer dato', mig[1].tipo === 'formulario');
  ok('conserva el dato renombrado', camposDelCheckout(mig)[0].label === 'TU NOMBRE');
  ok('conserva el dato oculto', camposDelBloque(formDe(mig)).some(c => c.campo === 'correo' && c.visible === false));
  ok('conserva el campo propio', extrasDelCheckout(mig)[0].label === 'Referencia');
  ok('conserva los demás bloques', igual(mig.map(b => b.tipo), ['titulo', 'formulario', 'boton']));
}

console.log('\nAVISOS DE LO QUE FALTA');
{
  ok('sin bloques no hay nada que avisar', problemasDelCheckout(null).length === 0);
  ok('el checkout por defecto no tiene problemas', problemasDelCheckout(bloquesDesdeConfig({})).length === 0);
  const q = t => bloquesDesdeConfig({}).filter(b => b.tipo !== t);
  ok('avisa si se quedó sin botón', problemasDelCheckout(q('boton')).some(t => t.includes('botón')));
  ok('avisa si se quedó sin color y talla', problemasDelCheckout(q('variantes')).some(t => t.includes('color y talla')));
  const sinDir = bloquesDesdeConfig({});
  const f = formDe(sinDir); f.props.campos = f.props.campos.filter(c => c.campo !== 'direccion');
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
  ok('un formulario sin campos no rompe', camposDelCheckout([{ id: 'f', tipo: 'formulario', props: {} }]).length === 0);
}

console.log(fallos === 0 ? '\n✅ TODO EN VERDE\n' : `\n❌ ${fallos} prueba(s) en rojo\n`);
process.exit(fallos === 0 ? 0 : 1);

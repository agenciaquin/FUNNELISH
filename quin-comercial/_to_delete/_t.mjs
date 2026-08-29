import * as m from './lib/checkout-bloques.ts';
const b = m.bloquesDesdeConfig({});
console.log('bloques:', b.map(x=>x.tipo).join(' · '));
console.log('campos :', m.camposDelCheckout(b).map(c=>c.id+(c.obligatorio?'*':'')).join(', '));
const cfg = { camposFijos:{ municipio:{label:'CIUDAD'}, correo:{oculto:true} }, camposExtra:[{id:'ref',label:'Punto de referencia',tipo:'texto',requerido:true}] };
const b2 = m.bloquesDesdeConfig(cfg);
console.log('con config:', m.camposDelCheckout(b2).map(c=>c.id+':'+c.label).join(' | '));
console.log('extras   :', m.extrasDelCheckout(b2).map(e=>e.id+':'+e.label+(e.requerido?'*':'')).join(' | '));
// migración desde la versión anterior
const viejo = [{id:'a',tipo:'titulo',props:{}},{id:'b',tipo:'campo',props:{campo:'nombre',etiqueta:'TU NOMBRE'}},{id:'c',tipo:'campo_extra',props:{id:'ref',label:'Referencia',tipoCampo:'notas',requerido:true}},{id:'d',tipo:'boton',props:{}}];
const mig = m.normalizarBloquesCk(viejo);
console.log('migrado  :', mig.map(x=>x.tipo).join(' · '), '| campos:', m.camposDelCheckout(mig).map(c=>c.label).join(','), '| extras:', m.extrasDelCheckout(mig).map(e=>e.label).join(','));

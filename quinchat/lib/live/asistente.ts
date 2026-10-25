// ASISTENTE DE COMENTARIOS — MAQUETA (respuestas simuladas, sin IA real y sin costo).
//
// Esta es la ÚNICA función que hay que cambiar para conectar la IA de verdad:
// reemplazar el cuerpo de responderPregunta() por una llamada a una ruta del servidor
// (p. ej. POST /api/live/pregunta) que use Claude con la ficha del producto como único contexto.
//
// Reglas que debe respetar también la versión real:
//  · responder SOLO con datos de la ficha / del catálogo; si falta el dato, decirlo y ofrecer WhatsApp;
//  · respuestas cortas (1 o 2 frases);
//  · mostrarse siempre con la insignia "Asistente IA" (nunca como si fuera una persona o un cliente);
//  · límite de preguntas por visitante y filtro de spam/groserías en el servidor.

import type { ProductoLive } from './tipos';
import { precioCOP } from './formato';

export type Tema = 'tela' | 'cuidados' | 'talla' | 'colores' | 'precio' | 'envio' | 'pago';

export interface RespuestaIA {
  texto: string;
  /** true cuando el asistente no tiene el dato: se muestra el enlace a WhatsApp. */
  sinDato: boolean;
  tema: Tema | null;
}

export const MAX_PREGUNTAS_IA = 5;

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const TEMAS: Array<[Tema, RegExp]> = [
  ['cuidados', /\b(lav|plancha|encog|destin|secad|cuidado)/],
  ['tela', /\b(tela|material|felpa|algodon|poliester|grueso|abrigad|calient|suave|pica|interior|forro)/],
  ['talla', /\b(talla|medida|queda|grande|pequen|oversize|ajust|holgad|xl|largo)/],
  ['colores', /\b(color|negro|gris|beige|azul|vino|verde|hueso|cafe|grafito|blanco)/],
  ['precio', /\b(precio|cuanto|vale|cuesta|costo|descuento|pack|promo|oferta|barato)/],
  ['envio', /\b(envio|envian|llega|demora|tarda|despacho|domicilio|ciudad|municipio|coordinadora|interrapidisimo)/],
  ['pago', /\b(pago|pagar|contraentrega|contra entrega|tarjeta|transferencia|nequi|efectivo|daviplata)/],
];

/** ¿El comentario parece una pregunta que el asistente debe atender? */
export function esPregunta(texto: string): boolean {
  const t = sinTildes(texto);
  return /[?¿]/.test(texto) || /^(tienen|hay|viene|puedo|se puede|como|que|cual|cuanto|de que|en que|donde|cuando)\b/.test(t) || TEMAS.some(([, re]) => re.test(t));
}

const PEDIR = ' ¿Lo pides? Toca «Comprar ahora» 🛍️';

export async function responderPregunta(pregunta: string, p: ProductoLive): Promise<RespuestaIA> {
  await new Promise(r => setTimeout(r, 900)); // simula el tiempo de la IA
  const t = sinTildes(pregunta);
  const tema = TEMAS.find(([, re]) => re.test(t))?.[0] ?? null;
  const sin = (texto: string, tm: Tema | null = tema): RespuestaIA => ({ texto, sinDato: true, tema: tm });
  const ok = (texto: string): RespuestaIA => ({ texto, sinDato: false, tema });

  switch (tema) {
    case 'tela':
      return p.ficha?.tela ? ok(`El ${p.nombre} es de ${p.ficha.tela}.${PEDIR}`) : sin('No tengo a la mano la tela de este buzo. Te la confirmo por WhatsApp.');
    case 'cuidados':
      return p.ficha?.cuidados ? ok(`Para cuidarlo: ${p.ficha.cuidados}.`) : sin('No tengo las instrucciones de lavado de este buzo. Te las confirmo por WhatsApp.');
    case 'talla':
      return ok(`Lo tenemos en tallas ${p.tallas.join(', ')}. Si dudas entre dos, escríbenos por WhatsApp y te asesoramos.`);
    case 'colores':
      return ok(`Este buzo viene en ${p.colores.map(c => c.nombre.toLowerCase()).join(', ')}. Elige el tuyo en «Comprar ahora».`);
    case 'precio':
      return ok(p.promo
        ? `Cuesta ${precioCOP(p.precio)}, y el ${p.promo.etiqueta} sale en ${precioCOP(p.promo.precioPack)} por ${p.promo.unidades} buzos.`
        : `Cuesta ${precioCOP(p.precio)}.${PEDIR}`);
    case 'envio':
      return ok('Enviamos a todo Colombia con Coordinadora, Interrapidísimo o Envía. El tiempo depende de tu ciudad y te lo confirmamos por WhatsApp.');
    case 'pago':
      return /tarjeta|transferencia|nequi|daviplata/.test(t)
        ? sin('Por ahora el pedido es contraentrega. Si prefieres otro medio de pago, te ayudamos por WhatsApp.')
        : ok('El pago es contraentrega: pagas cuando recibes tu pedido.');
    default:
      return sin('No tengo ese dato a la mano. Te respondemos por WhatsApp.', null);
  }
}

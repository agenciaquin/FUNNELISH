import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { responderIA } from '@/lib/ia-rotacion';

export const dynamic = 'force-dynamic';

/**
 * ENTREVISTA CONVERSACIONAL para armar el bot (una llamada de IA por turno).
 * Quino entrevista al dueño: hace UNA pregunta a la vez, si el dueño tiene una
 * duda se la aclara, y captura los datos que va dando. Cuando ya tiene todo,
 * marca listo=true para que el panel compile el entrenamiento.
 *
 * Body: {
 *   campos:   [{ clave, etiqueta, ejemplo?, pregunta? }],  // datos a reunir
 *   valores:  { <clave>: <valor> },                        // lo ya reunido
 *   mensajes: [{ de:'quino'|'cliente', texto }],           // conversación
 * }
 * Devuelve: { captura: { <clave>: <valor> }, mensaje: string, listo: boolean }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();

  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const campos: any[]   = Array.isArray(b?.campos) ? b.campos : [];
  const valores: Record<string, string> = (b?.valores && typeof b.valores === 'object') ? b.valores : {};
  const mensajes: any[] = Array.isArray(b?.mensajes) ? b.mensajes : [];
  // Archivos que el dueño adjuntó: texto ya extraído (PDF/Word/Excel/txt) e imágenes.
  const adjunto: string = String(b?.adjunto ?? '').trim();
  const imagenes: any[] = Array.isArray(b?.imagenes) ? b.imagenes.filter((i: any) => i?.base64) : [];

  // Datos que aún faltan (los que no tienen valor).
  const pendientes = campos.filter(c => !String(valores?.[c.clave] ?? '').trim());
  const listaPendientes = pendientes.map(c =>
    `- ${c.clave} — ${c.etiqueta}${c.ejemplo ? ` (ej: ${c.ejemplo})` : ''}`).join('\n') || '(ninguno, ya está todo)';
  const listaHechos = campos
    .filter(c => String(valores?.[c.clave] ?? '').trim())
    .map(c => `- ${c.clave}: ${valores[c.clave]}`).join('\n') || '(ninguno aún)';

  const convo = mensajes.map(m => `${m.de === 'cliente' ? 'Dueño' : 'Quino'}: ${m.texto}`).join('\n');

  const sys =
    'Eres Quino, un asistente cálido y experto que ENTREVISTA al dueño de un negocio para armar el cerebro de su bot de ventas de WhatsApp. ' +
    'Tu meta es reunir los DATOS que faltan, de a UNO por vez, de forma natural y humana.\n\n' +
    `DATOS QUE AÚN NECESITAS (clave — para qué sirve):\n${listaPendientes}\n\n` +
    `DATOS QUE YA TIENES:\n${listaHechos}\n\n` +
    'REGLAS:\n' +
    '- Sé INTELIGENTE y guía al dueño como un experto en ventas: no solo preguntes, orienta (un consejo corto o un ejemplo útil cuando ayude). VARÍA tus frases; NUNCA suenes robótico ni repitas siempre el mismo saludo o cierre.\n' +
    '- Haz UNA sola pregunta a la vez, corta y amable. No abrumes ni hagas varias preguntas juntas.\n' +
    '- Si el dueño te hace una PREGUNTA o duda (ej: "¿qué pongo aquí?", "¿esto para qué sirve?", "¿qué me recomiendas?"), respóndele claro y con un ejemplo, y luego vuelve a pedirle el dato que falta. NO inventes datos de SU negocio; si pide una recomendación, da un ejemplo genérico y aclara que él decide.\n' +
    '- Si el dueño te DA uno o varios datos en su mensaje, captúralos. Usa EXACTAMENTE la clave que corresponde de la lista. Puede dar varios a la vez.\n' +
    '- Si el dueño dice que no sabe o pide saltar un dato, no insistas: déjalo vacío (no lo captures) y pasa al siguiente que falte.\n' +
    '- Cuando ya no falte ningún dato de la lista, pon "listo": true y despídete diciendo que vas a armar su bot.\n\n' +
    'Responde SIEMPRE en JSON válido y NADA fuera del JSON, con esta forma EXACTA:\n' +
    '{"captura": { "<clave>": "<valor limpio>" }, "mensaje": "<lo que le dices al dueño>", "listo": false}\n' +
    '- "captura": solo los datos que aportó el ÚLTIMO mensaje del dueño (objeto vacío {} si fue una duda, saludo o no dio datos).\n' +
    '- "mensaje": cálido, 1 o 2 frases; incluye la aclaración (si hubo duda) y/o la siguiente pregunta.\n' +
    '- "listo": true solo cuando ya tienes TODOS los datos.';

  const bloqueAdjunto = adjunto
    ? `\n\nEL DUEÑO ADJUNTÓ UN DOCUMENTO CON INFO DE SU NEGOCIO. Léelo y extrae de ahí los datos que sirvan (precios, productos, envíos, pagos…):\n"""\n${adjunto}\n"""\n`
    : '';
  const bloqueImg = imagenes.length
    ? '\n\nEl dueño adjuntó una o varias IMÁGENES (fotos de catálogo, lista de precios, etc.). Léelas y extrae los datos que sirvan.'
    : '';

  const userContent =
    `CONVERSACIÓN HASTA AHORA:\n${convo || '(vacía)'}\n${bloqueAdjunto}${bloqueImg}\n` +
    'Responde al ÚLTIMO mensaje del dueño siguiendo las reglas. Si adjuntó un documento o imagen, captura de ahí todos los datos que reconozcas. Devuelve solo el JSON.';

  try {
    const r = await responderIA(tid ?? null, {
      messages: [{ role: 'user', content: userContent }],
      systemPrompt: sys,
      maxTokens: 900,
      imagenes: imagenes.length ? imagenes : undefined,
    });
    let out = (r?.message ?? '').trim();
    out = out.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();

    // Extrae el JSON de forma robusta (por si el modelo agrega texto alrededor).
    let parsed: any = null;
    try { parsed = JSON.parse(out); } catch {
      const a = out.indexOf('{'); const z = out.lastIndexOf('}');
      if (a >= 0 && z > a) { try { parsed = JSON.parse(out.slice(a, z + 1)); } catch { /* */ } }
    }

    if (parsed && typeof parsed === 'object') {
      // Solo aceptamos claves que existan en los campos (evita basura).
      const clavesOk = new Set(campos.map(c => c.clave));
      const capturaLimpia: Record<string, string> = {};
      const cap = parsed.captura && typeof parsed.captura === 'object' ? parsed.captura : {};
      for (const [k, v] of Object.entries(cap)) {
        if (clavesOk.has(k) && String(v ?? '').trim()) capturaLimpia[k] = String(v).trim();
      }
      // ¿Quedó todo lleno después de esta captura? → listo (aunque el modelo no lo marque).
      const faltanAun = campos.filter(c =>
        !String(valores?.[c.clave] ?? '').trim() && !String(capturaLimpia[c.clave] ?? '').trim());
      const listo = parsed.listo === true || faltanAun.length === 0;

      return NextResponse.json({
        captura: capturaLimpia,
        mensaje: String(parsed.mensaje ?? '').trim() || '¡Anotado! 🙌 ¿Seguimos con el siguiente dato?',
        listo,
      });
    }

    // Si no vino JSON, tratamos toda la salida como una aclaración/pregunta.
    return NextResponse.json({ captura: {}, mensaje: out || '¿Me lo confirmas, por favor? 🙌', listo: false });
  } catch {
    return NextResponse.json({ captura: {}, mensaje: 'Uy, ahora mismo no pude procesarlo. ¿Me lo repites? 🙏', listo: false });
  }
}

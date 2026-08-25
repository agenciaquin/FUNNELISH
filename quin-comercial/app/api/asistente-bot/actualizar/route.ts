import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { responderIA } from '@/lib/ia-rotacion';

export const dynamic = 'force-dynamic';

/**
 * Actualiza UN dato del entrenamiento existente, conversando. UNA llamada de IA.
 * Body: { actual, mensajes:[{de:'quino'|'cliente',texto}] }
 * La IA decide: si el dueño ya dio el dato nuevo, aplica el cambio; si solo dijo
 * QUÉ quiere cambiar, pregunta el nuevo valor de forma humana.
 * Devuelve { tipo:'aplicar', entrenamiento } | { tipo:'preguntar', pregunta }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const actual = String(b?.actual ?? '');
  const mensajes: any[] = Array.isArray(b?.mensajes) ? b.mensajes : [];
  const adjunto: string = String(b?.adjunto ?? '').trim();
  const imagenes: any[] = Array.isArray(b?.imagenes) ? b.imagenes.filter((i: any) => i?.base64) : [];
  if (!actual) return NextResponse.json({ error: 'sin entrenamiento actual' }, { status: 400 });

  const convo = mensajes.map(m => `${m.de === 'cliente' ? 'Dueño' : 'Quino'}: ${m.texto}`).join('\n');
  const bloqueAdjunto = adjunto
    ? `\n\nEL DUEÑO ADJUNTÓ UN DOCUMENTO con datos de su negocio. Léelo y, si trae valores nuevos (precios, productos, envíos…), aplícalos al entrenamiento:\n"""\n${adjunto}\n"""\n`
    : '';
  const bloqueImg = imagenes.length
    ? '\n\nEl dueño adjuntó IMÁGENES (foto de catálogo, lista de precios…). Léelas y aplica los datos que traigan.'
    : '';

  const sys =
    'Eres Quino, un asistente EXPERTO y muy humano que ayuda al DUEÑO de un negocio a ajustar el entrenamiento (el "cerebro") de su bot de ventas por WhatsApp. ' +
    'Hablas cálido, claro y natural, como un colega que sabe de ventas; NUNCA sonando robótico ni repetitivo: varía tus frases, no confirmes ni preguntes siempre igual. ' +
    'Guías al dueño con criterio: si el dato está claro lo aplicas; si falta algo o hay una duda, la resuelves y lo orientas.\n\n' +
    'Te doy el ENTRENAMIENTO ACTUAL y la CONVERSACIÓN con el dueño. Decide UNA de dos cosas y responde EXACTAMENTE en ese formato (nada fuera de él):\n\n' +
    '1) Si el dueño YA dio el dato nuevo y está claro qué cambiar → responde:\n' +
    'APLICAR|||<confirmacion>|||<entrenamiento completo actualizado>\n' +
    '   - <confirmacion>: mensaje corto, cálido y VARIADO para el dueño que diga EXACTAMENTE qué cambiaste (el dato y su nuevo valor) y cierre invitando al siguiente paso de forma natural (no repitas siempre la misma frase). Ej: "Listo, cambié la ubicación: ahora tu tienda queda en Cúcuta 📍 ¿Ajustamos algo más?" / "Hecho ✅ Dejé el precio de 1 unidad en $95.000. ¿Seguimos con otro dato?".\n' +
    '   - <entrenamiento completo actualizado>: TODO el entrenamiento con el cambio aplicado, tocando SOLO ese dato y respetando los bloques entre corchetes. Sin comillas ni comentarios.\n\n' +
    '2) Si el dueño solo dijo QUÉ quiere cambiar pero falta el nuevo valor, o su mensaje es un saludo/duda/genérico → responde:\n' +
    'PREGUNTAR|||<mensaje>\n' +
    '   - <mensaje>: cálido y con criterio. Si es una duda, acláraselo con un ejemplo; si falta el valor, pídeselo de forma natural (varía el estilo, no suenes a formulario).\n\n' +
    'Reglas: No inventes datos del negocio. No cambies nada que el dueño no pidió. Si el dueño pregunta cómo funciona algo, respóndele con PREGUNTAR (aclarando), no apliques cambios.';

  const userContent = `ENTRENAMIENTO ACTUAL:\n${actual}\n\nCONVERSACIÓN:\n${convo}${bloqueAdjunto}${bloqueImg}`;

  try {
    const r = await responderIA(tid ?? null, {
      messages: [{ role: 'user', content: userContent }],
      systemPrompt: sys,
      maxTokens: 2000,
      imagenes: imagenes.length ? imagenes : undefined,
    });
    let out = (r?.message ?? '').trim();
    out = out.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();

    if (out.startsWith('APLICAR|||')) {
      // Formato: APLICAR|||<confirmacion>|||<entrenamiento>. La confirmación es lo
      // que se le muestra al dueño (dice qué cambió); el entrenamiento es lo que se guarda.
      const rest = out.slice('APLICAR|||'.length);
      const corte = rest.indexOf('|||');
      let confirmacion = '';
      let entrenamiento = '';
      if (corte >= 0) {
        confirmacion  = rest.slice(0, corte).trim();
        entrenamiento = rest.slice(corte + 3).trim();
      } else {
        entrenamiento = rest.trim(); // compatibilidad: sin confirmación
      }
      // Salvaguarda: el resultado debe parecerse en tamaño al actual.
      if (entrenamiento.length >= actual.length * 0.5) {
        return NextResponse.json({
          tipo: 'aplicar',
          entrenamiento,
          confirmacion: confirmacion || 'Listo ✅ Apliqué ese cambio en tu bot.',
        });
      }
    }
    if (out.startsWith('PREGUNTAR|||')) {
      return NextResponse.json({ tipo: 'preguntar', pregunta: out.slice('PREGUNTAR|||'.length).trim() || '¿Qué dato quieres actualizar y cuál es su nuevo valor?' });
    }
    // Si no respetó el formato, lo tratamos como pregunta de aclaración.
    return NextResponse.json({ tipo: 'preguntar', pregunta: '¿Me confirmas qué dato quieres cambiar y su nuevo valor?' });
  } catch {
    return NextResponse.json({ tipo: 'preguntar', pregunta: 'Ahora mismo no pude procesarlo. ¿Me repites qué dato quieres cambiar y su nuevo valor?' });
  }
}

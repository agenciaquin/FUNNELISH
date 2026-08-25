import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { responderIA } from '@/lib/ia-rotacion';
import { aplicarValores } from '@/lib/plantillas-conocimiento';

export const dynamic = 'force-dynamic';

/**
 * Compila el entrenamiento del bot a partir de la plantilla + las respuestas de
 * la entrevista. BARATO por diseño:
 *  1) Rellena la plantilla con las respuestas (determinístico, 0 tokens).
 *  2) UNA sola llamada a la IA para pulir la redacción (usa las IAs gratis del
 *     cliente con failover). Si algo falla, devuelve el relleno tal cual (0-IA).
 * Body: { contenido, valores, pulir? }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const contenido = String(b?.contenido ?? '');
  const valores = (b?.valores && typeof b.valores === 'object') ? b.valores : {};
  if (!contenido) return NextResponse.json({ error: 'falta contenido' }, { status: 400 });

  // 1) Relleno determinístico (siempre funciona).
  const base = aplicarValores(contenido, valores);

  // 0-IA si el cliente lo pide.
  if (b?.pulir === false) return NextResponse.json({ entrenamiento: base, pulidoPorIA: false });

  // 2) Un solo pase de IA para pulir la redacción.
  const sys =
    'Eres un editor experto de prompts para bots de venta por WhatsApp. Te paso un ENTRENAMIENTO ya armado, con datos que el dueño del negocio escribió de forma informal. ' +
    'Devuélvelo MEJORADO: redacta los datos de forma clara y profesional, corrige ortografía y deja todo natural para Colombia. ' +
    'Reglas estrictas: mantén EXACTAMENTE la misma estructura y los mismos bloques entre corchetes (ej: [IDENTIDAD], [FLUJO DE VENTA]); NO inventes datos que no estén; NO agregues comentarios ni explicaciones; NO uses comillas ni ``` alrededor. Devuelve SOLO el entrenamiento final.';

  try {
    const r = await responderIA(tid ?? null, {
      messages: [{ role: 'user', content: base }],
      systemPrompt: sys,
      maxTokens: 1800,
    });
    let pulido = (r?.message ?? '').trim();
    // Quitar cercas de código si la IA las puso.
    pulido = pulido.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();

    // Salvaguarda: si la IA devolvió algo muy corto, vacío, o la frase de respaldo,
    // usamos el relleno determinístico (mejor eso que un entrenamiento a medias).
    const sirve = pulido.length >= base.length * 0.5 && !pulido.includes('En un momento te atendemos');
    return NextResponse.json({ entrenamiento: sirve ? pulido : base, pulidoPorIA: sirve });
  } catch {
    return NextResponse.json({ entrenamiento: base, pulidoPorIA: false });
  }
}

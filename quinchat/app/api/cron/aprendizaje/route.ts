import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { chat } from '@/lib/quinchat/claude';
import { reglasAprobadas, CATEGORIAS } from '@/lib/memoria';

// Analizar decenas de conversaciones toma su tiempo
export const maxDuration = 60;

/**
 * Revisa los chats del día y propone hasta 10 cosas que el bot podría aprender.
 * NO las guarda en su memoria: quedan como propuestas para que un humano
 * decida cuáles entran. Se ejecuta una vez al día por cron.
 */

/**
 * Se puede disparar de dos formas: desde el cron con la clave secreta, o desde
 * el panel por alguien que ya inició sesión (el botón "Revisar ahora").
 */
async function autorizado(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
    if (req.nextUrl.searchParams.get('secret') === secret) return true;
  } else {
    return true; // sin clave configurada, no se bloquea
  }
  // Usuario del panel con sesión activa
  const session = await getServerSession(authOptions);
  return !!session;
}

export async function GET(req: NextRequest) {
  if (!(await autorizado(req))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const horas = Number(req.nextUrl.searchParams.get('horas') ?? 24);
  const desde = new Date(Date.now() - horas * 3_600_000).toISOString();

  // ── 1. Traer los mensajes del período ──────────────────────────────────────
  const { data: mensajes, error } = await supabase
    .from('messages')
    .select('conversation_id, content, role, type, created_at')
    .gte('created_at', desde)
    .order('created_at', { ascending: true })
    .limit(1200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!mensajes || mensajes.length < 10) {
    return NextResponse.json({ status: 'sin-material', mensajes: mensajes?.length ?? 0 });
  }

  // ── 2. Armar las conversaciones en texto plano ─────────────────────────────
  const porChat = new Map<string, string[]>();
  for (const m of mensajes) {
    if (m.type !== 'text') continue;
    const c = String(m.content ?? '').trim();
    if (!c || c.startsWith('http')) continue;
    const quien = m.role === 'user' ? 'CLIENTE' : m.role === 'agent' ? 'ASESOR' : 'BOT';
    const lista = porChat.get(m.conversation_id) ?? [];
    if (lista.length < 40) lista.push(`${quien}: ${c}`);
    porChat.set(m.conversation_id, lista);
  }

  // Solo conversaciones con ida y vuelta real
  const utiles = [...porChat.entries()].filter(([, l]) => l.length >= 4).slice(0, 40);
  if (utiles.length === 0) return NextResponse.json({ status: 'sin-material' });

  // Se recorta para no mandar un texto enorme: con 30 mil caracteres hay de sobra
  // para detectar los patrones que se repiten.
  const transcripciones = utiles
    .map(([id, l], i) => `--- CHAT ${i + 1} (${id}) ---\n${l.join('\n')}`)
    .join('\n\n')
    .slice(0, 30000);

  // ── 3. Lo que ya sabe y lo que fue rechazado, para no proponer repetido ────
  const yaAprendidas = await reglasAprobadas(200);
  const listaConocida = yaAprendidas.length > 0
    ? yaAprendidas.map(r => `- ${r.regla}`).join('\n')
    : '(todavía no ha aprendido nada)';

  // Reglas que el dueño ya rechazó: no se vuelven a proponer nunca
  const { data: rechazadas } = await supabase
    .from('memoria_bot').select('regla').eq('estado', 'descartada').limit(200);
  const listaRechazada = (rechazadas ?? []).length > 0
    ? (rechazadas ?? []).map((r: any) => `- ${r.regla}`).join('\n')
    : '(ninguna por ahora)';

  const sistema =
    `Eres el analista de calidad de Klixmant, una marca colombiana que vende buzos de escuderías por WhatsApp con pago contra entrega.\n\n` +
    `Vas a leer conversaciones reales del día y extraer REGLAS DE CONOCIMIENTO que el bot debería recordar para atender mejor.\n\n` +
    `QUÉ SÍ EXTRAER:\n` +
    `- Políticas del negocio que se repiten (abonos, tiempos de entrega, cobertura, garantías).\n` +
    `- Respuestas correctas a preguntas frecuentes de los clientes.\n` +
    `- Datos concretos del producto (materiales, tallas, cuidados, medidas).\n` +
    `- Objeciones habituales y la forma que funcionó para resolverlas.\n` +
    `- 🥇 TÉCNICAS DE CIERRE DEL ASESOR HUMANO (lo más valioso): cuando un ASESOR humano\n` +
    `  tomó el chat y logró CERRAR la venta (el cliente terminó comprando o confirmando),\n` +
    `  fíjate CÓMO lo hizo — qué argumento, urgencia, pregunta o manejo de objeción usó — y\n` +
    `  extrae esa técnica como una regla accionable para que el bot la REPLIQUE con otros\n` +
    `  clientes. Categoría "Objeciones frecuentes". Ejemplo: "Cuando el cliente duda por el\n` +
    `  precio, el asesor recuerda el envío gratis y ofrece apartar la última unidad para hoy."\n\n` +
    `QUÉ NO EXTRAER (esto es lo más importante):\n` +
    `- Excepciones puntuales: descuentos a un cliente, regalos, precios especiales.\n` +
    `- Datos personales de clientes (nombres, teléfonos, direcciones).\n` +
    `- Cosas que ya están en la lista de lo aprendido.\n` +
    `- Suposiciones tuyas: solo lo que quedó dicho de forma clara en los chats.\n` +
    `- Errores del bot o respuestas que el asesor tuvo que corregir sin dejar clara la política.\n\n` +
    `LO QUE EL BOT YA APRENDIÓ (no lo repitas):\n${listaConocida}\n\n` +
    `LO QUE EL DUEÑO YA RECHAZÓ (no lo vuelvas a proponer, ni con otras palabras ` +
    `ni parecido: ya decidió que el bot no debe aprenderlo):\n${listaRechazada}\n\n` +
    `CATEGORÍAS válidas: ${CATEGORIAS.join(' | ')}\n\n` +
    `Responde ÚNICAMENTE con un arreglo JSON, sin texto alrededor, con este formato:\n` +
    `[{"regla":"...","categoria":"...","ejemplo":"frase textual del chat que lo respalda"}]\n\n` +
    `Máximo 10 reglas. Escríbelas en español, en una sola frase clara y accionable, ` +
    `como una instrucción para el bot. Si no encuentras nada nuevo que valga la pena, responde [].`;

  // ── 4. Preguntarle al modelo ───────────────────────────────────────────────
  let propuestas: { regla: string; categoria?: string; ejemplo?: string }[] = [];
  let crudo = '';
  try {
    const resp = await chat({
      messages: [{ role: 'user', content: `Conversaciones del día:\n\n${transcripciones}` }],
      tenantId: 'klixmant',
      systemPrompt: sistema,
      maxTokens: 4000, // diez reglas con su ejemplo no caben en la respuesta corta
    });
    crudo = resp.message.trim();

    // Quitar el envoltorio ```json que a veces agrega el modelo
    const limpio = crudo.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const ini = limpio.indexOf('[');
    const fin = limpio.lastIndexOf(']');
    if (ini < 0) throw new Error('la respuesta no traía ninguna lista');

    // Si quedó cortada, se recuperan los objetos completos que alcanzaron a salir
    const json = fin > ini ? limpio.slice(ini, fin + 1) : `${limpio.slice(ini, limpio.lastIndexOf('}') + 1)}]`;
    propuestas = JSON.parse(json);
  } catch (e: any) {
    console.error('[Aprendizaje] no se pudo interpretar la respuesta:', e?.message, '| inicio:', crudo.slice(0, 300));
    return NextResponse.json({
      error: 'El análisis no devolvió un resultado válido.',
      detalle: crudo.slice(0, 300) || 'respuesta vacía',
    }, { status: 500 });
  }

  if (!Array.isArray(propuestas) || propuestas.length === 0) {
    return NextResponse.json({ status: 'sin-novedades', chats: utiles.length });
  }

  // ── 5. Guardar como propuestas (sin repetir las que ya están pendientes) ───
  // Se comparan contra TODAS: pendientes, aprobadas y rechazadas
  const { data: todasLasReglas } = await supabase
    .from('memoria_bot').select('regla');
  const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9áéíóúñ ]/gi, '').replace(/\s+/g, ' ').trim();
  const existentes = new Set((todasLasReglas ?? []).map((r: any) => normal(r.regla)));

  const ahora = new Date().toISOString();
  const nuevas = propuestas
    .filter(p => p?.regla && String(p.regla).trim().length > 10)
    .filter(p => !existentes.has(normal(String(p.regla))))
    .slice(0, 10)
    .map(p => ({
      regla: String(p.regla).trim(),
      categoria: CATEGORIAS.includes(p.categoria as any) ? p.categoria : 'Otros',
      ejemplo: p.ejemplo ? String(p.ejemplo).slice(0, 300) : null,
      estado: 'propuesta',
      creada_at: ahora,
    }));

  if (nuevas.length === 0) return NextResponse.json({ status: 'sin-novedades', chats: utiles.length });

  const { error: insErr } = await supabase.from('memoria_bot').insert(nuevas);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ status: 'ok', propuestas: nuevas.length, chats: utiles.length });
}

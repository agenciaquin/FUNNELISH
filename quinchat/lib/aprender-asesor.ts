import { createServerSupabaseClient } from '@/lib/supabase';
import { chat } from '@/lib/quinchat/claude';
import { TEMA_SENSIBLE, normal, parecido, extraerJSON } from '@/lib/supervisor';

/**
 * APRENDER DEL ASESOR: lee los chats de la línea de ventas donde el asesor
 * respondió A MANO (mensajes role='agent') y extrae cómo vende:
 *   · estilo   → cómo escribe (largo, tono, emojis, cómo saluda, cómo pregunta)
 *   · respuestas → respuestas reales a preguntas de clientes
 *   · cierres  → cómo lleva al cliente a comprar y cierra
 * Todo queda en la memoria del bot (origen 'asesor'):
 *   · Lo que NO toca dinero/políticas → activo de una vez.
 *   · Lo que toca precios, pagos, envíos, días, garantías… → "por aprobar"
 *     (puede ser una excepción que el asesor hizo con un cliente puntual).
 */

const MAX_CHATS = 30;
const MAX_NUEVAS = 25;

interface Extraccion {
  estilo?: string[];
  respuestas?: { pregunta: string; respuesta: string }[];
  cierres?: string[];
}

function transcripcion(msgs: any[]): string {
  const lineas: string[] = [];
  for (const m of msgs) {
    const quien = m.role === 'user' ? 'CLIENTE' : m.role === 'agent' ? 'ASESOR' : 'BOT';
    let c = String(m.content ?? '').trim();
    if (!c) continue;
    if (m.type === 'image' || /^https?:\/\//.test(c)) c = quien === 'CLIENTE' ? '[foto del cliente]' : '[foto]';
    else if (m.type === 'audio') c = '[audio]';
    const prev = lineas[lineas.length - 1];
    if (c === '[foto]' && prev?.endsWith(`${quien}: [foto]`)) continue;
    lineas.push(`${quien}: ${c.slice(0, 500)}`);
  }
  return lineas.slice(-45).join('\n');
}

export async function aprenderDelAsesor(opts: { desde?: Date } = {}) {
  const supabase = createServerSupabaseClient();
  // Por defecto: desde las 00:00 de hoy (hora Colombia)
  const desde = opts.desde ?? (() => {
    const col = new Date(Date.now() - 5 * 3_600_000);
    return new Date(Date.UTC(col.getUTCFullYear(), col.getUTCMonth(), col.getUTCDate(), 5, 0, 0));
  })();

  // Chats de ventas donde el asesor escribió en el período
  const { data: delAsesor } = await supabase.from('messages')
    .select('conversation_id').eq('role', 'agent').gte('created_at', desde.toISOString()).limit(2000);
  const ids = [...new Set((delAsesor ?? []).map((m: any) => String(m.conversation_id)))];
  if (!ids.length) return { chats: 0, nuevas: 0, activas: 0, porAprobar: 0, motivo: 'No hay respuestas manuales en el período.' };

  const { data: convs } = await supabase.from('conversations').select('id, linea, label').in('id', ids.slice(0, 300));
  const deVentas = (convs ?? []).filter((c: any) => c.linea === 'ventas' && !/VENDEDOR/i.test(String(c.label ?? '')));
  // Primero los vendidos (son los que mejor enseñan a cerrar)
  deVentas.sort((a: any, b: any) => Number(/VENTA REALIZADA/i.test(b.label ?? '')) - Number(/VENTA REALIZADA/i.test(a.label ?? '')));

  const bloques: string[] = [];
  for (const c of deVentas.slice(0, MAX_CHATS)) {
    const { data: msgs } = await supabase.from('messages')
      .select('role, content, type, created_at').eq('conversation_id', c.id)
      .gte('created_at', new Date(desde.getTime() - 24 * 3_600_000).toISOString())
      .order('created_at', { ascending: true }).limit(80);
    if (!(msgs ?? []).some((m: any) => m.role === 'agent')) continue;
    const vendida = /VENTA REALIZADA|PEDIDO PROGRAMADO/i.test(String(c.label ?? ''));
    bloques.push(`--- CHAT (${vendida ? 'VENDIDO ✅' : 'sin venta aún'}) ---\n${transcripcion(msgs ?? [])}`);
  }
  if (!bloques.length) return { chats: 0, nuevas: 0, activas: 0, porAprobar: 0, motivo: 'No hay chats de ventas con respuestas manuales.' };

  // Lo que ya sabe el bot (para no repetir)
  const { data: todas } = await supabase.from('memoria_bot').select('regla, estado');
  const existentes = (todas ?? []).map((r: any) => String(r.regla));
  const activas = (todas ?? []).filter((r: any) => r.estado === 'aprobada').map((r: any) => `- ${r.regla}`).slice(0, 80).join('\n');

  const sistema =
`Eres el entrenador del bot de ventas de Klixmant (buzos de motos y escuderías, venta por WhatsApp, pago contra entrega).
Vas a leer chats donde el ASESOR (el dueño) atendió A MANO. Tu trabajo: que el bot aprenda a VENDER COMO ÉL.
Fíjate SOLO en los mensajes del ASESOR (y en qué le respondió el cliente). Los del BOT no son ejemplo.

Devuelve ÚNICAMENTE un JSON:
{
 "estilo": ["reglas de CÓMO escribe el asesor: largo de los mensajes, tono, tuteo/usted, emojis que usa o evita, cómo saluda, cómo pregunta, cómo responde a stickers/bendiciones… (máx 8)"],
 "respuestas": [{"pregunta":"la pregunta típica del cliente (general, sin datos personales)","respuesta":"cómo la responde el asesor, con SUS palabras (puedes acortar)"}] (máx 12),
 "cierres": ["técnicas concretas con que el asesor lleva a comprar o cierra: qué dice, en qué momento, cómo maneja dudas u objeciones (máx 8)"]
}

REGLAS:
- Todo escrito como instrucción para el bot, en español, accionable y GENERAL (sirve para otros clientes).
- NUNCA incluyas nombres, teléfonos, direcciones ni datos de clientes.
- NO conviertas en regla una EXCEPCIÓN puntual (un descuento o regalo a un cliente, un caso raro).
- NO repitas lo que el bot ya sabe:
${activas || '(nada aún)'}
- Si no hay nada nuevo en una sección, déjala vacía [].`;

  const resp = await chat({
    messages: [{ role: 'user', content: `Chats del día atendidos a mano:\n\n${bloques.join('\n\n').slice(0, 45000)}` }],
    tenantId: 'klixmant',
    systemPrompt: sistema,
    maxTokens: 4000,
  });
  const j: Extraccion = extraerJSON(resp.message.replace(/^[^{]*/, ''));

  // Convertir a reglas de memoria
  const candidatas: { regla: string; categoria: string }[] = [];
  for (const e of (j.estilo ?? []).slice(0, 8)) candidatas.push({ regla: `ESTILO DEL ASESOR: ${String(e).trim()}`, categoria: 'Forma de vender' });
  for (const r of (j.respuestas ?? []).slice(0, 12)) {
    if (!r?.pregunta || !r?.respuesta) continue;
    candidatas.push({ regla: `Si el cliente pregunta "${String(r.pregunta).trim()}", responde como el asesor: "${String(r.respuesta).trim()}"`, categoria: 'Objeciones frecuentes' });
  }
  for (const c of (j.cierres ?? []).slice(0, 8)) candidatas.push({ regla: `CIERRE DEL ASESOR: ${String(c).trim()}`, categoria: 'Forma de vender' });

  const ahora = new Date().toISOString();
  const res = { chats: bloques.length, nuevas: 0, activas: 0, porAprobar: 0 };
  for (const c of candidatas) {
    if (res.nuevas >= MAX_NUEVAS) break;
    const regla = c.regla.slice(0, 600);
    if (regla.length < 20) continue;
    if (existentes.some(x => normal(x) === normal(regla) || parecido(x, regla) >= 0.75)) continue;
    const sensible = TEMA_SENSIBLE.test(regla);
    const { error } = await supabase.from('memoria_bot').insert({
      regla, categoria: c.categoria,
      estado: sensible ? 'propuesta' : 'aprobada',
      ejemplo: 'Aprendido de las respuestas manuales del asesor.',
      creada_at: ahora, aprobada_at: sensible ? null : ahora,
      origen: 'asesor', riesgo: sensible ? 'alto' : 'bajo', auto: !sensible,
    });
    if (error) continue;
    existentes.push(regla);
    res.nuevas++;
    if (sensible) res.porAprobar++; else res.activas++;
  }
  return res;
}

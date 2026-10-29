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
  if (!ids.length) return { chats: 0, nuevas: 0, activas: 0, porAprobar: 0, metodo: 0, motivo: 'No hay respuestas manuales en el período.' };

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
  if (!bloques.length) return { chats: 0, nuevas: 0, activas: 0, porAprobar: 0, metodo: 0, motivo: 'No hay chats de ventas con respuestas manuales.' };

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

  const material = bloques.join('\n\n').slice(0, 40000);
  // En paralelo: (1) lecciones sueltas y (2) el MÉTODO DE VENTA completo (el flujo).
  const [resp, metodoRes] = await Promise.all([
    chat({
      messages: [{ role: 'user', content: `Chats del día atendidos a mano:\n\n${material}` }],
      tenantId: 'klixmant',
      systemPrompt: sistema,
      maxTokens: 3000,
    }),
    construirMetodo(supabase, material, bloques.length).catch((e: any) => {
      console.error('[Aprender asesor] método:', e?.message);
      return null;
    }),
  ]);
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
  const res = { chats: bloques.length, nuevas: 0, activas: 0, porAprobar: 0, metodo: metodoRes ? metodoRes.pasos : 0 };
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


// ════════════════════════════════════════════════════════════════════════════
// MÉTODO DE VENTA DEL ASESOR (el flujo completo, paso a paso)
// Se guarda en ajustes_bot (clave 'metodo_asesor') y se REFINA cada vez que se
// corre: el modelo recibe el método anterior + los chats nuevos y lo mejora.
// ════════════════════════════════════════════════════════════════════════════

export interface PasoMetodo { nombre: string; objetivo: string; como: string[]; avanzar_cuando: string }
export interface MetodoAsesor {
  resumen: string;
  pasos: PasoMetodo[];
  reglas_generales: string[];
  objeciones: { objecion: string; respuesta: string }[];
  frases_clave: string[];
  ejemplo: string;
}

async function construirMetodo(supabase: any, material: string, nChats: number): Promise<{ pasos: number } | null> {
  const { data: prev } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'metodo_asesor').maybeSingle();
  const anterior: MetodoAsesor | null = prev?.valor?.metodo ?? null;

  const sistema =
`Eres el entrenador del bot de ventas de Klixmant (buzos de motos y escuderías por WhatsApp, pago contra entrega, envío gratis).
Lee chats donde el ASESOR (el dueño) vendió A MANO y escribe su MÉTODO DE VENTA COMPLETO, de principio a fin, para que el bot lo replique igual.
Mira el FLUJO: qué hace primero, qué pregunta después, en qué orden pide color/talla/datos, cómo responde dudas, cómo y cuándo cierra, qué hace cuando el cliente se enfría.
Los mensajes del BOT no son ejemplo: solo los del ASESOR (y cómo reaccionó el cliente). Da más peso a los chats VENDIDOS.
${anterior ? `\nYA EXISTE un método aprendido antes. ACTUALÍZALO: conserva lo que se confirma, corrige lo que hoy se hizo distinto y agrega lo nuevo. No lo borres sin razón.\nMÉTODO ANTERIOR:\n${JSON.stringify(anterior).slice(0, 6000)}\n` : ''}
Devuelve ÚNICAMENTE un JSON:
{
 "resumen": "en 2 frases, cómo vende el asesor",
 "pasos": [{"nombre":"ej. Saludo y producto","objetivo":"qué busca lograr","como":["frases REALES o casi textuales que usa el asesor en este paso (2-4)"],"avanzar_cuando":"señal para pasar al siguiente paso"}] (4 a 8 pasos, EN ORDEN, desde el primer mensaje hasta el cierre y la confirmación),
 "reglas_generales": ["tono, largo de mensajes, emojis, ritmo, qué NUNCA hace (máx 8)"],
 "objeciones": [{"objecion":"duda típica","respuesta":"cómo la responde el asesor, con sus palabras"}] (máx 8),
 "frases_clave": ["frases cortas que repite y funcionan (máx 8)"],
 "ejemplo": "una conversación modelo CORTA (8-14 líneas, CLIENTE:/ASESOR:) que muestre el flujo ideal, sin datos personales"
}
REGLAS: español, sin nombres, teléfonos ni direcciones de clientes. Nada de excepciones puntuales (un descuento o regalo a un cliente) como si fueran la regla.`;

  const r = await chat({
    messages: [{ role: 'user', content: `Chats atendidos a mano por el asesor:\n\n${material}` }],
    tenantId: 'klixmant',
    systemPrompt: sistema,
    maxTokens: 4000,
  });
  const j = extraerJSON(r.message.replace(/^[^{]*/, ''));
  const lista = (x: any, n: number) => (Array.isArray(x) ? x : []).map((v: any) => String(v ?? '').trim()).filter(Boolean).slice(0, n);
  const metodo: MetodoAsesor = {
    resumen: String(j.resumen ?? '').slice(0, 500),
    pasos: (Array.isArray(j.pasos) ? j.pasos : []).slice(0, 8).map((p: any) => ({
      nombre: String(p?.nombre ?? '').slice(0, 80),
      objetivo: String(p?.objetivo ?? '').slice(0, 200),
      como: lista(p?.como, 4).map(t => t.slice(0, 300)),
      avanzar_cuando: String(p?.avanzar_cuando ?? '').slice(0, 200),
    })).filter((p: PasoMetodo) => p.nombre),
    reglas_generales: lista(j.reglas_generales, 8),
    objeciones: (Array.isArray(j.objeciones) ? j.objeciones : []).slice(0, 8)
      .map((o: any) => ({ objecion: String(o?.objecion ?? '').slice(0, 150), respuesta: String(o?.respuesta ?? '').slice(0, 400) }))
      .filter((o: any) => o.objecion && o.respuesta),
    frases_clave: lista(j.frases_clave, 8),
    ejemplo: String(j.ejemplo ?? '').slice(0, 1500),
  };
  if (metodo.pasos.length < 3) return null; // muy poco material: no se pisa el método anterior

  const historial = [...(prev?.valor?.historial ?? []), ...(anterior ? [{ fecha: prev?.valor?.actualizado ?? null, metodo: anterior }] : [])].slice(-5);
  await supabase.from('ajustes_bot').upsert({
    clave: 'metodo_asesor',
    valor: { activo: prev?.valor?.activo !== false, actualizado: new Date().toISOString(), chats: nChats + Number(prev?.valor?.chats ?? 0), metodo, historial },
    actualizado_at: new Date().toISOString(),
  }, { onConflict: 'clave' });
  cacheMetodo = null;
  return { pasos: metodo.pasos.length };
}

let cacheMetodo: { texto: string; leido: number } | null = null;

/** Texto del método para el prompt del bot ('' si no hay o está desactivado). */
export async function bloqueMetodoAsesor(): Promise<string> {
  if (cacheMetodo && Date.now() - cacheMetodo.leido < 120_000) return cacheMetodo.texto;
  let texto = '';
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'metodo_asesor').maybeSingle();
    const v = data?.valor;
    const m: MetodoAsesor | null = v?.metodo ?? null;
    if (m && v?.activo !== false && m.pasos?.length) {
      texto =
        `\n\n════════ MÉTODO DE VENTA DEL DUEÑO (aprendido de sus chats reales) ════════\n` +
        `Vende EXACTAMENTE como él: sigue estos pasos EN ORDEN, con su tono y sus frases. Este método manda sobre el ` +
        `orden y el estilo genérico de arriba, pero NUNCA sobre los precios, el catálogo, las fotos, los marcadores ` +
        `([[FOTO]], [[PEDIDO]], [[ACTUALIZAR]], [[HUMANO]]…) ni las políticas (abono de oficina, cuestionario, etc.).\n` +
        (m.resumen ? `En resumen: ${m.resumen}\n` : '') +
        m.pasos.map((p, i) =>
          `\nPASO ${i + 1} — ${p.nombre}\n· Objetivo: ${p.objetivo}\n` +
          (p.como.length ? `· Cómo lo dice: ${p.como.map(c => `"${c}"`).join(' / ')}\n` : '') +
          (p.avanzar_cuando ? `· Pasa al siguiente cuando: ${p.avanzar_cuando}\n` : '')).join('') +
        (m.reglas_generales.length ? `\nREGLAS DE SU ESTILO:\n${m.reglas_generales.map(r => `- ${r}`).join('\n')}\n` : '') +
        (m.objeciones.length ? `\nCÓMO RESPONDE LAS DUDAS:\n${m.objeciones.map(o => `- "${o.objecion}" → ${o.respuesta}`).join('\n')}\n` : '') +
        (m.frases_clave.length ? `\nFRASES QUE LE FUNCIONAN: ${m.frases_clave.map(f => `"${f}"`).join(' · ')}\n` : '') +
        (m.ejemplo ? `\nEJEMPLO DE CONVERSACIÓN IDEAL (guía de ritmo y tono, no lo copies palabra por palabra):\n${m.ejemplo}\n` : '');
    }
  } catch { /* sin método: el bot sigue normal */ }
  cacheMetodo = { texto, leido: Date.now() };
  return texto;
}

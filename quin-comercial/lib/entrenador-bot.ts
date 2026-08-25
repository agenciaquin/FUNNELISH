// ENTRENADOR — el dueño le habla a Quino con sus palabras y Quino lo convierte
// en cambios REALES del bot vendedor. Dos pasos (candado de confirmación):
//   1) interpretarEntrenamiento(): Quino entiende y PROPONE (no guarda nada).
//   2) aplicarPropuesta(): al confirmar el dueño, se guarda en la tabla correcta.
//
// Tipos de cambio:
//   • etiqueta      → tabla reglas_etiqueta (cuándo marcar una conversación)
//   • conocimiento  → memoria_bot (datos: envíos, pagos, garantías, precios…)
//   • comportamiento→ memoria_bot (tono, qué NO decir, cuándo pasar a humano)
//   • catalogo      → memoria_bot (recordarle qué productos existen)
// conocimiento/comportamiento/catalogo se guardan como reglas APROBADAS, así
// entran de una al bot (bloqueDeMemoria las inyecta).

import { createServerSupabaseClient } from '@/lib/supabase';
import { chat } from '@/lib/quinchat/claude';
import { CATEGORIAS } from '@/lib/memoria';
import { ESTADOS_VENTA } from '@/lib/reglas-etiqueta';

export type TipoCambio = 'etiqueta' | 'conocimiento' | 'comportamiento' | 'catalogo';

export interface Propuesta {
  tipo: TipoCambio;
  resumen: string;          // frase humana para la confirmación
  // etiqueta:
  condicion?: string;
  etiqueta?: string;
  // conocimiento / comportamiento / catalogo:
  categoria?: string;
  regla?: string;
}

export interface ResultadoInterpretacion {
  reply: string;
  propuestas: Propuesta[];
}

const CATS = CATEGORIAS.join(', ');
const ETQS = ESTADOS_VENTA.join(', ');

function sys(): string {
  return [
    'Eres "Quino", el entrenador del bot vendedor de WhatsApp dentro de QuinChat (Agencia QUIN).',
    'El dueño de la tienda te habla con sus palabras para ENSEÑARLE o CORREGIR al bot. Tu trabajo es entenderlo y convertirlo en reglas concretas.',
    '',
    'Puedes proponer 4 tipos de cambio:',
    `1. "etiqueta": cuándo el bot debe marcar una conversación. Requiere {condicion, etiqueta}. Etiquetas de venta comunes: ${ETQS}. También valen etiquetas libres que el dueño invente.`,
    `2. "conocimiento": un dato del negocio que el bot debe saber (envíos, pagos, garantías, precios, cobertura). Requiere {categoria, regla}. Categorías: ${CATS}.`,
    '3. "comportamiento": cómo debe actuar o responder (tono, qué NO decir, cuándo pasar a un humano). Requiere {categoria, regla} (usa categoría "Otros" si ninguna encaja).',
    '4. "catalogo": recordarle qué productos/categorías existen de verdad. Requiere {categoria:"Producto y tallas", regla}.',
    '',
    'REGLAS IMPORTANTES:',
    '- Cuando el dueño te corrige un mensaje malo del bot, redacta la "regla" como una instrucción clara y permanente (ej: "Cuando pregunten por envíos a zonas rurales, di que SÍ enviamos a todo el país con pago contra entrega").',
    '- La "regla" debe ser autoexplicativa y general (que sirva para futuros clientes), no una respuesta a un solo cliente.',
    '- Si el mensaje del dueño no es una orden de entrenamiento clara (solo saluda o pregunta algo), NO propongas nada: responde ayudándolo y deja propuestas vacías.',
    '- Puedes proponer varias reglas de una si el dueño dijo varias cosas.',
    '- NO inventes datos del negocio que el dueño no haya dicho.',
    '',
    'RESPONDE SIEMPRE en JSON válido, sin texto fuera del JSON, con esta forma EXACTA:',
    '{"reply":"lo que le dices al dueño, cálido y en español, confirmando qué entendiste","propuestas":[{"tipo":"etiqueta|conocimiento|comportamiento|catalogo","resumen":"frase corta de qué se le enseñará","condicion":"...","etiqueta":"...","categoria":"...","regla":"..."}]}',
    'Incluye solo los campos que correspondan a cada tipo. Si no hay nada que enseñar, "propuestas": [].',
  ].join('\n');
}

function extraerJSON(texto: string): any | null {
  // El modelo debería devolver JSON puro; por si acaso, extrae el primer objeto.
  try { return JSON.parse(texto); } catch { /* sigue */ }
  const m = texto.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* nada */ } }
  return null;
}

function normalizarPropuestas(arr: any): Propuesta[] {
  if (!Array.isArray(arr)) return [];
  const out: Propuesta[] = [];
  for (const p of arr.slice(0, 8)) {
    const tipo = String(p?.tipo ?? '').trim() as TipoCambio;
    if (!['etiqueta', 'conocimiento', 'comportamiento', 'catalogo'].includes(tipo)) continue;
    if (tipo === 'etiqueta') {
      const condicion = String(p?.condicion ?? '').trim();
      const etiqueta = String(p?.etiqueta ?? '').trim();
      if (!condicion || !etiqueta) continue;
      out.push({ tipo, condicion, etiqueta, resumen: String(p?.resumen ?? `Marcar ${etiqueta}`).trim() });
    } else {
      const regla = String(p?.regla ?? '').trim();
      if (regla.length < 6) continue;
      const catRaw = String(p?.categoria ?? '').trim();
      const categoria = (CATEGORIAS as readonly string[]).includes(catRaw) ? catRaw
        : (tipo === 'catalogo' ? 'Producto y tallas' : 'Otros');
      out.push({ tipo, regla, categoria, resumen: String(p?.resumen ?? regla).trim() });
    }
  }
  return out;
}

/** Paso 1: Quino entiende y PROPONE (no guarda). `contexto` = mensaje malo del
 *  bot que el dueño quiere corregir (opcional). */
export async function interpretarEntrenamiento(opts: {
  tid: string;
  mensaje: string;
  historial?: { role: 'user' | 'assistant'; content: string }[];
  contexto?: string | null;
}): Promise<ResultadoInterpretacion> {
  const historial = (opts.historial ?? [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-10)
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 1500) }));

  const contextoBloque = opts.contexto
    ? `\n\n[EL DUEÑO ESTÁ CORRIGIENDO ESTE MENSAJE DEL BOT]\n"${String(opts.contexto).slice(0, 600)}"\nEl dueño te dirá qué debió responder en su lugar. Conviértelo en una regla permanente.`
    : '';

  const messages = [
    ...historial,
    { role: 'user' as const, content: opts.mensaje.slice(0, 1500) + contextoBloque },
  ];

  try {
    const resp = await chat({
      messages,
      tenantId: opts.tid,
      systemPrompt: sys(),
      maxTokens: 700,
    });
    const parsed = extraerJSON(resp.message ?? '');
    if (!parsed) {
      return { reply: resp.message?.slice(0, 800) || 'Listo, cuéntame qué quieres enseñarle al bot.', propuestas: [] };
    }
    return {
      reply: String(parsed.reply ?? 'Entendido.').trim(),
      propuestas: normalizarPropuestas(parsed.propuestas),
    };
  } catch {
    return { reply: 'Ahora mismo no pude procesarlo. Intenta de nuevo en un momento.', propuestas: [] };
  }
}

/** Paso 2: el dueño confirmó → guardar la propuesta en la tabla correcta. */
export async function aplicarPropuesta(tid: string, p: Propuesta): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServerSupabaseClient();
  const ahora = new Date().toISOString();
  try {
    if (p.tipo === 'etiqueta') {
      const condicion = String(p.condicion ?? '').trim();
      const etiqueta = String(p.etiqueta ?? '').trim();
      if (!condicion || !etiqueta) return { ok: false, error: 'Faltan datos de la etiqueta.' };
      const { error } = await supabase.from('reglas_etiqueta').insert({ tenant_id: tid, condicion, etiqueta, activo: true });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }
    // conocimiento / comportamiento / catalogo → memoria_bot APROBADA (entra ya al bot)
    const regla = String(p.regla ?? '').trim();
    if (regla.length < 6) return { ok: false, error: 'La regla está vacía.' };
    const categoria = (CATEGORIAS as readonly string[]).includes(String(p.categoria))
      ? String(p.categoria) : (p.tipo === 'catalogo' ? 'Producto y tallas' : 'Otros');
    const { error } = await supabase.from('memoria_bot').insert({
      regla, categoria, estado: 'aprobada', creada_at: ahora, aprobada_at: ahora, tenant_id: tid,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al guardar.' };
  }
}

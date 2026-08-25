import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActualId } from '@/lib/whatsapp-contexto';

/**
 * BASE DE PREGUNTAS FRECUENTES (FAQ).
 *
 * El bot guarda automáticamente lo que preguntan los clientes junto con la
 * respuesta que dio. Nada se usa hasta que el dueño lo APRUEBA en el panel.
 * Las preguntas repetidas suman en `veces`, así las más comunes suben primero.
 *
 * (Fase 2: las aprobadas se responderán directo, sin gastar IA.)
 */

export type EstadoFaq = 'propuesta' | 'aprobada' | 'descartada';

export interface FaqItem {
  id: string;
  pregunta: string;
  respuesta: string;
  categoria: string | null;
  estado: EstadoFaq;
  veces: number;
  ejemplo: string | null;
  conversacion_id: string | null;
  creada_at: string;
  aprobada_at: string | null;
}

export const CATEGORIAS_FAQ = [
  'Envíos y entregas',
  'Pagos y abonos',
  'Producto y tallas',
  'Garantías y cambios',
  'Precios y promociones',
  'Otros',
] as const;

/** Normaliza una pregunta para detectar duplicados (sin tildes, minúsculas, sin signos). */
export function normalizarPregunta(texto: string): string {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/[^a-z0-9ñ\s?]/g, ' ')                    // deja letras/números
    .replace(/\s+/g, ' ')
    .trim();
}

// Palabras que delatan que el cliente está PREGUNTANDO algo informativo.
const SEÑALES_PREGUNTA = [
  'cuanto', 'cuánto', 'precio', 'vale', 'cuesta', 'a como', 'a cómo',
  'talla', 'tallas', 'medida', 'queda', 'sirve',
  'envio', 'envío', 'envian', 'envían', 'llega', 'demora', 'tarda', 'cuando', 'cuándo',
  'pago', 'pagar', 'contra entrega', 'contraentrega', 'abono', 'nequi', 'tarjeta',
  'como', 'cómo', 'donde', 'dónde', 'que', 'qué', 'cual', 'cuál',
  'original', 'garantia', 'garantía', 'cambio', 'devolucion', 'devolución',
  'material', 'tela', 'color', 'colores', 'hacen', 'tienen', 'manejan', 'disponible',
];

/** ¿El mensaje del cliente parece una pregunta informativa que vale guardar? */
function pareceProntaPregunta(texto: string): boolean {
  const t = String(texto ?? '').trim();
  if (t.length < 6 || t.length > 160) return false;      // ni muy corto ni párrafos
  const norm = normalizarPregunta(t);
  if (!norm) return false;
  const tieneSigno = t.includes('?') || t.includes('¿');
  const tieneSeñal = SEÑALES_PREGUNTA.some(w => norm.includes(w));
  return tieneSigno || tieneSeñal;
}

/** Adivina la categoría de la pregunta por palabras clave. */
function categoriaDe(norm: string): string {
  if (/(envio|envian|llega|demora|tarda|entrega|guia)/.test(norm)) return 'Envíos y entregas';
  if (/(pago|pagar|abono|nequi|tarjeta|contra ?entrega|consign)/.test(norm)) return 'Pagos y abonos';
  if (/(talla|medida|queda|sirve|material|tela|color)/.test(norm)) return 'Producto y tallas';
  if (/(garantia|cambio|devoluci|reclamo)/.test(norm)) return 'Garantías y cambios';
  if (/(precio|vale|cuesta|cuanto|a como|descuento|promo|oferta)/.test(norm)) return 'Precios y promociones';
  return 'Otros';
}

/**
 * Guarda una pregunta del cliente + la respuesta del bot como CANDIDATA.
 * - Si ya existe una igual (normalizada), suma en `veces` en vez de duplicar.
 * - Nunca bloquea la respuesta al cliente (si falla, se ignora).
 */
export async function registrarFAQCandidata(
  supabase: any,
  pregunta: string,
  respuesta: string,
  conversacionId: string | null,
  tenantId?: string | null,
): Promise<void> {
  try {
    // Empresa dueña: la que pasen, o la del contexto del bot. Sin tenant no se guarda.
    const tid = tenantId ?? tenantActualId();
    if (!tid) return;
    if (!pareceProntaPregunta(pregunta)) return;
    const resp = String(respuesta ?? '').trim();
    if (resp.length < 4 || resp.length > 900) return; // respuesta usable
    const norm = normalizarPregunta(pregunta);
    if (!norm) return;

    // ¿Ya existe (en cualquier estado) para ESTE tenant? → sumar veces, no duplicar.
    const { data: existente } = await supabase
      .from('faq_bot')
      .select('id, veces, estado')
      .eq('tenant_id', tid)
      .eq('pregunta_norm', norm)
      .limit(1)
      .maybeSingle();

    if (existente?.id) {
      // Si ya la descartaste, NO la resucitamos: solo subimos el contador.
      await supabase.from('faq_bot')
        .update({ veces: (Number(existente.veces) || 1) + 1 })
        .eq('id', existente.id).eq('tenant_id', tid);
      return;
    }

    await supabase.from('faq_bot').insert({
      pregunta: String(pregunta).trim().slice(0, 300),
      pregunta_norm: norm,
      respuesta: resp.slice(0, 900),
      categoria: categoriaDe(norm),
      estado: 'propuesta',
      veces: 1,
      conversacion_id: conversacionId,
      creada_at: new Date().toISOString(),
      tenant_id: tid,
    });
  } catch (e) {
    console.warn('[FAQ] no se pudo registrar candidata:', e);
  }
}

/** Preguntas ya aprobadas (para uso futuro: responder sin IA). */
export async function faqAprobadas(limite = 300, tenantId?: string | null): Promise<FaqItem[]> {
  try {
    const tid = tenantId ?? tenantActualId();
    if (!tid) return [];
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('faq_bot')
      .select('*')
      .eq('tenant_id', tid)
      .eq('estado', 'aprobada')
      .order('veces', { ascending: false })
      .limit(limite);
    if (error) { console.error('[FAQ] error leyendo aprobadas:', error.message); return []; }
    return data ?? [];
  } catch (e) {
    console.error('[FAQ] error inesperado:', e);
    return [];
  }
}

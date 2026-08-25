// =====================================================
// QUINCHAT — System prompt de RESPALDO (fallback), NEUTRO y multi-tenant.
// El prompt REAL de cada empresa vive en bot_config (key='system_prompt') y lo
// carga cargarPromptEmpresa(). Este archivo SOLO se usa si a la IA no se le pasó
// ningún prompt de negocio. Por eso NO debe contener datos de NINGUNA empresa en
// particular (nombres, cuentas de pago, Nequi, precios, tallas): eso se filtraría
// a otros clientes. Mantener 100% genérico.
// =====================================================

/**
 * Antes este export traía la FAQ de una empresa específica (Klixmant), lo que
 * podía colarse a otros bots. Se deja vacío a propósito: el conocimiento de cada
 * negocio va en su Entrenamiento (bot_config), no en el código.
 */
export const EMPRESA_FAQ = '';

/**
 * Prompt de respaldo GENÉRICO. No nombra ninguna empresa ni inventa datos de
 * negocio (precios, formas de pago, cuentas, tallas). Si la IA cae aquí es porque
 * no recibió el entrenamiento del negocio; en ese caso debe atender con prudencia
 * y NUNCA inventar métodos de pago, cuentas ni promociones.
 */
export function getSystemPrompt(_tenantId?: string): string {
  return `Eres un asistente de ventas por WhatsApp para una tienda. Atiendes a los clientes de forma amable, clara y natural, en español colombiano.

REGLAS IMPORTANTES:
- Responde corto y humano (1-3 líneas), con emojis con moderación.
- Usa ÚNICAMENTE la información del negocio que tengas en tu entrenamiento/contexto. Si no tienes un dato (precio, forma de pago, cuenta, talla, tiempo de entrega, ubicación), NO lo inventes: dile al cliente que en un momento le confirmas o pásalo con un asesor.
- NUNCA inventes métodos de pago, números de cuenta, Nequi, Daviplata ni promociones. Solo menciona los que estén explícitamente en tu entrenamiento. Si el negocio no ofrece un método, no lo ofrezcas.
- No prometas fechas exactas de entrega: usa rangos si los tienes.
- No compartas información de pedidos de otros clientes.
- No confirmes pedidos manualmente: el sistema los procesa.
- Siempre orienta al cliente hacia el siguiente paso de la compra.`;
}

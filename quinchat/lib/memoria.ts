import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Memoria del bot.
 *
 * Cada noche el bot propone lo que aprendió de los chats del día. Nada entra a
 * su memoria hasta que un humano lo aprueba: así se evita que aprenda de una
 * excepción (un descuento puntual, por ejemplo) y la repita con todos.
 */

export type EstadoRegla = 'propuesta' | 'aprobada' | 'descartada';

export interface ReglaMemoria {
  id: string;
  regla: string;
  categoria: string | null;
  estado: EstadoRegla;
  ejemplo: string | null;        // fragmento del chat que la originó
  conversacion_id: string | null;
  creada_at: string;
  aprobada_at: string | null;
}

export const CATEGORIAS = [
  'Envíos y entregas',
  'Pagos y abonos',
  'Producto y tallas',
  'Garantías y cambios',
  'Precios y promociones',
  'Objeciones frecuentes',
  'Otros',
] as const;

/** Reglas ya aprobadas, listas para inyectar en las respuestas del bot. */
export async function reglasAprobadas(limite = 120): Promise<ReglaMemoria[]> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('memoria_bot')
      .select('*')
      .eq('estado', 'aprobada')
      .order('aprobada_at', { ascending: false })
      .limit(limite);
    if (error) { console.error('[Memoria] error leyendo reglas:', error.message); return []; }
    return data ?? [];
  } catch (e) {
    console.error('[Memoria] error inesperado:', e);
    return [];
  }
}

/**
 * Texto que se agrega al prompt del bot con todo lo que ha aprendido.
 * Devuelve cadena vacía si aún no hay nada aprobado.
 */
export async function bloqueDeMemoria(): Promise<string> {
  const reglas = await reglasAprobadas();
  if (reglas.length === 0) return '';

  // Agrupadas por tema para que al modelo le sea más fácil ubicarlas
  const porCategoria = new Map<string, string[]>();
  for (const r of reglas) {
    const cat = r.categoria || 'Otros';
    const lista = porCategoria.get(cat) ?? [];
    lista.push(r.regla);
    porCategoria.set(cat, lista);
  }

  let texto = '\n\n=== LO QUE HAS APRENDIDO ATENDIENDO CLIENTES ===\n';
  texto += 'Estas reglas fueron aprobadas por el dueño del negocio. Tienen prioridad sobre cualquier suposición tuya.\n';
  for (const [cat, lista] of porCategoria) {
    texto += `\n[${cat}]\n`;
    for (const r of lista) texto += `- ${r}\n`;
  }
  return texto;
}

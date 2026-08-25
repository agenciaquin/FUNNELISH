// =====================================================
// Contexto de conversación con RESUMEN RODANTE (más memoria, menos tokens).
// En vez de mandar 14 mensajes crudos, mandamos:
//   - los últimos 10 mensajes tal cual (detalle reciente)
//   - un resumen corto de todo lo anterior (contexto sin pagar por todo)
// El resumen se actualiza BARATO y rara vez (Haiku, salida mínima), solo cuando
// se acumulan mensajes nuevos. Fail-open: si algo falla, devuelve lo que pueda.
// =====================================================

import { chat } from '@/lib/quinchat/claude';

type Msg = { role: 'user' | 'assistant'; content: string };

const RECIENTES = 10;   // mensajes recientes que van tal cual
const CADA = 6;         // re-resumir cada ~6 mensajes que "envejecen"

export async function contextoChat(
  supabase: any,
  from: string,
): Promise<{ resumen: string; recientes: Msg[] }> {
  try {
    const { data } = await supabase
      .from('messages').select('content, role, created_at')
      .eq('conversation_id', from).order('created_at', { ascending: false }).limit(60);

    const todos: Msg[] = (data ?? []).slice().reverse()
      .filter((m: any) => m.content?.trim() && !String(m.content).startsWith('http'))
      .map((m: any) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: String(m.content),
      }));

    const recientes = todos.slice(-RECIENTES);
    const viejos = todos.slice(0, Math.max(0, todos.length - RECIENTES));

    const { data: conv } = await supabase
      .from('conversations').select('resumen, resumen_msgs').eq('id', from).maybeSingle();
    let resumen = String(conv?.resumen ?? '');
    const cubiertos = Number(conv?.resumen_msgs ?? 0);

    // Solo los mensajes viejos que aún NO se han resumido.
    const nuevosViejos = viejos.slice(cubiertos);
    if (viejos.length >= 6 && nuevosViejos.length >= CADA) {
      try {
        const bloque =
          (resumen ? `RESUMEN PREVIO:\n${resumen}\n\n` : '') +
          'MENSAJES NUEVOS DE ESTE CHAT:\n' +
          nuevosViejos.map(m => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`).join('\n');
        const sys =
          'Eres un resumidor. Actualiza el resumen de esta conversación de venta por WhatsApp en 3 a 5 líneas telegráficas: qué quiere el cliente, producto/color/talla, precio hablado, datos que ya dio (nombre, dirección, teléfono), objeciones y en qué punto va. Integra el resumen previo con los mensajes nuevos. Responde SOLO el resumen, sin preámbulo.';
        const r = await chat({
          messages: [{ role: 'user', content: bloque.slice(0, 6000) }],
          systemPrompt: sys,
          maxTokens: 200,
        });
        const nuevo = (r.message ?? '').trim();
        if (nuevo) {
          resumen = nuevo;
          await supabase.from('conversations')
            .update({ resumen, resumen_msgs: viejos.length }).eq('id', from);
        }
      } catch { /* si falla, se queda el resumen anterior */ }
    }

    return { resumen, recientes };
  } catch {
    return { resumen: '', recientes: [] };
  }
}

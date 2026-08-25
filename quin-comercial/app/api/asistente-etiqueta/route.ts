import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';
import { responderIA } from '@/lib/ia-rotacion';
import { ESTADOS_VENTA } from '@/lib/reglas-etiqueta';

// Quino ayuda al comerciante a programar, en lenguaje natural, cuándo el bot
// debe marcar una etiqueta. Cuando entiende una regla clara, la crea de una vez
// (emite un marcador [[REGLAS: [...]]] que aquí se parsea, se guarda y se borra).

const SYS = (etiquetas: string) => `Eres Quino, el asistente de QuinChat. Ayudas al dueño de la tienda a configurar las ETIQUETAS AUTOMÁTICAS que su bot de ventas pone en cada conversación de WhatsApp.

Una regla tiene dos partes: la CONDICIÓN (qué pasa en el chat, en palabras simples) y la ETIQUETA (cómo se marca la conversación).

Etiquetas de estado de venta disponibles (una reemplaza a la anterior): ${etiquetas}. También puedes usar etiquetas libres que el dueño invente (ej: "MAYORISTA", "SEGUIMIENTO").

Tu trabajo:
1. Habla claro y corto, en español, tono amable y cercano.
2. Cuando el dueño describa CUÁNDO marcar algo, confirma con tus palabras la regla que entendiste.
3. Si la regla está clara, créala de inmediato: agrega AL FINAL de tu respuesta, en una sola línea, el marcador EXACTO:
[[REGLAS: [{"condicion":"...","etiqueta":"...","etiqueta_adicional":"..."}]]]
"etiqueta" es la principal (el estado). "etiqueta_adicional" es OPCIONAL: úsala solo si el dueño pide marcar TAMBIÉN una segunda etiqueta al mismo tiempo (ej: además de VENTA REALIZADA, marcar "CLIENTE VIP"). Si no aplica, omite "etiqueta_adicional" o déjala en "".
Puedes incluir varias reglas en el arreglo. El dueño NO ve este marcador (se borra). No lo menciones.
4. Si algo está ambiguo (no sabes qué etiqueta usar), pregunta antes de crear.
5. No inventes reglas que el dueño no pidió.`;

const RE = /\[\[\s*REGLAS\s*:\s*(\[[\s\S]*?\])\s*\]\]/i;

export async function POST(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const mensaje = String(body?.mensaje ?? '').trim();
  const historial: any[] = Array.isArray(body?.historial) ? body.historial : [];
  if (!mensaje) return NextResponse.json({ error: 'mensaje requerido' }, { status: 400 });

  const messages = [
    ...historial
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content as string })),
    { role: 'user' as const, content: mensaje },
  ];

  let texto = '';
  try {
    const resp = await responderIA(tid, { messages, systemPrompt: SYS(ESTADOS_VENTA.join(', ')), maxTokens: 500 });
    texto = resp?.message ?? '';
  } catch {
    return NextResponse.json({ reply: 'Ahora mismo no puedo ayudarte con eso. Intenta de nuevo en un momento.', reglasCreadas: [] });
  }

  // ¿Quino propuso reglas? → crearlas y borrar el marcador del texto visible.
  let reglasCreadas: any[] = [];
  const m = texto.match(RE);
  const visible = texto.replace(RE, '').replace(/\n{3,}/g, '\n\n').trim();
  if (m) {
    try {
      const arr = JSON.parse(m[1]);
      const filas = (Array.isArray(arr) ? arr : [])
        .map((r: any) => ({
          tenant_id: tid,
          condicion: String(r?.condicion ?? '').trim(),
          etiqueta:  String(r?.etiqueta ?? '').trim(),
          etiqueta_adicional: String(r?.etiqueta_adicional ?? '').trim() || null,
          activo: true,
        }))
        .filter((r: any) => r.condicion && r.etiqueta);
      if (filas.length) {
        const supabase = createServerSupabaseClient();
        let { data, error } = await supabase.from('reglas_etiqueta').insert(filas).select('*');
        if (error && /column .*etiqueta_adicional.* does not exist/i.test(error.message)) {
          const sinAdic = filas.map(({ etiqueta_adicional, ...rest }: any) => rest);
          ({ data } = await supabase.from('reglas_etiqueta').insert(sinAdic).select('*'));
        }
        reglasCreadas = data ?? [];
      }
    } catch { /* si el JSON viene mal, igual respondemos el texto */ }
  }

  return NextResponse.json({ reply: visible || texto, reglasCreadas });
}

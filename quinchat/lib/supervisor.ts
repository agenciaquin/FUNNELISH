import { createServerSupabaseClient } from '@/lib/supabase';
import { chat } from '@/lib/quinchat/claude';

/**
 * SUPERVISOR DEL BOT DE VENTAS (fase 1: auditor).
 *
 * Revisa cada conversación de la línea de ventas que ya terminó (vendida o
 * perdida), le pone un puntaje por etapa, señala el error exacto, clasifica el
 * perfil del cliente y propone UNA lección para el bot.
 *
 * Lecciones:
 *  · Riesgo BAJO (forma de vender: no repetir preguntas, mensajes más cortos,
 *    cómo manejar una objeción…) → se ACTIVAN SOLAS en la memoria del bot.
 *  · Riesgo ALTO (precios, descuentos, políticas, tiempos, envíos, garantías…)
 *    → quedan como PROPUESTA para que el dueño las apruebe.
 * Guardas: nunca se activan solas más de MAX_AUTO_ACTIVAS reglas, y cualquier
 * regla que hable de dinero/políticas se fuerza a riesgo alto aunque el modelo
 * diga lo contrario.
 */

export const TIPOS_ERROR = [
  'repitio_pregunta', 'pidio_dato_ya_dado', 'reenvio_catalogo', 'dato_inventado',
  'no_respondio_pregunta', 'mensaje_largo_confuso', 'no_intento_cerrar',
  'se_rindio_rapido', 'tono_inadecuado', 'humano_sin_motivo', 'otro',
] as const;

export const PERFILES = [
  'precio_y_se_va', 'indeciso', 'desconfiado', 'pareja_pack', 'duda_talla',
  'audios', 'mayorista', 'comprador_directo', 'otro',
] as const;

export const ETIQUETA_ERROR: Record<string, string> = {
  repitio_pregunta: 'Repitió una pregunta',
  pidio_dato_ya_dado: 'Pidió un dato que ya tenía',
  reenvio_catalogo: 'Reenvió el catálogo',
  dato_inventado: 'Inventó un dato / precio',
  no_respondio_pregunta: 'No respondió lo que preguntaron',
  mensaje_largo_confuso: 'Mensaje largo o confuso',
  no_intento_cerrar: 'No intentó cerrar',
  se_rindio_rapido: 'Se rindió muy rápido',
  tono_inadecuado: 'Tono inadecuado',
  humano_sin_motivo: 'Pasó a humano sin motivo',
  otro: 'Otro',
};

export const ETIQUETA_PERFIL: Record<string, string> = {
  precio_y_se_va: '🏃 Pregunta precio y se va',
  indeciso: '🤔 Indeciso',
  desconfiado: '🛡️ Desconfiado',
  pareja_pack: '👫 Pareja / pack',
  duda_talla: '📏 Duda de talla',
  audios: '🎙️ Habla por audios',
  mayorista: '📦 Mayorista',
  comprador_directo: '⚡ Comprador directo',
  otro: '• Otro',
};

const CATEGORIA_SUPERVISOR = 'Forma de vender';
const MAX_AUTO_ACTIVAS = 30;          // tope de reglas que el supervisor activa solo
const MAX_POR_CORRIDA = 6;            // chats auditados por corrida (tiempo y costo)

// Si la regla toca dinero, políticas o promesas → siempre la revisa el dueño.
const TEMA_SENSIBLE = /\$|\d{2,}\.?\d{3}|precio|descuent|rebaja|promo|gratis|regal|cobr|pag[oa]|abono|anticip|tarjeta|cr[eé]dito|addi|sistecr|env[ií]o|entrega|d[ií]as|horas|garant|cambio|devoluc|reembols|pol[ií]tica|transportadora|interrapid|oficina|mayor|stock|agotad|[uú]ltimas? unidad/i;

const ESTADOS_GANADOS = /VENTA REALIZADA|PEDIDO PROGRAMADO/i;

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Parecido entre dos reglas (0..1) por palabras compartidas: evita duplicados con otras palabras. */
function parecido(a: string, b: string): number {
  const A = new Set(normal(a).split(' ').filter(w => w.length > 3));
  const B = new Set(normal(b).split(' ').filter(w => w.length > 3));
  if (!A.size || !B.size) return 0;
  let comunes = 0;
  for (const w of A) if (B.has(w)) comunes++;
  return comunes / Math.min(A.size, B.size);
}

interface Auditoria {
  puntaje: number;
  etapas: Record<string, number | null>;
  errores: { mensaje?: number; tipo: string; descripcion: string; gravedad?: string }[];
  aciertos: string[];
  perfil: string;
  resumen: string;
  leccion: { regla: string; riesgo: 'bajo' | 'alto'; porque?: string } | null;
}

function extraerJSON(crudo: string): any {
  const limpio = crudo.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const ini = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (ini < 0 || fin <= ini) throw new Error('sin JSON');
  return JSON.parse(limpio.slice(ini, fin + 1));
}

/** Audita UNA conversación con la IA. */
async function auditarChat(transcripcion: string, vendida: boolean, reglasActivas: string[]): Promise<Auditoria> {
  const sistema =
`Eres el SUPERVISOR DE VENTAS de Klixmant (buzos de motos y escuderías, venta por WhatsApp, pago contra entrega, envío gratis).
Revisas cómo atendió el BOT a un cliente y le enseñas a vender mejor. Eres exigente pero justo.

La conversación ${vendida ? 'TERMINÓ EN VENTA ✅' : 'NO terminó en venta ❌'}.
Mensajes numerados: CLIENTE, BOT, ASESOR (humano). "[foto]" = el bot mandó una foto.

Evalúa SOLO al BOT (no al asesor humano; del asesor puedes aprender si cerró bien).

Devuelve ÚNICAMENTE un JSON con esta forma exacta:
{
 "puntaje": 0-100,
 "etapas": {"bienvenida":0-100|null,"eleccion":0-100|null,"talla":0-100|null,"datos":0-100|null,"cierre":0-100|null},
 "errores": [{"mensaje": número del mensaje del BOT, "tipo": uno de ${JSON.stringify(TIPOS_ERROR)}, "descripcion": "qué hizo mal y por qué afectó, en 1 frase", "gravedad": "alta"|"media"|"baja"}],
 "aciertos": ["lo que hizo bien, frases cortas"],
 "perfil": uno de ${JSON.stringify(PERFILES)},
 "resumen": "1 o 2 frases: por qué se ganó o se perdió",
 "leccion": {"regla": "instrucción accionable para el bot, en 1 frase, en español, sin nombres ni datos del cliente", "riesgo": "bajo"|"alto", "porque": "1 frase"} o null
}

REGLAS PARA LA LECCIÓN:
- Solo UNA, la que más ventas haría ganar en casos parecidos. Si no hay nada nuevo y claro que aprender, "leccion": null.
- Debe ser GENERAL (sirve para otros clientes con este perfil), no un caso puntual.
- riesgo "bajo" = forma de conversar: no repetir preguntas, ser más corto, preguntar distinto, manejar una duda, cuándo intentar cerrar.
- riesgo "alto" = cualquier cosa sobre precios, descuentos, regalos, pagos, abonos, tiempos o costos de envío, garantías, cambios, stock o promesas nuevas.
- NUNCA propongas inventar descuentos, urgencias falsas ni promesas que el negocio no ofrece.
- No repitas ni contradigas estas reglas que el bot YA tiene:
${reglasActivas.slice(0, 80).map(r => `  · ${r}`).join('\n') || '  (ninguna)'}

Si la conversación es muy corta para juzgar una etapa, pon null en esa etapa.`;

  const resp = await chat({
    messages: [{ role: 'user', content: `CONVERSACIÓN:\n${transcripcion}` }],
    tenantId: 'klixmant',
    systemPrompt: sistema,
    maxTokens: 1500,
  });
  const j = extraerJSON(resp.message);

  const puntaje = Math.max(0, Math.min(100, Math.round(Number(j.puntaje) || 0)));
  const etapas: Record<string, number | null> = {};
  for (const k of ['bienvenida', 'eleccion', 'talla', 'datos', 'cierre']) {
    const v = j.etapas?.[k];
    etapas[k] = v == null || v === '' ? null : Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  }
  const errores = (Array.isArray(j.errores) ? j.errores : []).slice(0, 6).map((e: any) => ({
    mensaje: Number.isFinite(Number(e?.mensaje)) ? Number(e.mensaje) : undefined,
    tipo: (TIPOS_ERROR as readonly string[]).includes(e?.tipo) ? e.tipo : 'otro',
    descripcion: String(e?.descripcion ?? '').slice(0, 300),
    gravedad: ['alta', 'media', 'baja'].includes(e?.gravedad) ? e.gravedad : 'media',
  })).filter((e: any) => e.descripcion);
  const aciertos = (Array.isArray(j.aciertos) ? j.aciertos : []).slice(0, 4).map((s: any) => String(s).slice(0, 200));
  const perfil = (PERFILES as readonly string[]).includes(j.perfil) ? j.perfil : 'otro';
  const lec = j.leccion && String(j.leccion.regla ?? '').trim().length > 15
    ? { regla: String(j.leccion.regla).trim().slice(0, 400), riesgo: (j.leccion.riesgo === 'bajo' ? 'bajo' : 'alto') as 'bajo' | 'alto', porque: String(j.leccion.porque ?? '').slice(0, 300) }
    : null;

  return { puntaje, etapas, errores, aciertos, perfil, resumen: String(j.resumen ?? '').slice(0, 500), leccion: lec };
}

/** Transcripción numerada (solo lo útil, recortada). */
function armarTranscripcion(msgs: any[]): string {
  const lineas: string[] = [];
  let n = 0;
  for (const m of msgs) {
    const quien = m.role === 'user' ? 'CLIENTE' : m.role === 'agent' ? 'ASESOR' : 'BOT';
    let c = String(m.content ?? '').trim();
    if (!c) continue;
    if (m.type === 'image' || /^https?:\/\//.test(c)) c = quien === 'CLIENTE' ? '[el cliente mandó una foto]' : '[foto]';
    else if (m.type === 'audio') c = '[audio]';
    // Fotos seguidas del bot → una sola línea
    const prev = lineas[lineas.length - 1];
    if (c === '[foto]' && prev?.endsWith('BOT: [foto]')) { lineas[lineas.length - 1] = prev.replace(/\[foto\]$/, '[varias fotos]'); continue; }
    if (c === '[foto]' && prev?.endsWith('BOT: [varias fotos]')) continue;
    n++;
    lineas.push(`${n}. ${quien}: ${c.slice(0, 600)}`);
  }
  return lineas.slice(-45).join('\n').slice(0, 14000);
}

/**
 * Corre una tanda del supervisor: toma chats de ventas que ya terminaron
 * (quietos hace 3–72 h, con interacción real) y que no se han auditado.
 */
export async function correrSupervisor(opts: { max?: number } = {}) {
  const supabase = createServerSupabaseClient();
  const max = Math.min(opts.max ?? MAX_POR_CORRIDA, 10);
  const ahora = Date.now();

  const { data: convs } = await supabase.from('conversations')
    .select('id, label')
    .eq('linea', 'ventas')
    .gte('last_message_time', new Date(ahora - 72 * 3_600_000).toISOString())
    .lte('last_message_time', new Date(ahora - 3 * 3_600_000).toISOString())
    .order('last_message_time', { ascending: false })
    .limit(300);
  if (!convs?.length) return { auditados: 0, lecciones: 0, auto: 0, motivo: 'sin chats' };

  const ids = convs.map(c => String(c.id));
  const { data: hechas } = await supabase.from('supervisor_auditorias').select('conversation_id').in('conversation_id', ids);
  const yaAuditados = new Set((hechas ?? []).map((h: any) => String(h.conversation_id)));
  const pendientes = convs.filter(c => !yaAuditados.has(String(c.id)) && !/VENDEDOR/i.test(String(c.label ?? '')));

  // Reglas actuales (para no duplicar) y cuántas activó ya el supervisor solo
  const { data: todas } = await supabase.from('memoria_bot').select('regla, estado, auto');
  const reglasActivas = (todas ?? []).filter((r: any) => r.estado === 'aprobada').map((r: any) => String(r.regla));
  const todasLasReglas = (todas ?? []).map((r: any) => String(r.regla));
  let autoActivas = (todas ?? []).filter((r: any) => r.estado === 'aprobada' && r.auto).length;

  const res = { auditados: 0, lecciones: 0, auto: 0, omitidos: 0, errores: 0 };

  // 1) Elegir la tanda: los chats sin interacción real se registran sin gastar IA.
  const tanda: { id: string; vendida: boolean; transcripcion: string }[] = [];
  for (const c of pendientes) {
    if (tanda.length >= max || res.omitidos >= 60) break;
    const id = String(c.id);
    const vendida = ESTADOS_GANADOS.test(String(c.label ?? ''));
    const { data: msgs } = await supabase.from('messages')
      .select('role, content, type, created_at').eq('conversation_id', id)
      .order('created_at', { ascending: true }).limit(120);
    const lista = msgs ?? [];
    const delCliente = lista.filter(m => m.role === 'user').length;
    const delBot = lista.filter(m => m.role === 'assistant').length;
    if (delCliente < 2 || delBot < 2) {
      await supabase.from('supervisor_auditorias').upsert({
        conversation_id: id, resultado: vendida ? 'vendida' : 'perdida',
        puntaje: null, perfil: 'precio_y_se_va', resumen: 'Sin interacción suficiente para evaluar.',
        etapas: null, errores: [], aciertos: [],
      }, { onConflict: 'conversation_id' });
      res.omitidos++;
      continue;
    }
    tanda.push({ id, vendida, transcripcion: armarTranscripcion(lista) });
  }

  // 2) Auditar en paralelo (rápido); las lecciones se procesan una a una después.
  const resultados = await Promise.all(tanda.map(t =>
    auditarChat(t.transcripcion, t.vendida, reglasActivas)
      .then(aud => ({ t, aud }))
      .catch((e: any) => { console.error('[Supervisor] no se pudo auditar', t.id, e?.message); return { t, aud: null as Auditoria | null }; })
  ));

  for (const { t, aud } of resultados) {
    if (!aud) { res.errores++; continue; }
    const id = t.id;
    const vendida = t.vendida;

    // ── Lección: ¿nueva? ¿bajo riesgo de verdad? → activar sola o proponer ──
    let leccionId: string | null = null;
    if (aud.leccion) {
      const regla = aud.leccion.regla;
      const duplicada = todasLasReglas.some(r => normal(r) === normal(regla) || parecido(r, regla) >= 0.7);
      if (!duplicada) {
        const sensible = TEMA_SENSIBLE.test(regla);
        const riesgo: 'bajo' | 'alto' = aud.leccion.riesgo === 'bajo' && !sensible ? 'bajo' : 'alto';
        const activar = riesgo === 'bajo' && autoActivas < MAX_AUTO_ACTIVAS;
        const ahoraIso = new Date().toISOString();
        const { data: ins } = await supabase.from('memoria_bot').insert({
          regla,
          categoria: CATEGORIA_SUPERVISOR,
          estado: activar ? 'aprobada' : 'propuesta',
          ejemplo: (aud.leccion.porque || aud.resumen || '').slice(0, 300),
          conversacion_id: id,
          creada_at: ahoraIso,
          aprobada_at: activar ? ahoraIso : null,
          origen: 'supervisor',
          riesgo,
          auto: activar,
        }).select('id').maybeSingle();
        leccionId = ins?.id ?? null;
        todasLasReglas.push(regla);
        if (activar) { autoActivas++; reglasActivas.push(regla); res.auto++; }
        res.lecciones++;
      }
    }

    await supabase.from('supervisor_auditorias').upsert({
      conversation_id: id,
      resultado: vendida ? 'vendida' : 'perdida',
      puntaje: aud.puntaje,
      etapas: aud.etapas,
      errores: aud.errores,
      aciertos: aud.aciertos,
      perfil: aud.perfil,
      resumen: aud.resumen,
      leccion_id: leccionId,
    }, { onConflict: 'conversation_id' });
    res.auditados++;
  }

  return res;
}

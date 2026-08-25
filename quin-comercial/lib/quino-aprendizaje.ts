// =====================================================
// Aprendizaje de Quino (asistente de conexión).
// Cerebro COMPARTIDO de la agencia: lo que aprende con un cliente,
// le sirve a todos los siguientes. Solo se accede desde el servidor
// (service_role); nunca desde el navegador.
// =====================================================

import { createServerSupabaseClient } from '@/lib/supabase';
import { chat } from '@/lib/quinchat/claude';

export interface Aprendizaje {
  id: string;
  problema: string;
  solucion: string;
  estado: 'aprobada' | 'descartada';
  veces_util: number;
  origen_slug: string | null;
  revisada: boolean;
  creada_at: string;
  actualizada_at: string;
}

/** Normaliza un texto para comparar problemas parecidos (dedup simple). */
function clave(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
}

/**
 * Texto que se inyecta en el prompt de Quino con lo aprendido de casos reales.
 * Vacío si aún no hay nada.
 */
export async function bloqueAprendido(limite = 40): Promise<string> {
  try {
    const admin = createServerSupabaseClient();
    const { data, error } = await admin
      .from('quino_aprendizaje')
      .select('problema, solucion, veces_util')
      .eq('estado', 'aprobada')
      .order('veces_util', { ascending: false })
      .order('actualizada_at', { ascending: false })
      .limit(limite);
    if (error) {
      // Si la tabla aún no existe (falta migración), no rompas el asistente.
      return '';
    }
    if (!data || data.length === 0) return '';
    let txt = '\n\n=== SOLUCIONES APRENDIDAS DE CASOS REALES ===\n';
    txt += 'Esto funcionó con otros clientes en situaciones parecidas. Úsalo como guía prioritaria cuando aplique:\n';
    for (const r of data) {
      txt += `\n• Problema: ${r.problema}\n  Solución: ${r.solucion}\n`;
    }
    return txt;
  } catch {
    return '';
  }
}

/**
 * Toma un intercambio (pregunta del cliente + respuesta de Quino que sirvió) y,
 * con la IA, lo condensa en un par problema→solución GENÉRICO y reutilizable.
 * Guarda como 'aprobada' (queda disponible ya) y 'revisada=false' para que el
 * superadmin lo revise después. Si no aporta nada reutilizable, no guarda.
 */
export async function guardarAprendizaje(
  problemaRaw: string,
  solucionRaw: string,
  origenSlug?: string | null,
): Promise<{ ok: boolean; motivo?: string }> {
  const p = String(problemaRaw ?? '').slice(0, 1500).trim();
  const s = String(solucionRaw ?? '').slice(0, 2500).trim();
  if (!p || !s) return { ok: false, motivo: 'vacío' };

  // 1) Condensar y limpiar datos sensibles con la IA.
  let problema = '', solucion = '';
  try {
    const sys = [
      'Eres un editor de una base de conocimiento de soporte técnico sobre CÓMO CONECTAR WhatsApp con Meta (WhatsApp Cloud API).',
      'Te paso un intercambio real entre un cliente y el asistente. Conviértelo en UNA entrada de conocimiento GENÉRICA y reutilizable para ayudar a otros clientes.',
      'REGLAS:',
      '- Quita TODO dato personal o sensible: tokens, URLs específicas de una empresa, números de teléfono, nombres propios, IDs concretos. Habla en general.',
      '- Si el intercambio NO contiene una solución reutilizable sobre conectar WhatsApp con Meta (por ejemplo es un saludo, un agradecimiento suelto o algo fuera de tema), responde EXACTAMENTE: NO_GUARDAR',
      '- Si sí sirve, responde SOLO en este formato exacto, sin nada más:',
      'PROBLEMA: <una línea, el problema o duda típica>',
      'SOLUCION: <2 a 5 líneas, los pasos que lo resuelven>',
    ].join('\n');
    const resp = await chat({
      messages: [{ role: 'user', content: `PREGUNTA DEL CLIENTE:\n${p}\n\nRESPUESTA QUE SIRVIÓ:\n${s}` }],
      systemPrompt: sys,
      maxTokens: 400,
    });
    const out = (resp.message ?? '').trim();
    if (/^NO_GUARDAR/i.test(out)) return { ok: false, motivo: 'no reutilizable' };
    const mp = out.match(/PROBLEMA:\s*([\s\S]*?)\s*SOLUCION:/i);
    const ms = out.match(/SOLUCION:\s*([\s\S]*)$/i);
    problema = (mp?.[1] ?? '').trim().slice(0, 400);
    solucion = (ms?.[1] ?? '').trim().slice(0, 1200);
    if (!problema || !solucion) return { ok: false, motivo: 'formato' };
  } catch {
    return { ok: false, motivo: 'ia' };
  }

  // 2) Dedup: si ya existe un problema muy parecido, súmale "veces_util".
  try {
    const admin = createServerSupabaseClient();
    const { data: existentes } = await admin
      .from('quino_aprendizaje')
      .select('id, problema, veces_util')
      .eq('estado', 'aprobada')
      .limit(200);
    const k = clave(problema);
    const dup = (existentes ?? []).find(e => clave(e.problema) === k);
    if (dup) {
      await admin.from('quino_aprendizaje')
        .update({ veces_util: (dup.veces_util ?? 1) + 1, actualizada_at: new Date().toISOString() })
        .eq('id', dup.id);
      return { ok: true, motivo: 'sumado' };
    }
    const { error } = await admin.from('quino_aprendizaje').insert({
      problema, solucion, estado: 'aprobada', veces_util: 1,
      origen_slug: origenSlug ?? null, revisada: false,
    });
    if (error) return { ok: false, motivo: error.message };
    return { ok: true, motivo: 'nuevo' };
  } catch (e: any) {
    return { ok: false, motivo: e?.message ?? 'db' };
  }
}

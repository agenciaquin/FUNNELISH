import { createServerSupabaseClient } from '@/lib/supabase';
import { listarPlantillas } from '@/lib/whatsapp-templates';
import { destinoWA } from '@/lib/whatsapp';
import { recortar } from '@/lib/recortar';
import { frenoMeta, esperarTurno } from '@/lib/ritmo-marketing';

/**
 * AVISO «INTENTO DE ENTREGA» (09-nov-2026) — parte del Panel de Novedades, independiente.
 *
 * Cuando una tarjeta del Panel de Novedades queda en «Intento de entrega» (estado de la transportadora) o con la
 * novedad de Effi «701 - Se visita, no se logra entrega», se le manda al cliente la plantilla aprobada
 * `novedad_intento_entrega` (texto del dueño, sin encabezado ni botones):
 *   {{1}} nombre del cliente · {{2}} ciudad de destino · {{3}} número de guía — todo desde Effi.
 *  · Interruptor: ajustes_bot «aviso_intento» { activo, desde, horas }. APAGADO por defecto; solo se enciende
 *    con la plantilla APROBADA. Al encender, las que ya estaban en intento quedan «previo» (envío manual).
 *  · Una sola vez por NOVEDAD (llave guía:novedad en avisos_intento) y nunca dos al mismo cliente en 48 h.
 *  · Freno de Meta, pausa entre envíos, «NO ENVIAR RECORDATORIO», horario 7 a. m. – 8 p. m.
 */
export const PLANTILLA_INTENTO = 'novedad_intento_entrega';
export const CUERPO_INTENTO = [
  '{{1}}! Tu pedido ya está en {{2}}🚗',
  'La transportadora nos indica que fueron a tu casa y no estabas',
  'Guía: {{3}}',
  'Nos preocupa que aún no hayas recibido',
  'Cuéntame por qué no pudiste recibir para solucionarlo con la transportadora.🙏',
].join('\n');
const TOPE = 10;

export interface AjustesIntento { activo: boolean; desde?: string | null; horas: [number, number]; plantilla_creada_at?: string | null }

export async function ajustesIntento(supabase: any): Promise<AjustesIntento> {
  const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'aviso_intento').maybeSingle();
  const v = (data?.valor ?? {}) as any;
  return {
    activo: v.activo === true, desde: v.desde ?? null, plantilla_creada_at: v.plantilla_creada_at ?? null,
    horas: Array.isArray(v.horas) && v.horas.length === 2 ? [Number(v.horas[0]), Number(v.horas[1])] : [7, 20],
  };
}
export async function guardarAjustesIntento(supabase: any, cambios: Partial<AjustesIntento>) {
  const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'aviso_intento').maybeSingle();
  const valor = { ...(data?.valor ?? {}), ...cambios };
  if (data) await supabase.from('ajustes_bot').update({ valor }).eq('clave', 'aviso_intento');
  else await supabase.from('ajustes_bot').insert({ clave: 'aviso_intento', valor });
  return valor;
}

export async function estadoPlantillaIntento(): Promise<{ status: string | null; idioma: string; error?: string }> {
  const r = await listarPlantillas();
  if (!r.ok) return { status: null, idioma: 'es', error: r.error };
  const t = r.plantillas.find(p => p.name === PLANTILLA_INTENTO);
  return t ? { status: t.status, idioma: t.language || 'es' } : { status: null, idioma: 'es' };
}

const WA_API = 'https://graph.facebook.com/v19.0';

/** Crea la plantilla en Meta (UTILIDAD, español), con el texto EXACTO del dueño. */
export async function crearPlantillaIntento(): Promise<{ ok: boolean; status?: string; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN, waba = process.env.WHATSAPP_WABA_ID;
  if (!token || !waba) return { ok: false, error: 'Falta configurar WHATSAPP_WABA_ID o el token de WhatsApp.' };
  const res = await fetch(`${WA_API}/${waba}/message_templates`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: PLANTILLA_INTENTO, category: 'UTILITY', language: 'es',
      components: [{ type: 'BODY', text: CUERPO_INTENTO, example: { body_text: [['María', 'Bucaramanga', '240065170587']] } }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, status: data.status } : { ok: false, error: String(data?.error?.error_user_msg ?? data?.error?.message ?? 'Meta no aceptó la plantilla') };
}

async function enviar(to: string, idioma: string, variables: string[]) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN, phone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phone) return { ok: false, error: 'Falta configuración de WhatsApp.' } as const;
  try {
    const res = await fetch(`${WA_API}/${phone}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', ...destinoWA(to), type: 'template',
        template: { name: PLANTILLA_INTENTO, language: { code: idioma }, components: [{ type: 'body', parameters: variables.map(v => ({ type: 'text', text: v || '—' })) }] },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: String(data?.error?.error_user_msg ?? data?.error?.message ?? 'No se pudo enviar') } as const;
    return { ok: true, wamid: data.messages?.[0]?.id as string | undefined } as const;
  } catch (e: any) { return { ok: false, error: e?.message ?? 'Error de red' } as const; }
}

const primerNombre = (n: unknown) => {
  const p = String(n ?? '').replace(/\s+/g, ' ').trim().split(' ')[0] ?? '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : 'Hola';
};
const ciudadBonita = (c: unknown) => String(c ?? '').replace(/\s+/g, ' ').trim() || 'tu ciudad';

/** Tarjetas del Panel de Novedades que HOY están en intento de entrega fallido. */
export async function novedadesEnIntento(supabase: any) {
  const { data } = await supabase.from('novedades_effi')
    .select('id, id_guia_effi, id_novedad_effi, guia, telefono, cliente, ciudad, vendedor, estado_effi, novedad_texto, motivo, estado')
    .eq('activa_en_effi', true).neq('estado', 'solucionada')
    .or('estado_effi.ilike.%intento de entrega%,novedad_texto.ilike.701 -%,novedad_texto.ilike.%se visita, no se logra entrega%')
    .limit(300);
  return (data ?? []).map((n: any) => ({ ...n, clave: `${n.id_guia_effi}:${n.id_novedad_effi || 'intento'}` }));
}

export async function marcarPreviosIntento(supabase: any) {
  const ns = await novedadesEnIntento(supabase);
  if (!ns.length) return 0;
  const { data } = await supabase.from('avisos_intento').upsert(ns.map((n: any) => ({
    clave: n.clave, id_guia_effi: n.id_guia_effi, id_novedad_effi: n.id_novedad_effi, novedad_id: n.id, guia: n.guia,
    telefono: n.telefono, nombre: n.cliente, ciudad: n.ciudad, vendedor: n.vendedor, motivo: n.novedad_texto || n.motivo,
    estado: 'previo', detalle: 'Ya estaba en intento de entrega al encender el aviso',
  })), { onConflict: 'clave', ignoreDuplicates: true }).select('clave');
  return (data ?? []).length;
}

/** Pasada automática (cron de Effi cada hora y Panel de Novedades). `manual` = claves elegidas en el panel. */
export async function procesarAvisosIntento(supabase?: any, manual?: string[], tope = TOPE) {
  supabase = supabase ?? createServerSupabaseClient();
  const cfg = await ajustesIntento(supabase);
  const res: Record<string, any> = { enviados: 0, omitidos: 0, errores: 0, pendientes: 0 };
  if (!cfg.activo) return { ...res, apagado: true };
  const tpl = await estadoPlantillaIntento();
  if (tpl.status !== 'APPROVED') return { ...res, error: `La plantilla «${PLANTILLA_INTENTO}» no está aprobada (${tpl.status ?? 'no existe'})` };
  const horaCo = new Date(Date.now() - 5 * 3600_000).getUTCHours();
  if (!manual && (horaCo < cfg.horas[0] || horaCo >= cfg.horas[1])) return { ...res, fuera_de_horario: true };
  const freno = await frenoMeta(supabase);
  if (freno.frenado) return { ...res, error: `Freno: Meta limitó ${freno.bloqueos} envíos en las últimas 2 h` };

  const ns = await novedadesEnIntento(supabase);
  const claves = ns.map((n: any) => n.clave);
  const { data: hechas } = claves.length ? await supabase.from('avisos_intento').select('clave, estado').in('clave', claves) : { data: [] as any[] };
  const ya = new Map<string, string>((hechas ?? []).map((h: any) => [String(h.clave), String(h.estado)]));
  const candidatas = ns.filter((n: any) => manual ? manual.includes(n.clave) && ['previo', 'error'].includes(ya.get(n.clave) ?? '') : !ya.has(n.clave));
  res.pendientes = Math.max(0, candidatas.length - tope);

  let k = 0;
  for (const n of candidatas) {
    if (k >= tope) break;
    if (manual) {
      const { data: t } = await supabase.from('avisos_intento').update({ estado: 'reservado', actualizado_at: new Date().toISOString() })
        .eq('clave', n.clave).in('estado', ['previo', 'error']).select('clave');
      if (!t?.length) continue;
    } else {
      const { error: dup } = await supabase.from('avisos_intento').insert({
        clave: n.clave, id_guia_effi: n.id_guia_effi, id_novedad_effi: n.id_novedad_effi, novedad_id: n.id, guia: n.guia,
        telefono: n.telefono, nombre: n.cliente, ciudad: n.ciudad, vendedor: n.vendedor, motivo: n.novedad_texto || n.motivo, plantilla: PLANTILLA_INTENTO,
      });
      if (dup) continue;
    }
    const marcar = (estado: string, extra: Record<string, any> = {}) =>
      supabase.from('avisos_intento').update({ estado, actualizado_at: new Date().toISOString(), ...extra }).eq('clave', n.clave);
    const tel = String(n.telefono ?? '');
    if (!/^3\d{9}$/.test(tel)) { await marcar('omitido', { detalle: 'Teléfono inválido en Effi' }); res.omitidos++; continue; }
    if (!n.guia) { await marcar('omitido', { detalle: 'La guía no tiene número' }); res.omitidos++; continue; }
    const conv = `57${tel}`;
    // Nunca dos avisos de intento al mismo cliente en 48 h (aunque sean dos novedades distintas)
    const { data: reciente } = await supabase.from('avisos_intento').select('clave').eq('telefono', tel).eq('estado', 'enviado')
      .neq('clave', n.clave).gte('enviado_at', new Date(Date.now() - 48 * 3600_000).toISOString()).limit(1);
    if (reciente?.length) { await marcar('omitido', { detalle: 'Ya se le avisó en las últimas 48 h' }); res.omitidos++; continue; }
    const { data: c } = await supabase.from('conversations').select('label, notas').eq('id', conv).maybeSingle();
    const labels = String(c?.label ?? '').split('|').map((x: string) => x.trim()).filter(Boolean);
    if (labels.some((l: string) => l.toUpperCase() === 'NO ENVIAR RECORDATORIO')) { await marcar('omitido', { detalle: 'Pidió no recibir mensajes' }); res.omitidos++; continue; }

    // Variables con los datos REALES de Effi
    const variables = [primerNombre(n.cliente), ciudadBonita(n.ciudad), String(n.guia)];
    const r = await enviar(conv, tpl.idioma, variables);
    if (!r.ok) { await marcar('error', { detalle: r.error }); res.errores++; continue; }
    const ahora = new Date().toISOString();
    await marcar('enviado', { wamid: r.wamid ?? null, enviado_at: ahora, detalle: null });
    res.enviados++; k++;

    try {
      let texto = CUERPO_INTENTO; variables.forEach((v, i) => { texto = texto.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, 'g'), v); });
      await supabase.from('conversations').upsert({
        id: conv, contact_name: String(n.cliente ?? tel), last_message: recortar(texto, 100), last_message_time: ahora,
        unread_count: 0, linea: 'funnel', oculto: true, bot_enabled: false,
      }, { onConflict: 'id', ignoreDuplicates: true });
      await supabase.from('messages').insert({
        id: `tpl-intento-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, conversation_id: conv,
        content: texto, role: 'agent', type: 'text', whatsapp_id: r.wamid ?? null, created_at: ahora,
      });
      const tag = 'NOVEDAD ENTREGA';
      const nuevas = labels.some((l: string) => l.toUpperCase() === tag) ? labels : [...labels, tag];
      const dia = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
      const notas = [String(c?.notas ?? '').trim(), `[${dia}] 🚚 Intento de entrega fallido (guía ${n.guia}). Se le avisó por plantilla; gestionar con la transportadora.`].filter(Boolean).join('\n');
      // La respuesta la gestiona un HUMANO con la transportadora: el bot no contesta este aviso
      await supabase.from('conversations').update({ label: nuevas.join(' | '), notas, bot_enabled: false }).eq('id', conv);
      await supabase.from('novedades_effi_historial').insert({ novedad_id: n.id, tipo: 'nota', detalle: '📲 Se le envió el aviso «Intento de entrega» por WhatsApp', por: 'Automático' });
      if (n.estado === 'nueva' || n.estado === 'pendiente') {
        await supabase.from('novedades_effi').update({ estado: 'en_gestion', estado_cambio_at: ahora, actualizado_at: ahora }).eq('id', n.id);
        await supabase.from('novedades_effi_historial').insert({ novedad_id: n.id, tipo: 'estado', detalle: '→ En gestión (se le avisó al cliente)', por: 'Automático' });
      }
    } catch (e) { console.error('[Aviso intento] registro:', e); }
    await esperarTurno();
  }
  return res;
}

/** Primera respuesta del cliente después del aviso (se guarda una vez encontrada). */
export async function completarRespuestasIntento(supabase: any, filas: any[]) {
  for (const f of filas.filter(x => x.estado === 'enviado' && !x.respuesta && x.telefono && x.enviado_at).slice(0, 40)) {
    const { data } = await supabase.from('messages').select('content, created_at')
      .eq('conversation_id', `57${f.telefono}`).eq('role', 'user').gt('created_at', f.enviado_at)
      .order('created_at', { ascending: true }).limit(1);
    const m = data?.[0];
    if (m) {
      f.respuesta = String(m.content ?? '').slice(0, 300); f.respuesta_at = m.created_at;
      await supabase.from('avisos_intento').update({ respuesta: f.respuesta, respuesta_at: f.respuesta_at }).eq('clave', f.clave);
      // La respuesta también queda en el historial de la novedad
      if (f.novedad_id) await supabase.from('novedades_effi_historial').insert({ novedad_id: f.novedad_id, tipo: 'nota', detalle: `💬 Respuesta del cliente: ${f.respuesta}`, por: 'Cliente' });
    }
  }
  return filas;
}

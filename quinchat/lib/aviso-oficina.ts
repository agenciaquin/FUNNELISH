import { createServerSupabaseClient } from '@/lib/supabase';
import { listarPlantillas, subirImagenEjemplo } from '@/lib/whatsapp-templates';
import { destinoWA } from '@/lib/whatsapp';
import { lineaDeVendedor, phoneIdDeLinea, ocultarHastaRespuesta, type LineaAviso } from '@/lib/aviso-linea';
import { recortar } from '@/lib/recortar';
import { frenoMeta, esperarTurno } from '@/lib/ritmo-marketing';
import { telefonoValido } from '@/lib/novedades-effi';

/**
 * AVISO «PEDIDO LISTO PARA RECLAMAR» (09-nov-2026) — parte del Panel de Novedades, independiente.
 *
 * Cuando una guía de Interrapidísimo queda «Reclame en oficina / Disponible para retiro en oficina» en Effi,
 * se le manda al cliente la plantilla aprobada `pedido_listo_para_reclamar` (UNA vez por guía).
 *  · Interruptor: ajustes_bot «aviso_oficina» { activo, desde, vendedores, media_url, media_tipo, horas }. Apagado por defecto.
 *  · Al ENCENDERLO, las guías que YA estaban en oficina quedan como «previo» (no se les manda nada solo);
 *    desde el panel se les puede mandar a mano con confirmación.
 *  · Solo con la plantilla APROBADA por Meta. Respeta el freno de Meta, la pausa entre envíos y la etiqueta
 *    «NO ENVIAR RECORDATORIO». Solo de 7 a. m. a 8 p. m. (hora Colombia); lo demás sale en la siguiente pasada.
 *  · Registro: tabla avisos_oficina (llave = guía → nunca se duplica) + el mensaje queda en el chat del cliente.
 */
export const PLANTILLA_OFICINA = 'pedido_listo_para_reclamar';
export const CUERPO_OFICINA = [
  '📦🎉 ¡Hola, {{1}}! ¡Tu pedido ya te está esperando!',
  '😍 Tu paquete de KLIXMANT ya llegó a la oficina de Interrapidísimo y está listo para reclamar.',
  '🚚 Número de guía: {{2}}',
  '⏰ ¡No dejes que sea devuelto! Recógelo en un máximo de 4 días hábiles y disfruta de tu nueva prenda. 🔥',
  '💚 ¿Nos confirmas cuándo pasarás por él?',
].join('\n');
export const BOTONES_OFICINA = ['✅ Reclamo hoy', '📅 Reclamo mañana', '💬 Necesito ayuda'];
const VENDEDORES_DEF = ['FUNNELISTH LANDING', 'QUINO AGENCIA'];
const TOPE_POR_PASADA = 10;

export interface AjustesOficina {
  activo: boolean; desde?: string | null; vendedores: string[];
  media_url?: string | null; media_tipo?: 'IMAGE' | 'VIDEO' | null; horas: [number, number];
  plantilla_creada_at?: string | null;
}

export async function ajustesOficina(supabase: any): Promise<AjustesOficina> {
  const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'aviso_oficina').maybeSingle();
  const v = (data?.valor ?? {}) as any;
  return {
    activo: v.activo === true, desde: v.desde ?? null,
    vendedores: Array.isArray(v.vendedores) && v.vendedores.length ? v.vendedores : VENDEDORES_DEF,
    media_url: v.media_url ?? null, media_tipo: v.media_tipo ?? null,
    horas: Array.isArray(v.horas) && v.horas.length === 2 ? [Number(v.horas[0]), Number(v.horas[1])] : [7, 20],
    plantilla_creada_at: v.plantilla_creada_at ?? null,
  };
}
export async function guardarAjustesOficina(supabase: any, cambios: Partial<AjustesOficina>) {
  const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'aviso_oficina').maybeSingle();
  const valor = { ...(data?.valor ?? {}), ...cambios };
  if (data) await supabase.from('ajustes_bot').update({ valor }).eq('clave', 'aviso_oficina');
  else await supabase.from('ajustes_bot').insert({ clave: 'aviso_oficina', valor });
  return valor;
}

/** Estado de la plantilla en Meta (APPROVED / PENDING / REJECTED / null si no existe). */
export async function estadoPlantillaOficina(): Promise<{ status: string | null; idioma: string; formato: string | null; error?: string; motivo?: string }> {
  const r = await listarPlantillas();
  if (!r.ok) return { status: null, idioma: 'es', formato: null, error: r.error };
  const t: any = r.plantillas.find(p => p.name === PLANTILLA_OFICINA);
  if (!t) return { status: null, idioma: 'es', formato: null };
  const header = (t.components ?? []).find((c: any) => c.type === 'HEADER');
  return { status: t.status, idioma: t.language || 'es', formato: header?.format ?? null };
}

const WA_API = 'https://graph.facebook.com/v19.0';

/**
 * Crea la plantilla en Meta (categoría UTILIDAD, español) con encabezado de imagen (JPG/PNG) o video (MP4).
 * Meta no acepta GIF en el encabezado: un GIF animado se sube convertido a MP4.
 * Si Meta rechaza los botones con emoji, se reintenta con el mismo texto sin emoji.
 */
export async function crearPlantillaOficina(archivo: Buffer, mime: string): Promise<{ ok: boolean; status?: string; error?: string; sin_emoji?: boolean }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN, waba = process.env.WHATSAPP_WABA_ID;
  if (!token || !waba) return { ok: false, error: 'Falta configurar WHATSAPP_WABA_ID o el token de WhatsApp.' };
  const formato = mime.startsWith('video/') ? 'VIDEO' : 'IMAGE';
  const handle = await subirImagenEjemplo(archivo, mime);       // misma subida de ejemplo que usa Plantillas (sirve para video)
  if (!handle) return { ok: false, error: 'Meta no recibió el archivo del encabezado.' };
  const armar = (botones: string[]) => ({
    name: PLANTILLA_OFICINA, category: 'UTILITY', language: 'es',
    components: [
      { type: 'HEADER', format: formato, example: { header_handle: [handle] } },
      { type: 'BODY', text: CUERPO_OFICINA, example: { body_text: [['María', '240012345678']] } },
      { type: 'BUTTONS', buttons: botones.map(t => ({ type: 'QUICK_REPLY', text: t })) },
    ],
  });
  const enviar = async (botones: string[]) => {
    const res = await fetch(`${WA_API}/${waba}/message_templates`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(armar(botones)),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, status: data.status as string } : { ok: false, error: String(data?.error?.error_user_msg ?? data?.error?.message ?? 'Meta no aceptó la plantilla') };
  };
  const r1 = await enviar(BOTONES_OFICINA);
  if (r1.ok || !/button|bot[oó]n|emoji|character|caracter/i.test(r1.error ?? '')) return r1;
  const r2 = await enviar(BOTONES_OFICINA.map(b => b.replace(/^[^\p{L}\p{N}]+/u, '').trim()));
  return { ...r2, sin_emoji: r2.ok };
}

/** Envía la plantilla (encabezado imagen o video). */
async function enviarPlantillaOficina(to: string, idioma: string, variables: string[], media: { url: string; tipo: 'IMAGE' | 'VIDEO' }, linea: LineaAviso = 'funnel') {
  const token = process.env.WHATSAPP_ACCESS_TOKEN, phone = phoneIdDeLinea(linea);
  if (!token || !phone) return { ok: false, error: 'Falta configuración de WhatsApp.' } as const;
  const header = media.tipo === 'VIDEO' ? { type: 'video', video: { link: media.url } } : { type: 'image', image: { link: media.url } };
  const payload = {
    messaging_product: 'whatsapp', ...destinoWA(to), type: 'template',
    template: { name: PLANTILLA_OFICINA, language: { code: idioma }, components: [
      { type: 'header', parameters: [header] },
      { type: 'body', parameters: variables.map(v => ({ type: 'text', text: v || '—' })) },
    ] },
  };
  try {
    const res = await fetch(`${WA_API}/${phone}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: String(data?.error?.error_user_msg ?? data?.error?.message ?? 'No se pudo enviar') } as const;
    return { ok: true, wamid: data.messages?.[0]?.id as string | undefined } as const;
  } catch (e: any) { return { ok: false, error: e?.message ?? 'Error de red' } as const; }
}

const primerNombre = (n: unknown) => {
  const p = String(n ?? '').replace(/\s+/g, ' ').trim().split(' ')[0] ?? '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : 'cliente';
};
const esVendedor = (v: unknown, lista: string[]) => {
  const t = String(v ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
  return lista.some(x => x.toUpperCase() === t) || (lista.some(x => /FUNNEL/i.test(x)) && /FUNNEL/.test(t) && /LANDING/.test(t));
};

/** Guías de Interrapidísimo que HOY están en oficina, de los vendedores configurados (copia de Effi). */
export async function guiasEnOficina(supabase: any, vendedores: string[]) {
  const { data: guias } = await supabase.from('effi_guias_api')
    .select('id_effi, guia, telefono, tel_raw:datos->>telefonos_destinatario, nombre, transportadora, estado, estado_efficommerce, vigente, fecha_anular, id_ref, tipo_trans_ref')
    .or('estado.ilike.%reclame en oficina%,estado_efficommerce.ilike.%retiro en oficina%')
    .ilike('transportadora', '%inter%')
    .gte('fecha_trans', new Date(Date.now() - 40 * 86400_000).toISOString())
    .limit(500);
  const vivas = (guias ?? []).filter((g: any) => g.vigente !== false && !g.fecha_anular);
  const refs = [...new Set(vivas.map((g: any) => g.id_ref).filter(Boolean))];
  const vend = new Map<string, string>();
  for (let i = 0; i < refs.length; i += 300) {
    const { data } = await supabase.from('effi_remisiones_api').select('id_effi, vendedor').in('id_effi', refs.slice(i, i + 300));
    for (const r of data ?? []) vend.set(String(r.id_effi), String(r.vendedor ?? ''));
  }
  return vivas.map((g: any) => ({ ...g, vendedor: vend.get(String(g.id_ref)) ?? null }))
    .filter((g: any) => esVendedor(g.vendedor, vendedores));
}

/** Al encender: lo que ya estaba en oficina queda como «previo» (no se le manda nada automáticamente). */
export async function marcarPrevios(supabase: any, vendedores: string[]) {
  const guias = await guiasEnOficina(supabase, vendedores);
  if (!guias.length) return 0;
  const { data } = await supabase.from('avisos_oficina').upsert(guias.map((g: any) => ({
    id_guia_effi: String(g.id_effi), guia: g.guia, telefono: telefonoValido(g.tel_raw ?? g.telefono), nombre: g.nombre,
    vendedor: g.vendedor, transportadora: g.transportadora, estado: 'previo', motivo: 'Ya estaba en oficina al encender el aviso',
  })), { onConflict: 'id_guia_effi', ignoreDuplicates: true }).select('id_guia_effi');
  return (data ?? []).length;
}

/**
 * Pasada automática (la llaman la sincronización de Effi de cada hora y el Panel de Novedades).
 * `manual`: ids de guías «previo» o con error que el dueño pidió mandar desde el panel (ignora el horario).
 */
export async function procesarAvisosOficina(supabase?: any, manual?: string[], tope = TOPE_POR_PASADA, opc: { ignorarInterruptor?: boolean } = {}) {
  supabase = supabase ?? createServerSupabaseClient();
  const cfg = await ajustesOficina(supabase);
  const res = { enviados: 0, omitidos: 0, errores: 0, pendientes: 0 } as Record<string, any>;
  // El envío MANUAL desde una tarjeta (botón «Enviar aviso») no depende del interruptor de la automatización
  if (!cfg.activo && !opc.ignorarInterruptor) return { ...res, apagado: true };
  if (!cfg.media_url || !cfg.media_tipo) return { ...res, error: 'Falta la imagen o el video del encabezado' };
  const tpl = await estadoPlantillaOficina();
  if (tpl.status !== 'APPROVED') return { ...res, error: `La plantilla «${PLANTILLA_OFICINA}» no está aprobada (${tpl.status ?? 'no existe'})` };
  const horaCo = new Date(Date.now() - 5 * 3600_000).getUTCHours();
  if (!manual && (horaCo < cfg.horas[0] || horaCo >= cfg.horas[1])) return { ...res, fuera_de_horario: true };
  const freno = await frenoMeta(supabase);
  if (freno.frenado) return { ...res, error: `Freno: Meta limitó ${freno.bloqueos} envíos en las últimas 2 h` };

  const guias = await guiasEnOficina(supabase, cfg.vendedores);
  const ids = guias.map((g: any) => String(g.id_effi));
  const { data: hechas } = ids.length ? await supabase.from('avisos_oficina').select('id_guia_effi, estado').in('id_guia_effi', ids) : { data: [] as any[] };
  const ya = new Map<string, string>((hechas ?? []).map((h: any) => [String(h.id_guia_effi), String(h.estado)]));
  const candidatas = guias.filter((g: any) => manual
    ? manual.includes(String(g.id_effi)) && !['enviado', 'reservado'].includes(ya.get(String(g.id_effi)) ?? '')
    : !ya.has(String(g.id_effi)));
  res.pendientes = Math.max(0, candidatas.length - tope);

  let n = 0;
  for (const g of candidatas) {
    if (n >= tope) break;
    const id = String(g.id_effi);
    const tel = telefonoValido(g.tel_raw ?? g.telefono);
    // Reserva por guía: la llave única impide mandarle dos veces (aunque dos pasadas coincidan)
    if (manual && ya.has(id)) {
      const { data: tomada } = await supabase.from('avisos_oficina').update({ estado: 'reservado', actualizado_at: new Date().toISOString() })
        .eq('id_guia_effi', id).in('estado', ['previo', 'error', 'omitido']).select('id_guia_effi');
      if (!tomada?.length) continue;
    } else {
      const { error: dup } = await supabase.from('avisos_oficina').insert({
        id_guia_effi: id, guia: g.guia, telefono: tel, nombre: g.nombre, vendedor: g.vendedor, transportadora: g.transportadora, plantilla: PLANTILLA_OFICINA,
      });
      if (dup) continue;
    }
    const marcar = (estado: string, extra: Record<string, any> = {}) =>
      supabase.from('avisos_oficina').update({ estado, actualizado_at: new Date().toISOString(), ...extra }).eq('id_guia_effi', id);
    if (!tel || !/^3\d{9}$/.test(tel)) { await marcar('omitido', { motivo: 'Teléfono inválido en Effi' }); res.omitidos++; continue; }
    const conv = `57${tel}`;
    const { data: c } = await supabase.from('conversations').select('label, notas').eq('id', conv).maybeSingle();
    const labels = String(c?.label ?? '').split('|').map((x: string) => x.trim()).filter(Boolean);
    if (labels.some((l: string) => l.toUpperCase() === 'NO ENVIAR RECORDATORIO')) { await marcar('omitido', { motivo: 'Pidió no recibir mensajes' }); res.omitidos++; continue; }

    const variables = [primerNombre(g.nombre), String(g.guia ?? id)];
    const linea = lineaDeVendedor(g.vendedor);   // por el chat donde compró
    const r = await enviarPlantillaOficina(conv, tpl.idioma, variables, { url: cfg.media_url, tipo: cfg.media_tipo }, linea);
    if (!r.ok) { await marcar('error', { motivo: r.error }); res.errores++; continue; }
    const ahora = new Date().toISOString();
    await marcar('enviado', { wamid: r.wamid ?? null, enviado_at: ahora, motivo: null });
    res.enviados++; n++;

    // Registro en el chat (el chat existente no cambia de línea; si no existe se crea oculto hasta que responda)
    try {
      let texto = CUERPO_OFICINA; variables.forEach((v, i) => { texto = texto.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, 'g'), v); });
      texto += `\n\n[${BOTONES_OFICINA.join('] [')}]`;
      await supabase.from('conversations').upsert({
        id: conv, contact_name: String(g.nombre ?? tel), last_message: recortar(texto, 100), last_message_time: ahora,
        unread_count: 0, linea, oculto: true, bot_enabled: false,
      }, { onConflict: 'id', ignoreDuplicates: true });
      await supabase.from('messages').insert({
        id: `tpl-oficina-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, conversation_id: conv,
        content: cfg.media_url, role: 'agent', type: cfg.media_tipo === 'VIDEO' ? 'video' : 'image', created_at: new Date(Date.parse(ahora) - 1).toISOString(),
      });
      await supabase.from('messages').insert({
        id: `tpl-oficina-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, conversation_id: conv,
        content: texto, role: 'agent', type: 'text', whatsapp_id: r.wamid ?? null, created_at: ahora,
      });
      const tag = 'EN OFICINA';
      const nuevas = labels.some((l: string) => l.toUpperCase() === tag) ? labels : [...labels, tag];
      const dia = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
      const notas = [String(c?.notas ?? '').trim(), `[${dia}] 📦 Pedido en oficina de Interrapidísimo (guía ${g.guia ?? id}). Se le avisó por plantilla.`].filter(Boolean).join('\n');
      // Responde un HUMANO (como el descuento por entrega): el bot no contesta los botones de este aviso
      await supabase.from('conversations').update({ label: nuevas.join(' | '), notas, bot_enabled: false }).eq('id', conv);
      // No llena la bandeja: oculto hasta que el cliente responda (si el chat no está activo)
      await ocultarHastaRespuesta(supabase, conv, linea);
      // Historial en el Panel de Novedades, si la guía tiene tarjeta
      const { data: nov } = await supabase.from('novedades_effi').select('id').eq('id_guia_effi', id).maybeSingle();
      if (nov?.id) await supabase.from('novedades_effi_historial').insert({ novedad_id: nov.id, tipo: 'nota', detalle: '📲 Se le envió el aviso «Pedido listo para reclamar» por WhatsApp', por: 'Automático' });
    } catch (e) { console.error('[Aviso oficina] registro en el chat:', e); }
    await esperarTurno();
  }
  return res;
}

/** Primera respuesta del cliente después del aviso (para supervisar). Se guarda una vez encontrada. */
export async function completarRespuestas(supabase: any, filas: any[]) {
  for (const f of filas.filter(x => x.estado === 'enviado' && !x.respuesta && x.telefono && x.enviado_at).slice(0, 40)) {
    const { data } = await supabase.from('messages').select('content, created_at')
      .eq('conversation_id', `57${f.telefono}`).eq('role', 'user').gt('created_at', f.enviado_at)
      .order('created_at', { ascending: true }).limit(1);
    const m = data?.[0];
    if (m) {
      f.respuesta = String(m.content ?? '').slice(0, 300); f.respuesta_at = m.created_at;
      await supabase.from('avisos_oficina').update({ respuesta: f.respuesta, respuesta_at: f.respuesta_at }).eq('id_guia_effi', f.id_guia_effi);
    }
  }
  return filas;
}

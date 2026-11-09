import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { listarPlantillas } from '@/lib/whatsapp-templates';
import { destinoWA } from '@/lib/whatsapp';
import { lineaDeVendedor, phoneIdDeLinea, ocultarHastaRespuesta, type LineaAviso } from '@/lib/aviso-linea';
import { recortar } from '@/lib/recortar';
import { frenoMeta, esperarTurno } from '@/lib/ritmo-marketing';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';

/**
 * MOTOR de los avisos SOLO TEXTO del Panel de Novedades (09-nov-2026): «Intento de entrega» y «Dirección no localizada».
 * Cada aviso es una configuración (plantilla, texto exacto, qué novedades lo disparan, tabla, etiqueta del chat).
 *  · Plantilla UTILITY en español con {{1}} primer nombre · {{2}} ciudad · {{3}} guía (datos reales de Effi).
 *  · Interruptor en ajustes_bot (APAGADO por defecto; solo se enciende con la plantilla APROBADA). Al encender, los casos que ya
 *    estaban quedan «previo» (envío manual). Una sola vez por NOVEDAD (llave guía:novedad) y máx. 1 por cliente cada 48 h.
 *  · Sale por la línea de la compra y el chat queda oculto hasta que el cliente responda (lib/aviso-linea.ts).
 *  · Respuestas: TODO lo que el cliente manda después (texto, fotos, ubicación, audio) queda en `respuestas` y en el historial
 *    de la novedad, para gestionarlo desde el panel.
 */
export interface ConfigAvisoTexto {
  clave: string;               // ajustes_bot.clave
  tabla: string;               // avisos_intento / avisos_direccion
  plantilla: string;
  cuerpo: string;
  ejemplo: string[];
  nombreCorto: string;         // para notas / historial
  etiqueta: string;            // etiqueta del chat
  nota: (guia: string) => string;
  prefijoMsg: string;          // id de los mensajes (tpl-…)
  filtroOr: string;            // filtro PostgREST sobre novedades_effi
  coincide: (n: { estado_effi?: string | null; estado_effi_comercio?: string | null; novedad_texto?: string | null }) => boolean;
}

const WA_API = 'https://graph.facebook.com/v19.0';
const TOPE = 10;
const primerNombre = (n: unknown) => {
  const p = String(n ?? '').replace(/\s+/g, ' ').trim().split(' ')[0] ?? '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : 'Hola';
};
const ciudadBonita = (c: unknown) => String(c ?? '').replace(/\s+/g, ' ').trim() || 'tu ciudad';

export interface AjustesAviso { activo: boolean; desde?: string | null; horas: [number, number]; plantilla_creada_at?: string | null }

export function avisoTexto(cfg: ConfigAvisoTexto) {
  async function ajustes(supabase: any): Promise<AjustesAviso> {
    const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', cfg.clave).maybeSingle();
    const v = (data?.valor ?? {}) as any;
    return {
      activo: v.activo === true, desde: v.desde ?? null, plantilla_creada_at: v.plantilla_creada_at ?? null,
      horas: Array.isArray(v.horas) && v.horas.length === 2 ? [Number(v.horas[0]), Number(v.horas[1])] : [7, 20],
    };
  }
  async function guardarAjustes(supabase: any, cambios: Partial<AjustesAviso>) {
    const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', cfg.clave).maybeSingle();
    const valor = { ...(data?.valor ?? {}), ...cambios };
    if (data) await supabase.from('ajustes_bot').update({ valor }).eq('clave', cfg.clave);
    else await supabase.from('ajustes_bot').insert({ clave: cfg.clave, valor });
    return valor;
  }
  async function estadoPlantilla(): Promise<{ status: string | null; idioma: string; error?: string }> {
    const r = await listarPlantillas();
    if (!r.ok) return { status: null, idioma: 'es', error: r.error };
    const t = r.plantillas.find(p => p.name === cfg.plantilla);
    return t ? { status: t.status, idioma: t.language || 'es' } : { status: null, idioma: 'es' };
  }
  async function crearPlantilla(): Promise<{ ok: boolean; status?: string; error?: string }> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN, waba = process.env.WHATSAPP_WABA_ID;
    if (!token || !waba) return { ok: false, error: 'Falta configurar WHATSAPP_WABA_ID o el token de WhatsApp.' };
    const res = await fetch(`${WA_API}/${waba}/message_templates`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cfg.plantilla, category: 'UTILITY', language: 'es',
        components: [{ type: 'BODY', text: cfg.cuerpo, example: { body_text: [cfg.ejemplo] } }] }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, status: data.status } : { ok: false, error: String(data?.error?.error_user_msg ?? data?.error?.message ?? 'Meta no aceptó la plantilla') };
  }
  async function enviar(to: string, idioma: string, variables: string[], linea: LineaAviso) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN, phone = phoneIdDeLinea(linea);
    if (!token || !phone) return { ok: false, error: 'Falta configuración de WhatsApp.' } as const;
    try {
      const res = await fetch(`${WA_API}/${phone}/messages`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...destinoWA(to), type: 'template',
          template: { name: cfg.plantilla, language: { code: idioma }, components: [{ type: 'body', parameters: variables.map(v => ({ type: 'text', text: v || '—' })) }] } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: String(data?.error?.error_user_msg ?? data?.error?.message ?? 'No se pudo enviar') } as const;
      return { ok: true, wamid: data.messages?.[0]?.id as string | undefined } as const;
    } catch (e: any) { return { ok: false, error: e?.message ?? 'Error de red' } as const; }
  }

  /** Tarjetas del Panel de Novedades que HOY están en este caso. */
  async function novedadesEnCaso(supabase: any) {
    const { data } = await supabase.from('novedades_effi')
      .select('id, id_guia_effi, id_novedad_effi, guia, telefono, cliente, ciudad, vendedor, estado_effi, estado_effi_comercio, novedad_texto, motivo, estado')
      .eq('activa_en_effi', true).neq('estado', 'solucionada').or(cfg.filtroOr).limit(300);
    return (data ?? []).filter((n: any) => cfg.coincide(n)).map((n: any) => ({ ...n, clave: `${n.id_guia_effi}:${n.id_novedad_effi || 'estado'}` }));
  }

  async function marcarPrevios(supabase: any) {
    const ns = await novedadesEnCaso(supabase);
    if (!ns.length) return 0;
    const { data } = await supabase.from(cfg.tabla).upsert(ns.map((n: any) => ({
      clave: n.clave, id_guia_effi: n.id_guia_effi, id_novedad_effi: n.id_novedad_effi, novedad_id: n.id, guia: n.guia,
      telefono: n.telefono, nombre: n.cliente, ciudad: n.ciudad, vendedor: n.vendedor, motivo: n.novedad_texto || n.motivo,
      estado: 'previo', detalle: 'Ya estaba en este caso al encender el aviso',
    })), { onConflict: 'clave', ignoreDuplicates: true }).select('clave');
    return (data ?? []).length;
  }

  async function procesar(supabase?: any, manual?: string[], tope = TOPE, opc: { ignorarInterruptor?: boolean } = {}) {
    supabase = supabase ?? createServerSupabaseClient();
    const conf = await ajustes(supabase);
    const res: Record<string, any> = { enviados: 0, omitidos: 0, errores: 0, pendientes: 0 };
    if (!conf.activo && !opc.ignorarInterruptor) return { ...res, apagado: true };
    const tpl = await estadoPlantilla();
    if (tpl.status !== 'APPROVED') return { ...res, error: `La plantilla «${cfg.plantilla}» no está aprobada (${tpl.status ?? 'no existe'})` };
    const horaCo = new Date(Date.now() - 5 * 3600_000).getUTCHours();
    if (!manual && (horaCo < conf.horas[0] || horaCo >= conf.horas[1])) return { ...res, fuera_de_horario: true };
    const freno = await frenoMeta(supabase);
    if (freno.frenado) return { ...res, error: `Freno: Meta limitó ${freno.bloqueos} envíos en las últimas 2 h` };

    const ns = await novedadesEnCaso(supabase);
    const claves = ns.map((n: any) => n.clave);
    const { data: hechas } = claves.length ? await supabase.from(cfg.tabla).select('clave, estado').in('clave', claves) : { data: [] as any[] };
    const ya = new Map<string, string>((hechas ?? []).map((h: any) => [String(h.clave), String(h.estado)]));
    const candidatas = ns.filter((n: any) => manual ? manual.includes(n.clave) && !['enviado', 'reservado'].includes(ya.get(n.clave) ?? '') : !ya.has(n.clave));
    res.pendientes = Math.max(0, candidatas.length - tope);

    let k = 0;
    for (const n of candidatas) {
      if (k >= tope) break;
      if (manual && ya.has(n.clave)) {
        const { data: t } = await supabase.from(cfg.tabla).update({ estado: 'reservado', actualizado_at: new Date().toISOString() })
          .eq('clave', n.clave).in('estado', ['previo', 'error', 'omitido']).select('clave');
        if (!t?.length) continue;
      } else {
        const { error: dup } = await supabase.from(cfg.tabla).insert({
          clave: n.clave, id_guia_effi: n.id_guia_effi, id_novedad_effi: n.id_novedad_effi, novedad_id: n.id, guia: n.guia,
          telefono: n.telefono, nombre: n.cliente, ciudad: n.ciudad, vendedor: n.vendedor, motivo: n.novedad_texto || n.motivo, plantilla: cfg.plantilla,
        });
        if (dup) continue;
      }
      const marcar = (estado: string, extra: Record<string, any> = {}) =>
        supabase.from(cfg.tabla).update({ estado, actualizado_at: new Date().toISOString(), ...extra }).eq('clave', n.clave);
      const tel = String(n.telefono ?? '');
      if (!/^3\d{9}$/.test(tel)) { await marcar('omitido', { detalle: 'Teléfono inválido en Effi' }); res.omitidos++; continue; }
      if (!n.guia) { await marcar('omitido', { detalle: 'La guía no tiene número' }); res.omitidos++; continue; }
      const conv = `57${tel}`;
      const { data: reciente } = await supabase.from(cfg.tabla).select('clave').eq('telefono', tel).eq('estado', 'enviado')
        .neq('clave', n.clave).gte('enviado_at', new Date(Date.now() - 48 * 3600_000).toISOString()).limit(1);
      if (reciente?.length) { await marcar('omitido', { detalle: 'Ya se le avisó en las últimas 48 h' }); res.omitidos++; continue; }
      const { data: c } = await supabase.from('conversations').select('label, notas').eq('id', conv).maybeSingle();
      const labels = String(c?.label ?? '').split('|').map((x: string) => x.trim()).filter(Boolean);
      if (labels.some((l: string) => l.toUpperCase() === 'NO ENVIAR RECORDATORIO')) { await marcar('omitido', { detalle: 'Pidió no recibir mensajes' }); res.omitidos++; continue; }

      const variables = [primerNombre(n.cliente), ciudadBonita(n.ciudad), String(n.guia)];   // datos reales de Effi
      const linea = lineaDeVendedor(n.vendedor);                                              // por el chat donde compró
      const r = await enviar(conv, tpl.idioma, variables, linea);
      if (!r.ok) { await marcar('error', { detalle: r.error }); res.errores++; continue; }
      const ahora = new Date().toISOString();
      await marcar('enviado', { wamid: r.wamid ?? null, enviado_at: ahora, detalle: null });
      res.enviados++; k++;

      try {
        let texto = cfg.cuerpo; variables.forEach((v, i) => { texto = texto.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, 'g'), v); });
        await supabase.from('conversations').upsert({
          id: conv, contact_name: String(n.cliente ?? tel), last_message: recortar(texto, 100), last_message_time: ahora,
          unread_count: 0, linea, oculto: true, bot_enabled: false,
        }, { onConflict: 'id', ignoreDuplicates: true });
        await supabase.from('messages').insert({
          id: `${cfg.prefijoMsg}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, conversation_id: conv,
          content: texto, role: 'agent', type: 'text', whatsapp_id: r.wamid ?? null, created_at: ahora,
        });
        const nuevas = labels.some((l: string) => l.toUpperCase() === cfg.etiqueta) ? labels : [...labels, cfg.etiqueta];
        const dia = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
        const notas = [String(c?.notas ?? '').trim(), `[${dia}] ${cfg.nota(String(n.guia))}`].filter(Boolean).join('\n');
        await supabase.from('conversations').update({ label: nuevas.join(' | '), notas, bot_enabled: false }).eq('id', conv);
        await ocultarHastaRespuesta(supabase, conv, linea);
        await supabase.from('novedades_effi_historial').insert({ novedad_id: n.id, tipo: 'nota', detalle: `📲 Se le envió el aviso «${cfg.nombreCorto}» por WhatsApp`, por: 'Automático' });
        if (n.estado === 'nueva' || n.estado === 'pendiente') {
          await supabase.from('novedades_effi').update({ estado: 'en_gestion', estado_cambio_at: ahora, actualizado_at: ahora }).eq('id', n.id);
          await supabase.from('novedades_effi_historial').insert({ novedad_id: n.id, tipo: 'estado', detalle: '→ En gestión (se le avisó al cliente)', por: 'Automático' });
        }
      } catch (e) { console.error(`[Aviso ${cfg.clave}] registro:`, e); }
      await esperarTurno();
    }
    return res;
  }

  /**
   * Respuestas del cliente después del aviso (texto, fotos, ubicación, audio): se guardan en `respuestas` y cada una
   * nueva queda en el historial de la novedad. Solo avisos de los últimos 5 días y como mucho cada 2 min por aviso.
   */
  async function completarRespuestas(supabase: any, filas: any[]) {
    const ahora = Date.now();
    const revisar = filas.filter(f => f.estado === 'enviado' && f.telefono && f.enviado_at
      && ahora - Date.parse(f.enviado_at) < 5 * 86400_000
      && (!f.respuestas_revisado_at || ahora - Date.parse(f.respuestas_revisado_at) > 120_000)).slice(0, 30);
    for (const f of revisar) {
      const { data } = await supabase.from('messages').select('id, content, type, caption, created_at')
        .eq('conversation_id', `57${f.telefono}`).eq('role', 'user').gt('created_at', f.enviado_at)
        .order('created_at', { ascending: true }).limit(20);
      const previas: any[] = Array.isArray(f.respuestas) ? f.respuestas : [];
      const vistos = new Set(previas.map(r => r.id));
      const nuevas = (data ?? []).filter((m: any) => !vistos.has(m.id))
        .map((m: any) => ({ id: m.id, tipo: m.type ?? 'text', contenido: String(m.content ?? '').slice(0, 600), caption: m.caption ?? null, at: m.created_at }));
      const todas = [...previas, ...nuevas];
      const primera = todas.find(r => r.tipo === 'text') ?? todas[0];
      const upd: Record<string, any> = { respuestas_revisado_at: new Date().toISOString() };
      if (nuevas.length) {
        upd.respuestas = todas;
        upd.respuesta = primera ? (primera.tipo === 'text' ? primera.contenido.slice(0, 300) : primera.tipo === 'image' ? '📷 Envió una foto' : `📎 ${primera.tipo}`) : null;
        upd.respuesta_at = upd.respuesta_at ?? (f.respuesta_at || todas[0]?.at || null);
        Object.assign(f, upd);
        if (f.novedad_id) await supabase.from('novedades_effi_historial').insert(nuevas.map((r: any) => ({
          novedad_id: f.novedad_id, tipo: 'nota', por: 'Cliente',
          detalle: r.tipo === 'text' ? `💬 Respondió: ${r.contenido}` : r.tipo === 'image' ? `📷 Envió una foto${r.caption ? `: ${r.caption}` : ''} ${r.contenido}`
            : r.tipo === 'location' ? `📍 Envió su ubicación ${r.contenido}` : `📎 Envió ${r.tipo}: ${r.contenido}`,
        })));
      }
      f.respuestas_revisado_at = upd.respuestas_revisado_at;
      await supabase.from(cfg.tabla).update(upd).eq('clave', f.clave);
    }
    return filas;
  }

  /** Rutas del panel (/api/novedades/<tipo>), misma forma que /api/novedades/oficina. */
  function rutas() {
    async function GET() {
      const auth = await exigirSesion();
      if (auth.error) return auth.error;
      const supabase = createServerSupabaseClient();
      const [conf, tpl] = await Promise.all([ajustes(supabase), estadoPlantilla()]);
      const { data } = await supabase.from(cfg.tabla).select('*').order('creado_at', { ascending: false }).limit(150);
      const filas = await completarRespuestas(supabase, data ?? []);
      const cuenta = (e: string) => filas.filter((f: any) => f.estado === e).length;
      let enNovedad = 0;
      try { enNovedad = (await novedadesEnCaso(supabase)).length; } catch { /* nada */ }
      return NextResponse.json({
        ajustes: conf, plantilla: { nombre: cfg.plantilla, cuerpo: cfg.cuerpo, botones: [], ...tpl },
        avisos: filas.map((f: any) => ({ ...f, novedad: f.motivo, motivo: f.detalle })), en_novedad: enNovedad,
        contadores: { enviado: cuenta('enviado'), respondieron: filas.filter((f: any) => f.respuesta).length, previo: cuenta('previo'), error: cuenta('error'), omitido: cuenta('omitido') },
      });
    }
    async function POST() {
      const auth = await exigirSesion();
      if (auth.error) return auth.error;
      const supabase = createServerSupabaseClient();
      const ya = await estadoPlantilla();
      if (ya.status) return NextResponse.json({ error: `La plantilla ya existe en Meta (${ya.status}).` }, { status: 409 });
      const r = await crearPlantilla();
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
      await guardarAjustes(supabase, { plantilla_creada_at: new Date().toISOString() });
      return NextResponse.json({ ok: true, status: r.status });
    }
    async function PATCH(req: NextRequest) {
      const auth = await exigirSesion();
      if (auth.error) return auth.error;
      const b = await req.json().catch(() => ({}));
      const supabase = createServerSupabaseClient();
      if (b?.accion === 'desactivar') { await guardarAjustes(supabase, { activo: false }); return NextResponse.json({ ok: true }); }
      if (b?.accion === 'activar') {
        const tpl = await estadoPlantilla();
        if (tpl.status !== 'APPROVED') return NextResponse.json({ error: `Meta aún no aprueba la plantilla (${tpl.status ?? 'no creada'}). No se activa.` }, { status: 400 });
        const previos = await marcarPrevios(supabase);
        await guardarAjustes(supabase, { activo: true, desde: new Date().toISOString() });
        return NextResponse.json({ ok: true, previos });
      }
      if (b?.accion === 'pasada') return NextResponse.json(await procesar(supabase));
      if (b?.accion === 'enviar') {
        const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, 10);
        if (!ids.length) return NextResponse.json({ error: 'Elige a quién mandar.' }, { status: 400 });
        return NextResponse.json(await procesar(supabase, ids, 10));
      }
      return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
    }
    return { GET, POST, PATCH };
  }

  return { cfg, ajustes, guardarAjustes, estadoPlantilla, crearPlantilla, novedadesEnCaso, marcarPrevios, procesar, completarRespuestas, rutas };
}

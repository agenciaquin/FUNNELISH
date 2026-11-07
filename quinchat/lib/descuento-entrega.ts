import { enviarPlantilla, listarPlantillas } from '@/lib/whatsapp-templates';
import { recortar } from '@/lib/recortar';
import { grupoDeGuia } from '@/lib/effi-estados';
import { frenoMeta, esperarTurno, TOPE_DESCUENTOS_POR_PASADA, wamidsBloqueados, clienteEscribio } from '@/lib/ritmo-marketing';

/**
 * DESCUENTO POR ENTREGA: cuando una guía de Effi queda ENTREGADA, se le envía al cliente
 * una plantilla aprobada con $15.000 de descuento para su próxima compra.
 *
 * Interruptor: ajustes_bot «descuento_entrega» { activo, plantilla, monto, desde }.
 * Corre al final de cada sincronización con Effi (botón o cron effi-sync).
 *  · Solo guías entregadas DESDE que se encendió (nunca las viejas: sería una ráfaga).
 *  · Una vez por guía (descuentos_entrega tiene la guía como llave) y máximo una por
 *    número cada 30 días.
 *  · Nunca a quien respondió SALIR (NO ENVIAR RECORDATORIO).
 *  · El chat queda con la etiqueta «BONO» y una nota, para que el asesor
 *    lo aplique en la siguiente compra.
 */
/**
 * ATRASADOS (entregas de días ANTERIORES a «desde»): se envían por TANDAS para no
 * arriesgar bloqueos de Meta. Config en el mismo ajuste:
 *   atrasados: { activo, desde:'AAAA-MM-DD', lote: 20, cada_min: 110, horas: [8,10,12,14,18,20], ultimo_lote_at }
 * El cron de Effi corre cada hora en punto; solo en las horas de la lista (hora Colombia)
 * y si pasaron ≥ cada_min desde la última tanda, manda hasta `lote` mensajes.
 * Cuando no queda ninguno pendiente, se apaga solo.
 */
export interface Atrasados { activo?: boolean; desde?: string; lote?: number; cada_min?: number; horas?: number[]; ultimo_lote_at?: string }
export interface AjustesDescuento { activo: boolean; plantilla: string; monto: number; desde?: string; atrasados?: Atrasados }

export async function ajustesDescuento(supabase: any): Promise<AjustesDescuento> {
  const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'descuento_entrega').maybeSingle();
  const v = (data?.valor ?? {}) as any;
  return { activo: v.activo === true, plantilla: String(v.plantilla || 'descuento_entregado_15mil'), monto: Number(v.monto) || 15000, desde: v.desde, atrasados: v.atrasados };
}

/** Foto guardada para una plantilla (configuracion «plantilla_img_<nombre>»). */
export async function fotoPlantilla(supabase: any, nombre: string): Promise<string | null> {
  const { data } = await supabase.from('configuracion').select('valor').eq('clave', `plantilla_img_${nombre}`).maybeSingle();
  const v = String(data?.valor ?? '');
  return v.startsWith('http') ? v : null;
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export async function procesarDescuentosEntrega(supabase: any): Promise<{ enviados: number; omitidos: number; errores: number; apagado?: boolean; error?: string; atrasados?: number; atrasados_pendientes?: number }> {
  const cfg = await ajustesDescuento(supabase);
  const res: { enviados: number; omitidos: number; errores: number; atrasados?: number; atrasados_pendientes?: number } = { enviados: 0, omitidos: 0, errores: 0 };
  if (!cfg.activo || !cfg.desde) return { ...res, apagado: true };

  const { plantillas } = await listarPlantillas();
  // Preferencia: la v2 (el descuento va en la PRIMERA línea, no queda oculto tras «Leer más»);
  // mientras Meta no la apruebe, se usa la configurada.
  const tpl = [`${cfg.plantilla}_v2`, cfg.plantilla]
    .map(n => (plantillas ?? []).find(p => p.name === n && p.status === 'APPROVED')).find(Boolean);
  if (!tpl) return { ...res, error: `La plantilla «${cfg.plantilla}» no está aprobada` };

  // Foto del encabezado: la que se guardó al crear la plantilla en QuinChat (Plantillas)
  // o la que se suba en Estado de pedido. Sin foto, Meta rechaza el envío.
  const foto = tpl.tieneImagen ? await fotoPlantilla(supabase, tpl.name) : null;
  if (tpl.tieneImagen && !foto) return { ...res, error: `Falta la foto de la plantilla «${tpl.name}»` };

  // Si Meta nos está limitando, esta pasada no envía nada (se retoma en la siguiente hora).
  const freno = await frenoMeta(supabase);
  if (freno.frenado) return { ...res, error: `Freno: Meta limitó ${freno.bloqueos} envíos en las últimas 2 h; se retoma en la próxima pasada` };

  const desdeDia = String(cfg.desde).slice(0, 10);
  const { data: guias } = await supabase.from('effi_guias_api')
    .select('guia, id_effi, telefono, nombre, estado, estado_efficommerce, vigente, fecha_estado_final')
    .ilike('estado_efficommerce', 'entregada%')
    .gte('fecha_estado_final', `${desdeDia}T00:00:00Z`)
    .limit(200);

  // Ritmo: máximo N por pasada (los demás salen en la siguiente hora) y pausa entre envíos
  await enviarAGuias(supabase, guias ?? [], cfg, tpl, foto, res, TOPE_DESCUENTOS_POR_PASADA);

  // ── Tanda de ATRASADOS (entregas anteriores a «desde») ──────────────────────
  const at = cfg.atrasados;
  if (at?.activo && at.desde) {
    const horaCo = new Date(Date.now() - 5 * 3600_000).getUTCHours();
    const horas = Array.isArray(at.horas) && at.horas.length ? at.horas : [8, 10, 12, 14, 18, 20];
    const cadaMin = Number(at.cada_min) || 110;
    const ultimo = Date.parse(at.ultimo_lote_at ?? '') || 0;
    const cupo = TOPE_DESCUENTOS_POR_PASADA - res.enviados;   // lo que queda de esta pasada
    if (cupo > 0 && horas.includes(horaCo) && Date.now() - ultimo >= cadaMin * 60_000) {
      const { data: viejas } = await supabase.from('effi_guias_api')
        .select('guia, id_effi, telefono, nombre, estado, estado_efficommerce, vigente, fecha_estado_final')
        .ilike('estado_efficommerce', 'entregada%')
        .gte('fecha_estado_final', `${String(at.desde).slice(0, 10)}T00:00:00Z`)
        .lt('fecha_estado_final', `${desdeDia}T00:00:00Z`)
        .order('fecha_estado_final', { ascending: false })
        .limit(400);
      const { data: hechas } = await supabase.from('descuentos_entrega').select('guia');
      const yaHechas = new Set((hechas ?? []).map((h: any) => String(h.guia)));
      const pendientes = (viejas ?? []).filter((g: any) => !yaHechas.has(String(g.guia || g.id_effi || '').trim()));
      const lote = Math.max(1, Math.min(cupo, Number(at.lote) || 20));
      const antes = res.enviados;
      await enviarAGuias(supabase, pendientes, cfg, tpl, foto, res, lote);
      res.atrasados = res.enviados - antes;
      const quedan = Math.max(0, pendientes.length - lote);
      const nuevoAt = { ...at, ultimo_lote_at: new Date().toISOString(), ...(pendientes.length === 0 ? { activo: false, terminado_at: new Date().toISOString() } : {}) };
      const { data: fila } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'descuento_entrega').maybeSingle();
      await supabase.from('ajustes_bot').update({ valor: { ...(fila?.valor ?? {}), atrasados: nuevoAt } }).eq('clave', 'descuento_entrega');
      res.atrasados_pendientes = quedan;
    }
  }

  // Reintento ÚNICO (48 h después) a los que Meta no entregó por su límite por persona (131049)
  if (res.enviados < TOPE_DESCUENTOS_POR_PASADA) {
    try { (res as any).reintentos = await reintentarDescuentosBloqueados(supabase, cfg, tpl, foto, 2); }
    catch (e) { console.error('[Descuento] reintentos:', e); }
  }
  return res;
}

/** Reenvía UNA vez el descuento a quien Meta no se lo entregó (131049), si no ha escrito ni lo usó. */
async function reintentarDescuentosBloqueados(supabase: any, cfg: AjustesDescuento, tpl: any, foto: string | null, max: number): Promise<number> {
  const wamids = await wamidsBloqueados(supabase, 'tpl-desc-');
  if (!wamids.length) return 0;
  const { data: filas } = await supabase.from('descuentos_entrega')
    .select('guia, telefono, nombre, enviado_at').eq('estado', 'enviado').in('wamid', wamids)
    .is('reintento_at', null).is('usado_at', null).limit(10);
  let n = 0;
  for (const f of filas ?? []) {
    if (n >= max) break;
    const { data: tomado } = await supabase.from('descuentos_entrega')
      .update({ reintento_at: new Date().toISOString() }).eq('guia', f.guia).is('reintento_at', null).select('guia');
    if (!tomado?.length) continue;
    const tel10 = String(f.telefono ?? '');
    if (!/^3\d{9}$/.test(tel10) || await clienteEscribio(supabase, `57${tel10}`, f.enviado_at ?? new Date(0).toISOString())) continue;
    const nombre = String(f.nombre ?? '').replace(/\s+/g, ' ').trim().split(' ')[0] || 'hola';
    const variables = [nombre, pesos(cfg.monto)].slice(0, tpl.variables);
    const r = await enviarPlantilla(`57${tel10}`, tpl.name, tpl.language || 'es', variables, foto);
    if (!r.ok) continue;
    await supabase.from('descuentos_entrega').update({ wamid: r.wamid ?? null, enviado_at: new Date().toISOString() }).eq('guia', f.guia);
    let texto = tpl.cuerpo || `🎁 Descuento de ${pesos(cfg.monto)} para la próxima compra`;
    variables.forEach((v, i) => { texto = texto.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, 'g'), v); });
    try {
      await supabase.from('messages').insert({
        id: `tpl-desc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        conversation_id: `57${tel10}`, content: texto, role: 'agent', type: 'text', whatsapp_id: r.wamid ?? null, created_at: new Date().toISOString(),
      });
    } catch { /* ignorar */ }
    n++;
    await esperarTurno();
  }
  return n;
}

/** Envía el descuento a una lista de guías entregadas (máximo `tope` envíos reales). */
async function enviarAGuias(supabase: any, guias: any[], cfg: AjustesDescuento, tpl: any, foto: string | null, res: any, tope: number) {
  let enviadosAqui = 0;
  for (const g of guias) {
    if (enviadosAqui >= tope) break;
    if (grupoDeGuia(g) !== 'entregada') continue;
    const guia = String(g.guia || g.id_effi || '').trim();
    const tel10 = String(g.telefono ?? '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
    if (!guia || !/^3\d{9}$/.test(tel10)) continue;

    // Reserva por guía (si ya existe, ya se procesó)
    const { error: dup } = await supabase.from('descuentos_entrega')
      .insert({ guia, telefono: tel10, nombre: g.nombre ?? null, monto: cfg.monto });
    if (dup) continue;
    const marcar = (estado: string, extra: Record<string, any> = {}) =>
      supabase.from('descuentos_entrega').update({ estado, ...extra }).eq('guia', guia);

    // ¿Pidió no recibir mensajes?
    const { data: conv } = await supabase.from('conversations').select('label, notas').eq('id', `57${tel10}`).maybeSingle();
    const labels = String(conv?.label ?? '').split('|').map((x: string) => x.trim()).filter(Boolean);
    if (labels.some((l: string) => l.toUpperCase() === 'NO ENVIAR RECORDATORIO')) { await marcar('omitido', { motivo: 'pidió SALIR' }); res.omitidos++; continue; }

    // ¿Ya se le dio un descuento en los últimos 30 días? (otra guía del mismo cliente)
    const { data: previo } = await supabase.from('descuentos_entrega').select('guia')
      .eq('telefono', tel10).eq('estado', 'enviado').neq('guia', guia)
      .gte('creado_at', new Date(Date.now() - 30 * 86400_000).toISOString()).limit(1);
    if (previo?.length) { await marcar('omitido', { motivo: 'ya tiene un descuento reciente' }); res.omitidos++; continue; }

    const nombre = String(g.nombre ?? '').replace(/\s+/g, ' ').trim().split(' ')[0] || 'hola';
    const variables = [nombre, pesos(cfg.monto)].slice(0, tpl.variables);
    const r = await enviarPlantilla(`57${tel10}`, tpl.name, tpl.language || 'es', variables, foto);
    if (!r.ok) { await marcar('error', { motivo: r.error ?? 'error de envío' }); res.errores++; continue; }
    await marcar('enviado', { wamid: r.wamid ?? null, enviado_at: new Date().toISOString() });
    res.enviados++; enviadosAqui++;
    await esperarTurno();   // ritmo: no salen en ráfaga

    // Registro en el chat + etiqueta y nota para que el asesor aplique el descuento
    try {
      let texto = tpl.cuerpo || `🎁 Descuento de ${pesos(cfg.monto)} para la próxima compra`;
      variables.forEach((v, i) => { texto = texto.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, 'g'), v); });
      const ahora = new Date().toISOString();
      await supabase.from('conversations').upsert({
        id: `57${tel10}`, contact_name: String(g.nombre ?? tel10), last_message: recortar(texto, 100), last_message_time: ahora, unread_count: 0, linea: 'funnel',
        oculto: true,   // no sale en la bandeja hasta que el cliente responda
        bot_enabled: false,
      }, { onConflict: 'id', ignoreDuplicates: true });
      if (foto) {
        await supabase.from('messages').insert({
          id: `tpl-desc-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          conversation_id: `57${tel10}`, content: foto, role: 'agent', type: 'image', created_at: new Date(Date.parse(ahora) - 1).toISOString(),
        });
      }
      await supabase.from('messages').insert({
        id: `tpl-desc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        conversation_id: `57${tel10}`, content: texto, role: 'agent', type: 'text', whatsapp_id: r.wamid ?? null, created_at: ahora,
      });
      const tag = 'DESCUENTO';   // etiqueta adicional para los que recibieron la plantilla de descuento
      const nuevas = labels.some((l: string) => l.toUpperCase() === tag) ? labels : [...labels, tag];
      const fecha = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
      const notas = [String(conv?.notas ?? '').trim(), `[${fecha}] 🎁 Tiene ${pesos(cfg.monto)} de descuento para su próxima compra (guía ${guia} entregada).`].filter(Boolean).join('\n');
      // El chat del descuento lo atiende un HUMANO: bot apagado (07-nov-2026, decisión del dueño)
      await supabase.from('conversations').update({ label: nuevas.join(' | '), notas, bot_enabled: false }).eq('id', `57${tel10}`);
    } catch (e) { console.error('[Descuento] registro en el chat:', e); }
  }
}

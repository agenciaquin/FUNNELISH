import { enviarPlantilla, listarPlantillas } from '@/lib/whatsapp-templates';
import { recortar } from '@/lib/recortar';
import { grupoDeGuia } from '@/lib/effi-estados';

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
 *  · El chat queda con la etiqueta «DESCUENTO 15.000» y una nota, para que el asesor
 *    lo aplique en la siguiente compra.
 */
export interface AjustesDescuento { activo: boolean; plantilla: string; monto: number; desde?: string }

export async function ajustesDescuento(supabase: any): Promise<AjustesDescuento> {
  const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'descuento_entrega').maybeSingle();
  const v = (data?.valor ?? {}) as any;
  return { activo: v.activo === true, plantilla: String(v.plantilla || 'descuento_entregado_15mil'), monto: Number(v.monto) || 15000, desde: v.desde };
}

/** Foto guardada para una plantilla (configuracion «plantilla_img_<nombre>»). */
export async function fotoPlantilla(supabase: any, nombre: string): Promise<string | null> {
  const { data } = await supabase.from('configuracion').select('valor').eq('clave', `plantilla_img_${nombre}`).maybeSingle();
  const v = String(data?.valor ?? '');
  return v.startsWith('http') ? v : null;
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export async function procesarDescuentosEntrega(supabase: any): Promise<{ enviados: number; omitidos: number; errores: number; apagado?: boolean; error?: string }> {
  const cfg = await ajustesDescuento(supabase);
  const res = { enviados: 0, omitidos: 0, errores: 0 };
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

  const desdeDia = String(cfg.desde).slice(0, 10);
  const { data: guias } = await supabase.from('effi_guias_api')
    .select('guia, id_effi, telefono, nombre, estado, estado_efficommerce, vigente, fecha_estado_final')
    .ilike('estado_efficommerce', 'entregada%')
    .gte('fecha_estado_final', `${desdeDia}T00:00:00Z`)
    .limit(200);

  for (const g of guias ?? []) {
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
    res.enviados++;

    // Registro en el chat + etiqueta y nota para que el asesor aplique el descuento
    try {
      let texto = tpl.cuerpo || `🎁 Descuento de ${pesos(cfg.monto)} para la próxima compra`;
      variables.forEach((v, i) => { texto = texto.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, 'g'), v); });
      const ahora = new Date().toISOString();
      await supabase.from('conversations').upsert({
        id: `57${tel10}`, contact_name: String(g.nombre ?? tel10), last_message: recortar(texto, 100), last_message_time: ahora, unread_count: 0, linea: 'funnel',
        oculto: true,   // no sale en la bandeja hasta que el cliente responda
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
      const tag = `DESCUENTO ${pesos(cfg.monto).replace('$', '')}`;
      const nuevas = labels.some((l: string) => l.toUpperCase() === tag) ? labels : [...labels, tag];
      const fecha = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
      const notas = [String(conv?.notas ?? '').trim(), `[${fecha}] 🎁 Tiene ${pesos(cfg.monto)} de descuento para su próxima compra (guía ${guia} entregada).`].filter(Boolean).join('\n');
      await supabase.from('conversations').update({ label: nuevas.join(' | '), notas }).eq('id', `57${tel10}`);
    } catch (e) { console.error('[Descuento] registro en el chat:', e); }
  }
  return res;
}

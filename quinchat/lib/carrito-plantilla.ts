import { enviarPlantilla, listarPlantillas } from '@/lib/whatsapp-templates';
import { recortar } from '@/lib/recortar';
import { fotoDelCarrito } from '@/lib/foto-carrito';

/**
 * Envío de la plantilla de CARRITO ABANDONADO (una sola vez por carrito).
 * Lo usan el botón 📩 del panel y el envío automático (cron a los 10 min).
 * Reglas: nunca a quien ya tiene chat en QuinChat ni a quien ya hizo un pedido;
 * verificación justo antes de enviar y "reserva" atómica para no duplicar.
 */

/** Plantillas de carrito, en orden de preferencia (la v2 lleva nombre, producto y foto). */
export const PLANTILLAS_CARRITO = ['carrito_abandonado_v2', 'carrito_abandonado'];

export interface ResultadoCarrito {
  ok?: boolean; status: number; error?: string; bloqueado?: boolean; plantilla?: string; wamid?: string;
}

/** ¿Bloqueado? 'chat abierto' si ya tiene chat; 'ya compró' si tiene un pedido (no cancelado/duplicado). */
export async function bloqueoCarrito(supabase: any, tel10: string): Promise<string | null> {
  const { data: env } = await supabase.from('carritos_envios').select('telefono').eq('telefono', tel10).maybeSingle();
  if (env) return 'ya enviada a este número';
  const { data: conv } = await supabase.from('conversations').select('id').eq('id', `57${tel10}`).maybeSingle();
  if (conv) return 'chat abierto';
  const { data: ped } = await supabase.from('clientes_funnelish').select('id')
    .eq('telefono', tel10).not('estado', 'in', '("cancelado","duplicado")').limit(1);
  if (ped && ped.length) return 'ya compró';
  return null;
}

export async function enviarPlantillaCarrito(supabase: any, id: string): Promise<ResultadoCarrito> {
  const bloqueo = bloqueoCarrito;
  const { data: c } = await supabase.from('carritos_abandonados')
    .select('id, slug, nombre, telefono, producto, talla, datos, recuperado, plantilla_enviada_at').eq('id', id).maybeSingle();
  if (!c) return { error: 'No encontré el carrito.', status: 404 };
  if ((c as any).plantilla_enviada_at) return { error: 'A este carrito ya se le envió la plantilla.', status: 409 };
  if ((c as any).recuperado) return { error: 'Este carrito ya está marcado como recuperado.', status: 409 };

  const tel10 = String((c as any).telefono ?? '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
  if (!/^3\d{9}$/.test(tel10)) return { error: 'El teléfono del carrito no es válido.', status: 400 };

  // 1) Verificación en tiempo real: ¿tiene chat o ya compró?
  const b1 = await bloqueo(supabase, tel10);
  if (b1) return { error: b1, bloqueado: true, status: 409 };

  // 2) Plantilla aprobada a usar
  const { plantillas } = await listarPlantillas();
  const tpl = PLANTILLAS_CARRITO.map(n => (plantillas ?? []).find(p => p.name === n && p.status === 'APPROVED')).find(Boolean);
  if (!tpl) return { error: 'No hay una plantilla de carrito aprobada (carrito_abandonado).', status: 400 };

  // 3) "Reservar" el carrito de forma atómica: si otro clic/proceso ya lo tomó, no se duplica.
  const ahora = new Date().toISOString();
  const { data: tomado } = await supabase.from('carritos_abandonados')
    .update({ plantilla_enviada_at: ahora, plantilla_nombre: tpl.name, plantilla_error: null })
    .eq('id', id).is('plantilla_enviada_at', null).select('id');
  if (!tomado?.length) return { error: 'A este carrito ya se le envió la plantilla.', status: 409 };

  // 3b) UNA plantilla por NÚMERO, no por carrito (un cliente puede tener 2–3 carritos de
  //     varios embudos: el 05-nov a Jose y Gerson les llegó 3 veces). carritos_envios tiene
  //     el teléfono como llave: si dos envíos corren a la vez, solo uno logra insertarlo.
  const { error: errTel } = await supabase.from('carritos_envios').insert({ telefono: tel10, carrito_id: id });
  if (errTel) {
    await supabase.from('carritos_abandonados').update({ plantilla_enviada_at: null }).eq('id', id);
    return { error: 'ya enviada a este número', bloqueado: true, status: 409 };
  }
  const soltarTel = () => supabase.from('carritos_envios').delete().eq('telefono', tel10).eq('carrito_id', id);

  // 4) Última verificación justo antes de enviar (por si compró o escribió en este instante)
  const b2 = await bloqueo(supabase, tel10);
  if (b2) {
    await supabase.from('carritos_abandonados').update({ plantilla_enviada_at: null, plantilla_error: null }).eq('id', id);
    await soltarTel();
    return { error: b2, bloqueado: true, status: 409 };
  }

  // 5) Variables según la plantilla: {{1}} primer nombre, {{2}} producto (+ talla)
  // Meta rechaza variables con saltos de línea, tabulaciones o más de 4 espacios seguidos.
  const limpio = (t: unknown) => String(t ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const nombre = limpio((c as any).nombre).split(' ')[0] || 'hola';
  const producto = limpio([limpio((c as any).producto), limpio((c as any).talla)].filter(Boolean).join(', ')).slice(0, 120) || 'tu pedido';
  const variables = [nombre, producto].slice(0, tpl.variables);
  // Foto REAL del producto, sacada del catálogo de colores como al confirmar una compra.
  // (La que guarda el formulario en el carrito es la MINIATURA del embudo, no el buzo.)
  let imagen: string | null = null;
  if (tpl.tieneImagen) {
    try { imagen = await fotoDelCarrito(supabase, String((c as any).producto ?? ''), String((c as any).talla ?? '')); }
    catch (e) { console.error('[Carrito] foto del catálogo:', e); }
  }
  if (tpl.tieneImagen && !imagen) {
    await soltarTel();
    await supabase.from('carritos_abandonados').update({ plantilla_enviada_at: null, plantilla_error: 'No encontré la foto de este producto en el catálogo de colores.' }).eq('id', id);
    return { error: 'No encontré la foto de este producto en el catálogo de colores; no se envió para no mandar una foto equivocada.', status: 400 };
  }

  const r = await enviarPlantilla(`57${tel10}`, tpl.name, tpl.language || 'es', variables, imagen);
  if (!r.ok) {
    await soltarTel();
    await supabase.from('carritos_abandonados').update({ plantilla_enviada_at: null, plantilla_error: r.error ?? 'Error de envío' }).eq('id', id);
    return { error: r.error ?? 'No se pudo enviar.', status: 502 };
  }
  await supabase.from('carritos_abandonados').update({ plantilla_wamid: r.wamid ?? null }).eq('id', id);

  // 6) Dejar el chat creado con el mensaje enviado, para que el asesor/bot tenga el contexto
  let texto = tpl.cuerpo || `📋 Plantilla enviada: ${tpl.name}`;
  variables.forEach((v, i) => { texto = texto.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, 'g'), v); });
  texto += `\n\n🛒 (Carrito abandonado: ${producto})`;
  try {
    await supabase.from('conversations').upsert({
      id: `57${tel10}`, contact_name: String((c as any).nombre ?? '').trim() || tel10,
      last_message: recortar(texto, 100), last_message_time: ahora, unread_count: 0, linea: 'funnel',
      oculto: true,   // no sale en la bandeja hasta que el cliente responda
    }, { onConflict: 'id', ignoreDuplicates: true });
    // Etiqueta adicional (beige) «CARRITO ABANDONADO», sin quitar las que ya tenga
    const { data: cv } = await supabase.from('conversations').select('label').eq('id', `57${tel10}`).maybeSingle();
    const etiquetas = String(cv?.label ?? '').split('|').map((x: string) => x.trim()).filter(Boolean);
    if (!etiquetas.some((l: string) => l.toUpperCase() === 'CARRITO ABANDONADO')) {
      await supabase.from('conversations').update({ label: [...etiquetas, 'CARRITO ABANDONADO'].join(' | ') }).eq('id', `57${tel10}`);
    }
    // La foto del encabezado SÍ le llega al cliente; también se guarda en el chat
    // para que en el panel se vea igual que en su WhatsApp.
    if (imagen) {
      await supabase.from('messages').insert({
        id: `tpl-carrito-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        conversation_id: `57${tel10}`, content: imagen, role: 'agent', type: 'image',
        created_at: new Date(Date.parse(ahora) - 1).toISOString(),
      });
    }
    await supabase.from('messages').insert({
      id: `tpl-carrito-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversation_id: `57${tel10}`, content: texto, role: 'agent', type: 'text',
      whatsapp_id: r.wamid ?? null, created_at: ahora,
    });
  } catch (e) { console.error('[Carrito] no se pudo registrar en el chat:', e); }

  return { ok: true, status: 200, plantilla: tpl.name, wamid: r.wamid };
}

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
export const PLANTILLAS_CARRITO = ['carrito_abandonado_v3', 'carrito_abandonado_v2', 'carrito_abandonado'];
// v3 (07-nov): además del nombre y el producto, le muestra TODOS los datos que dejó en el checkout y el valor.

export interface ResultadoCarrito {
  ok?: boolean; status: number; error?: string; bloqueado?: boolean; plantilla?: string; wamid?: string;
}

/** ¿Bloqueado? 'chat abierto' si ya tiene chat; 'ya compró' si tiene un pedido (no cancelado/duplicado). */
export async function bloqueoCarrito(supabase: any, tel10: string, ignorarReserva = false): Promise<string | null> {
  // ignorarReserva: en la verificación FINAL (justo antes de enviar) la reserva del
  // número la acabamos de poner NOSOTROS; si se revisara, el envío se bloquearía a sí
  // mismo («ya enviada a este número») y NUNCA saldría ninguna plantilla. (07-nov-2026)
  if (!ignorarReserva) {
    const { data: env } = await supabase.from('carritos_envios').select('telefono').eq('telefono', tel10).maybeSingle();
    if (env) return 'ya enviada a este número';
  }
  const { data: conv } = await supabase.from('conversations').select('id').eq('id', `57${tel10}`).maybeSingle();
  if (conv) return 'chat abierto';
  const { data: ped } = await supabase.from('clientes_funnelish').select('id')
    .eq('telefono', tel10).not('estado', 'in', '("cancelado","duplicado")').limit(1);
  if (ped && ped.length) return 'ya compró';
  return null;
}

export async function enviarPlantillaCarrito(supabase: any, id: string, opts: { reintento?: boolean } = {}): Promise<ResultadoCarrito> {
  // En un REINTENTO (Meta no entregó la primera) el chat ya existe porque lo creó nuestra
  // propia plantilla: solo se frena si el cliente ya compró.
  const bloqueo = async (sb: any, t: string, ignorarReserva = false) => {
    if (!opts.reintento) return bloqueoCarrito(sb, t, ignorarReserva);
    const { data: ped } = await sb.from('clientes_funnelish').select('id')
      .eq('telefono', t).not('estado', 'in', '("cancelado","duplicado")').limit(1);
    return ped && ped.length ? 'ya compró' : null;
  };
  const { data: c } = await supabase.from('carritos_abandonados')
    .select('id, slug, nombre, telefono, producto, talla, valor, datos, recuperado, plantilla_enviada_at').eq('id', id).maybeSingle();
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
    // Solo es "ya enviada" si el teléfono REALMENTE ya está (llave duplicada, 23505).
    // Cualquier otro error (base saturada, tabla aún no visible para la API…) NO es un
    // duplicado: se deja como error para reintentar, en vez de marcarlo para siempre.
    // (06-nov: 3 carritos quedaron «duplicado» sin haber recibido nunca la plantilla.)
    const dup = (errTel as any).code === '23505';
    await supabase.from('carritos_abandonados')
      .update({ plantilla_enviada_at: null, plantilla_error: dup ? null : `No se pudo reservar el número: ${errTel.message}` }).eq('id', id);
    if (!dup) console.error('[Carrito] reserva del número falló:', errTel);
    return dup
      ? { error: 'ya enviada a este número', bloqueado: true, status: 409 }
      : { error: `No se pudo reservar el número: ${errTel.message}`, status: 503 };
  }
  const soltarTel = () => supabase.from('carritos_envios').delete().eq('telefono', tel10).eq('carrito_id', id);

  // 4) Última verificación justo antes de enviar (por si compró o escribió en este instante)
  const b2 = await bloqueo(supabase, tel10, true);
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
  // v3: {{3}} = todos los datos que dejó en el checkout (en una línea: Meta no acepta
  // saltos de línea dentro de una variable) y {{4}} = el valor.
  const d: Record<string, any> = ((c as any).datos && typeof (c as any).datos === 'object') ? (c as any).datos : {};
  const campo = (...ks: string[]) => limpio(ks.map(k => d[k]).find(v => typeof v === 'string' && v.trim()) ?? '');
  const nombreCompleto = limpio([campo('nombre') || limpio((c as any).nombre), campo('apellidos')].filter(Boolean).join(' '));
  const dir = [campo('direccion'), campo('barrio') ? `Barrio ${campo('barrio').replace(/^barrio\s+/i, '')}` : ''].filter(Boolean).join(', ');
  const datosLinea = [
    nombreCompleto && `👤 ${nombreCompleto}`,
    `📱 ${tel10}`,
    campo('correo') && `✉️ ${campo('correo')}`,
    dir && `📍 ${dir}`,
    (campo('municipio', 'ciudad') || campo('departamento')) && `🌆 ${[campo('municipio', 'ciudad'), campo('departamento')].filter(Boolean).join(', ')}`,
  ].filter(Boolean).join(' · ').slice(0, 900) || `📱 ${tel10}`;
  const valorNum = Number(String((c as any).valor ?? '').replace(/[^\d]/g, '')) || 0;
  const valorTxt = valorNum ? `$${valorNum.toLocaleString('es-CO')}` : 'el de tu pedido';
  const variables = (tpl.variables >= 4 ? [nombre, producto, datosLinea, valorTxt] : [nombre, producto]).slice(0, tpl.variables);
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
      bot_enabled: false,
    }, { onConflict: 'id', ignoreDuplicates: true });
    // El chat de un carrito abandonado lo atiende un HUMANO: bot apagado también
    // si el chat ya existía (07-nov-2026, decisión del dueño).
    await supabase.from('conversations').update({ bot_enabled: false }).eq('id', `57${tel10}`);
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

/**
 * REINTENTO ÚNICO a los carritos cuya plantilla Meta NO entregó por el límite por
 * persona (error 131049): pasadas 48 h se intenta UNA vez más, solo si el cliente no
 * ha escrito ni comprado. Se marca reintento_at para no repetir nunca.
 */
export async function reintentarCarritosBloqueados(supabase: any, max = 1): Promise<number> {
  const { wamidsBloqueados, clienteEscribio, esperarTurno } = await import('@/lib/ritmo-marketing');
  const wamids = await wamidsBloqueados(supabase, 'tpl-carrito-');
  if (!wamids.length) return 0;
  const { data: cs } = await supabase.from('carritos_abandonados')
    .select('id, telefono, plantilla_enviada_at').in('plantilla_wamid', wamids)
    .is('reintento_at', null).eq('recuperado', false).limit(10);
  let enviados = 0;
  for (const c of cs ?? []) {
    if (enviados >= max) break;
    const tel10 = String(c.telefono ?? '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
    // Reserva atómica del reintento (nunca se reintenta dos veces)
    const { data: tomado } = await supabase.from('carritos_abandonados')
      .update({ reintento_at: new Date().toISOString() }).eq('id', c.id).is('reintento_at', null).select('id');
    if (!tomado?.length) continue;
    if (await clienteEscribio(supabase, `57${tel10}`, c.plantilla_enviada_at ?? new Date(0).toISOString())) continue;
    await supabase.from('carritos_abandonados').update({ plantilla_enviada_at: null }).eq('id', c.id);
    await supabase.from('carritos_envios').delete().eq('telefono', tel10);
    const r = await enviarPlantillaCarrito(supabase, c.id, { reintento: true });
    if (r.ok) { enviados++; await esperarTurno(); }
  }
  return enviados;
}

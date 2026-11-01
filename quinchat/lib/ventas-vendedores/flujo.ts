import { sendTextMessage, sendImageByUrl, descargarWhatsAppMedia } from '@/lib/whatsapp';
import { vendedorDe } from '@/lib/vendedores';
import { transcribirAudio } from '@/lib/transcribir';
import { sinTildes } from './catalogo';
import { ESTADOS_ABIERTOS, type EstadoVV } from './estados';
import {
  interpretarVenta, describirFoto, buscarCandidatos, elegirConFoto, resolverVariante,
  nombreGenero, type PrendaTexto, type Candidato,
} from './ia';

/**
 * Recepción de ventas que mandan los VENDEDORES por WhatsApp (módulo de prueba).
 *
 * Solo entra aquí quien habilita config.moduloAtiende(). Devuelve false cuando el
 * mensaje NO es una venta (p. ej. el vendedor responde su número de ventas del
 * check-in): en ese caso el webhook sigue con el flujo de siempre.
 */

const money = (n: number | null | undefined) => (n ? `$${Number(n).toLocaleString('es-CO')}` : '—');
const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));
const NUMS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

function codigoNuevo(): string {
  const d = new Date(Date.now() - 5 * 3600_000).toISOString(); // hora Colombia
  return `PV-${d.slice(0, 10).replace(/-/g, '')}-${d.slice(11, 19).replace(/:/g, '')}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

/** ¿El texto trae datos de una venta? (si no, puede ser el reporte del check-in). */
function pareceVenta(t: string): boolean {
  const s = sinTildes(t);
  if (!s) return false;
  if (/^\s*(llevo|voy en|van|tengo)?\s*\d{1,3}\s*(ventas?)?\s*(hoy|hasta ahora|ayer)?\s*[.!]*\s*$/.test(s)) return false;
  return /(^|\D)3\d{9}(\D|$)/.test(s.replace(/[\s.-]/g, ''))
    || /\b(calle|cl|cra|carrera|kr|diagonal|transversal|avenida|av|barrio|manzana|mz|apto|torre|conjunto)\b/.test(s)
    || /\b(talla|buzo|chaqueta|cuello alto|camiseta|polo|venta para|cliente|direccion|ciudad|nueva venta)\b/.test(s)
    || s.length > 80;
}

interface Entrante { id: string; texto: string; mediaId: string | null; mime: string; tipo: string }

function leerEntrantes(value: any): Entrante[] {
  return (value?.messages ?? []).map((m: any) => ({
    id: String(m.id),
    tipo: String(m.type),
    texto: String(m.text?.body ?? m.image?.caption ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '').trim(),
    mediaId: m.image?.id ?? m.audio?.id ?? m.voice?.id ?? null,
    mime: m.image?.mime_type ?? m.audio?.mime_type ?? '',
  }));
}

export async function atenderModuloVV(supabase: any, value: any, from: string, esPrueba: boolean): Promise<boolean> {
  const entrantes = leerEntrantes(value);
  if (!entrantes.length) return false;
  const textoLote = entrantes.map(e => e.texto).filter(Boolean).join('\n');
  const hayFoto = entrantes.some(e => e.tipo === 'image' && e.mediaId);

  // ¿Hay una venta abierta de este vendedor?
  const { data: abierta } = await supabase.from('vv_ventas').select('*')
    .eq('vendedor_tel', from).in('estado', ESTADOS_ABIERTOS)
    .order('creado_at', { ascending: false }).limit(1).maybeSingle();

  const esNumeroSuelto = /^\s*\d{1,2}\s*$/.test(textoLote);
  // Un vendedor del equipo (aunque esté como número de prueba) sigue reportando su número de ventas.
  const soloPrueba = esPrueba && !vendedorDe(from);
  if (!abierta && !soloPrueba && !hayFoto && !pareceVenta(textoLote)) return false; // reporte del check-in → flujo de siempre
  if (esNumeroSuelto && !hayFoto && !soloPrueba && (!abierta || abierta.estado !== 'ambigua')) return false; // "5" = reporte de ventas

  const vend = vendedorDe(from);
  const ahoraISO = () => new Date().toISOString();

  const responder = async (texto: string) => {
    const wamid = await sendTextMessage(from, texto);
    try {
      await supabase.from('messages').insert({
        id: `vvq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, conversation_id: from,
        content: texto, role: 'assistant', type: 'text', whatsapp_id: wamid, created_at: ahoraISO(),
      });
    } catch { /* ignorar */ }
  };
  const enviarFoto = async (url: string, caption: string) => {
    const wamid = await sendImageByUrl(from, url, caption);
    try {
      await supabase.from('messages').insert({
        id: `vvq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, conversation_id: from,
        content: url, role: 'assistant', type: 'image', whatsapp_id: wamid, created_at: ahoraISO(),
      });
    } catch { /* ignorar */ }
  };

  // ── 1) Guardar los mensajes (deduplicando reenvíos de Meta) y las fotos ────────
  const nuevos: { texto: string; foto: string | null; fotoB64: { base64: string; mimeType: string } | null }[] = [];
  for (const e of entrantes) {
    let foto: string | null = null;
    let fotoB64: { base64: string; mimeType: string } | null = null;
    let texto = e.texto;
    if (e.mediaId && (e.tipo === 'image' || e.tipo === 'audio' || e.tipo === 'voice')) {
      try {
        const media = await descargarWhatsAppMedia(e.mediaId);
        if (media && e.tipo === 'image') {
          const mime = (media.mimeType || 'image/jpeg').split(';')[0];
          const ext = (mime.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
          const ruta = `ventas-vendedores/${from}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
          const { error } = await supabase.storage.from('chat-media').upload(ruta, media.buffer, { contentType: mime, upsert: false });
          if (!error) foto = supabase.storage.from('chat-media').getPublicUrl(ruta)?.data?.publicUrl ?? null;
          fotoB64 = { base64: media.buffer.toString('base64'), mimeType: mime };
        } else if (media) {
          texto = [(await transcribirAudio(media.buffer, media.mimeType)) ?? '', texto].filter(Boolean).join(' ');
        }
      } catch (err) { console.error('[VV] media:', err); }
    }
    const { error: dup } = await supabase.from('messages').insert({
      id: `vv-${e.id}`, conversation_id: from,
      content: foto ?? (texto || `[${e.tipo}]`), role: 'user', type: foto ? 'image' : 'text',
      whatsapp_id: e.id, created_at: ahoraISO(),
    });
    if (dup) continue; // Meta reenvió el mismo mensaje: ya se procesó
    if (foto && texto) {
      try { await supabase.from('messages').insert({ id: `vv-${e.id}-cap`, conversation_id: from, content: texto, role: 'user', type: 'text', whatsapp_id: e.id, created_at: ahoraISO() }); } catch { /* */ }
    }
    nuevos.push({ texto, foto, fotoB64 });
  }
  if (!nuevos.length) return true;

  try {
    const upd: any = { id: from, last_message: (textoLote || '📷 Foto').slice(0, 100), last_message_time: ahoraISO() };
    if (vend) Object.assign(upd, { contact_name: vend.nombre, label: 'VENDEDOR', linea: 'ventas' });
    await supabase.from('conversations').upsert(upd, { onConflict: 'id' });
  } catch { /* ignorar */ }

  // ── 2) Abrir o tomar la venta (una sola por vendedor gracias al índice único) ─
  let venta = abierta;
  if (!venta) {
    const { data: creada, error } = await supabase.from('vv_ventas').insert({
      codigo: codigoNuevo(), vendedor_tel: from, vendedor_nombre: vend?.nombre ?? (esPrueba ? 'Prueba' : null),
      estado: 'recibida', conversacion_id: from, es_prueba: esPrueba,
    }).select('*').single();
    if (error) {
      // Otra llamada del webhook la acaba de crear: se usa esa
      const { data: otra } = await supabase.from('vv_ventas').select('*').eq('vendedor_tel', from).in('estado', ESTADOS_ABIERTOS).limit(1).maybeSingle();
      venta = otra;
    } else {
      venta = creada;
      await supabase.from('vv_eventos').insert({ venta_id: venta.id, tipo: 'creada', quien: 'whatsapp', detalle: { vendedor: from } });
    }
  }
  if (!venta) return true;

  // Fotos y su descripción (para buscar el producto)
  for (const n of nuevos.filter(x => x.foto && x.fotoB64)) {
    const desc = await describirFoto(n.fotoB64!.base64, n.fotoB64!.mimeType);
    await supabase.from('vv_eventos').insert({ venta_id: venta.id, tipo: 'foto', quien: 'whatsapp', detalle: { url: n.foto, descripcion: desc } });
  }
  const fotosNuevas = nuevos.map(n => n.foto).filter(Boolean) as string[];
  if (fotosNuevas.length) {
    venta.fotos_vendedor = [...(venta.fotos_vendedor ?? []), ...fotosNuevas];
    await supabase.from('vv_ventas').update({ fotos_vendedor: venta.fotos_vendedor, actualizado_at: ahoraISO() }).eq('id', venta.id);
  }

  // ── 3) Esperar unos segundos por si el vendedor sigue mandando mensajes ────────
  const marca = Date.now();
  await dormir(7000);
  const { data: ultimo } = await supabase.from('messages').select('created_at, id')
    .eq('conversation_id', from).eq('role', 'user').like('id', 'vv-%')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (ultimo && new Date(ultimo.created_at).getTime() > marca) return true; // otra llamada más nueva responde

  // Releer la venta (otra llamada pudo cambiarla)
  const { data: fresca } = await supabase.from('vv_ventas').select('*').eq('id', venta.id).single();
  venta = fresca ?? venta;
  const textoNuevo = nuevos.map(n => n.texto).filter(Boolean).join('\n').trim();

  // ── 4) Comandos ────────────────────────────────────────────────────────────
  if (/^\s*(cancelar|cancela|anular|anula)\b/i.test(textoNuevo)) {
    await supabase.from('vv_ventas').update({ estado: 'cancelada', actualizado_at: ahoraISO() }).eq('id', venta.id);
    await supabase.from('vv_eventos').insert({ venta_id: venta.id, tipo: 'cancelada', quien: 'vendedor', detalle: { texto: textoNuevo } });
    await responder(`❌ Listo, cancelé la venta *${venta.codigo}*${venta.cliente_nombre ? ` de ${venta.cliente_nombre}` : ''}. Cuando quieras me mandas la siguiente.`);
    return true;
  }
  const soloConfirma = /^\s*(confirmo|confirmar|confirmado|si|sí|ok|okey|listo|correcto|todo bien|dale)[\s.!👍✅]*$/i.test(textoNuevo) && !fotosNuevas.length;
  if (venta.estado === 'esperando_confirmacion' && soloConfirma) {
    await supabase.from('vv_ventas').update({ estado: 'confirmada', confirmado_at: ahoraISO(), actualizado_at: ahoraISO() }).eq('id', venta.id);
    await supabase.from('vv_eventos').insert({ venta_id: venta.id, tipo: 'confirmada', quien: 'vendedor', detalle: { texto: textoNuevo } });
    await responder(`✅ *Venta ${venta.codigo} registrada.*\nQueda en la cola de preventas para revisión y subida a Effi. Te aviso si falta algo. ¡Gracias${vend ? `, ${vend.nombre.split(' ')[0]}` : ''}! 🙌`);
    return true;
  }

  // Respuesta con número a una lista de opciones
  if (venta.estado === 'ambigua' && /^\s*[1-6]\s*$/.test(textoNuevo)) {
    const { data: amb } = await supabase.from('vv_items').select('*').eq('venta_id', venta.id).eq('estado', 'ambiguo').order('id').limit(1).maybeSingle();
    const cands: Candidato[] = amb?.candidatos?.opciones ?? [];
    const elegido = cands[Number(textoNuevo.trim()) - 1];
    if (amb && elegido) {
      await aplicarProducto(supabase, amb, elegido, amb.candidatos?.solicitud ?? {}, 1, 'elegido por el vendedor');
      await supabase.from('vv_eventos').insert({ venta_id: venta.id, tipo: 'producto_elegido', quien: 'vendedor', detalle: { id_item: elegido.id_item, opcion: textoNuevo.trim() } });
    }
    await evaluarYResponder(supabase, venta.id, responder, enviarFoto);
    return true;
  }

  // ── 5) Interpretar TODO lo que el vendedor ha escrito en esta venta ────────────
  const { data: msgs } = await supabase.from('messages').select('content, type, created_at')
    .eq('conversation_id', from).eq('role', 'user').like('id', 'vv-%').eq('type', 'text')
    .gte('created_at', venta.creado_at).order('created_at', { ascending: true }).limit(60);
  const textos = (msgs ?? []).map((m: any) => String(m.content ?? '')).filter((t: string) => t && !t.startsWith('[') && !/^\s*[1-6]\s*$/.test(t));
  const { data: evFotos } = await supabase.from('vv_eventos').select('detalle').eq('venta_id', venta.id).eq('tipo', 'foto').order('creado_at');
  const descFotos = (evFotos ?? []).map((e: any) => String(e.detalle?.descripcion ?? '')).filter(Boolean);

  const v = await interpretarVenta(textos, descFotos);
  if (!v) {
    await responder('⚠️ No alcancé a organizar la venta. Mándame de nuevo los datos del cliente y la prenda, por favor.');
    return true;
  }

  const campos: any = { actualizado_at: ahoraISO() };
  for (const k of ['cliente_nombre', 'cliente_celular', 'cliente_identificacion', 'departamento', 'municipio', 'direccion', 'barrio', 'complemento', 'referencia_dir', 'tipo_pago', 'observaciones'] as const) {
    if (v[k]) campos[k] = v[k];
  }
  if (v.total) campos.total = v.total;
  if (v.abono) campos.abono = v.abono;
  await supabase.from('vv_ventas').update(campos).eq('id', venta.id);

  // ── 6) Prendas: conservar las ya resueltas si no cambió lo pedido ─────────────
  const { data: itemsPrevios } = await supabase.from('vv_items').select('*').eq('venta_id', venta.id).order('id');
  const previos = itemsPrevios ?? [];
  const fotos: string[] = venta.fotos_vendedor ?? [];
  const totalPrendas = v.prendas.reduce((s, p) => s + p.cantidad, 0) || 1;
  for (let i = 0; i < v.prendas.length; i++) {
    const p = v.prendas[i];
    const sol = { descripcion: p.descripcion, color: p.color, talla: p.talla, genero: p.genero };
    const prev = previos[i];
    const precio = p.precio ?? (v.total && v.prendas.length === 1 ? Math.round(v.total / p.cantidad) : (v.total ? Math.round(v.total / totalPrendas) : null));
    if (prev && JSON.stringify(prev.candidatos?.solicitud ?? {}) === JSON.stringify(sol) && prev.estado !== 'sin_identificar') {
      await supabase.from('vv_items').update({ cantidad: p.cantidad, precio }).eq('id', prev.id);
      continue;
    }
    const fotoUrl = fotos[i] ?? (v.prendas.length === 1 ? fotos[fotos.length - 1] : null) ?? null;
    const descFoto = fotoUrl ? (evFotos ?? []).find((e: any) => e.detalle?.url === fotoUrl)?.detalle?.descripcion ?? '' : '';
    const base = { venta_id: venta.id, cantidad: p.cantidad, precio, foto_vendedor: fotoUrl, descripcion: p.descripcion };
    let item = prev;
    if (item) await supabase.from('vv_items').update({ ...base, estado: 'pendiente', candidatos: { solicitud: sol } }).eq('id', item.id);
    else item = (await supabase.from('vv_items').insert({ ...base, estado: 'pendiente', candidatos: { solicitud: sol } }).select('*').single()).data;
    if (!item) continue;
    await reconocer(supabase, item, sol, `${p.descripcion} ${descFoto}`, fotoUrl);
  }
  // Prendas que el vendedor quitó
  const sobran = previos.slice(v.prendas.length).map((x: any) => x.id);
  if (sobran.length) await supabase.from('vv_items').delete().in('id', sobran);

  await evaluarYResponder(supabase, venta.id, responder, enviarFoto);
  return true;
}

/** Busca el producto y la variante de una prenda. */
async function reconocer(supabase: any, item: any, sol: Pick<PrendaTexto, 'descripcion' | 'color' | 'talla' | 'genero'>, textoBusqueda: string, fotoUrl: string | null) {
  const cands = await buscarCandidatos(`${textoBusqueda} ${sol.color}`, sol.color, sol.genero, 6);
  if (!cands.length) {
    await supabase.from('vv_items').update({ estado: 'sin_identificar', candidatos: { solicitud: sol, opciones: [] } }).eq('id', item.id);
    return;
  }
  let elegido: Candidato | null = null;
  let confianza = 0;
  let motivo = '';
  if (fotoUrl) {
    const { bajarComoBase64 } = await import('./ia');
    const f = await bajarComoBase64(fotoUrl);
    if (f) {
      const r = await elegirConFoto(f, cands, `${sol.descripcion} ${sol.color} ${sol.talla}`);
      if (r && r.indice >= 0 && r.confianza >= 0.75) { elegido = cands[r.indice]; confianza = r.confianza; motivo = r.motivo; }
    }
  } else if (cands.length === 1 || cands[0].puntaje >= cands[1].puntaje + 6) {
    elegido = cands[0]; confianza = 0.6; motivo = 'coincidencia por texto';
  }
  if (!elegido) {
    await supabase.from('vv_items').update({ estado: 'ambiguo', candidatos: { solicitud: sol, opciones: cands.slice(0, 4) } }).eq('id', item.id);
    return;
  }
  await aplicarProducto(supabase, item, elegido, sol, confianza, motivo);
}

async function aplicarProducto(supabase: any, item: any, c: Candidato, sol: any, confianza: number, motivo: string) {
  const color = sol.color || (c.colores?.length === 1 ? c.colores[0] : '');
  const r = await resolverVariante(c.id_item, color, sol.talla ?? '');
  await supabase.from('vv_items').update({
    id_item: c.id_item, id_catalogo: c.id_catalogo, catalogo: c.catalogo, nombre: c.catalogo,
    referencia: c.referencia, tipo: c.tipo, genero: nombreGenero(c.genero_id),
    foto_oficial: c.foto_card || c.foto_main, confianza,
    id_variante: r.variante?.id ?? null, sku: r.variante?.sku ?? null,
    color: r.variante?.color ?? (color || null), talla: r.variante?.talla ?? (sol.talla || null),
    estado: r.variante ? 'ok' : 'sin_variante',
    candidatos: { solicitud: sol, motivo, problema: r.problema, colores: r.colores, tallas: r.tallas },
  }).eq('id', item.id);
}

/** Revisa qué falta y le responde al vendedor (solo lo pendiente, o el resumen para confirmar). */
async function evaluarYResponder(
  supabase: any, ventaId: string,
  responder: (t: string) => Promise<void>, enviarFoto: (u: string, c: string) => Promise<void>,
) {
  const { data: venta } = await supabase.from('vv_ventas').select('*').eq('id', ventaId).single();
  const { data: items } = await supabase.from('vv_items').select('*').eq('venta_id', ventaId).order('id');
  const its = items ?? [];

  // Producto dudoso → mostrar opciones con foto
  const amb = its.find((i: any) => i.estado === 'ambiguo');
  if (amb) {
    const ops: Candidato[] = amb.candidatos?.opciones ?? [];
    await supabase.from('vv_ventas').update({ estado: 'ambigua', faltantes: ['producto'], actualizado_at: new Date().toISOString() }).eq('id', ventaId);
    await responder(`🔎 Encontré varios diseños parecidos para *${amb.descripcion || 'la prenda'}*. ¿Cuál es? Respóndeme solo con el número:`);
    for (let k = 0; k < ops.length; k++) {
      const o = ops[k];
      const foto = o.foto_card || o.foto_main;
      const cap = `${NUMS[k]} ${o.catalogo}${o.colores?.length ? ` · ${o.colores.join('/')}` : ''}`;
      if (foto) await enviarFoto(foto, cap); else await responder(cap);
    }
    return;
  }

  const falta: string[] = [];
  if (!venta.cliente_nombre) falta.push('nombre completo del cliente');
  if (!/^3\d{9}$/.test(String(venta.cliente_celular ?? ''))) falta.push('celular del cliente (10 dígitos)');
  if (!venta.municipio) falta.push('ciudad o municipio');
  if (!venta.departamento) falta.push('departamento');
  if (!venta.direccion) falta.push('dirección');
  if (!venta.barrio) falta.push('barrio');
  if (!its.length) falta.push('qué prenda es (foto o nombre del diseño)');
  for (const it of its) {
    if (it.estado === 'sin_identificar') falta.push(`no encontré *${it.descripcion || 'la prenda'}* en el catálogo: mándame la foto o el nombre exacto del diseño`);
    if (it.estado === 'sin_variante') {
      const c = it.candidatos ?? {};
      if (c.problema === 'color') falta.push(`color de *${it.catalogo}* (hay: ${(c.colores ?? []).join(', ')})`);
      else falta.push(`talla de *${it.catalogo}*${c.tallas?.length ? ` (hay: ${c.tallas.join(', ')})` : ''}`);
    }
  }
  if (!venta.total) falta.push('valor total a cobrar');

  if (falta.length) {
    await supabase.from('vv_ventas').update({ estado: 'incompleta', faltantes: falta, actualizado_at: new Date().toISOString() }).eq('id', ventaId);
    await responder(
      `📋 Voy armando la venta${venta.cliente_nombre ? ` de *${venta.cliente_nombre}*` : ''} (${venta.codigo}).\n` +
      `Me falta:\n${falta.map(f => `• ${f}`).join('\n')}\n\n_Escríbeme solo eso; lo demás ya lo tengo._`);
    return;
  }

  await supabase.from('vv_ventas').update({ estado: 'esperando_confirmacion' as EstadoVV, faltantes: [], actualizado_at: new Date().toISOString() }).eq('id', ventaId);
  const lineasProd = its.map((it: any) =>
    `*${it.catalogo}*\nRef: ${it.referencia ?? '—'} · ${it.genero || 'Hombre'}\nTalla: ${it.talla} · Color: ${it.color}\nCantidad: ${it.cantidad}${it.precio ? ` · ${money(it.precio)} c/u` : ''}\nSKU: ${it.sku ?? '—'} · Variante: ${it.id_variante}`,
  ).join('\n\n');
  const resumen =
    `✅ *VENTA ORGANIZADA* (${venta.codigo})\n\n` +
    `*CLIENTE*\nNombre: ${venta.cliente_nombre}\nCelular: ${venta.cliente_celular}\n` +
    (venta.cliente_identificacion ? `Identificación: ${venta.cliente_identificacion}\n` : '') +
    `Ciudad: ${venta.municipio} (${venta.departamento})\nBarrio: ${venta.barrio}\nDirección: ${venta.direccion}` +
    (venta.complemento ? `, ${venta.complemento}` : '') + (venta.referencia_dir ? `\nIndicaciones: ${venta.referencia_dir}` : '') +
    `\n\n*PRENDAS*\n${lineasProd}\n\n*TOTAL: ${money(venta.total)}* — ${venta.tipo_pago === 'contraentrega' ? 'pago contra entrega' : venta.tipo_pago}` +
    (venta.abono ? `\nAbono: ${money(venta.abono)}` : '') +
    `\n\n¿Todo correcto? Responde *CONFIRMO*.\nSi algo está mal, escríbeme la corrección. Para anularla: *CANCELAR*.`;
  const foto = its.find((i: any) => i.foto_oficial)?.foto_oficial;
  if (foto && resumen.length <= 1000) await enviarFoto(foto, resumen);
  else {
    if (foto) await enviarFoto(foto, its[0]?.catalogo ?? '');
    await responder(resumen);
  }
}

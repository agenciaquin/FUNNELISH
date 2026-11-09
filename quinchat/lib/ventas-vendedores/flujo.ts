import { sendTextMessage, sendImageByUrl, descargarWhatsAppMedia, mostrarEscribiendo } from '@/lib/whatsapp';
import { recortar } from '@/lib/recortar';
import { vendedorDe } from '@/lib/vendedores';
import { transcribirAudio } from '@/lib/transcribir';
import { sinTildes } from './catalogo';
import { enviarBotones } from './wa';
import { tipoLineaActual } from '@/lib/whatsapp-contexto';
import { esOficinaInter, normalizarOficinaInter } from './desde-chat';
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
/** Correo que se usa cuando el vendedor no manda uno (igual que en Klixmsoft). */
export const CORREO_DEFECTO = 'gerencia@klixmant.com';
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

/** ¿El vendedor tiene una venta del módulo a medias? (se termina en el número donde empezó) */
export async function tieneVentaAbiertaVV(supabase: any, from: string): Promise<boolean> {
  const { data } = await supabase.from('vv_ventas').select('id')
    .eq('vendedor_tel', from).in('estado', ESTADOS_ABIERTOS).limit(1).maybeSingle();
  return !!data;
}

/** Crea el chat del vendedor si no existe (no toca uno existente). */
export async function asegurarChatVendedor(supabase: any, from: string): Promise<void> {
  try {
    const v = vendedorDe(from);
    await supabase.from('conversations').upsert({
      id: from, contact_name: v?.nombre ?? from, label: 'VENDEDOR', linea: tipoLineaActual(),
      last_message: '', last_message_time: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: true });
  } catch { /* ignorar */ }
}

export async function atenderModuloVV(supabase: any, value: any, from: string, esPrueba: boolean): Promise<boolean> {
  const entrantes = leerEntrantes(value);
  if (!entrantes.length) return false;
  const textoLote = entrantes.map(e => e.texto).filter(Boolean).join('\n');
  const hayFoto = entrantes.some(e => e.tipo === 'image' && e.mediaId);

  // El chat DEBE existir antes de guardar mensajes (messages → conversations tiene llave foránea). Si alguien
  // borró el chat desde el panel, los mensajes fallaban en silencio y el vendedor no recibía respuesta (08-nov-2026).
  await asegurarChatVendedor(supabase, from);

  // ¿Hay una venta abierta de este vendedor?
  const { data: abierta } = await supabase.from('vv_ventas').select('*')
    .eq('vendedor_tel', from).in('estado', ESTADOS_ABIERTOS)
    .order('creado_at', { ascending: false }).limit(1).maybeSingle();

  const esNumeroSuelto = /^\s*\d{1,2}\s*$/.test(textoLote);
  // Un vendedor del equipo (aunque esté como número de prueba) sigue reportando su número de ventas.
  const soloPrueba = esPrueba && !vendedorDe(from);
  // Un saludo («Hola») también lo contesta el módulo: «mándame la venta directo» (antes caía al supervisor de reportes)
  const esSaludoLote = /^\s*(hola|holi|buenas|buenos dias|buenos días|buenas tardes|buenas noches|hey|ey|quino|hola quino|buen dia|buen día)[\s.!,👋🙌😊]*$/i.test(textoLote);
  if (esNumeroSuelto && !hayFoto && !soloPrueba && (!abierta || abierta.estado !== 'ambigua')) return false; // "5" = reporte de ventas
  // Mensaje suelto que no es venta («Hola pana», «???»): NO se deja al vendedor sin respuesta. Se guarda y se le
  // recuerda cómo mandar la venta (máx. 1 vez cada 10 min para no llenarle el chat).
  if (!abierta && !soloPrueba && !hayFoto && !pareceVenta(textoLote) && !esSaludoLote) {
    const ahora = new Date();
    try {
      await supabase.from('messages').insert(entrantes.map(e => ({
        id: `vv-${e.id}`, conversation_id: from, content: e.texto || `[${e.tipo}]`, role: 'user', type: 'text', whatsapp_id: e.id, created_at: ahora.toISOString(),
      })));
    } catch { /* duplicado de Meta */ }
    const { data: reciente } = await supabase.from('messages').select('id').eq('conversation_id', from)
      .like('id', 'vvayuda-%').gte('created_at', new Date(ahora.getTime() - 10 * 60_000).toISOString()).limit(1).maybeSingle();
    if (!reciente) {
      const v = vendedorDe(from);
      const texto = `👋 ${v ? `${v.nombre.split(' ')[0]}, ` : ''}por aquí recibo tus *ventas*. Mándame la venta directo: *foto de la prenda* + datos del cliente (nombre, celular, dirección, ciudad, talla y valor) y la organizo para subirla a Effi.`;
      const wamid = await sendTextMessage(from, texto);
      try {
        await supabase.from('messages').insert({ id: `vvayuda-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, conversation_id: from, content: texto, role: 'assistant', type: 'text', whatsapp_id: wamid, created_at: ahora.toISOString() });
      } catch { /* ignorar */ }
    }
    return true;
  }

  const vend = vendedorDe(from);
  const ahoraISO = () => new Date().toISOString();
  // Visto + "escribiendo…" al instante, para que el vendedor sepa que ya se está procesando
  mostrarEscribiendo(entrantes[entrantes.length - 1].id).catch(() => {});

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

  // Saludo suelto sin venta abierta: no se abre venta; se le dice que mande la venta directo
  const esSaludo = /^\s*(hola|holi|buenas|buenos dias|buenos días|buenas tardes|buenas noches|hey|ey|quino|hola quino|buen dia|buen día)[\s.!,👋🙌😊]*$/i.test(textoLote);
  if (!abierta && !hayFoto && esSaludo) {
    try {
      await supabase.from('messages').insert(entrantes.map(e => ({
        id: `vv-${e.id}`, conversation_id: from, content: e.texto || `[${e.tipo}]`, role: 'user', type: 'text', whatsapp_id: e.id, created_at: ahoraISO(),
      })));
    } catch { /* duplicado de Meta */ }
    await responder(`👋 ¡Hola${vend ? ` ${vend.nombre.split(' ')[0]}` : ''}! Estoy listo. Mándame la venta *directo* (foto de la prenda + datos del cliente) y la organizo de una. No hace falta saludar 😉`);
    return true;
  }

  // ── 1) Guardar los mensajes (deduplicando reenvíos de Meta) y las fotos ────────
  const inicioLote = new Date(Date.now() - 1000).toISOString(); // los mensajes de este lote se guardan ANTES de crear la venta
  const nuevos: { texto: string; foto: string | null; fotoB64: { base64: string; mimeType: string } | null; descPromesa: Promise<string> | null }[] = [];
  for (const e of entrantes) {
    let foto: string | null = null;
    let fotoB64: { base64: string; mimeType: string } | null = null;
    let descPromesa: Promise<string> | null = null;
    let texto = e.texto;
    if (e.mediaId && (e.tipo === 'image' || e.tipo === 'audio' || e.tipo === 'voice')) {
      try {
        const media = await descargarWhatsAppMedia(e.mediaId);
        if (media && e.tipo === 'image') {
          const mime = (media.mimeType || 'image/jpeg').split(';')[0];
          const ext = (mime.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
          const ruta = `ventas-vendedores/${from}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
          fotoB64 = { base64: media.buffer.toString('base64'), mimeType: mime };
          descPromesa = describirFoto(fotoB64.base64, mime);           // arranca ya, en paralelo
          const { error } = await supabase.storage.from('chat-media').upload(ruta, media.buffer, { contentType: mime, upsert: false });
          if (!error) foto = supabase.storage.from('chat-media').getPublicUrl(ruta)?.data?.publicUrl ?? null;
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
    nuevos.push({ texto, foto, fotoB64, descPromesa });
  }
  if (!nuevos.length) return true;

  try {
    const upd: any = { id: from, last_message: recortar((textoLote || '📷 Foto'), 100), last_message_time: ahoraISO() };
    // El chat queda en la bandeja del número por el que escribió (Funnel = recepción de ventas del módulo)
    if (vend) Object.assign(upd, { contact_name: vend.nombre, label: 'VENDEDOR', linea: tipoLineaActual() });
    await supabase.from('conversations').upsert(upd, { onConflict: 'id' });
  } catch { /* ignorar */ }

  // ── 2) Abrir o tomar la venta (una sola por vendedor gracias al índice único) ─
  let venta = abierta;
  if (!venta) {
    const { data: creada, error } = await supabase.from('vv_ventas').insert({
      codigo: codigoNuevo(), vendedor_tel: from, vendedor_nombre: vend?.nombre ?? (esPrueba ? 'Prueba' : null),
      estado: 'recibida', conversacion_id: from, es_prueba: esPrueba,
      creado_at: inicioLote, // así los mensajes que abrieron la venta quedan DENTRO de ella
    }).select('*').single();
    if (error) {
      console.error('[VV] no se pudo crear la venta:', error.message);
      // Otra llamada del webhook la acaba de crear: se usa esa
      const { data: otra } = await supabase.from('vv_ventas').select('*').eq('vendedor_tel', from).in('estado', ESTADOS_ABIERTOS).limit(1).maybeSingle();
      venta = otra;
    } else {
      venta = creada;
      await supabase.from('vv_eventos').insert({ venta_id: venta.id, tipo: 'creada', quien: 'whatsapp', detalle: { vendedor: from } });
    }
  }
  if (!venta) {
    await responder('⚠️ Recibí tu mensaje pero no pude abrir la venta en el sistema. Ya quedó el aviso para revisarlo.');
    return true;
  }

  const fotosNuevas = nuevos.map(n => n.foto).filter(Boolean) as string[];
  if (fotosNuevas.length) {
    venta.fotos_vendedor = [...(venta.fotos_vendedor ?? []), ...fotosNuevas];
    await supabase.from('vv_ventas').update({ fotos_vendedor: venta.fotos_vendedor, actualizado_at: ahoraISO() }).eq('id', venta.id);
  }
  const textoNuevo = nuevos.map(n => n.texto).filter(Boolean).join('\n').trim();

  // ── 3) ¿Esperar un poco? Solo si el mensaje parece "a medias". Si llega otro
  //       mensaje mientras tanto, responde la llamada más nueva y esta se calla.
  const esOrden = /^\s*(cancelar|cancela|anular|anula|confirmo|confirmar|confirmado|si|sí|ok|okey|listo|correcto|todo bien|dale|no|nop|[1-6])[\s.!👍✅]*$/i.test(textoNuevo);
  // Solo una foto SIN texto se considera "a medias" (casi siempre llegan los datos detrás). Lo demás responde de una.
  const aMedias = !esOrden && fotosNuevas.length > 0 && !textoNuevo;
  const miUltimo = Date.now();
  const hayMasNuevo = async () => {
    const { data: ultimo } = await supabase.from('messages').select('created_at')
      .eq('conversation_id', from).eq('role', 'user').like('id', 'vv-%')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return !!ultimo && new Date(ultimo.created_at).getTime() > miUltimo + 300;
  };
  if (aMedias) {
    await dormir(2500);
    if (await hayMasNuevo()) {
      // Se guarda la descripción de la foto para la llamada que sí responde
      for (const n of nuevos.filter(x => x.descPromesa)) {
        const desc = await n.descPromesa!;
        await supabase.from('vv_eventos').insert({ venta_id: venta.id, tipo: 'foto', quien: 'whatsapp', detalle: { url: n.foto, descripcion: desc } });
      }
      return true;
    }
  }

  // Releer la venta (otra llamada pudo cambiarla)
  const { data: fresca } = await supabase.from('vv_ventas').select('*').eq('id', venta.id).single();
  venta = fresca ?? venta;

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
    await responder(`✅ *Venta ${venta.codigo} registrada.*\nQueda en la cola de preventas para revisión y subida a Effi. ¡Gracias${vend ? `, ${vend.nombre.split(' ')[0]}` : ''}! 🙌\n\n📲 *Listo para la siguiente:* mándame la foto con los datos del cliente y la organizo de una, sin saludar.`);
    return true;
  }

  // "No" a la confirmación: se pide la corrección y la venta sigue abierta
  if (venta.estado === 'esperando_confirmacion' && /^\s*(no|nop|incorrecto|esta mal|está mal)[\s.!]*$/i.test(textoNuevo)) {
    await supabase.from('vv_eventos').insert({ venta_id: venta.id, tipo: 'rechazo_resumen', quien: 'vendedor', detalle: { texto: textoNuevo } });
    await responder('✏️ Listo. Escríbeme *solo el dato que hay que corregir* (por ejemplo: "talla XL" o "dirección Calle 2 # 3-51") y te mando el resumen de nuevo.');
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
    .gte('created_at', venta.creado_at < inicioLote ? venta.creado_at : inicioLote).order('created_at', { ascending: true }).limit(60);
  const textos = (msgs ?? []).map((m: any) => String(m.content ?? '')).filter((t: string) => t && !t.startsWith('[') && !/^\s*[1-6]\s*$/.test(t));
  const { data: evPrevios } = await supabase.from('vv_eventos').select('detalle').eq('venta_id', venta.id).eq('tipo', 'foto').order('creado_at');
  // Interpretar el texto y describir las fotos nuevas AL MISMO TIEMPO (ahorra varios segundos)
  const [v, descNuevas] = await Promise.all([
    interpretarVenta(textos, (evPrevios ?? []).map((e: any) => String(e.detalle?.descripcion ?? '')).filter(Boolean)),
    Promise.all(nuevos.filter(x => x.descPromesa).map(async n => ({ url: n.foto, descripcion: await n.descPromesa! }))),
  ]);
  if (descNuevas.length) {
    await supabase.from('vv_eventos').insert(descNuevas.map(d => ({ venta_id: venta.id, tipo: 'foto', quien: 'whatsapp', detalle: d })));
  }
  const evFotos = [...(evPrevios ?? []), ...descNuevas.map(d => ({ detalle: d }))];
  const sinDatos = !v || (!v.cliente_nombre && !v.cliente_celular && !v.direccion && !v.prendas.length);
  if (sinDatos) {
    await responder('📋 Mándame la venta con la *foto de la prenda* y los *datos del cliente* (nombre, celular, dirección, ciudad, talla y valor) y la organizo de una.');
    return true;
  }
  if (!v) return true;

  const campos: any = { actualizado_at: ahoraISO() };
  for (const k of ['cliente_nombre', 'cliente_celular', 'cliente_identificacion', 'cliente_correo', 'departamento', 'municipio', 'direccion', 'barrio', 'complemento', 'referencia_dir', 'tipo_pago', 'observaciones'] as const) {
    if (v[k]) campos[k] = v[k];
  }
  if (v.total) campos.total = v.total;
  if (v.abono) campos.abono = v.abono;
  // Reclama en OFICINA de Interrapidísimo → dirección estándar, sin barrio ni calle, transportadora INTER
  // (antes le pedía al vendedor «dirección» y «barrio» aunque dijera «reclama en oficina»).
  {
    const juntos = { direccion: venta.direccion, barrio: venta.barrio, complemento: venta.complemento, referencia_dir: venta.referencia_dir, observaciones: venta.observaciones, ...campos };
    const norm = normalizarOficinaInter(juntos);
    if (norm !== juntos) Object.assign(campos, { direccion: norm.direccion, barrio: '', complemento: '', referencia_dir: '', transportadora: norm.transportadora });
  }
  await supabase.from('vv_ventas').update(campos).eq('id', venta.id);

  // ── 6) Prendas: conservar las ya resueltas si no cambió lo pedido ─────────────
  const { data: itemsPrevios } = await supabase.from('vv_items').select('*').eq('venta_id', venta.id).order('id');
  const previos = itemsPrevios ?? [];
  const fotos: string[] = venta.fotos_vendedor ?? [];
  // Si mandó foto pero no escribió la prenda, la prenda sale de la foto
  if (!v.prendas.length && fotos.length) v.prendas = [{ descripcion: '', color: '', talla: '', genero: '', cantidad: 1, precio: null }];
  const totalPrendas = v.prendas.reduce((s, p) => s + p.cantidad, 0) || 1;
  /** "TITULO: X | TIPO: Y | MARCAS: Z | COLOR: W" → campos. */
  const campoFoto = (desc: string, campo: string) =>
    (new RegExp(`${campo}:\\s*([^|\\n]*)`, 'i').exec(desc)?.[1] ?? '').replace(/["“”<>]/g, '').trim();
  // Cada prenda con su foto. Una FOTO con VARIOS colores (collage «rojo + marfil») y una cantidad igual al número
  // de colores («los dos») se parte en una prenda por color (08-nov-2026: antes salían 2 del mismo color).
  type PrendaExp = { p: typeof v.prendas[number]; fotoUrl: string | null; descFoto: string; colorFijo: string | null };
  const prendasExp: PrendaExp[] = [];
  for (let k = 0; k < v.prendas.length; k++) {
    const p = v.prendas[k];
    // Prenda sin foto propia y sin nombre («Talla L / M … las dos») = la MISMA prenda de la última foto en otra talla
    const sinNombre = !String(p.descripcion ?? '').trim();
    const fotoUrl = fotos[k] ?? ((v.prendas.length === 1 || sinNombre) ? fotos[fotos.length - 1] : null) ?? null;
    const descFoto = fotoUrl ? (evFotos ?? []).find((e: any) => e.detalle?.url === fotoUrl)?.detalle?.descripcion ?? '' : '';
    const colores = (descFoto ? campoFoto(descFoto, 'COLOR') : '').split(/\s*(?:\/|,|\+|\by\b)\s*/i).map(c => c.trim()).filter(Boolean);
    if (colores.length > 1 && p.cantidad === colores.length) {
      for (const c of colores) prendasExp.push({ p: { ...p, cantidad: 1 }, fotoUrl, descFoto, colorFijo: c });
    } else prendasExp.push({ p, fotoUrl, descFoto, colorFijo: null });
  }
  for (let i = 0; i < prendasExp.length; i++) {
    const { p, fotoUrl, descFoto, colorFijo } = prendasExp[i];
    // ⚠️ REGLA ÚNICA: si hay FOTO, el producto y el color salen SOLO de la foto (su título y lo que se ve).
    // El nombre de producto que escribió el vendedor NO se usa para buscar. Del texto solo se toman talla, género, cantidad y precio.
    const conFoto = !!fotoUrl && !!descFoto;
    const tituloFoto = conFoto ? campoFoto(descFoto, 'TITULO') : '';
    const colorFoto = colorFijo ?? (conFoto ? campoFoto(descFoto, 'COLOR') : '');
    const sol = conFoto
      ? { descripcion: tituloFoto || campoFoto(descFoto, 'MARCAS') || 'Prenda de la foto', color: colorFoto, talla: p.talla, genero: p.genero }
      : { descripcion: p.descripcion, color: p.color, talla: p.talla, genero: p.genero };
    const prev = previos[i];
    const precio = p.precio ?? (v.total && prendasExp.length === 1 ? Math.round(v.total / p.cantidad) : (v.total ? Math.round(v.total / totalPrendas) : null));
    if (prev && JSON.stringify(prev.candidatos?.solicitud ?? {}) === JSON.stringify(sol) && prev.estado !== 'sin_identificar') {
      await supabase.from('vv_items').update({ cantidad: p.cantidad, precio }).eq('id', prev.id);
      continue;
    }
    const base = { venta_id: venta.id, cantidad: p.cantidad, precio, foto_vendedor: fotoUrl, descripcion: sol.descripcion };
    let item = prev;
    if (item) await supabase.from('vv_items').update({ ...base, estado: 'pendiente', candidatos: { solicitud: sol } }).eq('id', item.id);
    else item = (await supabase.from('vv_items').insert({ ...base, estado: 'pendiente', candidatos: { solicitud: sol } }).select('*').single()).data;
    if (!item) continue;
    await reconocer(supabase, item, sol, conFoto ? descFoto : p.descripcion, fotoUrl);
  }
  // Prendas que el vendedor quitó
  const sobran = previos.slice(prendasExp.length).map((x: any) => x.id);
  if (sobran.length) await supabase.from('vv_items').delete().in('id', sobran);

  if (!esOrden && await hayMasNuevo()) return true; // llegó otro mensaje: responde esa llamada con todo junto
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
  const claro = cands.length === 1 || cands[0].puntaje >= cands[1].puntaje + 12;
  if (claro && cands[0].puntaje >= 30) {
    // Ganador evidente (p. ej. el título de la foto coincide con el catálogo): no hace falta comparar fotos
    elegido = cands[0]; confianza = 0.85; motivo = 'coincidencia clara por nombre y color';
  } else if (fotoUrl) {
    const { bajarComoBase64 } = await import('./ia');
    const f = await bajarComoBase64(fotoUrl);
    if (f) {
      const r = await elegirConFoto(f, cands.slice(0, 4), `Título impreso en la foto: ${sol.descripcion || '(no tiene)'} · talla ${sol.talla || '—'}`);
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
  // Entrega en oficina de la transportadora: no lleva dirección de calle ni barrio
  const enOficina = esOficinaInter([venta.direccion, venta.referencia_dir, venta.complemento, venta.observaciones].filter(Boolean).join(' '))
    || /ofi[cs]?i?na|reclama/i.test(sinTildes([venta.direccion, venta.referencia_dir].filter(Boolean).join(' ')));
  if (!enOficina && !venta.direccion) falta.push('dirección');
  if (!enOficina && !venta.barrio) falta.push('barrio');
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
  const refCorta = (r: string | null) => String(r ?? '').replace(/\s+/g, '') || '—';
  const total = Number(venta.total) || 0;
  const abono = Number(venta.abono) || 0;
  // Con abono parcial siempre se muestra TOTAL / ABONO / COBRAR (dueño, 08-nov-2026)
  const pagadoTodo = ['anticipado', 'contado'].includes(String(venta.tipo_pago ?? '')) && !(abono > 0 && abono < total);
  const pago = pagadoTodo
    ? `Pagado completo (${venta.tipo_pago}) · *VALOR TOTAL ${money(total)}* · COBRAR $0`
    : abono > 0
      ? `Contraentrega con abono\n*VALOR TOTAL ${money(total)}*\n*ABONO ${money(abono)}*\n*COBRAR ${money(Math.max(0, total - abono))}*`
      : `Contraentrega\n*VALOR TOTAL ${money(total)}*\n*COBRAR ${money(total)}*`;
  const resumen =
    `✅ Aquí tienes el resumen completo de la venta *${venta.codigo}*.\n\n` +
    `_Datos del cliente:_\n` +
    `• Nombre: ${venta.cliente_nombre}\n` +
    `• Celular: ${venta.cliente_celular}\n` +
    `• WhatsApp: ${venta.cliente_whatsapp === false ? 'No' : 'Sí'}\n` +
    `• Cédula: ${venta.cliente_identificacion || '(No registra - se identifica con celular)'}\n` +
    `• Correo: ${venta.cliente_correo || CORREO_DEFECTO}\n` +
    `• Departamento: ${String(venta.departamento ?? '').toUpperCase()}\n` +
    `• Municipio: ${venta.municipio}\n` +
    `• Localidad: ${venta.barrio || ''}\n` +
    `• Dirección: ${venta.direccion}\n` +
    `• Complemento: ${venta.complemento || ''}\n` +
    `• Referencia: ${venta.referencia_dir || (venta.barrio ? `Barrio ${venta.barrio}` : '')}\n\n` +
    `_Datos de producto:_\n` +
    its.map((it: any) =>
      `• Catálogo: ${it.catalogo} | Referencia: ${refCorta(it.referencia)} | Género: ${it.genero || 'Hombre'} | Talla: ${it.talla} | Color: ${it.color} | ` +
      `Cantidad: ${it.cantidad} | Valor unitario: ${money(it.precio)} | ID variante: ${it.id_variante}`).join('\n') +
    `\n\n_Forma de pago:_\n• ${pago}`;
  await responder(resumen);
  const wamid = await enviarBotones(venta.vendedor_tel, '¿Confirmas que los datos de la venta son correctos?', [
    { id: `vv-si-${venta.id}`, titulo: 'Sí' }, { id: `vv-no-${venta.id}`, titulo: 'No' },
  ]);
  try {
    await supabase.from('messages').insert({
      id: `vvq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, conversation_id: venta.vendedor_tel,
      content: '¿Confirmas que los datos de la venta son correctos? [Sí] [No]', role: 'assistant', type: 'text',
      whatsapp_id: wamid, created_at: new Date().toISOString(),
    });
  } catch { /* ignorar */ }
  for (const it of its) {
    const foto = it.foto_oficial;
    if (foto) await enviarFoto(foto, `${it.catalogo} · ${it.color} · Talla ${it.talla}${it.cantidad > 1 ? ` · x${it.cantidad}` : ''}`);
  }
}

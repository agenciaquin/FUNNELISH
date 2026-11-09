import { sendTextMessage, sendImageByUrl, descargarWhatsAppMedia, mostrarEscribiendo } from '@/lib/whatsapp';
import { chat } from '@/lib/quinchat/claude';
import { generarCollagePack } from '@/lib/collage';
import { recortar } from '@/lib/recortar';
import { unirDireccionBarrio } from '@/lib/direccion-barrio';

/**
 * ORGANIZADOR DE PEDIDOS (ver config.ts).
 *
 * El vendedor reenvía al bot, en desorden, las fotos y los pedazos de texto de un
 * pedido (nombre, celular partido en dos, dirección, ciudad…). El bot espera a que
 * termine (15 s sin piezas nuevas), lo ordena con IA y le devuelve:
 *   · UNA imagen (collage de las fotos) con el pedido ordenado como texto;
 *   · si falta algo (valor, talla…), un segundo mensaje diciendo qué falta.
 * Si después manda lo que faltaba, se vuelve a armar el pedido completo.
 *
 * Nunca inventa datos: lo que no está en las piezas queda como "falta".
 * No toca pedidos, Effi, etiquetas ni ningún otro flujo.
 */

const ESPERA_MS = 15_000;            // silencio antes de organizar
const LOTE_ABIERTO_MS = 10 * 60_000; // piezas a menos de esto siguen el mismo pedido
const CORRECCION_MS = 15 * 60_000;   // complemento sin fotos tras una respuesta → se rehace
const VENTANA_MS = 30 * 60_000;      // nunca se mira más atrás que esto

const DIR_RE = /\b(calle|cll|cl|carrera|cra|kr|cr|diagonal|dg|transversal|tv|avenida|av|barrio|urbanizaci[oó]n|urb|apartamento|apto|torre|conjunto|manzana|mz|casa|talla|valor|celular|cel)\b/i;

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Pieza { id: string; type: string; content: string; caption: string | null; created_at: string }

export async function atenderOrganizador(supabase: any, value: any, from: string): Promise<boolean> {
  const m = value?.messages?.[0];
  if (!m || (m.type !== 'text' && m.type !== 'image')) return false;

  const reenviado = !!(m.context?.forwarded || m.context?.frequently_forwarded);
  const texto = m.type === 'text' ? String(m.text?.body ?? '').trim() : String(m.image?.caption ?? '').trim();
  const ahora = Date.now();

  const { data: ultPieza } = await supabase.from('messages').select('created_at')
    .eq('conversation_id', from).like('id', 'org-in-%')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  const loteAbierto = !!ultPieza && ahora - Date.parse(ultPieza.created_at) < LOTE_ABIERTO_MS;

  // ── ¿Esto es del organizador o es el reporte de ventas de siempre? ─────────
  if (m.type === 'text') {
    const numeroCorto = /^\s*\d{1,2}\s*$/.test(texto);
    if (numeroCorto && !reenviado) {
      if (!loteAbierto) return false;                       // "0", "1"… = reporte al supervisor
      const { data: ultBot } = await supabase.from('messages').select('content, created_at')
        .eq('conversation_id', from).eq('role', 'assistant')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (ultBot && /CRONOMETRADO|corte del d[ií]a|cu[aá]ntas ventas/i.test(String(ultBot.content ?? ''))) return false;
    }
    const pareceDato = reenviado || loteAbierto || texto.replace(/\D/g, '').length >= 7 || DIR_RE.test(texto);
    if (!pareceDato) return false;
  }

  // ── Guardar la pieza (sale en el panel) ─────────────────────────────────────
  const idPieza = `org-in-${m.id}`;
  const { data: yaEsta } = await supabase.from('messages').select('id').eq('id', idPieza).maybeSingle();
  if (yaEsta) return true;                                   // reintento de Meta

  let contenido = texto;
  let tipo = 'text';
  if (m.type === 'image') {
    tipo = 'image';
    contenido = '[foto no disponible]';
    try {
      const media = await descargarWhatsAppMedia(m.image?.id);
      if (media) {
        const ruta = `organizador/${from}/${ahora}-${Math.random().toString(36).slice(2, 7)}.jpg`;
        const { error } = await supabase.storage.from('chat-media').upload(ruta, media.buffer, { contentType: media.mimeType || 'image/jpeg', upsert: false });
        if (!error) contenido = supabase.storage.from('chat-media').getPublicUrl(ruta)?.data?.publicUrl ?? contenido;
      }
    } catch (e) { console.error('[Organizador] foto:', e); }
    if (!contenido.startsWith('http')) tipo = 'text';
  }
  // El chat debe existir antes del mensaje (llave foránea): si lo borraron del panel, se recrea (08-nov-2026)
  try {
    const { vendedorDe } = await import('@/lib/vendedores');
    const { tipoLineaActual } = await import('@/lib/whatsapp-contexto');
    await supabase.from('conversations').upsert({
      id: from, contact_name: vendedorDe(from)?.nombre ?? from, label: 'VENDEDOR', linea: tipoLineaActual(),
      last_message: '', last_message_time: new Date(ahora).toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: true });
  } catch { /* ignorar */ }
  await supabase.from('messages').upsert({
    id: idPieza, conversation_id: from, role: 'user', type: tipo,
    content: contenido, caption: m.type === 'image' ? (texto || null) : null,
    whatsapp_id: m.id, created_at: new Date(ahora).toISOString(),
  }, { onConflict: 'id' });
  await supabase.from('conversations').update({
    last_message: recortar(m.type === 'image' ? '📷 Foto' : texto, 100), last_message_time: new Date(ahora).toISOString(),
  }).eq('id', from);

  // ── Esperar a que termine de reenviar ───────────────────────────────────────
  try { await mostrarEscribiendo(m.id); } catch { /* ignorar */ }
  await esperar(ESPERA_MS);
  const { data: masNueva } = await supabase.from('messages').select('id')
    .eq('conversation_id', from).like('id', 'org-in-%')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (masNueva && masNueva.id !== idPieza) return true;      // la última pieza es la que organiza

  // ── Armar el lote ───────────────────────────────────────────────────────────
  const { data: salidas } = await supabase.from('messages').select('created_at')
    .eq('conversation_id', from).like('id', 'org-out-txt-%')
    .gte('created_at', new Date(ahora - 2 * VENTANA_MS).toISOString())
    .order('created_at', { ascending: false }).limit(2);
  const ultSalida = salidas?.[0]?.created_at ? Date.parse(salidas[0].created_at) : 0;
  const penSalida = salidas?.[1]?.created_at ? Date.parse(salidas[1].created_at) : 0;

  const traer = async (desde: number, hasta: number): Promise<Pieza[]> => {
    const { data } = await supabase.from('messages').select('id, type, content, caption, created_at')
      .eq('conversation_id', from).like('id', 'org-in-%')
      .gt('created_at', new Date(desde).toISOString()).lte('created_at', new Date(hasta).toISOString())
      .order('created_at', { ascending: true }).limit(40);
    return (data ?? []) as Pieza[];
  };
  const fin = Date.now() + 1000;
  let lote = await traer(Math.max(ultSalida, ahora - VENTANA_MS), fin);
  if (!lote.length) return true;
  let correccion = false;
  if (ultSalida && ahora - ultSalida < CORRECCION_MS && !lote.some(p => p.type === 'image')) {
    const previas = await traer(Math.max(penSalida, ultSalida - VENTANA_MS), ultSalida);
    if (previas.length) { lote = [...previas, ...lote]; correccion = true; }
  }

  // ── Ordenar con IA (lee también las etiquetas de las fotos) ────────────────
  const fotos = lote.filter(p => p.type === 'image' && p.content.startsWith('http')).map(p => p.content);
  const pedido = await ordenarConIA(lote, fotos);
  if (!pedido || !pedido.es_pedido) {
    console.log('[Organizador] no parece un pedido; no se responde');
    return true;
  }

  const { texto: ficha, faltan } = armarFicha(pedido);

  // ── Responder: collage + ficha en el texto de la foto ──────────────────────
  let wamid: string | null = null;
  let imagenSalida: string | null = null;
  if (fotos.length >= 2) {
    imagenSalida = await generarCollagePack(supabase, fotos.map((_, i) => `org-${from}-${ahora}-${i}`), fotos.slice(0, 4));
  } else if (fotos.length === 1) {
    imagenSalida = fotos[0];
  }
  if (imagenSalida) wamid = await sendImageByUrl(from, imagenSalida, ficha);
  if (!wamid) {
    // sin fotos o falló el collage: fotos sueltas + ficha como texto
    if (!imagenSalida) for (const f of fotos.slice(0, 4)) await sendImageByUrl(from, f);
    wamid = await sendTextMessage(from, ficha);
  }
  const aviso = faltan.length
    ? `⚠️ Me falta: *${faltan.join(', ')}*. Envíamelo y te devuelvo el pedido completo.`
    : (correccion ? '✅ Pedido actualizado con lo que me enviaste.' : '');
  if (aviso) await sendTextMessage(from, aviso);

  const t = Date.now();
  const filas: any[] = [];
  if (imagenSalida) filas.push({ id: `org-out-img-${t}`, conversation_id: from, role: 'assistant', type: 'image', content: imagenSalida, caption: ficha, created_at: new Date(t).toISOString() });
  filas.push({ id: `org-out-txt-${t}`, conversation_id: from, role: 'assistant', type: 'text', content: ficha + (aviso ? `\n\n${aviso}` : ''), whatsapp_id: wamid, created_at: new Date(t + 1).toISOString() });
  await supabase.from('messages').insert(filas);
  await supabase.from('conversations').update({ last_message: recortar(ficha, 100), last_message_time: new Date(t).toISOString() }).eq('id', from);
  return true;
}

// ── IA ────────────────────────────────────────────────────────────────────────

interface PedidoIA {
  es_pedido: boolean;
  nombre: string; cedula: string; celular: string; correo: string; direccion: string; barrio: string;
  ciudad: string; departamento: string; valor: string;
  prendas: { color: string; talla: string; genero: string }[];
}

const SISTEMA = [
  'Eres el asistente de una vendedora de ropa (buzos, chaquetas, camisetas). Ella te reenvía EN DESORDEN',
  'las piezas de UN pedido de un cliente: fotos de las prendas y pedazos de texto (nombre, celular, dirección,',
  'ciudad, talla, valor…). Tu trabajo es ORDENARLAS. Responde SOLO un JSON, sin texto alrededor:',
  '{"es_pedido":true,"nombre":"","cedula":"","celular":"","correo":"","direccion":"","barrio":"","ciudad":"","departamento":"","valor":"",',
  '"prendas":[{"color":"","talla":"","genero":""}]}',
  'Reglas:',
  '- NUNCA inventes un dato. Si no está en las piezas, déjalo "".',
  '- nombre: el nombre del cliente tal cual lo escribió, cambiando los puntos entre palabras por espacios',
  '  ("Rodrigo.usuga" → "Rodrigo usuga"). Frases como "es mi nombre" no son parte del nombre.',
  '- cedula: solo si la escribió (dígitos). correo: solo si lo escribió.',
  '- celular: SOLO dígitos. Si vino partido en varias piezas seguidas ("Celular 3006636" + "089"), únelas en orden.',
  '  Quita el +57 o 57 inicial. Si no cuadran 10 dígitos, devuelve lo que haya (no completes).',
  '- direccion: calle/carrera/número y apartamento/torre/casa, tal cual. barrio: barrio, urbanización o conjunto.',
  '  Si el pedido va a recoger en OFICINA de Interrapidísimo (aunque lo escriba mal: "interapidicimo",',
  '  "inter rapidisimo"…), direccion = "Oficina Interrapidísimo" (más el nombre o sede si lo dio) y barrio = "".',
  '- ciudad tal cual. departamento: si no lo escribió pero la ciudad es inequívoca (Medellín → Antioquia,',
  '  Bogotá → Cundinamarca, Cali → Valle del Cauca…), ponlo; si hay duda, "".',
  '- valor: solo si lo escribió (número, p. ej. "150000"). Si no, "".',
  '- prendas: una por foto/prenda. color: el de la etiqueta de la foto o el que se ve ("Negro", "Verde Oscuro").',
  '  Las fotos pueden traer una etiqueta tipo "L - 73 uds": L es la TALLA (el número de uds es inventario, ignóralo).',
  '  Si solo hay UNA talla para todo el pedido, úsala en todas las prendas. genero: "HOMBRE" o "DAMA" SOLO si',
  '  lo dice (hombre/caballero/masculino o dama/mujer/femenino); si no lo dice, "".',
  '- es_pedido: false solo si las piezas claramente no son un pedido (un saludo, una pregunta suelta).',
].join('\n');

async function aBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return { base64: b.toString('base64'), mimeType: (r.headers.get('content-type') || 'image/jpeg').split(';')[0] };
  } catch { return null; }
}

async function ordenarConIA(lote: Pieza[], fotos: string[]): Promise<PedidoIA | null> {
  let nFoto = 0;
  const lineas = lote.map((p, i) => {
    if (p.type === 'image') { nFoto++; return `${i + 1}. [FOTO ${nFoto}]${p.caption ? ` texto: ${p.caption}` : ''}`; }
    return `${i + 1}. ${p.content}`;
  });
  const imagenes = (await Promise.all(fotos.slice(0, 4).map(aBase64))).filter(Boolean) as { base64: string; mimeType: string }[];
  try {
    const r = await chat({
      tenantId: 'klixmant', systemPrompt: SISTEMA, maxTokens: 700, imagenes,
      messages: [{ role: 'user', content: `Piezas en el orden en que llegaron (las fotos van adjuntas en orden):\n${lineas.join('\n')}` }],
    });
    const t = r.message;
    const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    const s = (v: unknown) => String(v ?? '').trim();
    return {
      es_pedido: j.es_pedido !== false,
      nombre: s(j.nombre), cedula: s(j.cedula).replace(/\D/g, ''), correo: s(j.correo), celular: s(j.celular).replace(/\D/g, '').replace(/^57(?=3\d{9}$)/, ''),
      direccion: s(j.direccion), barrio: s(j.barrio), ciudad: s(j.ciudad), departamento: s(j.departamento),
      valor: s(j.valor),
      prendas: Array.isArray(j.prendas) ? j.prendas.map((p: any) => ({ color: s(p?.color), talla: s(p?.talla).toUpperCase(), genero: /dama|mujer|femen/i.test(s(p?.genero)) ? 'Dama' : /hombre|caball|mascul/i.test(s(p?.genero)) ? 'Hombre' : '' })) : [],
    };
  } catch (e) {
    console.error('[Organizador] IA:', e);
    return null;
  }
}

// ── Ficha (formato que pidió el dueño, 05-nov-2026) ──────────────────────────
// Un emoji por dato. Obligatorios (si faltan se piden): nombre, celular, dirección, barrio,
// ciudad y departamento, talla, Dama/Hombre y valor. Opcionales: cédula y correo.

// Oficina de Interrapidísimo (con las mil formas de escribirlo). Allí no hay barrio.
const INTER_RE = /\binte?r+\s*-?\s*r*a+p+i+d+[ií]*[sc]+[ií]*m+o\b|\binter\s*rap+i\w*|\binterrap\w*/i;
export function esOficinaInter(dir: string): boolean {
  return INTER_RE.test(dir) || /\b(oficina|reclam[oa]r? en (la )?oficina|recoger en (la )?oficina)\b/i.test(dir);
}
function corregirOficina(dir: string): string {
  let d = dir.replace(INTER_RE, 'Interrapidísimo')
    .replace(/^.*?\boficina\b(\s+(de|del)\b)?/i, 'Oficina')           // "Reclamo en oficina de…" → "Oficina…"
    .replace(/^((reclam\w*|recog\w*|para|en|la|el)\s+)+/i, '')
    .replace(/\s{2,}/g, ' ').trim();
  if (!/Interrapidísimo/.test(d)) d = `${d} Interrapidísimo`.trim();
  if (!/^Oficina\b/.test(d)) d = `Oficina ${d.replace(/\bOficina\b\s*/, '')}`.trim();
  return d;
}

function armarFicha(p: PedidoIA): { texto: string; faltan: string[] } {
  const faltan: string[] = [];
  const oficina = !!p.direccion && esOficinaInter(p.direccion);
  if (oficina) { p = { ...p, direccion: corregirOficina(p.direccion), barrio: '' }; }
  const F = '(falta)';
  if (!p.nombre) faltan.push('nombre completo');
  const celOk = /^3\d{9}$/.test(p.celular);
  if (!celOk) faltan.push(p.celular ? `celular completo (llegó con ${p.celular.length} dígitos)` : 'celular');
  if (!p.direccion) faltan.push('dirección');
  if (!p.barrio && !oficina) faltan.push('barrio');   // a oficina no hay barrio
  if (!p.ciudad || !p.departamento) faltan.push(!p.ciudad ? 'ciudad y departamento' : 'departamento');

  const prendas = p.prendas.length ? p.prendas : [{ color: '', talla: '', genero: '' }];
  if (prendas.some(x => !x.talla)) faltan.push('talla');
  if (prendas.some(x => !x.genero)) faltan.push('si es Dama u Hombre');
  const una = new Set(prendas.map(x => `${x.talla}|${x.genero}`)).size === 1;
  const fmtPrenda = (x: { color: string; talla: string; genero: string }, conColor: boolean) =>
    `${conColor && x.color ? x.color + ' ' : ''}${x.talla || F} - ${x.genero || F}`;
  const talla = una ? fmtPrenda(prendas[0], false) : prendas.map(x => fmtPrenda(x, true)).join(' · ');

  const n = Number(p.valor.replace(/\D/g, ''));
  const valor = n > 0 ? n.toLocaleString('es-CO') : '';
  if (!valor) faltan.push('valor');

  // Formato corto (05-nov-2026). El barrio va dentro de DIR ("…, Barrio X"); cédula y
  // correo solo salen si el vendedor los pasó.
  const dir = !p.direccion ? F : (oficina || !p.barrio) ? p.direccion : unirDireccionBarrio(p.direccion, p.barrio);
  const texto = [
    '📦 *DATOS DE ENVÍO*',
    '',
    `👤 *NOMBRE:* ${p.nombre || F}`,
    p.cedula ? `🪪 *C.C (OPCIONAL):* ${p.cedula}` : null,
    `📱 *CEL:* ${p.celular || F}`,
    p.correo ? `✉️ *CORREO:* ${p.correo}` : null,
    `📍 *DIR:* ${dir}`,
    `🌆 *CIUDAD:* ${p.ciudad || F}`,
    `🌆 *DEPARTAMENTO:* ${p.departamento || F}`,
    `👕 *TALLA:* ${talla}`,
    `💰 *VALOR:* ${valor || F}`,
  ].filter((l): l is string => l !== null).map(l => l.trimEnd()).join('\n');
  return { texto, faltan };
}

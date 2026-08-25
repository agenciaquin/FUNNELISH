// =====================================================
// BOT DE VENTAS — atiende a quien llega desde campañas
// Corre en el número de ventas. Vende, resuelve dudas y, cuando el cliente
// tiene todos los datos, crea el pedido (que se confirma por el mismo número).
// =====================================================

import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage, sendImageByUrl, mostrarEscribiendo, descargarWhatsAppMedia } from '@/lib/whatsapp';
import { generarCollagePack } from '@/lib/collage';
import { lineaTalla } from '@/lib/formato-pedido';
import { transcribirAudio } from '@/lib/transcribir';
import { chat } from '@/lib/quinchat/claude';
import { bloqueDeMemoria } from '@/lib/memoria';
import { registrarFAQCandidata } from '@/lib/faq';
import { cargarPromptEmpresa } from '@/lib/quinchat/prompt-tenant';
import { cargarComportamiento } from '@/lib/quinchat/comportamiento';

const ADMIN_VENTAS_HUMANO = '573143534918';
// Estados exclusivos del pedido (uno a la vez); el resto son etiquetas adicionales
const ESTADOS = ['PENDIENTE POR CONFIRMACIÓN', 'VENTA REALIZADA', 'ABONO POR VERIFICAR', 'ANULADO EN EFFI', 'PEDIDO PROGRAMADO', 'PEDIDO CANCELADO'];
// A dónde se pasa el pedido ya armado (chat de operación/despachos)
const CHAT_DE_VENTA = '573143534918';
// La ficha de cada venta del chat WhatsApp se envía al chat de operación Y a Lilibeth.
const DESTINOS_VENTA = ['573143534918', '573187051499'];

/**
 * Resuelve el mensaje CITADO por el cliente (cuando responde a una foto/mensaje).
 * Devuelve la URL de la foto (para mostrar miniatura), una etiqueta del tipo de
 * archivo, o el texto citado. Null si el cliente no citó nada.
 */
async function resolverCita(supabase: any, contextId: string | undefined): Promise<string | null> {
  if (!contextId) return null;
  try {
    const { data: q } = await supabase.from('messages').select('content, type')
      .or(`whatsapp_id.eq.${contextId},id.eq.${contextId}`).maybeSingle();
    if (!q) return '💬';
    const c = String(q.content ?? '');
    if ((q.type === 'image' || q.type === 'video') && c.startsWith('http')) return c;
    if (q.type === 'image')    return '🖼️ Foto';
    if (q.type === 'audio')    return '🎵 Audio';
    if (q.type === 'video')    return '🎬 Video';
    if (q.type === 'document') return '📎 Documento';
    return c;
  } catch { return null; }
}

/** Catálogo para el bot: los embudos activos con sus precios, tallas y colores. */
async function catalogoDeVenta(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('funnels')
    .select('producto, precio, precio_antes, tallas, variantes, slug')
    .eq('activo', true);

  if (!data?.length) return 'Aún no hay productos cargados.';

  const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
  const lineas = data.map((f: any) => {
    const tallas = Array.isArray(f.tallas) ? f.tallas.join(', ') : '';
    const variantes = Array.isArray(f.variantes) ? f.variantes : [];

    // Colores CON su foto, para que el bot pueda enviarla
    const porColor = new Map<string, string | undefined>();
    for (const v of variantes) {
      for (const s of (v.selectores ?? [])) {
        for (const o of (s.opciones ?? [])) {
          const valor  = typeof o === 'string' ? o : o?.valor;
          const imagen = typeof o === 'string' ? undefined : o?.imagen;
          if (valor && !porColor.get(valor)) porColor.set(valor, imagen);
        }
      }
    }
    const colores = [...porColor.entries()]
      .map(([c, img]) => (img ? `${c} → FOTO: ${img}` : c))
      .join('\n    ');

    const packs = variantes.map((v: any) => `${v.nombre} = ${pesos(v.precio)}`).join(' | ');
    const galeria = Array.isArray(f.imagenes) ? f.imagenes.slice(0, 3) : [];

    return `• ${f.producto} — HOY ${pesos(f.precio)}${f.precio_antes ? ` (antes ${pesos(f.precio_antes)})` : ''}\n`
      + (tallas ? `  Tallas: ${tallas}\n` : '')
      + (colores ? `  Colores (con su foto):\n    ${colores}\n` : '')
      + (packs ? `  Opciones/packs: ${packs}\n` : '')
      + (galeria.length ? `  Fotos generales: ${galeria.join(' , ')}\n` : '')
      + `  Enlace: pedido.klixmant.shop/${f.slug}`;
  });

  // Productos EXTRA: los de la sección "Catálogos", agrupados por familia
  // (ESPAÑA, ESCUDERIA FERRARI, ARGENTINA…). Son productos REALES y vendibles.
  try {
    // Precio de referencia: el más usado en los embudos (todos los buzos valen igual)
    const precios = (data ?? []).map((f: any) => Number(f.precio)).filter(Boolean);
    const precioBase = precios.length ? precios.sort((a: number, b: number) => a - b)[Math.floor(precios.length / 2)] : 0;

    const [{ data: familias }, { data: colores }] = await Promise.all([
      supabase.from('catalogos_bot').select('familia, patron').eq('activo', true),
      supabase.from('catalogo_colores').select('color, nombre_producto, url_imagen').limit(600),
    ]);

    // Palabras genéricas que NO identifican la marca (para no fallar el match)
    const GENERICOS = new Set(['MOTERO', 'MARCA', 'MOTO', 'ESCUDERIA', 'ESCUDERÍA',
      'BUZO', 'BUZOS', 'REFLECTIVO', 'PREMIUM', 'DE', 'LA', 'EL', 'LOS', 'LAS', 'DEL', 'Y']);

    const bloques: string[] = [];
    const motos: string[] = [];   // catálogos de moto: se agrupan en el menú
    for (const fam of (familias ?? [])) {
      const clave = String(fam.patron ?? fam.familia ?? '').toUpperCase().trim();
      if (!clave) continue;

      // Los catálogos de moto se agrupan bajo una sola opción "Motos" en el menú.
      if (/\bMOTO|MOTERO/.test(clave) || /\bMOTO|MOTERO/.test(String(fam.familia ?? '').toUpperCase())) {
        if (fam.familia) motos.push(String(fam.familia));
      }

      // Palabras de marca de esta familia (patrón + nombre), sin las genéricas
      const brandWords = `${clave} ${String(fam.familia ?? '').toUpperCase()}`
        .split(/\s+/).filter(w => w.length >= 3 && !GENERICOS.has(w));
      if (!brandWords.length) continue;

      // Si ya existe como embudo con su propia página, no se repite
      const yaEsEmbudo = (data ?? []).some((f: any) => {
        const p = String(f.producto ?? '').toUpperCase();
        return brandWords.some(w => p.includes(w));
      });
      if (yaEsEmbudo) continue;

      // Colores de esta familia: el producto comparte alguna palabra de marca
      const suyos = (colores ?? []).filter((c: any) => {
        const nU = String(c.nombre_producto ?? '').toUpperCase();
        return brandWords.some(w => nU.includes(w));
      });
      if (!suyos.length) continue;

      const lista = suyos.slice(0, 15)
        .map((c: any) => (c.url_imagen ? `${c.color} → FOTO: ${c.url_imagen}` : `${c.color}`))
        .join('\n    ');
      bloques.push(`• ${fam.familia}${precioBase ? ` — ${pesos(precioBase)}` : ''}\n    ${lista}`);
    }

    if (bloques.length) {
      lineas.push(
        'MÁS PRODUCTOS DISPONIBLES (sí los vendemos, mismo precio y condiciones):\n'
        + bloques.join('\n'));
    }

    if (motos.length) {
      lineas.push(
        '🏍️ CATÁLOGOS DE MOTO (en el menú de bienvenida NO los listes uno por uno: '
        + 'muéstralos como UNA sola opción "🏍️ Motos"). Solo cuando el cliente pida motos '
        + 'o pregunte cuáles hay, muéstrale las marcas disponibles, una por línea:\n'
        + motos.map(m => `   - ${m}`).join('\n'));
    }
  } catch { /* si no hay catálogo extra, se sigue con los embudos */ }

  return lineas.join('\n\n');
}

// PROMPT ESTABLE (idéntico para todos los clientes) → se cachea y se reutiliza.
// Lo variable por cliente (promo, anuncio, pedido previo) va en contextoVentas().
function promptVentas(negocio: string, comportamiento: string, catalogo: string, memoria: string): string {
  return `${negocio}
${comportamiento}

════════ FORMATO TÉCNICO DEL SISTEMA (el cliente NO ve estas etiquetas) ════════
Estas etiquetas son señales para el SISTEMA. Úsalas EXACTAMENTE así, en una línea aparte:

• ENVIAR UNA FOTO → [[FOTO]]<URL exacta del catálogo de abajo>
  Es la ÚNICA forma de mandar una foto. Nunca escribas "te mando la foto" ni describas la imagen. La primera vez que muestras un modelo, pon una línea [[FOTO]] por cada color y nómbralos en el texto en el mismo orden. Usa solo URLs reales del catálogo.

• REGISTRAR EL PEDIDO → cuando ya tengas nombre, teléfono, dirección, ciudad, departamento, producto, talla (si el producto la usa) y color/variante, manda tu confirmación al cliente y termina el mensaje con una línea aparte EXACTAMENTE así (precio en número, sin puntos):
  [[PEDIDO]]{"nombre":"...","apellidos":"...","telefono":"3001234567","direccion":"...","barrio":"","municipio":"...","departamento":"...","correo":"","producto":"NOMBRE EXACTO DEL CATÁLOGO","talla":"...","color":"...","precio":0,"oficina":false,"abono":0}
  Deja "barrio" y "correo" en "" si el cliente no los dio (no son obligatorios). El "precio" es el TOTAL del pedido, tomado de los precios del entrenamiento/catálogo. Si el negocio ofrece recoger en oficina con abono y el cliente lo elige, pon "oficina":true y "abono":<monto del abono>.

• CAMBIO DESPUÉS DE CONFIRMAR → si el cliente ya tenía pedido y pide cambiar algo (talla, color, dirección…), confírmale el cambio con el resumen actualizado y termina con una línea aparte igual pero con [[ACTUALIZAR]] (mismos campos, ya corregidos). NUNCA uses [[PEDIDO]] dos veces con el mismo cliente: del segundo en adelante es [[ACTUALIZAR]].

• PASAR A UN HUMANO → cuando de verdad haga falta (según tu comportamiento), responde algo corto ("Te paso con un asesor 😊") y termina el mensaje con [[HUMANO]] en una línea aparte.

════════ CATÁLOGO REAL DE LA TIENDA (precios y fotos reales — tu única verdad) ════════
${catalogo}

${memoria ? `LO QUE HAS APRENDIDO (respuestas aprobadas):\n${memoria}\n` : ''}`;
}

// CONTEXTO VARIABLE por cliente. Va en un bloque aparte (NO cacheado), pequeño.
// Así el prompt grande de arriba se reutiliza (caché) en TODAS las conversaciones.
function contextoVentas(anuncio: string, pedidoPrevio: string, promoActiva = false): string {
  const partes: string[] = [];
  if (promoActiva) partes.push(
    `🎁 DESCUENTO ACTIVO HOY para este cliente: tiene *$10.000 de descuento* vigente SOLO HOY ` +
    `(le llegó una promo de cierre). Cuando le cotices, RÉSTALE $10.000 al precio que le corresponda ` +
    `(ej. 1 unidad $129.900 → *$119.900*). Menciónale que es su descuento de hoy y úsalo para cerrar ` +
    `con urgencia amable. Aplica el descuento UNA vez, sobre el total del pedido, no por unidad extra.`);
  if (anuncio) partes.push(
    `Este cliente llegó de este anuncio:\n${anuncio}\nHáblale DIRECTO de ese producto (salvo que él pida otro distinto).`);
  if (pedidoPrevio) partes.push(
    `════════ ESTE CLIENTE YA TIENE PEDIDO ════════\n${pedidoPrevio}\nNo se lo vuelvas a tomar. Si pide cambios, usa [[ACTUALIZAR]].`);
  return partes.join('\n\n');
}

/**
 * Deja el historial como lo exige la IA: debe EMPEZAR con el cliente y no puede
 * traer dos mensajes seguidos del mismo lado. Si no, la llamada falla y el bot
 * se queda mudo (que era justo lo que pasaba).
 */
function normalizarHistorial(items: { role: string; content: string }[]) {
  const salida: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const it of items) {
    const role: 'user' | 'assistant' = it.role === 'user' ? 'user' : 'assistant';
    const content = String(it.content ?? '').trim();
    if (!content) continue;
    if (salida.length === 0 && role !== 'user') continue;   // debe arrancar en el cliente
    const ultimo = salida[salida.length - 1];
    if (ultimo && ultimo.role === role) ultimo.content += `\n${content}`;  // unir seguidos
    else salida.push({ role, content });
  }
  // Debe terminar en el cliente, que es a quien se le responde (y donde van las fotos)
  while (salida.length && salida[salida.length - 1].role !== 'user') salida.pop();
  return salida;
}

/** Guarda un mensaje del bot y lo envía por WhatsApp. */
async function responder(supabase: any, from: string, texto: string) {
  // La asesora puede separar su respuesta en varios mensajes cortos con "---",
  // como escribe una persona. Se envían uno por uno, con una pausita natural.
  const partes = texto.split(/\n?---+\n?/).map(t => t.trim()).filter(Boolean);
  const lista = partes.length ? partes : [texto.trim()].filter(Boolean);

  for (let i = 0; i < lista.length; i++) {
    const parte = lista[i];
    const wamid = await sendTextMessage(from, parte);
    await supabase.from('messages').insert({
      id: `ventas-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      conversation_id: from,
      content: parte,
      role: 'assistant',
      type: 'text',
      whatsapp_id: wamid,
      created_at: new Date().toISOString(),
    });
    // Pausa breve entre mensajes, para que se sienta natural (no de golpe)
    if (i < lista.length - 1) await new Promise(r => setTimeout(r, 900));
  }

  await supabase.from('conversations').update({
    last_message: (lista[lista.length - 1] ?? texto).slice(0, 100),
    last_message_time: new Date().toISOString(),
    unread_count: 0, // el bot respondió → sin "no leído" (comportamiento WhatsApp)
  }).eq('id', from);
}

/** Envía una foto del producto y la deja guardada en el chat del panel. */
async function enviarFoto(supabase: any, from: string, url: string, pie = '') {
  const wamid = await sendImageByUrl(from, url, pie);
  await supabase.from('messages').insert({
    id: `ventas-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: from,
    content: url,
    role: 'assistant',
    type: 'image',
    whatsapp_id: wamid,
    created_at: new Date().toISOString(),
  });
}

/**
 * Saca las fotos que pidió el modelo ([[FOTO]]url) y devuelve el texto limpio.
 * Así el cliente recibe las imágenes de verdad y no una etiqueta rara.
 */
function separarFotos(texto: string): { limpio: string; fotos: string[] } {
  const fotos: string[] = [];
  const limpio = texto.replace(/\[\[FOTO\]\]\s*(\S+)/g, (_m, url) => {
    if (typeof url === 'string' && url.startsWith('http')) fotos.push(url);
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { limpio, fotos: [...new Set(fotos)].slice(0, 8) };
}

/**
 * Divide la respuesta respetando el ORDEN pedido: primero el GANCHO (texto antes
 * de las fotos), luego las FOTOS, y de último el CTA (texto después de las fotos,
 * ej. "Me envías el modelo y color…"). Si no hay fotos, todo es gancho.
 */
function partirGanchoFotosCTA(texto: string): { gancho: string; fotos: string[]; cta: string } {
  const fotos: string[] = [];
  const re = /\[\[FOTO\]\]\s*(\S+)/g;
  let m: RegExpExecArray | null;
  let primera = -1; let ultima = -1;
  while ((m = re.exec(texto)) !== null) {
    if (typeof m[1] === 'string' && m[1].startsWith('http')) {
      fotos.push(m[1]);
      if (primera < 0) primera = m.index;
      ultima = re.lastIndex;
    }
  }
  const quitar = (s: string) => s.replace(/\[\[FOTO\]\]\s*\S+/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!fotos.length) return { gancho: quitar(texto), fotos: [], cta: '' };
  return {
    gancho: quitar(texto.slice(0, primera)),
    fotos:  [...new Set(fotos)].slice(0, 8),
    cta:    quitar(texto.slice(ultima)),
  };
}

/**
 * FRENO ANTI-SPAM: no reenviar una foto que ya se le mandó al cliente en las
 * últimas horas. Evita que el bot repita el catálogo una y otra vez (daña la
 * venta). Si ya se enviaron, el bot debe preguntar el color en vez de reenviar.
 */
async function fotosNuevas(supabase: any, from: string, urls: string[]): Promise<string[]> {
  if (!urls.length) return [];
  try {
    const desde = new Date(Date.now() - 6 * 3_600_000).toISOString(); // 6 horas
    const { data } = await supabase.from('messages')
      .select('content').eq('conversation_id', from)
      .eq('type', 'image').eq('role', 'assistant')
      .gte('created_at', desde);
    const yaEnviadas = new Set((data ?? []).map((m: any) => String(m.content)));
    return urls.filter(u => !yaEnviadas.has(u));
  } catch { return urls; }
}

/**
 * Guarda el pedido y lo PASA AL CHAT DE VENTA (operación) con la foto.
 * El cliente ya recibió su confirmación escrita por la propia asesora, así que
 * aquí no se le vuelve a escribir: solo se registra y se despacha internamente.
 */
/**
 * Foto del COLOR pedido (no la última que se haya mandado, que puede ser de otro
 * color que el cliente miró antes). Busca en catalogo_colores por color + familia.
 * Si no la encuentra, devuelve null para caer a la última imagen enviada.
 */
async function fotoDelColor(supabase: any, color: string, familia: string): Promise<string | null> {
  const colorU = String(color ?? '').toUpperCase().trim();
  if (!colorU) return null;
  try {
    const { data } = await supabase.from('catalogo_colores')
      .select('color, nombre_producto, url_imagen').not('url_imagen', 'is', null);
    if (!data?.length) return null;
    const colWords = colorU.split(/\s+/).filter((w: string) => w.length >= 3);
    const famWords = String(familia ?? '').toUpperCase().split(/\s+/).filter((w: string) => w.length >= 3);
    let best: any = null; let bestScore = -1;
    for (const r of data) {
      const nU = String(r.nombre_producto ?? '').toUpperCase();
      const cU = String(r.color ?? '').toUpperCase();
      const coincideColor = cU === colorU || colWords.some((w: string) => cU.includes(w) || nU.includes(w));
      if (!coincideColor) continue;
      const score = famWords.filter((w: string) => nU.includes(w)).length;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return best?.url_imagen?.startsWith('http') ? best.url_imagen : null;
  } catch { return null; }
}

/**
 * Foto para la ficha de la venta. Si el pedido es un PACK de 2 colores
 * (ej. color = "Azul Rey + Negro"), arma un COLLAGE con la foto de cada color.
 * Si es un solo color, devuelve la foto de ese color. Puede devolver null.
 */
async function fotoDeVenta(supabase: any, color: string, producto: string): Promise<string | null> {
  const colores = String(color ?? '')
    .split(/\s*(?:\+|,| y | e )\s*/i)
    .map(c => c.trim())
    .filter(Boolean);

  // Pack: 2+ colores → una foto por color y se unen en un collage
  if (colores.length >= 2) {
    const fotos: string[] = [];
    for (const c of colores.slice(0, 3)) {
      const f = await fotoDelColor(supabase, c, producto);
      if (f && f.startsWith('http') && !fotos.includes(f)) fotos.push(f);
    }
    if (fotos.length >= 2) {
      const productos = colores.map(c => `${c} ${producto}`.trim());
      const collage = await generarCollagePack(supabase, productos, fotos);
      if (collage) return collage;
    }
    if (fotos.length >= 1) return fotos[0]; // al menos una foto real
  }

  // Un solo color
  return await fotoDelColor(supabase, colores[0] ?? color, producto);
}

async function guardarYPasarPedido(supabase: any, from: string, datos: any): Promise<boolean> {
  try {
    const tel10 = String(datos.telefono ?? '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
    const valor = Number(datos.precio ?? 0);
    const producto = `${String(datos.producto ?? '').trim()}${datos.color ? ` - ${String(datos.color).trim()}` : ''}`;
    const direccion = [datos.direccion, datos.barrio].map((x: any) => String(x ?? '').trim()).filter(Boolean).join(', ');
    const nombre = [datos.nombre, datos.apellidos].map((x: any) => String(x ?? '').trim()).filter(Boolean).join(' ');

    // ── Recoge en oficina + abono ────────────────────────────────────────────
    const esOficina = datos.oficina === true || /oficina|interrapid|recoge|reclam/i.test(direccion);
    const abono = Number(datos.abono ?? 0) || (esOficina ? 5000 : 0);
    const restante = Math.max(0, valor - abono);

    // ── DEDUPE: ¿ya hay un pedido reciente de este teléfono? ─────────────────
    // Evita que un [[PEDIDO]] repetido cree dos ventas y mande dos fichas.
    const hace = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: reciente } = await supabase.from('clientes_funnelish')
      .select('id')
      .eq('telefono', tel10)
      .not('estado', 'in', '("cancelado","duplicado")')
      .gte('created_at', hace)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    // Foto del pedido (collage si es pack de 2 colores; si no, la foto del color).
    let foto: string | null = await fotoDeVenta(supabase, String(datos.color ?? ''), String(datos.producto ?? ''));
    if (!foto) {
      try {
        const { data: imgs } = await supabase.from('messages')
          .select('content').eq('conversation_id', from)
          .eq('type', 'image').eq('role', 'assistant')
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (imgs?.content?.startsWith('http')) foto = imgs.content;
      } catch { /* si no hay foto, se manda solo el texto */ }
    }

    const camposPedido = {
      nombre, telefono: tel10, direccion,
      ciudad:       String(datos.municipio ?? '').trim(),
      departamento: String(datos.departamento ?? '').trim(),
      correo:       String(datos.correo ?? '').trim(),
      talla:        String(datos.talla ?? '').trim(),
      producto,
      valor:        valor ? `$${valor.toLocaleString('es-CO')}` : '',
      abono, abono_recibido: abono > 0,
      confirmado:   true,
      confirmado_at: new Date().toISOString(),
      estado:       'wa_enviado',
      // PERÍODO DE GRACIA (5 min): la ficha la manda el cron, NO se envía al toque.
      // Si el cliente corrige algo (dirección/color/talla) en ese rato, la ficha
      // sale UNA sola vez y ya correcta (evita fichas repetidas).
      registro_at:      new Date().toISOString(),
      registro_enviado: false,
      foto_producto:    foto && foto.startsWith('http') ? foto : null,
    };

    if (reciente?.id) {
      // Ya existe: se ACTUALIZA (no se crea otra venta). Reinicia el período de gracia.
      await supabase.from('clientes_funnelish').update(camposPedido).eq('id', reciente.id);
      console.log(`[Ventas] pedido duplicado evitado tel=${tel10}`);
      return true;
    }

    // Queda registrado como pedido nuevo. La ficha la enviará el cron tras la gracia.
    const { error } = await supabase.from('clientes_funnelish').insert({
      ...camposPedido,
      referencia:   `venta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at:   new Date().toISOString(),
    });
    if (error) console.error('[Ventas] no se pudo guardar el pedido:', error.message);

    return true;
  } catch (e) {
    console.error('[Ventas] error pasando el pedido:', e);
    return false;
  }
}

/**
 * Envío REAL de la ficha de VENTA (CHAT WHATSAPP) — la llama el cron tras el
 * período de gracia. Se construye desde el pedido ya guardado.
 */
export async function mandarFichaVentaWA(supabase: any, pedido: any, destinos?: string[]) {
  const receptores = (destinos && destinos.length) ? destinos : DESTINOS_VENTA;
  const valorNum = Number(String(pedido.valor ?? '').replace(/[^\d]/g, '')) || 0;
  const abono = Number(pedido.abono ?? 0);
  const restante = Math.max(0, valorNum - abono);
  const esOficina = abono > 0 || /oficina|interrapid|recoge|reclam/i.test(String(pedido.direccion ?? ''));
  const cobro = esOficina && abono > 0
    ? `Total: $${valorNum.toLocaleString('es-CO')}\n` +
      `💵 Abono: $${abono.toLocaleString('es-CO')} ${pedido.abono_recibido ? '✅ recibido' : '⏳ pendiente'}\n` +
      `*A COBRAR AL RECOGER: $${restante.toLocaleString('es-CO')}* — 📍 RECOGE EN OFICINA Interrapidísimo`
    : `Valor: ${pedido.valor || '—'} — PAGO CONTRA ENTREGA`;
  const ficha =
    `💬 *VENTA CONFIRMADA — CHAT WHATSAPP*\n` +
    `Nombre: ${pedido.nombre || '—'}\n` +
    `Teléfono: ${pedido.telefono || '—'}\n` +
    `Dirección: ${pedido.direccion || '—'}\n` +
    `Ciudad: ${pedido.ciudad || '—'}\n` +
    `Departamento: ${pedido.departamento || '—'}\n` +
    (pedido.correo ? `Correo: ${pedido.correo}\n` : '') +
    `${lineaTalla(pedido.talla)}\n` +
    `Producto: ${pedido.producto || '—'}\n` +
    cobro;

  let foto = String(pedido.foto_producto ?? '').trim();
  if (!foto.startsWith('http')) {
    const from = `57${String(pedido.telefono ?? '').replace(/^57/, '').slice(-10)}`;
    try {
      const { data: img } = await supabase.from('messages')
        .select('content').eq('conversation_id', from)
        .eq('type', 'image').eq('role', 'assistant')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (img?.content?.startsWith('http')) foto = img.content;
    } catch { /* ignorar */ }
  }
  for (const destino of receptores) {
    try {
      if (foto.startsWith('http')) await sendImageByUrl(destino, foto, ficha);
      else                          await sendTextMessage(destino, ficha);
    } catch { /* no bloquear */ }
  }
}

/** Actualiza el pedido ya tomado y avisa el cambio al chat de venta (solo si cambió). */
async function actualizarYAvisarCambio(supabase: any, from: string, datos: any): Promise<boolean> {
  try {
    const tel10 = String(datos.telefono ?? '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
    const valor = Number(datos.precio ?? 0);
    const producto = `${String(datos.producto ?? '').trim()}${datos.color ? ` - ${String(datos.color).trim()}` : ''}`;
    const direccion = [datos.direccion, datos.barrio].map((x: any) => String(x ?? '').trim()).filter(Boolean).join(', ');
    const nombre = [datos.nombre, datos.apellidos].map((x: any) => String(x ?? '').trim()).filter(Boolean).join(' ');

    const { data: previo } = await supabase.from('clientes_funnelish')
      .select('id, producto, talla, direccion, ciudad, departamento, registro_enviado')
      .eq('telefono', tel10)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!previo?.id) return false;

    const esOficina = datos.oficina === true || /oficina|interrapid|recoge|reclam/i.test(direccion);
    const abono = Number(datos.abono ?? 0) || (esOficina ? 5000 : 0);
    const restante = Math.max(0, valor - abono);

    // ¿De verdad cambió algo? (compara contra lo que ya está guardado). Si no
    // cambió nada, NO se actualiza ni se avisa — evita fichas "DATOS MODIFICADOS" repetidas.
    const norm = (s: any) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
    const cambios: any = {};
    if (producto && norm(producto) !== norm(previo.producto)) cambios.producto = producto;
    if (String(datos.talla ?? '').trim() && norm(datos.talla) !== norm(previo.talla)) cambios.talla = String(datos.talla).trim();
    if (direccion && norm(direccion) !== norm(previo.direccion)) cambios.direccion = direccion;
    if (String(datos.municipio ?? '').trim() && norm(datos.municipio) !== norm(previo.ciudad)) cambios.ciudad = String(datos.municipio).trim();
    if (String(datos.departamento ?? '').trim() && norm(datos.departamento) !== norm(previo.departamento)) cambios.departamento = String(datos.departamento).trim();
    if (nombre) cambios.nombre = nombre;
    if (valor) { cambios.valor = `$${valor.toLocaleString('es-CO')}`; cambios.abono = abono; cambios.abono_recibido = abono > 0; }
    // Solo el nombre/valor no cuentan como "cambio real" para avisar
    const cambioReal = ['producto', 'talla', 'direccion', 'ciudad', 'departamento'].some(k => k in cambios);
    if (!cambioReal) return true; // nada relevante cambió

    await supabase.from('clientes_funnelish').update(cambios).eq('id', previo.id);

    // Durante el PERÍODO DE GRACIA (ficha aún no enviada) NO se avisa: la ficha
    // final que mande el cron ya saldrá con estos datos corregidos.
    if (!previo.registro_enviado) return true;

    const cobro = esOficina && abono > 0
      ? `Total: $${valor.toLocaleString('es-CO')}\n` +
        `💵 Abono: $${abono.toLocaleString('es-CO')} ✅ recibido\n` +
        `*A COBRAR AL RECOGER: $${restante.toLocaleString('es-CO')}* — 📍 RECOGE EN OFICINA Interrapidísimo`
      : `Valor: ${valor ? `$${valor.toLocaleString('es-CO')}` : '—'} — PAGO CONTRA ENTREGA`;
    const ficha =
      `🟠 *DATOS MODIFICADOS* (pedido de ventas)\n` +
      `_El cliente cambió algo después de confirmar_\n\n` +
      `Nombre: ${nombre || '—'}\n` +
      `Teléfono: ${tel10}\n` +
      `Dirección: ${direccion || '—'}\n` +
      `Ciudad: ${datos.municipio ?? '—'}\n` +
      `Departamento: ${datos.departamento ?? '—'}\n` +
      `Talla: ${datos.talla ?? '—'}\n` +
      `Producto: ${producto}\n` +
      cobro;

    let foto: string | null = await fotoDeVenta(supabase, String(datos.color ?? ''), String(datos.producto ?? ''));
    if (!foto) {
      try {
        const { data: img } = await supabase.from('messages')
          .select('content').eq('conversation_id', from)
          .eq('type', 'image').eq('role', 'assistant')
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (img?.content?.startsWith('http')) foto = img.content;
      } catch { /* sin foto, va solo el texto */ }
    }

    for (const destino of DESTINOS_VENTA) {
      try {
        if (foto) await sendImageByUrl(destino, foto, ficha);
        else      await sendTextMessage(destino, ficha);
      } catch { /* no bloquear */ }
    }
    return true;
  } catch (e) {
    console.error('[Ventas] error actualizando el pedido:', e);
    return false;
  }
}

/**
 * Atiende un lote de mensajes que llegaron al número de VENTAS.
 * Solo se llama cuando el cliente NO tiene un pedido activo (si lo tiene, el
 * flujo normal de confirmación se encarga).
 */
export async function atenderVenta(supabase: any, value: any, contactName: string, baseUrl: URL) {
  const mensajes: any[] = value.messages ?? [];
  if (mensajes.length === 0) return;

  const from  = String(mensajes[0].from);
  const ahora = new Date().toISOString();

  // Upsert de la conversación, marcada como línea de VENTAS
  const { data: conv } = await supabase.from('conversations')
    .select('bot_enabled, unread_count, interaccion_bot').eq('id', from).maybeSingle();
  const ultimoTexto = (() => {
    const ult = mensajes[mensajes.length - 1];
    return ult?.text?.body ?? (ult?.type === 'image' ? '🖼️ Foto' : '📎 Archivo');
  })();
  // Interacción con el bot: el cliente respondió después de que el bot ya escribió.
  let interaccionBotV = false;
  if (conv && !(conv as any).interaccion_bot) {
    try {
      const { data: prevBot } = await supabase.from('messages')
        .select('id').eq('conversation_id', from).in('role', ['assistant', 'agent']).limit(1).maybeSingle();
      if (prevBot) interaccionBotV = true;
    } catch { /* ignorar */ }
  }
  await supabase.from('conversations').upsert({
    id: from,
    contact_name: contactName,
    last_message: String(ultimoTexto).slice(0, 100),
    last_message_time: ahora,
    unread_count: (conv?.unread_count ?? 0) + mensajes.length,
    linea: 'ventas',
    seguimiento_enviado: null, // el cliente volvió a escribir: reinicia el recordatorio
    ...(interaccionBotV ? { interaccion_bot: true } : {}),
  }, { onConflict: 'tenant_id,id' });

  // ── 1) Guardar TODOS los mensajes entrantes primero ──────────────────────
  // Si no, al llegar dos juntos ("hola" + "quiero un buzo de BTS") el bot
  // respondía dos veces: al primero sin contexto y luego al segundo.
  const textos: string[] = [];
  // Fotos que manda el cliente: se guardan también en memoria para que el bot
  // pueda VERLAS (reconocer el modelo, leer un comprobante…)
  const fotosDelCliente: { mimeType: string; base64: string }[] = [];
  // Meta reenvía el mismo mensaje si tardamos en contestarle. El id del mensaje
  // es único, así que si ya está guardado es que YA lo atendimos: no se repite.
  let yaProcesado = false;
  let hayAudio = false;       // el cliente mandó un audio/nota de voz
  let audioTranscrito = false; // se pudo transcribir → el bot lo responde como texto
  const TIPOS_MEDIA = ['image', 'audio', 'video', 'document', 'sticker', 'voice'];
  for (const m of mensajes) {
    if (m.type === 'text') {
      const t = m.text?.body ?? '';
      textos.push(t);
      // Mensaje CITADO: si el cliente responde a una foto/mensaje ("este"), se
      // resuelve para que en el panel se vea a cuál se refiere.
      const replyTo = await resolverCita(supabase, m.context?.id);
      const { error: errGuardar } = await supabase.from('messages').insert({
        id: `in-${m.id}`, conversation_id: from, content: t,
        role: 'user', type: 'text', reply_to: replyTo, whatsapp_id: m.id, created_at: new Date().toISOString(),
      });
      if (errGuardar && (errGuardar.code === '23505' || /duplicate/i.test(errGuardar.message ?? ''))) {
        yaProcesado = true;
      }
    } else if (TIPOS_MEDIA.includes(m.type)) {
      // Igual que el bot del funnel: baja el archivo, lo guarda en storage con
      // la extensión correcta y registra el mensaje AUNQUE la descarga falle.
      const mediaId  = m[m.type]?.id as string | undefined;
      const tipoGuardar = m.type === 'sticker' ? 'image' : (m.type === 'voice' ? 'audio' : m.type);
      const etiquetas: Record<string, string> = {
        image: '🖼️ Foto', audio: '🎵 Audio', voice: '🎵 Audio',
        video: '🎬 Video', document: '📎 Documento', sticker: '🖼️ Sticker',
      };
      const etiqueta = etiquetas[m.type] ?? '📎 Archivo';
      const caption  = (m[m.type]?.caption as string | undefined)?.trim();
      const esAudio  = m.type === 'audio' || m.type === 'voice';
      if (esAudio) {
        // El bot NO puede escuchar audio. No se le pasa al modelo (para que no
        // responda "no puedo reproducir audios"); en su lugar se avisa a soporte.
        hayAudio = true;
        if (caption) textos.push(caption);
      } else {
        textos.push(caption || (m.type === 'image' ? '[el cliente envió una foto]' : `[el cliente envió ${etiqueta}]`));
      }

      let publicUrl: string | null = null;
      if (mediaId) {
        try {
          const media = await descargarWhatsAppMedia(mediaId);
          if (media) {
            const ext = (media.mimeType.split('/')[1] ?? 'bin').split(';')[0].replace('jpeg', 'jpg');
            const ruta = `ventas/${from}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from('chat-media').upload(ruta, media.buffer, { contentType: media.mimeType, upsert: false });
            if (!upErr) {
              const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(ruta);
              publicUrl = pub?.publicUrl ?? null;
            } else console.error('[Ventas] subir archivo entrante:', upErr.message);

            // Si es foto, además se le pasa a la IA para que la vea
            if (m.type === 'image' && fotosDelCliente.length < 3 && media.buffer.length < 4_000_000) {
              const tipo = (media.mimeType || 'image/jpeg').split(';')[0];
              if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(tipo)) {
                fotosDelCliente.push({ mimeType: tipo, base64: media.buffer.toString('base64') });
              }
            }

            // 🎙️ AUDIO: se transcribe la nota de voz para entenderla como texto.
            if (esAudio) {
              const texto = await transcribirAudio(media.buffer, media.mimeType);
              if (texto) {
                textos.push(texto);
                audioTranscrito = true;
                // Guardar la transcripción como texto en el historial del panel.
                await supabase.from('messages').upsert({
                  id: `in-${m.id}-txt`, conversation_id: from, content: `🎙️ ${texto}`,
                  role: 'user', type: 'text', created_at: new Date(Date.now() + 1).toISOString(),
                }, { onConflict: 'id' });
              }
            }
          }
        } catch (e) { console.error('[Ventas] error guardando archivo entrante:', e); }
      }

      // El mensaje SIEMPRE queda registrado (con foto si se pudo, o su etiqueta)
      const replyToMedia = await resolverCita(supabase, m.context?.id);
      await supabase.from('messages').upsert({
        id: `in-${m.id}`, conversation_id: from,
        content: publicUrl ?? etiqueta,
        role: 'user', type: publicUrl ? tipoGuardar : 'text',
        reply_to: replyToMedia, whatsapp_id: m.id, created_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      // Si la foto venía con texto ("este en talla L"), se guarda TAMBIÉN como
      // texto para que quede en el historial y el bot no pierda el hilo.
      if (m.type === 'image' && caption) {
        await supabase.from('messages').upsert({
          id: `in-${m.id}-cap`, conversation_id: from, content: caption,
          role: 'user', type: 'text', created_at: new Date(Date.now() + 1).toISOString(),
        }, { onConflict: 'id' });
      }
    } else {
      textos.push('[el cliente envió un mensaje]');
    }
  }

  // ── 2) Responder UNA sola vez, al último mensaje del lote ─────────────────
  {
    if (yaProcesado) {
      console.log('[Ventas] mensaje repetido de Meta — ya se había atendido');
      return;
    }

    const msg = mensajes[mensajes.length - 1];
    const texto = textos.join('\n').trim();

    // ── Audio del cliente → avisar a soporte (no responder con el mensaje de "no
    //    puedo reproducir audios"). Lilibeth/soporte entra a escucharlo. ─────────
    // Solo si el audio NO se pudo transcribir se avisa a soporte (fallback).
    if (hayAudio && !audioTranscrito) {
      const nombreCli = conv?.contact_name || from.replace(/^57/, '');
      const avisoAudio =
        `🎧 *Audio en Chat Ventas*\n` +
        `El cliente *${nombreCli}* (${from.replace(/^57/, '')}) envió un audio que no se pudo transcribir.\n` +
        `Ingresa a QuinChat para escucharlo y continuar la venta. 🙌`;
      for (const soporte of ['573167648391', '573187051499']) {
        try { await sendTextMessage(soporte, avisoAudio); } catch { /* ignorar */ }
      }
      // Si SOLO mandó audio (sin texto) y no se transcribió, el bot no responde.
      if (!texto) return;
    }

    // Si el bot está apagado en este chat, no responde (lo atiende un humano)
    const botOn = conv ? (conv.bot_enabled ?? true) : true;
    if (!botOn) return;

    try { await mostrarEscribiendo(msg.id); } catch { /* ignorar */ }

    // ── Esperar a que el cliente termine de escribir ─────────────────────────
    // La gente manda varios mensajes cortos seguidos. Se esperan 7 segundos y,
    // si llegó otro después, este se descarta: contesta el último, ya completo.
    await new Promise(r => setTimeout(r, 7000));
    const { data: ultimoDelCliente } = await supabase.from('messages')
      .select('id').eq('conversation_id', from).eq('role', 'user')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (ultimoDelCliente && ultimoDelCliente.id !== `in-${msg.id}`) return;

    // Historial reciente para darle contexto al modelo. 18 mensajes son
    // suficientes para no perder el hilo y cuestan mucho menos que 40.
    const { data: hist } = await supabase.from('messages')
      .select('role, content, type')
      .eq('conversation_id', from).order('created_at', { ascending: false }).limit(18);
    const historial = normalizarHistorial(
      (hist ?? []).reverse()
        .map((m: any) => {
          // El AUDIO se ignora en el historial: su transcripción ya entra como
          // texto (mensaje que empieza con 🎙️). Si lo dejáramos, el bot creería
          // que "no puede escuchar" y respondería mal.
          if (m.type === 'audio') return { role: m.role, content: '' };
          // Las fotos entran al historial como una nota, para que el bot sepa
          // que el cliente/asesora mandó una imagen y no pierda el contexto.
          if (m.type === 'image') {
            return { role: m.role, content: m.role === 'user' ? '[el cliente envió una foto]' : '[envié una foto del producto]' };
          }
          return { role: m.role, content: m.content };
        })
        .filter((m: any) => m.content),
    );

    const [catalogo, memoria, negocio, comportamiento] = await Promise.all([
      catalogoDeVenta(supabase),
      bloqueDeMemoria(),
      cargarPromptEmpresa(supabase),      // negocio del tenant: marca, precios, pagos, envíos
      cargarComportamiento(supabase),     // cómo vende y cierra (capa genérica editable)
    ]);

    // ── ¿De qué anuncio llegó? ───────────────────────────────────────────────
    // Meta pega el anuncio (referral) al PRIMER mensaje del lote, no al último.
    // Se busca en TODOS los mensajes para no quedar ciego al origen.
    const referral = mensajes.map((m: any) => m.referral).find(Boolean);
    // Diagnóstico: deja en el log TODO lo que Meta mandó del anuncio (o si no vino)
    console.log(`[Ventas] referral de ${from}:`, referral ? JSON.stringify(referral) : 'NINGUNO (Meta no mandó datos de anuncio)');
    let anuncio = '';
    if (referral) {
      // Si el ID del anuncio está mapeado a un producto, se usa eso (100% seguro)
      const idAnuncio = String(referral.source_id ?? '').trim();
      let productoDelAnuncio = '';
      if (idAnuncio) {
        const tieneId = (campo: any) =>
          String(campo ?? '').split(/[,\s]+/).map((x: string) => x.trim()).filter(Boolean).includes(idAnuncio);
        try {
          // Busca el ID en los embudos y en los catálogos (España, Ferrari…)
          const [{ data: fs }, { data: cs }] = await Promise.all([
            supabase.from('funnels').select('producto, anuncios').not('anuncios', 'is', null),
            supabase.from('catalogos_bot').select('familia, anuncios').not('anuncios', 'is', null),
          ]);
          const mF = (fs ?? []).find((f: any) => tieneId(f.anuncios));
          const mC = (cs ?? []).find((c: any) => tieneId(c.anuncios));
          const nombre = mF?.producto ?? mC?.familia;
          if (nombre) productoDelAnuncio = `⭐ PRODUCTO EXACTO DE ESTE ANUNCIO: ${nombre}. Háblale de ESE producto.`;
        } catch { /* si falla, se usa el texto del anuncio */ }
      }
      const partes = [
        productoDelAnuncio,
        referral.headline    ? `Título del anuncio: ${referral.headline}` : '',
        referral.body        ? `Texto del anuncio: ${referral.body}` : '',
        referral.source_url  ? `Página del anuncio: ${referral.source_url}` : '',
        idAnuncio            ? `ID del anuncio: ${idAnuncio}` : '',
      ].filter(Boolean);
      anuncio = partes.join('\n');
      // Guardar el ID del anuncio en el chat (para el reporte de campañas)
      try {
        const cambios: Record<string, unknown> = {};
        if (anuncio)   cambios.anuncio_origen = anuncio;
        if (idAnuncio) cambios.anuncio_id = idAnuncio;
        if (Object.keys(cambios).length) await supabase.from('conversations').update(cambios).eq('id', from);
      } catch { /* si no existen las columnas, no pasa nada */ }
    }
    if (!anuncio) {
      const { data: convAd } = await supabase.from('conversations')
        .select('anuncio_origen').eq('id', from).maybeSingle();
      anuncio = convAd?.anuncio_origen ?? '';
    }

    // ¿Ya le tomamos pedido a este cliente? (para no tomarlo dos veces)
    let pedidoPrevio = '';
    try {
      const telP = from.replace(/^57/, '').slice(-10);
      const { data: pp } = await supabase.from('clientes_funnelish')
        .select('producto, talla, valor, direccion, ciudad').eq('telefono', telP)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (pp) pedidoPrevio = `Producto: ${pp.producto} · Talla: ${pp.talla} · Valor: ${pp.valor} · ${pp.direccion}, ${pp.ciudad}`;
    } catch { /* si falla, se sigue sin ese dato */ }

    // ¿Este cliente tiene una promo de cierre vigente (últimas 24h)? Si sí, el bot
    // debe aplicarle los $10.000 de descuento al cotizar.
    let promoActiva = false;
    try {
      const { data: cp } = await supabase.from('conversations')
        .select('promo_cierre_at').eq('id', from).maybeSingle();
      if (cp?.promo_cierre_at) {
        promoActiva = (Date.now() - new Date(cp.promo_cierre_at).getTime()) < 24 * 3_600_000;
      }
    } catch { /* si no existe la columna, sin promo */ }

    let respuesta = '';
    const pedirRespuesta = () => chat({
      messages: historial.length ? historial : [{ role: 'user', content: texto }],
      systemPrompt: promptVentas(negocio, comportamiento, catalogo, memoria),
      systemDynamic: contextoVentas(anuncio, pedidoPrevio, promoActiva),
      maxTokens: 700,
      imagenes: fotosDelCliente,
    });
    try {
      respuesta = (await pedirRespuesta()).message ?? '';
    } catch (e1) {
      console.warn('[Ventas] falló el modelo, reintentando…', e1);
      try {
        await new Promise(r => setTimeout(r, 1200));
        respuesta = (await pedirRespuesta()).message ?? '';
      } catch (e2) {
        // Si de verdad no se puede, mejor callar y pasar a un humano que
        // mandarle al cliente un mensaje raro sin sentido.
        console.error('[Ventas] el modelo falló dos veces:', e2);
        await marcarHumano(supabase, from, contactName);
        return;
      }
    }

    // ¿El cliente cambió algo de un pedido ya tomado?
    const mCambio = respuesta.match(/\[\[ACTUALIZAR\]\]\s*(\{[\s\S]*?\})/);
    if (mCambio) {
      try { await actualizarYAvisarCambio(supabase, from, JSON.parse(mCambio[1])); } catch { /* ignorar */ }
      const { limpio, fotos } = separarFotos(respuesta.replace(/\[\[ACTUALIZAR\]\][\s\S]*$/, ''));
      for (const url of await fotosNuevas(supabase, from, fotos)) { try { await enviarFoto(supabase, from, url); } catch { /* seguir */ } }
      if (limpio) await responder(supabase, from, limpio);
      return;
    }

    // ¿El cliente mandó la cédula para un crédito? → avisar a soporte
    const mCredito = respuesta.match(/\[\[CREDITO\]\]\s*(\{[\s\S]*?\})/);
    if (mCredito) {
      let cedula = ''; let plataforma = '';
      try { const c = JSON.parse(mCredito[1]); cedula = String(c.cedula ?? '').trim(); plataforma = String(c.plataforma ?? '').trim().toLowerCase(); } catch { /* ignorar */ }
      const tel = from.replace(/^57/, '');
      const nombreCli = contactName || tel;
      const plat = plataforma === 'addi' ? 'Addi'
                 : plataforma === 'sistecredito' ? 'Sistecredito'
                 : 'Addi o Sistecredito';
      const aviso =
        `💳 *SOLICITUD DE CRÉDITO*\n` +
        `El cliente *${nombreCli}* (${tel}) desea un crédito por *${plat}*.\n` +
        `🪪 Cédula: ${cedula || '—'}\n` +
        `👉 Genérale el link de crédito.`;
      for (const soporte of ['573167648391', '573187051499']) {
        try { await sendTextMessage(soporte, aviso); } catch { /* no bloquear */ }
      }
      // Se quita el bloque técnico y se envía lo visible al cliente
      const { limpio } = separarFotos(respuesta.replace(/\[\[CREDITO\]\][\s\S]*$/, ''));
      if (limpio) await responder(supabase, from, limpio);
      return;
    }

    // ¿El modelo pidió crear el pedido?
    const mPedido = respuesta.match(/\[\[PEDIDO\]\]\s*(\{[\s\S]*?\})/);
    if (mPedido) {
      let ok = false;
      try { ok = await guardarYPasarPedido(supabase, from, JSON.parse(mPedido[1])); } catch { /* ignorar */ }
      // Se quita el bloque técnico (y las etiquetas de foto) del texto visible
      const { limpio: visible } = separarFotos(respuesta.replace(/\[\[PEDIDO\]\][\s\S]*$/, ''));
      if (visible) await responder(supabase, from, visible);

      if (ok) {
        // Marcar el chat como VENTA REALIZADA (conserva otras etiquetas)
        try {
          const { data: c } = await supabase.from('conversations').select('label').eq('id', from).maybeSingle();
          const tags = String(c?.label ?? '').split('|').map(s => s.trim())
            .filter(Boolean).filter(l => !ESTADOS.includes(l.toUpperCase()));
          const nuevo = ['VENTA REALIZADA', ...tags].join(' | ');
          await supabase.from('conversations').update({ label: nuevo }).eq('id', from);
        } catch { /* si falla la etiqueta, la venta igual quedó */ }

        // Mensaje de agradecimiento, APARTE de la ficha del pedido
        await new Promise(r => setTimeout(r, 900));
        await responder(supabase, from,
          '¡Gracias por tu compra! 🎉\n---\nCuando lo envíe te estará llegando el número de guía por este mismo chat, para que le hagas seguimiento a tu paquete 🚚');
      } else {
        await responder(supabase, from, 'Tuve un problemita registrando el pedido, en un momento te ayuda un asesor 😊');
        await marcarHumano(supabase, from, contactName);
      }
      return;
    }

    // ¿El modelo pidió pasar a un humano?
    if (respuesta.includes('[[HUMANO]]')) {
      const { limpio } = separarFotos(respuesta.replace('[[HUMANO]]', ''));
      if (limpio) await responder(supabase, from, limpio);
      await marcarHumano(supabase, from, contactName);
      return;
    }

    // ── Aprender FAQ ──────────────────────────────────────────────────────
    // Si el cliente hizo una PREGUNTA informativa y el bot respondió con texto,
    // se guarda como candidata (pregunta + respuesta) para que la apruebes en
    // el panel. Con el tiempo se arma una base con lo que de verdad preguntan.
    // Nunca bloquea la respuesta al cliente.
    try {
      const { limpio: respVisible } = separarFotos(respuesta);
      await registrarFAQCandidata(supabase, texto, respVisible, from);
    } catch { /* ignorar: aprender FAQ nunca debe frenar la venta */ }

    // ORDEN pedido: GANCHO (texto con el pack x2) → FOTOS → CTA ("Me envías el
    // modelo y color…"). Solo se mandan las fotos que NO se hayan enviado ya
    // (freno anti-repetición del catálogo).
    const { gancho, fotos, cta } = partirGanchoFotosCTA(respuesta);
    if (gancho) await responder(supabase, from, gancho);
    const nuevasFotos = await fotosNuevas(supabase, from, fotos);
    for (const url of nuevasFotos) {
      try { await enviarFoto(supabase, from, url); } catch { /* si una falla, seguir */ }
    }
    if (cta) await responder(supabase, from, cta);
  }
}

async function marcarHumano(supabase: any, from: string, contactName: string) {
  await supabase.from('conversations').update({ bot_enabled: false, label: 'HUMANO' }).eq('id', from);
  const tel = from.replace(/^57/, '');
  const aviso = `🔔 Un cliente de VENTAS necesita un asesor: ${contactName} (${tel}).`;
  // Aviso a soporte + copia a Lilibeth (…499)
  for (const n of [ADMIN_VENTAS_HUMANO, '573187051499']) {
    try { await sendTextMessage(n, aviso); } catch { /* no bloquear */ }
  }
}

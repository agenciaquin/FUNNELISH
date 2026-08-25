// =====================================================
// Pre-filtro del bot (AHORRO DE IA).
// Antes de gastar en la IA, intentamos resolver el mensaje con REGLAS gratis:
//   #3 ignorar "ok/gracias/stickers" y despedidas (no responder de último)
//   #6 bienvenida por anuncio (catálogo + precios) al primer contacto
//      (los disparadores por palabra también se resuelven aquí)
//   #5 responder desde una Pregunta Frecuente aprobada
// Todo es FAIL-OPEN: si algo falla o no aplica, devuelve saltarIA=false y
// el bot responde con IA como siempre.
// =====================================================

import { sendTextMessage, sendImageByUrl } from '@/lib/whatsapp';
import { leerCatalogos } from '@/lib/bloque-catalogos';
import { normalizarPedirDatos } from '@/lib/quinchat/comportamiento';

/** Pausa (ms). Se usa para dar tiempo a que lleguen las fotos ANTES del llamado
 *  a la acción — así el texto no se cuela en medio de las imágenes. */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Espera proporcional a cuántas fotos se enviaron (mín. 2s, ~0.7s por foto, tope 6s). */
const esperaPorFotos = (n: number) => sleep(n > 0 ? Math.min(6000, 2000 + n * 700) : 0);

interface Cond { tipo?: string; valor?: string }
interface Acc { tipo?: string; plantilla_id?: string; valor?: string }

/** minúsculas + sin tildes, para comparar sin importar acentos/mayúsculas. */
function norm(s: string): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Palabras genéricas que NO sirven para identificar un catálogo (aparecen en
// muchos): así "spiderman hombre araña" se identifica por "spiderman/arana",
// no por "hombre". Evita falsos positivos y falsos negativos.
const PALABRAS_GENERICAS = new Set([
  'hombre', 'mujer', 'dama', 'caballero', 'nino', 'nina', 'unisex',
  'talla', 'tallas', 'color', 'colores', 'camiseta', 'camisetas', 'camisa', 'camisas',
  'buzo', 'buzos', 'hoodie', 'hoodies', 'ropa', 'prenda', 'prendas', 'diseno',
  'modelo', 'modelos', 'producto', 'productos', 'oversize', 'estampado', 'estampada',
]);

/** Palabras clave (distintivas) de un catálogo, sacadas de su patrón/familia. */
function palabrasClaveCatalogo(...frases: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const f of frases) {
    for (const w of norm(f ?? '').split(/[^a-z0-9]+/)) {
      if (w.length >= 4 && !PALABRAS_GENERICAS.has(w)) set.add(w);
    }
  }
  return [...set];
}

/** ¿Cuántas palabras clave del catálogo menciona el cliente? (0 = no lo menciona).
 *  Ej: patrón "SPIDERMAN HOMBRE ARAÑA" + cliente "tienes de spiderman" → 1. */
function puntajeMencion(t: string, ...frases: (string | null | undefined)[]): number {
  let n = 0;
  for (const k of palabrasClaveCatalogo(...frases)) if (t.includes(k)) n++;
  return n;
}

/** Registra en el chat lo que el bot envió por regla (para el panel, el historial
 *  y para saber que el bot ya respondió — evita repetir la bienvenida). */
async function registrar(supabase: any, from: string, content: string, tipo: 'text' | 'image' | 'video' | 'audio' = 'text') {
  try {
    const now = new Date().toISOString();
    await supabase.from('messages').insert({
      id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversation_id: from, content, role: 'assistant', type: tipo, created_at: now,
    });
    // Vista previa en la lista: la foto se muestra como "📷 Foto", no la URL cruda.
    const preview = tipo === 'image' ? '📷 Foto' : tipo === 'video' ? '🎬 Video' : tipo === 'audio' ? '🎵 Audio' : content.slice(0, 100);
    await supabase.from('conversations').update({
      last_message: preview, last_message_time: now, unread_count: 0,
    }).eq('id', from);
  } catch { /* no bloquear */ }
}

// ── #3: mensajes que NO ameritan gastar IA ──────────────────────────────────
// Solo acuses y despedidas claros (frase completa). NO incluimos "sí/no" ni
// palabras de producto, para no callar respuestas que sí importan.
const TRIVIAL = /^(ok(is|ay|is)?|oka+y?|dale|listo|vale|bueno|perfecto|de\s*nada|graci(as|a)s?|muchas\s+gracias|gracias\s+(por\s+todo|mil)|👍|👌|🙏|🙌|😊|👏|❤️|🔥)[\s.!]*$/i;
const DESPEDIDA = /\b(chao|chaito|adi[oó]s|hasta\s+(luego|pronto|ma[ñn]ana)|nos\s+vemos|bye|me\s+despido|que\s+est[eé]s\s+bien|feliz\s+(d[ií]a|tarde|noche)|hablamos\s+(luego|despu[eé]s)|gracias\s+por\s+(todo|tu\s+ayuda))\b/i;

// Palabras de "cierre" (gratitud/despedida): casi nunca son una respuesta
// afirmativa a mitad de venta, así que si el mensaje se compone solo de estas +
// acuses suaves, es un mensaje FINAL y el bot no necesita responder de último.
const ACK_SUAVE = new Set([
  'ok', 'oka', 'okay', 'okey', 'oki', 'okis', 'listo', 'lista', 'listoo', 'dale',
  'vale', 'bueno', 'buena', 'perfecto', 'perfecta', 'genial', 'excelente', 'chevere',
  'bacano', 'correcto', 'claro', 'va', 'de', 'una', 'ya', 'eso', 'sisas', 'entonces',
  'muchas', 'mil', 'super', 'muy', 'todo', 'bien', 'que', 'estes', 'este',
]);
const CIERRE_TOK = new Set([
  'gracias', 'graciass', 'bendiciones', 'bendicion', 'feliz', 'dia', 'tarde', 'noche',
  'saludos', 'chao', 'chaito', 'quedo', 'atento', 'atenta', 'pendiente', 'abrazo',
  'dios', 'amable', 'amabilidad', 'lindo', 'linda', 'bonito',
]);
/** ¿El mensaje es solo un cierre (ej. "ok gracias", "muchas gracias feliz tarde")?
 *  Exige al menos una palabra de gratitud/despedida, para NO callar un "sí/dale"
 *  suelto que sí puede ser una respuesta importante a mitad de la venta. */
function soloCierre(t: string): boolean {
  const limpio = norm(t).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!limpio) return false; // solo emojis/símbolos → lo maneja TRIVIAL
  const w = limpio.split(' ');
  if (w.length > 6) return false;
  const todas = w.every(x => ACK_SUAVE.has(x) || CIERRE_TOK.has(x));
  const hayCierre = w.some(x => CIERRE_TOK.has(x));
  return todas && hayCierre;
}

function esIgnorable(texto: string, tipo?: string): boolean {
  if (tipo === 'sticker' || tipo === 'reaction') return true;
  const t = texto.trim();
  if (!t) return false;
  if (TRIVIAL.test(t)) return true;                 // acuse ("gracias", "listo"…)
  if (t.length <= 60 && DESPEDIDA.test(t)) return true; // despedida
  if (t.length <= 60 && soloCierre(t)) return true;     // "ok gracias", "muchas gracias feliz tarde"…
  return false;
}

// ── #6: bienvenida por anuncio ──────────────────────────────────────────────
// Orden de envío: (1) mensaje de bienvenida con precios → (2) fotos → (3) llamado
// a la acción (corto). Si el catálogo usa el entrenamiento, NO manda su mensaje
// de precios: envía fotos + CTA y deja que la IA responda con los precios del
// entrenamiento (saltarIA = false).
async function bienvenidaPorAnuncio(supabase: any, from: string): Promise<{ enviado: boolean; saltarIA: boolean }> {
  try {
    const { data: conv } = await supabase
      .from('conversations').select('origen_anuncio').eq('id', from).maybeSingle();
    if (!conv?.origen_anuncio) return { enviado: false, saltarIA: false };

    // Solo al PRIMER contacto (el bot aún no ha respondido nada).
    const { count } = await supabase
      .from('messages').select('*', { count: 'exact', head: true })
      .eq('conversation_id', from).eq('role', 'assistant');
    if (count && count > 0) return { enviado: false, saltarIA: false };

    // Datos de la campaña de origen: ID del anuncio + su título + su URL. Con
    // cualquiera de ellos intentamos identificar el catálogo correcto.
    let adId = '', titular = '', urlAd = '';
    try {
      const o = JSON.parse(String(conv.origen_anuncio));
      adId    = String(o?.anuncio ?? '').trim();
      titular = String(o?.titular ?? '').trim();
      urlAd   = String(o?.url ?? '').trim();
    } catch { /* origen mal formado */ }
    if (!adId && !titular && !urlAd) return { enviado: false, saltarIA: false };

    const { data: cats } = await supabase
      .from('catalogos_bot')
      .select('id, patron, familia, mensaje_bienvenida, llamado_accion, usar_entrenamiento, anuncios, catalogo_colores(url_imagen)')
      .eq('activo', true);
    const lista = Array.isArray(cats) ? cats : [];

    // 1) Match EXACTO: el ID del anuncio está configurado en el catálogo (campo "anuncios").
    let cat: any = adId
      ? lista.find((c: any) =>
          String(c.anuncios ?? '').split(/[,\s]+/).map((x: string) => x.trim()).filter(Boolean).includes(adId))
      : null;

    // 2) Match por NOMBRE de campaña: el título/URL/ID del anuncio menciona la
    //    familia o el patrón del catálogo (ej. campaña "SPIDERMAN…" → catálogo
    //    "SPIDERMAN HOMBRE ARAÑA"). Así funciona sin vincular el anuncio a mano.
    if (!cat) {
      const textoCampana = norm(`${titular} ${urlAd} ${adId}`);
      let mejor = 0;
      for (const c of lista) {
        const pts = puntajeMencion(textoCampana, c.familia, c.patron);
        if (pts > mejor) { mejor = pts; cat = c; }
      }
    }

    // 3) Último recurso: vino de un anuncio y solo hay UN catálogo activo → ese es.
    if (!cat && lista.length === 1) cat = lista[0];

    if (!cat) return { enviado: false, saltarIA: false };

    const usarEntren = cat.usar_entrenamiento === true;
    const bienvenida = String(cat.mensaje_bienvenida ?? '').trim();
    const cta        = String(cat.llamado_accion ?? '').trim();
    const fotos = (cat.catalogo_colores ?? []).map((v: any) => v.url_imagen).filter(Boolean).slice(0, 8);
    // Si no hay nada que enviar y no delega en el entrenamiento, no hace nada.
    if (!fotos.length && !bienvenida && !cta && !usarEntren) return { enviado: false, saltarIA: false };

    let algoSalio = false;
    // 1) Bienvenida con precios (solo si NO usa el entrenamiento).
    if (!usarEntren && bienvenida) {
      const w = await sendTextMessage(from, bienvenida);
      if (w) { await registrar(supabase, from, bienvenida); algoSalio = true; }
    }
    // 2) Fotos del catálogo.
    for (const url of fotos) { const w = await sendImageByUrl(from, url); if (w) { await registrar(supabase, from, url, 'image'); algoSalio = true; } }
    // 3) Llamado a la acción (corto) — espera a que lleguen las fotos primero,
    //    así el texto queda al FINAL y no en medio de las imágenes.
    if (cta) {
      await esperaPorFotos(fotos.length);
      const w = await sendTextMessage(from, cta);
      if (w) { await registrar(supabase, from, cta); algoSalio = true; }
    }
    if (!algoSalio && !usarEntren) return { enviado: false, saltarIA: false };
    // Con precios propios → 0 IA. Con entrenamiento → deja que la IA cotice.
    return { enviado: true, saltarIA: !usarEntren && !!bienvenida };
  } catch { return { enviado: false, saltarIA: false }; }
}

// ── Bienvenida GENERAL (sin campaña) → menú de categorías reales ─────────────
// Si el chat NO vino de una campaña (o su anuncio no tiene catálogo asignado),
// en el PRIMER contacto el bot no debe soltar un saludo genérico: debe mostrar
// las categorías reales que hay en Catálogos y preguntar cuál quiere ver. A
// partir de ahí, cuando el cliente elija una, el marcador [[FOTOS: ...]] envía
// las fotos. Solo se dispara si NADA específico coincidió (no hay palabra clave
// de un catálogo puntual) — de eso se encarga quien la llama.
async function bienvenidaGeneral(supabase: any, from: string): Promise<{ enviado: boolean; saltarIA: boolean }> {
  try {
    // Solo en el PRIMER contacto (el bot aún no ha respondido nada en el chat).
    const { count } = await supabase
      .from('messages').select('*', { count: 'exact', head: true })
      .eq('conversation_id', from).eq('role', 'assistant');
    if (count && count > 0) return { enviado: false, saltarIA: false };

    // Categorías reales del tenant (de la tabla de catálogos).
    const cats = await leerCatalogos(supabase);
    const nombres = cats.map(c => c.familia).filter(Boolean).slice(0, 12);
    if (nombres.length === 0) return { enviado: false, saltarIA: false };

    const lista = nombres.map(n => `• ${n}`).join('\n');
    const mensaje =
      `¡Hola! 👋 Bienvenido/a. Con gusto te ayudo.\n\n` +
      `Estas son nuestras categorías disponibles:\n${lista}\n\n` +
      `¿Cuál te gustaría ver? Dime el nombre y te envío las fotos 📸`;

    const w = await sendTextMessage(from, mensaje);
    if (w) {
      await registrar(supabase, from, mensaje);
      // Ya lo orientamos con el menú: no hace falta gastar IA en este turno.
      return { enviado: true, saltarIA: true };
    }
    return { enviado: false, saltarIA: false };
  } catch { return { enviado: false, saltarIA: false }; }
}

// ── Disparadores por palabra (regla → plantilla) ────────────────────────────
async function disparadoresPorPalabra(supabase: any, from: string, t: string): Promise<{ manejado: boolean; saltarIA: boolean }> {
  try {
    const { data: disps } = await supabase.from('disparadores').select('*').eq('activo', true);
    if (!Array.isArray(disps) || disps.length === 0) return { manejado: false, saltarIA: false };

    for (const d of disps) {
      const conds: Cond[] = Array.isArray(d.condiciones) ? d.condiciones : [];
      const palabras = conds.filter(c => c?.tipo === 'palabras' && c?.valor);
      if (palabras.length === 0) continue;
      const coincide = palabras.some(c =>
        norm(c.valor!).split(/[,\n;|]+/).map(k => k.trim()).filter(Boolean).some(kw => t.includes(kw)),
      );
      if (!coincide) continue;

      const accs: Acc[] = Array.isArray(d.acciones) ? d.acciones : [];
      let hizoAlgo = false;
      for (const a of accs) {
        if (a?.tipo !== 'enviar_plantilla' || !a?.plantilla_id) continue;
        const { data: pl } = await supabase
          .from('plantillas').select('tipo, contenido, imagen_url').eq('id', a.plantilla_id).maybeSingle();
        if (!pl) continue;
        const conTexto = pl.tipo !== 'imagen' && pl.contenido;
        const conImagen = pl.tipo !== 'texto' && pl.imagen_url;
        if (conImagen) await sendImageByUrl(from, pl.imagen_url, conTexto ? pl.contenido : undefined);
        else if (conTexto) await sendTextMessage(from, pl.contenido);
        if (conTexto) await registrar(supabase, from, pl.contenido);
        hizoAlgo = true;
      }
      if (hizoAlgo) return { manejado: true, saltarIA: d.enviar_asistente === false };
    }
    return { manejado: false, saltarIA: false };
  } catch { return { manejado: false, saltarIA: false }; }
}

// ── #5: responder desde una FAQ aprobada ────────────────────────────────────
async function faqAprobada(supabase: any, from: string, t: string): Promise<boolean> {
  try {
    const { data: faqs } = await supabase
      .from('faq_bot').select('pregunta, respuesta').eq('estado', 'aprobada').limit(200);
    if (!Array.isArray(faqs) || faqs.length === 0) return false;

    // Coincidencia conservadora: TODAS las palabras clave (≥4 letras) de la
    // pregunta guardada deben estar en el mensaje del cliente. Evita respuestas
    // equivocadas.
    for (const f of faqs) {
      const claves = norm(f.pregunta).split(/\s+/).filter(w => w.length >= 4);
      if (claves.length < 2) continue;
      if (claves.every(w => t.includes(w)) && f.respuesta) {
        await sendTextMessage(from, f.respuesta);
        await registrar(supabase, from, f.respuesta);
        return true;
      }
    }
    return false;
  } catch { return false; }
}

// ── Catálogo por patrón (marca/modelo) → fotos + precios, SIN IA ─────────────
// Cuando el cliente menciona el patrón del catálogo (ej. "yamaha"), el bot manda
// sus fotos + el mensaje de bienvenida con precios. SOLO la PRIMERA vez que se
// dispara ese catálogo en el chat (no cada vez que lo repita). Funciona con
// cualquier catálogo, sin configurar nada extra: basta con crear el catálogo.
async function catalogoPorPatron(supabase: any, from: string, t: string): Promise<{ manejado: boolean; saltarIA: boolean }> {
  try {
    const { data: cats } = await supabase
      .from('catalogos_bot')
      .select('id, patron, familia, mensaje_bienvenida, llamado_accion, usar_entrenamiento, catalogo_colores(url_imagen)')
      .eq('activo', true);
    if (!Array.isArray(cats) || cats.length === 0) return { manejado: false, saltarIA: false };

    // Se elige el catálogo que MÁS palabras clave comparte con el mensaje del
    // cliente. Ej: patrón "SPIDERMAN HOMBRE ARAÑA" con "tienes de spiderman" →
    // coincide por "spiderman" (antes exigía la frase completa y nunca pegaba).
    let cat: any = null; let mejor = 0;
    for (const c of cats) {
      // Compat: si el patrón cabe entero en el texto, cuenta como coincidencia fuerte.
      const p = norm(c.patron ?? '');
      const exacto = p && t.includes(p) ? 2 : 0;
      const pts = puntajeMencion(t, c.patron, c.familia) + exacto;
      if (pts > mejor) { mejor = pts; cat = c; }
    }
    if (!cat || mejor === 0) return { manejado: false, saltarIA: false };

    const usarEntren = cat.usar_entrenamiento === true;
    const fotos = (cat.catalogo_colores ?? []).map((v: any) => v.url_imagen).filter(Boolean).slice(0, 8);
    const bienvenida = String(cat.mensaje_bienvenida ?? '').trim();
    const cta = String(cat.llamado_accion ?? '').trim();
    if (!fotos.length && !bienvenida && !cta && !usarEntren) return { manejado: false, saltarIA: false };

    // Solo la PRIMERA vez que este catálogo se dispara en el chat.
    const { data: conv } = await supabase.from('conversations').select('catalogos_enviados').eq('id', from).maybeSingle();
    const enviados: string[] = Array.isArray(conv?.catalogos_enviados) ? conv.catalogos_enviados : [];
    if (enviados.includes(cat.id)) return { manejado: false, saltarIA: false };

    // Orden: (1) bienvenida con precios → (2) fotos → (3) llamado a la acción.
    // IMPORTANTE: el catálogo se marca como "ya enviado" SOLO si de verdad salió
    // algo (sendTextMessage/sendImageByUrl devuelven el wamid cuando Meta lo
    // aceptó). Si falla (ej. token vencido), NO se marca → se reintenta luego.
    let algoSalio = false;
    // 1) Bienvenida con precios (solo si el catálogo NO usa el entrenamiento).
    if (!usarEntren && bienvenida) {
      const w = await sendTextMessage(from, bienvenida);
      if (w) { await registrar(supabase, from, bienvenida); algoSalio = true; }
    }
    // 2) Fotos (se guardan en el historial para que también se vean en el panel).
    for (const url of fotos) {
      const w = await sendImageByUrl(from, url);
      if (w) { await registrar(supabase, from, url, 'image'); algoSalio = true; }
    }
    // 3) Llamado a la acción (corto) — espera a que lleguen las fotos primero,
    //    así el texto queda al FINAL y no en medio de las imágenes.
    if (cta) {
      await esperaPorFotos(fotos.length);
      const w = await sendTextMessage(from, cta);
      if (w) { await registrar(supabase, from, cta); algoSalio = true; }
    }

    // No salió nada (y no delega en el entrenamiento) → no marcar, reintentar luego.
    if (!algoSalio && !usarEntren) return { manejado: false, saltarIA: false };

    // Ya salió → marcar el catálogo como enviado en este chat (no repetirlo).
    await supabase.from('conversations').update({ catalogos_enviados: [...enviados, cat.id] }).eq('id', from);

    // Con precios propios → 0 IA. Con entrenamiento (o solo fotos sin texto) →
    // deja que la IA responda con los precios del entrenamiento.
    return { manejado: true, saltarIA: !usarEntren && !!bienvenida };
  } catch {
    return { manejado: false, saltarIA: false };
  }
}

// ── Enviar fotos de un catálogo BAJO DEMANDA (lo pide la IA) ─────────────────
// Cuando el cliente pide ver un producto ("mándame fotos", "cómo es",
// "muéstramelo") la IA cierra su mensaje con un marcador [[FOTOS: NOMBRE]] y
// aquí buscamos ese catálogo por nombre y ENVIAMOS sus fotos de verdad. A
// diferencia de catalogoPorPatron, esto NO exige que sea la 1ª vez ni depende
// de palabras clave del cliente: la IA ya decidió que hay que mostrar fotos, y
// puede repetirse si el cliente pide otra categoría más adelante.
async function enviarFotosDeCatalogo(supabase: any, from: string, nombre: string): Promise<number> {
  try {
    const objetivo = norm(nombre);
    if (!objetivo) return 0;
    const { data: cats } = await supabase
      .from('catalogos_bot')
      .select('id, patron, familia, catalogo_colores(url_imagen, nombre_producto, color)')
      .eq('activo', true);
    if (!Array.isArray(cats) || cats.length === 0) return 0;

    // Elegimos el catálogo cuyo nombre/familia/patrón MEJOR encaja con lo que
    // pidió la IA. Se premia: inclusión directa del nombre (más fuerte) y
    // cantidad de palabras clave compartidas.
    let cat: any = null; let mejor = 0;
    for (const c of cats) {
      const fam = norm(c.familia ?? '');
      const pat = norm(c.patron ?? '');
      let pts = 0;
      if (fam && (objetivo.includes(fam) || fam.includes(objetivo))) pts += 3;
      if (pat && (objetivo.includes(pat) || pat.includes(objetivo))) pts += 3;
      pts += puntajeMencion(objetivo, c.familia, c.patron);
      // También revisamos los nombres de producto reales de la categoría.
      for (const col of (c.catalogo_colores ?? [])) {
        const np = norm(col?.nombre_producto ?? '');
        if (np && (objetivo.includes(np) || np.includes(objetivo))) { pts += 2; break; }
      }
      if (pts > mejor) { mejor = pts; cat = c; }
    }
    if (!cat || mejor === 0) return 0;

    const colores = (cat.catalogo_colores ?? []).filter((c: any) => c?.url_imagen);
    if (!colores.length) return 0;

    // ── ¿Pidió un COLOR específico de este catálogo? ──────────────────────────
    // Si el marcador incluye el nombre de un color que existe en la categoría
    // (ej. "NEGRO SPIDERMAN" → color "NEGRO"), se envía SOLO la foto de ese color
    // (o colores), aunque el catálogo completo ya se haya mostrado antes. Es una
    // imagen puntual que el cliente pidió, NO una repetición del catálogo.
    const especificos = colores.filter((col: any) => {
      const cU = norm(col.color ?? '');
      return cU.length >= 3 && objetivo.includes(cU);
    });

    if (especificos.length > 0 && especificos.length < colores.length) {
      let enviadas = 0;
      const vistas = new Set<string>();
      for (const col of especificos.slice(0, 3)) {
        if (vistas.has(col.url_imagen)) continue;
        vistas.add(col.url_imagen);
        const w = await sendImageByUrl(from, col.url_imagen);
        if (w) { await registrar(supabase, from, col.url_imagen, 'image'); enviadas++; }
      }
      return enviadas;
    }

    // ── CATÁLOGO COMPLETO: anti-duplicado (una sola vez por chat) ─────────────
    // Si las fotos de ESTE catálogo ya se enviaron en el chat (por la bienvenida/
    // patrón o por un marcador anterior), NO se reenvían. Así el bot NO vuelve a
    // soltar todo el catálogo. Usa el mismo registro que catalogoPorPatron.
    const { data: conv } = await supabase.from('conversations').select('catalogos_enviados').eq('id', from).maybeSingle();
    const enviados: string[] = Array.isArray(conv?.catalogos_enviados) ? conv.catalogos_enviados : [];
    if (enviados.includes(cat.id)) return 0;

    const fotos = colores.map((v: any) => v.url_imagen).slice(0, 8);
    let enviadas = 0;
    for (const url of fotos) {
      const w = await sendImageByUrl(from, url);
      if (w) { await registrar(supabase, from, url, 'image'); enviadas++; }
    }
    // Marcar el catálogo como ya mostrado en este chat (no repetirlo luego).
    if (enviadas > 0) {
      try { await supabase.from('conversations').update({ catalogos_enviados: [...enviados, cat.id] }).eq('id', from); } catch { /* no bloquear */ }
    }
    return enviadas;
  } catch { return 0; }
}

/**
 * Procesa el texto de la IA buscando marcadores [[FOTOS: NOMBRE]] (o
 * [[FOTO: NOMBRE]]). Por cada uno, ENVÍA las fotos reales de ese catálogo al
 * cliente y quita el marcador del texto. Devuelve el texto ya limpio (listo
 * para enviarse como mensaje). Si no hay marcadores, devuelve el texto igual.
 *
 * Se llama DESPUÉS de aplicarMarcadores en cada respuesta de la IA al cliente.
 */
export async function procesarMarcadorFotos(supabase: any, from: string, texto: string): Promise<string> {
  try {
    // Red de seguridad: si el mensaje está pidiendo los datos del cliente sin el
    // bloque completo, se reemplaza por el bloque exacto (aplica a TODO mensaje,
    // tenga o no fotos).
    if (!texto || !/\[\[\s*fotos?\s*:/i.test(texto)) return normalizarPedirDatos(texto);
    const re = /\[\[\s*fotos?\s*:\s*([^\]]+)\]\]/gi;
    const nombres: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
      const n = String(m[1] ?? '').trim();
      if (n) nombres.push(n);
    }
    // Texto sin los marcadores (y sin dobles espacios/líneas que dejen).
    let limpio = texto.replace(re, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!nombres.length) return normalizarPedirDatos(limpio);

    // Enviamos las fotos de cada categoría pedida (sin repetir la misma).
    const vistos = new Set<string>();
    let totalFotos = 0;
    for (const n of nombres) {
      const key = norm(n);
      if (vistos.has(key)) continue;
      vistos.add(key);
      totalFotos += await enviarFotosDeCatalogo(supabase, from, n);
    }
    // Si el texto quedó vacío (la IA solo mandó el marcador) y sí se enviaron
    // fotos, devolvemos '' para que el que llama no mande un texto en blanco.
    return normalizarPedirDatos(limpio);
  } catch {
    // Ante cualquier error, al menos devolvemos el texto sin marcadores crudos.
    return normalizarPedirDatos(texto.replace(/\[\[\s*fotos?\s*:\s*[^\]]+\]\]/gi, '').trim());
  }
}

/**
 * Pre-filtro completo. Devuelve:
 *  - manejado: true si una regla envió (o decidió callar) algo.
 *  - saltarIA: true si NO hay que llamar a la IA en este turno.
 * `supabase` debe venir ya scopeado al tenant (como en el webhook). `msg` es el
 * mensaje entrante de WhatsApp (para ver su tipo: sticker, etc.).
 */
export async function preFiltroBot(
  supabase: any,
  from: string,
  texto: string,
  msg?: { type?: string },
): Promise<{ manejado: boolean; saltarIA: boolean }> {
  try {
    const t = norm(texto);

    // #3 — acuses, stickers y despedidas: no gastar IA, dejar el chat ahí.
    if (esIgnorable(texto, msg?.type)) return { manejado: true, saltarIA: true };

    // #6 — primer contacto desde un anuncio → catálogo + precios (o entrenamiento).
    const rb = await bienvenidaPorAnuncio(supabase, from);
    if (rb.enviado) return { manejado: true, saltarIA: rb.saltarIA };

    // Disparadores por palabra (regla → plantilla).
    if (t) {
      const rd = await disparadoresPorPalabra(supabase, from, t);
      if (rd.manejado && rd.saltarIA) return rd;

      // Catálogo por patrón (marca/modelo) → fotos + precios, SOLO la 1ª vez en el chat.
      const rc = await catalogoPorPatron(supabase, from, t);
      if (rc.manejado && rc.saltarIA) return rc;

      // #5 — Pregunta frecuente aprobada.
      if (await faqAprobada(supabase, from, t)) return { manejado: true, saltarIA: true };

      if (rc.manejado) return rc; // envió fotos pero sin texto → deja seguir a la IA
      if (rd.manejado) return rd; // regla envió algo pero deja seguir a la IA

      // Nada específico coincidió y es el PRIMER contacto sin campaña →
      // mostrar el menú de categorías reales en vez de un saludo genérico.
      const rg = await bienvenidaGeneral(supabase, from);
      if (rg.enviado) return { manejado: true, saltarIA: rg.saltarIA };
    }

    return { manejado: false, saltarIA: false };
  } catch {
    return { manejado: false, saltarIA: false };
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage, sendConfirmacionTemplate, sendImageByUrl } from '@/lib/whatsapp';
import { esOficina, etiquetarOficinaSinAbono } from '@/lib/etiqueta-oficina';
import { getProductImageUrl, FALLBACK_IMAGE } from '@/lib/product-catalog';
import { createServerSupabaseClient } from '@/lib/supabase';
import { isCompleteAddress, getAddressQuestion } from '@/lib/address';
import { lineaTalla } from '@/lib/formato-pedido';
import { validateAddressLupap, getLupapMessage } from '@/lib/lupap';
import Jimp from 'jimp';

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  // Strip leading 57 country code, keep 10 digits
  if (digits.startsWith('57') && digits.length >= 12) return digits.slice(2, 12);
  return digits.slice(-10);
}

function buildMensaje(data: {
  nombre: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  correo: string;
  talla: string;
  producto: string;
  valor: string;
}): string {
  return [
    'Hola 😊 te saluda Lilibeth. Tu pedido ya está listo para despacho 🚚✨ Por favor confirma que estos datos estén correctos:',
    `Nombre: ${data.nombre}`,
    `Teléfono: ${data.telefono}`,
    `Dirección: ${data.direccion}`,
    `Ciudad: ${data.ciudad}`,
    `Departamento: ${data.departamento}`,
    `Correo: ${data.correo}`,
    lineaTalla(data.talla),
    `Nombre del Producto: ${data.producto}`,
    `Valor a pagar: ${data.valor}`,
    '✅ Si todo está correcto responde: CONFIRMO',
    '✏️ Si deseas corregir algún dato, escríbelo en este chat.',
    '🚚 Una vez confirmado, tu pedido será despachado en las próximas 24 horas.',
  ].join('\n');
}

/** Texto que replica el cuerpo del template de Meta (para mostrar en QuinChat) */
function buildMensajeTemplate(data: {
  saludo: string;
  nombre: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  correo: string;
  talla: string;
  producto: string;
  valor: string;
}): string {
  return [
    `Hola ${data.saludo} 😊 te saludo de klixmant Tu pedido ya está listo para despacho 🚚`,
    `Nombre: ${data.nombre}`,
    `Teléfono: ${data.telefono}`,
    `Dirección: ${data.direccion}`,
    `Ciudad: ${data.ciudad}`,
    `Departamento: ${data.departamento}`,
    `Correo: ${data.correo}`,
    lineaTalla(data.talla),
    `Producto: ${data.producto}`,
    `Valor a pagar: ${data.valor}`,
    '✅ Si todo está correcto responde: CONFIRMO',
    '✏️ Si deseas corregir algún dato, escríbelo en este chat.',
    '🚚 Una vez confirmado, tu pedido será despachado en las próximas 24 horas.',
  ].join('\n');
}

// ── Whitelist de prueba (solo estos números reciben WA mientras el bot está en desarrollo) ──
const TEST_WHITELIST = new Set([
  '3143534918',
  '3167648391',
  '3016728642',
  '3052923975',
]);

// ── Packs (PACK X2) ─────────────────────────────────────────────────────────────
// Funnelish envía las variantes concatenadas en variant_name, ej: "ROJO / NEGRO / HOMBRE - M".
// Separamos colores de talla y armamos el producto combinado "ROJO TOYOTA + NEGRO TOYOTA".
const COLORES_CONOCIDOS = [
  'AZUL OSCURO', 'AZUL REY', 'AZUL NAVY', 'AZUL', 'ROJO', 'NEGRO',
  'BLANCO MARFIL', 'MARFIL', 'BLANCO', 'AMARILLO', 'BEIGE', 'VERDE OSCURO', 'VERDE', 'GRIS', 'COCOA',
];

function parsePack(productoNombre: string, variantName: string): {
  esPack: boolean; cantidad: number; familia: string; colores: string[]; productos: string[]; productoFinal: string; tallaFinal: string;
} {
  const nombreUp = productoNombre.toUpperCase();

  // Cuántas prendas trae el combo. En Funnelish el nombre varía mucho:
  // "PACK X2 REDBULL", "DOS COLORES UNA TALLA REDBULL", "2 COLORES ...", etc.
  const packMatch = nombreUp.match(/PACK\s*X?\s*(\d)/);
  let cantidad = packMatch ? parseInt(packMatch[1], 10) : 0;
  if (!cantidad) {
    if (/\b(DOS|2)\s+COLORES\b/.test(nombreUp))       cantidad = 2;
    else if (/\b(TRES|3)\s+COLORES\b/.test(nombreUp)) cantidad = 3;
  }

  // Quitar del nombre las palabras de mercadeo para quedarnos con la familia real
  // ("DOS COLORES UNA TALLA REDBULL" → "REDBULL").
  const familia = nombreUp
    .replace(/PACK\s*X?\s*\d/g, ' ')
    .replace(/\b(DOS|TRES|2|3)\s+COLORES\b/g, ' ')
    .replace(/\b(UNA|MISMA|IGUAL)\s+TALLA\b/g, ' ')
    .replace(/\bCOMBO\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const partes    = variantName.split('/').map(p => p.trim()).filter(Boolean);
  const colores: string[] = [];
  let talla = '';
  for (const p of partes) {
    const pUp    = p.toUpperCase();
    const limpio = pUp.replace(/[^A-Z0-9]/g, '');
    // Talla = contiene HOMBRE/DAMA/CABALLERO, o es un token de talla puro.
    const esTalla = /\b(HOMBRE|DAMA|CABALLERO)\b/.test(pUp) || /^(XS|S|M|L|XL|XXL|XXXL)$/.test(limpio);
    if (esTalla) {
      if (!talla) talla = p;
    } else {
      // Solo tomar colores reconocidos (evita meter basura como color)
      const color = COLORES_CONOCIDOS.find(c => pUp.includes(c));
      if (color) colores.push(color);
    }
  }
  const productos = colores.map(c => `${c} ${familia}`.trim());
  return {
    esPack:       cantidad >= 2 && colores.length >= 2, // combo de 2+ prendas con 2+ colores
    cantidad:     Math.max(1, cantidad),                // prendas del combo (PACK X2 = 2)
    familia,
    colores,
    productos,
    productoFinal: colores.length >= 2 ? productos.join(' + ') : productoNombre,
    tallaFinal:    talla || 'Por confirmar',
  };
}

/**
 * Arma la talla POR PRENDA a partir de la selección del embudo (packs de polos/
 * pareja), donde viene "COLOR / TALLA / COLOR / TALLA" separada por "/". Cada
 * prenda puede tener una talla DISTINTA, así que se muestran todas.
 * Ej: "NEGRO / M / NEGRO / XXL" → "NEGRO M + NEGRO XXL"
 */
function tallaPorPrenda(seleccion: string): string {
  const toks = String(seleccion ?? '').split('/').map(s => s.trim()).filter(Boolean);
  if (toks.length < 3) return seleccion; // no parece pack por color/talla
  const esTalla = (t: string) => /\b(HOMBRE|DAMA|CABALLERO|MUJER)\b/i.test(t)
    || /^(XS|S|M|L|XL|XXL|XXXL)\b/i.test(t.replace(/[^A-Za-z0-9]/g, ''));
  const prendas: string[] = [];
  let buffer: string[] = [];
  for (const tk of toks) {
    buffer.push(tk);
    if (esTalla(tk)) { prendas.push(buffer.join(' ')); buffer = []; }
  }
  if (buffer.length) prendas.push(buffer.join(' '));
  return prendas.length >= 2 ? prendas.join(' + ') : seleccion;
}

// Busca la imagen de un COLOR dentro de una familia (estricto por color, evita repetir otro color).
async function buscarImagenColor(supabase: any, color: string, familia: string): Promise<string | null> {
  const { data } = await supabase
    .from('catalogo_colores').select('color, nombre_producto, url_imagen')
    .not('url_imagen', 'is', null);
  if (!data || !data.length) return null;
  const colU     = color.toUpperCase();
  const famWords = familia.toUpperCase().split(/\s+/).filter((w: string) => w.length >= 3);
  // Candidatos: SOLO los del color pedido (por columna color o por nombre)
  const cands = data.filter((r: any) => {
    const cU = (r.color ?? '').toUpperCase();
    const nU = (r.nombre_producto ?? '').toUpperCase();
    return cU === colU || cU.includes(colU) || nU.includes(colU);
  });
  if (!cands.length) return null;
  // La palabra DISTINTIVA de la familia (PULSAR, HONDA…) es la que manda; las
  // genéricas (BUZO, MOTO…) las comparten todas.
  const GENERICAS = new Set(['BUZO', 'MOTO', 'REFLECTIVO', 'ESCUDERIA', 'PACK', 'REDBULL']);
  const distintivas = famWords.filter((w: string) => !GENERICAS.has(w));
  // Entre los del mismo color, el que más comparte con la familia
  let best: { url: string; score: number; name: string } | null = null;
  for (const r of cands) {
    const nU    = (r.nombre_producto ?? '').toUpperCase();
    const score = famWords.filter((w: string) => nU.includes(w)).length;
    if (!best || score > best.score) best = { url: r.url_imagen as string, score, name: nU };
  }
  // El match DEBE incluir la palabra distintiva de la familia; si no, es de otra
  // familia (foto equivocada) → mejor null y que caiga a la imagen del embudo.
  if (best && distintivas.length > 0 && !distintivas.some((w: string) => best!.name.includes(w))) return null;
  return best?.url ?? null;
}

/**
 * Verifica que Meta pueda descargar la imagen del header de la plantilla.
 * Si la URL responde 500, no es una imagen, o pesa más de 5 MB, Meta rechaza
 * TODO el mensaje (error 131053) y la confirmación no llega. Por eso se valida
 * antes de enviar y, si falla, se usa una imagen alternativa que sí sirva.
 */
async function imagenServible(url: string | null | undefined): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    // HEAD: pide solo los encabezados, NO descarga la imagen completa. Así validamos
    // que sirva sin gastar transferencia (egress) de Supabase en cada pedido.
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') ?? '';
    // Algunos CDN no devuelven content-type en HEAD: si viene, debe ser imagen;
    // si no viene, no lo descartamos por eso.
    if (ct && !ct.toLowerCase().startsWith('image/')) return false;
    const len = Number(res.headers.get('content-length') ?? '0');
    if (len && len > 5 * 1024 * 1024) return false; // Meta limita el header a ~5 MB
    return true;
  } catch { return false; }
}

// Busca la URL de imagen de un producto: exacta → por palabras → catálogo estático.
async function buscarImagenProducto(supabase: any, nombre: string): Promise<string> {
  if (nombre) {
    const { data: exactMatch } = await supabase
      .from('catalogo_colores').select('url_imagen')
      .ilike('nombre_producto', nombre).not('url_imagen', 'is', null)
      .limit(1).maybeSingle();
    if (exactMatch?.url_imagen) return exactMatch.url_imagen as string;

    const { data: allColors } = await supabase
      .from('catalogo_colores').select('nombre_producto, url_imagen')
      .not('url_imagen', 'is', null);
    if (allColors && allColors.length > 0) {
      const words = nombre.toUpperCase().split(/\s+/)
        .map((w: string) => w.replace(/[^A-Z0-9]/g, '')).filter((w: string) => w.length >= 3);
      // Palabras GENÉRICAS (comunes a muchas familias) y de COLOR: no identifican
      // la marca. La palabra DISTINTIVA (PULSAR, HONDA, FERRARI…) es la que manda.
      const GENERICAS = new Set(['BUZO', 'MOTO', 'REFLECTIVO', 'ESCUDERIA', 'PACK',
        'NEGRO', 'ROJO', 'AZUL', 'BLANCO', 'MARFIL', 'AMARILLO', 'BEIGE', 'VERDE',
        'GRIS', 'OSCURO', 'NAVY', 'COCOA', 'REDBULL']);
      const distintivas = words.filter((w: string) => !GENERICAS.has(w));
      let best: { url: string; score: number; name: string } | null = null;
      for (const row of allColors) {
        if (!row.nombre_producto || !row.url_imagen) continue;
        const name  = (row.nombre_producto as string).toUpperCase();
        const score = words.filter((w: string) => name.includes(w)).length;
        if (score > 0 && (!best || score > best.score)) best = { url: row.url_imagen as string, score, name };
      }
      // El match DEBE incluir la palabra distintiva (marca/familia). Si no la tiene,
      // es de OTRA familia (ej. Honda para un Pulsar) → se descarta para no mostrar
      // la foto equivocada; se cae a la imagen del embudo.
      if (best && distintivas.length > 0 && !distintivas.some((w: string) => best!.name.includes(w))) {
        best = null;
      }
      if (best) return best.url;
    }
  }
  return getProductImageUrl(nombre);
}

// Une las fotos de un pack en una sola imagen (lado a lado) y la sube a Supabase Storage.
// Cachea por combinación: si ya existe el collage de ese combo, lo reutiliza.
// Devuelve la URL pública, o null si algo falla (para caer al envío por separado).
async function generarCollagePack(supabase: any, productos: string[], imagenes: string[]): Promise<string | null> {
  try {
    const bucket   = 'chat-media';
    // La clave del caché DEBE depender de las FOTOS reales (los colores elegidos),
    // NO solo del nombre del producto. Antes un pack "NEGRO + NEGRO" reusaba el
    // collage viejo de "NEGRO + ROJO" porque el nombre era el mismo. Se hashean
    // las URLs de las fotos EN ORDEN, así cada combinación tiene su propio archivo.
    const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
    const fileName = `pack-${hash(imagenes.join('|'))}__v3.jpg`;
    const path     = `packs/${fileName}`;
    const supaUrl  = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    const publicUrl = `${supaUrl}/storage/v1/object/public/${bucket}/${path}`;

    // Caché: ¿ya existe el collage de este combo?
    const { data: existentes } = await supabase.storage.from(bucket).list('packs', { search: fileName });
    if (existentes && existentes.some((f: any) => f.name === fileName)) return publicUrl;

    // Componer las imágenes lado a lado, todas a la misma altura
    const H    = 900;
    const imgs = await Promise.all(imagenes.map((u: string) => Jimp.read(u)));
    imgs.forEach((im: any) => im.resize(Jimp.AUTO, H));
    const totalW = imgs.reduce((s: number, im: any) => s + im.getWidth(), 0);

    const canvas = new Jimp(totalW, H, 0xffffffff);
    let left = 0;
    imgs.forEach((im: any) => { canvas.composite(im, left, 0); left += im.getWidth(); });

    const buffer = await canvas.getBufferAsync(Jimp.MIME_JPEG);

    const { error: upErr } = await supabase.storage.from(bucket)
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
    if (upErr) { console.error('[Collage] upload error:', upErr.message); return null; }

    console.log(`[Collage] generado ${path}`);
    return publicUrl;
  } catch (e) {
    console.error('[Collage] error:', e);
    return null;
  }
}

// ── POST — Receive Funnelish purchase webhook ──────────────────────────────────
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only handle purchase events
  if (body.event && body.event !== 'purchase') {
    return NextResponse.json({ status: 'ignored' });
  }

  // ── Parse fields ─────────────────────────────────────────────────────────────
  const firstName  = String(body.first_name  ?? '').trim();
  const lastName   = String(body.last_name   ?? '').trim();
  const nombre     = [firstName, lastName].filter(Boolean).join(' ') || '—';

  const tel10      = normalizePhone(body.phone);
  const waPhone    = `57${tel10}`;

  const direccion    = String(body.address          ?? body.shipping_address ?? '—').trim();
  const ciudad       = String(body.city             ?? body.shipping_city    ?? '—').trim();
  const departamento = String(body.state            ?? body.shipping_state   ?? '—').trim();
  const correo       = String(body.optin_email      ?? 'Gerenciaquin7@gmail.com').trim() || 'Gerenciaquin7@gmail.com';

  const product        = Array.isArray(body.products) ? body.products[0] : null;
  // Foto que mandó la propia página de venta (respaldo si el catálogo no la tiene)
  const imagenPagina   = String(product?.image ?? body.imagen ?? '').trim();
  let   productoNombre = product?.name     ? String(product.name).trim()         : '—';
  const variantName    = product?.variant_name ? String(product.variant_name).trim() : '';
  let   talla = (variantName && !variantName.toUpperCase().includes('SELECCIONA'))
    ? variantName
    : 'Por confirmar';
  const montoRaw = product?.amount ?? 0;
  const valor    = montoRaw ? `$${Number(montoRaw).toLocaleString('es-CO')}` : '$130.000';

  const referencia = String(body.id ?? '');

  // Teléfono inválido / sin WhatsApp (ej: "0", vacío, no celular) → reenviar el pedido al admin
  // Copia a Lilibeth (…499) de todos los avisos operativos.
  const ADMINS_PERDIDOS = ['573143534918', '573187051499'];
  const avisarPerdidos = async (t: string) => {
    for (const n of ADMINS_PERDIDOS) { try { await sendTextMessage(n, t); } catch { /* no bloquear */ } }
  };
  const telValido = /^3\d{9}$/.test(tel10); // celular colombiano: 10 dígitos, empieza en 3
  if (!telValido) {
    const aviso =
      `⚠️ *PEDIDO SIN WHATSAPP VÁLIDO* — revísalo manualmente\n` +
      `Nombre: ${nombre}\n` +
      `Teléfono (como llegó): ${body.phone ?? '—'}\n` +
      `Dirección: ${direccion}\n` +
      `Ciudad: ${ciudad}\n` +
      `Departamento: ${departamento}\n` +
      `Correo: ${correo}\n` +
      `Producto: ${productoNombre}\n` +
      `Variante: ${variantName || '—'}\n` +
      `Valor: ${valor}`;
    await avisarPerdidos(aviso);
    return NextResponse.json({ status: 'forwarded_admin', reason: 'invalid phone' });
  }

  // ── PACK X2: separar colores y talla; armar producto combinado ────────────────
  const pack = parsePack(productoNombre, variantName);
  const packProductos = pack.esPack ? pack.productos : [];
  if (pack.esPack) {
    productoNombre = pack.productoFinal;   // ej: "ROJO TOYOTA + NEGRO TOYOTA"
    talla          = pack.tallaFinal;      // ej: "HOMBRE - M"
  } else if (pack.colores.length === 1) {
    // Producto individual con color en la variante (ej: "CABALLERO - XL / NEGRO MERCEDES BENZ")
    talla          = pack.tallaFinal;                        // solo la talla: "CABALLERO - XL"
    productoNombre = `${productoNombre} - ${pack.colores[0]}`; // mostrar el color: "... - NEGRO"
  }

  // Pack de NUESTRO embudo (trae fotos por prenda): cada prenda puede llevar una
  // talla DISTINTA. Se reconstruye la talla POR PRENDA para no perder ninguna
  // (antes solo mostraba la primera, ej. "M" en vez de "M" y "XXL").
  const esPackDelEmbudo = Array.isArray(body.imagenes)
    && body.imagenes.filter((u: any) => typeof u === 'string' && u.startsWith('http')).length >= 2;
  if (esPackDelEmbudo) {
    const perPrenda = tallaPorPrenda(variantName);
    if (perPrenda && /\s\+\s/.test(perPrenda)) talla = perPrenda;
  }
  const nombreImagenPrincipal = packProductos[0] ?? productoNombre;

  const mensaje = buildMensaje({ nombre, telefono: tel10, direccion, ciudad, departamento, correo, talla, producto: productoNombre, valor });

  const supabase = createServerSupabaseClient();

  // Buscar imagen(es). Para packs, una foto POR COLOR (estricto) para no repetir color.
  let imageUrl: string;
  let segundaImagenUrl: string | null;
  // Cuando ya se armó UN collage (una sola imagen con las 2/3 prendas), NO se debe
  // volver a enviar una "segunda imagen" suelta: eso duplicaba el envío (y fallaba
  // con error 131047 en números inactivos). Esta bandera lo evita.
  let esCollage = false;
  if (pack.esPack) {
    imageUrl = (await buscarImagenColor(supabase, pack.colores[0], pack.familia))
             ?? await buscarImagenProducto(supabase, packProductos[0]);
    segundaImagenUrl = pack.colores[1]
      ? ((await buscarImagenColor(supabase, pack.colores[1], pack.familia))
         ?? await buscarImagenProducto(supabase, packProductos[1]))
      : null;
    // Si ambas fotos resultaron iguales (un color sin foto), no repetir
    if (segundaImagenUrl && segundaImagenUrl === imageUrl) segundaImagenUrl = null;
  } else if (pack.colores.length === 1) {
    // Producto individual con color → buscar la foto de ESE color (no una al azar)
    imageUrl = (await buscarImagenColor(supabase, pack.colores[0], pack.familia))
             ?? await buscarImagenProducto(supabase, nombreImagenPrincipal);
    segundaImagenUrl = null;
  } else {
    imageUrl = await buscarImagenProducto(supabase, nombreImagenPrincipal);
    segundaImagenUrl = null;
  }

  // Si el catálogo no tenía foto real, usar la que mandó la página de venta.
  // Así la plantilla siempre lleva imagen y el primer mensaje SÍ se entrega.
  if ((!imageUrl || imageUrl === FALLBACK_IMAGE) && imagenPagina.startsWith('http')) {
    imageUrl = imagenPagina;
  }

  // ── "Arma tu pack": el cliente eligió 2 buzos con foto propia cada uno ────────
  // Vienen las fotos exactas de cada buzo → se unen en UN collage (x2).
  const imagenesPack: string[] = Array.isArray(body.imagenes)
    ? body.imagenes.filter((u: any) => typeof u === 'string' && u.startsWith('http'))
    : [];
  if (imagenesPack.length >= 2) {
    const collage = await generarCollagePack(
      supabase,
      imagenesPack.map((_, i) => `${productoNombre}-${i + 1}`),
      imagenesPack.slice(0, 3),
    );
    if (collage) { imageUrl = collage; segundaImagenUrl = null; esCollage = true; }
    else if (imagenesPack[0]) imageUrl = imagenesPack[0];
  } else if (imagenesPack.length === 1 && imagenesPack[0].startsWith('http')) {
    // "Arma tu buzo" de UNA prenda: la foto que el cliente eligió en la página
    // (marca + color exactos) MANDA sobre cualquier búsqueda del catálogo, que
    // podía traer una foto de otra familia (ej. Argentina para un Suzuki Negro).
    imageUrl = imagenesPack[0];
  }

  // Un PACK X2 SIEMPRE muestra DOS fotos, aunque las dos prendas sean del mismo
  // color: así el cliente ve claro que son 2 unidades. Si no hay una segunda foto
  // (mismo color), se repite la principal.
  if (pack.esPack && !esCollage && !segundaImagenUrl && imageUrl && imageUrl.startsWith('http') && imageUrl !== FALLBACK_IMAGE) {
    segundaImagenUrl = imageUrl;
  }

  // Pack con 2 fotos reales y DISTINTAS → unirlas en un collage y enviar UNA sola imagen.
  if (pack.esPack
      && imageUrl && imageUrl.startsWith('http') && imageUrl !== FALLBACK_IMAGE
      && segundaImagenUrl && segundaImagenUrl.startsWith('http') && segundaImagenUrl !== FALLBACK_IMAGE
      && imageUrl !== segundaImagenUrl) {
    const collage = await generarCollagePack(supabase, pack.productos, [imageUrl, segundaImagenUrl]);
    if (collage) { imageUrl = collage; segundaImagenUrl = null; esCollage = true; } // collage OK → no enviar 2da por separado
  }

  const now = new Date().toISOString();

  // ── Origen del tráfico (de qué campaña vino este pedido) ─────────────────────
  // Funnelish guarda los UTM en `meta`, pero según la versión pueden venir en la
  // raíz del webhook. Se busca en varios sitios para no perderlos.
  const meta = (body.meta ?? body.metadata ?? body.custom_fields ?? {}) as Record<string, any>;
  const buscarUtm = (clave: string): string => {
    const v = meta?.[clave] ?? body?.[clave] ?? meta?.[clave.toUpperCase()] ?? '';
    return String(v ?? '').trim();
  };
  const utmSource   = buscarUtm('utm_source');
  const utmMedium   = buscarUtm('utm_medium');
  const utmCampaign = buscarUtm('utm_campaign');
  const referrer    = buscarUtm('referrer');

  console.log(`[Funnelish] origen: source=${utmSource || '—'} campaign=${utmCampaign || '—'}`);

  // ── Guardar pedido en clientes_funnelish ──────────────────────────────────────
  // Usamos insert-or-update manual en lugar de upsert(onConflict:'referencia')
  // porque si 'referencia' no tiene UNIQUE constraint en Supabase, el upsert falla silenciosamente.
  // Foto que representa este producto/color. Se guarda PEGADA al pedido para que
  // la confirmación (cliente y ficha al admin) siempre muestre la foto correcta,
  // aunque el color cambie después. Solo se guarda si es una imagen real.
  const fotoProducto = (imageUrl && imageUrl.startsWith('http') && imageUrl !== FALLBACK_IMAGE)
    ? imageUrl
    : (imagenPagina.startsWith('http') ? imagenPagina : null);

  const pedidoData = {
    telefono:    tel10,
    nombre,
    producto:    productoNombre,
    cantidad:    pack.cantidad, // prendas del pedido (PACK X2 = 2) → para el monedero de metas
    foto_producto: fotoProducto,
    talla,
    valor,
    ciudad,
    departamento,
    direccion,
    correo,
    referencia,
    estado:      'pendiente',
    wa_enviado:  false,
    confirmado:  false,
    updated_at:  now,
    utm_source:   utmSource   || null,
    utm_medium:   utmMedium   || null,
    utm_campaign: utmCampaign || null,
    referrer:     referrer    || null,
  };

  // ── Dedupe de RECOMPRAS DOBLES (doble clic en "comprar") ────────────────────
  // Si el mismo teléfono manda otro pedido del MISMO producto en pocos minutos,
  // no se confirma de nuevo: se conserva UNO solo (enriquecido con lo más
  // completo) y el resto se marca 'duplicado' para que no cuente ni se confirme.
  {
    const hace = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    let q = supabase.from('clientes_funnelish')
      .select('id, producto, direccion, correo, talla, ciudad, departamento')
      .eq('telefono', tel10)
      .not('estado', 'in', '("cancelado","duplicado")')
      .gte('created_at', hace)
      .order('created_at', { ascending: false }).limit(1);
    if (referencia) q = q.neq('referencia', referencia);
    const { data: previo } = await q.maybeSingle();

    const mismoProducto = previo &&
      String((previo as any).producto ?? '').toUpperCase().trim() === String(productoNombre ?? '').toUpperCase().trim();

    if (previo && mismoProducto) {
      // Enriquecer el pedido que se queda con los datos más completos que lleguen
      const completo = (v: any) => String(v ?? '').trim().length > 2 && String(v).trim() !== '—';
      const mejora: Record<string, any> = {};
      if (!completo((previo as any).direccion)    && completo(direccion))    mejora.direccion = direccion;
      if (!completo((previo as any).correo)       && completo(correo))       mejora.correo = correo;
      if (!completo((previo as any).talla)        && completo(talla))        mejora.talla = talla;
      if (!completo((previo as any).ciudad)       && completo(ciudad))       mejora.ciudad = ciudad;
      if (!completo((previo as any).departamento) && completo(departamento)) mejora.departamento = departamento;
      if (Object.keys(mejora).length) {
        await supabase.from('clientes_funnelish').update({ ...mejora, updated_at: now }).eq('id', (previo as any).id);
      }
      // El pedido entrante queda registrado como duplicado (no cuenta, no se confirma)
      await supabase.from('clientes_funnelish').insert({ ...pedidoData, estado: 'duplicado', created_at: now });
      console.log(`[Funnelish] recompra doble ignorada tel=${tel10} prod=${productoNombre}`);
      return NextResponse.json({ status: 'duplicado', tel: tel10 });
    }
  }

  // Intentar buscar por referencia primero (para actualizar si ya existe)
  let pedidoGuardado = false;
  let pedidoId: string | null = null;
  if (referencia) {
    const { data: existing, error: findErr } = await supabase
      .from('clientes_funnelish').select('id').eq('referencia', referencia).maybeSingle();
    if (findErr) console.error('[Funnelish] buscar referencia error:', findErr.message);

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from('clientes_funnelish').update(pedidoData).eq('id', existing.id);
      if (updErr) console.error('[Funnelish] update existente error:', updErr.message);
      else { pedidoGuardado = true; pedidoId = existing.id; }
    }
  }

  // Si no encontramos por referencia, insertar nuevo
  if (!pedidoGuardado) {
    const { data: insertado, error: insErr } = await supabase
      .from('clientes_funnelish').insert({ ...pedidoData, created_at: now })
      .select('id').maybeSingle();
    if (insErr) console.error('[Funnelish] insert nuevo error:', insErr.message);
    else { pedidoGuardado = true; pedidoId = insertado?.id ?? null; }
  }

  console.log(`[Funnelish] pedido guardado=${pedidoGuardado} tel=${tel10} ref=${referencia || 'sin-ref'}`);

  // ── Pedido duplicado (el cliente hizo doble clic en "Comprar") ───────────────
  // Si en los últimos 45 min ya entró un pedido del MISMO producto para este
  // teléfono, no es una compra nueva: es el mismo pedido repetido. Se conserva
  // uno solo, completándolo con los datos que traiga el más nuevo, y este se
  // marca como duplicado (no se le escribe otra vez al cliente).
  if (pedidoGuardado && pedidoId) {
    try {
      const hace45min = new Date(Date.now() - 45 * 60_000).toISOString();
      const { data: recientes } = await supabase
        .from('clientes_funnelish')
        .select('id, producto, talla, direccion, ciudad, departamento, correo, nombre, valor, wa_enviado, created_at')
        .eq('telefono', tel10).eq('confirmado', false)
        .neq('id', pedidoId)
        .not('estado', 'in', '("cancelado","duplicado")')
        .gte('created_at', hace45min)
        .order('created_at', { ascending: true });

      const norm = (s: any) => String(s ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
      const gemelo = (recientes ?? []).find((r: any) => norm(r.producto) === norm(productoNombre));

      if (gemelo) {
        // Se queda el que ya existía (a ese ya se le escribió al cliente),
        // pero se le completan los datos que le falten con los del nuevo.
        const faltante = (v: any) => !v || v === '—' || v === 'Por confirmar' || v === 'ELIGE TALLA';
        const mejoras: Record<string, unknown> = {};
        if (faltante(gemelo.talla)        && !faltante(talla))        mejoras.talla = talla;
        if (faltante(gemelo.direccion)    && !faltante(direccion))    mejoras.direccion = direccion;
        if (faltante(gemelo.ciudad)       && !faltante(ciudad))       mejoras.ciudad = ciudad;
        if (faltante(gemelo.departamento) && !faltante(departamento)) mejoras.departamento = departamento;
        if (faltante(gemelo.correo)       && !faltante(correo))       mejoras.correo = correo;
        if (faltante(gemelo.nombre)       && !faltante(nombre))       mejoras.nombre = nombre;

        if (Object.keys(mejoras).length > 0) {
          await supabase.from('clientes_funnelish').update(mejoras).eq('id', gemelo.id);
        }
        await supabase.from('clientes_funnelish')
          .update({ estado: 'duplicado', wa_enviado: true, wa_enviado_at: now })
          .eq('id', pedidoId);

        console.log(`[Funnelish] duplicado detectado tel=${tel10} producto="${productoNombre}" → se conserva ${gemelo.id}`);
        return NextResponse.json({ success: true, phone: `57${tel10}`, duplicado: true });
      }
    } catch (e) {
      console.error('[Funnelish] error revisando duplicados:', e);
    }
  }

  // ── Send WhatsApp ──────────────────────────────────────────────────────────────
  // 🚀 PRODUCCIÓN: el bot envía la confirmación a TODOS los clientes.
  //    Para volver a modo prueba (solo la whitelist), pon MODO_PRODUCCION = false.
  const MODO_PRODUCCION = true;
  const enWhitelist = MODO_PRODUCCION || TEST_WHITELIST.has(tel10);
  let sent = false;
  let templateSent = false;
  let templateWamid: string | null = null;
  let textoWamid: string | null = null; // ID cuando se manda como texto plano

  // El template de Meta requiere imagen real en el header.
  // Si el producto no está en el catálogo, imageUrl es FALLBACK_IMAGE (placeholder.png)
  // que puede no existir → Meta acepta el envío (devuelve wamid) pero NO entrega el mensaje.
  // Solución: solo usar template si hay imagen real del producto.
  if (enWhitelist) {
    // Elegir una imagen para el header que Meta SÍ pueda descargar. Se prueba la
    // del producto; si falla (500/pesada), la de la página de venta; y de último
    // el placeholder. Así la plantilla siempre sale con una imagen válida y la
    // confirmación se entrega. (imageUrl original se conserva para mostrar en el panel.)
    let imagenHeader: string | null = null;
    for (const cand of [
      imageUrl,
      imagenPagina?.startsWith('http') ? imagenPagina : null,
      FALLBACK_IMAGE,
    ]) {
      if (cand && await imagenServible(cand)) { imagenHeader = cand; break; }
    }
    if (imagenHeader && imagenHeader !== imageUrl) {
      console.warn(`[Funnelish] header "${imageUrl}" no descargable → usando "${imagenHeader}"`);
    }

    if (imagenHeader) {
      // Intentar template primero (funciona incluso sin ventana 24h)
      templateWamid = await sendConfirmacionTemplate(waPhone, {
        saludo:   firstName || nombre,
        nombre, telefono: tel10, direccion, ciudad, departamento,
        correo, talla, producto: productoNombre, valor, imageUrl: imagenHeader,
      });
      templateSent = !!templateWamid;
      sent = templateSent;
    } else {
      console.warn(`[Funnelish] Producto "${productoNombre}" sin imagen descargable → usando texto plano`);
    }

    // Si el template falla o no hay imagen válida → caer al texto plano
    if (!sent) {
      textoWamid = await sendTextMessage(waPhone, mensaje);
      sent = !!textoWamid;
    }
  } else {
    console.log(`[Funnelish] Order ${referencia} → ${waPhone} | MODO PRUEBA: número no en whitelist`);
  }

  // Número con formato válido pero el envío falló (probablemente NO tiene WhatsApp) → avisar al admin
  if (enWhitelist && !sent) {
    const aviso =
      `⚠️ *PEDIDO NO ENTREGADO POR WHATSAPP* (el número puede no tener WhatsApp) — revísalo\n` +
      `Nombre: ${nombre}\n` +
      `Teléfono: ${tel10}\n` +
      `Dirección: ${direccion}\n` +
      `Ciudad: ${ciudad}\n` +
      `Departamento: ${departamento}\n` +
      `Correo: ${correo}\n` +
      `Producto: ${productoNombre}\n` +
      `Valor: ${valor}`;
    await avisarPerdidos(aviso);
  }

  if (sent) {
    // Texto a guardar en QuinChat
    const mensajeAlmacenado = templateSent
      ? buildMensajeTemplate({
          saludo: firstName || nombre,
          nombre, telefono: tel10, direccion, ciudad, departamento,
          correo, talla, producto: productoNombre, valor,
        })
      : mensaje;

    // ── 1. Mark wa_enviado ──────────────────────────────────────────────────
    const { error: waErr } = await supabase
      .from('clientes_funnelish')
      .update({ wa_enviado: true, wa_enviado_at: now, estado: 'wa_enviado' })
      .eq('telefono', tel10)
      .eq('confirmado', false);
    if (waErr) console.error('[Funnelish] update wa_enviado error:', waErr.message);

    // ── 2. Upsert conversation ──────────────────────────────────────────────
    const { error: convErr } = await supabase.from('conversations').upsert({
      id:                waPhone,
      contact_name:      nombre,
      last_message:      mensajeAlmacenado.slice(0, 100),
      last_message_time: now,
      unread_count:      1,
      bot_enabled:       true,
      label:             'PENDIENTE POR CONFIRMACIÓN',
    }, { onConflict: 'id' });
    if (convErr) console.error('[Funnelish] upsert conversation error:', convErr.message);

    // Si el pedido entra para RECLAMAR EN OFICINA, se etiqueta como "OFICINA SIN
    // ABONO" (etiqueta adicional, no toca el estado) para poder rescatarlo.
    if (esOficina(direccion)) {
      try { await etiquetarOficinaSinAbono(supabase, waPhone); } catch { /* no bloquear */ }
    }

    // ── 3. Guardar foto del producto ────────────────────────────────────────
    if (imageUrl && imageUrl.startsWith('http')) {
      const { error: imgErr } = await supabase.from('messages').insert({
        id:              `funnelish-img-${referencia || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conversation_id: waPhone,
        content:         imageUrl,
        role:            'assistant',
        type:            'image',
        whatsapp_id:     null,
        created_at:      now,
      });
      if (imgErr) console.error('[Funnelish] insert image error:', imgErr.message);
    }

    // ── 3b. Segunda foto (packs X2) ─────────────────────────────────────────
    if (enWhitelist && !esCollage && segundaImagenUrl && segundaImagenUrl.startsWith('http') && segundaImagenUrl !== FALLBACK_IMAGE) {
      const img2Wamid = await sendImageByUrl(waPhone, segundaImagenUrl, productoNombre);
      const { error: img2Err } = await supabase.from('messages').insert({
        id:              `funnelish-img2-${referencia || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conversation_id: waPhone,
        content:         segundaImagenUrl,
        role:            'assistant',
        type:            'image',
        whatsapp_id:     img2Wamid,
        created_at:      now,
      });
      if (img2Err) console.error('[Funnelish] insert segunda imagen error:', img2Err.message);
    }

    // ── 4. Guardar mensaje de confirmación ─────────────────────────────────
    const msgId = `funnelish-${referencia || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { error: msgErr } = await supabase.from('messages').insert({
      id:              msgId,
      conversation_id: waPhone,
      content:         mensajeAlmacenado,
      role:            'assistant',
      type:            'text',
      whatsapp_id:     templateWamid ?? textoWamid,
      created_at:      now,
    });
    if (msgErr) console.error('[Funnelish] insert template msg error:', msgErr.message);

    console.log(`[Funnelish] Saved to DB → conv=${waPhone} img=${!!imageUrl} msg=${!msgErr}`);

    // NOTA: el audio de "abono para reclamar en oficina" NO se manda aquí.
    // Este es el mensaje inicial y el cliente casi siempre está fuera de la
    // ventana de 24h, así que el audio fallaba (error 131047). Ese audio ahora
    // se envía SOLO cuando el cliente escribe en vivo que quiere reclamar en la
    // oficina de Interrapidísimo (ver app/api/whatsapp/webhook/route.ts).

    // ── 6. Preguntar datos faltantes ────────────────────────────────────────
    // Dirección: primero verificar si es incompleta (tiene algo pero no es válida)
    const dirIncompleta = (direccion && direccion !== '—') && !isCompleteAddress(direccion);
    const dirFaltante   = !direccion || direccion === '—';

    const missingMsgs: string[] = [];

    // Dirección incompleta → pregunta específica según lo que falta
    if (dirFaltante) {
      missingMsgs.push('📍 Para completar tu pedido necesito tu *dirección de envío completa*. Por ejemplo: *Calle 15 # 20-30 Barrio Los Pinos* o *Conjunto Arboleda, Casa 5*.');
    } else if (dirIncompleta) {
      const addrQ = getAddressQuestion(direccion);
      if (addrQ) missingMsgs.push(addrQ);
    } else if (direccion && direccion !== '—') {
      // Dirección pasa validación local → verificar con Lupap (geocodificación real)
      const lupapResult = await validateAddressLupap(direccion, ciudad ?? '');
      const lupapMsg = getLupapMessage(lupapResult, direccion);
      if (lupapMsg) missingMsgs.push(lupapMsg);
    }

    if (!ciudad    || ciudad    === '—') missingMsgs.push('📋 ¿Me confirmas tu *ciudad de envío*?');
    if (!departamento || departamento === '—') missingMsgs.push('📋 ¿Me confirmas tu *departamento*?');
    if (talla === 'Por confirmar') missingMsgs.push('📋 ¿Cuál es tu *talla* del buzo? (XS, S, M, L, XL, XXL, XXXL)');

    // NO se pueden enviar ahora: WhatsApp solo permite plantillas mientras el cliente
    // no haya respondido (ventana de 24h cerrada). Se guardan como pendientes y el
    // webhook de WhatsApp las envía en cuanto el cliente escriba por primera vez.
    if (missingMsgs.length > 0) {
      const q = supabase
        .from('clientes_funnelish')
        .update({ preguntas_pendientes: JSON.stringify(missingMsgs) });
      const { error: pendErr } = referencia
        ? await q.eq('referencia', referencia)
        : await q.eq('telefono', tel10).eq('confirmado', false);
      if (pendErr) console.error('[Funnelish] guardar preguntas_pendientes error:', pendErr.message);
    }
  }

  console.log(`[Funnelish] Order ${referencia} → ${waPhone} | sent=${sent} | img=${imageUrl}`);
  return NextResponse.json({ success: true, phone: waPhone, sent });
}
